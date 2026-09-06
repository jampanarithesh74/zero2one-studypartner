/**
 * ZERO2ONE EVENTS — FEATURE 6A
 * LIVE WALL: QUIZ ACTIVITY STAGE COMPONENT
 *
 * Full-screen projector presentation for live quiz questions, countdown timer,
 * real-time option selection distributions, solution reveals, and round leaderboards.
 */

import { motion } from "motion/react";
import { 
  Trophy, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  HelpCircle, 
  Radio, 
  Pause, 
  Eye, 
  Users,
  Award,
  Medal,
  Flame
} from "lucide-react";
import { GenericQuizQuestion } from "../../../services/quizBuilderService";
import { CanonicalLiveSession } from "../../../types/liveEventEngine";
import { QuizQuestionStats, QuizLeaderboardEntry } from "../../../services/quizActivityAdapter";

interface LiveWallQuizProps {
  session: CanonicalLiveSession;
  question: GenericQuizQuestion | null;
  questionIndex: number;
  totalQuestions: number;
  remainingSeconds: number;
  progressPercentage: number;
  stats: QuizQuestionStats;
  leaderboard: QuizLeaderboardEntry[];
}

export function LiveWallQuiz({
  session,
  question,
  questionIndex,
  totalQuestions,
  remainingSeconds,
  progressPercentage,
  stats,
  leaderboard,
}: LiveWallQuizProps) {
  const stage = session.stage;
  const isRunning = stage === "running";
  const isFrozen = stage === "frozen";
  const isReveal = stage === "reveal";
  const isLeaderboard = stage === "leaderboard";
  const isReady = stage === "ready";

  const optionLabels = ["A", "B", "C", "D"];
  const optionColors = [
    { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", badge: "bg-red-500 text-white" },
    { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", badge: "bg-blue-500 text-white" },
    { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", badge: "bg-amber-500 text-white" },
    { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", badge: "bg-emerald-500 text-white" },
  ];

  // LEADERBOARD VIEW
  if (isLeaderboard) {
    return (
      <div className="w-full h-full flex flex-col justify-between p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
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
                {session.currentActivityTitle || "Quiz Standings"}
              </h2>
            </div>
          </div>

          <div className="px-4 py-2 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-300">
            Top Performers
          </div>
        </div>

        {/* Top 10 List */}
        <div className="flex-1 overflow-y-auto max-h-[520px] space-y-2.5 pr-2">
          {leaderboard.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-neutral-400 font-mono text-sm">
              Calculating round standings...
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
                          ? "bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/30"
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
                      <span className="text-emerald-400 font-bold">{entry.correctAnswersCount}</span> correct
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
  if (isReady || !question) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 max-w-2xl mx-auto text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-2xl">
          <HelpCircle size={40} className="animate-pulse" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-blue-400">
            QUESTION READY
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Question {questionIndex + 1} of {totalQuestions}
          </h2>
          <p className="text-sm font-mono text-neutral-400">
            Host is priming the timer. Get ready on your mobile device!
          </p>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono text-neutral-400 bg-neutral-900/80 border border-neutral-800 rounded-2xl px-6 py-3">
          <div>Time Limit: <span className="text-white font-bold">{question?.timeLimitSec || 15}s</span></div>
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
          <div>Base Points: <span className="text-white font-bold">{question?.points || 100}</span></div>
        </div>
      </div>
    );
  }

  // ACTIVE QUESTION VIEW (Running, Frozen, Reveal)
  return (
    <div className="w-full h-full flex flex-col justify-between p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Bar: Question Index + Stage Badge + Countdown */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono font-black text-orange-400">
            Q {questionIndex + 1} / {totalQuestions}
          </span>
          <span className="text-xs font-mono text-neutral-400 hidden sm:inline">
            Points: <strong className="text-white">{question.points || 100}</strong>
          </span>
        </div>

        {/* Stage Status Badge */}
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
              <Radio size={12} />
              LIVE TIMER
            </span>
          )}
          {isFrozen && (
            <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-mono font-black uppercase tracking-widest flex items-center gap-1.5">
              <Pause size={12} />
              SUBMISSIONS FROZEN
            </span>
          )}
          {isReveal && (
            <span className="px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-mono font-black uppercase tracking-widest flex items-center gap-1.5">
              <Eye size={12} />
              ANSWER REVEALED
            </span>
          )}
        </div>

        {/* Timer Display */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-neutral-900 border border-neutral-800">
          <Clock size={16} className={isRunning ? "text-orange-400 animate-pulse" : "text-neutral-500"} />
          <span className="text-base font-mono font-black text-white">
            {remainingSeconds}s
          </span>
        </div>
      </div>

      {/* Progress Bar (Timer) */}
      {isRunning && (
        <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
          <motion.div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-400"
            style={{ width: `${100 - progressPercentage}%` }}
            transition={{ duration: 0.3, ease: "linear" }}
          />
        </div>
      )}

      {/* Main Question Display */}
      <div className="p-6 sm:p-10 rounded-3xl bg-neutral-900/90 border border-neutral-800 backdrop-blur-md shadow-2xl text-center space-y-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-snug">
          {question.text}
        </h1>
      </div>

      {/* Options Grid (2x2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {question.options.map((opt, idx) => {
          const isCorrect = isReveal && idx === question.correctOptionIndex;
          const isWrong = isReveal && idx !== question.correctOptionIndex;
          const count = stats.optionCounts[idx] || 0;
          const percent = stats.totalSubmissions > 0 ? Math.round((count / stats.totalSubmissions) * 100) : 0;
          const style = optionColors[idx] || optionColors[0];

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className={`p-5 rounded-2xl border relative overflow-hidden transition-all flex items-center justify-between gap-4 ${
                isCorrect
                  ? "bg-emerald-500/20 border-emerald-400 shadow-xl shadow-emerald-500/10 scale-[1.02]"
                  : isWrong
                  ? "bg-neutral-950/60 border-neutral-850 opacity-50"
                  : `${style.bg} ${style.border}`
              }`}
            >
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <span
                  className={`w-9 h-9 rounded-xl font-mono font-black text-sm flex items-center justify-center shrink-0 shadow-md ${
                    isCorrect ? "bg-emerald-500 text-neutral-950" : style.badge
                  }`}
                >
                  {isCorrect ? <CheckCircle2 size={18} /> : optionLabels[idx]}
                </span>
                <span className="text-base sm:text-lg font-bold text-white truncate">
                  {opt}
                </span>
              </div>

              {/* Submissions Bar / Percentage if Frozen or Revealed */}
              {(isFrozen || isReveal) && (
                <div className="flex items-center gap-2 shrink-0 font-mono">
                  <span className="text-xs font-bold text-neutral-300">{count} votes</span>
                  <span className="text-xs px-2 py-0.5 rounded-lg bg-neutral-900 border border-neutral-800 text-white font-black">
                    {percent}%
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Explanation Banner on Reveal */}
      {isReveal && question.explanation && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-200 text-xs sm:text-sm font-sans flex items-start gap-3 shadow-lg"
        >
          <Sparkles size={18} className="text-purple-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-purple-300 font-bold block mb-0.5">Explanation:</strong>
            {question.explanation}
          </div>
        </motion.div>
      )}

      {/* Footer Radar */}
      <div className="flex items-center justify-between text-xs font-mono text-neutral-400 pt-2 border-t border-neutral-850">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-orange-400" />
          <span>Responses: <strong className="text-white">{stats.totalSubmissions}</strong></span>
        </div>
        <div className="flex items-center gap-1.5 text-neutral-500">
          <Flame size={14} className="text-orange-500" />
          <span>Speed bonus active for early answers</span>
        </div>
      </div>
    </div>
  );
}
