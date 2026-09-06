/**
 * ZERO2ONE EVENTS — FEATURE 6A
 * LIVE WALL: CROSSWORD ACTIVITY STAGE COMPONENT
 *
 * Full-screen projector presentation for live crossword puzzle, grid matrix,
 * across & down clues, solution reveals, and round leaderboards.
 */

import { motion } from "motion/react";
import { 
  Trophy, 
  Clock, 
  Grid, 
  CheckCircle2, 
  Radio, 
  Pause, 
  Eye, 
  Award,
  Medal,
  Users
} from "lucide-react";
import { CanonicalLiveSession } from "../../../types/liveEventEngine";
import { CompiledCrosswordPayload, CrosswordLeaderboardEntry } from "../../../services/crosswordActivityAdapter";

interface LiveWallCrosswordProps {
  session: CanonicalLiveSession;
  payload: CompiledCrosswordPayload | null;
  remainingSeconds: number;
  progressPercentage: number;
  leaderboard: CrosswordLeaderboardEntry[];
}

export function LiveWallCrossword({
  session,
  payload,
  remainingSeconds,
  progressPercentage,
  leaderboard,
}: LiveWallCrosswordProps) {
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
                {session.currentActivityTitle || "Crossword Standings"}
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
              Calculating crossword standings...
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
                      <span className="text-emerald-400 font-bold">{entry.correctWordsCount}</span> / {entry.totalWordsCount} words ({entry.accuracyPercentage}%)
                    </div>
                    <div className="px-4 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm font-mono font-black text-orange-400">
                      {entry.score.toLocaleString()} PTS
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
  if (isReady || !payload) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 max-w-2xl mx-auto text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shadow-2xl">
          <Grid size={40} className="animate-pulse" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-orange-400">
            CROSSWORD CHALLENGE READY
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            {payload?.activity.title || "Interactive Crossword Puzzle"}
          </h2>
          <p className="text-sm font-mono text-neutral-400">
            {payload?.activity.description || "Solve across & down clues synchronously on your mobile device."}
          </p>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono text-neutral-400 bg-neutral-900/80 border border-neutral-800 rounded-2xl px-6 py-3">
          <div>Grid Size: <span className="text-white font-bold">{payload?.gridConfig.gridRows || 12}x{payload?.gridConfig.gridCols || 12}</span></div>
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
          <div>Words: <span className="text-white font-bold">{payload?.compiledGrid.computedEntries.length || 0}</span></div>
          <div className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
          <div>Time Limit: <span className="text-white font-bold">{payload?.activity.durationSeconds || 180}s</span></div>
        </div>
      </div>
    );
  }

  const { compiledGrid, gridConfig } = payload;
  const matrix = compiledGrid.matrix;
  const startNumMap = compiledGrid.cellStartNumberMap;
  const entries = compiledGrid.computedEntries;

  const acrossClues = entries.filter((e) => e.direction === "across").sort((a, b) => a.number - b.number);
  const downClues = entries.filter((e) => e.direction === "down").sort((a, b) => a.number - b.number);

  return (
    <div className="w-full h-full flex flex-col justify-between p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header Strip */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center">
            <Grid size={18} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
              {payload.activity.title}
            </h2>
            <span className="text-[11px] font-mono text-neutral-400">
              {entries.length} Words • {compiledGrid.totalLetters} Letters
            </span>
          </div>
        </div>

        {/* Stage Status */}
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
              <Radio size={12} />
              SOLVING IN PROGRESS
            </span>
          )}
          {isFrozen && (
            <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-mono font-black uppercase tracking-widest flex items-center gap-1.5">
              <Pause size={12} />
              PUZZLE FROZEN
            </span>
          )}
          {isReveal && (
            <span className="px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-mono font-black uppercase tracking-widest flex items-center gap-1.5">
              <Eye size={12} />
              SOLUTION REVEALED
            </span>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800">
            <Clock size={14} className={isRunning ? "text-orange-400 animate-pulse" : "text-neutral-500"} />
            <span className="text-sm font-mono font-black text-white">
              {Math.floor(remainingSeconds / 60)}:{(remainingSeconds % 60).toString().padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>

      {/* Main Area: Left Grid Matrix, Right Clues List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 items-start">
        {/* Left: Crossword Grid */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center p-4 bg-neutral-950/80 rounded-3xl border border-neutral-800 shadow-2xl overflow-hidden">
          <div
            className="grid gap-1 max-w-full"
            style={{
              gridTemplateColumns: `repeat(${gridConfig.gridCols}, minmax(0, 1fr))`,
            }}
          >
            {matrix.map((row, rIdx) =>
              row.map((cellLetter, cIdx) => {
                const isActive = cellLetter !== null;
                const cellKey = `${rIdx},${cIdx}`;
                const startNum = startNumMap[cellKey];

                if (!isActive) {
                  return (
                    <div
                      key={cellKey}
                      className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 bg-neutral-900/60 rounded-md border border-neutral-850"
                    />
                  );
                }

                return (
                  <div
                    key={cellKey}
                    className={`w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-md border relative flex items-center justify-center font-mono font-black text-sm transition-all ${
                      isReveal
                        ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-sm"
                        : "bg-neutral-850 border-neutral-700 text-neutral-300"
                    }`}
                  >
                    {startNum && (
                      <span className="absolute top-0.5 left-0.5 text-[8px] font-mono text-neutral-400 leading-none">
                        {startNum}
                      </span>
                    )}
                    <span>{isReveal ? cellLetter : ""}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Across & Down Clues */}
        <div className="lg:col-span-5 flex flex-col gap-4 max-h-[480px] overflow-y-auto pr-1">
          {/* Across */}
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-orange-400">
              ACROSS CLUES ({acrossClues.length})
            </h3>
            <div className="space-y-1.5">
              {acrossClues.map((c) => (
                <div key={c.id || c.number} className="text-xs text-neutral-300 flex items-start gap-2">
                  <span className="w-5 h-5 rounded bg-neutral-800 text-orange-400 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                    {c.number}
                  </span>
                  <div className="flex-1">
                    <span>{c.clue}</span>
                    <span className="text-[10px] font-mono text-neutral-500 ml-1">({c.length} letters)</span>
                    {isReveal && (
                      <span className="block text-[11px] font-mono font-black text-emerald-400 mt-0.5">
                        Answer: {c.answer}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Down */}
          <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-orange-400">
              DOWN CLUES ({downClues.length})
            </h3>
            <div className="space-y-1.5">
              {downClues.map((c) => (
                <div key={c.id || c.number} className="text-xs text-neutral-300 flex items-start gap-2">
                  <span className="w-5 h-5 rounded bg-neutral-800 text-orange-400 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                    {c.number}
                  </span>
                  <div className="flex-1">
                    <span>{c.clue}</span>
                    <span className="text-[10px] font-mono text-neutral-500 ml-1">({c.length} letters)</span>
                    {isReveal && (
                      <span className="block text-[11px] font-mono font-black text-emerald-400 mt-0.5">
                        Answer: {c.answer}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs font-mono text-neutral-400 pt-2 border-t border-neutral-850">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-orange-400" />
          <span>Active Solvers: <strong className="text-white">{leaderboard.length}</strong></span>
        </div>
        <div>
          Correct answers: +100 pts/word • Speed bonus on full solve
        </div>
      </div>
    </div>
  );
}
