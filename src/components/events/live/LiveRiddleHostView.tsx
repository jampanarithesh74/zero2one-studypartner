import React, { useState, useEffect } from "react";
import {
  HelpCircle,
  Clock,
  Trophy,
  Users,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Sparkles,
  Eye,
  Lock,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { CanonicalLiveSession, LiveActivityStage } from "../../../types/liveEventEngine";
import { GenericRiddleEntry } from "../../../services/riddleBuilderService";
import {
  RiddleActivityAdapter,
  RiddleQuestionStats,
  RiddleLeaderboardEntry,
} from "../../../services/riddleActivityAdapter";

interface LiveRiddleHostViewProps {
  eventId: string;
  activityId: string;
  session: CanonicalLiveSession;
  riddles: GenericRiddleEntry[];
  isLoadingRiddles: boolean;
}

export function LiveRiddleHostView({
  eventId,
  activityId,
  session,
  riddles,
  isLoadingRiddles,
}: LiveRiddleHostViewProps) {
  const currentStepIndex = session.stepIndex ?? 0;
  const currentRiddle = riddles[currentStepIndex] || null;
  const totalRiddles = riddles.length || session.totalSteps || 1;

  // Real-time submissions radar for current active riddle
  const [stats, setStats] = useState<RiddleQuestionStats>({
    riddleId: currentRiddle?.id || "",
    totalSubmissions: 0,
    correctCount: 0,
    incorrectCount: 0,
  });

  // Real-time leaderboard for this riddle activity
  const [leaderboard, setLeaderboard] = useState<RiddleLeaderboardEntry[]>([]);

  // 1. Subscribe to Active Riddle Submission Stats
  useEffect(() => {
    if (!eventId || !activityId || !currentRiddle?.id) return;

    const unsubscribe = RiddleActivityAdapter.subscribeRiddleStats(
      eventId,
      activityId,
      currentRiddle.id,
      (newStats) => {
        setStats(newStats);
      }
    );

    return () => unsubscribe();
  }, [eventId, activityId, currentRiddle?.id]);

  // 2. Subscribe to Riddle Leaderboard
  useEffect(() => {
    if (!eventId || !activityId) return;

    const unsubscribe = RiddleActivityAdapter.subscribeRiddleLeaderboard(
      eventId,
      activityId,
      (entries) => {
        setLeaderboard(entries);
      }
    );

    return () => unsubscribe();
  }, [eventId, activityId]);

  if (isLoadingRiddles) {
    return (
      <div className="p-8 rounded-2xl bg-neutral-950 border border-neutral-850 text-center text-xs font-mono text-neutral-400">
        <Loader2 size={18} className="animate-spin inline mr-2 text-orange-400" />
        Loading riddle questions...
      </div>
    );
  }

  if (!currentRiddle) {
    return (
      <div className="p-8 rounded-2xl bg-neutral-950 border border-neutral-850 text-center text-xs font-mono text-neutral-400">
        No riddles configured for this activity.
      </div>
    );
  }

  const isLastRiddle = currentStepIndex >= totalRiddles - 1;
  const currentStage: LiveActivityStage = session.stage || "ready";

  return (
    <div className="p-5 rounded-2xl bg-neutral-950 border border-orange-500/30 space-y-5 shadow-2xl">
      {/* 1. RIDDLE STEPPER HEADER */}
      <div className="flex items-center justify-between gap-3 border-b border-neutral-850 pb-3">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
            Riddle {currentStepIndex + 1} of {totalRiddles}
          </span>
          <span className="text-xs font-mono font-bold text-neutral-400">
            {currentRiddle.points || 100} PTS • {currentRiddle.timeLimitSec || 20}s Limit
          </span>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-mono text-neutral-500">
            {isLastRiddle ? "Final Riddle in Activity" : `Next: Riddle #${currentStepIndex + 2}`}
          </span>
        </div>
      </div>

      {/* 2. RIDDLE PROMPT */}
      <div className="space-y-3">
        <div className="text-xs font-mono uppercase text-orange-400 font-bold flex items-center gap-2">
          <HelpCircle size={15} />
          <span>{currentRiddle.title || `Engineering Riddle #${currentStepIndex + 1}`}</span>
        </div>
        <p className="text-base sm:text-lg font-black text-white tracking-tight leading-snug">
          "{currentRiddle.riddleText}"
        </p>

        {/* 3. HOST MASTER SOLUTION PREVIEW */}
        <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              <span>Host Master Solution Key:</span>
            </span>
            <span className="text-[10px] font-mono text-neutral-500">
              {currentRiddle.answer.length} Letters
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {currentRiddle.answer.split("").map((letter, idx) => (
              <span
                key={idx}
                className="w-8 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono font-black text-sm flex items-center justify-center"
              >
                {letter}
              </span>
            ))}
          </div>

          {/* Hint preview */}
          {currentRiddle.hint && (
            <div className="text-xs text-neutral-400 pt-1 flex items-start gap-1.5">
              <Lightbulb size={13} className="text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-amber-400 font-mono text-[10px] uppercase mr-1">
                  Hint Clue:
                </strong>
                {currentRiddle.hint}
              </span>
            </div>
          )}

          {/* Explanation preview */}
          {currentRiddle.explanation && (
            <div className="text-xs text-neutral-400 pt-1 border-t border-neutral-800/80">
              <strong className="text-neutral-300 font-mono text-[10px] uppercase block mb-0.5">
                Explanation Note:
              </strong>
              {currentRiddle.explanation}
            </div>
          )}
        </div>

        {/* 4. REAL-TIME SUBMISSION RADAR */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 text-center">
            <div className="text-[10px] font-mono uppercase text-neutral-400">Total Solvers</div>
            <div className="text-xl font-mono font-black text-white mt-0.5">
              {stats.totalSubmissions}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
            <div className="text-[10px] font-mono uppercase text-emerald-400">Correct</div>
            <div className="text-xl font-mono font-black text-emerald-400 mt-0.5">
              {stats.correctCount}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
            <div className="text-[10px] font-mono uppercase text-red-400">Incorrect</div>
            <div className="text-xl font-mono font-black text-red-400 mt-0.5">
              {stats.incorrectCount}
            </div>
          </div>
        </div>

        {/* 5. LEADERBOARD TABLE IN LEADERBOARD STAGE */}
        {currentStage === "leaderboard" && (
          <div className="mt-4 pt-4 border-t border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <Trophy size={14} />
                <span>Riddle Standings (Top 10)</span>
              </span>
              <span className="text-[10px] font-mono text-neutral-500">
                {leaderboard.length} Attendees Scored
              </span>
            </div>

            <div className="rounded-xl bg-neutral-900/80 border border-neutral-800 overflow-hidden divide-y divide-neutral-800/60 max-h-56 overflow-y-auto">
              {leaderboard.length === 0 ? (
                <div className="p-4 text-center text-xs text-neutral-500 font-mono">
                  Awaiting participant riddle submissions...
                </div>
              ) : (
                leaderboard.map((entry, idx) => (
                  <div
                    key={entry.participantId}
                    className="p-2.5 px-3 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono font-bold text-neutral-400 w-5">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                      </span>
                      <span className="font-bold text-white truncate">
                        {entry.name}
                      </span>
                    </div>
                    <span className="font-mono font-black text-orange-400 shrink-0">
                      {entry.totalScore} pts
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
