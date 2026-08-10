import { doc, setDoc, updateDoc, Firestore } from "firebase/firestore";
import { DEMO_QUIZ_QUESTIONS } from "../src/data/quizQuestions.js";

function cleanPayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export interface SessionDriverOptions {
  questionDurationSec?: number;
  revealDurationSec?: number;
  leaderboardDurationSec?: number;
}

export class QuizSessionDriver {
  private db: Firestore;
  private eventId: string;
  private questionDurationSec: number;
  private revealDurationSec: number;
  private leaderboardDurationSec: number;
  private running: boolean = false;

  constructor(db: Firestore, eventId: string, options: SessionDriverOptions | number = {}) {
    this.db = db;
    this.eventId = eventId;
    if (typeof options === "number") {
      this.questionDurationSec = options;
      this.revealDurationSec = 3;
      this.leaderboardDurationSec = 3;
    } else {
      this.questionDurationSec = options.questionDurationSec || 12;
      this.revealDurationSec = options.revealDurationSec || 3;
      this.leaderboardDurationSec = options.leaderboardDurationSec || 3;
    }
  }

  public async driveSession(): Promise<void> {
    this.running = true;
    const sessionRef = doc(this.db, "events", this.eventId, "activities", "quiz", "session", "current");
    const sessionStartedAt = Date.now();

    console.log(`\n🏎️ [SessionDriver] Starting automated 5-question Quiz lifecycle for event: ${this.eventId}`);
    console.log(`   [Config] Question Duration: ${this.questionDurationSec}s | Reveal: ${this.revealDurationSec}s | Leaderboard: ${this.leaderboardDurationSec}s`);

    for (let qIndex = 0; qIndex < DEMO_QUIZ_QUESTIONS.length; qIndex++) {
      if (!this.running) break;

      const question = DEMO_QUIZ_QUESTIONS[qIndex];
      const now = Date.now();

      // 1. STAGE: question
      console.log(`\n▶️ [SessionDriver] Question ${qIndex + 1}/5 ("${question.text.substring(0, 30)}...")`);
      const payload = cleanPayload({
        status: "running",
        stage: "question",
        currentQuestionIndex: qIndex,
        currentQuestion: question,
        startedAt: sessionStartedAt,
        questionStartTime: now,
        timerDuration: this.questionDurationSec,
        isRunning: true,
        fastestResponse: null,
        updatedAt: now
      });

      await setDoc(sessionRef, payload, { merge: true });

      // Wait for question duration
      await this.sleep(this.questionDurationSec * 1000);

      if (!this.running) break;

      // 2. STAGE: answer_reveal
      console.log(`📊 [SessionDriver] Question ${qIndex + 1}/5 -> Stage: answer_reveal`);
      await updateDoc(sessionRef, cleanPayload({
        stage: "answer_reveal",
        updatedAt: Date.now()
      }));

      await this.sleep(this.revealDurationSec * 1000);

      if (!this.running) break;

      // 3. STAGE: leaderboard
      console.log(`🏆 [SessionDriver] Question ${qIndex + 1}/5 -> Stage: leaderboard`);
      await updateDoc(sessionRef, cleanPayload({
        stage: "leaderboard",
        updatedAt: Date.now()
      }));

      await this.sleep(this.leaderboardDurationSec * 1000);
    }

    if (this.running) {
      // Final STAGE: completed
      console.log(`\n🏁 [SessionDriver] Quiz completed. Updating session to 'completed'.`);
      await updateDoc(sessionRef, cleanPayload({
        status: "completed",
        stage: "completed",
        isRunning: false,
        updatedAt: Date.now()
      }));
    }
  }

  public stop(): void {
    this.running = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

