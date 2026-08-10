import { 
  doc, 
  collection, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp,
  Firestore 
} from "firebase/firestore";
import { VirtualUserOptions, VirtualUserStats, LatencyMetric } from "./types.js";

export class VirtualUser {
  public id: string;
  public participantId: string;
  public eventId: string;
  public name: string;
  public stats: VirtualUserStats;
  
  private db: Firestore;
  private burstWindowMs: number;
  private submittedQuestions: Set<number> = new Set();
  private unsubscribers: Array<() => void> = [];
  private active: boolean = false;

  constructor(db: Firestore, options: VirtualUserOptions) {
    this.db = db;
    this.id = options.userId;
    this.participantId = `LOADTEST-${options.userId}`;
    this.eventId = options.eventId;
    this.name = `LOADTEST Participant ${options.userId}`;
    this.burstWindowMs = options.burstWindowMs || 2000;

    this.stats = {
      userId: this.id,
      joined: false,
      joinDurationMs: 0,
      answersAttempted: 0,
      answersSuccessful: 0,
      answersFailed: 0,
      answerLatencies: [],
      sessionSyncs: [],
      leaderboardSyncs: [],
      activeListenersCount: 0,
      peakListenersCount: 0,
      errors: []
    };
  }

  // 1. Participant Join Action
  public async join(): Promise<boolean> {
    const startTime = Date.now();
    const participantRef = doc(this.db, "events", this.eventId, "participants", this.participantId);

    const payload = {
      name: this.name,
      college: "ZERO2ONE Test Institute",
      department: "Computer Science",
      year: "3rd Year",
      email: `loadtest-${this.id}@test.com`,
      joinedAt: new Date().toISOString()
    };

    try {
      await setDoc(participantRef, payload, { merge: true });
      this.stats.joined = true;
      this.stats.joinDurationMs = Date.now() - startTime;
      this.active = true;
      return true;
    } catch (err: any) {
      this.recordError(err, "join");
      this.stats.joined = false;
      return false;
    }
  }

  // 2. Start Realtime Listeners matching actual participant screen (QuizModeCard.tsx)
  public startListeners(): void {
    if (!this.active) return;

    // Listener A: Quiz Session Listener
    const sessionRef = doc(this.db, "events", this.eventId, "activities", "quiz", "session", "current");
    const unsubSession = onSnapshot(
      sessionRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();

        // Track session sync latency using the stage transition timestamp (updatedAt)
        const sessionTimeMs = typeof data.updatedAt?.toMillis === "function" 
          ? data.updatedAt.toMillis() 
          : (typeof data.updatedAt === "number" ? data.updatedAt : null);

        if (sessionTimeMs) {
          const now = Date.now();
          const latencyMs = now - sessionTimeMs;
          // Filter out stale timestamps from previous runs or negative clock skew
          if (latencyMs >= 0 && latencyMs <= 60000) {
            this.stats.sessionSyncs.push({
              latencyMs,
              timestamp: now,
              type: "session"
            });
          }
        }

        // If active question stage, schedule answer submission for that specific question index
        if (data.status === "running" && data.stage === "question" && typeof data.currentQuestionIndex === "number") {
          const qIndex = data.currentQuestionIndex;
          if (!this.submittedQuestions.has(qIndex)) {
            this.scheduleAnswerSubmission(qIndex);
          }
        }
      },
      (err) => {
        this.recordError(err, "session_listener");
      }
    );
    this.unsubscribers.push(unsubSession);

    // Listener B: Top 10 Leaderboard Listener
    const lbRef = collection(this.db, "events", this.eventId, "activities", "quiz", "leaderboard");
    const qLb = query(lbRef, orderBy("currentScore", "desc"), limit(10));
    const unsubLb = onSnapshot(
      qLb,
      (snapshot) => {
        let maxLatency = -1;
        const now = Date.now();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.lastAnswerTime) {
            const diff = now - data.lastAnswerTime;
            if (diff >= 0 && diff <= 60000) {
              if (diff > maxLatency) maxLatency = diff;
            }
          }
        });
        if (maxLatency >= 0) {
          this.stats.leaderboardSyncs.push({
            latencyMs: maxLatency,
            timestamp: now,
            type: "leaderboard"
          });
        }
      },
      (err) => {
        this.recordError(err, "leaderboard_listener");
      }
    );
    this.unsubscribers.push(unsubLb);

    // Listener C: Personal Leaderboard Listener
    const userLbRef = doc(this.db, "events", this.eventId, "activities", "quiz", "leaderboard", this.participantId);
    const unsubUserLb = onSnapshot(
      userLbRef,
      () => {},
      (err) => {
        this.recordError(err, "user_leaderboard_listener");
      }
    );
    this.unsubscribers.push(unsubUserLb);

    this.stats.activeListenersCount = this.unsubscribers.length;
    this.stats.peakListenersCount = Math.max(this.stats.peakListenersCount || 0, this.unsubscribers.length);
  }

  // 3. Submit Quiz Answer (Guaranteed Exactly Once Per Question)
  private scheduleAnswerSubmission(questionIndex: number): void {
    if (this.submittedQuestions.has(questionIndex)) return;
    // Lock immediately locally to prevent duplicate concurrent schedules
    this.submittedQuestions.add(questionIndex);

    // Simulate natural user delay / burst timing within the question window
    const randomDelay = Math.floor(Math.random() * this.burstWindowMs);

    setTimeout(() => {
      this.executeAnswerSubmission(questionIndex);
    }, randomDelay);
  }

  private async executeAnswerSubmission(questionIndex: number): Promise<void> {
    const startTime = Date.now();
    this.stats.answersAttempted++;

    const responseRef = doc(this.db, "events", this.eventId, "activities", "quiz", "responses", this.participantId);
    const option = (parseInt(this.id.replace(/\D/g, ""), 10) + questionIndex) % 4;

    const payload = {
      [`question${questionIndex}`]: option,
      [`question${questionIndex}_time`]: Math.floor(Math.random() * 15) + 3,
      updatedAt: serverTimestamp(),
      participantName: this.name,
      participantCollege: "ZERO2ONE Test Institute",
      participantDept: "Computer Science"
    };

    try {
      await setDoc(responseRef, payload, { merge: true });
      const durationMs = Date.now() - startTime;
      this.stats.answersSuccessful++;

      const metric: LatencyMetric = {
        durationMs,
        timestamp: Date.now(),
        success: true
      };
      this.stats.answerLatencies.push(metric);
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      this.stats.answersFailed++;

      const errorType = this.categorizeError(err);
      const metric: LatencyMetric = {
        durationMs,
        timestamp: Date.now(),
        success: false,
        error: err.message || "Failed to submit answer",
        errorType
      };
      this.stats.answerLatencies.push(metric);
      this.recordError(err, "answer_submit");
    }
  }

  public stop(): void {
    this.active = false;
    this.unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch (e) {
        // Ignore unsub errors
      }
    });
    this.unsubscribers = [];
    this.stats.activeListenersCount = 0;
  }

  private recordError(err: any, context: string): void {
    const type = this.categorizeError(err);
    this.stats.errors.push({
      message: `[${context}] ${err.message || String(err)}`,
      type,
      timestamp: Date.now()
    });
  }

  private categorizeError(err: any): 'permission' | 'timeout' | 'network' | 'rate_limit' | 'firestore' | 'other' {
    const code = (err.code || "").toLowerCase();
    const msg = (err.message || "").toLowerCase();

    if (code.includes("permission-denied") || msg.includes("permission")) return "permission";
    if (code.includes("deadline-exceeded") || msg.includes("timeout")) return "timeout";
    if (code.includes("unavailable") || msg.includes("network") || msg.includes("offline")) return "network";
    if (code.includes("resource-exhausted") || msg.includes("rate") || msg.includes("quota")) return "rate_limit";
    if (code.includes("firestore") || code.includes("invalid-argument")) return "firestore";
    return "other";
  }
}
