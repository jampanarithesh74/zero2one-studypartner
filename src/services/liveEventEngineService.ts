/**
 * ZERO2ONE EVENTS — LIVE EVENT ENGINE
 * Feature 5A: Authoritative Orchestration Foundation Service
 *
 * Provides real-time synchronization, client-side drift-free timing,
 * and host-authorized orchestration primitives for custom live events.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  CanonicalLiveSession,
  LiveEventStatus,
  LiveActivityStage,
  LiveSequenceItem,
} from "../types/liveEventEngine";
import { getEventActivities, EventActivity } from "./eventActivityService";

export interface LiveEngineValidationResult {
  isEligible: boolean;
  event?: any;
  activities?: EventActivity[];
  errorMessage?: string;
}

export const LiveEventEngineService = {
  /**
   * Subscribe to the authoritative canonical live session document.
   * Path: `events/{eventId}/liveSession/current`
   */
  subscribeLiveSession(
    eventId: string,
    callback: (session: CanonicalLiveSession | null) => void
  ): Unsubscribe {
    if (!eventId) {
      callback(null);
      return () => {};
    }

    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    return onSnapshot(
      sessionRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data() as CanonicalLiveSession);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.warn("[LiveEventEngineService] Session subscription warning:", error);
        callback(null);
      }
    );
  },

  /**
   * Fetch single snapshot of canonical live session
   */
  async getLiveSession(eventId: string): Promise<CanonicalLiveSession | null> {
    if (!eventId) return null;
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) return null;
    return snap.data() as CanonicalLiveSession;
  },

  /**
   * Validate that the event is published, has configured activities, and user has host authority.
   */
  async validateEventForLive(
    eventId: string,
    userId: string,
    isAdmin: boolean = false
  ): Promise<LiveEngineValidationResult> {
    if (!eventId) {
      return { isEligible: false, errorMessage: "Missing event identifier" };
    }

    const eventRef = doc(db, "events", eventId);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return { isEligible: false, errorMessage: "Event not found" };
    }

    const eventData = eventSnap.data();

    // Verify Host Authorization
    const isOwner = eventData.ownerId === userId || eventData.createdBy === userId;
    if (!isOwner && !isAdmin) {
      return {
        isEligible: false,
        event: eventData,
        errorMessage: "Unauthorized. Only the event host or administrator can access live control.",
      };
    }

    // Verify Publication Status
    if (eventData.status !== "published") {
      return {
        isEligible: false,
        event: eventData,
        errorMessage: `Event is currently in "${eventData.status || "draft"}" status. Only published events can start live sessions.`,
      };
    }

    // Load and verify activities sequence
    const activities = await getEventActivities(eventId);
    if (!activities || activities.length === 0) {
      return {
        isEligible: false,
        event: eventData,
        activities: [],
        errorMessage: "No activities configured for this event. Add at least one activity before launching.",
      };
    }

    return {
      isEligible: true,
      event: eventData,
      activities,
    };
  },

  /**
   * Helper: Calculate remaining time client-side using start timestamp + duration.
   * Completely avoids Firestore 1-second write polling.
   */
  calculateRemainingTime(session: CanonicalLiveSession | null): {
    remainingSeconds: number;
    isExpired: boolean;
    progressPercentage: number;
    formattedTime: string;
  } {
    if (!session || !session.stageStartedAt || !session.durationSeconds) {
      return { remainingSeconds: 0, isExpired: false, progressPercentage: 0, formattedTime: "00:00" };
    }

    const now = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((now - session.stageStartedAt) / 1000));
    const remainingSeconds = Math.max(0, session.durationSeconds - elapsedSeconds);
    const isExpired = remainingSeconds <= 0;
    const progressPercentage = Math.min(
      100,
      Math.max(0, Math.round((elapsedSeconds / session.durationSeconds) * 100))
    );

    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const formattedTime = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

    return { remainingSeconds, isExpired, progressPercentage, formattedTime };
  },

  /**
   * Initialize or start Live Event Canonical Session.
   * Sets session to status: "active", first activity in order, stage: "ready".
   * Note: This does NOT start the activity timer yet (stage is "ready").
   */
  async startLiveEvent(
    eventId: string,
    hostId: string,
    activitiesOverride?: EventActivity[]
  ): Promise<CanonicalLiveSession> {
    if (!eventId || !hostId) {
      throw new Error("Event ID and Host ID are required to start live event");
    }

    const activities = activitiesOverride || (await getEventActivities(eventId));
    if (!activities || activities.length === 0) {
      throw new Error("Cannot start event without configured activities");
    }

    const firstActivity = activities[0];
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    // Extract duration from config
    const configuredDuration =
      firstActivity.durationSeconds ||
      firstActivity.config?.timeLimit ||
      (firstActivity.type === "quiz" ? 30 : firstActivity.type === "crossword" ? 180 : 60);

    const totalSteps =
      firstActivity.config?.questions?.length ||
      firstActivity.config?.puzzles?.length ||
      firstActivity.config?.riddles?.length ||
      1;

    let resultSession: CanonicalLiveSession;

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(sessionRef);

      if (snap.exists()) {
        const existing = snap.data() as CanonicalLiveSession;
        // If session is already actively running or past ready, preserve current sequence position
        if (existing.status === "active" && existing.currentActivityId) {
          resultSession = existing;
          return;
        }
      }

      const initialSession: CanonicalLiveSession = {
        eventId,
        hostId,
        status: "active",
        currentActivityIndex: 0,
        totalActivities: activities.length,
        currentActivityId: firstActivity.id,
        currentActivityType: firstActivity.type,
        currentActivityTitle: firstActivity.title,
        stage: "ready",
        stageSequenceNumber: 1,
        activityStartedAt: null,
        stageStartedAt: null,
        durationSeconds: configuredDuration,
        isFrozen: false,
        isRevealed: false,
        stepIndex: 0,
        totalSteps,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      transaction.set(sessionRef, initialSession, { merge: true });
      resultSession = initialSession;
    });

    return resultSession!;
  },

  /**
   * Transition 1: READY -> RUNNING
   * Starts the activity timer authoritatively.
   */
  async startActivity(
    eventId: string,
    expectedSequenceNumber: number,
    durationOverride?: number
  ): Promise<void> {
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(sessionRef);
      if (!snap.exists()) {
        throw new Error("Live session not initialized.");
      }

      const current = snap.data() as CanonicalLiveSession;

      // Optimistic concurrency check
      if (current.stageSequenceNumber !== expectedSequenceNumber) {
        throw new Error(
          `Action conflict: Session was updated in another tab (seq: ${current.stageSequenceNumber} vs expected: ${expectedSequenceNumber}). Refreshing...`
        );
      }

      if (current.stage !== "ready") {
        throw new Error(`Cannot start activity from stage "${current.stage}". Expected "ready".`);
      }

      const now = Date.now();
      const duration = durationOverride || current.durationSeconds || 60;

      transaction.update(sessionRef, {
        stage: "running",
        stageSequenceNumber: current.stageSequenceNumber + 1,
        activityStartedAt: now,
        stageStartedAt: now,
        durationSeconds: duration,
        isFrozen: false,
        isRevealed: false,
        updatedAt: serverTimestamp(),
      });
    });
  },

  /**
   * Transition 2: RUNNING -> FROZEN
   * Freezes submissions.
   */
  async freezeActivity(
    eventId: string,
    expectedSequenceNumber: number
  ): Promise<void> {
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(sessionRef);
      if (!snap.exists()) {
        throw new Error("Live session not found.");
      }

      const current = snap.data() as CanonicalLiveSession;

      if (current.stageSequenceNumber !== expectedSequenceNumber) {
        throw new Error("Action conflict: Stale live session state. Please retry.");
      }

      if (current.stage !== "running") {
        throw new Error(`Cannot freeze activity when stage is "${current.stage}". Expected "running".`);
      }

      transaction.update(sessionRef, {
        stage: "frozen",
        isFrozen: true,
        stageSequenceNumber: current.stageSequenceNumber + 1,
        updatedAt: serverTimestamp(),
      });
    });
  },

  /**
   * Transition 3: FROZEN or RUNNING -> REVEAL
   * Unlocks answers / solutions display.
   */
  async revealActivity(
    eventId: string,
    expectedSequenceNumber: number
  ): Promise<void> {
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(sessionRef);
      if (!snap.exists()) {
        throw new Error("Live session not found.");
      }

      const current = snap.data() as CanonicalLiveSession;

      if (current.stageSequenceNumber !== expectedSequenceNumber) {
        throw new Error("Action conflict: Stale live session state. Please retry.");
      }

      if (current.stage !== "frozen" && current.stage !== "running") {
        throw new Error(`Cannot reveal solutions when stage is "${current.stage}". Expected "frozen" or "running".`);
      }

      transaction.update(sessionRef, {
        stage: "reveal",
        isRevealed: true,
        isFrozen: true,
        stageSequenceNumber: current.stageSequenceNumber + 1,
        stageStartedAt: Date.now(),
        updatedAt: serverTimestamp(),
      });
    });
  },

  /**
   * Transition 4: REVEAL or FROZEN -> LEADERBOARD
   * Shows standings for current activity.
   */
  async showLeaderboard(
    eventId: string,
    expectedSequenceNumber: number
  ): Promise<void> {
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(sessionRef);
      if (!snap.exists()) {
        throw new Error("Live session not found.");
      }

      const current = snap.data() as CanonicalLiveSession;

      if (current.stageSequenceNumber !== expectedSequenceNumber) {
        throw new Error("Action conflict: Stale live session state. Please retry.");
      }

      if (current.stage !== "reveal" && current.stage !== "frozen") {
        throw new Error(`Cannot display leaderboard when stage is "${current.stage}". Expected "reveal".`);
      }

      transaction.update(sessionRef, {
        stage: "leaderboard",
        stageSequenceNumber: current.stageSequenceNumber + 1,
        stageStartedAt: Date.now(),
        updatedAt: serverTimestamp(),
      });
    });
  },

  /**
   * Transition 5: LEADERBOARD -> NEXT ACTIVITY (stage: READY)
   * Advances currentActivityIndex by 1 in the sorted activity sequence.
   * If on final activity, transitions to COMPLETED.
   */
  async advanceToNextActivity(
    eventId: string,
    expectedSequenceNumber: number,
    activitiesOverride?: EventActivity[]
  ): Promise<{ hasNext: boolean; nextActivityTitle?: string }> {
    const activities = activitiesOverride || (await getEventActivities(eventId));
    if (!activities || activities.length === 0) {
      throw new Error("No activities found for this event sequence.");
    }

    const sessionRef = doc(db, "events", eventId, "liveSession", "current");
    let hasNext = false;
    let nextTitle = "";

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(sessionRef);
      if (!snap.exists()) {
        throw new Error("Live session not found.");
      }

      const current = snap.data() as CanonicalLiveSession;

      if (current.stageSequenceNumber !== expectedSequenceNumber) {
        throw new Error("Action conflict: Stale live session state. Please retry.");
      }

      if (current.stage !== "leaderboard") {
        throw new Error(`Cannot advance to next activity from stage "${current.stage}". Expected "leaderboard".`);
      }

      const nextIndex = current.currentActivityIndex + 1;

      if (nextIndex < activities.length) {
        hasNext = true;
        const nextActivity = activities[nextIndex];
        nextTitle = nextActivity.title;

        const nextDuration =
          nextActivity.durationSeconds ||
          nextActivity.config?.timeLimit ||
          (nextActivity.type === "quiz" ? 30 : nextActivity.type === "crossword" ? 180 : 60);

        const totalSteps =
          nextActivity.config?.questions?.length ||
          nextActivity.config?.puzzles?.length ||
          nextActivity.config?.riddles?.length ||
          1;

        transaction.update(sessionRef, {
          currentActivityIndex: nextIndex,
          totalActivities: activities.length,
          currentActivityId: nextActivity.id,
          currentActivityType: nextActivity.type,
          currentActivityTitle: nextActivity.title,
          stage: "ready",
          stageSequenceNumber: current.stageSequenceNumber + 1,
          activityStartedAt: null,
          stageStartedAt: null,
          durationSeconds: nextDuration,
          isFrozen: false,
          isRevealed: false,
          stepIndex: 0,
          totalSteps,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Final activity completed -> wrap up live event
        hasNext = false;
        transaction.update(sessionRef, {
          status: "ended",
          stage: "completed",
          stageSequenceNumber: current.stageSequenceNumber + 1,
          updatedAt: serverTimestamp(),
        });
      }
    });

    return { hasNext, nextActivityTitle: nextTitle };
  },

  /**
   * Transition 4b: Advance Internal Activity Step (e.g. Next Quiz Question)
   * Updates stepIndex, unlocks submissions (isFrozen: false, isRevealed: false),
   * sets stage to "running", and starts the authoritative step timer.
   */
  async advanceActivityStep(
    eventId: string,
    nextStepIndex: number,
    stepDurationSeconds: number,
    expectedSequenceNumber: number
  ): Promise<void> {
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(sessionRef);
      if (!snap.exists()) {
        throw new Error("Live session not found.");
      }

      const current = snap.data() as CanonicalLiveSession;

      if (current.stageSequenceNumber !== expectedSequenceNumber) {
        throw new Error("Action conflict: Stale live session state. Please retry.");
      }

      const now = Date.now();

      transaction.update(sessionRef, {
        stepIndex: nextStepIndex,
        stage: "running",
        stageSequenceNumber: current.stageSequenceNumber + 1,
        stageStartedAt: now,
        durationSeconds: stepDurationSeconds,
        isFrozen: false,
        isRevealed: false,
        updatedAt: serverTimestamp(),
      });
    });
  },

  /**
   * Conclude live event
   */
  async completeLiveEvent(
    eventId: string,
    expectedSequenceNumber: number
  ): Promise<void> {
    const sessionRef = doc(db, "events", eventId, "liveSession", "current");

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(sessionRef);
      if (!snap.exists()) {
        throw new Error("Live session not found.");
      }

      const current = snap.data() as CanonicalLiveSession;

      if (current.stageSequenceNumber !== expectedSequenceNumber) {
        throw new Error("Action conflict: Stale live session state. Please retry.");
      }

      transaction.update(sessionRef, {
        status: "ended",
        stage: "completed",
        stageSequenceNumber: current.stageSequenceNumber + 1,
        updatedAt: serverTimestamp(),
      });
    });
  },

  /**
   * Validate that the actor is authorized to mutate live session.
   */
  async verifyHostAuthority(eventId: string, userId: string): Promise<boolean> {
    if (!eventId || !userId) return false;
    const eventRef = doc(db, "events", eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return false;
    const data = eventSnap.data();
    return data.ownerId === userId || data.createdBy === userId;
  },
};

