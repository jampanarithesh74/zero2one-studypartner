import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { firebaseConfig as defaultFirebaseConfig, db as defaultDb, auth as defaultAuth, storage as defaultStorage } from "./firebase";

export type ActivityType = "quiz" | "notes" | "events" | "liveRoom" | "crossword" | "riddles";

export interface FirebaseProjectStatus {
  isConfigured: boolean;
  projectId?: string;
  expectedProjectId: string;
  authDomain?: string;
  appName: string;
  isProjectIdValid: boolean;
}

// -------------------------------------------------------------
// 1. PROJECT 1 (Default / Existing): Quiz, Notes, Events, Main Stage
// Expected Project ID: zero2one-studcomp
// -------------------------------------------------------------
export const existingApp: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(defaultFirebaseConfig);
export const existingFirestore: Firestore = defaultDb;
export const existingAuth: Auth = defaultAuth;
export const existingStorage: FirebaseStorage = defaultStorage;

// -------------------------------------------------------------
// 2. PROJECT 2 (Crossword): Crossword 1 & 2, Submissions, Leaderboard
// Expected Project ID: zero2one-crossword
// -------------------------------------------------------------
const crosswordConfig = {
  apiKey: import.meta.env.VITE_CROSSWORD_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_CROSSWORD_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_CROSSWORD_FIREBASE_PROJECT_ID || import.meta.env.VITE_CROSSWORD_PROJECT_ID,
  storageBucket: import.meta.env.VITE_CROSSWORD_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_CROSSWORD_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_CROSSWORD_FIREBASE_APP_ID,
};

export const isCrosswordConfigured = Boolean(
  crosswordConfig.apiKey &&
  crosswordConfig.projectId &&
  crosswordConfig.appId
);

let _crosswordApp: FirebaseApp | null = null;
let _crosswordFirestore: Firestore | null = null;

if (isCrosswordConfigured) {
  try {
    const existing = getApps().find((app) => app.name === "crossword");
    _crosswordApp = existing || initializeApp(crosswordConfig as any, "crossword");
    _crosswordFirestore = getFirestore(_crosswordApp);
  } catch (err) {
    console.error("[Firebase Multi-Project] Failed to initialize Crossword Firebase App:", err);
  }
}

export function getCrosswordFirestore(): Firestore {
  if (!_crosswordFirestore) {
    if (isCrosswordConfigured) {
      try {
        const existing = getApps().find((app) => app.name === "crossword");
        _crosswordApp = existing || initializeApp(crosswordConfig as any, "crossword");
        _crosswordFirestore = getFirestore(_crosswordApp);
      } catch (err) {
        console.error("[Firebase Multi-Project] Failed to initialize Crossword Firebase App:", err);
      }
    }
  }

  if (!_crosswordFirestore) {
    throw new Error(
      "[Firebase Multi-Project Error] Crossword Firebase project (zero2one-crossword) is not configured. " +
      "Required environment variables: VITE_CROSSWORD_FIREBASE_API_KEY, VITE_CROSSWORD_FIREBASE_PROJECT_ID (or VITE_CROSSWORD_PROJECT_ID), VITE_CROSSWORD_FIREBASE_APP_ID. " +
      "Quota isolation strictly prohibits falling back to Project 1 (zero2one-studcomp)."
    );
  }
  return _crosswordFirestore;
}

// -------------------------------------------------------------
// 3. PROJECT 3 (Riddles): Riddles 1-5, Submissions, Scoring, Leaderboard
// Expected Project ID: zero2one-riddles
// -------------------------------------------------------------
const riddleConfig = {
  apiKey: import.meta.env.VITE_RIDDLE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_RIDDLE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_RIDDLE_FIREBASE_PROJECT_ID || import.meta.env.VITE_RIDDLE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_RIDDLE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_RIDDLE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_RIDDLE_FIREBASE_APP_ID,
};

export const isRiddleConfigured = Boolean(
  riddleConfig.apiKey &&
  riddleConfig.projectId &&
  riddleConfig.appId
);

let _riddleApp: FirebaseApp | null = null;
let _riddleFirestore: Firestore | null = null;

if (isRiddleConfigured) {
  try {
    const existing = getApps().find((app) => app.name === "riddles");
    _riddleApp = existing || initializeApp(riddleConfig as any, "riddles");
    _riddleFirestore = getFirestore(_riddleApp);
  } catch (err) {
    console.error("[Firebase Multi-Project] Failed to initialize Riddle Firebase App:", err);
  }
}

export function getRiddleFirestore(): Firestore {
  if (!_riddleFirestore) {
    if (isRiddleConfigured) {
      try {
        const existing = getApps().find((app) => app.name === "riddles");
        _riddleApp = existing || initializeApp(riddleConfig as any, "riddles");
        _riddleFirestore = getFirestore(_riddleApp);
      } catch (err) {
        console.error("[Firebase Multi-Project] Failed to initialize Riddle Firebase App:", err);
      }
    }
  }

  if (!_riddleFirestore) {
    throw new Error(
      "[Firebase Multi-Project Error] Riddle Firebase project (zero2one-riddles) is not configured. " +
      "Required environment variables: VITE_RIDDLE_FIREBASE_API_KEY, VITE_RIDDLE_FIREBASE_PROJECT_ID (or VITE_RIDDLE_PROJECT_ID), VITE_RIDDLE_FIREBASE_APP_ID. " +
      "Quota isolation strictly prohibits falling back to Project 1 (zero2one-studcomp)."
    );
  }
  return _riddleFirestore;
}

// -------------------------------------------------------------
// 4. Central Activity Firestore Router
// -------------------------------------------------------------
export function getFirestoreForActivity(activity: ActivityType): Firestore {
  switch (activity) {
    case "quiz":
    case "notes":
    case "events":
    case "liveRoom":
      return existingFirestore;
    case "crossword":
      return getCrosswordFirestore();
    case "riddles":
      return getRiddleFirestore();
    default:
      return existingFirestore;
  }
}

// -------------------------------------------------------------
// 5. Project Status and Project ID Verification
// -------------------------------------------------------------
export function getFirebaseProjectsStatus(): Record<"project1" | "project2" | "project3", FirebaseProjectStatus> {
  const p1Id = defaultFirebaseConfig.projectId || "";
  const p2Id = crosswordConfig.projectId || "";
  const p3Id = riddleConfig.projectId || "";

  return {
    project1: {
      isConfigured: true,
      projectId: p1Id,
      expectedProjectId: "zero2one-studcomp",
      isProjectIdValid: p1Id === "zero2one-studcomp",
      authDomain: defaultFirebaseConfig.authDomain,
      appName: "[DEFAULT] (Quiz, Notes, Events)",
    },
    project2: {
      isConfigured: isCrosswordConfigured,
      projectId: p2Id || undefined,
      expectedProjectId: "zero2one-crossword",
      isProjectIdValid: p2Id === "zero2one-crossword",
      authDomain: crosswordConfig.authDomain || undefined,
      appName: "crossword (Crossword 1 & 2)",
    },
    project3: {
      isConfigured: isRiddleConfigured,
      projectId: p3Id || undefined,
      expectedProjectId: "zero2one-riddles",
      isProjectIdValid: p3Id === "zero2one-riddles",
      authDomain: riddleConfig.authDomain || undefined,
      appName: "riddles (Riddles 1-5)",
    },
  };
}

// -------------------------------------------------------------
// 6. Lightweight Multi-Project Diagnostic Verification
// Exactly 1 probe document written and read per configured project
// -------------------------------------------------------------
export interface DiagnosticResult {
  project: string;
  expectedProjectId: string;
  actualProjectId?: string;
  status: "success" | "missing_config" | "error";
  message: string;
  latencyMs?: number;
}

export async function runMultiProjectDiagnostic(eventId: string = "diag_test"): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  const status = getFirebaseProjectsStatus();

  // Test Project 1 (Default / Quiz)
  try {
    const t0 = performance.now();
    const p1Doc = doc(existingFirestore, "events", eventId, "diagnostics", "probe_p1");
    await setDoc(p1Doc, { timestamp: Date.now(), project: "zero2one-studcomp" });
    const snap = await getDoc(p1Doc);
    const latency = Math.round(performance.now() - t0);
    await deleteDoc(p1Doc).catch(() => {});

    results.push({
      project: "Project 1 (Quiz / Main)",
      expectedProjectId: "zero2one-studcomp",
      actualProjectId: status.project1.projectId,
      status: snap.exists() ? "success" : "error",
      message: snap.exists() ? "Read & write verified on zero2one-studcomp" : "Document not found after write",
      latencyMs: latency,
    });
  } catch (err: any) {
    results.push({
      project: "Project 1 (Quiz / Main)",
      expectedProjectId: "zero2one-studcomp",
      actualProjectId: status.project1.projectId,
      status: "error",
      message: err.message || "Failed to reach Project 1",
    });
  }

  // Test Project 2 (Crossword)
  if (!isCrosswordConfigured) {
    results.push({
      project: "Project 2 (Crossword)",
      expectedProjectId: "zero2one-crossword",
      actualProjectId: status.project2.projectId,
      status: "missing_config",
      message: "VITE_CROSSWORD_FIREBASE_* environment variables are missing.",
    });
  } else {
    try {
      const t0 = performance.now();
      const db2 = getCrosswordFirestore();
      const p2Doc = doc(db2, "events", eventId, "activities", "crossword", "session", "diagnostic_probe");
      await setDoc(p2Doc, { timestamp: Date.now(), project: "zero2one-crossword" });
      const snap = await getDoc(p2Doc);
      const latency = Math.round(performance.now() - t0);
      await deleteDoc(p2Doc).catch(() => {});

      results.push({
        project: "Project 2 (Crossword)",
        expectedProjectId: "zero2one-crossword",
        actualProjectId: status.project2.projectId,
        status: snap.exists() ? "success" : "error",
        message: snap.exists() ? "Read & write verified on zero2one-crossword" : "Document not found after write",
        latencyMs: latency,
      });
    } catch (err: any) {
      results.push({
        project: "Project 2 (Crossword)",
        expectedProjectId: "zero2one-crossword",
        actualProjectId: status.project2.projectId,
        status: "error",
        message: err.message || "Failed to reach Project 2",
      });
    }
  }

  // Test Project 3 (Riddles)
  if (!isRiddleConfigured) {
    results.push({
      project: "Project 3 (Riddles)",
      expectedProjectId: "zero2one-riddles",
      actualProjectId: status.project3.projectId,
      status: "missing_config",
      message: "VITE_RIDDLE_FIREBASE_* environment variables are missing.",
    });
  } else {
    try {
      const t0 = performance.now();
      const db3 = getRiddleFirestore();
      const p3Doc = doc(db3, "events", eventId, "activities", "riddles", "session", "diagnostic_probe");
      await setDoc(p3Doc, { timestamp: Date.now(), project: "zero2one-riddles" });
      const snap = await getDoc(p3Doc);
      const latency = Math.round(performance.now() - t0);
      await deleteDoc(p3Doc).catch(() => {});

      results.push({
        project: "Project 3 (Riddles)",
        expectedProjectId: "zero2one-riddles",
        actualProjectId: status.project3.projectId,
        status: snap.exists() ? "success" : "error",
        message: snap.exists() ? "Read & write verified on zero2one-riddles" : "Document not found after write",
        latencyMs: latency,
      });
    } catch (err: any) {
      results.push({
        project: "Project 3 (Riddles)",
        expectedProjectId: "zero2one-riddles",
        actualProjectId: status.project3.projectId,
        status: "error",
        message: err.message || "Failed to reach Project 3",
      });
    }
  }

  return results;
}

