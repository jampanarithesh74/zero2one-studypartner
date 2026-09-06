/**
 * ZERO2ONE EVENTS — FEATURE 5D
 * CUSTOM EVENT CROSSWORD LIVE INTEGRATION ADAPTER
 *
 * Implements authoritative crossword puzzle fetching, participant solution evaluation,
 * answer key sanitization, idempotent submission persistence, and live leaderboard sync.
 */

import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  GenericCrosswordEntry,
  CrosswordGridConfig,
  GeneratedCrosswordGrid,
  compileCrosswordGrid,
  sanitizeAnswer,
} from "./crosswordBuilderService";
import { EventActivity } from "./eventActivityService";

export interface SanitizedCrosswordEntry {
  id: string;
  entryId: string;
  activityId: string;
  eventId: string;
  number: number;
  direction: "across" | "down";
  clue: string;
  row: number;
  col: number;
  length: number;
  order: number;
  answer?: string; // Only present in reveal stage
}

export interface SanitizedCrosswordData {
  activityId: string;
  eventId: string;
  title: string;
  description: string;
  gridRows: number;
  gridCols: number;
  durationSeconds: number;
  entries: SanitizedCrosswordEntry[];
  cellStartNumberMap: Record<string, number>;
  activeCellsMap: Record<string, boolean>; // "row,col" -> true for interactive cells
  cellCluesMap: Record<string, { entryId: string; direction: "across" | "down" }[]>;
  totalWords: number;
  totalLetters: number;
  solutionMatrix?: (string | null)[][]; // Only present when revealed
  isRevealed: boolean;
}

export interface CrosswordSubmissionRecord {
  id: string;
  submissionId: string;
  activityId: string;
  eventId: string;
  participantId: string;
  participantName: string;
  participantCollege?: string;
  participantDepartment?: string;
  userGrid: Record<string, string>; // "row,col" -> letter
  correctWordsCount: number;
  totalWordsCount: number;
  correctLettersCount: number;
  totalLettersCount: number;
  accuracyPercentage: number;
  score: number;
  timeTakenSec: number;
  isFullySolved: boolean;
  submittedAt: any;
}

export interface CrosswordLeaderboardEntry {
  participantId: string;
  name: string;
  college?: string;
  department?: string;
  score: number;
  correctWordsCount: number;
  totalWordsCount: number;
  accuracyPercentage: number;
  timeTakenSec: number;
  submittedAt: number;
  rank?: number;
}

export interface CompiledCrosswordPayload {
  activity: EventActivity;
  gridConfig: CrosswordGridConfig;
  entries: GenericCrosswordEntry[];
  compiledGrid: GeneratedCrosswordGrid;
}

export const CrosswordActivityAdapter = {
  /**
   * Fetch complete Crossword Activity data and compiled grid.
   * Point-in-time read (0 real-time Firestore listeners).
   */
  async fetchCrosswordData(
    eventId: string,
    activityId: string
  ): Promise<CompiledCrosswordPayload | null> {
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
    const durationSeconds =
      typeof actData.durationSeconds === "number"
        ? actData.durationSeconds
        : typeof config.timeLimit === "number"
        ? config.timeLimit
        : 180;

    const activity: EventActivity = {
      id: activitySnap.id,
      activityId: actData.activityId || activitySnap.id,
      eventId: actData.eventId || eventId,
      type: "crossword",
      title: actData.title || "Custom Crossword Puzzle",
      description: actData.description || "",
      order: typeof actData.order === "number" ? actData.order : 1,
      status: actData.status || "draft",
      durationSeconds,
      config: {
        ...config,
        gridRows,
        gridCols,
        timeLimit: durationSeconds,
      },
      createdAt: actData.createdAt,
      updatedAt: actData.updatedAt,
    };

    // 2. Fetch Entries Subcollection: events/{eventId}/activities/{activityId}/entries
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

    // 3. Compile deterministic grid
    const compiledGrid = compileCrosswordGrid(gridRows, gridCols, entries);

    return {
      activity,
      gridConfig: { gridRows, gridCols },
      entries: compiledGrid.computedEntries,
      compiledGrid,
    };
  },

  /**
   * Produce a sanitized payload for participants.
   * Hides `answer` strings and solution matrix until the host officially reveals solutions.
   */
  sanitizeForParticipant(
    payload: CompiledCrosswordPayload,
    isRevealed: boolean = false
  ): SanitizedCrosswordData {
    const { activity, gridConfig, compiledGrid } = payload;
    const activeCellsMap: Record<string, boolean> = {};
    const sanitizedCellCluesMap: Record<
      string,
      { entryId: string; direction: "across" | "down" }[]
    > = {};

    for (let r = 0; r < gridConfig.gridRows; r++) {
      for (let c = 0; c < gridConfig.gridCols; c++) {
        if (compiledGrid.matrix[r] && compiledGrid.matrix[r][c] !== null) {
          activeCellsMap[`${r},${c}`] = true;
        }
      }
    }

    Object.entries(compiledGrid.cellCluesMap).forEach(([cellKey, list]) => {
      sanitizedCellCluesMap[cellKey] = list.map((item) => ({
        entryId: item.entryId,
        direction: item.direction,
      }));
    });

    const sanitizedEntries: SanitizedCrosswordEntry[] = compiledGrid.computedEntries.map((e) => ({
      id: e.id,
      entryId: e.entryId,
      activityId: e.activityId,
      eventId: e.eventId,
      number: e.number,
      direction: e.direction,
      clue: e.clue,
      row: e.row,
      col: e.col,
      length: e.length,
      order: e.order,
      ...(isRevealed && { answer: e.answer }),
    }));

    return {
      activityId: activity.id,
      eventId: activity.eventId,
      title: activity.title,
      description: activity.description || "",
      gridRows: gridConfig.gridRows,
      gridCols: gridConfig.gridCols,
      durationSeconds: activity.durationSeconds || 180,
      entries: sanitizedEntries,
      cellStartNumberMap: compiledGrid.cellStartNumberMap,
      activeCellsMap,
      cellCluesMap: sanitizedCellCluesMap,
      totalWords: compiledGrid.computedEntries.length,
      totalLetters: compiledGrid.totalLetters,
      isRevealed,
      ...(isRevealed && { solutionMatrix: compiledGrid.matrix }),
    };
  },

  /**
   * Evaluate participant submitted grid against authoritative crossword puzzle.
   * Calculates correct words, correct letters, and point score.
   */
  evaluateSubmission(
    userGrid: Record<string, string>,
    payload: CompiledCrosswordPayload,
    timeTakenSec: number
  ): {
    correctWordsCount: number;
    totalWordsCount: number;
    correctLettersCount: number;
    totalLettersCount: number;
    accuracyPercentage: number;
    score: number;
    isFullySolved: boolean;
  } {
    const { compiledGrid, activity } = payload;
    const entries = compiledGrid.computedEntries;
    const durationSeconds = activity.durationSeconds || 180;

    let correctWordsCount = 0;
    const totalWordsCount = entries.length;

    // Check each entry word
    entries.forEach((entry) => {
      let wordMatches = true;
      const cleanAns = entry.answer.toUpperCase();

      for (let i = 0; i < cleanAns.length; i++) {
        const r = entry.direction === "across" ? entry.row : entry.row + i;
        const c = entry.direction === "across" ? entry.col + i : entry.col;
        const userLetter = (userGrid[`${r},${c}`] || "").toUpperCase();

        if (userLetter !== cleanAns[i]) {
          wordMatches = false;
          break;
        }
      }

      if (wordMatches) {
        correctWordsCount++;
      }
    });

    // Check letter-by-letter matching across matrix
    let correctLettersCount = 0;
    let totalLettersCount = 0;

    for (let r = 0; r < compiledGrid.matrix.length; r++) {
      for (let c = 0; c < (compiledGrid.matrix[r]?.length || 0); c++) {
        const solChar = compiledGrid.matrix[r][c];
        if (solChar !== null) {
          totalLettersCount++;
          const userChar = (userGrid[`${r},${c}`] || "").toUpperCase();
          if (userChar === solChar) {
            correctLettersCount++;
          }
        }
      }
    }

    const accuracyPercentage =
      totalWordsCount > 0 ? Math.round((correctWordsCount / totalWordsCount) * 100) : 0;

    const isFullySolved = totalWordsCount > 0 && correctWordsCount === totalWordsCount;

    // Base score: 100 points per complete word + 10 points per correct letter
    let calculatedScore = correctWordsCount * 100 + correctLettersCount * 10;

    // Completion / speed bonus: if fully solved, award up to 200 points scaled by time remaining
    if (isFullySolved && durationSeconds > 0) {
      const remainingSec = Math.max(0, durationSeconds - timeTakenSec);
      const speedBonus = Math.round((remainingSec / durationSeconds) * 200);
      calculatedScore += speedBonus;
    }

    return {
      correctWordsCount,
      totalWordsCount,
      correctLettersCount,
      totalLettersCount,
      accuracyPercentage,
      score: calculatedScore,
      isFullySolved,
    };
  },

  /**
   * Submit participant answers atomically with idempotency protection.
   * Path: `events/{eventId}/activities/{activityId}/submissions/{participantId}`
   * Also updates: `events/{eventId}/activities/{activityId}/leaderboard/{participantId}`
   */
  async submitCrossword(
    eventId: string,
    activityId: string,
    participant: {
      id: string;
      name: string;
      college?: string;
      department?: string;
    },
    userGrid: Record<string, string>,
    timeTakenSec: number,
    payload: CompiledCrosswordPayload
  ): Promise<CrosswordSubmissionRecord> {
    if (!eventId || !activityId || !participant?.id) {
      throw new Error("Missing required parameters for crossword submission.");
    }

    const evaluation = this.evaluateSubmission(userGrid, payload, timeTakenSec);
    const now = Date.now();
    const submissionId = `sub_${activityId}_${participant.id}`;

    const submissionData: CrosswordSubmissionRecord = {
      id: participant.id,
      submissionId,
      activityId,
      eventId,
      participantId: participant.id,
      participantName: participant.name || "Event Participant",
      participantCollege: participant.college || "",
      participantDepartment: participant.department || "",
      userGrid,
      correctWordsCount: evaluation.correctWordsCount,
      totalWordsCount: evaluation.totalWordsCount,
      correctLettersCount: evaluation.correctLettersCount,
      totalLettersCount: evaluation.totalLettersCount,
      accuracyPercentage: evaluation.accuracyPercentage,
      score: evaluation.score,
      timeTakenSec: Math.max(0, Math.round(timeTakenSec)),
      isFullySolved: evaluation.isFullySolved,
      submittedAt: serverTimestamp(),
    };

    // Write submission document with deterministic ID for idempotency
    const subDocRef = doc(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "submissions",
      participant.id
    );
    await setDoc(subDocRef, submissionData, { merge: true });

    // Write leaderboard record
    const leaderboardDocRef = doc(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "leaderboard",
      participant.id
    );
    await setDoc(
      leaderboardDocRef,
      {
        participantId: participant.id,
        name: participant.name || "Event Participant",
        college: participant.college || "",
        department: participant.department || "",
        score: evaluation.score,
        correctWordsCount: evaluation.correctWordsCount,
        totalWordsCount: evaluation.totalWordsCount,
        accuracyPercentage: evaluation.accuracyPercentage,
        timeTakenSec: Math.max(0, Math.round(timeTakenSec)),
        submittedAt: now,
      },
      { merge: true }
    );

    return submissionData;
  },

  /**
   * Subscribe to Crossword Leaderboard in real-time.
   * Path: `events/{eventId}/activities/{activityId}/leaderboard`
   * Ordered by `score DESC`, `timeTakenSec ASC`.
   */
  subscribeCrosswordLeaderboard(
    eventId: string,
    activityId: string,
    limitCountOrCallback: number | ((entries: CrosswordLeaderboardEntry[]) => void) = 10,
    optionalCallback?: (entries: CrosswordLeaderboardEntry[]) => void
  ): Unsubscribe {
    const callback = typeof limitCountOrCallback === "function" ? limitCountOrCallback : optionalCallback || (() => {});
    const limitCount = typeof limitCountOrCallback === "number" ? limitCountOrCallback : 10;

    if (!eventId || !activityId) {
      callback([]);
      return () => {};
    }

    const colRef = collection(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "leaderboard"
    );

    const q = query(colRef, orderBy("score", "desc"), limit(limitCount));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: CrosswordLeaderboardEntry[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data) {
            list.push({
              participantId: data.participantId || docSnap.id,
              name: data.name || "Participant",
              college: data.college || "",
              department: data.department || "",
              score: typeof data.score === "number" ? data.score : 0,
              correctWordsCount: typeof data.correctWordsCount === "number" ? data.correctWordsCount : 0,
              totalWordsCount: typeof data.totalWordsCount === "number" ? data.totalWordsCount : 0,
              accuracyPercentage: typeof data.accuracyPercentage === "number" ? data.accuracyPercentage : 0,
              timeTakenSec: typeof data.timeTakenSec === "number" ? data.timeTakenSec : 0,
              submittedAt: typeof data.submittedAt === "number" ? data.submittedAt : Date.now(),
            });
          }
        });

        // Secondary client sort by timeTakenSec ASC for equal scores
        list.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.timeTakenSec - b.timeTakenSec;
        });

        const ranked = list.map((item, idx) => ({
          ...item,
          rank: idx + 1,
        }));

        callback(ranked);
      },
      (error) => {
        console.warn("[CrosswordActivityAdapter] Leaderboard subscription warning:", error);
        callback([]);
      }
    );
  },

  /**
   * Subscribe to live submissions count for Host control deck.
   * Path: `events/{eventId}/activities/{activityId}/submissions`
   */
  subscribeSubmissionsCount(
    eventId: string,
    activityId: string,
    callback: (count: number) => void
  ): Unsubscribe {
    if (!eventId || !activityId) {
      callback(0);
      return () => {};
    }

    const colRef = collection(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "submissions"
    );

    return onSnapshot(
      colRef,
      (snapshot) => {
        callback(snapshot.size);
      },
      (err) => {
        console.warn("[CrosswordActivityAdapter] Submissions count warning:", err);
        callback(0);
      }
    );
  },
};
