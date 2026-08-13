export interface ScenarioConfig {
  name: string;
  concurrency: number;
}

export const E2E_SCENARIOS: Record<string, ScenarioConfig> = {
  A: { name: "Scenario A (10 Participants)", concurrency: 10 },
  B: { name: "Scenario B (50 Participants)", concurrency: 50 },
  C: { name: "Scenario C (100 Participants)", concurrency: 100 },
  D: { name: "Scenario D (250 Participants)", concurrency: 250 },
  E: { name: "Scenario E (500 Participants)", concurrency: 500 },
  F: { name: "Scenario F (1000 Participants)", concurrency: 1000 }
};

export interface PageDeliveryResult {
  statusCode?: number;
  latencyMs: number;
  success: boolean;
  errorType?: "http" | "network" | "timeout";
  errorMessage?: string;
}

export interface LatencyMetric {
  durationMs: number;
  timestamp: number;
}

export interface SyncMetric {
  latencyMs: number;
  timestamp: number;
  type: "session" | "leaderboard";
}

export interface ParticipantError {
  type: "permission" | "timeout" | "network" | "rateLimit" | "firestore" | "other";
  message: string;
  timestamp: number;
}

export interface ParticipantStats {
  userId: string;
  participantId: string;
  pageDelivery: PageDeliveryResult;
  joined: boolean;
  joinLatencyMs: number;
  answersAttempted: number;
  answersSuccessful: number;
  answersFailed: number;
  answerLatencies: LatencyMetric[];
  sessionSyncs: SyncMetric[];
  leaderboardSyncs: SyncMetric[];
  activeListenersCount: number;
  peakListenersCount: number;
  errors: ParticipantError[];
}

export interface WorkerInitPayload {
  workerId: number;
  startUserIndex: number;
  userCount: number;
  eventId: string;
  baseUrl: string;
  burstWindowMs: number;
  rampUpMs: number;
  httpTimeoutMs: number;
}

export type WorkerToParentMessage =
  | { type: "READY"; workerId: number; joinedCount: number; pageSuccessCount: number; pageFailCount: number }
  | { type: "PROGRESS"; workerId: number; joinedCount: number; answersSuccessful: number; answersFailed: number }
  | { type: "STATS"; workerId: number; stats: ParticipantStats[] }
  | { type: "ERROR"; workerId: number; error: string };

export type ParentToWorkerMessage =
  | { type: "START"; payload: WorkerInitPayload }
  | { type: "GET_STATS" }
  | { type: "STOP" };

export interface E2ELoadTestSummary {
  eventId: string;
  targetUrl: string;
  scenarioName: string;
  workersCount: number;
  usersPerWorker: number;

  // Vercel Page Delivery
  pageDelivery: {
    totalRequests: number;
    successful: number;
    failed: number;
    status2xx: number;
    status4xx: number;
    status5xx: number;
    timeouts: number;
    networkErrors: number;
    latencyMs: {
      avg: number;
      min: number;
      max: number;
      p50: number;
      p95: number;
      p99: number;
    };
  };

  // Firestore Participant Workload
  firestoreWorkload: {
    requestedUsers: number;
    joinedUsers: number;
    failedJoins: number;
    peakActiveListeners: number;
    initialReadsEstimate: number;
    totalWrites: number;
    joinLatencyMs: {
      avg: number;
      p50: number;
      p95: number;
      p99: number;
    };
    answerWriteLatencyMs: {
      avg: number;
      min: number;
      max: number;
      p50: number;
      p95: number;
      p99: number;
    };
    sessionSyncMs: {
      avg: number;
      p95: number;
    };
    leaderboardSyncMs: {
      avg: number;
      p95: number;
    };
    errors: {
      permission: number;
      timeout: number;
      network: number;
      rateLimit: number;
      firestore: number;
      other: number;
    };
  };

  // Quiz Completion
  quizCompletion: {
    isComplete: boolean;
    expectedAnswers: number;
    actualAnswers: number;
    completionPercentage: number;
    usersCompleted5Of5: number;
    usersIncomplete: number;
  };

  // Host Bottleneck Analysis
  hostBottleneckInfo: {
    hostMode: "auto" | "manual";
    driverUsed: boolean;
    notes: string;
  };

  totalDurationMs: number;
}
