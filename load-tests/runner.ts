import { getLoadTestFirebase } from "./config.js";
import { VirtualUser } from "./virtual-user.js";
import { LoadTestSummary, ScenarioConfig, LatencyMetric } from "./types.js";

export class LoadTestRunner {
  private eventId: string;
  private targetUsersCount: number;
  private rampUpSeconds: number;
  private burstWindowSeconds: number;
  private scenarioName: string;
  private virtualUsers: VirtualUser[] = [];
  private startTime: number = 0;

  constructor(
    eventId: string,
    usersCount: number,
    rampUpSeconds: number = 5,
    burstWindowSeconds: number = 2,
    scenarioName: string = "CUSTOM"
  ) {
    this.eventId = eventId;
    this.targetUsersCount = usersCount;
    this.rampUpSeconds = rampUpSeconds;
    this.burstWindowSeconds = burstWindowSeconds;
    this.scenarioName = scenarioName;
  }

  public async run(durationSeconds: number = 60): Promise<LoadTestSummary> {
    const { db } = getLoadTestFirebase();
    this.startTime = Date.now();

    console.log("\n==================================================");
    console.log("🚀 ZERO2ONE QUIZ LOAD TEST RUNNER STARTED");
    console.log(`Target Event ID: ${this.eventId}`);
    console.log(`Scenario:        ${this.scenarioName}`);
    console.log(`Virtual Users:   ${this.targetUsersCount}`);
    console.log(`Ramp-up Window:  ${this.rampUpSeconds}s`);
    console.log(`Burst Window:   ${this.burstWindowSeconds}s`);
    console.log("==================================================\n");

    const batchSize = Math.max(1, Math.floor(this.targetUsersCount / Math.max(1, this.rampUpSeconds * 2)));
    const stepIntervalMs = Math.floor((this.rampUpSeconds * 1000) / Math.max(1, this.targetUsersCount / batchSize));

    console.log(`⏳ Spawning ${this.targetUsersCount} virtual users...`);

    let spawned = 0;
    while (spawned < this.targetUsersCount) {
      const currentBatch = Math.min(batchSize, this.targetUsersCount - spawned);
      const spawnPromises: Promise<void>[] = [];

      for (let i = 0; i < currentBatch; i++) {
        const userIndex = spawned + i + 1;
        const userId = String(userIndex).padStart(4, "0");
        const vUser = new VirtualUser(db, {
          userId,
          index: userIndex,
          eventId: this.eventId,
          burstWindowMs: this.burstWindowSeconds * 1000
        });

        this.virtualUsers.push(vUser);

        spawnPromises.push(
          vUser.join().then((success) => {
            if (success) {
              vUser.startListeners();
            }
          })
        );
      }

      await Promise.all(spawnPromises);
      spawned += currentBatch;

      if (spawned < this.targetUsersCount && stepIntervalMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, stepIntervalMs));
      }
    }

    console.log(`\n✅ All ${this.virtualUsers.length} Virtual Users spawned & listeners initialized.`);
    console.log(`⏱️ Monitoring session stage and answer submissions for ${durationSeconds} seconds...\n`);

    // Progress updates every 5 seconds
    const interval = setInterval(() => {
      const activeCount = this.virtualUsers.filter((u) => u.stats.joined).length;
      const totalAnswers = this.virtualUsers.reduce((sum, u) => sum + u.stats.answersSuccessful, 0);
      const totalFailed = this.virtualUsers.reduce((sum, u) => sum + u.stats.answersFailed, 0);
      console.log(`[Progress] Active Users: ${activeCount} | Answers Submitted: ${totalAnswers} | Failures: ${totalFailed}`);
    }, 5000);

    await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));
    clearInterval(interval);

    console.log("\n⏹️ Test duration complete. Stopping all virtual user listeners...");
    this.virtualUsers.forEach((u) => u.stop());

    const summary = this.generateSummary();
    this.printReport(summary);

    return summary;
  }

  private generateSummary(): LoadTestSummary {
    const totalUsersJoined = this.virtualUsers.filter((u) => u.stats.joined).length;
    const totalUsersFailedToJoin = this.targetUsersCount - totalUsersJoined;

    let attemptedAnswers = 0;
    let successfulAnswers = 0;
    let failedAnswers = 0;
    const allAnswerLatencies: LatencyMetric[] = [];
    const allSessionSyncs: number[] = [];
    const allLeaderboardSyncs: number[] = [];
    let activeListenersCount = 0;

    const errorsBreakdown = {
      permission: 0,
      timeout: 0,
      network: 0,
      rateLimit: 0,
      firestore: 0,
      other: 0
    };

    this.virtualUsers.forEach((u) => {
      attemptedAnswers += u.stats.answersAttempted;
      successfulAnswers += u.stats.answersSuccessful;
      failedAnswers += u.stats.answersFailed;

      allAnswerLatencies.push(...u.stats.answerLatencies);
      u.stats.sessionSyncs.forEach((s) => allSessionSyncs.push(s.latencyMs));
      u.stats.leaderboardSyncs.forEach((l) => allLeaderboardSyncs.push(l.latencyMs));

      activeListenersCount += u.stats.activeListenersCount;

      u.stats.errors.forEach((e) => {
        const typeKey = e.type as keyof typeof errorsBreakdown;
        if (errorsBreakdown[typeKey] !== undefined) {
          errorsBreakdown[typeKey]++;
        } else {
          errorsBreakdown.other++;
        }
      });
    });

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
    // Writes = 1 join write + successful answers
    const firestoreDocWrites = totalUsersJoined + successfulAnswers;
    // Initial reads per user = 1 participant initial + 1 session initial + 1 leaderboard initial + 1 personal leaderboard initial = 4 reads per user
    const firestoreDocReadsEstimate = totalUsersJoined * 4;

    return {
      eventId: this.eventId,
      scenarioName: this.scenarioName,
      totalUsersRequested: this.targetUsersCount,
      totalUsersJoined,
      totalUsersFailedToJoin,
      answerSubmissions: {
        attempted: attemptedAnswers,
        successful: successfulAnswers,
        failed: failedAnswers
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
        totalActiveListeners: activeListenersCount,
        firestoreDocReadsEstimate,
        firestoreDocWrites,
        batchNetworkRequests: 0 // Individual client writes
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
    console.log(`Duration:             ${(summary.durationMs / 1000).toFixed(1)}s`);
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
    console.log(`Peak Active Listeners:${summary.resourceCounts.totalActiveListeners}`);
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
