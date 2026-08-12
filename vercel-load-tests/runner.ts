import { 
  VercelLoadTestOptions, 
  VercelLoadTestSummary, 
  SingleRequestResult 
} from "./types.js";

async function executeSingleRequest(url: string, timeoutMs: number): Promise<SingleRequestResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Zero2One-Vercel-LoadTest/1.0",
        "Accept": "*/*"
      },
      signal: controller.signal
    });
    
    // Read body to ensure complete response processing
    await res.arrayBuffer();

    const latencyMs = performance.now() - start;
    clearTimeout(timer);

    const status = res.status;
    const is2xx = status >= 200 && status < 300;

    return {
      statusCode: status,
      latencyMs,
      success: is2xx,
      errorType: is2xx ? undefined : "http",
      errorMessage: is2xx ? undefined : `HTTP ${status}`
    };
  } catch (err: any) {
    const latencyMs = performance.now() - start;
    clearTimeout(timer);

    if (err.name === "AbortError") {
      return {
        latencyMs,
        success: false,
        errorType: "timeout",
        errorMessage: "Request Timeout"
      };
    } else {
      return {
        latencyMs,
        success: false,
        errorType: "network",
        errorMessage: err.message || "Network Error"
      };
    }
  }
}

export class VercelLoadTestRunner {
  private options: VercelLoadTestOptions;

  constructor(options: VercelLoadTestOptions) {
    this.options = options;
  }

  public async run(): Promise<VercelLoadTestSummary> {
    const { url, concurrency, totalRequests, durationSeconds, timeoutMs, scenarioName } = this.options;

    console.log("\n==================================================");
    console.log("🚀 VERCEL HTTP LOAD TEST RUNNER STARTED");
    console.log(`Target URL:      ${url}`);
    console.log(`Scenario:        ${scenarioName || "CUSTOM"}`);
    console.log(`Concurrency:     ${concurrency} virtual users`);
    if (totalRequests) console.log(`Total Requests:  ${totalRequests}`);
    if (durationSeconds) console.log(`Max Duration:    ${durationSeconds}s`);
    console.log(`Timeout per Req: ${timeoutMs}ms`);
    console.log("==================================================\n");

    const results: SingleRequestResult[] = [];
    const startTime = performance.now();
    const endTimeLimit = durationSeconds ? startTime + durationSeconds * 1000 : Infinity;

    let requestsIssued = 0;

    // Progress logger
    const progressInterval = setInterval(() => {
      const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(1);
      const completed = results.length;
      const successful = results.filter((r) => r.success).length;
      const failed = completed - successful;
      console.log(`[Progress ${elapsedSec}s] Requests Completed: ${completed} | Success: ${successful} | Failed: ${failed}`);
    }, 3000);

    // Worker queue implementation
    const workerPromises: Promise<void>[] = [];

    for (let w = 0; w < concurrency; w++) {
      workerPromises.push((async () => {
        while (true) {
          const now = performance.now();
          if (now >= endTimeLimit) break;

          if (totalRequests && requestsIssued >= totalRequests) break;
          requestsIssued++;

          const result = await executeSingleRequest(url, timeoutMs);
          results.push(result);
        }
      })());
    }

    await Promise.all(workerPromises);
    clearInterval(progressInterval);

    const totalDurationMs = performance.now() - startTime;
    const summary = this.generateSummary(results, totalDurationMs, requestsIssued);
    this.printReport(summary);

    return summary;
  }

  private generateSummary(
    results: SingleRequestResult[], 
    totalDurationMs: number,
    requestsRequested: number
  ): VercelLoadTestSummary {
    const completed = results.length;
    const successful = results.filter((r) => r.success).length;
    const failed = completed - successful;

    let http2xx = 0;
    let http4xx = 0;
    let http5xx = 0;
    let otherStatus = 0;

    let networkErrors = 0;
    let timeoutErrors = 0;
    let httpErrors = 0;

    results.forEach((r) => {
      if (r.statusCode) {
        if (r.statusCode >= 200 && r.statusCode < 300) http2xx++;
        else if (r.statusCode >= 400 && r.statusCode < 500) http4xx++;
        else if (r.statusCode >= 500 && r.statusCode < 600) http5xx++;
        else otherStatus++;
      }

      if (r.errorType === "network") networkErrors++;
      else if (r.errorType === "timeout") timeoutErrors++;
      else if (r.errorType === "http") httpErrors++;
    });

    const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
    const avg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const min = latencies.length ? latencies[0] : 0;
    const max = latencies.length ? latencies[latencies.length - 1] : 0;
    const p50 = this.percentile(latencies, 50);
    const p95 = this.percentile(latencies, 95);
    const p99 = this.percentile(latencies, 99);

    const durationSec = totalDurationMs / 1000;
    const throughput = durationSec > 0 ? completed / durationSec : 0;

    return {
      targetUrl: this.options.url,
      scenarioName: this.options.scenarioName || "CUSTOM",
      concurrency: this.options.concurrency,
      timeoutMs: this.options.timeoutMs,
      totalRequestsRequested: requestsRequested,
      totalRequestsCompleted: completed,
      successfulRequests: successful,
      failedRequests: failed,
      statusCodes: {
        http2xx,
        http4xx,
        http5xx,
        other: otherStatus
      },
      errors: {
        network: networkErrors,
        timeout: timeoutErrors,
        http: httpErrors
      },
      latencyMs: {
        avg: Math.round(avg),
        min: Math.round(min),
        max: Math.round(max),
        p50: Math.round(p50),
        p95: Math.round(p95),
        p99: Math.round(p99)
      },
      throughputReqPerSec: Number(throughput.toFixed(2)),
      totalDurationMs: Math.round(totalDurationMs)
    };
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, Math.min(index, arr.length - 1))];
  }

  private printReport(s: VercelLoadTestSummary): void {
    console.log("\n==================================================");
    console.log("📊 VERCEL HTTP LOAD TEST RESULTS");
    console.log("==================================================");
    console.log("\n--- VERCEL LOAD TEST ---");
    console.log(`Target URL:     ${s.targetUrl}`);
    console.log(`Scenario:       ${s.scenarioName}`);
    console.log(`Concurrency:    ${s.concurrency} virtual users`);
    console.log(`Timeout Config: ${s.timeoutMs} ms`);
    console.log(`Total Requests: ${s.totalRequestsCompleted}`);
    console.log(`Successful:     ${s.successfulRequests}`);
    console.log(`Failed:         ${s.failedRequests}`);
    console.log(`HTTP 2xx:       ${s.statusCodes.http2xx}`);
    console.log(`HTTP 4xx:       ${s.statusCodes.http4xx}`);
    console.log(`HTTP 5xx:       ${s.statusCodes.http5xx}`);

    console.log("\n--- LATENCY ---");
    console.log(`Average:        ${s.latencyMs.avg} ms`);
    console.log(`Min:            ${s.latencyMs.min} ms`);
    console.log(`Max:            ${s.latencyMs.max} ms`);
    console.log(`P50:            ${s.latencyMs.p50} ms`);
    console.log(`P95:            ${s.latencyMs.p95} ms`);
    console.log(`P99:            ${s.latencyMs.p99} ms`);

    console.log("\n--- THROUGHPUT ---");
    console.log(`Requests/sec:   ${s.throughputReqPerSec}`);
    console.log(`Total Duration: ${(s.totalDurationMs / 1000).toFixed(2)}s`);

    console.log("\n--- ERRORS ---");
    console.log(`Network Errors: ${s.errors.network}`);
    console.log(`Timeouts:       ${s.errors.timeout}`);
    console.log(`HTTP Errors:    ${s.errors.http}`);
    console.log("==================================================\n");
  }
}
