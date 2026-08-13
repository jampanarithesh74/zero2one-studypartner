import { Firestore, doc, setDoc, onSnapshot, collection, query, orderBy, limit, serverTimestamp } from "firebase/firestore";
import { 
  PageDeliveryResult, 
  ParticipantStats, 
  ParticipantError 
} from "./types.js";

export interface VirtualParticipantOptions {
  userId: string;
  index: number;
  eventId: string;
  baseUrl: string;
  burstWindowMs?: number;
  httpTimeoutMs?: number;
}

export class VirtualParticipant {
  private db: Firestore;
  public userId: string;
  public participantId: string;
  private eventId: string;
  private baseUrl: string;
  private burstWindowMs: number;
  private httpTimeoutMs: number;

  public stats: ParticipantStats;
  private unsubscribers: (() => void)[] = [];
  private answeredQuestions: Set<number> = new Set();
  private pendingSubmissions: Set<number> = new Set();

  constructor(db: Firestore, options: VirtualParticipantOptions) {
    this.db = db;
    this.userId = options.userId;
    this.participantId = `LOADTEST-${options.userId}`;
    this.eventId = options.eventId;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.burstWindowMs = options.burstWindowMs || 2000;
    this.httpTimeoutMs = options.httpTimeoutMs || 30000;

    this.stats = {
      userId: this.userId,
      participantId: this.participantId,
      pageDelivery: {
        latencyMs: 0,
        success: false
      },
      joined: false,
      joinLatencyMs: 0,
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

  /**
   * Phase 1: Vercel Page Delivery (HTTP GET)
   */
  public async fetchEventPage(): Promise<PageDeliveryResult> {
    const pageUrl = `${this.baseUrl}/events/${this.eventId}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.httpTimeoutMs);
    const start = performance.now();

    try {
      const res = await fetch(pageUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Zero2One-E2E-LoadTest/1.0",
          "Accept": "text/html,application/xhtml+xml,*/*"
        },
        signal: controller.signal
      });

      await res.arrayBuffer(); // Consume body
      const latencyMs = performance.now() - start;
      clearTimeout(timer);

      const is2xx = res.status >= 200 && res.status < 300;
      const result: PageDeliveryResult = {
        statusCode: res.status,
        latencyMs,
        success: is2xx,
        errorType: is2xx ? undefined : "http",
        errorMessage: is2xx ? undefined : `HTTP ${res.status}`
      };

      this.stats.pageDelivery = result;
      return result;
    } catch (err: any) {
      const latencyMs = performance.now() - start;
      clearTimeout(timer);

      const isTimeout = err.name === "AbortError";
      const result: PageDeliveryResult = {
        latencyMs,
        success: false,
        errorType: isTimeout ? "timeout" : "network",
        errorMessage: isTimeout ? "Page Request Timeout" : (err.message || "Network Error")
      };

      this.stats.pageDelivery = result;
      return result;
    }
  }

  /**
   * Phase 2: Firestore Participant Join
   */
  public async joinFirestoreRoom(): Promise<boolean> {
    const start = performance.now();
    try {
      const participantRef = doc(this.db, "events", this.eventId, "participants", this.participantId);
      await setDoc(participantRef, {
        name: `LoadTest User ${this.userId}`,
        roomType: "normal",
        online: true,
        joinedAt: serverTimestamp(),
        lastSeen: serverTimestamp()
      });

      this.stats.joinLatencyMs = Math.round(performance.now() - start);
      this.stats.joined = true;
      return true;
    } catch (err: any) {
      this.stats.joinLatencyMs = Math.round(performance.now() - start);
      this.stats.joined = false;
      this.recordError(err, "firestore_join");
      return false;
    }
  }

  /**
   * Phase 3: Start Realtime Listeners
   * Preserves the 5 core production listeners required for quiz participation:
   * 1. Room Participants Query
   * 2. Quiz Session Document
   * 3. Top-10 Leaderboard Query
   * 4. Individual Leaderboard Document
   * 5. Individual Response Document
   */
  public startListeners(): void {
    if (!this.stats.joined) return;

    // 1. Participants List Listener
    const partsQ = query(
      collection(this.db, "events", this.eventId, "participants"),
      orderBy("joinedAt", "desc"),
      limit(100)
    );
    const unsubParts = onSnapshot(
      partsQ,
      () => {},
      (err) => this.recordError(err, "participants_listener")
    );
    this.registerListener(unsubParts);

    // 2. Quiz Session Document Listener
    const sessionRef = doc(this.db, "events", this.eventId, "activities", "quiz", "session", "current");
    const unsubSession = onSnapshot(
      sessionRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();

        // Calculate session sync latency
        const updatedAtMs = typeof data.updatedAt?.toMillis === "function"
          ? data.updatedAt.toMillis()
          : (typeof data.updatedAt === "number" ? data.updatedAt : null);

        if (updatedAtMs) {
          const now = Date.now();
          const latencyMs = now - updatedAtMs;
          if (latencyMs >= 0 && latencyMs <= 60000) {
            this.stats.sessionSyncs.push({
              latencyMs,
              timestamp: now,
              type: "session"
            });
          }
        }

        // Active question phase handling
        if (data.stage === "question" && typeof data.currentQuestionIndex === "number") {
          this.handleQuestionStage(data.currentQuestionIndex);
        }
      },
      (err) => this.recordError(err, "session_listener")
    );
    this.registerListener(unsubSession);

    // 3. Top-10 Leaderboard Query Listener
    const lbQuery = query(
      collection(this.db, "events", this.eventId, "activities", "quiz", "leaderboard"),
      orderBy("currentScore", "desc"),
      limit(10)
    );
    const unsubLbQ = onSnapshot(
      lbQuery,
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
      (err) => this.recordError(err, "leaderboard_query_listener")
    );
    this.registerListener(unsubLbQ);

    // 4. Individual Leaderboard Doc Listener
    const indLbRef = doc(this.db, "events", this.eventId, "activities", "quiz", "leaderboard", this.participantId);
    const unsubIndLb = onSnapshot(
      indLbRef,
      () => {},
      (err) => this.recordError(err, "individual_leaderboard_listener")
    );
    this.registerListener(unsubIndLb);

    // 5. Individual Response Doc Listener
    const respRef = doc(this.db, "events", this.eventId, "activities", "quiz", "responses", this.participantId);
    const unsubResp = onSnapshot(
      respRef,
      () => {},
      (err) => this.recordError(err, "individual_response_listener")
    );
    this.registerListener(unsubResp);
  }

  /**
   * Phase 5: Answer Submission
   */
  private handleQuestionStage(qIndex: number): void {
    if (this.answeredQuestions.has(qIndex) || this.pendingSubmissions.has(qIndex)) {
      return; // Duplicate protection
    }

    this.pendingSubmissions.add(qIndex);
    this.stats.answersAttempted++;

    // Think time: random between 300ms and burstWindowMs
    const thinkTimeMs = Math.floor(300 + Math.random() * (this.burstWindowMs - 300));

    setTimeout(async () => {
      const respRef = doc(this.db, "events", this.eventId, "activities", "quiz", "responses", this.participantId);
      const selectedOption = Math.floor(Math.random() * 4); // 0, 1, 2, or 3
      const responseKey = `question${qIndex}`;
      const timeKey = `question${qIndex}_submittedAt`;

      const start = performance.now();
      try {
        await setDoc(respRef, {
          participantId: this.participantId,
          participantName: `LoadTest User ${this.userId}`,
          [responseKey]: selectedOption,
          [timeKey]: Date.now(),
          updatedAt: serverTimestamp()
        }, { merge: true });

        const durationMs = Math.round(performance.now() - start);
        this.stats.answersSuccessful++;
        this.answeredQuestions.add(qIndex);
        this.stats.answerLatencies.push({
          durationMs,
          timestamp: Date.now()
        });
      } catch (err: any) {
        this.stats.answersFailed++;
        this.recordError(err, "answer_submit");
      } finally {
        this.pendingSubmissions.delete(qIndex);
      }
    }, thinkTimeMs);
  }

  private registerListener(unsub: () => void) {
    this.unsubscribers.push(unsub);
    this.stats.activeListenersCount = this.unsubscribers.length;
    if (this.stats.activeListenersCount > this.stats.peakListenersCount) {
      this.stats.peakListenersCount = this.stats.activeListenersCount;
    }
  }

  private recordError(err: any, context: string) {
    const msg = String(err?.message || err || "Unknown Error");
    let type: ParticipantError["type"] = "other";

    if (msg.includes("permission-denied") || msg.includes("PERMISSION_DENIED")) {
      type = "permission";
    } else if (msg.includes("timeout") || msg.includes("deadline")) {
      type = "timeout";
    } else if (msg.includes("network") || msg.includes("unavailable") || msg.includes("UNAVAILABLE")) {
      type = "network";
    } else if (msg.includes("resource-exhausted") || msg.includes("quota")) {
      type = "rateLimit";
    } else if (msg.includes("Firestore")) {
      type = "firestore";
    }

    this.stats.errors.push({
      type,
      message: `[${context}] ${msg}`,
      timestamp: Date.now()
    });
  }

  public stop(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    this.stats.activeListenersCount = 0;
  }
}
