import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, Award, Medal, Crown, User, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";
import { QuizLeaderboardEntry } from "../../data/quizQuestions";

interface QuizLeaderboardViewProps {
  leaderboard: QuizLeaderboardEntry[];
  currentParticipantId?: string;
  isFinal?: boolean;
  title?: string;
}

export function QuizLeaderboardView({
  leaderboard,
  currentParticipantId,
  isFinal = false,
  title = "🏆 Leaderboard",
}: QuizLeaderboardViewProps) {
  const hasFiredConfetti = useRef(false);

  // Trigger confetti for 1st place or final completed screen
  useEffect(() => {
    if ((isFinal || leaderboard.length > 0) && !hasFiredConfetti.current) {
      hasFiredConfetti.current = true;
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#f59e0b", "#eab308", "#ec4899", "#3b82f6", "#10b981"],
        });
      } catch (err) {
        console.warn("Confetti error:", err);
      }
    }
  }, [isFinal, leaderboard]);

  // Sort entries descending by score, then by speed
  const sorted = [...leaderboard].sort((a, b) => b.currentScore - a.currentScore);

  const top3 = sorted.slice(0, 3);
  const places4to10 = sorted.slice(3, 10);

  // Find user's entry and rank
  const userIndex = sorted.findIndex((e) => e.participantId === currentParticipantId);
  const userEntry = userIndex !== -1 ? sorted[userIndex] : null;
  const userRank = userIndex !== -1 ? userIndex + 1 : null;
  const isUserInTop3 = userRank !== null && userRank <= 3;

  // Podium order: 2nd Place (left), 1st Place (center), 3rd Place (right)
  const first = top3[0] || null;
  const second = top3[1] || null;
  const third = top3[2] || null;

  return (
    <div className="w-full flex flex-col items-center justify-between space-y-6 text-left font-sans">
      {/* Title */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-500/10">
          <Sparkles size={13} />
          <span>{isFinal ? "FINAL STANDINGS" : "LIVE STANDINGS"}</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
          <span>{title}</span>
        </h2>
      </div>

      {/* Top 3 Animated Podium Container */}
      <div className="w-full max-w-xl grid grid-cols-3 gap-2 sm:gap-4 items-end pt-6 pb-2 min-h-[220px]">
        {/* 2nd Place (Left) */}
        <div className="flex flex-col items-center">
          {second ? (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-full flex flex-col items-center text-center space-y-2"
            >
              <div className="relative">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-800 border-2 border-slate-400 flex items-center justify-center text-white font-black text-sm shadow-xl overflow-hidden">
                  {second.photo ? (
                    <img src={second.photo} alt={second.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{second.name.substring(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-slate-400 text-slate-950 font-mono font-black text-[10px] shadow">
                  🥈 2nd
                </span>
              </div>

              <div className="space-y-0.5 pt-1 max-w-[100px] sm:max-w-[130px] truncate">
                <p className="text-xs font-black text-white truncate">{second.name}</p>
                <p className="text-xs font-mono font-bold text-slate-300">{second.currentScore} pts</p>
              </div>

              {/* Podium Bar */}
              <div className="w-full h-24 sm:h-28 rounded-t-2xl bg-gradient-to-t from-slate-900 via-slate-800 to-slate-700/80 border-t-2 border-slate-400 flex items-center justify-center shadow-2xl">
                <span className="font-mono font-black text-2xl text-slate-300/40">2</span>
              </div>
            </motion.div>
          ) : (
            <div className="w-full h-24 rounded-t-2xl bg-neutral-900/40 border-t border-neutral-800" />
          )}
        </div>

        {/* 1st Place (Center - Highest) */}
        <div className="flex flex-col items-center">
          {first ? (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="w-full flex flex-col items-center text-center space-y-2 relative"
            >
              <Crown size={24} className="text-amber-400 animate-bounce absolute -top-7" />
              <div className="relative">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-950 border-2 border-amber-400 flex items-center justify-center text-amber-300 font-black text-base shadow-2xl shadow-amber-500/20 overflow-hidden ring-4 ring-amber-500/20">
                  {first.photo ? (
                    <img src={first.photo} alt={first.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{first.name.substring(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 font-mono font-black text-[10px] shadow-lg">
                  🥇 1st
                </span>
              </div>

              <div className="space-y-0.5 pt-1 max-w-[110px] sm:max-w-[140px] truncate">
                <p className="text-xs sm:text-sm font-black text-amber-300 truncate">{first.name}</p>
                <p className="text-xs sm:text-sm font-mono font-black text-amber-400">{first.currentScore} pts</p>
              </div>

              {/* Podium Bar */}
              <div className="w-full h-32 sm:h-36 rounded-t-2xl bg-gradient-to-t from-amber-950 via-amber-900 to-amber-600/80 border-t-2 border-amber-400 flex items-center justify-center shadow-2xl">
                <span className="font-mono font-black text-3xl text-amber-400/40">1</span>
              </div>
            </motion.div>
          ) : (
            <div className="w-full h-32 rounded-t-2xl bg-neutral-900/40 border-t border-neutral-800" />
          )}
        </div>

        {/* 3rd Place (Right) */}
        <div className="flex flex-col items-center">
          {third ? (
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="w-full flex flex-col items-center text-center space-y-2"
            >
              <div className="relative">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-950/60 border-2 border-amber-700 flex items-center justify-center text-amber-500 font-black text-sm shadow-xl overflow-hidden">
                  {third.photo ? (
                    <img src={third.photo} alt={third.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{third.name.substring(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-700 text-amber-100 font-mono font-black text-[10px] shadow">
                  🥉 3rd
                </span>
              </div>

              <div className="space-y-0.5 pt-1 max-w-[100px] sm:max-w-[130px] truncate">
                <p className="text-xs font-black text-white truncate">{third.name}</p>
                <p className="text-xs font-mono font-bold text-amber-500">{third.currentScore} pts</p>
              </div>

              {/* Podium Bar */}
              <div className="w-full h-20 sm:h-22 rounded-t-2xl bg-gradient-to-t from-neutral-950 via-amber-950/80 to-amber-800/60 border-t-2 border-amber-700 flex items-center justify-center shadow-2xl">
                <span className="font-mono font-black text-2xl text-amber-700/40">3</span>
              </div>
            </motion.div>
          ) : (
            <div className="w-full h-20 rounded-t-2xl bg-neutral-900/40 border-t border-neutral-800" />
          )}
        </div>
      </div>

      {/* Positions 4 to 10 List */}
      <div className="w-full max-w-xl space-y-2">
        <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block px-1">
          Top Rankings (4 - 10)
        </span>

        {places4to10.length === 0 ? (
          <p className="text-xs font-mono text-neutral-500 italic p-3 text-center bg-neutral-900/40 rounded-xl border border-neutral-800/60">
            No additional participants ranked yet.
          </p>
        ) : (
          <div className="space-y-1.5">
            {places4to10.map((entry, idx) => {
              const rank = idx + 4;
              const isCurrentUser = entry.participantId === currentParticipantId;

              return (
                <motion.div
                  key={entry.participantId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * idx }}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium transition-all ${
                    isCurrentUser
                      ? "bg-orange-500/20 border-orange-500 text-white shadow-lg ring-1 ring-orange-500/50"
                      : "bg-neutral-900/80 border-neutral-800 text-neutral-300 hover:bg-neutral-850"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-neutral-800 text-neutral-400 font-mono font-extrabold text-xs flex items-center justify-center shrink-0">
                      {rank}
                    </span>
                    <span className="font-black text-white truncate max-w-[180px] sm:max-w-xs">
                      {entry.name} {isCurrentUser && " (You)"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 font-mono">
                    <span className="text-[10px] text-neutral-400 hidden sm:inline">
                      {entry.correctAnswers} / {entry.questionsAnswered} Correct
                    </span>
                    <span className="font-black text-orange-400 text-sm">
                      {entry.currentScore} pts
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* User Rank Card if outside Top 3 */}
      {userEntry && !isUserInTop3 && (
        <div className="w-full max-w-xl p-4 rounded-2xl bg-gradient-to-r from-orange-500/20 via-neutral-900 to-neutral-900 border-2 border-orange-500/60 text-white flex items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 font-mono font-black text-sm flex items-center justify-center">
              #{userRank}
            </div>
            <div>
              <span className="text-xs font-mono font-bold text-orange-300 block uppercase tracking-wider">
                YOUR RANK & SCORE
              </span>
              <span className="text-sm font-black text-white block">
                {userEntry.name}
              </span>
            </div>
          </div>

          <div className="text-right font-mono">
            <span className="text-xs text-neutral-400 block">Current Score</span>
            <span className="text-lg font-black text-orange-400">
              {userEntry.currentScore} pts
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
