export interface VirtualUserOptions {
  userId: string;
  index: number;
  eventId: string;
  burstWindowMs?: number; // Random delay range before submitting answer to simulate user burst
}

export interface LatencyMetric {
  durationMs: number;
  timestamp: number;
  success: boolean;
  error?: string;
  errorType?: 'permission' | 'timeout' | 'network' | 'rate_limit' | 'firestore' | 'other';
}

export interface SyncMetric {
  latencyMs: number;
  timestamp: number;
  type: 'session' | 'leaderboard';
}

export interface VirtualUserStats {
  userId: string;
  joined: boolean;
  joinDurationMs: number;
  answersAttempted: number;
  answersSuccessful: number;
  answersFailed: number;
  answerLatencies: LatencyMetric[];
  sessionSyncs: SyncMetric[];
  leaderboardSyncs: SyncMetric[];
  activeListenersCount: number;
  peakListenersCount: number;
  errors: Array<{ message: string; type: string; timestamp: number }>;
}

export interface ScenarioConfig {
  name: string;
  users: number;
  rampUpSeconds: number;
  burstWindowSeconds: number;
}

export interface UserCompletionStatus {
  userId: string;
  participantId: string;
  answersSubmitted: number;
  success: boolean;
}

export interface WorkerInitPayload {
  workerId: number;
  startUserIndex: number;
  userCount: number;
  eventId: string;
  burstWindowMs: number;
  rampUpMs: number;
}

export type WorkerToParentMessage =
  | { type: "READY"; workerId: number; joinedCount: number }
  | { type: "PROGRESS"; workerId: number; joinedCount: number; answersSuccessful: number; answersFailed: number }
  | { type: "STATS"; workerId: number; stats: VirtualUserStats[] }
  | { type: "ERROR"; workerId: number; error: string };

export type ParentToWorkerMessage =
  | { type: "START"; payload: WorkerInitPayload }
  | { type: "GET_STATS" }
  | { type: "STOP" };

export interface LoadTestSummary {
  eventId: string;
  scenarioName: string;
  workersCount: number;
  usersPerWorker: number;
  totalUsersRequested: number;
  totalUsersJoined: number;
  totalUsersFailedToJoin: number;
  
  answerSubmissions: {
    attempted: number;
    successful: number;
    failed: number;
  };

  completion: {
    isComplete: boolean;
    expectedAnswers: number;
    actualAnswers: number;
    expectedAnswersPerUser: number;
    usersFullyCompleted: number;
    userBreakdown: UserCompletionStatus[];
  };

  latencyStats: {
    answerWrite: {
      avgMs: number;
      minMs: number;
      maxMs: number;
      p50Ms: number;
      p95Ms: number;
      p99Ms: number;
    };
    sessionSync: {
      avgMs: number;
      p95Ms: number;
    };
    leaderboardSync: {
      avgMs: number;
      p95Ms: number;
    };
  };

  resourceCounts: {
    totalActiveListeners: number;
    peakActiveListeners: number;
    firestoreDocReadsEstimate: number;
    firestoreDocWrites: number;
    batchNetworkRequests: number;
  };

  errorsBreakdown: {
    permission: number;
    timeout: number;
    network: number;
    rateLimit: number;
    firestore: number;
    other: number;
  };

  durationMs: number;
}
