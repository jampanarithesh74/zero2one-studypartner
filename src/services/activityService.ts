import {
  doc,
  collection,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Firestore,
  Unsubscribe
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  getCrosswordFirestore,
  getRiddleFirestore,
  isCrosswordConfigured,
  isRiddleConfigured,
} from "../lib/firebaseProjects";
import { DEMO_QUIZ_QUESTIONS, QuizLeaderboardEntry, QuizSessionData } from "../data/quizQuestions";

// ============================================================================
// ACTIVE BROADCAST & STAGE SYNCHRONIZATION (PROJECT 1)
// ============================================================================

export interface CrosswordBroadcastState {
  puzzleIndex: number; // 0 for Crossword 1, 1 for Crossword 2
  puzzleId: string;
  stage: "active" | "frozen" | "reveal" | "leaderboard";
  isRevealed: boolean;
  isFrozen: boolean;
  updatedAt?: number;
}

export interface RiddleBroadcastState {
  riddleIndex: number; // 0 to 4 (Riddles 1 to 5)
  riddleId: number;
  stage: "active" | "frozen" | "reveal" | "leaderboard";
  isRevealed: boolean;
  isFrozen: boolean;
  updatedAt?: number;
}

export interface ActiveBroadcastData {
  activeActivity: "none" | "quiz" | "crossword" | "riddles";
  crossword?: CrosswordBroadcastState;
  riddles?: RiddleBroadcastState;
  updatedAt?: any;
}

export const BroadcastService = {
  subscribe(eventId: string, callback: (broadcast: ActiveBroadcastData | null) => void): Unsubscribe {
    if (!eventId) {
      callback(null);
      return () => {};
    }
    const broadcastRef = doc(db, "events", eventId, "activities", "activeBroadcast");
    return onSnapshot(
      broadcastRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data() as ActiveBroadcastData);
        } else {
          callback(null);
        }
      },
      (err) => {
        console.warn("[BroadcastService] Listener warning:", err);
        callback(null);
      }
    );
  },

  async setBroadcast(eventId: string, data: Partial<ActiveBroadcastData>): Promise<void> {
    if (!eventId) return;
    const broadcastRef = doc(db, "events", eventId, "activities", "activeBroadcast");
    await setDoc(
      broadcastRef,
      {
        ...data,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },

  async broadcastCrossword(
    eventId: string,
    puzzleIndex: number,
    puzzleId: string,
    stage: "active" | "frozen" | "reveal" | "leaderboard" = "active",
    isRevealed: boolean = false,
    isFrozen: boolean = false
  ): Promise<void> {
    const crosswordState: CrosswordBroadcastState = {
      puzzleIndex,
      puzzleId,
      stage,
      isRevealed,
      isFrozen,
      updatedAt: Date.now(),
    };
    await this.setBroadcast(eventId, {
      activeActivity: "crossword",
      crossword: crosswordState,
    });
  },

  async broadcastRiddle(
    eventId: string,
    riddleIndex: number,
    riddleId: number,
    stage: "active" | "frozen" | "reveal" | "leaderboard" = "active",
    isRevealed: boolean = false,
    isFrozen: boolean = false
  ): Promise<void> {
    const riddleState: RiddleBroadcastState = {
      riddleIndex,
      riddleId,
      stage,
      isRevealed,
      isFrozen,
      updatedAt: Date.now(),
    };
    await this.setBroadcast(eventId, {
      activeActivity: "riddles",
      riddles: riddleState,
    });
  },

  async updateCrosswordState(
    eventId: string,
    updates: Partial<CrosswordBroadcastState>
  ): Promise<void> {
    if (!eventId) return;
    const broadcastRef = doc(db, "events", eventId, "activities", "activeBroadcast");
    const updateObj: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };
    Object.entries(updates).forEach(([key, val]) => {
      updateObj[`crossword.${key}`] = val;
    });
    await updateDoc(broadcastRef, updateObj);
  },

  async updateRiddleState(
    eventId: string,
    updates: Partial<RiddleBroadcastState>
  ): Promise<void> {
    if (!eventId) return;
    const broadcastRef = doc(db, "events", eventId, "activities", "activeBroadcast");
    const updateObj: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };
    Object.entries(updates).forEach(([key, val]) => {
      updateObj[`riddles.${key}`] = val;
    });
    await updateDoc(broadcastRef, updateObj);
  },

  async clearBroadcast(eventId: string): Promise<void> {
    await this.setBroadcast(eventId, {
      activeActivity: "none",
    });
  }
};

// ============================================================================
// CROSSWORD DATA TYPES & SERVICE (PROJECT 2)
// ============================================================================

export interface CrosswordLeaderboardEntry {
  participantId: string;
  name: string;
  photo?: string;
  currentScore: number;
  puzzlesCompleted: number;
  lastSolvedAt?: number;
}

export interface CrosswordSubmissionData {
  participantId: string;
  participantName: string;
  puzzleId: string;
  puzzleIndex: number;
  correctCells: number;
  totalCells: number;
  isFullySolved: boolean;
  score: number;
  submittedAt: number;
}

export interface CrosswordSessionData {
  status: "idle" | "running" | "ended";
  activePuzzleIndex: number;
  startedAt?: number;
  isRunning?: boolean;
}

export const CrosswordService = {
  isConfigured: () => isCrosswordConfigured,

  /**
   * Listen to Crossword Session on Project 2
   */
  subscribeSession(eventId: string, callback: (session: CrosswordSessionData | null) => void): Unsubscribe {
    if (!isCrosswordConfigured || !eventId) {
      callback(null);
      return () => {};
    }
    const db = getCrosswordFirestore();
    const sessionRef = doc(db, "events", eventId, "activities", "crossword", "session", "current");
    return onSnapshot(
      sessionRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data() as CrosswordSessionData);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.warn("[CrosswordService] Session listener error:", error);
        callback(null);
      }
    );
  },

  /**
   * Listen to Crossword Leaderboard (Top 10) on Project 2
   */
  subscribeLeaderboard(eventId: string, callback: (leaderboard: CrosswordLeaderboardEntry[]) => void): Unsubscribe {
    if (!isCrosswordConfigured || !eventId) {
      callback([]);
      return () => {};
    }
    const db = getCrosswordFirestore();
    const lbRef = collection(db, "events", eventId, "activities", "crossword", "leaderboard");
    const qLb = query(lbRef, orderBy("currentScore", "desc"), limit(10));
    return onSnapshot(
      qLb,
      (snapshot) => {
        const list: CrosswordLeaderboardEntry[] = [];
        snapshot.forEach((d) => list.push(d.data() as CrosswordLeaderboardEntry));
        callback(list);
      },
      (error) => {
        console.warn("[CrosswordService] Leaderboard listener error:", error);
        callback([]);
      }
    );
  },

  /**
   * Submit Crossword Result on Project 2.
   * Write-optimized: Only called on explicit user submission/check.
   */
  async submitResult(
    eventId: string,
    participantId: string,
    participantName: string,
    puzzleId: string,
    puzzleIndex: number,
    correctCells: number,
    totalCells: number,
    isFullySolved: boolean
  ): Promise<{ score: number }> {
    if (!isCrosswordConfigured) {
      throw new Error("Crossword Firebase project is not configured.");
    }
    const db = getCrosswordFirestore();
    const cellScore = correctCells * 10;
    const completionBonus = isFullySolved ? 50 : 0;
    const totalScoreEarned = cellScore + completionBonus;

    // 1. Write submission record
    const subDocRef = doc(
      db,
      "events",
      eventId,
      "activities",
      "crossword",
      "submissions",
      `${participantId}_${puzzleId}`
    );

    const submission: CrosswordSubmissionData = {
      participantId,
      participantName,
      puzzleId,
      puzzleIndex,
      correctCells,
      totalCells,
      isFullySolved,
      score: totalScoreEarned,
      submittedAt: Date.now(),
    };

    await setDoc(subDocRef, submission, { merge: true });

    // 2. Update Leaderboard Entry
    const lbDocRef = doc(db, "events", eventId, "activities", "crossword", "leaderboard", participantId);
    const existingSnap = await getDoc(lbDocRef);
    let oldScore = 0;
    let oldPuzzles = 0;

    if (existingSnap.exists()) {
      const data = existingSnap.data() as CrosswordLeaderboardEntry;
      oldScore = data.currentScore || 0;
      oldPuzzles = data.puzzlesCompleted || 0;
    }

    const updatedLeaderboard: CrosswordLeaderboardEntry = {
      participantId,
      name: participantName,
      currentScore: oldScore + totalScoreEarned,
      puzzlesCompleted: oldPuzzles + (isFullySolved ? 1 : 0),
      lastSolvedAt: Date.now(),
    };

    await setDoc(lbDocRef, updatedLeaderboard, { merge: true });
    return { score: totalScoreEarned };
  },

  /**
   * Admin: Start Crossword Activity Session on Project 2
   */
  async startSession(eventId: string, puzzleIndex: number = 0): Promise<void> {
    if (!isCrosswordConfigured) throw new Error("Crossword Firebase project is not configured.");
    const db = getCrosswordFirestore();
    const sessionRef = doc(db, "events", eventId, "activities", "crossword", "session", "current");
    await setDoc(sessionRef, {
      status: "running",
      activePuzzleIndex: puzzleIndex,
      startedAt: Date.now(),
      isRunning: true,
    });
  },

  /**
   * Admin: End Crossword Activity Session on Project 2
   */
  async endSession(eventId: string): Promise<void> {
    if (!isCrosswordConfigured) return;
    const db = getCrosswordFirestore();
    const sessionRef = doc(db, "events", eventId, "activities", "crossword", "session", "current");
    await updateDoc(sessionRef, {
      status: "ended",
      isRunning: false,
    });
  }
};

// ============================================================================
// RIDDLE DATA TYPES & SERVICE (PROJECT 3)
// ============================================================================

export interface RiddleLeaderboardEntry {
  participantId: string;
  name: string;
  photo?: string;
  currentScore: number;
  riddlesSolved: number;
  lastSolvedAt?: number;
}

export interface RiddleSubmissionData {
  participantId: string;
  participantName: string;
  riddleId: string;
  riddleIndex: number;
  submittedWord: string;
  isCorrect: boolean;
  scoreEarned: number;
  submittedAt: number;
}

export interface RiddleSessionData {
  status: "idle" | "running" | "ended";
  activeRiddleIndex: number;
  startedAt?: number;
  isRunning?: boolean;
}

export const RiddleService = {
  isConfigured: () => isRiddleConfigured,

  /**
   * Listen to Riddle Session on Project 3
   */
  subscribeSession(eventId: string, callback: (session: RiddleSessionData | null) => void): Unsubscribe {
    if (!isRiddleConfigured || !eventId) {
      callback(null);
      return () => {};
    }
    const db = getRiddleFirestore();
    const sessionRef = doc(db, "events", eventId, "activities", "riddles", "session", "current");
    return onSnapshot(
      sessionRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data() as RiddleSessionData);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.warn("[RiddleService] Session listener error:", error);
        callback(null);
      }
    );
  },

  /**
   * Listen to Riddle Leaderboard (Top 10) on Project 3
   */
  subscribeLeaderboard(eventId: string, callback: (leaderboard: RiddleLeaderboardEntry[]) => void): Unsubscribe {
    if (!isRiddleConfigured || !eventId) {
      callback([]);
      return () => {};
    }
    const db = getRiddleFirestore();
    const lbRef = collection(db, "events", eventId, "activities", "riddles", "leaderboard");
    const qLb = query(lbRef, orderBy("currentScore", "desc"), limit(10));
    return onSnapshot(
      qLb,
      (snapshot) => {
        const list: RiddleLeaderboardEntry[] = [];
        snapshot.forEach((d) => list.push(d.data() as RiddleLeaderboardEntry));
        callback(list);
      },
      (error) => {
        console.warn("[RiddleService] Leaderboard listener error:", error);
        callback([]);
      }
    );
  },

  /**
   * Submit Riddle Result on Project 3.
   * Write-optimized: Only called upon explicit check/verify.
   */
  async submitResult(
    eventId: string,
    participantId: string,
    participantName: string,
    riddleId: string,
    riddleIndex: number,
    submittedWord: string,
    isCorrect: boolean
  ): Promise<{ score: number }> {
    if (!isRiddleConfigured) {
      throw new Error("Riddle Firebase project is not configured.");
    }
    const db = getRiddleFirestore();
    const scoreEarned = isCorrect ? 100 : 0;

    // 1. Write submission record
    const subDocRef = doc(
      db,
      "events",
      eventId,
      "activities",
      "riddles",
      "submissions",
      `${participantId}_${riddleId}`
    );

    const submission: RiddleSubmissionData = {
      participantId,
      participantName,
      riddleId,
      riddleIndex,
      submittedWord,
      isCorrect,
      scoreEarned,
      submittedAt: Date.now(),
    };

    await setDoc(subDocRef, submission, { merge: true });

    if (isCorrect) {
      // 2. Update Leaderboard Entry
      const lbDocRef = doc(db, "events", eventId, "activities", "riddles", "leaderboard", participantId);
      const existingSnap = await getDoc(lbDocRef);
      let oldScore = 0;
      let oldSolved = 0;

      if (existingSnap.exists()) {
        const data = existingSnap.data() as RiddleLeaderboardEntry;
        oldScore = data.currentScore || 0;
        oldSolved = data.riddlesSolved || 0;
      }

      const updatedLeaderboard: RiddleLeaderboardEntry = {
        participantId,
        name: participantName,
        currentScore: oldScore + scoreEarned,
        riddlesSolved: oldSolved + 1,
        lastSolvedAt: Date.now(),
      };

      await setDoc(lbDocRef, updatedLeaderboard, { merge: true });
    }

    return { score: scoreEarned };
  },

  /**
   * Admin: Start Riddle Activity Session on Project 3
   */
  async startSession(eventId: string, riddleIndex: number = 0): Promise<void> {
    if (!isRiddleConfigured) throw new Error("Riddle Firebase project is not configured.");
    const db = getRiddleFirestore();
    const sessionRef = doc(db, "events", eventId, "activities", "riddles", "session", "current");
    await setDoc(sessionRef, {
      status: "running",
      activeRiddleIndex: riddleIndex,
      startedAt: Date.now(),
      isRunning: true,
    });
  },

  /**
   * Admin: End Riddle Activity Session on Project 3
   */
  async endSession(eventId: string): Promise<void> {
    if (!isRiddleConfigured) return;
    const db = getRiddleFirestore();
    const sessionRef = doc(db, "events", eventId, "activities", "riddles", "session", "current");
    await updateDoc(sessionRef, {
      status: "ended",
      isRunning: false,
    });
  }
};

// ============================================================================
// QUIZ ACTIVITY SERVICE (PROJECT 1)
// ============================================================================

export const QuizService = {
  /**
   * Listen to Quiz Leaderboard (Top 10 / 20) on Project 1
   */
  subscribeLeaderboard(
    eventId: string,
    callback: (leaderboard: QuizLeaderboardEntry[]) => void,
    maxEntries: number = 10
  ): Unsubscribe {
    if (!eventId) {
      callback([]);
      return () => {};
    }
    const lbRef = collection(db, "events", eventId, "activities", "quiz", "leaderboard");
    const qLb = query(lbRef, orderBy("currentScore", "desc"), limit(maxEntries));
    return onSnapshot(
      qLb,
      (snapshot) => {
        const list: QuizLeaderboardEntry[] = [];
        snapshot.forEach((d) => list.push(d.data() as QuizLeaderboardEntry));
        callback(list);
      },
      (error) => {
        console.warn("[QuizService] Leaderboard listener error:", error);
        callback([]);
      }
    );
  },

  /**
   * Listen to current Quiz Session on Project 1
   */
  subscribeSession(eventId: string, callback: (session: QuizSessionData | null) => void): Unsubscribe {
    if (!eventId) {
      callback(null);
      return () => {};
    }
    const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");
    return onSnapshot(
      sessionRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data() as QuizSessionData);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.warn("[QuizService] Session listener warning:", error);
        callback(null);
      }
    );
  },

  /**
   * Participant Quiz Answer Submission:
   * 1. Evaluates answer against DEMO_QUIZ_QUESTIONS
   * 2. Prevents double-scoring for the same question
   * 3. Calculates base score (100) + speed bonus (up to 50)
   * 4. Updates responses doc atomically
   * 5. Updates accumulated leaderboard entry
   * 6. Checks & updates fastest response on current session
   */
  async submitAnswer(
    eventId: string,
    participantId: string,
    participantName: string,
    participantPhoto: string | undefined,
    questionIndex: number,
    selectedOption: number,
    timeRemaining: number = 30
  ): Promise<{ isCorrect: boolean; pointsEarned: number; totalScore: number }> {
    if (!eventId || !participantId) {
      throw new Error("Event ID and Participant ID are required");
    }

    const question = DEMO_QUIZ_QUESTIONS[questionIndex] || null;
    const qKey = `question${questionIndex}`;
    const submittedTime = Date.now();

    // 1. Read existing response to prevent duplicate submission / double-counting of same question
    const responseRef = doc(db, "events", eventId, "activities", "quiz", "responses", participantId);
    const existingRespSnap = await getDoc(responseRef);
    const existingRespData = existingRespSnap.exists() ? existingRespSnap.data() : null;

    if (existingRespData && existingRespData[qKey] !== undefined) {
      // Already submitted this question! Return existing score without inflating
      const wasCorrect = existingRespData[`${qKey}_correct`] === true;
      const pts = existingRespData[`${qKey}_points`] || 0;
      
      const lbDocRef = doc(db, "events", eventId, "activities", "quiz", "leaderboard", participantId);
      const lbSnap = await getDoc(lbDocRef);
      const curScore = lbSnap.exists() ? (lbSnap.data() as QuizLeaderboardEntry).currentScore || 0 : 0;
      return { isCorrect: wasCorrect, pointsEarned: pts, totalScore: curScore };
    }

    // 2. Evaluate answer against question answer key
    const isCorrect = question !== null && selectedOption >= 0 && selectedOption === question.correctOptionIndex;
    const speedBonus = isCorrect ? Math.max(0, Math.floor((timeRemaining / 30) * 50)) : 0;
    const pointsEarned = isCorrect ? (100 + speedBonus) : 0;

    // 3. Save Question Response
    await setDoc(
      responseRef,
      {
        participantId,
        participantName,
        [qKey]: selectedOption,
        [`${qKey}_correct`]: isCorrect,
        [`${qKey}_points`]: pointsEarned,
        [`${qKey}_speedBonus`]: speedBonus,
        [`${qKey}_submittedAt`]: submittedTime,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // 4. Update Leaderboard Entry Accumulation (preserves previous scores, increments question counts)
    const lbDocRef = doc(db, "events", eventId, "activities", "quiz", "leaderboard", participantId);
    const existingLbSnap = await getDoc(lbDocRef);
    let oldScore = 0;
    let oldAnswered = 0;
    let oldCorrect = 0;

    if (existingLbSnap.exists()) {
      const data = existingLbSnap.data() as QuizLeaderboardEntry;
      oldScore = data.currentScore || 0;
      oldAnswered = data.questionsAnswered || 0;
      oldCorrect = data.correctAnswers || 0;
    }

    const newScore = oldScore + pointsEarned;
    const newAnswered = oldAnswered + 1;
    const newCorrect = oldCorrect + (isCorrect ? 1 : 0);

    const updatedLeaderboard: QuizLeaderboardEntry = {
      participantId,
      name: participantName,
      photo: participantPhoto || "",
      currentScore: newScore,
      questionsAnswered: newAnswered,
      correctAnswers: newCorrect,
      lastAnswerTime: submittedTime,
    };

    await setDoc(lbDocRef, updatedLeaderboard, { merge: true });

    // 5. Update fastestResponse on session if applicable
    if (isCorrect && speedBonus > 0) {
      try {
        const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");
        const sessionSnap = await getDoc(sessionRef);
        if (sessionSnap.exists()) {
          const sessionData = sessionSnap.data() as QuizSessionData;
          if (sessionData.stage === "question" && sessionData.currentQuestionIndex === questionIndex) {
            const responseTimeSec = Math.max(1, 30 - timeRemaining);
            if (!sessionData.fastestResponse || responseTimeSec < sessionData.fastestResponse.responseTimeSec) {
              await updateDoc(sessionRef, {
                fastestResponse: {
                  participantId,
                  participantName,
                  responseTimeSec,
                  speedBonus,
                },
                updatedAt: serverTimestamp(),
              });
            }
          }
        }
      } catch (e) {
        console.warn("[QuizService] Could not update fastest response on session:", e);
      }
    }

    return { isCorrect, pointsEarned, totalScore: newScore };
  },

  /**
   * Reset Quiz Leaderboard and all Participant Submissions for a fresh session
   */
  async resetLeaderboard(eventId: string): Promise<void> {
    if (!eventId) return;
    const lbRef = collection(db, "events", eventId, "activities", "quiz", "leaderboard");
    const respRef = collection(db, "events", eventId, "activities", "quiz", "responses");
    
    const [lbSnaps, respSnaps] = await Promise.all([getDocs(lbRef), getDocs(respRef)]);
    
    const batch = writeBatch(db);
    lbSnaps.forEach((docSnap) => batch.delete(docSnap.ref));
    respSnaps.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }
};

