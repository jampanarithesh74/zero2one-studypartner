/**
 * ZERO2ONE EVENTS — LIVE EVENT ENGINE
 * Feature 5A: Canonical Live Session Types & Orchestration Contracts
 *
 * This module defines the authoritative state machine, data models,
 * and Activity Adapter contracts for synchronized live event execution.
 */

import { ReactNode } from "react";
import { ActivityType } from "../services/eventActivityService";

/**
 * High-level Live Event Engine lifecycle state.
 */
export type LiveEventStatus = "idle" | "waiting" | "active" | "paused" | "ended";

/**
 * Activity lifecycle stages inside the live session.
 */
export type LiveActivityStage =
  | "ready"        // Activity selected, intro/briefing screen
  | "running"      // Main activity gameplay active
  | "frozen"       // Submissions paused/locked for discussion
  | "reveal"       // Correct solutions / explanations shown
  | "leaderboard"  // Activity standings & top scores presented
  | "completed";   // Activity wrapped up, ready for next transition

/**
 * Canonical Live Session Document
 * Path: `events/{eventId}/liveSession/current`
 * 
 * Authoritative single source of truth for real-time live event state.
 * Read by all participants and live walls; mutated ONLY by the verified event host.
 */
export interface CanonicalLiveSession {
  eventId: string;
  hostId: string;
  status: LiveEventStatus;
  
  // Sequence & Active Activity Pointer
  currentActivityIndex: number; // 0-based index in the sorted activity sequence
  totalActivities: number;
  currentActivityId: string | null; // ID matching doc in `events/{eventId}/activities/{activityId}`
  currentActivityType: ActivityType | null; // "quiz" | "crossword" | "riddle"
  currentActivityTitle: string | null;
  
  // Authoritative Stage & Timing
  stage: LiveActivityStage;
  stageSequenceNumber: number; // Monotonically increasing counter for state transitions
  activityStartedAt: number | null; // Epoch ms timestamp
  stageStartedAt: number | null;    // Epoch ms timestamp
  durationSeconds: number | null;   // Total duration allocated for current stage/activity
  
  // State flags
  isFrozen: boolean;
  isRevealed: boolean;
  
  // Granular activity stage indices (optional helper pointers)
  stepIndex?: number; // e.g. question index for quiz, puzzle index for crossword, riddle index for riddle
  totalSteps?: number;
  
  // Timestamps
  updatedAt: any;
  createdAt: any;
}

/**
 * Summary descriptor of an activity in the sorted sequence
 */
export interface LiveSequenceItem {
  id: string;
  type: ActivityType;
  title: string;
  order: number;
  durationSeconds?: number;
  config?: Record<string, any>;
}

/**
 * Standardized Participant Live Progress / Submission Interface
 */
export interface ParticipantActivitySubmission {
  participantId: string;
  participantName: string;
  participantPhoto?: string;
  activityId: string;
  activityType: ActivityType;
  stepIndex?: number;
  score: number;
  submittedAt: number;
  metadata?: Record<string, any>;
}

/**
 * Standardized Realtime Leaderboard Entry
 */
export interface CanonicalLeaderboardEntry {
  participantId: string;
  name: string;
  photo?: string;
  college?: string;
  department?: string;
  totalScore: number;
  activityScore: number;
  rank?: number;
  lastActiveAt: number;
}

/**
 * Activity Adapter Interface
 * 
 * Every activity engine (Quiz, Crossword, Riddle, Custom) adheres to this
 * contract to plug seamlessly into the Canonical Live Event Engine without
 * requiring the orchestrator to know internal UI mechanics.
 */
export interface ActivityAdapter {
  readonly type: ActivityType;
  
  /**
   * Initializes or resets activity-specific state when the host loads this activity.
   */
  onActivityStart(eventId: string, activityId: string, config: Record<string, any>): Promise<void>;
  
  /**
   * Transitions the activity to a new internal stage (running, frozen, reveal, leaderboard).
   */
  onStageChange(eventId: string, activityId: string, stage: LiveActivityStage, stepIndex?: number): Promise<void>;
  
  /**
   * Concludes the activity and calculates final aggregate scores.
   */
  onActivityComplete(eventId: string, activityId: string): Promise<void>;
  
  /**
   * Renders the participant-side view for this activity.
   */
  renderParticipantView(props: {
    eventId: string;
    activityId: string;
    session: CanonicalLiveSession;
    participantId: string;
    participantName: string;
  }): ReactNode;
  
  /**
   * Renders the host control view for this activity.
   */
  renderHostControlView(props: {
    eventId: string;
    activityId: string;
    session: CanonicalLiveSession;
    onAdvanceStep: () => Promise<void>;
    onFreeze: () => Promise<void>;
    onReveal: () => Promise<void>;
  }): ReactNode;
}
