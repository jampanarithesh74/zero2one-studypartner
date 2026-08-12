import { VercelLoadTestRunner } from "./runner.js";
import { SCENARIOS } from "./types.js";

async function main() {
  let targetUrl = "https://zero2one-studypartner.vercel.app/api/health";
  let scenarioKey: string | undefined = undefined;
  let customUsers: number | undefined = undefined;
  let customRequests: number | undefined = undefined;
  let customDuration: number | undefined = undefined;
  let timeoutMs = 10000;

  process.argv.forEach((arg) => {
    if (arg.startsWith("--url=")) {
      targetUrl = arg.split("=")[1];
    } else if (arg.startsWith("--scenario=")) {
      scenarioKey = arg.split("=")[1].toUpperCase();
    } else if (arg.startsWith("--users=")) {
      customUsers = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--requests=")) {
      customRequests = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--duration=")) {
      customDuration = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--timeout=")) {
      timeoutMs = parseInt(arg.split("=")[1], 10);
    }
  });

  const preset = scenarioKey && SCENARIOS[scenarioKey] ? SCENARIOS[scenarioKey] : undefined;

  const concurrency = customUsers || (preset ? preset.concurrency : 10);
  const scenarioName = preset 
    ? preset.name 
    : (customUsers ? `CUSTOM (${customUsers} Users)` : "Scenario A (10 Users)");

  let totalRequests: number | undefined = customRequests;
  if (!totalRequests && !customDuration) {
    totalRequests = preset ? preset.defaultRequests : 100;
  }

  const runner = new VercelLoadTestRunner({
    url: targetUrl,
    concurrency,
    totalRequests,
    durationSeconds: customDuration,
    timeoutMs,
    scenarioName
  });

  await runner.run();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal Error running Vercel Load Test:", err);
  process.exit(1);
});
