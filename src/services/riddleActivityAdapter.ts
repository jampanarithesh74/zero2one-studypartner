/**
 * ZERO2ONE EVENTS — FEATURE 5E
 * CUSTOM EVENT RIDDLE LIVE INTEGRATION ADAPTER
 *
 * Implements authoritative riddle entry fetching, participant answer submission,
 * real-time host stats aggregation, and drift-free leaderboard calculation.
 */

import {
  doc,
  collection,
  getDocs,
  setDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  GenericRiddleEntry,
  sanitizeRiddleAnswer,
} from "./riddleBuilderService";

export interface SanitizedRiddleEntry {
  id: string;
  entryId: string;
  activityId: string;
  eventId: string;
  order: number;
  title?: string;
  riddleText: string;
  answerLength: number;
  hint?: string;
  timeLimitSec: number;
  points: number;
  tags?: string[];
  // Security guard: answer and explanation are ONLY present when officially revealed
  answer?: string;
  explanation?: string;
}

export interface RiddleSubmission {
  id: string;
  submissionId: string;
  activityId: string;
  eventId: string;
  riddleId: string;
  stepIndex: number;
  participantId: string;
  participantName: string;
  participantCollege?: string;
  participantDepartment?: string;
  userAnswer: string;
  isCorrect: boolean;
  pointsEarned: number;
  timeTakenSec: number;
  submittedAt: any;
}

export interface RiddleQuestionStats {
  riddleId: string;
  totalSubmissions: number;
  correctCount: number;
  incorrectCount: number;
  recentSubmissions?: Array<{ id?: string; userAnswer: string; isCorrect: boolean; participantName?: string }>;
}

export type RiddleSubmissionStats = RiddleQuestionStats;

export type { GenericRiddleEntry };

export interface RiddleLeaderboardEntry {
  participantId: string;
  name: string;
  college?: string;
  department?: string;
  totalScore: number;
  correctAnswersCount: number;
  totalAnswered: number;
  lastSubmittedAt: number;
  rank?: number;
}

export const RiddleActivityAdapter = {
  /**
   * Fetch all riddle entries for a specific riddle activity ordered strictly by `order ASC`.
   * Point-in-time read (no unbounded listeners).
   */
  async fetchRiddleEntries(
    eventId: string,
    activityId: string
  ): Promise<GenericRiddleEntry[]> {
    if (!eventId || !activityId) return [];

    const entriesColRef = collection(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "entries"
    );

    const snapshot = await getDocs(entriesColRef);
    const riddles: GenericRiddleEntry[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data) {
        riddles.push({
          id: docSnap.id,
          entryId: data.entryId || docSnap.id,
          activityId: data.activityId || activityId,
          eventId: data.eventId || eventId,
          order: typeof data.order === "number" ? data.order : riddles.length + 1,
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
      }
    });

    // Sort strictly by order ASC
    riddles.sort((a, b) => a.order - b.order);
    return riddles;
  },

  /**
   * Sanitize riddle entry for participants to prevent client-side answer inspection
   * before the authoritative reveal stage.
   */
  sanitizeRiddle(
    riddle: GenericRiddleEntry,
    isRevealed: boolean
  ): SanitizedRiddleEntry {
    const cleanAnswer = sanitizeRiddleAnswer(riddle.answer);
    return {
      id: riddle.id,
      entryId: riddle.entryId,
      activityId: riddle.activityId,
      eventId: riddle.eventId,
      order: riddle.order,
      title: riddle.title,
      riddleText: riddle.riddleText,
      answerLength: Math.max(cleanAnswer.length, 1),
      hint: riddle.hint,
      timeLimitSec: riddle.timeLimitSec,
      points: riddle.points,
      tags: riddle.tags,
      // Only attach answer and explanation when host officially reveals
      ...(isRevealed && {
        answer: cleanAnswer,
        explanation: riddle.explanation,
      }),
    };
  },

  /**
   * Submit an answer for the active riddle question.
   * Atomically computes score and speed bonus.
   */
  async submitAnswer(
    eventId: string,
    activityId: string,
    riddle: GenericRiddleEntry,
    participant: {
      id: string;
      name: string;
      college?: string;
      department?: string;
    },
    userAnswer: string,
    timeTakenSec: number
  ): Promise<{ isCorrect: boolean; pointsEarned: number; sanitizedAnswer: string }> {
    if (!eventId || !activityId || !riddle || !participant.id) {
      throw new Error("Missing required parameters to submit riddle answer.");
    }

    const sanitizedUserAnswer = sanitizeRiddleAnswer(userAnswer);
    const sanitizedTargetAnswer = sanitizeRiddleAnswer(riddle.answer);
    const isCorrect = sanitizedUserAnswer.length > 0 && sanitizedUserAnswer === sanitizedTargetAnswer;
    let pointsEarned = 0;

    if (isCorrect) {
      const basePoints = riddle.points || 100;
      // Calculate speed bonus: up to 20% bonus for answering quickly within the time limit
      const timeRatio = Math.max(
        0,
        Math.min(1, (riddle.timeLimitSec - timeTakenSec) / Math.max(1, riddle.timeLimitSec))
      );
      const speedBonus = Math.round(timeRatio * (basePoints * 0.2));
      pointsEarned = basePoints + speedBonus;
    }

    const submissionDocId = `${participant.id}_${riddle.id}`;
    const submissionRef = doc(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "submissions",
      submissionDocId
    );

    const submissionPayload: RiddleSubmission = {
      id: submissionDocId,
      submissionId: submissionDocId,
      activityId,
      eventId,
      riddleId: riddle.id,
      stepIndex: riddle.order - 1,
      participantId: participant.id,
      participantName: participant.name,
      participantCollege: participant.college || "",
      participantDepartment: participant.department || "",
      userAnswer: sanitizedUserAnswer,
      isCorrect,
      pointsEarned,
      timeTakenSec: Math.max(0, Math.round(timeTakenSec * 10) / 10),
      submittedAt: serverTimestamp(),
    };

    await setDoc(submissionRef, submissionPayload, { merge: true });

    // Cache locally
    try {
      localStorage.setItem(`z2o_riddle_${eventId}_${riddle.id}_${participant.id}`, JSON.stringify({
        submitted: true,
        userAnswer: sanitizedUserAnswer,
        isCorrect,
        pointsEarned,
      }));
    } catch (e) {
      console.warn("Could not cache riddle submission state:", e);
    }

    return { isCorrect, pointsEarned, sanitizedAnswer: sanitizedUserAnswer };
  },

  /**
   * Subscribe to real-time submissions for the active riddle (Host radar).
   */
  subscribeRiddleStats(
    eventId: string,
    activityId: string,
    riddleId: string,
    callback: (stats: RiddleQuestionStats) => void
  ): Unsubscribe {
    if (!eventId || !activityId || !riddleId) {
      callback({
        riddleId: "",
        totalSubmissions: 0,
        correctCount: 0,
        incorrectCount: 0,
      });
      return () => {};
    }

    const submissionsColRef = collection(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "submissions"
    );
    const qQuery = query(submissionsColRef, where("riddleId", "==", riddleId));

    return onSnapshot(
      qQuery,
      (snapshot) => {
        let correctCount = 0;
        let incorrectCount = 0;
        let total = 0;

        const recentSubmissions: Array<{ id?: string; userAnswer: string; isCorrect: boolean; participantName?: string }> = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as RiddleSubmission;
          if (data) {
            total++;
            if (data.isCorrect) {
              correctCount++;
            } else {
              incorrectCount++;
            }
            if (data.userAnswer) {
              recentSubmissions.push({
                id: docSnap.id,
                userAnswer: data.userAnswer,
                isCorrect: !!data.isCorrect,
                participantName: data.participantName,
              });
            }
          }
        });

        callback({
          riddleId,
          totalSubmissions: total,
          correctCount,
          incorrectCount,
          recentSubmissions,
        });
      },
      (error) => {
        console.warn("[RiddleActivityAdapter] Riddle stats subscription error:", error);
      }
    );
  },

  /**
   * Subscribe to real-time aggregated leaderboard for this riddle activity.
   */
  subscribeRiddleLeaderboard(
    eventId: string,
    activityId: string,
    callback: (leaderboard: RiddleLeaderboardEntry[]) => void
  ): Unsubscribe {
    if (!eventId || !activityId) {
      callback([]);
      return () => {};
    }

    const submissionsColRef = collection(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "submissions"
    );

    return onSnapshot(
      submissionsColRef,
      (snapshot) => {
        const participantAggregates: Record<
          string,
          {
            participantId: string;
            name: string;
            college?: string;
            department?: string;
            totalScore: number;
            correctAnswersCount: number;
            totalAnswered: number;
            lastSubmittedAt: number;
          }
        > = {};

        snapshot.forEach((docSnap) => {
          const sub = docSnap.data() as RiddleSubmission;
          if (!sub || !sub.participantId) return;

          const pid = sub.participantId;
          if (!participantAggregates[pid]) {
            participantAggregates[pid] = {
              participantId: pid,
              name: sub.participantName || "Anonymous Participant",
              college: sub.participantCollege || "",
              department: sub.participantDepartment || "",
              totalScore: 0,
              correctAnswersCount: 0,
              totalAnswered: 0,
              lastSubmittedAt: 0,
            };
          }

          const agg = participantAggregates[pid];
          agg.totalScore += Number(sub.pointsEarned) || 0;
          agg.totalAnswered += 1;
          if (sub.isCorrect) {
            agg.correctAnswersCount += 1;
          }

          const submitTime =
            sub.submittedAt?.toMillis?.() ||
            (typeof sub.submittedAt === "number" ? sub.submittedAt : Date.now());
          if (submitTime > agg.lastSubmittedAt) {
            agg.lastSubmittedAt = submitTime;
          }
        });

        // Convert to sorted array
        const sortedList: RiddleLeaderboardEntry[] = Object.values(participantAggregates).sort(
          (a, b) => {
            // Higher total score first
            if (b.totalScore !== a.totalScore) {
              return b.totalScore - a.totalScore;
            }
            // More correct answers
            if (b.correctAnswersCount !== a.correctAnswersCount) {
              return b.correctAnswersCount - a.correctAnswersCount;
            }
            // Faster submission time
            return a.lastSubmittedAt - b.lastSubmittedAt;
          }
        );

        // Assign ranks
        const rankedList = sortedList.map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));

        callback(rankedList.slice(0, 10)); // Top 10
      },
      (error) => {
        console.warn("[RiddleActivityAdapter] Leaderboard subscription error:", error);
      }
    );
  },

  /**
   * Host Transition 1: READY -> RUNNING (Start Riddle Question Timer)
   */
  async startRiddleQuestion(
    eventId: string,
    expectedSequenceNumber: number,
    durationSeconds: number
  ): Promise<void> {
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    const now = Date.now();
    await setDoc(
      sessionRef,
      {
        stage: "running",
        stageSequenceNumber: expectedSequenceNumber + 1,
        stageStartedAt: now,
        durationSeconds: durationSeconds > 0 ? durationSeconds : 20,
        isFrozen: false,
        isRevealed: false,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },

  /**
   * Host Transition 2: RUNNING -> FROZEN (Lock Submissions)
   */
  async freezeRiddleQuestion(
    eventId: string,
    expectedSequenceNumber: number
  ): Promise<void> {
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    await setDoc(
      sessionRef,
      {
        stage: "frozen",
        isFrozen: true,
        stageSequenceNumber: expectedSequenceNumber + 1,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },

  /**
   * Host Transition 3: FROZEN or RUNNING -> REVEAL (Show Correct Solution)
   */
  async revealRiddleQuestion(
    eventId: string,
    expectedSequenceNumber: number
  ): Promise<void> {
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    await setDoc(
      sessionRef,
      {
        stage: "reveal",
        isRevealed: true,
        isFrozen: true,
        stageSequenceNumber: expectedSequenceNumber + 1,
        stageStartedAt: Date.now(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },

  /**
   * Host Transition 4: REVEAL or FROZEN -> LEADERBOARD (Show Standings)
   */
  async showRiddleLeaderboard(
    eventId: string,
    expectedSequenceNumber: number
  ): Promise<void> {
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    await setDoc(
      sessionRef,
      {
        stage: "leaderboard",
        stageSequenceNumber: expectedSequenceNumber + 1,
        stageStartedAt: Date.now(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },

  /**
   * Host Transition 5: Advance to Next Riddle Question in Sequence
   */
  async advanceToNextRiddle(
    eventId: string,
    expectedSequenceNumber: number,
    nextStepIndex: number,
    stepDurationSeconds: number
  ): Promise<void> {
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    const now = Date.now();
    await setDoc(
      sessionRef,
      {
        stepIndex: nextStepIndex,
        stage: "running",
        stageSequenceNumber: expectedSequenceNumber + 1,
        stageStartedAt: now,
        durationSeconds: stepDurationSeconds > 0 ? stepDurationSeconds : 20,
        isFrozen: false,
        isRevealed: false,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },
};
