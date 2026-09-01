import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Grid,
  Clock,
  Play,
  Lock,
  Eye,
  Trophy,
  Users,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ChevronRight,
  ListOrdered,
  Layers,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { CanonicalLiveSession, LiveActivityStage } from "../../../types/liveEventEngine";
import {
  CrosswordActivityAdapter,
  CompiledCrosswordPayload,
  CrosswordLeaderboardEntry,
} from "../../../services/crosswordActivityAdapter";
import { LiveEventEngineService } from "../../../services/liveEventEngineService";

interface LiveCrosswordHostViewProps {
  eventId: string;
  activityId: string;
  session: CanonicalLiveSession;
  isActionPending: boolean;
  onStartActivity: () => Promise<void>;
  onFreezeActivity: () => Promise<void>;
  onRevealSolutions: () => Promise<void>;
  onShowLeaderboard: () => Promise<void>;
  onNextActivity: () => Promise<void>;
  onCompleteEvent: () => Promise<void>;
  isLastActivity: boolean;
}

export function LiveCrosswordHostView({
  eventId,
  activityId,
  session,
  isActionPending,
  onStartActivity,
  onFreezeActivity,
  onRevealSolutions,
  onShowLeaderboard,
  onNextActivity,
  onCompleteEvent,
  isLastActivity,
}: LiveCrosswordHostViewProps) {
  const [compiledPayload, setCompiledPayload] = useState<CompiledCrosswordPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submissionsCount, setSubmissionsCount] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<CrosswordLeaderboardEntry[]>([]);
  const [selectedClueId, setSelectedClueId] = useState<string | null>(null);

  // Drift-Free Timer
  const [timerData, setTimerData] = useState({
    remainingSeconds: 0,
    isExpired: false,
    progressPercentage: 0,
    formattedTime: "00:00",
  });

  const stage: LiveActivityStage = session.stage || "ready";
  const isRunning = stage === "running";
  const isFrozen = stage === "frozen";
  const isRevealed = stage === "reveal" || session.isRevealed;
  const isLeaderboard = stage === "leaderboard";
  const isReady = stage === "ready";

  // 1. Fetch complete crossword data for host (with full solution matrix)
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await CrosswordActivityAdapter.fetchCrosswordData(eventId, activityId);
        if (isMounted && data) {
          setCompiledPayload(data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Host failed to load crossword data:", err);
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [eventId, activityId]);

  // 2. Subscribe to submissions count
  useEffect(() => {
    if (!eventId || !activityId) return;
    const unsub = CrosswordActivityAdapter.subscribeSubmissionsCount(
      eventId,
      activityId,
      (count) => {
        setSubmissionsCount(count);
      }
    );
    return () => unsub();
  }, [eventId, activityId]);

  // 3. Subscribe to leaderboard in reveal/leaderboard stages
  useEffect(() => {
    if (!eventId || !activityId) return;
    const unsub = CrosswordActivityAdapter.subscribeCrosswordLeaderboard(
      eventId,
      activityId,
      10,
      (entries) => {
        setLeaderboard(entries);
      }
    );
    return () => unsub();
  }, [eventId, activityId]);

  // 4. Drift-Free Timer calculation
  useEffect(() => {
    if (!isRunning) {
      setTimerData({
        remainingSeconds: 0,
        isExpired: false,
        progressPercentage: 0,
        formattedTime: "00:00",
      });
      return;
    }

    const interval = setInterval(() => {
      const timing = LiveEventEngineService.calculateRemainingTime(session);
      setTimerData(timing);
    }, 250);

    return () => clearInterval(interval);
  }, [session, isRunning]);

  if (loading || !compiledPayload) {
    return (
      <div className="p-12 text-center text-neutral-400 font-mono text-xs flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 animate-spin">
          <Grid size={20} />
        </div>
        <span>Loading Authoritative Crossword Data...</span>
      </div>
    );
  }

  const { activity, gridConfig, compiledGrid, entries } = compiledPayload;
  const acrossClues = entries.filter((e) => e.direction === "across");
  const downClues = entries.filter((e) => e.direction === "down");

  const selectedClue = entries.find((e) => e.id === selectedClueId) || null;

  return (
    <div className="space-y-6">
      {/* 1. HOST CONTROL HEADER & STAGE RADAR */}
      <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Grid size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-mono uppercase tracking-wider font-bold">
                CROSSWORD DECK
              </span>
              <span className="text-xs font-mono text-neutral-400">
                {gridConfig.gridRows}x{gridConfig.gridCols} • {entries.length} Words • {compiledGrid.totalLetters} Letters
              </span>
            </div>
            <h2 className="text-lg font-black text-white mt-0.5">{activity.title}</h2>
          </div>
        </div>

        {/* Live Counters & Authoritative Timer */}
        <div className="flex items-center gap-3 self-stretch md:self-auto justify-between md:justify-end">
          <div className="px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-center">
            <div className="text-[10px] font-mono uppercase text-neutral-500 font-bold">ATTENDEE SUBMISSIONS</div>
            <div className="text-lg font-mono font-black text-emerald-400 flex items-center justify-center gap-1.5">
              <Users size={15} />
              <span>{submissionsCount}</span>
            </div>
          </div>

          <div
            className={`px-4 py-2.5 rounded-xl border text-center min-w-[130px] ${
              isRunning
                ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                : isFrozen
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : isRevealed
                ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                : "bg-neutral-950 border-neutral-800 text-neutral-400"
            }`}
          >
            <div className="text-[10px] font-mono uppercase font-bold tracking-wider">
              {isRunning
                ? "TIME REMAINING"
                : isFrozen
                ? "SUBMISSIONS FROZEN"
                : isRevealed
                ? "SOLUTIONS REVEALED"
                : isLeaderboard
                ? "STANDINGS ACTIVE"
                : "READY TO START"}
            </div>
            <div className="text-xl font-mono font-black tracking-wider mt-0.5">
              {isRunning ? timerData.formattedTime : `${Math.floor((activity.durationSeconds || 180) / 60)}:00`}
            </div>
          </div>
        </div>
      </div>

      {/* 2. HOST STAGE ACTION CONTROL BUTTONS */}
      <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase font-bold text-neutral-400">Current Stage:</span>
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black uppercase border ${
              isReady
                ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                : isRunning
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : isFrozen
                ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                : isRevealed
                ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
                : "bg-orange-500/15 border-orange-500/30 text-orange-400"
            }`}
          >
            {stage.toUpperCase()}
          </span>
        </div>

        {/* Dynamic Actions for Crossword */}
        <div className="flex flex-wrap items-center gap-2">
          {isReady && (
            <button
              type="button"
              onClick={onStartActivity}
              disabled={isActionPending}
              className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-orange-500/20 cursor-pointer disabled:opacity-50"
            >
              <Play size={14} className="fill-black" />
              <span>Start Crossword & Timer</span>
            </button>
          )}

          {isRunning && (
            <>
              <button
                type="button"
                onClick={onFreezeActivity}
                disabled={isActionPending}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
              >
                <Lock size={14} />
                <span>Freeze Submissions</span>
              </button>
              <button
                type="button"
                onClick={onRevealSolutions}
                disabled={isActionPending}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-purple-600/20 cursor-pointer disabled:opacity-50"
              >
                <Eye size={14} />
                <span>Reveal Solutions</span>
              </button>
            </>
          )}

          {isFrozen && (
            <button
              type="button"
              onClick={onRevealSolutions}
              disabled={isActionPending}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-purple-600/20 cursor-pointer disabled:opacity-50"
            >
              <Eye size={14} />
              <span>Reveal Solutions</span>
            </button>
          )}

          {isRevealed && (
            <button
              type="button"
              onClick={onShowLeaderboard}
              disabled={isActionPending}
              className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-orange-500/20 cursor-pointer disabled:opacity-50"
            >
              <Trophy size={14} />
              <span>Present Crossword Leaderboard</span>
            </button>
          )}

          {isLeaderboard && (
            <button
              type="button"
              onClick={isLastActivity ? onCompleteEvent : onNextActivity}
              disabled={isActionPending}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            >
              <span>{isLastActivity ? "Conclude Live Event 🏁" : "Advance to Next Activity ➡️"}</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. HOST MATRIX PREVIEW & CLUES INSPECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Authoritative Solution Matrix */}
        <div className="lg:col-span-7 xl:col-span-8 p-5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xl flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
            <div className="text-xs font-mono font-black text-neutral-300 uppercase tracking-wider flex items-center gap-2">
              <Grid size={15} className="text-orange-400" />
              <span>Host Master Grid & Solution Key</span>
            </div>
            <span className="text-[11px] font-mono text-neutral-500">Live Preview</span>
          </div>

          <div
            className="p-3 sm:p-4 rounded-xl bg-neutral-950 border border-neutral-800 shadow-inner overflow-auto max-w-full"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${gridConfig.gridCols}, minmax(28px, 38px))`,
              gap: "3px",
            }}
          >
            {Array.from({ length: gridConfig.gridRows }).map((_, r) =>
              Array.from({ length: gridConfig.gridCols }).map((_, c) => {
                const cellKey = `${r},${c}`;
                const solChar = compiledGrid.matrix[r]?.[c];
                const clueNum = compiledGrid.cellStartNumberMap[cellKey];

                const isSelectedClueCell = selectedClue
                  ? selectedClue.direction === "across"
                    ? r === selectedClue.row && c >= selectedClue.col && c < selectedClue.col + selectedClue.length
                    : c === selectedClue.col && r >= selectedClue.row && r < selectedClue.row + selectedClue.length
                  : false;

                if (solChar === null || solChar === undefined) {
                  return (
                    <div
                      key={cellKey}
                      className="w-full aspect-square bg-neutral-900/60 rounded border border-neutral-900"
                    />
                  );
                }

                return (
                  <div
                    key={cellKey}
                    className={`relative w-full aspect-square rounded border text-xs sm:text-sm font-mono font-black flex items-center justify-center transition-all ${
                      isSelectedClueCell
                        ? "bg-orange-500 text-black border-orange-400 shadow-md ring-2 ring-orange-500/40"
                        : "bg-neutral-800 border-neutral-700 text-white"
                    }`}
                  >
                    {clueNum && (
                      <span
                        className={`absolute top-0.5 left-1 text-[8px] font-mono leading-none font-bold ${
                          isSelectedClueCell ? "text-black/80" : "text-neutral-400"
                        }`}
                      >
                        {clueNum}
                      </span>
                    )}
                    <span>{solChar}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Clues & Answers Breakdown */}
        <div className="lg:col-span-5 xl:col-span-4 p-5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xl flex flex-col space-y-4 max-h-[600px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3 shrink-0">
            <div className="text-xs font-mono font-black text-neutral-300 uppercase tracking-wider flex items-center gap-2">
              <ListOrdered size={15} className="text-orange-400" />
              <span>Clues & Answers ({entries.length})</span>
            </div>
            <span className="text-[10px] font-mono text-neutral-500">Click to highlight</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* Across */}
            <div className="space-y-2">
              <div className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider">
                Across ({acrossClues.length})
              </div>
              <div className="space-y-1.5">
                {acrossClues.map((clue) => {
                  const isSel = selectedClueId === clue.id;
                  return (
                    <div
                      key={clue.id}
                      onClick={() => setSelectedClueId(isSel ? null : clue.id)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSel
                          ? "bg-orange-500/15 border-orange-500/50 text-white shadow-md shadow-orange-500/10"
                          : "bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="font-mono font-black text-orange-400 w-5 shrink-0">
                          {clue.number}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="leading-snug">{clue.clue}</p>
                          <div className="flex items-center justify-between mt-1 text-[10px] font-mono">
                            <span className="text-neutral-500">({clue.length} letters)</span>
                            <span className="text-emerald-400 font-bold uppercase tracking-wider">
                              KEY: {clue.answer}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Down */}
            <div className="space-y-2">
              <div className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider">
                Down ({downClues.length})
              </div>
              <div className="space-y-1.5">
                {downClues.map((clue) => {
                  const isSel = selectedClueId === clue.id;
                  return (
                    <div
                      key={clue.id}
                      onClick={() => setSelectedClueId(isSel ? null : clue.id)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSel
                          ? "bg-orange-500/15 border-orange-500/50 text-white shadow-md shadow-orange-500/10"
                          : "bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="font-mono font-black text-orange-400 w-5 shrink-0">
                          {clue.number}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="leading-snug">{clue.clue}</p>
                          <div className="flex items-center justify-between mt-1 text-[10px] font-mono">
                            <span className="text-neutral-500">({clue.length} letters)</span>
                            <span className="text-emerald-400 font-bold uppercase tracking-wider">
                              KEY: {clue.answer}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. LIVE TOP 10 LEADERBOARD SUMMARY (In Reveal / Leaderboard Stages) */}
      {(isRevealed || isLeaderboard) && (
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2 text-orange-400 font-black text-sm uppercase tracking-wider">
              <Trophy size={18} />
              <span>Crossword Live Leaderboard Snapshot (Top 10)</span>
            </div>
            <span className="text-xs font-mono text-neutral-400">{leaderboard.length} Solvers Ranked</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {leaderboard.length === 0 ? (
              <div className="col-span-2 p-6 text-center text-xs font-mono text-neutral-500">
                No submissions recorded yet for this crossword.
              </div>
            ) : (
              leaderboard.map((entry, idx) => (
                <div
                  key={entry.participantId}
                  className="p-3 rounded-xl bg-neutral-950 border border-neutral-850 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-sm w-7 text-center">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-white truncate">{entry.name}</div>
                      <div className="text-[10px] font-mono text-neutral-400">
                        {entry.correctWordsCount}/{entry.totalWordsCount} Words • {entry.accuracyPercentage}% • {entry.timeTakenSec}s
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono font-black text-orange-400">{entry.score}</div>
                    <div className="text-[9px] font-mono text-neutral-500">PTS</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
