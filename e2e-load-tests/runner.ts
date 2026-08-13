import path from "path";
import { fileURLToPath } from "url";
import { fork, ChildProcess } from "child_process";
import { doc, onSnapshot } from "firebase/firestore";
import { getLoadTestFirebase } from "../load-tests/config.js";
import { E2EQuizSessionDriver } from "./session-driver.js";
import { 
  E2ELoadTestSummary, 
  ParticipantStats, 
  PageDeliveryResult,
  WorkerToParentMessage, 
  WorkerInitPayload 
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.join(__dirname, "worker.ts");

export interface E2ELoadTestRunnerOptions {
  eventId: string;
  baseUrl?: string;
  usersCount: number;
  rampUpSeconds?: number;
  burstWindowSeconds?: number;
  scenarioName?: string;
  usersPerWorker?: number;
  httpTimeoutMs?: number;
  hostMode?: "auto" | "manual";
  autoDriveSession?: boolean;
  questionDurationSec?: number;
}

export class E2ELoadTestRunner {
  private eventId: string;
  private baseUrl: string;
  private targetParticipantsCount: number;
  private rampUpSeconds: number;
  private burstWindowSeconds: number;
  private scenarioName: string;
  private usersPerWorker: number;
  private httpTimeoutMs: number;
  private hostMode: "auto" | "manual";
  private autoDriveSession: boolean;
  private questionDurationSec: number;

  private sessionDriver: E2EQuizSessionDriver | null = null;
  private startTime: number = 0;

  constructor(options: E2ELoadTestRunnerOptions) {
    this.eventId = options.eventId;
    this.baseUrl = (options.baseUrl || "https://zero2one-studypartner.vercel.app").replace(/\/+$/, "");
    this.targetParticipantsCount = options.usersCount;
    this.rampUpSeconds = options.rampUpSeconds || 5;
    this.burstWindowSeconds = options.burstWindowSeconds || 2;
    this.scenarioName = options.scenarioName || "CUSTOM";
    this.usersPerWorker = Math.min(options.usersPerWorker || 50, Math.max(1, options.usersCount));
    this.httpTimeoutMs = options.httpTimeoutMs || 30000;
    
    this.hostMode = options.hostMode || (options.autoDriveSession === false ? "manual" : "auto");
    this.autoDriveSession = this.hostMode === "auto" && options.autoDriveSession !== false;
    this.questionDurationSec = options.questionDurationSec || 15;
  }

  public async run(explicitDurationSeconds?: number): Promise<E2ELoadTestSummary> {
    const { db } = getLoadTestFirebase();
    this.startTime = Date.now();

    const numWorkers = Math.max(1, Math.ceil(this.targetParticipantsCount / this.usersPerWorker));

    // Dynamic duration calculation
    const revealSec = 3;
    const lbSec = 3;
    const quizLifecycleSec = 5 * (this.questionDurationSec + revealSec + lbSec);
    const dynamicDurationSeconds = this.hostMode === "manual"
      ? (explicitDurationSeconds || 600) // 10 mins default for manual host operations
      : Math.max(60, this.rampUpSeconds + 15 + quizLifecycleSec);

    const maxDurationSeconds = explicitDurationSeconds || dynamicDurationSeconds;

    console.log("\n==================================================");
    console.log("🚀 ZERO2ONE END-TO-END LOAD TEST RUNNER");
    console.log(`Target Event ID:      ${this.eventId}`);
    console.log(`Deployed Base URL:    ${this.baseUrl}`);
    console.log(`Target Event URL:     ${this.baseUrl}/events/${this.eventId}`);
    console.log(`Scenario:             ${this.scenarioName}`);
    console.log(`Virtual Participants: ${this.targetParticipantsCount}`);
    console.log(`Worker Processes:     ${numWorkers} (~${this.usersPerWorker} participants/worker)`);
    console.log(`Ramp-up Window:       ${this.rampUpSeconds}s`);
    console.log(`Burst Window:        ${this.burstWindowSeconds}s`);
    console.log(`Vercel HTTP Timeout:  ${this.httpTimeoutMs}ms`);
    console.log(`Max Test Duration:    ${maxDurationSeconds}s`);
    console.log(`Host Mode:            ${this.hostMode.toUpperCase()} ${this.hostMode === "manual" ? "(Real production host controls quiz via UI)" : "(Automated SessionDriver controls quiz)"}`);
    console.log("==================================================\n");

    console.log(`⏳ Forking ${numWorkers} worker processes to simulate ${this.targetParticipantsCount} participants...`);

    const workerProcesses: ChildProcess[] = [];
    const workerProgressMap: Map<number, { joinedCount: number; answersSuccessful: number; answersFailed: number }> = new Map();
    const workerStatsPromises: Promise<ParticipantStats[]>[] = [];

    let spawnedUsers = 0;

    for (let w = 0; w < numWorkers; w++) {
      const workerId = w + 1;
      const workerUserCount = Math.min(this.usersPerWorker, this.targetParticipantsCount - spawnedUsers);
      const startUserIndex = spawnedUsers + 1;
      spawnedUsers += workerUserCount;

      const workerRampUpMs = Math.floor((this.rampUpSeconds * 1000 * workerUserCount) / this.targetParticipantsCount);

      const execArgv = process.execArgv.length > 0 ? process.execArgv : ["--import", "tsx"];
      const child = fork(workerPath, [], { execArgv });
      workerProcesses.push(child);

      workerProgressMap.set(workerId, { joinedCount: 0, answersSuccessful: 0, answersFailed: 0 });

      const statsPromise = new Promise<ParticipantStats[]>((resolve) => {
        child.on("message", (msg: WorkerToParentMessage) => {
          if (msg.type === "PROGRESS") {
            workerProgressMap.set(msg.workerId, {
              joinedCount: msg.joinedCount,
              answersSuccessful: msg.answersSuccessful,
              answersFailed: msg.answersFailed
            });
          } else if (msg.type === "STATS") {
            resolve(msg.stats);
          }
        });
      });

      workerStatsPromises.push(statsPromise);

      const payload: WorkerInitPayload = {
        workerId,
        startUserIndex,
        userCount: workerUserCount,
        eventId: this.eventId,
        baseUrl: this.baseUrl,
        burstWindowMs: this.burstWindowSeconds * 1000,
        rampUpMs: workerRampUpMs,
        httpTimeoutMs: this.httpTimeoutMs
      };

      child.send({ type: "START", payload });
    }

    console.log(`\n✅ ${numWorkers} worker processes active. Launching participant setup...`);

    // Setup Parent Session Listener for Manual Host or Progress Monitoring
    let isQuizCompletedInFirestore = false;
    let lastLoggedStage: string | null = null;
    let lastLoggedQIndex: number | null = null;

    const sessionRef = doc(db, "events", this.eventId, "activities", "quiz", "session", "current");
    const unsubSession = onSnapshot(sessionRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      const stage = data.stage;
      const qIndex = typeof data.currentQuestionIndex === "number" ? data.currentQuestionIndex : -1;

      if (this.hostMode === "manual") {
        if (stage === "question" && qIndex !== lastLoggedQIndex) {
          lastLoggedQIndex = qIndex;
          lastLoggedStage = stage;
          console.log(`\n[Manual Host] Question ${qIndex + 1} detected`);
        } else if ((stage === "answer_reveal" || stage === "leaderboard") && lastLoggedStage !== stage) {
          lastLoggedStage = stage;
          console.log(`[Manual Host] Waiting for host to advance...`);
        } else if (stage === "completed" && lastLoggedStage !== stage) {
          lastLoggedStage = stage;
          console.log(`\n[Manual Host] Quiz completion detected (stage == "completed")`);
          isQuizCompletedInFirestore = true;
        }
      } else {
        if (stage === "completed") {
          isQuizCompletedInFirestore = true;
        }
      }
    });

    if (this.hostMode === "manual") {
      console.log(`[Manual Host] Waiting for host to start quiz...`);
    } else if (this.autoDriveSession) {
      // Launch SessionDriver in AUTO mode
      this.sessionDriver = new E2EQuizSessionDriver(db, this.eventId, {
        questionDurationSec: this.questionDurationSec,
        revealDurationSec: revealSec,
        leaderboardDurationSec: lbSec
      });

      const startDelayMs = Math.min(6000, this.rampUpSeconds * 1000);
      setTimeout(() => {
        if (this.sessionDriver) {
          this.sessionDriver.driveSession();
        }
      }, startDelayMs);
    }

    // Monitor progress
    const monitorStartTime = Date.now();
    let isFinishedEarly = false;

    const interval = setInterval(() => {
      let totalJoined = 0;
      let totalSuccessful = 0;
      let totalFailed = 0;

      workerProgressMap.forEach((val) => {
        totalJoined += val.joinedCount;
        totalSuccessful += val.answersSuccessful;
        totalFailed += val.answersFailed;
      });

      const expectedTotal = totalJoined * 5;
      console.log(`[Progress] ${totalJoined} participants | ${totalSuccessful} answers | Failures: ${totalFailed}`);

      if (
        (isQuizCompletedInFirestore || (totalJoined > 0 && totalSuccessful >= expectedTotal)) &&
        totalJoined === this.targetParticipantsCount &&
        totalSuccessful >= expectedTotal
      ) {
        console.log(`\n🎉 All ${expectedTotal} expected answers successfully recorded!`);
        isFinishedEarly = true;
      }
    }, 3000);

    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, maxDurationSeconds * 1000));

    while (!isFinishedEarly && (Date.now() - monitorStartTime) < maxDurationSeconds * 1000) {
      await Promise.race([
        timeoutPromise,
        new Promise((r) => setTimeout(r, 1000))
      ]);
      if (isFinishedEarly) break;
    }

    clearInterval(interval);
    unsubSession();

    console.log("\n⏹️ Monitoring window complete. Requesting stats from workers...");

    workerProcesses.forEach((child) => {
      if (child.connected) {
        child.send({ type: "GET_STATS" });
      }
    });

    const allWorkerStats = await Promise.all(workerStatsPromises);
    const combinedStats: ParticipantStats[] = allWorkerStats.flat();

    if (this.sessionDriver) {
      this.sessionDriver.stop();
    }

    const summary = this.generateSummary(combinedStats, numWorkers);
    this.printReport(summary);

    return summary;
  }

  private generateSummary(stats: ParticipantStats[], workersCount: number): E2ELoadTestSummary {
    const pageResults: PageDeliveryResult[] = stats.map((s) => s.pageDelivery);
    const pageReqsTotal = pageResults.length;
    const pageReqsSuccess = pageResults.filter((r) => r.success).length;
    const pageReqsFailed = pageReqsTotal - pageReqsSuccess;

    let status2xx = 0, status4xx = 0, status5xx = 0;
    let pageTimeouts = 0, pageNetworkErrors = 0;

    pageResults.forEach((r) => {
      if (r.statusCode) {
        if (r.statusCode >= 200 && r.statusCode < 300) status2xx++;
        else if (r.statusCode >= 400 && r.statusCode < 500) status4xx++;
        else if (r.statusCode >= 500 && r.statusCode < 600) status5xx++;
      }
      if (r.errorType === "timeout") pageTimeouts++;
      if (r.errorType === "network") pageNetworkErrors++;
    });

    const pageLatencies = pageResults.map((r) => r.latencyMs).sort((a, b) => a - b);
    const avgPageMs = pageLatencies.length ? pageLatencies.reduce((a, b) => a + b, 0) / pageLatencies.length : 0;
    const minPageMs = pageLatencies.length ? pageLatencies[0] : 0;
    const maxPageMs = pageLatencies.length ? pageLatencies[pageLatencies.length - 1] : 0;
    const p50PageMs = this.percentile(pageLatencies, 50);
    const p95PageMs = this.percentile(pageLatencies, 95);
    const p99PageMs = this.percentile(pageLatencies, 99);

    // Firestore Participant Workload
    const joinedUsers = stats.filter((s) => s.joined).length;
    const failedJoins = this.targetParticipantsCount - joinedUsers;

    const joinLatencies = stats.map((s) => s.joinLatencyMs).sort((a, b) => a - b);
    const avgJoinMs = joinLatencies.length ? joinLatencies.reduce((a, b) => a + b, 0) / joinLatencies.length : 0;
    const p50JoinMs = this.percentile(joinLatencies, 50);
    const p95JoinMs = this.percentile(joinLatencies, 95);
    const p99JoinMs = this.percentile(joinLatencies, 99);

    const allAnswerLatencies: number[] = [];
    const allSessionSyncs: number[] = [];
    const allLbSyncs: number[] = [];

    let totalSuccessfulAnswers = 0;
    let totalFailedAnswers = 0;
    let peakListenersTotal = 0;

    const errorsBreakdown = {
      permission: 0,
      timeout: 0,
      network: 0,
      rateLimit: 0,
      firestore: 0,
      other: 0
    };

    let usersCompleted5Of5 = 0;

    stats.forEach((s) => {
      totalSuccessfulAnswers += s.answersSuccessful;
      totalFailedAnswers += s.answersFailed;
      if (s.answersSuccessful === 5) usersCompleted5Of5++;

      s.answerLatencies.forEach((al) => allAnswerLatencies.push(al.durationMs));
      s.sessionSyncs.forEach((ss) => allSessionSyncs.push(ss.latencyMs));
      s.leaderboardSyncs.forEach((ls) => allLbSyncs.push(ls.latencyMs));

      peakListenersTotal += (s.peakListenersCount || s.activeListenersCount);

      s.errors.forEach((e) => {
        const k = e.type as keyof typeof errorsBreakdown;
        if (errorsBreakdown[k] !== undefined) errorsBreakdown[k]++;
        else errorsBreakdown.other++;
      });
    });

    const sortedAnswerLatencies = allAnswerLatencies.sort((a, b) => a - b);
    const avgAnswerMs = sortedAnswerLatencies.length ? sortedAnswerLatencies.reduce((a, b) => a + b, 0) / sortedAnswerLatencies.length : 0;
    const minAnswerMs = sortedAnswerLatencies.length ? sortedAnswerLatencies[0] : 0;
    const maxAnswerMs = sortedAnswerLatencies.length ? sortedAnswerLatencies[sortedAnswerLatencies.length - 1] : 0;
    const p50AnswerMs = this.percentile(sortedAnswerLatencies, 50);
    const p95AnswerMs = this.percentile(sortedAnswerLatencies, 95);
    const p99AnswerMs = this.percentile(sortedAnswerLatencies, 99);

    const sortedSessionSyncs = allSessionSyncs.sort((a, b) => a - b);
    const avgSessionSyncMs = sortedSessionSyncs.length ? sortedSessionSyncs.reduce((a, b) => a + b, 0) / sortedSessionSyncs.length : 0;
    const p95SessionSyncMs = this.percentile(sortedSessionSyncs, 95);

    const sortedLbSyncs = allLbSyncs.sort((a, b) => a - b);
    const avgLbSyncMs = sortedLbSyncs.length ? sortedLbSyncs.reduce((a, b) => a + b, 0) / sortedLbSyncs.length : 0;
    const p95LbSyncMs = this.percentile(sortedLbSyncs, 95);

    const expectedAnswers = joinedUsers * 5;
    const completionPercentage = expectedAnswers > 0 ? Number(((totalSuccessfulAnswers / expectedAnswers) * 100).toFixed(1)) : 0;
    const usersIncomplete = joinedUsers - usersCompleted5Of5;
    const isComplete = totalSuccessfulAnswers >= expectedAnswers && usersCompleted5Of5 === joinedUsers && joinedUsers === this.targetParticipantsCount;

    const initialReadsEstimate = joinedUsers * 5; // 5 initial snapshot reads per participant
    const totalWrites = joinedUsers + totalSuccessfulAnswers; // 1 join write + up to 5 answer writes per participant

    return {
      eventId: this.eventId,
      targetUrl: `${this.baseUrl}/events/${this.eventId}`,
      scenarioName: this.scenarioName,
      workersCount,
      usersPerWorker: this.usersPerWorker,

      pageDelivery: {
        totalRequests: pageReqsTotal,
        successful: pageReqsSuccess,
        failed: pageReqsFailed,
        status2xx,
        status4xx,
        status5xx,
        timeouts: pageTimeouts,
        networkErrors: pageNetworkErrors,
        latencyMs: {
          avg: Math.round(avgPageMs),
          min: Math.round(minPageMs),
          max: Math.round(maxPageMs),
          p50: Math.round(p50PageMs),
          p95: Math.round(p95PageMs),
          p99: Math.round(p99PageMs)
        }
      },

      firestoreWorkload: {
        requestedUsers: this.targetParticipantsCount,
        joinedUsers,
        failedJoins,
        peakActiveListeners: peakListenersTotal,
        initialReadsEstimate,
        totalWrites,
        joinLatencyMs: {
          avg: Math.round(avgJoinMs),
          p50: Math.round(p50JoinMs),
          p95: Math.round(p95JoinMs),
          p99: Math.round(p99JoinMs)
        },
        answerWriteLatencyMs: {
          avg: Math.round(avgAnswerMs),
          min: Math.round(minAnswerMs),
          max: Math.round(maxAnswerMs),
          p50: Math.round(p50AnswerMs),
          p95: Math.round(p95AnswerMs),
          p99: Math.round(p99AnswerMs)
        },
        sessionSyncMs: {
          avg: Math.round(avgSessionSyncMs),
          p95: Math.round(p95SessionSyncMs)
        },
        leaderboardSyncMs: {
          avg: Math.round(avgLbSyncMs),
          p95: Math.round(p95LbSyncMs)
        },
        errors: errorsBreakdown
      },

      quizCompletion: {
        isComplete,
        expectedAnswers,
        actualAnswers: totalSuccessfulAnswers,
        completionPercentage,
        usersCompleted5Of5,
        usersIncomplete
      },

      hostBottleneckInfo: {
        hostMode: this.hostMode,
        driverUsed: this.autoDriveSession,
        notes: this.hostMode === "manual"
          ? "Manual host mode was active. Real production host/admin UI drove session state and computed leaderboard updates via AdminQuizController."
          : "Session driver used automated state transitions. In live production with 1000 participants, AdminQuizController host browser client fetches all responses via getDocs() and updates leaderboard in 400-item batches, which could introduce host-side compute/write latency."
      },

      totalDurationMs: Date.now() - this.startTime
    };
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, Math.min(index, arr.length - 1))];
  }

  private printReport(s: E2ELoadTestSummary): void {
    console.log("\n==================================================");
    console.log("📊 ZERO2ONE E2E LOAD TEST SUMMARY");
    console.log("==================================================");
    console.log(`Target Event ID:      ${s.eventId}`);
    console.log(`Target Event URL:     ${s.targetUrl}`);
    console.log(`Scenario:             ${s.scenarioName}`);
    console.log(`Workers:              ${s.workersCount} (${s.usersPerWorker} participants/worker)`);
    console.log(`Total Duration:       ${(s.totalDurationMs / 1000).toFixed(1)}s`);

    console.log("\n--- VERCEL PAGE DELIVERY ---");
    console.log(`Total Requests:       ${s.pageDelivery.totalRequests}`);
    console.log(`Successful Page Req:  ${s.pageDelivery.successful}`);
    console.log(`Failed Page Req:      ${s.pageDelivery.failed}`);
    console.log(`HTTP 2xx:             ${s.pageDelivery.status2xx}`);
    console.log(`HTTP 4xx:             ${s.pageDelivery.status4xx}`);
    console.log(`HTTP 5xx:             ${s.pageDelivery.status5xx}`);
    console.log(`Timeouts:             ${s.pageDelivery.timeouts}`);
    console.log(`Network Errors:       ${s.pageDelivery.networkErrors}`);
    console.log(`Page Latency Avg:     ${s.pageDelivery.latencyMs.avg} ms`);
    console.log(`Page Latency P50:     ${s.pageDelivery.latencyMs.p50} ms`);
    console.log(`Page Latency P95:     ${s.pageDelivery.latencyMs.p95} ms`);
    console.log(`Page Latency P99:     ${s.pageDelivery.latencyMs.p99} ms`);

    console.log("\n--- FIRESTORE PARTICIPANT WORKLOAD ---");
    console.log(`Requested Users:      ${s.firestoreWorkload.requestedUsers}`);
    console.log(`Joined Users:         ${s.firestoreWorkload.joinedUsers}`);
    console.log(`Failed Joins:         ${s.firestoreWorkload.failedJoins}`);
    console.log(`Peak Active Listeners:${s.firestoreWorkload.peakActiveListeners}`);
    console.log(`Initial Reads Est:    ${s.firestoreWorkload.initialReadsEstimate}`);
    console.log(`Total Firestore Writes:${s.firestoreWorkload.totalWrites}`);
    console.log(`Join Latency P50:     ${s.firestoreWorkload.joinLatencyMs.p50} ms`);
    console.log(`Join Latency P95:     ${s.firestoreWorkload.joinLatencyMs.p95} ms`);
    console.log(`Answer Write P50:     ${s.firestoreWorkload.answerWriteLatencyMs.p50} ms`);
    console.log(`Answer Write P95:     ${s.firestoreWorkload.answerWriteLatencyMs.p95} ms`);
    console.log(`Answer Write P99:     ${s.firestoreWorkload.answerWriteLatencyMs.p99} ms`);
    console.log(`Session Sync P95:     ${s.firestoreWorkload.sessionSyncMs.p95} ms`);
    console.log(`Leaderboard Sync P95: ${s.firestoreWorkload.leaderboardSyncMs.p95} ms`);

    console.log("\n--- QUIZ COMPLETION ---");
    if (s.quizCompletion.isComplete) {
      console.log(`✅ COMPLETION STATUS:   COMPLETE (100% answers received)`);
    } else {
      console.log(`❌ COMPLETION STATUS:   INCOMPLETE (${s.quizCompletion.completionPercentage}% answers received)`);
    }
    console.log(`Expected Answers:     ${s.quizCompletion.expectedAnswers} (${s.firestoreWorkload.joinedUsers} users x 5)`);
    console.log(`Actual Answers:       ${s.quizCompletion.actualAnswers}`);
    console.log(`Completion Rate:      ${s.quizCompletion.completionPercentage}%`);
    console.log(`Users Completed 5/5:  ${s.quizCompletion.usersCompleted5Of5} / ${s.firestoreWorkload.joinedUsers}`);
    console.log(`Users Incomplete:     ${s.quizCompletion.usersIncomplete}`);

    console.log("\n--- ERRORS BREAKDOWN ---");
    console.log(`Permission Denied:    ${s.firestoreWorkload.errors.permission}`);
    console.log(`Timeouts:             ${s.firestoreWorkload.errors.timeout}`);
    console.log(`Network Errors:       ${s.firestoreWorkload.errors.network}`);
    console.log(`Rate Limit / Quota:   ${s.firestoreWorkload.errors.rateLimit}`);
    console.log(`Firestore Errors:     ${s.firestoreWorkload.errors.firestore}`);
    console.log(`Other Errors:         ${s.firestoreWorkload.errors.other}`);

    console.log("\n--- HOST / ADMIN BOTTLENECK ANALYSIS ---");
    console.log(`Session Driver Used:  ${s.hostBottleneckInfo.driverUsed}`);
    console.log(`Host Note:            ${s.hostBottleneckInfo.notes}`);
    console.log("==================================================\n");
  }
}
