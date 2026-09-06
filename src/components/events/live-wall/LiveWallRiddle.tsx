/**
 * ZERO2ONE EVENTS — FEATURE 6A
 * LIVE WALL: RIDDLE ACTIVITY STAGE COMPONENT
 *
 * Full-screen projector presentation for live riddles, answer length blocks,
 * hint reveals, live answer stream / word cloud, and round leaderboards.
 */

import { motion } from "motion/react";
import { 
  Trophy, 
  Clock, 
  Sparkles, 
  HelpCircle, 
  Radio, 
  Pause, 
  Eye, 
  Users,
  Award,
  Medal,
  Flame,
  Lightbulb
} from "lucide-react";
import { CanonicalLiveSession } from "../../../types/liveEventEngine";
import { GenericRiddleEntry } from "../../../services/riddleBuilderService";
import { RiddleSubmissionStats, RiddleLeaderboardEntry } from "../../../services/riddleActivityAdapter";

interface LiveWallRiddleProps {
  session: CanonicalLiveSession;
  riddle: GenericRiddleEntry | null;
  riddleIndex: number;
  totalRiddles: number;
  remainingSeconds: number;
  progressPercentage: number;
  stats: RiddleSubmissionStats;
  leaderboard: RiddleLeaderboardEntry[];
}

export function LiveWallRiddle({
  session,
  riddle,
  riddleIndex,
  totalRiddles,
  remainingSeconds,
  progressPercentage,
  stats,
  leaderboard,
}: LiveWallRiddleProps) {
  const stage = session.stage;
  const isRunning = stage === "running";
  const isFrozen = stage === "frozen";
  const isReveal = stage === "reveal";
  const isLeaderboard = stage === "leaderboard";
  const isReady = stage === "ready";

  // LEADERBOARD VIEW
  if (isLeaderboard) {
    return (
      <div className="w-full h-full flex flex-col justify-between p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shadow-lg">
              <Trophy size={24} />
            </div>
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-orange-400">
                ROUND LEADERBOARD
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {session.currentActivityTitle || "Riddle Standings"}
              </h2>
            </div>
          </div>

          <div className="px-4 py-2 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-300">
            Top Solvers
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[520px] space-y-2.5 pr-2">
          {leaderboard.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-neutral-400 font-mono text-sm">
              Calculating riddle standings...
            </div>
          ) : (
            leaderboard.slice(0, 10).map((entry, idx) => {
              const isFirst = idx === 0;
              const isSecond = idx === 1;
              const isThird = idx === 2;

              return (
                <motion.div
                  key={entry.participantId || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    isFirst
                      ? "bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/5"
                      : isSecond
                      ? "bg-neutral-800/60 border-neutral-700"
                      : isThird
                      ? "bg-amber-900/10 border-amber-800/30"
                      : "bg-neutral-900/60 border-neutral-800"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-9 h-9 rounded-xl font-mono font-black text-sm flex items-center justify-center ${
                        isFirst
                          ? "bg-amber-500 text-neutral-950 shadow-md"
                          : isSecond
                          ? "bg-neutral-300 text-neutral-950"
                          : isThird
                          ? "bg-amber-700 text-white"
                          : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {isFirst ? <Award size={18} /> : isSecond ? <Medal size={16} /> : `#${idx + 1}`}
                    </div>

                    <div>
                      <span className="text-base font-bold text-white block">
                        {entry.name}
                      </span>
                      {entry.college && (
                        <span className="text-xs text-neutral-400 font-mono">
                          {entry.college} {entry.department ? `• ${entry.department}` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div className="hidden sm:block text-xs font-mono text-neutral-400">
                      <span className="text-emerald-400 font-bold">{entry.correctAnswersCount}</span> / {entry.totalAnswered} solved
                    </div>
                    <div className="px-4 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm font-mono font-black text-orange-400">
                      {entry.totalScore.toLocaleString()} PTS
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // READY / BRIEFING VIEW
  if (isReady || !riddle) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 max-w-2xl mx-auto text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shadow-2xl">
          <HelpCircle size={40} className="animate-pulse" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-purple-400">
            RIDDLE READY
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Riddle {riddleIndex + 1} of {totalRiddles}
          </h2>
          <p className="text-sm font-mono text-neutral-400">
            Host is priming the riddle stage. Think fast and prepare to type your answer!
          </p>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono text-neutral-400 bg-neutral-900/80 border border-neutral-800 rounded-2xl px-6 py-3">
          <div>Time Limit: <span className="text-white font-bold">{riddle?.timeLimitSec || 20}s</span></div>
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
          <div>Points: <span className="text-white font-bold">{riddle?.points || 100}</span></div>
        </div>
      </div>
    );
  }

  const cleanAns = (riddle.answer || "").trim().toUpperCase();
  const ansLength = Math.max(cleanAns.length, 1);

  return (
    <div className="w-full h-full flex flex-col justify-between p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono font-black text-purple-400">
            RIDDLE {riddleIndex + 1} / {totalRiddles}
          </span>
          {riddle.title && (
            <span className="text-xs font-mono text-neutral-400 hidden sm:inline">
              "{riddle.title}"
            </span>
          )}
        </div>

        {/* Stage Status */}
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
              <Radio size={12} />
              LIVE GUESSING
            </span>
          )}
          {isFrozen && (
            <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-mono font-black uppercase tracking-widest flex items-center gap-1.5">
              <Pause size={12} />
              LOCKED FOR DISCUSSION
            </span>
          )}
          {isReveal && (
            <span className="px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-mono font-black uppercase tracking-widest flex items-center gap-1.5">
              <Eye size={12} />
              SOLUTION REVEALED
            </span>
          )}
        </div>

        {/* Timer */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-neutral-900 border border-neutral-800">
          <Clock size={16} className={isRunning ? "text-purple-400 animate-pulse" : "text-neutral-500"} />
          <span className="text-base font-mono font-black text-white">
            {remainingSeconds}s
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      {isRunning && (
        <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-400"
            style={{ width: `${100 - progressPercentage}%` }}
            transition={{ duration: 0.3, ease: "linear" }}
          />
        </div>
      )}

      {/* Main Riddle Card */}
      <div className="p-6 sm:p-10 rounded-3xl bg-neutral-900/90 border border-neutral-800 backdrop-blur-md shadow-2xl text-center space-y-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-relaxed italic">
          "{riddle.riddleText}"
        </h1>

        {/* Hint Pill if available */}
        {riddle.hint && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
            <Lightbulb size={14} className="text-amber-400" />
            <span>Hint: {riddle.hint}</span>
          </div>
        )}
      </div>

      {/* Letter Box Slots or Reveal Solution */}
      <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-neutral-950/80 border border-neutral-800 space-y-3">
        <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
          {isReveal ? "OFFICIAL SOLUTION" : `WORD LENGTH (${ansLength} LETTERS)`}
        </span>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: ansLength }).map((_, idx) => {
            const letter = isReveal ? cleanAns[idx] : "";
            return (
              <div
                key={idx}
                className={`w-10 h-12 sm:w-12 sm:h-14 rounded-xl border flex items-center justify-center font-mono font-black text-xl sm:text-2xl shadow-lg transition-all ${
                  isReveal
                    ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 scale-105"
                    : "bg-neutral-900 border-neutral-700 text-neutral-600"
                }`}
              >
                {letter || "_"}
              </div>
            );
          })}
        </div>

        {isReveal && riddle.explanation && (
          <p className="text-xs sm:text-sm text-neutral-300 font-sans max-w-xl text-center pt-2">
            {riddle.explanation}
          </p>
        )}
      </div>

      {/* Live Answers Word Bubble Stream */}
      {stats.recentSubmissions && stats.recentSubmissions.length > 0 && !isLeaderboard && (
        <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
          <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest block">
            LIVE AUDIENCE RESPONSES
          </span>
          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
            {stats.recentSubmissions.slice(0, 16).map((sub, idx) => (
              <span
                key={sub.id || idx}
                className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border ${
                  isReveal && sub.isCorrect
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-neutral-950 border-neutral-800 text-neutral-300"
                }`}
              >
                {sub.userAnswer}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs font-mono text-neutral-400 pt-2 border-t border-neutral-850">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-purple-400" />
          <span>Guesses Submitted: <strong className="text-white">{stats.totalSubmissions}</strong></span>
          {stats.correctCount > 0 && (
            <span className="text-emerald-400 font-bold ml-2">({stats.correctCount} correct)</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-neutral-500">
          <Flame size={14} className="text-purple-400" />
          <span>Case-insensitive matching active</span>
        </div>
      </div>
    </div>
  );
}
