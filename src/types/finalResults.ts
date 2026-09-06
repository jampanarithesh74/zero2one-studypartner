/**
 * ZERO2ONE EVENTS — FEATURE 6A
 * FINAL RESULTS & AGGREGATION CONTRACTS
 */

import { ActivityType } from "../services/eventActivityService";

export interface ParticipantActivityScore {
  activityId: string;
  activityTitle: string;
  activityType: ActivityType;
  score: number;
  correctCount: number;
  totalCount: number;
  timeTakenSec?: number;
  accuracyPercentage?: number;
  details?: Record<string, any>;
}

export interface FinalLeaderboardEntry {
  participantId: string;
  name: string;
  college?: string;
  department?: string;
  year?: string;
  photo?: string;
  totalScore: number;
  totalCorrect: number;
  rank: number;
  activityScores: Record<string, ParticipantActivityScore>;
  lastSubmittedAt?: number;
}

export interface FinalEventResultsSummary {
  eventId: string;
  eventTitle: string;
  completedAt: number;
  totalParticipants: number;
  totalActivities: number;
  totalSubmissionsCount: number;
  highestScore: number;
  averageScore: number;
  podium: {
    first?: FinalLeaderboardEntry;
    second?: FinalLeaderboardEntry;
    third?: FinalLeaderboardEntry;
  };
  leaderboard: FinalLeaderboardEntry[];
}
