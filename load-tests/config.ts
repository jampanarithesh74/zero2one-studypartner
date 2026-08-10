import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Public Firebase Web SDK configuration matching production
export const firebaseConfig = {
  apiKey: "AIzaSyB9h_P6RMAdfv5OjPGqeRJOBnQfU9-CbPo",
  authDomain: "zero2one-studcomp.firebaseapp.com",
  projectId: "zero2one-studcomp",
  storageBucket: "zero2one-studcomp.firebasestorage.app",
  messagingSenderId: "827345021044",
  appId: "1:827345021044:web:a342847d1d58eee5944921"
};

export function getLoadTestFirebase() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig, "LOADTEST_APP") : getApp("LOADTEST_APP");
  const db = getFirestore(app);
  return { app, db };
}

export interface EnvironmentConfig {
  eventId: string;
  testMode: boolean;
  users: number;
  rampUpSeconds: number;
  burstWindowSeconds: number;
  scenario: string;
}

export function parseAndValidateEnv(): EnvironmentConfig {
  const eventId = process.env.TEST_EVENT_ID || process.env.VITE_TEST_EVENT_ID || "";
  const testMode = process.env.TEST_MODE === "true" || process.env.VITE_TEST_MODE === "true";

  // Parse command line args if provided
  const args = process.argv.slice(2);
  let argEventId = "";
  let argUsers = 0;
  let argRampUp = 0;
  let argBurst = 2;
  let argScenario = "CUSTOM";

  args.forEach((arg) => {
    if (arg.startsWith("--event=")) argEventId = arg.split("=")[1];
    if (arg.startsWith("--users=")) argUsers = parseInt(arg.split("=")[1], 10);
    if (arg.startsWith("--rampup=")) argRampUp = parseInt(arg.split("=")[1], 10);
    if (arg.startsWith("--burst=")) argBurst = parseInt(arg.split("=")[1], 10);
    if (arg.startsWith("--scenario=")) argScenario = arg.split("=")[1].toUpperCase();
  });

  const finalEventId = argEventId || eventId;
  const finalUsers = argUsers || parseInt(process.env.VIRTUAL_USERS || "10", 10);
  const finalRampUp = argRampUp || parseInt(process.env.RAMP_UP_SECONDS || "5", 10);
  const finalBurst = argBurst || parseInt(process.env.BURST_WINDOW_SECONDS || "2", 10);

  if (!testMode && !process.argv.includes("--test-mode=true")) {
    console.error("\n❌ SAFETY ERROR: Load test requires TEST_MODE=true environment variable or --test-mode=true flag.");
    console.error("This prevents accidental load test execution against production without explicit intent.\n");
    process.exit(1);
  }

  if (!finalEventId) {
    console.error("\n❌ CONFIGURATION ERROR: Missing TEST_EVENT_ID.");
    console.error("Please specify a target event ID via environment variable TEST_EVENT_ID or command flag --event=<eventId>\n");
    process.exit(1);
  }

  return {
    eventId: finalEventId,
    testMode: true,
    users: finalUsers,
    rampUpSeconds: finalRampUp,
    burstWindowSeconds: finalBurst,
    scenario: argScenario
  };
}
