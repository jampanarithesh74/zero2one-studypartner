export interface QuizQuestion {
  id: number;
  text: string;
  options: string[];
  correctOptionIndex: number; // 0-based
}

export const DEMO_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    text: "Which data structure follows FIFO (First In First Out)?",
    options: ["Stack", "Queue", "Tree", "Graph"],
    correctOptionIndex: 1, // B. Queue
  },
  {
    id: 2,
    text: "Which language is primarily used for Android app development today?",
    options: ["Python", "C", "Kotlin", "PHP"],
    correctOptionIndex: 2, // C. Kotlin
  },
  {
    id: 3,
    text: "Which protocol is mainly used to securely browse websites?",
    options: ["HTTP", "FTP", "SMTP", "HTTPS"],
    correctOptionIndex: 3, // D. HTTPS
  },
  {
    id: 4,
    text: "Which device is considered the brain of a computer?",
    options: ["RAM", "SSD", "GPU", "CPU"],
    correctOptionIndex: 3, // D. CPU
  },
  {
    id: 5,
    text: "Which of these is a NoSQL database?",
    options: ["MySQL", "PostgreSQL", "MongoDB", "Oracle Database"],
    correctOptionIndex: 2, // C. MongoDB
  },
];

export interface QuizSessionData {
  status: "idle" | "running" | "ended";
  currentQuestionIndex: number;
  currentQuestion: QuizQuestion | null;
  startedAt: number;
  questionStartTime: number;
  timerDuration: number; // 30 seconds
  isRunning: boolean;
  isTransitioning?: boolean; // For 3-2-1 transition
  transitionCount?: number;
}
