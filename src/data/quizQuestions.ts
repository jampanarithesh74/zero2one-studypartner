import { ENGINEERING_FAILURE_QUIZ_QUESTIONS } from "./engineeringFailureData";

export interface QuizQuestion {
  id: number;
  text: string;
  options: string[];
  correctOptionIndex: number; // 0-based
  explanation: string;
}

export const DEMO_QUIZ_QUESTIONS: QuizQuestion[] = ENGINEERING_FAILURE_QUIZ_QUESTIONS;

export interface QuizSessionData {
  status: "idle" | "running" | "ended";
  stage: "question" | "answer_reveal" | "leaderboard" | "completed";
  currentQuestionIndex: number;
  currentQuestion: QuizQuestion | null;
  startedAt: number;
  questionStartTime: number;
  timerDuration: number; // 30 seconds
  isRunning: boolean;
  totalQuestions?: number;
  activityType?: "quiz" | "crossword" | "riddles";
  activityId?: string;
  fastestResponse?: {
    participantId: string;
    participantName: string;
    responseTimeSec: number;
    speedBonus: number;
  } | null;
}

export interface QuizLeaderboardEntry {
  participantId: string;
  name: string;
  photo?: string;
  currentScore: number;
  questionsAnswered: number;
  correctAnswers: number;
  lastAnswerTime?: number;
  rank?: number;
}

