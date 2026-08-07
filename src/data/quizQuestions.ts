export interface QuizQuestion {
  id: number;
  text: string;
  options: string[];
  correctOptionIndex: number; // 0-based
  explanation: string;
}

export const DEMO_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    text: "Which data structure follows FIFO (First In First Out)?",
    options: ["Stack", "Queue", "Tree", "Graph"],
    correctOptionIndex: 1, // B. Queue
    explanation: "Queue follows the FIFO (First In First Out) principle, where elements added first are removed first.",
  },
  {
    id: 2,
    text: "Which language is primarily used for Android app development today?",
    options: ["Python", "C", "Kotlin", "PHP"],
    correctOptionIndex: 2, // C. Kotlin
    explanation: "Kotlin is Google's official, modern programming language recommended for native Android development.",
  },
  {
    id: 3,
    text: "Which protocol is mainly used to securely browse websites?",
    options: ["HTTP", "FTP", "SMTP", "HTTPS"],
    correctOptionIndex: 3, // D. HTTPS
    explanation: "HTTPS uses SSL/TLS encryption to securely communicate and browse websites over encrypted HTTP connections.",
  },
  {
    id: 4,
    text: "Which device is considered the brain of a computer?",
    options: ["RAM", "SSD", "GPU", "CPU"],
    correctOptionIndex: 3, // D. CPU
    explanation: "The Central Processing Unit (CPU) executes instructions and acts as the primary decision maker in a computer.",
  },
  {
    id: 5,
    text: "Which of these is a NoSQL database?",
    options: ["MySQL", "PostgreSQL", "MongoDB", "Oracle Database"],
    correctOptionIndex: 2, // C. MongoDB
    explanation: "MongoDB is a document-oriented NoSQL database that stores unstructured or semi-structured data as JSON-like documents.",
  },
];

export interface QuizSessionData {
  status: "idle" | "running" | "ended";
  stage: "question" | "answer_reveal" | "leaderboard" | "completed";
  currentQuestionIndex: number;
  currentQuestion: QuizQuestion | null;
  startedAt: number;
  questionStartTime: number;
  timerDuration: number; // 30 seconds
  isRunning: boolean;
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
