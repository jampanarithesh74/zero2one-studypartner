import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { firebaseConfig as defaultFirebaseConfig, db as defaultDb, auth as defaultAuth, storage as defaultStorage } from "./firebase";

export type ActivityType = "quiz" | "notes" | "events" | "liveRoom" | "crossword" | "riddles";

export interface FirebaseProjectStatus {
  isConfigured: boolean;
  projectId?: string;
  authDomain?: string;
  appName: string;
}

// -------------------------------------------------------------
// 1. PROJECT 1 (Default / Existing): Quiz, Notes, Events, Main Stage
// -------------------------------------------------------------
export const existingApp: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(defaultFirebaseConfig);
export const existingFirestore: Firestore = defaultDb;
export const existingAuth: Auth = defaultAuth;
export const existingStorage: FirebaseStorage = defaultStorage;

// -------------------------------------------------------------
// 2. PROJECT 2 (Crossword): Crossword A, Crossword B, Submissions, Leaderboard
// -------------------------------------------------------------
const crosswordConfig = {
  apiKey: import.meta.env.VITE_CROSSWORD_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_CROSSWORD_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_CROSSWORD_FIREBASE_PROJECT_ID,
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
    throw new Error(
      "[Firebase Multi-Project Error] Crossword Firebase project is not configured. " +
      "Set VITE_CROSSWORD_FIREBASE_API_KEY, VITE_CROSSWORD_FIREBASE_PROJECT_ID, and VITE_CROSSWORD_FIREBASE_APP_ID environment variables. " +
      "Quota isolation strictly prohibits falling back to the default project."
    );
  }
  return _crosswordFirestore;
}

// -------------------------------------------------------------
// 3. PROJECT 3 (Riddles): Riddles 1-5, Submissions, Scoring, Leaderboard
// -------------------------------------------------------------
const riddleConfig = {
  apiKey: import.meta.env.VITE_RIDDLE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_RIDDLE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_RIDDLE_FIREBASE_PROJECT_ID,
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
    throw new Error(
      "[Firebase Multi-Project Error] Riddle Firebase project is not configured. " +
      "Set VITE_RIDDLE_FIREBASE_API_KEY, VITE_RIDDLE_FIREBASE_PROJECT_ID, and VITE_RIDDLE_FIREBASE_APP_ID environment variables. " +
      "Quota isolation strictly prohibits falling back to the default project."
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

// Helper to inspect status of all 3 projects
export function getFirebaseProjectsStatus(): Record<"project1" | "project2" | "project3", FirebaseProjectStatus> {
  return {
    project1: {
      isConfigured: true,
      projectId: defaultFirebaseConfig.projectId,
      authDomain: defaultFirebaseConfig.authDomain,
      appName: "[DEFAULT] (Quiz, Notes, Events)",
    },
    project2: {
      isConfigured: isCrosswordConfigured,
      projectId: crosswordConfig.projectId || undefined,
      authDomain: crosswordConfig.authDomain || undefined,
      appName: "crossword (Crossword A & B)",
    },
    project3: {
      isConfigured: isRiddleConfigured,
      projectId: riddleConfig.projectId || undefined,
      authDomain: riddleConfig.authDomain || undefined,
      appName: "riddles (Riddles 1-5)",
    },
  };
}
