/**
 * ZERO2ONE EVENTS — FEATURE 5C
 * CUSTOM EVENT QUIZ LIVE INTEGRATION ADAPTER
 *
 * Implements authoritative quiz question fetching, participant answer submission,
 * real-time response aggregation, and drift-free leaderboard calculation.
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
import { GenericQuizQuestion } from "./quizBuilderService";

export interface SanitizedQuizQuestion {
  id: string;
  questionId: string;
  activityId: string;
  eventId: string;
  order: number;
  text: string;
  options: [string, string, string, string] | string[];
  timeLimitSec: number;
  points: number;
  // Security guard: correctOptionIndex and explanation are ONLY present if revealed
  correctOptionIndex?: number;
  explanation?: string;
}

export interface QuizSubmission {
  id: string;
  submissionId: string;
  activityId: string;
  eventId: string;
  questionId: string;
  stepIndex: number;
  participantId: string;
  participantName: string;
  participantCollege?: string;
  participantDepartment?: string;
  selectedOptionIndex: number;
  isCorrect: boolean;
  pointsEarned: number;
  timeTakenSec: number;
  submittedAt: any;
}

export interface QuizQuestionStats {
  questionId: string;
  totalSubmissions: number;
  optionCounts: [number, number, number, number]; // Counts for A, B, C, D
  correctCount: number;
}

export interface QuizLeaderboardEntry {
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

export const QuizActivityAdapter = {
  /**
   * Fetch all questions for a specific quiz activity ordered strictly by `order ASC`.
   * Point-in-time read (no unbounded listeners).
   */
  async fetchQuizQuestions(
    eventId: string,
    activityId: string
  ): Promise<GenericQuizQuestion[]> {
    if (!eventId || !activityId) return [];

    const questionsColRef = collection(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "questions"
    );

    const snapshot = await getDocs(questionsColRef);
    const questions: GenericQuizQuestion[] = [];

    snapshot.forEach((docSnap) => {
      const qData = docSnap.data();
      if (qData) {
        const opts = Array.isArray(qData.options) ? qData.options : ["", "", "", ""];
        while (opts.length < 4) opts.push("");

        questions.push({
          id: docSnap.id,
          questionId: qData.questionId || docSnap.id,
          activityId: qData.activityId || activityId,
          eventId: qData.eventId || eventId,
          order: typeof qData.order === "number" ? qData.order : questions.length + 1,
          text: qData.text || "",
          options: [opts[0] || "", opts[1] || "", opts[2] || "", opts[3] || ""],
          correctOptionIndex:
            typeof qData.correctOptionIndex === "number" ? qData.correctOptionIndex : 0,
          timeLimitSec: typeof qData.timeLimitSec === "number" ? qData.timeLimitSec : 15,
          points: typeof qData.points === "number" ? qData.points : 100,
          explanation: qData.explanation || "",
          createdAt: qData.createdAt,
          updatedAt: qData.updatedAt,
        });
      }
    });

    // Sort strictly by order ASC
    questions.sort((a, b) => a.order - b.order);
    return questions;
  },

  /**
   * Sanitize question for participants to prevent client-side answer inspection
   * before the authoritative reveal stage.
   */
  sanitizeQuestion(
    question: GenericQuizQuestion,
    isRevealed: boolean
  ): SanitizedQuizQuestion {
    return {
      id: question.id,
      questionId: question.questionId,
      activityId: question.activityId,
      eventId: question.eventId,
      order: question.order,
      text: question.text,
      options: question.options,
      timeLimitSec: question.timeLimitSec,
      points: question.points,
      // Only attach answer key when host officially reveals
      ...(isRevealed && {
        correctOptionIndex: question.correctOptionIndex,
        explanation: question.explanation,
      }),
    };
  },

  /**
   * Submit an answer for the active question.
   * Atomically computes score and speed bonus.
   */
  async submitAnswer(
    eventId: string,
    activityId: string,
    question: GenericQuizQuestion,
    participant: {
      id: string;
      name: string;
      college?: string;
      department?: string;
    },
    selectedOptionIndex: number,
    timeTakenSec: number
  ): Promise<{ isCorrect: boolean; pointsEarned: number }> {
    if (!eventId || !activityId || !question || !participant.id) {
      throw new Error("Missing required parameters to submit quiz answer.");
    }

    const isCorrect = selectedOptionIndex === question.correctOptionIndex;
    let pointsEarned = 0;

    if (isCorrect) {
      const basePoints = question.points || 100;
      // Calculate speed bonus: up to 20% bonus for answering quickly within the time limit
      const timeRatio = Math.max(
        0,
        Math.min(1, (question.timeLimitSec - timeTakenSec) / Math.max(1, question.timeLimitSec))
      );
      const speedBonus = Math.round(timeRatio * (basePoints * 0.2));
      pointsEarned = basePoints + speedBonus;
    }

    const submissionDocId = `${participant.id}_${question.id}`;
    const submissionRef = doc(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "submissions",
      submissionDocId
    );

    const submissionPayload: QuizSubmission = {
      id: submissionDocId,
      submissionId: submissionDocId,
      activityId,
      eventId,
      questionId: question.id,
      stepIndex: question.order - 1,
      participantId: participant.id,
      participantName: participant.name,
      participantCollege: participant.college || "",
      participantDepartment: participant.department || "",
      selectedOptionIndex,
      isCorrect,
      pointsEarned,
      timeTakenSec: Math.max(0, Math.round(timeTakenSec * 10) / 10),
      submittedAt: serverTimestamp(),
    };

    await setDoc(submissionRef, submissionPayload, { merge: true });

    // Cache locally
    try {
      localStorage.setItem(`z2o_quiz_${eventId}_${question.id}_${participant.id}`, "true");
    } catch (e) {
      console.warn("Could not cache submission state:", e);
    }

    return { isCorrect, pointsEarned };
  },

  /**
   * Subscribe to real-time submissions for the active question (Host radar).
   */
  subscribeQuestionStats(
    eventId: string,
    activityId: string,
    questionId: string,
    callback: (stats: QuizQuestionStats) => void
  ): Unsubscribe {
    if (!eventId || !activityId || !questionId) {
      callback({
        questionId: "",
        totalSubmissions: 0,
        optionCounts: [0, 0, 0, 0],
        correctCount: 0,
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
    const qQuery = query(submissionsColRef, where("questionId", "==", questionId));

    return onSnapshot(
      qQuery,
      (snapshot) => {
        const counts: [number, number, number, number] = [0, 0, 0, 0];
        let correctCount = 0;
        let total = 0;

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as QuizSubmission;
          if (data) {
            total++;
            if (typeof data.selectedOptionIndex === "number" && data.selectedOptionIndex >= 0 && data.selectedOptionIndex <= 3) {
              counts[data.selectedOptionIndex]++;
            }
            if (data.isCorrect) {
              correctCount++;
            }
          }
        });

        callback({
          questionId,
          totalSubmissions: total,
          optionCounts: counts,
          correctCount,
        });
      },
      (error) => {
        console.warn("[QuizActivityAdapter] Submissions subscription error:", error);
      }
    );
  },

  /**
   * Subscribe to real-time aggregated leaderboard for this quiz activity.
   */
  subscribeQuizLeaderboard(
    eventId: string,
    activityId: string,
    callback: (leaderboard: QuizLeaderboardEntry[]) => void
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
        const participantMap = new Map<string, QuizLeaderboardEntry>();

        snapshot.forEach((docSnap) => {
          const sub = docSnap.data() as QuizSubmission;
          if (!sub || !sub.participantId) return;

          const existing = participantMap.get(sub.participantId) || {
            participantId: sub.participantId,
            name: sub.participantName || "Anonymous Participant",
            college: sub.participantCollege || "",
            department: sub.participantDepartment || "",
            totalScore: 0,
            correctAnswersCount: 0,
            totalAnswered: 0,
            lastSubmittedAt: 0,
          };

          existing.totalScore += sub.pointsEarned || 0;
          existing.totalAnswered += 1;
          if (sub.isCorrect) {
            existing.correctAnswersCount += 1;
          }

          participantMap.set(sub.participantId, existing);
        });

        // Convert to array and sort: totalScore DESC, then correctAnswers DESC
        const leaderboard = Array.from(participantMap.values()).sort((a, b) => {
          if (b.totalScore !== a.totalScore) {
            return b.totalScore - a.totalScore;
          }
          return b.correctAnswersCount - a.correctAnswersCount;
        });

        // Assign ranks
        leaderboard.forEach((entry, idx) => {
          entry.rank = idx + 1;
        });

        callback(leaderboard);
      },
      (error) => {
        console.warn("[QuizActivityAdapter] Leaderboard subscription error:", error);
        callback([]);
      }
    );
  },
};
