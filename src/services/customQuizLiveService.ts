/**
 * ZERO2ONE EVENTS — CUSTOM EVENT QUIZ LIVE SERVICE
 * Feature 5C: Custom Event Quiz Live Orchestration & Response Engine
 *
 * Isolated service for Custom Event Quiz activities.
 * Handles question fetching, host transitions, atomic answer submissions,
 * answer key protection, drift-free timing, and real-time custom leaderboard.
 */

import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { GenericQuizQuestion } from "./quizBuilderService";
import { CanonicalLiveSession } from "../types/liveEventEngine";

export interface CustomQuizAnswerRecord {
  selectedOptionIndex: number;
  isCorrect: boolean;
  pointsAwarded: number;
  timeTakenSec: number;
  submittedAt: number;
}

export interface CustomQuizParticipantResponse {
  participantId: string;
  participantName: string;
  participantPhoto?: string;
  activityId: string;
  eventId: string;
  answers: Record<string, CustomQuizAnswerRecord>;
  totalScore: number;
  totalCorrect: number;
  lastSubmittedAt: number;
  updatedAt?: any;
}

export interface CustomQuizLeaderboardEntry {
  participantId: string;
  participantName: string;
  participantPhoto?: string;
  score: number;
  correctCount: number;
  lastAnswerAt: number;
  rank?: number;
}

export const CustomQuizLiveService = {
  /**
   * Fetch all questions for a specific custom quiz activity.
   * Reads from `events/{eventId}/activities/{activityId}/questions` ordered by `order ASC`.
   * Performed ONCE per Quiz activity.
   */
  async getQuizQuestions(
    eventId: string,
    activityId: string
  ): Promise<GenericQuizQuestion[]> {
    if (!eventId || !activityId) return [];

    const questionsCol = collection(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "questions"
    );

    const snap = await getDocs(questionsCol);
    const list: GenericQuizQuestion[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const opts = Array.isArray(data.options) ? data.options : ["", "", "", ""];
      while (opts.length < 4) opts.push("");

      list.push({
        id: docSnap.id,
        questionId: data.questionId || docSnap.id,
        activityId: data.activityId || activityId,
        eventId: data.eventId || eventId,
        order: typeof data.order === "number" ? data.order : list.length + 1,
        text: data.text || "",
        options: [opts[0] || "", opts[1] || "", opts[2] || "", opts[3] || ""],
        correctOptionIndex:
          typeof data.correctOptionIndex === "number" ? data.correctOptionIndex : 0,
        timeLimitSec: typeof data.timeLimitSec === "number" ? data.timeLimitSec : 15,
        points: typeof data.points === "number" ? data.points : 100,
        explanation: data.explanation || "",
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });

    // Deterministic sorting strictly by order ASC
    list.sort((a, b) => a.order - b.order);
    return list;
  },

  /**
   * Question Transition 1: READY -> RUNNING (Start Question Timer)
   * Authoritative start timestamp is written once. Zero timer polling writes.
   */
  async startQuizQuestion(
    eventId: string,
    expectedSequenceNumber: number,
    durationSeconds: number
  ): Promise<void> {
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(sessionRef);
      if (!snap.exists()) {
        throw new Error("Live session not initialized.");
      }

      const current = snap.data() as CanonicalLiveSession;

      if (current.stageSequenceNumber !== expectedSequenceNumber) {
        throw new Error("Action conflict: Stale live session state. Please retry.");
      }

      if (current.stage !== "ready") {
        throw new Error(`Cannot start question from stage "${current.stage}". Expected "ready".`);
      }

      const now = Date.now();

      transaction.update(sessionRef, {
        stage: "running",
        stageSequenceNumber: current.stageSequenceNumber + 1,
        stageStartedAt: now,
        durationSeconds: durationSeconds > 0 ? durationSeconds : 15,
        isFrozen: false,
        isRevealed: false,
        updatedAt: serverTimestamp(),
      });
    });
  },

  /**
   * Question Transition 2: RUNNING -> FROZEN (Lock Submissions)
   */
  async freezeQuizQuestion(
    eventId: string,
    expectedSequenceNumber: number
  ): Promise<void> {
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(sessionRef);
      if (!snap.exists()) {
        throw new Error("Live session not found.");
      }

      const current = snap.data() as CanonicalLiveSession;

      if (current.stageSequenceNumber !== expectedSequenceNumber) {
        throw new Error("Action conflict: Stale live session state. Please retry.");
      }

      if (current.stage !== "running") {
        throw new Error(`Cannot freeze question when stage is "${current.stage}". Expected "running".`);
      }

      transaction.update(sessionRef, {
        stage: "frozen",
        isFrozen: true,
        stageSequenceNumber: current.stageSequenceNumber + 1,
        updatedAt: serverTimestamp(),
      });
    });
  },

  /**
   * Question Transition 3: FROZEN or RUNNING -> REVEAL (Show Correct Solution)
   */
  async revealQuizQuestion(
    eventId: string,
    expectedSequenceNumber: number
  ): Promise<void> {
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(sessionRef);
      if (!snap.exists()) {
        throw new Error("Live session not found.");
      }

      const current = snap.data() as CanonicalLiveSession;

      if (current.stageSequenceNumber !== expectedSequenceNumber) {
        throw new Error("Action conflict: Stale live session state. Please retry.");
      }

      if (current.stage !== "frozen" && current.stage !== "running") {
        throw new Error(`Cannot reveal solutions when stage is "${current.stage}". Expected "frozen" or "running".`);
      }

      transaction.update(sessionRef, {
        stage: "reveal",
        isRevealed: true,
        isFrozen: true,
        stageSequenceNumber: current.stageSequenceNumber + 1,
        stageStartedAt: Date.now(),
        updatedAt: serverTimestamp(),
      });
    });
  },

  /**
   * Question Transition 4: REVEAL or FROZEN -> LEADERBOARD (Show Standings)
   */
  async showQuizLeaderboard(
    eventId: string,
    expectedSequenceNumber: number
  ): Promise<void> {
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(sessionRef);
      if (!snap.exists()) {
        throw new Error("Live session not found.");
      }

      const current = snap.data() as CanonicalLiveSession;

      if (current.stageSequenceNumber !== expectedSequenceNumber) {
        throw new Error("Action conflict: Stale live session state. Please retry.");
      }

      if (current.stage !== "reveal" && current.stage !== "frozen") {
        throw new Error(`Cannot display leaderboard when stage is "${current.stage}". Expected "reveal".`);
      }

      transaction.update(sessionRef, {
        stage: "leaderboard",
        stageSequenceNumber: current.stageSequenceNumber + 1,
        stageStartedAt: Date.now(),
        updatedAt: serverTimestamp(),
      });
    });
  },

  /**
   * Question Transition 5: LEADERBOARD -> NEXT QUESTION (stage: READY)
   * Increments `stepIndex` (e.g. Question 1 -> Question 2).
   * Note: `currentActivityId` remains unchanged.
   */
  async advanceToNextQuizQuestion(
    eventId: string,
    expectedSequenceNumber: number,
    nextQuestionIndex: number,
    nextQuestionDuration: number
  ): Promise<void> {
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(sessionRef);
      if (!snap.exists()) {
        throw new Error("Live session not found.");
      }

      const current = snap.data() as CanonicalLiveSession;

      if (current.stageSequenceNumber !== expectedSequenceNumber) {
        throw new Error("Action conflict: Stale live session state. Please retry.");
      }

      if (current.stage !== "leaderboard") {
        throw new Error(`Cannot advance to next question from stage "${current.stage}". Expected "leaderboard".`);
      }

      transaction.update(sessionRef, {
        stepIndex: nextQuestionIndex,
        stage: "ready",
        stageSequenceNumber: current.stageSequenceNumber + 1,
        stageStartedAt: null,
        durationSeconds: nextQuestionDuration > 0 ? nextQuestionDuration : 15,
        isFrozen: false,
        isRevealed: false,
        updatedAt: serverTimestamp(),
      });
    });
  },

  /**
   * Participant Answer Submission
   * Writes to `events/{eventId}/activities/{activityId}/responses/{participantId}`
   * And updates `events/{eventId}/activities/{activityId}/leaderboard/{participantId}`
   * 
   * Atomically prevents duplicate answers for the same question.
   */
  async submitQuizAnswer(params: {
    eventId: string;
    activityId: string;
    participantId: string;
    participantName: string;
    participantPhoto?: string;
    questionId: string;
    selectedOptionIndex: number;
    question: GenericQuizQuestion;
    timeTakenSec: number;
  }): Promise<{ success: boolean; isCorrect: boolean; pointsAwarded: number; alreadyAnswered: boolean }> {
    const {
      eventId,
      activityId,
      participantId,
      participantName,
      participantPhoto = "",
      questionId,
      selectedOptionIndex,
      question,
      timeTakenSec,
    } = params;

    if (!eventId || !activityId || !participantId || !questionId) {
      throw new Error("Missing required submission parameters");
    }

    const responseDocRef = doc(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "responses",
      participantId
    );

    const leaderboardDocRef = doc(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "leaderboard",
      participantId
    );

    let isCorrect = selectedOptionIndex === question.correctOptionIndex;
    let pointsAwarded = isCorrect ? (question.points || 100) : 0;
    let alreadyAnswered = false;

    await runTransaction(db, async (transaction) => {
      const respSnap = await transaction.get(responseDocRef);

      let currentAnswers: Record<string, CustomQuizAnswerRecord> = {};
      let totalScore = 0;
      let totalCorrect = 0;

      if (respSnap.exists()) {
        const respData = respSnap.data() as CustomQuizParticipantResponse;
        currentAnswers = respData.answers || {};
        totalScore = respData.totalScore || 0;
        totalCorrect = respData.totalCorrect || 0;

        // Idempotency: If participant already submitted an answer for this questionId, DO NOT overwrite or recalculate!
        if (currentAnswers[questionId]) {
          alreadyAnswered = true;
          isCorrect = currentAnswers[questionId].isCorrect;
          pointsAwarded = currentAnswers[questionId].pointsAwarded;
          return;
        }
      }

      const now = Date.now();
      const answerRecord: CustomQuizAnswerRecord = {
        selectedOptionIndex,
        isCorrect,
        pointsAwarded,
        timeTakenSec,
        submittedAt: now,
      };

      currentAnswers[questionId] = answerRecord;
      const newTotalScore = totalScore + pointsAwarded;
      const newTotalCorrect = totalCorrect + (isCorrect ? 1 : 0);

      // Write Participant Response Document
      transaction.set(
        responseDocRef,
        {
          participantId,
          participantName,
          participantPhoto,
          activityId,
          eventId,
          answers: currentAnswers,
          totalScore: newTotalScore,
          totalCorrect: newTotalCorrect,
          lastSubmittedAt: now,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Write Participant Leaderboard Document
      transaction.set(
        leaderboardDocRef,
        {
          participantId,
          participantName,
          participantPhoto,
          score: newTotalScore,
          correctCount: newTotalCorrect,
          lastAnswerAt: now,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    return { success: true, isCorrect, pointsAwarded, alreadyAnswered };
  },

  /**
   * Subscribe to single participant's quiz response record.
   * Path: `events/{eventId}/activities/{activityId}/responses/{participantId}`
   * Cost: Exactly 1 document listener per participant.
   */
  subscribeParticipantResponse(
    eventId: string,
    activityId: string,
    participantId: string,
    callback: (response: CustomQuizParticipantResponse | null) => void
  ): Unsubscribe {
    if (!eventId || !activityId || !participantId) {
      callback(null);
      return () => {};
    }

    const docRef = doc(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "responses",
      participantId
    );

    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data() as CustomQuizParticipantResponse);
        } else {
          callback(null);
        }
      },
      (err) => {
        console.warn("[CustomQuizLiveService] Participant response listener warning:", err);
        callback(null);
      }
    );
  },

  /**
   * Subscribe to the Top N Leaderboard for this Quiz Activity.
   * Path: `events/{eventId}/activities/{activityId}/leaderboard`
   * Cost: Reads only top N documents when leaderboard changes.
   */
  subscribeQuizLeaderboard(
    eventId: string,
    activityId: string,
    limitCount: number = 10,
    callback: (entries: CustomQuizLeaderboardEntry[]) => void
  ): Unsubscribe {
    if (!eventId || !activityId) {
      callback([]);
      return () => {};
    }

    const lbCol = collection(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "leaderboard"
    );

    const q = query(lbCol, orderBy("score", "desc"), limit(limitCount));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: CustomQuizLeaderboardEntry[] = [];
        let rank = 1;
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            participantId: docSnap.id,
            participantName: data.participantName || "Anonymous Participant",
            participantPhoto: data.participantPhoto || "",
            score: typeof data.score === "number" ? data.score : 0,
            correctCount: typeof data.correctCount === "number" ? data.correctCount : 0,
            lastAnswerAt: typeof data.lastAnswerAt === "number" ? data.lastAnswerAt : 0,
            rank: rank++,
          });
        });
        callback(list);
      },
      (err) => {
        console.warn("[CustomQuizLiveService] Quiz leaderboard listener warning:", err);
        callback([]);
      }
    );
  },
};
