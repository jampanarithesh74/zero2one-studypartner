import { parseAndValidateEnv } from "./config.js";
import { LoadTestRunner } from "./runner.js";
import { ScenarioConfig } from "./types.js";

const PRESET_SCENARIOS: Record<string, ScenarioConfig> = {
  A: { name: "SCENARIO A (10 Users)", users: 10, rampUpSeconds: 2, burstWindowSeconds: 2 },
  B: { name: "SCENARIO B (50 Users)", users: 50, rampUpSeconds: 5, burstWindowSeconds: 2 },
  C: { name: "SCENARIO C (100 Users)", users: 100, rampUpSeconds: 8, burstWindowSeconds: 3 },
  D: { name: "SCENARIO D (250 Users)", users: 250, rampUpSeconds: 12, burstWindowSeconds: 3 },
  E: { name: "SCENARIO E (500 Users)", users: 500, rampUpSeconds: 15, burstWindowSeconds: 4 },
  F: { name: "SCENARIO F (1000 Users)", users: 1000, rampUpSeconds: 20, burstWindowSeconds: 5 }
};

async function main() {
  const env = parseAndValidateEnv();

  // Determine scenario configuration
  let users = env.users;
  let rampUp = env.rampUpSeconds;
  let burst = env.burstWindowSeconds;
  let scenarioName = env.scenario;

  if (PRESET_SCENARIOS[env.scenario]) {
    const preset = PRESET_SCENARIOS[env.scenario];
    users = preset.users;
    rampUp = preset.rampUpSeconds;
    burst = preset.burstWindowSeconds;
    scenarioName = preset.name;
  } else {
    scenarioName = `CUSTOM (${users} Users)`;
  }

  // Duration flag and Session Driver support
  let durationSeconds = 45;
  let driveSession = true;

  process.argv.forEach((arg) => {
    if (arg.startsWith("--duration=")) {
      durationSeconds = parseInt(arg.split("=")[1], 10);
    }
    if (arg.startsWith("--drive-session=")) {
      driveSession = arg.split("=")[1] === "true";
    }
  });

  const runner = new LoadTestRunner(
    env.eventId,
    users,
    rampUp,
    burst,
    scenarioName,
    driveSession
  );

  await runner.run(durationSeconds);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Load test execution error:", err);
  process.exit(1);
});
