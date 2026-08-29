import {
  doc,
  collection,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { EventActivity } from "./eventActivityService";

export interface GenericRiddleEntry {
  id: string; // Stable unique ID (e.g. entry_1719284729_a8f9d)
  entryId: string;
  activityId: string;
  eventId: string;
  order: number; // 1-based ordering
  title?: string; // Optional title/headline (e.g. "Riddle 1: Logic Gates")
  riddleText: string; // The riddle challenge prompt
  answer: string; // Sanitized uppercase canonical solution (A-Z)
  hint?: string; // Optional clue/hint
  explanation?: string; // Optional explanation shown on reveal
  timeLimitSec: number; // Seconds (e.g. 15, 20, 30, 45, 60)
  points: number; // Points awarded (e.g. 100)
  tags?: string[]; // Optional category tags
  createdAt?: any;
  updatedAt?: any;
}

export interface RiddleBuilderData {
  activity: EventActivity;
  riddles: GenericRiddleEntry[];
}

export interface RiddleValidationError {
  entryId: string;
  riddleIndex: number;
  errors: string[];
}

export interface RiddleValidationResult {
  isValid: boolean;
  errors: RiddleValidationError[];
  globalErrors: string[];
}

/**
 * Generate a collision-resistant stable riddle entry ID
 */
export function generateRiddleEntryId(): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `riddle_${timestamp}_${rand}`;
}

/**
 * Create a new blank riddle template
 */
export function createBlankRiddle(
  eventId: string,
  activityId: string,
  order: number
): GenericRiddleEntry {
  const entryId = generateRiddleEntryId();
  return {
    id: entryId,
    entryId,
    activityId,
    eventId,
    order,
    title: `Riddle ${order}`,
    riddleText: "",
    answer: "",
    hint: "",
    explanation: "",
    timeLimitSec: 20,
    points: 100,
    tags: [],
  };
}

/**
 * Sanitize answer to uppercase alphabetic characters (A-Z)
 * Strips whitespace, accents, and special symbols for consistent letter-box matching.
 */
export function sanitizeRiddleAnswer(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

/**
 * Validate all riddle entries and global activity configuration
 */
export function validateRiddleEntries(
  riddles: GenericRiddleEntry[],
  title: string
): RiddleValidationResult {
  const globalErrors: string[] = [];
  const errors: RiddleValidationError[] = [];

  // Global Validations
  if (!title || !title.trim()) {
    globalErrors.push("Activity title is required.");
  } else if (title.trim().length > 120) {
    globalErrors.push("Activity title must be 120 characters or fewer.");
  }

  if (!riddles || riddles.length === 0) {
    globalErrors.push("At least one riddle is required.");
  }

  // Per-Riddle Validations
  riddles.forEach((riddle, index) => {
    const entryErrors: string[] = [];

    // Riddle prompt text
    if (!riddle.riddleText || !riddle.riddleText.trim()) {
      entryErrors.push("Riddle prompt text cannot be empty.");
    } else if (riddle.riddleText.trim().length < 5) {
      entryErrors.push("Riddle prompt must be at least 5 characters long.");
    } else if (riddle.riddleText.trim().length > 600) {
      entryErrors.push("Riddle prompt cannot exceed 600 characters.");
    }

    // Answer validation
    const cleanAnswer = sanitizeRiddleAnswer(riddle.answer);
    if (!cleanAnswer) {
      entryErrors.push("A valid solution answer is required.");
    } else if (cleanAnswer.length < 2) {
      entryErrors.push("Answer must have at least 2 letters.");
    } else if (cleanAnswer.length > 25) {
      entryErrors.push("Answer cannot exceed 25 letters.");
    }

    // Hint validation
    if (riddle.hint && riddle.hint.trim().length > 250) {
      entryErrors.push("Hint cannot exceed 250 characters.");
    }

    // Explanation validation
    if (riddle.explanation && riddle.explanation.trim().length > 500) {
      entryErrors.push("Explanation cannot exceed 500 characters.");
    }

    // Time Limit validation
    if (
      typeof riddle.timeLimitSec !== "number" ||
      isNaN(riddle.timeLimitSec) ||
      riddle.timeLimitSec < 5 ||
      riddle.timeLimitSec > 300
    ) {
      entryErrors.push("Time limit must be between 5 and 300 seconds.");
    }

    // Points validation
    if (
      typeof riddle.points !== "number" ||
      isNaN(riddle.points) ||
      riddle.points < 0 ||
      riddle.points > 1000
    ) {
      entryErrors.push("Points must be between 0 and 1000.");
    }

    if (entryErrors.length > 0) {
      errors.push({
        entryId: riddle.id || `riddle_${index}`,
        riddleIndex: index,
        errors: entryErrors,
      });
    }
  });

  const isValid = globalErrors.length === 0 && errors.length === 0;
  return { isValid, errors, globalErrors };
}

/**
 * Fetch Riddle Activity metadata and all its Riddle entries in one point-in-time read.
 * 0 realtime listeners.
 */
export async function getRiddleBuilderData(
  eventId: string,
  activityId: string
): Promise<RiddleBuilderData | null> {
  if (!eventId || !activityId) return null;

  // 1. Fetch Activity Document
  const activityDocRef = doc(db, "events", eventId, "activities", activityId);
  const activitySnap = await getDoc(activityDocRef);

  if (!activitySnap.exists()) {
    return null;
  }

  const actData = activitySnap.data();
  const activity: EventActivity = {
    id: activitySnap.id,
    activityId: actData.activityId || activitySnap.id,
    eventId: actData.eventId || eventId,
    type: actData.type || "riddle",
    title: actData.title || "Engineering Riddles",
    description: actData.description || "",
    order: typeof actData.order === "number" ? actData.order : 1,
    status: actData.status || "draft",
    config: actData.config || {},
    createdAt: actData.createdAt,
    updatedAt: actData.updatedAt,
  };

  // 2. Fetch Riddles Subcollection
  const entriesColRef = collection(
    db,
    "events",
    eventId,
    "activities",
    activityId,
    "entries"
  );
  const entriesSnap = await getDocs(entriesColRef);

  const riddles: GenericRiddleEntry[] = [];
  entriesSnap.forEach((docSnap) => {
    const data = docSnap.data();
    riddles.push({
      id: docSnap.id,
      entryId: data.entryId || docSnap.id,
      activityId: data.activityId || activityId,
      eventId: data.eventId || eventId,
      order: typeof data.order === "number" ? data.order : 1,
      title: data.title || "",
      riddleText: data.riddleText || "",
      answer: sanitizeRiddleAnswer(data.answer || ""),
      hint: data.hint || "",
      explanation: data.explanation || "",
      timeLimitSec: typeof data.timeLimitSec === "number" ? data.timeLimitSec : 20,
      points: typeof data.points === "number" ? data.points : 100,
      tags: Array.isArray(data.tags) ? data.tags : [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  });

  // Sort by order ASC
  riddles.sort((a, b) => a.order - b.order);

  return { activity, riddles };
}

/**
 * Atomically save the Riddle activity metadata and all riddle entries.
 * Uses Firestore writeBatch:
 * - Updates parent activity metadata
 * - Sets/Updates each riddle entry document
 * - Deletes any removed riddle entry documents
 */
export async function saveRiddleConfiguration(
  eventId: string,
  activityId: string,
  activityMetadata: {
    title: string;
    description?: string;
    status: "draft" | "ready";
  },
  riddles: GenericRiddleEntry[],
  deletedEntryIds: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!eventId || !activityId) {
    return { success: false, error: "Missing eventId or activityId." };
  }

  // Validate before commit
  const validation = validateRiddleEntries(riddles, activityMetadata.title);
  if (activityMetadata.status === "ready" && !validation.isValid) {
    const firstErr =
      validation.globalErrors[0] ||
      validation.errors[0]?.errors[0] ||
      "Validation failed.";
    return {
      success: false,
      error: `Cannot mark as Ready: ${firstErr}`,
    };
  }

  try {
    const batch = writeBatch(db);

    // 1. Calculate Summary Metrics
    const riddleCount = riddles.length;
    const totalPoints = riddles.reduce((sum, r) => sum + (Number(r.points) || 0), 0);
    const totalTimeSec = riddles.reduce((sum, r) => sum + (Number(r.timeLimitSec) || 0), 0);

    // 2. Parent Activity Update
    const activityDocRef = doc(db, "events", eventId, "activities", activityId);
    batch.update(activityDocRef, {
      title: activityMetadata.title.trim(),
      description: activityMetadata.description?.trim() || "",
      status: activityMetadata.status,
      config: {
        riddleCount,
        totalPoints,
        totalTimeSec,
        lastConfiguredAt: Date.now(),
      },
      updatedAt: serverTimestamp(),
    });

    // 3. Set/Update each riddle entry in the subcollection
    riddles.forEach((riddle, index) => {
      const normalizedOrder = index + 1;
      const entryId = riddle.id || generateRiddleEntryId();
      const entryDocRef = doc(
        db,
        "events",
        eventId,
        "activities",
        activityId,
        "entries",
        entryId
      );

      const entryPayload: GenericRiddleEntry = {
        id: entryId,
        entryId,
        activityId,
        eventId,
        order: normalizedOrder,
        title: riddle.title?.trim() || `Riddle ${normalizedOrder}`,
        riddleText: riddle.riddleText.trim(),
        answer: sanitizeRiddleAnswer(riddle.answer),
        hint: riddle.hint?.trim() || "",
        explanation: riddle.explanation?.trim() || "",
        timeLimitSec: Number(riddle.timeLimitSec) || 20,
        points: Number(riddle.points) || 100,
        tags: Array.isArray(riddle.tags) ? riddle.tags : [],
        updatedAt: serverTimestamp(),
      };

      batch.set(entryDocRef, entryPayload, { merge: true });
    });

    // 4. Delete removed riddle entries
    if (deletedEntryIds && deletedEntryIds.length > 0) {
      deletedEntryIds.forEach((delId) => {
        if (!delId) return;
        const delDocRef = doc(
          db,
          "events",
          eventId,
          "activities",
          activityId,
          "entries",
          delId
        );
        batch.delete(delDocRef);
      });
    }

    // Atomic commit
    await batch.commit();

    return { success: true };
  } catch (err: any) {
    console.error("[saveRiddleConfiguration] Error committing batch:", err);
    return {
      success: false,
      error: err.message || "Failed to save riddle configuration.",
    };
  }
}
