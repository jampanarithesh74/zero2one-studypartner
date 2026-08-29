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

export type CrosswordDirection = "across" | "down";

export interface GenericCrosswordEntry {
  id: string; // stable entry ID (e.g. entry_1719284729_a8f9d)
  entryId: string;
  activityId: string;
  eventId: string;
  number: number; // 1-based clue number (e.g. 1, 2, 3)
  direction: CrosswordDirection; // "across" | "down"
  clue: string; // The clue question / hint text
  answer: string; // Uppercase canonical answer (A-Z)
  row: number; // 0-indexed starting row (0 to gridRows - 1)
  col: number; // 0-indexed starting col (0 to gridCols - 1)
  length: number; // Length of the answer
  order: number; // Display order
  createdAt?: any;
  updatedAt?: any;
}

export interface CrosswordGridConfig {
  gridRows: number; // default 12, min 5, max 25
  gridCols: number; // default 12, min 5, max 25
}

export interface CrosswordBuilderData {
  activity: EventActivity;
  entries: GenericCrosswordEntry[];
  gridConfig: CrosswordGridConfig;
}

export interface EntryValidationError {
  entryId: string;
  entryIndex: number;
  entryNumber?: number;
  direction: CrosswordDirection;
  errors: string[];
}

export interface GeneratedCrosswordGrid {
  matrix: (string | null)[][];
  cellStartNumberMap: Record<string, number>; // "row,col" -> clue number
  cellCluesMap: Record<string, { entryId: string; char: string; direction: CrosswordDirection }[]>;
  computedEntries: GenericCrosswordEntry[];
  validationErrors: EntryValidationError[];
  isValid: boolean;
  acrossCount: number;
  downCount: number;
  totalLetters: number;
}

/**
 * Generate collision-resistant unique ID for crossword entry
 */
export function generateEntryId(): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `entry_${timestamp}_${rand}`;
}

/**
 * Create a new blank crossword entry with safe defaults
 */
export function createBlankEntry(
  eventId: string,
  activityId: string,
  direction: CrosswordDirection = "across",
  row: number = 0,
  col: number = 0,
  order: number = 1
): GenericCrosswordEntry {
  const eId = generateEntryId();
  return {
    id: eId,
    entryId: eId,
    activityId,
    eventId,
    number: order,
    direction,
    clue: "",
    answer: "",
    row: Math.max(0, row),
    col: Math.max(0, col),
    length: 0,
    order,
  };
}

/**
 * Sanitize answer to uppercase alphabetic characters only (A-Z)
 */
export function sanitizeAnswer(val: string): string {
  return (val || "").replace(/[^a-zA-Z]/g, "").toUpperCase();
}

/**
 * Deterministic crossword grid compiler and validator.
 * 
 * 1. Validates bounds against gridRows and gridCols.
 * 2. Checks letter-by-letter intersections for conflicts.
 * 3. Deterministically computes clue numbers based on top-to-bottom, left-to-right reading order of start cells.
 * 4. Produces the complete 2D matrix for the host preview.
 */
export function compileCrosswordGrid(
  gridRows: number,
  gridCols: number,
  entries: GenericCrosswordEntry[]
): GeneratedCrosswordGrid {
  const safeRows = Math.min(25, Math.max(5, gridRows || 12));
  const safeCols = Math.min(25, Math.max(5, gridCols || 12));

  // Initialize empty matrix
  const matrix: (string | null)[][] = Array.from({ length: safeRows }, () =>
    Array.from({ length: safeCols }, () => null)
  );

  const cellCluesMap: Record<
    string,
    { entryId: string; char: string; direction: CrosswordDirection }[]
  > = {};

  const validationErrors: EntryValidationError[] = [];

  // Pass 1: Individual entry validations (text, non-empty, boundary check)
  const sanitizedEntries: GenericCrosswordEntry[] = entries.map((entry, idx) => {
    const cleanAnswer = sanitizeAnswer(entry.answer);
    const cleanClue = (entry.clue || "").trim();
    const row = Math.max(0, Math.min(safeRows - 1, Number(entry.row) || 0));
    const col = Math.max(0, Math.min(safeCols - 1, Number(entry.col) || 0));
    const errors: string[] = [];

    if (!cleanClue) {
      errors.push("Clue description is required.");
    }

    if (!cleanAnswer) {
      errors.push("Answer is required (must contain at least 1 letter A-Z).");
    } else {
      if (cleanAnswer.length < 2) {
        errors.push("Answer must be at least 2 letters long.");
      }

      // Check boundary constraints
      if (entry.direction === "across") {
        if (col + cleanAnswer.length > safeCols) {
          errors.push(
            `Answer (${cleanAnswer.length} letters) extends past the right boundary at column ${col + 1} (Grid has ${safeCols} columns).`
          );
        }
      } else {
        if (row + cleanAnswer.length > safeRows) {
          errors.push(
            `Answer (${cleanAnswer.length} letters) extends past the bottom boundary at row ${row + 1} (Grid has ${safeRows} rows).`
          );
        }
      }
    }

    if (errors.length > 0) {
      validationErrors.push({
        entryId: entry.id,
        entryIndex: idx,
        direction: entry.direction,
        errors,
      });
    }

    return {
      ...entry,
      clue: cleanClue,
      answer: cleanAnswer,
      row,
      col,
      length: cleanAnswer.length,
      order: idx + 1,
    };
  });

  // Pass 2: Matrix placement and letter intersection conflict verification
  sanitizedEntries.forEach((entry, idx) => {
    if (!entry.answer || entry.answer.length < 2) return;

    const isAcross = entry.direction === "across";
    if (isAcross && entry.col + entry.answer.length > safeCols) return;
    if (!isAcross && entry.row + entry.answer.length > safeRows) return;

    const intersectionErrors: string[] = [];

    for (let i = 0; i < entry.answer.length; i++) {
      const r = isAcross ? entry.row : entry.row + i;
      const c = isAcross ? entry.col + i : entry.col;
      const char = entry.answer[i];
      const cellKey = `${r},${c}`;

      const existingChar = matrix[r][c];
      if (existingChar !== null && existingChar !== char) {
        intersectionErrors.push(
          `Letter conflict at Row ${r + 1}, Column ${c + 1}: expected '${char}', but conflicting entry placed '${existingChar}'.`
        );
      } else {
        matrix[r][c] = char;
      }

      if (!cellCluesMap[cellKey]) {
        cellCluesMap[cellKey] = [];
      }
      cellCluesMap[cellKey].push({
        entryId: entry.id,
        char,
        direction: entry.direction,
      });
    }

    if (intersectionErrors.length > 0) {
      const existingErr = validationErrors.find((v) => v.entryId === entry.id);
      if (existingErr) {
        existingErr.errors.push(...intersectionErrors);
      } else {
        validationErrors.push({
          entryId: entry.id,
          entryIndex: idx,
          direction: entry.direction,
          errors: intersectionErrors,
        });
      }
    }
  });

  // Pass 3: Deterministic Clue Numbering (Reading order: row ASC, then col ASC)
  // Identify all unique start coordinates
  const startCoordsMap = new Map<string, { row: number; col: number }>();
  sanitizedEntries.forEach((entry) => {
    if (entry.answer) {
      const key = `${entry.row},${entry.col}`;
      if (!startCoordsMap.has(key)) {
        startCoordsMap.set(key, { row: entry.row, col: entry.col });
      }
    }
  });

  // Sort coordinate list top-to-bottom, left-to-right
  const sortedStartCoords = Array.from(startCoordsMap.values()).sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  // Assign numbers 1, 2, 3...
  const cellStartNumberMap: Record<string, number> = {};
  sortedStartCoords.forEach((coord, index) => {
    const key = `${coord.row},${coord.col}`;
    cellStartNumberMap[key] = index + 1;
  });

  // Attach deterministic number to each entry
  const computedEntries = sanitizedEntries.map((entry) => {
    const key = `${entry.row},${entry.col}`;
    const assignedNumber = cellStartNumberMap[key] || entry.number || 1;
    return {
      ...entry,
      number: assignedNumber,
    };
  });

  // Update validation errors with assigned numbers for user-friendly notifications
  validationErrors.forEach((v) => {
    const matched = computedEntries.find((e) => e.id === v.entryId);
    if (matched) {
      v.entryNumber = matched.number;
    }
  });

  // Calculate statistics
  let totalLetters = 0;
  for (let r = 0; r < safeRows; r++) {
    for (let c = 0; c < safeCols; c++) {
      if (matrix[r][c] !== null) {
        totalLetters++;
      }
    }
  }

  const acrossCount = computedEntries.filter((e) => e.direction === "across").length;
  const downCount = computedEntries.filter((e) => e.direction === "down").length;
  const isValid = computedEntries.length > 0 && validationErrors.length === 0;

  return {
    matrix,
    cellStartNumberMap,
    cellCluesMap,
    computedEntries,
    validationErrors,
    isValid,
    acrossCount,
    downCount,
    totalLetters,
  };
}

/**
 * Fetch Crossword Activity metadata and all its Clue Entries in one point-in-time read.
 * 0 realtime listeners.
 */
export async function getCrosswordBuilderData(
  eventId: string,
  activityId: string
): Promise<CrosswordBuilderData | null> {
  if (!eventId || !activityId) return null;

  // 1. Fetch Activity Document
  const activityDocRef = doc(db, "events", eventId, "activities", activityId);
  const activitySnap = await getDoc(activityDocRef);

  if (!activitySnap.exists()) {
    return null;
  }

  const actData = activitySnap.data();
  const config = actData.config || {};
  const gridRows = typeof config.gridRows === "number" ? config.gridRows : 12;
  const gridCols = typeof config.gridCols === "number" ? config.gridCols : 12;

  const activity: EventActivity = {
    id: activitySnap.id,
    activityId: actData.activityId || activitySnap.id,
    eventId: actData.eventId || eventId,
    type: actData.type || "crossword",
    title: actData.title || "Custom Crossword Puzzle",
    description: actData.description || "",
    order: typeof actData.order === "number" ? actData.order : 1,
    status: actData.status || "draft",
    config: {
      ...config,
      gridRows,
      gridCols,
    },
    createdAt: actData.createdAt,
    updatedAt: actData.updatedAt,
  };

  // 2. Fetch Entries Subcollection
  const entriesColRef = collection(
    db,
    "events",
    eventId,
    "activities",
    activityId,
    "entries"
  );
  const entriesSnap = await getDocs(entriesColRef);

  const entries: GenericCrosswordEntry[] = [];
  entriesSnap.forEach((docSnap) => {
    const eData = docSnap.data();
    if (eData) {
      const cleanAnswer = sanitizeAnswer(eData.answer || "");
      entries.push({
        id: docSnap.id,
        entryId: eData.entryId || docSnap.id,
        activityId: eData.activityId || activityId,
        eventId: eData.eventId || eventId,
        number: typeof eData.number === "number" ? eData.number : entries.length + 1,
        direction: eData.direction === "down" ? "down" : "across",
        clue: eData.clue || "",
        answer: cleanAnswer,
        row: typeof eData.row === "number" ? eData.row : 0,
        col: typeof eData.col === "number" ? eData.col : 0,
        length: cleanAnswer.length,
        order: typeof eData.order === "number" ? eData.order : entries.length + 1,
        createdAt: eData.createdAt,
        updatedAt: eData.updatedAt,
      });
    }
  });

  // Sort by order ASC, then by direction, then by number
  entries.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (a.direction !== b.direction) return a.direction === "across" ? -1 : 1;
    return a.number - b.number;
  });

  return {
    activity,
    entries,
    gridConfig: {
      gridRows,
      gridCols,
    },
  };
}

/**
 * Save entire Crossword Configuration atomically via Firestore writeBatch.
 * 
 * Performs:
 * 1. Activity doc update: title, description, status, config (gridRows, gridCols, clueCount, acrossCount, downCount, totalWords), updatedAt.
 * 2. Entry docs batch write: sets each entry in events/{eventId}/activities/{activityId}/entries/{entryId}.
 * 3. Deleted entries removal: batch deletes any removed entry document.
 */
export async function saveCrosswordConfiguration(
  eventId: string,
  activityId: string,
  activityMeta: {
    title: string;
    description: string;
    status: "draft" | "ready";
  },
  gridConfig: CrosswordGridConfig,
  entries: GenericCrosswordEntry[],
  deletedEntryIds: string[] = []
): Promise<void> {
  if (!eventId || !activityId) {
    throw new Error("Event ID and Activity ID are required to save crossword.");
  }

  const compiled = compileCrosswordGrid(gridConfig.gridRows, gridConfig.gridCols, entries);
  const finalEntries = compiled.computedEntries;

  const batch = writeBatch(db);

  // 1. Update Activity metadata document
  const activityDocRef = doc(db, "events", eventId, "activities", activityId);
  batch.update(activityDocRef, {
    title: activityMeta.title.trim(),
    description: activityMeta.description.trim(),
    status: activityMeta.status,
    config: {
      gridRows: gridConfig.gridRows,
      gridCols: gridConfig.gridCols,
      clueCount: finalEntries.length,
      acrossCount: compiled.acrossCount,
      downCount: compiled.downCount,
      totalWords: finalEntries.length,
      totalLetters: compiled.totalLetters,
      lastConfiguredAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  });

  // 2. Set/Update each Crossword Entry document
  finalEntries.forEach((entry, index) => {
    const entryDocRef = doc(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "entries",
      entry.id
    );

    const entryPayload: Record<string, any> = {
      id: entry.id,
      entryId: entry.id,
      activityId,
      eventId,
      number: entry.number,
      direction: entry.direction,
      clue: entry.clue.trim(),
      answer: sanitizeAnswer(entry.answer),
      row: entry.row,
      col: entry.col,
      length: entry.answer.length,
      order: index + 1,
      updatedAt: serverTimestamp(),
    };

    batch.set(entryDocRef, entryPayload, { merge: true });
  });

  // 3. Delete removed entries
  deletedEntryIds.forEach((delId) => {
    if (delId) {
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
    }
  });

  // Commit all writes atomically in a single round-trip
  await batch.commit();
}
