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

export interface GenericQuizQuestion {
  id: string; // Question ID (e.g. q_1719284729_a8f9d)
  questionId: string;
  activityId: string;
  eventId: string;
  order: number; // 1-based ordering
  text: string;
  options: [string, string, string, string] | string[]; // exactly 4 options: A, B, C, D
  correctOptionIndex: number; // 0 for A, 1 for B, 2 for C, 3 for D
  timeLimitSec: number; // in seconds (e.g. 15)
  points: number; // e.g. 100
  explanation?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface QuizBuilderData {
  activity: EventActivity;
  questions: GenericQuizQuestion[];
}

/**
 * Generate a collision-resistant stable question ID
 */
export function generateQuestionId(): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `q_${timestamp}_${rand}`;
}

/**
 * Create a blank template question
 */
export function createBlankQuestion(
  eventId: string,
  activityId: string,
  order: number
): GenericQuizQuestion {
  const qId = generateQuestionId();
  return {
    id: qId,
    questionId: qId,
    activityId,
    eventId,
    order,
    text: "",
    options: ["", "", "", ""],
    correctOptionIndex: 0,
    timeLimitSec: 15,
    points: 100,
    explanation: "",
  };
}

/**
 * Fetch Quiz Activity metadata and all its Questions in one point-in-time read.
 * 0 realtime listeners.
 */
export async function getQuizBuilderData(
  eventId: string,
  activityId: string
): Promise<QuizBuilderData | null> {
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
    type: actData.type || "quiz",
    title: actData.title || "Interactive Quiz",
    description: actData.description || "",
    order: typeof actData.order === "number" ? actData.order : 1,
    status: actData.status || "draft",
    config: actData.config || {},
    createdAt: actData.createdAt,
    updatedAt: actData.updatedAt,
  };

  // 2. Fetch Questions Subcollection
  const questionsColRef = collection(
    db,
    "events",
    eventId,
    "activities",
    activityId,
    "questions"
  );
  const questionsSnap = await getDocs(questionsColRef);

  const questions: GenericQuizQuestion[] = [];
  questionsSnap.forEach((docSnap) => {
    const qData = docSnap.data();
    if (qData) {
      const opts = Array.isArray(qData.options) ? qData.options : ["", "", "", ""];
      while (opts.length < 4) opts.push("");
      const options4: [string, string, string, string] = [
        opts[0] || "",
        opts[1] || "",
        opts[2] || "",
        opts[3] || "",
      ];

      questions.push({
        id: docSnap.id,
        questionId: qData.questionId || docSnap.id,
        activityId: qData.activityId || activityId,
        eventId: qData.eventId || eventId,
        order: typeof qData.order === "number" ? qData.order : questions.length + 1,
        text: qData.text || "",
        options: options4,
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

  return {
    activity,
    questions,
  };
}

/**
 * Validate a question before saving
 */
export interface QuestionValidationError {
  questionIndex: number;
  questionNumber: number;
  errors: string[];
}

export function validateQuizQuestions(questions: GenericQuizQuestion[]): QuestionValidationError[] {
  const validationErrors: QuestionValidationError[] = [];

  questions.forEach((q, idx) => {
    const errors: string[] = [];
    const qNum = idx + 1;

    if (!q.text || !q.text.trim()) {
      errors.push("Question text cannot be empty.");
    }

    if (!q.options || q.options.length < 4) {
      errors.push("All 4 answer options (A, B, C, D) are required.");
    } else {
      q.options.forEach((opt, oIdx) => {
        const optLetter = String.fromCharCode(65 + oIdx);
        if (!opt || !opt.trim()) {
          errors.push(`Option ${optLetter} cannot be empty.`);
        }
      });
    }

    if (
      typeof q.correctOptionIndex !== "number" ||
      q.correctOptionIndex < 0 ||
      q.correctOptionIndex > 3
    ) {
      errors.push("A valid correct answer (A, B, C, or D) must be selected.");
    }

    if (typeof q.timeLimitSec !== "number" || q.timeLimitSec < 5 || q.timeLimitSec > 300) {
      errors.push("Time limit must be between 5 and 300 seconds.");
    }

    if (typeof q.points !== "number" || q.points < 10 || q.points > 1000) {
      errors.push("Points must be between 10 and 1000.");
    }

    if (errors.length > 0) {
      validationErrors.push({
        questionIndex: idx,
        questionNumber: qNum,
        errors,
      });
    }
  });

  return validationErrors;
}

/**
 * Save entire Quiz Configuration atomically via Firestore writeBatch.
 * 
 * Performs:
 * 1. Activity doc update: title, description, status, config (questionCount, totalPoints, etc.), updatedAt.
 * 2. Question docs batch write: sets each question document in events/{eventId}/activities/{activityId}/questions/{questionId}.
 * 3. Deleted questions removal: batch deletes any question document that was removed.
 */
export async function saveQuizConfiguration(
  eventId: string,
  activityId: string,
  activityMeta: {
    title: string;
    description: string;
    status: "draft" | "ready";
  },
  questions: GenericQuizQuestion[],
  deletedQuestionIds: string[] = []
): Promise<void> {
  if (!eventId || !activityId) {
    throw new Error("Event ID and Activity ID are required to save quiz.");
  }

  // Calculate config stats
  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
  const totalTimeSec = questions.reduce((sum, q) => sum + (q.timeLimitSec || 0), 0);

  const batch = writeBatch(db);

  // 1. Update Activity metadata
  const activityDocRef = doc(db, "events", eventId, "activities", activityId);
  batch.update(activityDocRef, {
    title: activityMeta.title.trim(),
    description: activityMeta.description.trim(),
    status: activityMeta.status,
    config: {
      questionCount: questions.length,
      totalPoints,
      totalTimeSec,
      lastConfiguredAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  });

  // 2. Set/Update each Question document
  questions.forEach((q, index) => {
    const qOrder = index + 1;
    const qDocRef = doc(
      db,
      "events",
      eventId,
      "activities",
      activityId,
      "questions",
      q.id
    );

    const questionPayload: Record<string, any> = {
      id: q.id,
      questionId: q.id,
      activityId,
      eventId,
      order: qOrder,
      text: q.text.trim(),
      options: [
        (q.options[0] || "").trim(),
        (q.options[1] || "").trim(),
        (q.options[2] || "").trim(),
        (q.options[3] || "").trim(),
      ],
      correctOptionIndex: q.correctOptionIndex,
      timeLimitSec: q.timeLimitSec || 15,
      points: q.points || 100,
      explanation: (q.explanation || "").trim(),
      updatedAt: serverTimestamp(),
    };

    batch.set(qDocRef, questionPayload, { merge: true });
  });

  // 3. Delete removed questions
  deletedQuestionIds.forEach((delId) => {
    if (delId) {
      const delDocRef = doc(
        db,
        "events",
        eventId,
        "activities",
        activityId,
        "questions",
        delId
      );
      batch.delete(delDocRef);
    }
  });

  // Commit all writes atomically in a single network round-trip
  await batch.commit();
}
