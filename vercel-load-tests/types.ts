export interface ScenarioConfig {
  name: string;
  concurrency: number;
  defaultRequests: number;
}

export type ScenarioPreset = "A" | "B" | "C" | "D" | "E" | "F";

export const SCENARIOS: Record<string, ScenarioConfig> = {
  A: { name: "Scenario A (10 Users)", concurrency: 10, defaultRequests: 100 },
  B: { name: "Scenario B (50 Users)", concurrency: 50, defaultRequests: 500 },
  C: { name: "Scenario C (100 Users)", concurrency: 100, defaultRequests: 1000 },
  D: { name: "Scenario D (250 Users)", concurrency: 250, defaultRequests: 2500 },
  E: { name: "Scenario E (500 Users)", concurrency: 500, defaultRequests: 5000 },
  F: { name: "Scenario F (1000 Users)", concurrency: 1000, defaultRequests: 10000 }
};

export interface VercelLoadTestOptions {
  url: string;
  concurrency: number;
  totalRequests?: number;
  durationSeconds?: number;
  timeoutMs: number;
  scenarioName?: string;
}

export interface SingleRequestResult {
  statusCode?: number;
  latencyMs: number;
  success: boolean;
  errorType?: "http" | "network" | "timeout";
  errorMessage?: string;
}

export interface VercelLoadTestSummary {
  targetUrl: string;
  scenarioName: string;
  concurrency: number;
  totalRequestsRequested: number;
  totalRequestsCompleted: number;
  successfulRequests: number;
  failedRequests: number;
  statusCodes: {
    http2xx: number;
    http4xx: number;
    http5xx: number;
    other: number;
  };
  errors: {
    network: number;
    timeout: number;
    http: number;
  };
  latencyMs: {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughputReqPerSec: number;
  totalDurationMs: number;
}
