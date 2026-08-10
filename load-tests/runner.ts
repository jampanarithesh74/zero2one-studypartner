import path from "path";
import { fileURLToPath } from "url";
import { fork, ChildProcess } from "child_process";
import { getLoadTestFirebase } from "./config.js";
import { QuizSessionDriver } from "./session-driver.js";
import { 
  LoadTestSummary, 
  VirtualUserStats, 
  LatencyMetric, 
  UserCompletionStatus,
  WorkerToParentMessage,
  WorkerInitPayload
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.join(__dirname, "worker.ts");

export class LoadTestRunner {
  private eventId: string;
  private targetUsersCount: number;
  private rampUpSeconds: number;
  private burstWindowSeconds: number;
  private scenarioName: string;
  private autoDriveSession: boolean;
  private usersPerWorker: number;
  private sessionDriver: QuizSessionDriver | null = null;
  private startTime: number = 0;

  constructor(
    eventId: string,
    usersCount: number,
    rampUpSeconds: number = 5,
    burstWindowSeconds: number = 2,
    scenarioName: string = "CUSTOM",
    autoDriveSession: boolean = true,
    usersPerWorker: number = 50
  ) {
    this.eventId = eventId;
    this.targetUsersCount = usersCount;
    this.rampUpSeconds = rampUpSeconds;
    this.burstWindowSeconds = burstWindowSeconds;
    this.scenarioName = scenarioName;
    this.autoDriveSession = autoDriveSession;
    this.usersPerWorker = Math.min(usersPerWorker, Math.max(1, usersCount));
  }

  public async run(explicitDurationSeconds?: number): Promise<LoadTestSummary> {
    const { db } = getLoadTestFirebase();
    this.startTime = Date.now();

    const numWorkers = Math.max(1, Math.ceil(this.targetUsersCount / this.usersPerWorker));

    // Calculate dynamic duration if not explicitly specified
    const questionSec = 12;
    const revealSec = 3;
    const lbSec = 3;
    const quizLifecycleSec = 5 * (questionSec + revealSec + lbSec); // 90 seconds
    const dynamicDurationSeconds = Math.max(
      45,
      this.rampUpSeconds + 15 + quizLifecycleSec
    );

    const durationSeconds = explicitDurationSeconds || dynamicDurationSeconds;

    console.log("\n==================================================");
    console.log("🚀 ZERO2ONE QUIZ LOAD TEST RUNNER STARTED");
    console.log(`Target Event ID: ${this.eventId}`);
    console.log(`Scenario:        ${this.scenarioName}`);
    console.log(`Virtual Users:   ${this.targetUsersCount}`);
    console.log(`Worker Processes:${numWorkers} (${this.usersPerWorker} users/worker max)`);
    console.log(`Ramp-up Window:  ${this.rampUpSeconds}s`);
    console.log(`Burst Window:   ${this.burstWindowSeconds}s`);
    console.log(`Max Test Duration: ${durationSeconds}s`);
    console.log(`Auto-Drive Quiz: ${this.autoDriveSession ? "YES (5 Questions)" : "NO"}`);
    console.log("==================================================\n");

    console.log(`⏳ Forking ${numWorkers} worker processes and spawning ${this.targetUsersCount} virtual users...`);

    const workerProcesses: ChildProcess[] = [];
    const workerProgressMap: Map<number, { joinedCount: number; answersSuccessful: number; answersFailed: number }> = new Map();
    const workerStatsPromises: Promise<VirtualUserStats[]>[] = [];

    let spawnedUsers = 0;

    for (let w = 0; w < numWorkers; w++) {
      const workerId = w + 1;
      const workerUserCount = Math.min(this.usersPerWorker, this.targetUsersCount - spawnedUsers);
      const startUserIndex = spawnedUsers + 1;
      spawnedUsers += workerUserCount;

      const workerRampUpMs = Math.floor((this.rampUpSeconds * 1000 * workerUserCount) / this.targetUsersCount);

      const execArgv = process.execArgv.length > 0 ? process.execArgv : ["--import", "tsx"];
      const child = fork(workerPath, [], { execArgv });
      workerProcesses.push(child);

      workerProgressMap.set(workerId, { joinedCount: 0, answersSuccessful: 0, answersFailed: 0 });

      const statsPromise = new Promise<VirtualUserStats[]>((resolve) => {
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
        burstWindowMs: this.burstWindowSeconds * 1000,
        rampUpMs: workerRampUpMs
      };

      child.send({ type: "START", payload });
    }

    console.log(`\n✅ ${numWorkers} Worker processes launched. Monitoring user setup and quiz progress...`);

    // Launch SessionDriver
    let sessionDriverPromise: Promise<void> | null = null;
    if (this.autoDriveSession) {
      // Start session driver after initial ramp-up buffer
      this.sessionDriver = new QuizSessionDriver(db, this.eventId, {
        questionDurationSec: questionSec,
        revealDurationSec: revealSec,
        leaderboardDurationSec: lbSec
      });

      // Brief delay before starting Question 1 to allow virtual users to finish joining
      const startDelayMs = Math.min(5000, this.rampUpSeconds * 1000);
      sessionDriverPromise = (async () => {
        await new Promise((r) => setTimeout(r, startDelayMs));
        await this.sessionDriver!.driveSession();
      })();
    }

    // Monitor progress loop
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
      console.log(`[Progress] Joined Users: ${totalJoined}/${this.targetUsersCount} | Answers Submitted: ${totalSuccessful}/${expectedTotal} | Failures: ${totalFailed}`);

      // Check if all joined users have answered all 5 questions
      if (totalJoined > 0 && totalSuccessful >= expectedTotal) {
        console.log(`\n🎉 All ${expectedTotal} expected answers received across all workers! Completing test early.`);
        isFinishedEarly = true;
      }
    }, 3000);

    // Wait until duration completes, early finish occurs, or session driver finishes
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));

    while (!isFinishedEarly && (Date.now() - monitorStartTime) < durationSeconds * 1000) {
      await Promise.race([
        timeoutPromise,
        new Promise((r) => setTimeout(r, 1000))
      ]);
      if (isFinishedEarly) break;
    }

    clearInterval(interval);

    console.log("\n⏹️ Test monitoring period complete. Requesting final statistics from workers...");

    // Request final stats from all workers
    workerProcesses.forEach((child) => {
      if (child.connected) {
        child.send({ type: "GET_STATS" });
      }
    });

    const allWorkerStatsResults = await Promise.all(workerStatsPromises);
    const combinedVirtualUserStats: VirtualUserStats[] = allWorkerStatsResults.flat();

    if (this.sessionDriver) {
      this.sessionDriver.stop();
    }

    const summary = this.generateSummary(combinedVirtualUserStats, numWorkers);
    this.printReport(summary);

    return summary;
  }

  private generateSummary(userStats: VirtualUserStats[], workersCount: number): LoadTestSummary {
    const totalUsersJoined = userStats.filter((u) => u.joined).length;
    const totalUsersFailedToJoin = this.targetUsersCount - totalUsersJoined;

    let attemptedAnswers = 0;
    let successfulAnswers = 0;
    let failedAnswers = 0;
    const allAnswerLatencies: LatencyMetric[] = [];
    const allSessionSyncs: number[] = [];
    const allLeaderboardSyncs: number[] = [];
    let currentActiveListeners = 0;
    let peakActiveListeners = 0;

    const errorsBreakdown = {
      permission: 0,
      timeout: 0,
      network: 0,
      rateLimit: 0,
      firestore: 0,
      other: 0
    };

    const userBreakdown: UserCompletionStatus[] = [];

    userStats.forEach((u) => {
      attemptedAnswers += u.answersAttempted;
      successfulAnswers += u.answersSuccessful;
      failedAnswers += u.answersFailed;

      allAnswerLatencies.push(...u.answerLatencies);
      u.sessionSyncs.forEach((s) => allSessionSyncs.push(s.latencyMs));
      u.leaderboardSyncs.forEach((l) => allLeaderboardSyncs.push(l.latencyMs));

      currentActiveListeners += u.activeListenersCount;
      peakActiveListeners += (u.peakListenersCount || u.activeListenersCount);

      userBreakdown.push({
        userId: u.userId,
        participantId: `LOADTEST-${u.userId}`,
        answersSubmitted: u.answersSuccessful,
        success: u.answersSuccessful === 5
      });

      u.errors.forEach((e) => {
        const typeKey = e.type as keyof typeof errorsBreakdown;
        if (errorsBreakdown[typeKey] !== undefined) {
          errorsBreakdown[typeKey]++;
        } else {
          errorsBreakdown.other++;
        }
      });
    });

    const expectedAnswersPerUser = 5;
    const expectedAnswers = totalUsersJoined * expectedAnswersPerUser;
    const usersFullyCompleted = userBreakdown.filter((u) => u.answersSubmitted === 5).length;
    const isComplete = (successfulAnswers >= expectedAnswers && usersFullyCompleted === totalUsersJoined && totalUsersJoined === this.targetUsersCount);

    const answerDurations = allAnswerLatencies.map((m) => m.durationMs).sort((a, b) => a - b);
    const avgAnswerMs = answerDurations.length ? answerDurations.reduce((a, b) => a + b, 0) / answerDurations.length : 0;
    const minAnswerMs = answerDurations.length ? answerDurations[0] : 0;
    const maxAnswerMs = answerDurations.length ? answerDurations[answerDurations.length - 1] : 0;
    const p50AnswerMs = this.percentile(answerDurations, 50);
    const p95AnswerMs = this.percentile(answerDurations, 95);
    const p99AnswerMs = this.percentile(answerDurations, 99);

    const sortedSessionSyncs = allSessionSyncs.sort((a, b) => a - b);
    const avgSessionSyncMs = sortedSessionSyncs.length ? sortedSessionSyncs.reduce((a, b) => a + b, 0) / sortedSessionSyncs.length : 0;
    const p95SessionSyncMs = this.percentile(sortedSessionSyncs, 95);

    const sortedLbSyncs = allLeaderboardSyncs.sort((a, b) => a - b);
    const avgLbSyncMs = sortedLbSyncs.length ? sortedLbSyncs.reduce((a, b) => a + b, 0) / sortedLbSyncs.length : 0;
    const p95LbSyncMs = this.percentile(sortedLbSyncs, 95);

    // Calculate exact Firestore operation workload
    const firestoreDocWrites = totalUsersJoined + successfulAnswers;
    const firestoreDocReadsEstimate = totalUsersJoined * 3; // 3 initial snapshot reads per participant

    return {
      eventId: this.eventId,
      scenarioName: this.scenarioName,
      workersCount,
      usersPerWorker: this.usersPerWorker,
      totalUsersRequested: this.targetUsersCount,
      totalUsersJoined,
      totalUsersFailedToJoin,
      answerSubmissions: {
        attempted: attemptedAnswers,
        successful: successfulAnswers,
        failed: failedAnswers
      },
      completion: {
        isComplete,
        expectedAnswers,
        actualAnswers: successfulAnswers,
        expectedAnswersPerUser,
        usersFullyCompleted,
        userBreakdown
      },
      latencyStats: {
        answerWrite: {
          avgMs: Math.round(avgAnswerMs),
          minMs: Math.round(minAnswerMs),
          maxMs: Math.round(maxAnswerMs),
          p50Ms: Math.round(p50AnswerMs),
          p95Ms: Math.round(p95AnswerMs),
          p99Ms: Math.round(p99AnswerMs)
        },
        sessionSync: {
          avgMs: Math.round(avgSessionSyncMs),
          p95Ms: Math.round(p95SessionSyncMs)
        },
        leaderboardSync: {
          avgMs: Math.round(avgLbSyncMs),
          p95Ms: Math.round(p95LbSyncMs)
        }
      },
      resourceCounts: {
        totalActiveListeners: currentActiveListeners,
        peakActiveListeners,
        firestoreDocReadsEstimate,
        firestoreDocWrites,
        batchNetworkRequests: 0
      },
      errorsBreakdown,
      durationMs: Date.now() - this.startTime
    };
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, Math.min(index, arr.length - 1))];
  }

  private printReport(summary: LoadTestSummary): void {
    console.log("\n==================================================");
    console.log("📊 ZERO2ONE QUIZ LOAD TEST RESULTS SUMMARY");
    console.log("==================================================");
    console.log(`Target Event ID:      ${summary.eventId}`);
    console.log(`Scenario:             ${summary.scenarioName}`);
    console.log(`Worker Processes:     ${summary.workersCount} (${summary.usersPerWorker} users/worker max)`);
    console.log(`Duration:             ${(summary.durationMs / 1000).toFixed(1)}s`);

    console.log("\n--- COMPLETION VALIDATION ---");
    if (summary.completion.isComplete) {
      console.log(`✅ TEST STATUS:          COMPLETE (All 5 questions answered by all users)`);
    } else {
      console.log(`❌ TEST STATUS:          INCOMPLETE (Expected ${summary.completion.expectedAnswers} answers, got ${summary.completion.actualAnswers})`);
    }
    console.log(`Expected Total Answers: ${summary.completion.expectedAnswers} (${summary.totalUsersJoined} users × 5 questions)`);
    console.log(`Actual Total Answers:   ${summary.completion.actualAnswers}`);
    console.log(`Users Completed (5/5):  ${summary.completion.usersFullyCompleted} / ${summary.totalUsersJoined}`);

    console.log("\n--- VIRTUAL USERS ---");
    console.log(`Requested:            ${summary.totalUsersRequested}`);
    console.log(`Successfully Joined:  ${summary.totalUsersJoined}`);
    console.log(`Failed to Join:       ${summary.totalUsersFailedToJoin}`);

    console.log("\n--- ANSWER SUBMISSIONS ---");
    console.log(`Attempted:            ${summary.answerSubmissions.attempted}`);
    console.log(`Successful:           ${summary.answerSubmissions.successful}`);
    console.log(`Failed:               ${summary.answerSubmissions.failed}`);

    console.log("\n--- ANSWER WRITE LATENCY (MS) ---");
    console.log(`Average:              ${summary.latencyStats.answerWrite.avgMs} ms`);
    console.log(`Min:                  ${summary.latencyStats.answerWrite.minMs} ms`);
    console.log(`Max:                  ${summary.latencyStats.answerWrite.maxMs} ms`);
    console.log(`P50 (Median):         ${summary.latencyStats.answerWrite.p50Ms} ms`);
    console.log(`P95:                  ${summary.latencyStats.answerWrite.p95Ms} ms`);
    console.log(`P99:                  ${summary.latencyStats.answerWrite.p99Ms} ms`);

    console.log("\n--- QUIZ & LEADERBOARD SYNC (MS) ---");
    console.log(`Session Sync P95:     ${summary.latencyStats.sessionSync.p95Ms} ms`);
    console.log(`Leaderboard Sync P95: ${summary.latencyStats.leaderboardSync.p95Ms} ms`);

    console.log("\n--- FIRESTORE WORKLOAD & RESOURCES ---");
    console.log(`Peak Active Listeners:${summary.resourceCounts.peakActiveListeners}`);
    console.log(`Doc Reads (Initial):  ${summary.resourceCounts.firestoreDocReadsEstimate}`);
    console.log(`Doc Writes (Total):   ${summary.resourceCounts.firestoreDocWrites}`);

    console.log("\n--- ERRORS BREAKDOWN ---");
    console.log(`Permission Denied:    ${summary.errorsBreakdown.permission}`);
    console.log(`Timeouts:             ${summary.errorsBreakdown.timeout}`);
    console.log(`Network Issues:       ${summary.errorsBreakdown.network}`);
    console.log(`Rate-limit / Quota:   ${summary.errorsBreakdown.rateLimit}`);
    console.log(`Firestore Errors:     ${summary.errorsBreakdown.firestore}`);
    console.log(`Other Errors:         ${summary.errorsBreakdown.other}`);
    console.log("==================================================\n");
  }
}
