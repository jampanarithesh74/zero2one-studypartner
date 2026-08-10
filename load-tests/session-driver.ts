import { doc, setDoc, updateDoc, Firestore } from "firebase/firestore";
import { DEMO_QUIZ_QUESTIONS } from "../src/data/quizQuestions.js";

export class QuizSessionDriver {
  private db: Firestore;
  private eventId: string;
  private questionDurationSec: number;
  private running: boolean = false;

  constructor(db: Firestore, eventId: string, questionDurationSec: number = 6) {
    this.db = db;
    this.eventId = eventId;
    this.questionDurationSec = questionDurationSec;
  }

  public async driveSession(): Promise<void> {
    this.running = true;
    const sessionRef = doc(this.db, "events", this.eventId, "activities", "quiz", "session", "current");

    console.log(`\n🏎️ [SessionDriver] Starting automated 5-question Quiz lifecycle for event: ${this.eventId}`);

    for (let qIndex = 0; qIndex < DEMO_QUIZ_QUESTIONS.length; qIndex++) {
      if (!this.running) break;

      const question = DEMO_QUIZ_QUESTIONS[qIndex];
      const now = Date.now();

      // 1. STAGE: question
      console.log(`\n▶️ [SessionDriver] Question ${qIndex + 1}/5 ("${question.text.substring(0, 30)}...")`);
      await setDoc(sessionRef, {
        status: "running",
        stage: "question",
        currentQuestionIndex: qIndex,
        currentQuestion: question,
        startedAt: qIndex === 0 ? now : undefined,
        questionStartTime: now,
        timerDuration: this.questionDurationSec,
        isRunning: true,
        fastestResponse: null
      }, { merge: true });

      // Wait for question duration
      await this.sleep(this.questionDurationSec * 1000);

      if (!this.running) break;

      // 2. STAGE: answer_reveal
      console.log(`📊 [SessionDriver] Question ${qIndex + 1}/5 -> Stage: answer_reveal`);
      await updateDoc(sessionRef, {
        stage: "answer_reveal",
        updatedAt: Date.now()
      });

      await this.sleep(2000);

      if (!this.running) break;

      // 3. STAGE: leaderboard
      console.log(`🏆 [SessionDriver] Question ${qIndex + 1}/5 -> Stage: leaderboard`);
      await updateDoc(sessionRef, {
        stage: "leaderboard",
        updatedAt: Date.now()
      });

      await this.sleep(2000);
    }

    if (this.running) {
      // Final STAGE: completed
      console.log(`\n🏁 [SessionDriver] Quiz completed. Updating session to 'completed'.`);
      await updateDoc(sessionRef, {
        status: "completed",
        stage: "completed",
        isRunning: false,
        updatedAt: Date.now()
      });
    }
  }

  public stop(): void {
    this.running = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
