import { E2ELoadTestRunner } from "./runner.js";
import { E2E_SCENARIOS } from "./types.js";

function sanitizeUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  const mdMatch = url.match(/\[.*?\]\((https?:\/\/[^\)]+)\)/);
  if (mdMatch) {
    url = mdMatch[1];
  }
  url = url.replace(/^["'<\[]+|["'>\]]+$/g, "");
  return url;
}

async function main() {
  let eventId = process.env.TEST_EVENT_ID || "ZrudP4a0F9b0u8XJXrry";
  let baseUrl = "https://zero2one-studypartner.vercel.app";
  let scenarioKey: string | undefined = undefined;
  let customUsers: number | undefined = undefined;
  let customRampUp = 5;
  let customBurst = 2;
  let httpTimeoutMs = 30000;
  let explicitDurationSeconds: number | undefined = undefined;
  let questionDurationSec = 15;
  let hostMode: "auto" | "manual" = "auto";
  let driveSession = true;
  let testMode = process.env.TEST_MODE === "true";

  process.argv.forEach((arg) => {
    if (arg.startsWith("--event=")) {
      eventId = arg.split("=")[1];
    } else if (arg.startsWith("--url=")) {
      baseUrl = arg.split("=")[1];
    } else if (arg.startsWith("--scenario=")) {
      scenarioKey = arg.split("=")[1].toUpperCase();
    } else if (arg.startsWith("--users=")) {
      customUsers = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--rampup=")) {
      customRampUp = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--burst=")) {
      customBurst = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--timeout=")) {
      httpTimeoutMs = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--duration=")) {
      explicitDurationSeconds = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--question-duration=")) {
      questionDurationSec = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--host-mode=")) {
      const mode = arg.split("=")[1].toLowerCase();
      if (mode === "manual" || mode === "auto") {
        hostMode = mode;
        driveSession = mode === "auto";
      }
    } else if (arg.startsWith("--drive-session=")) {
      driveSession = arg.split("=")[1] === "true";
      if (!driveSession) hostMode = "manual";
    } else if (arg.startsWith("--test-mode=")) {
      testMode = arg.split("=")[1] === "true";
    }
  });

  if (!testMode) {
    console.error("\n❌ SAFETY ERROR: End-to-End load test requires TEST_MODE=true environment variable or --test-mode=true flag.");
    console.error("This safety gate prevents unintended execution against production databases.\n");
    process.exit(1);
  }

  baseUrl = sanitizeUrl(baseUrl);

  const preset = scenarioKey && E2E_SCENARIOS[scenarioKey] ? E2E_SCENARIOS[scenarioKey] : undefined;
  const usersCount = customUsers || (preset ? preset.concurrency : 10);
  const scenarioName = preset 
    ? preset.name 
    : (customUsers ? `CUSTOM (${customUsers} Participants)` : "Scenario A (10 Participants)");

  const runner = new E2ELoadTestRunner({
    eventId,
    baseUrl,
    usersCount,
    rampUpSeconds: customRampUp,
    burstWindowSeconds: customBurst,
    scenarioName,
    httpTimeoutMs,
    hostMode,
    autoDriveSession: driveSession,
    questionDurationSec
  });

  await runner.run(explicitDurationSeconds);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal Error running E2E Load Test:", err);
  process.exit(1);
});
