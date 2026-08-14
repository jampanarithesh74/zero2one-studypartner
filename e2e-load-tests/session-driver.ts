import { Firestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

export interface E2ESessionDriverOptions {
  questionDurationSec?: number;
  revealDurationSec?: number;
  leaderboardDurationSec?: number;
}

export class E2EQuizSessionDriver {
  private db: Firestore;
  private eventId: string;
  private questionDurationSec: number;
  private revealDurationSec: number;
  private leaderboardDurationSec: number;
  private running: boolean = false;

  constructor(db: Firestore, eventId: string, options: E2ESessionDriverOptions = {}) {
    this.db = db;
    this.eventId = eventId;
    this.questionDurationSec = options.questionDurationSec || 15;
    this.revealDurationSec = options.revealDurationSec || 3;
    this.leaderboardDurationSec = options.leaderboardDurationSec || 3;
  }

  public async driveSession(): Promise<void> {
    this.running = true;
    const sessionRef = doc(this.db, "events", this.eventId, "activities", "quiz", "session", "current");

    console.log(`\n🏎️ [E2E SessionDriver] Driving 10-question Quiz lifecycle for event: ${this.eventId}`);
    console.log(`   [Config] Question Duration: ${this.questionDurationSec}s | Reveal: ${this.revealDurationSec}s | Leaderboard: ${this.leaderboardDurationSec}s`);

    const TOTAL_QUIZ_QUESTIONS = 10;

    for (let qIndex = 0; qIndex < TOTAL_QUIZ_QUESTIONS; qIndex++) {
      if (!this.running) break;

      // 1. QUESTION STAGE
      console.log(`   [SessionDriver] Moving to Question ${qIndex + 1} / ${TOTAL_QUIZ_QUESTIONS} (Stage: "question")`);
      await setDoc(sessionRef, {
        stage: "question",
        currentQuestionIndex: qIndex,
        questionStartTime: Date.now(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      await this.sleep(this.questionDurationSec * 1000);
      if (!this.running) break;

      // 2. ANSWER REVEAL STAGE
      console.log(`   [SessionDriver] Question ${qIndex + 1} ended -> Stage: "answer_reveal"`);
      await setDoc(sessionRef, {
        stage: "answer_reveal",
        currentQuestionIndex: qIndex,
        updatedAt: serverTimestamp()
      }, { merge: true });

      await this.sleep(this.revealDurationSec * 1000);
      if (!this.running) break;

      // 3. LEADERBOARD STAGE
      console.log(`   [SessionDriver] Question ${qIndex + 1} -> Stage: "leaderboard"`);
      await setDoc(sessionRef, {
        stage: "leaderboard",
        currentQuestionIndex: qIndex,
        updatedAt: serverTimestamp()
      }, { merge: true });

      await this.sleep(this.leaderboardDurationSec * 1000);
    }

    if (this.running) {
      console.log(`\n🏁 [SessionDriver] Quiz finished -> Stage: "completed"`);
      await setDoc(sessionRef, {
        stage: "completed",
        currentQuestionIndex: 9,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  }

  public stop(): void {
    this.running = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
