/**
 * ZERO2ONE EVENTS — FEATURE 6A
 * FINAL RESULTS PIPELINE & AGGREGATION SERVICE
 *
 * Implements atomic aggregation of participant scores across all custom activities
 * (Quiz, Crossword, Riddle), calculates authoritative rankings and podium,
 * persists summary snapshots, and provides export capabilities.
 */

import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  FinalEventResultsSummary,
  FinalLeaderboardEntry,
  ParticipantActivityScore,
} from "../types/finalResults";
import { getEventActivities, EventActivity } from "./eventActivityService";

export const FinalResultsService = {
  /**
   * Aggregate all participant submissions across every configured activity in the event.
   * Point-in-time calculation with 0 ongoing listener overhead.
   */
  async calculateFinalResults(eventId: string): Promise<FinalEventResultsSummary> {
    if (!eventId) {
      throw new Error("Event ID is required to calculate final results.");
    }

    // 1. Fetch Event Document
    const eventRef = doc(db, "events", eventId);
    const eventSnap = await getDoc(eventRef);
    const eventData = eventSnap.exists() ? eventSnap.data() : {};
    const eventTitle = eventData.title || eventData.name || "Zero2One Live Event";

    // 2. Fetch All Event Activities in Sequence
    const activities: EventActivity[] = await getEventActivities(eventId);

    // 3. Fetch Registered Participants Directory
    const participantsColRef = collection(db, "events", eventId, "participants");
    const partSnap = await getDocs(participantsColRef);
    const participantMetaMap = new Map<string, any>();

    partSnap.forEach((docSnap) => {
      const p = docSnap.data();
      participantMetaMap.set(docSnap.id, {
        id: docSnap.id,
        name: p.name || "Event Participant",
        college: p.college || "",
        department: p.department || "",
        year: p.year || "",
        photo: p.photo || "",
      });
    });

    // 4. Map of Participant ID -> Aggregate Score Tracking
    const participantTotalsMap = new Map<string, {
      participantId: string;
      name: string;
      college: string;
      department: string;
      year: string;
      photo?: string;
      totalScore: number;
      totalCorrect: number;
      activityScores: Record<string, ParticipantActivityScore>;
      lastSubmittedAt: number;
    }>();

    let totalSubmissionsCounter = 0;

    // Helper to get or create entry in participantTotalsMap
    const getParticipantEntry = (id: string, name?: string, college?: string, department?: string) => {
      let entry = participantTotalsMap.get(id);
      if (!entry) {
        const meta = participantMetaMap.get(id) || {};
        entry = {
          participantId: id,
          name: meta.name || name || "Participant",
          college: meta.college || college || "",
          department: meta.department || department || "",
          year: meta.year || "",
          photo: meta.photo || "",
          totalScore: 0,
          totalCorrect: 0,
          activityScores: {},
          lastSubmittedAt: 0,
        };
        participantTotalsMap.set(id, entry);
      }
      return entry;
    };

    // 5. Aggregate Across Each Activity Type
    for (const act of activities) {
      const actId = act.id;
      const actType = act.type;
      const actTitle = act.title;

      try {
        if (actType === "quiz") {
          // Submissions collection: events/{eventId}/activities/{actId}/submissions
          const subsRef = collection(db, "events", eventId, "activities", actId, "submissions");
          const subsSnap = await getDocs(subsRef);

          subsSnap.forEach((subDoc) => {
            const sub = subDoc.data();
            if (!sub || !sub.participantId) return;

            totalSubmissionsCounter++;
            const entry = getParticipantEntry(
              sub.participantId,
              sub.participantName,
              sub.participantCollege,
              sub.participantDepartment
            );

            let actScore = entry.activityScores[actId];
            if (!actScore) {
              actScore = {
                activityId: actId,
                activityTitle: actTitle,
                activityType: "quiz",
                score: 0,
                correctCount: 0,
                totalCount: 0,
              };
              entry.activityScores[actId] = actScore;
            }

            const pts = typeof sub.pointsEarned === "number" ? sub.pointsEarned : 0;
            const isCorrect = Boolean(sub.isCorrect);

            actScore.score += pts;
            actScore.totalCount += 1;
            if (isCorrect) {
              actScore.correctCount += 1;
            }

            entry.totalScore += pts;
            if (isCorrect) {
              entry.totalCorrect += 1;
            }

            const subTime = sub.submittedAt?.toMillis?.() || Date.now();
            if (subTime > entry.lastSubmittedAt) {
              entry.lastSubmittedAt = subTime;
            }
          });
        } else if (actType === "crossword") {
          // Submissions collection: events/{eventId}/activities/{actId}/submissions
          const subsRef = collection(db, "events", eventId, "activities", actId, "submissions");
          const subsSnap = await getDocs(subsRef);

          subsSnap.forEach((subDoc) => {
            const sub = subDoc.data();
            if (!sub || !sub.participantId) return;

            totalSubmissionsCounter++;
            const entry = getParticipantEntry(
              sub.participantId,
              sub.participantName,
              sub.participantCollege,
              sub.participantDepartment
            );

            const score = typeof sub.score === "number" ? sub.score : 0;
            const correctWords = typeof sub.correctWordsCount === "number" ? sub.correctWordsCount : 0;
            const totalWords = typeof sub.totalWordsCount === "number" ? sub.totalWordsCount : 0;
            const timeTaken = typeof sub.timeTakenSec === "number" ? sub.timeTakenSec : 0;
            const accuracy = typeof sub.accuracyPercentage === "number" ? sub.accuracyPercentage : 0;

            entry.activityScores[actId] = {
              activityId: actId,
              activityTitle: actTitle,
              activityType: "crossword",
              score,
              correctCount: correctWords,
              totalCount: totalWords,
              timeTakenSec: timeTaken,
              accuracyPercentage: accuracy,
              details: {
                correctLettersCount: sub.correctLettersCount || 0,
                isFullySolved: Boolean(sub.isFullySolved),
              },
            };

            entry.totalScore += score;
            entry.totalCorrect += correctWords;

            const subTime = sub.submittedAt?.toMillis?.() || Date.now();
            if (subTime > entry.lastSubmittedAt) {
              entry.lastSubmittedAt = subTime;
            }
          });
        } else if (actType === "riddle") {
          // Submissions collection: events/{eventId}/activities/{actId}/submissions
          const subsRef = collection(db, "events", eventId, "activities", actId, "submissions");
          const subsSnap = await getDocs(subsRef);

          subsSnap.forEach((subDoc) => {
            const sub = subDoc.data();
            if (!sub || !sub.participantId) return;

            totalSubmissionsCounter++;
            const entry = getParticipantEntry(
              sub.participantId,
              sub.participantName,
              sub.participantCollege,
              sub.participantDepartment
            );

            let actScore = entry.activityScores[actId];
            if (!actScore) {
              actScore = {
                activityId: actId,
                activityTitle: actTitle,
                activityType: "riddle",
                score: 0,
                correctCount: 0,
                totalCount: 0,
              };
              entry.activityScores[actId] = actScore;
            }

            const pts = typeof sub.pointsEarned === "number" ? sub.pointsEarned : 0;
            const isCorrect = Boolean(sub.isCorrect);

            actScore.score += pts;
            actScore.totalCount += 1;
            if (isCorrect) {
              actScore.correctCount += 1;
            }

            entry.totalScore += pts;
            if (isCorrect) {
              entry.totalCorrect += 1;
            }

            const subTime = sub.submittedAt?.toMillis?.() || Date.now();
            if (subTime > entry.lastSubmittedAt) {
              entry.lastSubmittedAt = subTime;
            }
          });
        }
      } catch (actErr) {
        console.warn(`[FinalResultsService] Failed gathering results for activity ${actId}:`, actErr);
      }
    }

    // 6. Include registered participants who scored 0 so they appear in participation list if desired
    participantMetaMap.forEach((meta, pId) => {
      if (!participantTotalsMap.has(pId)) {
        participantTotalsMap.set(pId, {
          participantId: pId,
          name: meta.name || "Participant",
          college: meta.college || "",
          department: meta.department || "",
          year: meta.year || "",
          photo: meta.photo || "",
          totalScore: 0,
          totalCorrect: 0,
          activityScores: {},
          lastSubmittedAt: 0,
        });
      }
    });

    // 7. Sort Leaderboard: Total Score DESC, Total Correct DESC, Earliest submission ASC
    const leaderboard: FinalLeaderboardEntry[] = Array.from(participantTotalsMap.values())
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        if (b.totalCorrect !== a.totalCorrect) {
          return b.totalCorrect - a.totalCorrect;
        }
        return (a.lastSubmittedAt || 0) - (b.lastSubmittedAt || 0);
      })
      .map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
      }));

    // 8. Calculate Overall Metrics & Podium
    const totalParticipants = leaderboard.length;
    const highestScore = leaderboard.length > 0 ? leaderboard[0].totalScore : 0;
    const totalScoreSum = leaderboard.reduce((acc, curr) => acc + curr.totalScore, 0);
    const averageScore = totalParticipants > 0 ? Math.round(totalScoreSum / totalParticipants) : 0;

    const podium = {
      first: leaderboard[0] || undefined,
      second: leaderboard[1] || undefined,
      third: leaderboard[2] || undefined,
    };

    const summaryPayload: FinalEventResultsSummary = {
      eventId,
      eventTitle,
      completedAt: Date.now(),
      totalParticipants,
      totalActivities: activities.length,
      totalSubmissionsCount: totalSubmissionsCounter,
      highestScore,
      averageScore,
      podium,
      leaderboard,
    };

    // 9. Persist snapshot to Firestore: `events/{eventId}/finalResults/summary`
    try {
      const summaryDocRef = doc(db, "events", eventId, "finalResults", "summary");
      await setDoc(summaryDocRef, {
        ...summaryPayload,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (saveErr) {
      console.warn("[FinalResultsService] Failed to cache summary snapshot:", saveErr);
    }

    return summaryPayload;
  },

  /**
   * Subscribe to the authoritative final results summary document.
   * Path: `events/{eventId}/finalResults/summary`
   */
  subscribeFinalResults(
    eventId: string,
    callback: (summary: FinalEventResultsSummary | null) => void
  ): Unsubscribe {
    if (!eventId) {
      callback(null);
      return () => {};
    }

    const summaryDocRef = doc(db, "events", eventId, "finalResults", "summary");

    return onSnapshot(
      summaryDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data() as FinalEventResultsSummary);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.warn("[FinalResultsService] Subscription error:", error);
        callback(null);
      }
    );
  },

  /**
   * Generate CSV format of the final leaderboard for host export.
   */
  generateResultsCSV(summary: FinalEventResultsSummary): string {
    const headers = [
      "Rank",
      "Participant Name",
      "College / Institution",
      "Department",
      "Total Score",
      "Total Correct Answers / Solved",
      "Total Activities Completed",
    ];

    const rows = summary.leaderboard.map((p) => {
      const actsCompleted = Object.keys(p.activityScores || {}).length;
      return [
        p.rank,
        `"${(p.name || "").replace(/"/g, '""')}"`,
        `"${(p.college || "").replace(/"/g, '""')}"`,
        `"${(p.department || "").replace(/"/g, '""')}"`,
        p.totalScore,
        p.totalCorrect,
        actsCompleted,
      ].join(",");
    });

    return [headers.join(","), ...rows].join("\n");
  },

  /**
   * Download CSV directly to host's device.
   */
  downloadCSV(summary: FinalEventResultsSummary, filename?: string) {
    const csvContent = this.generateResultsCSV(summary);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      filename || `${summary.eventTitle.replace(/[^a-z0-9]/gi, "_")}_Final_Results.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};
