import { useState, useEffect, useMemo, useRef, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Clock,
  CheckCircle2,
  Trophy,
  AlertCircle,
  HelpCircle,
  Send,
  Lock,
  Eye,
  RotateCcw,
  Check,
  Grid,
  ChevronRight,
  ListOrdered,
  Award,
} from "lucide-react";
import { CanonicalLiveSession } from "../../../types/liveEventEngine";
import {
  CrosswordActivityAdapter,
  CompiledCrosswordPayload,
  SanitizedCrosswordData,
  SanitizedCrosswordEntry,
  CrosswordLeaderboardEntry,
  CrosswordSubmissionRecord,
} from "../../../services/crosswordActivityAdapter";
import { LiveEventEngineService } from "../../../services/liveEventEngineService";

interface LiveCrosswordParticipantViewProps {
  eventId: string;
  activityId: string;
  session: CanonicalLiveSession;
  participant: {
    id: string;
    name: string;
    college?: string;
    department?: string;
  };
}

export function LiveCrosswordParticipantView({
  eventId,
  activityId,
  session,
  participant,
}: LiveCrosswordParticipantViewProps) {
  const [compiledPayload, setCompiledPayload] = useState<CompiledCrosswordPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Participant Grid State: "row,col" -> letter (A-Z)
  const [userGrid, setUserGrid] = useState<Record<string, string>>({});
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [activeDirection, setActiveDirection] = useState<"across" | "down">("across");

  // Submission State
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionRecord, setSubmissionRecord] = useState<CrosswordSubmissionRecord | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);

  // Leaderboard data
  const [leaderboard, setLeaderboard] = useState<CrosswordLeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"puzzle" | "leaderboard">("puzzle");

  // Local drift-free timer state
  const [timerData, setTimerData] = useState({
    remainingSeconds: 0,
    isExpired: false,
    progressPercentage: 0,
    formattedTime: "00:00",
  });

  const cellInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const startTimeRef = useRef<number>(Date.now());

  const isRevealedStage = session.stage === "reveal" || session.isRevealed;
  const isFrozenStage = session.stage === "frozen" || session.isFrozen;
  const isLeaderboardStage = session.stage === "leaderboard";
  const isRunningStage = session.stage === "running";
  const isReadyStage = session.stage === "ready";

  const isInteractionDisabled = isFrozenStage || isRevealedStage || isLeaderboardStage || isReadyStage || hasSubmitted;

  // 1. Fetch Crossword Activity Data (Point-in-time read)
  useEffect(() => {
    let isMounted = true;
    async function loadCrossword() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await CrosswordActivityAdapter.fetchCrosswordData(eventId, activityId);
        if (isMounted) {
          if (data) {
            setCompiledPayload(data);
          } else {
            setLoadError("Crossword puzzle not found or not configured.");
          }
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Failed to load crossword puzzle:", err);
        if (isMounted) {
          setLoadError(err.message || "Failed to load crossword puzzle.");
          setLoading(false);
        }
      }
    }

    loadCrossword();
    return () => {
      isMounted = false;
    };
  }, [eventId, activityId]);

  // 2. Restore cached user progress & submission state from localStorage
  useEffect(() => {
    if (!activityId || !participant.id) return;

    startTimeRef.current = session.stageStartedAt || Date.now();
    const gridStorageKey = `z2o_crossword_grid_${eventId}_${activityId}_${participant.id}`;
    const subStorageKey = `z2o_crossword_sub_${eventId}_${activityId}_${participant.id}`;

    try {
      const cachedGrid = localStorage.getItem(gridStorageKey);
      if (cachedGrid) {
        setUserGrid(JSON.parse(cachedGrid));
      } else {
        setUserGrid({});
      }

      const cachedSub = localStorage.getItem(subStorageKey);
      if (cachedSub) {
        setHasSubmitted(true);
        try {
          setSubmissionRecord(JSON.parse(cachedSub));
        } catch {
          // ignore parsing error
        }
      } else {
        setHasSubmitted(false);
        setSubmissionRecord(null);
      }
    } catch (e) {
      console.warn("Storage read error:", e);
    }
  }, [eventId, activityId, participant.id, session.stageStartedAt]);

  // 3. Save local grid edits to localStorage (0 Firestore writes during typing)
  const handleCellInput = (row: number, col: number, char: string) => {
    if (isInteractionDisabled) return;

    const upper = char.replace(/[^a-zA-Z]/g, "").toUpperCase();
    const cellKey = `${row},${col}`;
    const nextGrid = { ...userGrid };

    if (upper) {
      nextGrid[cellKey] = upper.slice(-1);
    } else {
      delete nextGrid[cellKey];
    }

    setUserGrid(nextGrid);

    // Persist locally
    const storageKey = `z2o_crossword_grid_${eventId}_${activityId}_${participant.id}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextGrid));
    } catch (e) {
      console.warn("Local storage write failed:", e);
    }

    // Auto-advance cursor to next cell in active direction
    if (upper && compiledPayload) {
      moveToNextCell(row, col, activeDirection);
    }
  };

  // Move focus to next adjacent interactive cell in direction
  const moveToNextCell = (r: number, c: number, direction: "across" | "down") => {
    if (!compiledPayload) return;
    const { gridConfig, compiledGrid } = compiledPayload;

    const nextR = direction === "down" ? r + 1 : r;
    const nextC = direction === "across" ? c + 1 : c;

    if (nextR < gridConfig.gridRows && nextC < gridConfig.gridCols) {
      if (compiledGrid.matrix[nextR]?.[nextC] !== null) {
        setSelectedCell({ row: nextR, col: nextC });
        cellInputRefs.current[`${nextR},${nextC}`]?.focus();
      }
    }
  };

  // Move focus to previous adjacent interactive cell
  const moveToPrevCell = (r: number, c: number, direction: "across" | "down") => {
    if (!compiledPayload) return;
    const { compiledGrid } = compiledPayload;

    const prevR = direction === "down" ? r - 1 : r;
    const prevC = direction === "across" ? c - 1 : c;

    if (prevR >= 0 && prevC >= 0) {
      if (compiledGrid.matrix[prevR]?.[prevC] !== null) {
        setSelectedCell({ row: prevR, col: prevC });
        cellInputRefs.current[`${prevR},${prevC}`]?.focus();
      }
    }
  };

  // Keyboard navigation handler (Arrows, Backspace, Tab)
  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number
  ) => {
    if (isInteractionDisabled) return;

    if (e.key === "Backspace") {
      const cellKey = `${row},${col}`;
      if (!userGrid[cellKey]) {
        e.preventDefault();
        moveToPrevCell(row, col, activeDirection);
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      moveToNextCell(row, col, "across");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveToPrevCell(row, col, "across");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveToNextCell(row, col, "down");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveToPrevCell(row, col, "down");
    }
  };

  // 4. Sanitize crossword data based on stage (Answers hidden during solving)
  const sanitizedData = useMemo<SanitizedCrosswordData | null>(() => {
    if (!compiledPayload) return null;
    return CrosswordActivityAdapter.sanitizeForParticipant(compiledPayload, isRevealedStage);
  }, [compiledPayload, isRevealedStage]);

  // 5. Active Clue calculation based on selected cell & direction
  const activeClue = useMemo<SanitizedCrosswordEntry | null>(() => {
    if (!selectedCell || !sanitizedData) return null;
    const cellKey = `${selectedCell.row},${selectedCell.col}`;
    const clueMetaList = sanitizedData.cellCluesMap[cellKey];
    if (!clueMetaList || clueMetaList.length === 0) return null;

    const matched = clueMetaList.find((c) => c.direction === activeDirection);
    const targetEntryId = matched ? matched.entryId : clueMetaList[0].entryId;

    return sanitizedData.entries.find((e) => e.entryId === targetEntryId || e.id === targetEntryId) || null;
  }, [selectedCell, activeDirection, sanitizedData]);

  // 6. Drift-Free Timer Sync
  useEffect(() => {
    if (!isRunningStage) {
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
  }, [session, isRunningStage]);

  // 7. Subscribe to real-time Crossword Leaderboard in reveal / leaderboard stages
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

  // Auto switch tab when stage changes to leaderboard
  useEffect(() => {
    if (isLeaderboardStage) {
      setActiveTab("leaderboard");
    }
  }, [isLeaderboardStage]);

  // 8. Submit Crossword Handler
  const handleSubmitCrossword = async () => {
    if (!compiledPayload || hasSubmitted || isSubmitting || isFrozenStage || isRevealedStage) return;

    setIsSubmitting(true);
    setShowSubmitConfirm(false);

    try {
      const now = Date.now();
      const elapsedSec = session.stageStartedAt
        ? Math.max(1, Math.round((now - session.stageStartedAt) / 1000))
        : 60;

      const result = await CrosswordActivityAdapter.submitCrossword(
        eventId,
        activityId,
        participant,
        userGrid,
        elapsedSec,
        compiledPayload
      );

      setSubmissionRecord(result);
      setHasSubmitted(true);

      // Cache locally
      const subStorageKey = `z2o_crossword_sub_${eventId}_${activityId}_${participant.id}`;
      try {
        localStorage.setItem(subStorageKey, JSON.stringify(result));
      } catch (e) {
        console.warn("Storage write failed:", e);
      }
    } catch (err: any) {
      console.error("Error submitting crossword:", err);
      alert(err.message || "Failed to submit crossword. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cell Click Handler
  const handleCellClick = (r: number, c: number) => {
    if (!sanitizedData?.activeCellsMap[`${r},${c}`]) return;

    if (selectedCell?.row === r && selectedCell?.col === c) {
      // Toggle direction
      setActiveDirection((prev) => (prev === "across" ? "down" : "across"));
    } else {
      setSelectedCell({ row: r, col: c });
      // If cell only belongs to one direction, auto switch
      const cellKey = `${r},${c}`;
      const clues = sanitizedData.cellCluesMap[cellKey] || [];
      if (clues.length === 1) {
        setActiveDirection(clues[0].direction);
      }
    }
  };

  // Clue Click Handler (selects starting cell of clue)
  const handleClueClick = (clue: SanitizedCrosswordEntry) => {
    setSelectedCell({ row: clue.row, col: clue.col });
    setActiveDirection(clue.direction);
    cellInputRefs.current[`${clue.row},${clue.col}`]?.focus();
  };

  // Compute filled cell count
  const filledCellsCount = useMemo(() => {
    return Object.values(userGrid).filter((char) => typeof char === "string" && char.trim().length > 0).length;
  }, [userGrid]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 animate-spin">
          <Grid size={24} />
        </div>
        <p className="font-mono text-sm">Loading Crossword Puzzle...</p>
      </div>
    );
  }

  if (loadError || !sanitizedData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <AlertCircle size={40} className="text-red-400" />
        <h3 className="text-lg font-bold text-white">Crossword Unavailable</h3>
        <p className="text-sm text-neutral-400 max-w-md">{loadError || "Puzzle data could not be parsed."}</p>
      </div>
    );
  }

  const acrossClues = sanitizedData.entries.filter((e) => e.direction === "across");
  const downClues = sanitizedData.entries.filter((e) => e.direction === "down");

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-950 text-white select-none">
      {/* 1. TOP STATUS BAR */}
      <div className="p-3 sm:p-4 border-b border-neutral-850 bg-neutral-900/60 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
            <Grid size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                CROSSWORD
              </span>
              <span className="text-xs font-mono text-neutral-400 truncate">
                {sanitizedData.totalWords} Words • {sanitizedData.gridRows}x{sanitizedData.gridCols}
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-black text-white truncate">{sanitizedData.title}</h2>
          </div>
        </div>

        {/* Drift-Free Timer Radar */}
        <div className="flex items-center gap-2">
          {isLeaderboardStage && (
            <div className="flex rounded-xl bg-neutral-900 border border-neutral-800 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("puzzle")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "puzzle"
                    ? "bg-orange-500 text-black shadow-md shadow-orange-500/20"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Puzzle Grid
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("leaderboard")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "leaderboard"
                    ? "bg-orange-500 text-black shadow-md shadow-orange-500/20"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Trophy size={13} />
                <span>Leaderboard</span>
              </button>
            </div>
          )}

          <div
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border ${
              isRunningStage
                ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                : isFrozenStage
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : isRevealedStage
                ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                : "bg-neutral-900 border-neutral-800 text-neutral-400"
            }`}
          >
            <Clock size={16} className={isRunningStage ? "animate-pulse" : ""} />
            <div className="text-right">
              <div className="text-[9px] font-mono uppercase font-bold tracking-wider leading-none">
                {isRunningStage
                  ? "TIME LEFT"
                  : isFrozenStage
                  ? "FROZEN"
                  : isRevealedStage
                  ? "SOLUTIONS"
                  : isLeaderboardStage
                  ? "STANDINGS"
                  : "READY"}
              </div>
              <div className="text-base font-mono font-black tracking-wider leading-none mt-0.5">
                {isRunningStage ? timerData.formattedTime : `${Math.floor(sanitizedData.durationSeconds / 60).toString().padStart(2, "0")}:${(sanitizedData.durationSeconds % 60).toString().padStart(2, "0")}`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. STAGE NOTIFICATION BANNERS */}
      {isReadyStage && (
        <div className="p-3 bg-neutral-900 border-b border-neutral-800 text-center text-xs text-neutral-300 flex items-center justify-center gap-2">
          <HelpCircle size={15} className="text-orange-400 shrink-0" />
          <span>Host is briefing the activity. The crossword grid will unlock as soon as the timer starts!</span>
        </div>
      )}

      {isFrozenStage && (
        <div className="p-3 bg-amber-500/15 border-b border-amber-500/30 text-center text-xs text-amber-200 flex items-center justify-center gap-2">
          <Lock size={15} className="text-amber-400 shrink-0" />
          <span className="font-bold">Submissions are now frozen by host. Awaiting solution reveal...</span>
        </div>
      )}

      {isRevealedStage && (
        <div className="p-3 bg-purple-600/15 border-b border-purple-500/30 text-center text-xs text-purple-200 flex items-center justify-center gap-2">
          <Eye size={15} className="text-purple-400 shrink-0" />
          <span className="font-bold">
            Solutions Revealed! Green cells indicate correct placements. Check your accuracy score below.
          </span>
        </div>
      )}

      {/* 3. MAIN CONTENT: PUZZLE OR LEADERBOARD */}
      {activeTab === "leaderboard" ? (
        /* LEADERBOARD VIEW */
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-4">
          <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2 text-orange-400 font-black text-sm uppercase tracking-wider">
                <Trophy size={18} />
                <span>Crossword Standings (Top Solvers)</span>
              </div>
              <span className="text-xs font-mono text-neutral-400">{leaderboard.length} Solvers Ranked</span>
            </div>

            <div className="space-y-2">
              {leaderboard.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-neutral-500">
                  No submissions recorded yet for this crossword.
                </div>
              ) : (
                leaderboard.map((entry, idx) => {
                  const isCurrent = entry.participantId === participant.id;
                  return (
                    <div
                      key={entry.participantId}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                        isCurrent
                          ? "bg-orange-500/15 border-orange-500/40 text-white shadow-md shadow-orange-500/10"
                          : "bg-neutral-950/80 border-neutral-850 text-neutral-300"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono font-bold text-sm w-7 text-center">
                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-white truncate">
                              {entry.name}
                            </span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase bg-orange-500 text-black">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-2">
                            <span>{entry.correctWordsCount}/{entry.totalWordsCount} Words</span>
                            <span>•</span>
                            <span>{entry.accuracyPercentage}% Accuracy</span>
                            <span>•</span>
                            <span>{entry.timeTakenSec}s</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-base font-mono font-black text-orange-400">
                          {entry.score}
                        </div>
                        <div className="text-[9px] font-mono text-neutral-500">POINTS</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        /* PUZZLE SOLVING GRID + CLUES SPLIT VIEW */
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
          {/* LEFT / CENTER: INTERACTIVE GRID */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col items-center justify-center p-3 sm:p-6 overflow-auto bg-neutral-950/60">
            {/* Active Clue Header Ribbon */}
            <div className="w-full max-w-xl mb-3 p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 shadow-lg flex items-start gap-3 shrink-0">
              <div className="px-2.5 py-1 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-mono font-black uppercase shrink-0">
                {activeClue ? `${activeClue.number} ${activeClue.direction.toUpperCase()}` : "SELECT CELL"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white leading-snug font-medium break-words">
                  {activeClue ? activeClue.clue : "Click any grid cell or clue to start solving."}
                </p>
                {activeClue && (
                  <span className="text-[10px] font-mono text-neutral-400 mt-0.5 block">
                    Length: {activeClue.length} letters
                  </span>
                )}
              </div>
            </div>

            {/* Crossword Grid Matrix Container */}
            <div
              className="p-3 sm:p-4 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-auto max-h-[60vh] max-w-full"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${sanitizedData.gridCols}, minmax(28px, 42px))`,
                gap: "3px",
              }}
            >
              {Array.from({ length: sanitizedData.gridRows }).map((_, r) =>
                Array.from({ length: sanitizedData.gridCols }).map((_, c) => {
                  const cellKey = `${r},${c}`;
                  const isActive = sanitizedData.activeCellsMap[cellKey];
                  const clueNumber = sanitizedData.cellStartNumberMap[cellKey];
                  const userChar = userGrid[cellKey] || "";
                  const isSelected = selectedCell?.row === r && selectedCell?.col === c;

                  // Check if cell is in the currently active clue word
                  const isInActiveWord = activeClue
                    ? activeClue.direction === "across"
                      ? r === activeClue.row && c >= activeClue.col && c < activeClue.col + activeClue.length
                      : c === activeClue.col && r >= activeClue.row && r < activeClue.row + activeClue.length
                    : false;

                  // Reveal state comparisons
                  const solutionChar = sanitizedData.solutionMatrix?.[r]?.[c];
                  const isCorrect = isRevealedStage && solutionChar && userChar === solutionChar;
                  const isWrong = isRevealedStage && solutionChar && userChar && userChar !== solutionChar;

                  if (!isActive) {
                    return (
                      <div
                        key={cellKey}
                        className="w-full aspect-square bg-neutral-950/80 rounded-md border border-neutral-900/60"
                      />
                    );
                  }

                  return (
                    <div
                      key={cellKey}
                      onClick={() => handleCellClick(r, c)}
                      className={`relative w-full aspect-square rounded-md border text-xs sm:text-base font-mono font-black flex items-center justify-center cursor-pointer transition-all duration-150 ${
                        isRevealedStage
                          ? isCorrect
                            ? "bg-emerald-500/25 border-emerald-500 text-emerald-200"
                            : isWrong
                            ? "bg-red-500/25 border-red-500 text-red-200"
                            : "bg-neutral-800 border-neutral-700 text-neutral-300"
                          : isSelected
                          ? "bg-orange-500 text-black border-orange-400 ring-2 ring-orange-500/50 shadow-md"
                          : isInActiveWord
                          ? "bg-orange-500/20 border-orange-500/40 text-orange-200"
                          : userChar
                          ? "bg-neutral-800/90 border-neutral-700 text-white"
                          : "bg-neutral-850 border-neutral-750 text-neutral-400 hover:border-neutral-600"
                      }`}
                    >
                      {/* Clue start number label */}
                      {clueNumber && (
                        <span
                          className={`absolute top-0.5 left-1 text-[8px] sm:text-[9px] font-mono leading-none font-bold select-none ${
                            isSelected ? "text-black/80" : "text-neutral-400"
                          }`}
                        >
                          {clueNumber}
                        </span>
                      )}

                      {/* Hidden Input for Mobile and Keyboard Support */}
                      <input
                        ref={(el) => {
                          cellInputRefs.current[cellKey] = el;
                        }}
                        type="text"
                        maxLength={1}
                        value={isRevealedStage && !userChar ? solutionChar || "" : userChar}
                        disabled={isInteractionDisabled}
                        onChange={(e) => handleCellInput(r, c, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, r, c)}
                        className={`w-full h-full text-center bg-transparent focus:outline-none uppercase font-mono font-black ${
                          isRevealedStage && !userChar ? "text-neutral-500 italic opacity-80" : ""
                        }`}
                      />
                    </div>
                  );
                })
              )}
            </div>

            {/* Floating Action Bar (Stats & Submit Button) */}
            <div className="w-full max-w-xl mt-3 flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-900 border border-neutral-800">
              <div className="text-xs font-mono text-neutral-400 flex items-center gap-2">
                <span className="font-bold text-white">{filledCellsCount}</span> of{" "}
                <span>{sanitizedData.totalLetters}</span> letters entered
              </div>

              <div>
                {hasSubmitted ? (
                  <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                    <CheckCircle2 size={14} />
                    <span>Crossword Submitted</span>
                  </div>
                ) : isInteractionDisabled ? (
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-mono">
                    <Lock size={13} />
                    <span>Submissions Locked</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSubmitConfirm(true)}
                    disabled={isSubmitting || filledCellsCount === 0}
                    className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Send size={13} />
                    <span>Submit Answers</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: CLUES PANEL (Across & Down Lists) */}
          <div className="lg:col-span-5 xl:col-span-4 border-t lg:border-t-0 lg:border-l border-neutral-850 flex flex-col h-full bg-neutral-900/40 overflow-hidden">
            <div className="p-3.5 border-b border-neutral-850 bg-neutral-900/80 flex items-center justify-between shrink-0">
              <div className="text-xs font-mono font-black text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <ListOrdered size={14} className="text-orange-400" />
                <span>Crossword Clues</span>
              </div>
              <span className="text-[10px] font-mono text-neutral-500">Click clue to focus</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* ACROSS CLUES */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black text-orange-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-neutral-800 pb-1.5">
                  <span>Across</span>
                  <span className="text-[10px] font-mono text-neutral-500">({acrossClues.length})</span>
                </h4>

                <div className="space-y-1.5">
                  {acrossClues.map((clue) => {
                    const isSelected = activeClue?.id === clue.id;
                    return (
                      <div
                        key={clue.id}
                        onClick={() => handleClueClick(clue)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? "bg-orange-500/15 border-orange-500/50 text-white shadow-md shadow-orange-500/10"
                            : "bg-neutral-900/60 border-neutral-800/80 text-neutral-300 hover:bg-neutral-850 hover:border-neutral-700"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-mono font-black text-orange-400 shrink-0 w-6">
                            {clue.number}.
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="leading-snug">{clue.clue}</p>
                            <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-neutral-400">
                              <span>({clue.length} letters)</span>
                              {isRevealedStage && clue.answer && (
                                <span className="text-emerald-400 font-bold uppercase tracking-wider">
                                  ✓ {clue.answer}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DOWN CLUES */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black text-orange-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-neutral-800 pb-1.5">
                  <span>Down</span>
                  <span className="text-[10px] font-mono text-neutral-500">({downClues.length})</span>
                </h4>

                <div className="space-y-1.5">
                  {downClues.map((clue) => {
                    const isSelected = activeClue?.id === clue.id;
                    return (
                      <div
                        key={clue.id}
                        onClick={() => handleClueClick(clue)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? "bg-orange-500/15 border-orange-500/50 text-white shadow-md shadow-orange-500/10"
                            : "bg-neutral-900/60 border-neutral-800/80 text-neutral-300 hover:bg-neutral-850 hover:border-neutral-700"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-mono font-black text-orange-400 shrink-0 w-6">
                            {clue.number}.
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="leading-snug">{clue.clue}</p>
                            <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-neutral-400">
                              <span>({clue.length} letters)</span>
                              {isRevealedStage && clue.answer && (
                                <span className="text-emerald-400 font-bold uppercase tracking-wider">
                                  ✓ {clue.answer}
                                </span>
                              )}
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
      )}

      {/* 4. SUBMISSION CONFIRMATION MODAL */}
      <AnimatePresence>
        {showSubmitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <Send size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Submit Crossword?</h3>
                  <p className="text-xs text-neutral-400">Your final answers will be locked and scored.</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-850 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-neutral-300">
                  <span>Letters Filled:</span>
                  <span className="font-bold text-white">{filledCellsCount} / {sanitizedData.totalLetters}</span>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <span>Time Elapsed:</span>
                  <span className="font-bold text-white">{session.durationSeconds ? `${Math.floor((session.durationSeconds - timerData.remainingSeconds) / 60)}m ${(session.durationSeconds - timerData.remainingSeconds) % 60}s` : "0s"}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-300 transition-all cursor-pointer"
                >
                  Keep Solving
                </button>
                <button
                  type="button"
                  onClick={handleSubmitCrossword}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-extrabold text-black uppercase tracking-wider transition-all shadow-lg shadow-orange-500/20 cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting ? "Submitting..." : "Confirm & Submit"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
