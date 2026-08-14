import React, { useState, useEffect, useMemo, useRef, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  CheckCircle2, 
  HelpCircle, 
  RotateCcw, 
  Sparkles, 
  Trophy, 
  Lightbulb, 
  AlertCircle,
  Eye,
  Send,
  Loader2,
  Database,
  Lock,
  Radio
} from "lucide-react";
import { CROSSWORD_ACTIVITIES, CrosswordActivity, CrosswordClue } from "../../data/engineeringFailureData";
import { Participant } from "../ParticipantOnboarding";
import { CrosswordService, CrosswordLeaderboardEntry, CrosswordBroadcastState } from "../../services/activityService";
import { isCrosswordConfigured } from "../../lib/firebaseProjects";

interface CrosswordActivityViewProps {
  eventId: string;
  currentParticipant?: (Participant & { id: string }) | null;
  isAdmin?: boolean;
  broadcast?: CrosswordBroadcastState;
}

export function CrosswordActivityView({
  eventId,
  currentParticipant,
  isAdmin = false,
  broadcast,
}: CrosswordActivityViewProps) {
  // If participant, puzzle index is strictly locked to admin broadcast
  const [internalPuzzleIdx, setInternalPuzzleIdx] = useState<number>(0);
  const selectedPuzzleIdx = !isAdmin && broadcast ? broadcast.puzzleIndex : internalPuzzleIdx;
  const puzzle = CROSSWORD_ACTIVITIES[selectedPuzzleIdx] || CROSSWORD_ACTIVITIES[0];

  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [activeDirection, setActiveDirection] = useState<"across" | "down">("across");
  const [userGrid, setUserGrid] = useState<Record<string, string>>({});
  const [adminRevealedSolutions, setAdminRevealedSolutions] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isSubmittedLocal, setIsSubmittedLocal] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [internalViewMode, setInternalViewMode] = useState<"grid" | "leaderboard">("grid");
  const [leaderboard, setLeaderboard] = useState<CrosswordLeaderboardEntry[]>([]);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Effective reveal & freeze states
  const isRevealedEffective = (!isAdmin && broadcast?.isRevealed) || (isAdmin && adminRevealedSolutions) || broadcast?.stage === "reveal";
  const isFrozenEffective = (!isAdmin && (broadcast?.isFrozen || broadcast?.stage === "frozen" || isSubmittedLocal));
  const viewMode = (!isAdmin && broadcast?.stage === "leaderboard") ? "leaderboard" : internalViewMode;

  // 1. Build puzzle matrix from clues
  const { gridMatrix, cellClueMap, clueStartMap } = useMemo(() => {
    const matrix: (string | null)[][] = Array.from({ length: puzzle.gridRows }, () =>
      Array.from({ length: puzzle.gridCols }, () => null)
    );
    const clueMap: Record<string, number[]> = {};
    const startMap: Record<string, number> = {};

    puzzle.clues.forEach((clue, clueIdx) => {
      const startKey = `${clue.row},${clue.col}`;
      if (!startMap[startKey]) {
        startMap[startKey] = clue.number;
      }

      for (let i = 0; i < clue.answer.length; i++) {
        const r = clue.direction === "across" ? clue.row : clue.row + i;
        const c = clue.direction === "across" ? clue.col + i : clue.col;
        if (r < puzzle.gridRows && c < puzzle.gridCols) {
          matrix[r][c] = clue.answer[i].toUpperCase();
          const cellKey = `${r},${c}`;
          if (!clueMap[cellKey]) clueMap[cellKey] = [];
          clueMap[cellKey].push(clueIdx);
        }
      }
    });

    return { gridMatrix: matrix, cellClueMap: clueMap, clueStartMap: startMap };
  }, [puzzle]);

  // Load saved local progress for this puzzle
  useEffect(() => {
    const savedKey = `z2o_crossword_${eventId}_${puzzle.id}_${currentParticipant?.id || "local"}`;
    const submitKey = `z2o_crossword_sub_${eventId}_${puzzle.id}_${currentParticipant?.id || "local"}`;
    try {
      const raw = localStorage.getItem(savedKey);
      if (raw) {
        setUserGrid(JSON.parse(raw));
      } else {
        setUserGrid({});
      }
      setIsSubmittedLocal(localStorage.getItem(submitKey) === "true");
    } catch (e) {
      setUserGrid({});
      setIsSubmittedLocal(false);
    }
    setAdminRevealedSolutions(false);
    setIsCompleted(false);
    setFeedbackMsg("");
    setSelectedCell(null);
  }, [puzzle.id, eventId, currentParticipant?.id]);

  // Save local progress on update
  const saveUserGridLocal = (newGrid: Record<string, string>) => {
    if (isFrozenEffective) return;
    setUserGrid(newGrid);
    const savedKey = `z2o_crossword_${eventId}_${puzzle.id}_${currentParticipant?.id || "local"}`;
    try {
      localStorage.setItem(savedKey, JSON.stringify(newGrid));
    } catch (e) {
      console.warn("localStorage write failed:", e);
    }
  };

  // Subscribe to Crossword Leaderboard on Project 2 if configured
  useEffect(() => {
    if (!isCrosswordConfigured || !eventId) return;
    const unsub = CrosswordService.subscribeLeaderboard(eventId, (lb) => {
      setLeaderboard(lb);
    });
    return () => unsub();
  }, [eventId]);

  // Active clue currently focused
  const activeClue = useMemo<CrosswordClue | null>(() => {
    if (!selectedCell) return null;
    const cellKey = `${selectedCell.row},${selectedCell.col}`;
    const clueIndices = cellClueMap[cellKey];
    if (!clueIndices || clueIndices.length === 0) return null;

    const matching = clueIndices
      .map((idx) => puzzle.clues[idx])
      .find((c) => c.direction === activeDirection);

    return matching || puzzle.clues[clueIndices[0]] || null;
  }, [selectedCell, activeDirection, cellClueMap, puzzle]);

  // Click on a cell in the grid
  const handleCellClick = (r: number, c: number) => {
    if (gridMatrix[r][c] === null) return;

    if (selectedCell?.row === r && selectedCell?.col === c) {
      // Toggle direction
      setActiveDirection((prev) => (prev === "across" ? "down" : "across"));
    } else {
      setSelectedCell({ row: r, col: c });
      // If cell only belongs to one direction, auto switch
      const cellKey = `${r},${c}`;
      const indices = cellClueMap[cellKey] || [];
      if (indices.length === 1) {
        setActiveDirection(puzzle.clues[indices[0]].direction);
      }
    }
  };

  // Click on a clue from the list
  const handleClueClick = (clue: CrosswordClue) => {
    setActiveDirection(clue.direction);
    setSelectedCell({ row: clue.row, col: clue.col });
    const cellKey = `${clue.row}-${clue.col}`;
    inputRefs.current[cellKey]?.focus();
  };

  // Key navigation and input
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (isFrozenEffective) return;
    const key = e.key;

    if (key === "Backspace") {
      e.preventDefault();
      const cellKey = `${r},${c}`;
      if (userGrid[cellKey]) {
        const next = { ...userGrid };
        delete next[cellKey];
        saveUserGridLocal(next);
      } else {
        moveToPreviousCellInDirection(r, c, activeDirection);
      }
      return;
    }

    if (key === "ArrowRight") {
      e.preventDefault();
      moveToNextCellInDirection(r, c, "across");
      return;
    }
    if (key === "ArrowLeft") {
      e.preventDefault();
      moveToPreviousCellInDirection(r, c, "across");
      return;
    }
    if (key === "ArrowDown") {
      e.preventDefault();
      moveToNextCellInDirection(r, c, "down");
      return;
    }
    if (key === "ArrowUp") {
      e.preventDefault();
      moveToPreviousCellInDirection(r, c, "down");
      return;
    }

    if (/^[a-zA-Z]$/.test(key)) {
      e.preventDefault();
      const upper = key.toUpperCase();
      const cellKey = `${r},${c}`;
      const next = { ...userGrid, [cellKey]: upper };
      saveUserGridLocal(next);
      moveToNextCellInDirection(r, c, activeDirection);
    }
  };

  const moveToNextCellInDirection = (r: number, c: number, dir: "across" | "down") => {
    setActiveDirection(dir);
    const nextR = dir === "down" ? r + 1 : r;
    const nextC = dir === "across" ? c + 1 : c;
    if (nextR < puzzle.gridRows && nextC < puzzle.gridCols && gridMatrix[nextR][nextC] !== null) {
      setSelectedCell({ row: nextR, col: nextC });
      inputRefs.current[`${nextR}-${nextC}`]?.focus();
    }
  };

  const moveToPreviousCellInDirection = (r: number, c: number, dir: "across" | "down") => {
    setActiveDirection(dir);
    const prevR = dir === "down" ? r - 1 : r;
    const prevC = dir === "across" ? c - 1 : c;
    if (prevR >= 0 && prevC >= 0 && gridMatrix[prevR][prevC] !== null) {
      setSelectedCell({ row: prevR, col: prevC });
      inputRefs.current[`${prevR}-${prevC}`]?.focus();
    }
  };

  // Validate user solution & Write ONE atomic submission record to Project 2 (Crossword Firestore)
  // FREEZES answer locally upon submission
  const handleCheckSolution = async () => {
    if (isFrozenEffective && !isAdmin) return;

    let totalCells = 0;
    let correctCells = 0;
    let isFullyFilled = true;

    for (let r = 0; r < puzzle.gridRows; r++) {
      for (let c = 0; c < puzzle.gridCols; c++) {
        const correct = gridMatrix[r][c];
        if (correct !== null) {
          totalCells++;
          const userVal = userGrid[`${r},${c}`] || "";
          if (!userVal) isFullyFilled = false;
          if (userVal.toUpperCase() === correct.toUpperCase()) {
            correctCells++;
          }
        }
      }
    }

    const isFullySolved = correctCells === totalCells;

    if (isFullySolved) {
      setIsCompleted(true);
      setFeedbackMsg("🎉 Solution Submitted! All answers are correct & locked in.");
    } else {
      const pct = Math.round((correctCells / totalCells) * 100);
      setFeedbackMsg(
        `Answer submitted & locked. Accuracy: ${correctCells}/${totalCells} letters correct (${pct}%).`
      );
    }

    // Freeze participant answers locally
    if (!isAdmin) {
      setIsSubmittedLocal(true);
      const submitKey = `z2o_crossword_sub_${eventId}_${puzzle.id}_${currentParticipant?.id || "local"}`;
      try {
        localStorage.setItem(submitKey, "true");
      } catch (e) {
        console.warn("Could not save submit state:", e);
      }
    }

    // Submit to Project 2 (Crossword Firestore)
    if (isCrosswordConfigured && eventId) {
      try {
        setIsSubmitting(true);
        const pId = currentParticipant?.id || "participant_guest";
        const pName = currentParticipant?.name || "Participant";
        const res = await CrosswordService.submitResult(
          eventId,
          pId,
          pName,
          puzzle.id,
          selectedPuzzleIdx,
          correctCells,
          totalCells,
          isFullySolved
        );
        if (res.score > 0) {
          setFeedbackMsg((prev) => `${prev} (+${res.score} points recorded to Crossword Leaderboard)`);
        }
      } catch (err: any) {
        console.error("Error submitting crossword score:", err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Reset grid (allowed for admin or unsubmitted user)
  const handleResetGrid = () => {
    if (isFrozenEffective && !isAdmin) return;
    saveUserGridLocal({});
    setAdminRevealedSolutions(false);
    setIsCompleted(false);
    setFeedbackMsg("Grid cleared.");
    setTimeout(() => setFeedbackMsg(""), 2500);
  };

  // Check if a cell is currently active/highlighted
  const isCellInActiveClue = (r: number, c: number) => {
    if (!activeClue) return false;
    for (let i = 0; i < activeClue.answer.length; i++) {
      const cr = activeClue.direction === "across" ? activeClue.row : activeClue.row + i;
      const cc = activeClue.direction === "across" ? activeClue.col + i : activeClue.col;
      if (cr === r && cc === c) return true;
    }
    return false;
  };

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-neutral-800/90 rounded-2xl overflow-hidden shadow-xl text-left font-sans">
      {/* Top Header */}
      <div className="p-3.5 border-b border-neutral-800 bg-neutral-900/90 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">🧩</span>
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
              <span>{puzzle.title}</span>
              {isFrozenEffective && !isAdmin && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 inline-flex items-center gap-1">
                  <Lock size={10} />
                  <span>ANSWERS FROZEN</span>
                </span>
              )}
            </h2>
            <span className="text-[10px] text-neutral-400 font-medium block">
              {puzzle.theme}
            </span>
          </div>
        </div>

        {/* View Switcher: Admin Only */}
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              {CROSSWORD_ACTIVITIES.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setInternalPuzzleIdx(idx);
                    setInternalViewMode("grid");
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    selectedPuzzleIdx === idx && viewMode === "grid"
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Crossword #{idx + 1}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setInternalViewMode(viewMode === "leaderboard" ? "grid" : "leaderboard")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === "leaderboard"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-neutral-400 hover:text-amber-400"
                }`}
              >
                <Trophy size={11} />
                <span>Standings</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
                <Radio size={11} className="animate-pulse text-orange-400" />
                <span>CROSSWORD #{selectedPuzzleIdx + 1} LIVE</span>
              </span>
            </div>
          )}

          <span
            className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border hidden sm:inline-flex items-center gap-1 ${
              isCrosswordConfigured
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
            }`}
          >
            <Database size={9} />
            <span>PROJECT 2</span>
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === "leaderboard" ? (
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Trophy size={16} className="text-amber-400" />
              <span>Crossword #{selectedPuzzleIdx + 1} Standings (Project 2 Isolated)</span>
            </h3>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setInternalViewMode("grid")}
                className="text-xs font-mono font-bold text-orange-400 hover:underline cursor-pointer"
              >
                ← Back to Puzzle
              </button>
            )}
          </div>

          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400 bg-neutral-950 rounded-xl border border-neutral-800">
              No crossword submissions recorded yet. Complete the puzzle and submit to appear on the leaderboard!
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, idx) => (
                <div
                  key={entry.participantId}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    idx === 0
                      ? "bg-amber-500/15 border-amber-500/40 text-white font-bold"
                      : "bg-neutral-950 border-neutral-800 text-neutral-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-neutral-800 text-orange-400 font-mono font-black flex items-center justify-center text-xs">
                      #{idx + 1}
                    </span>
                    <span>{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-neutral-400">{entry.puzzlesCompleted} solved</span>
                    <span className="text-orange-400 font-black">{entry.currentScore} pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 p-4 sm:p-5 flex flex-col items-center justify-start space-y-4 overflow-y-auto">
          {/* Active Clue Bar (Shown prominent right above/below grid when clicked) */}
          <div className="w-full max-w-2xl p-3 rounded-xl bg-neutral-900/90 border border-orange-500/40 text-xs text-white flex items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2.5 py-1 rounded-md bg-orange-500 text-white font-mono font-black text-[10px] shrink-0 uppercase shadow-sm">
                {activeClue ? `${activeClue.number} ${activeClue.direction}` : "Click any cell"}
              </span>
              <span className="font-bold text-white truncate text-xs sm:text-sm">
                {activeClue ? activeClue.clue : "Click a numbered crossword block below to read its question"}
              </span>
            </div>
            {activeClue && (
              <span className="text-[10px] font-mono text-orange-400 font-black shrink-0 px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800">
                {activeClue.answer.length} letters
              </span>
            )}
          </div>

          {/* Crossword Grid Matrix */}
          <div className="p-3 sm:p-4 rounded-2xl bg-neutral-950 border border-neutral-800 shadow-2xl flex items-center justify-center overflow-x-auto max-w-full">
            <div
              className="grid gap-1 select-none"
              style={{
                gridTemplateColumns: `repeat(${puzzle.gridCols}, minmax(28px, 38px))`,
                gridTemplateRows: `repeat(${puzzle.gridRows}, minmax(28px, 38px))`,
              }}
            >
              {Array.from({ length: puzzle.gridRows }).map((_, r) =>
                Array.from({ length: puzzle.gridCols }).map((_, c) => {
                  const correctChar = gridMatrix[r][c];
                  const isBlocked = correctChar === null;
                  const cellKey = `${r},${c}`;
                  const userChar = userGrid[cellKey] || "";
                  const clueNum = clueStartMap[cellKey];
                  const isSelected = selectedCell?.row === r && selectedCell?.col === c;
                  const isInWord = isCellInActiveClue(r, c);

                  if (isBlocked) {
                    return (
                      <div
                        key={`${r}-${c}`}
                        className="w-full h-full bg-[#0d0d0d] rounded-md border border-neutral-900/60"
                      />
                    );
                  }

                  return (
                    <div
                      key={`${r}-${c}`}
                      onClick={() => handleCellClick(r, c)}
                      className={`relative w-full h-full rounded-md font-mono font-black text-sm sm:text-base flex items-center justify-center cursor-pointer transition-all border ${
                        isSelected
                          ? "bg-orange-500 text-white border-orange-400 shadow-md ring-2 ring-orange-400/40 z-20"
                          : isInWord
                          ? "bg-orange-500/20 text-orange-200 border-orange-500/40 z-10"
                          : "bg-neutral-900 text-white border-neutral-700 hover:border-neutral-500"
                      }`}
                    >
                      {clueNum && (
                        <span
                          className={`absolute top-0.5 left-0.5 text-[8px] font-mono leading-none ${
                            isSelected ? "text-white font-bold" : "text-neutral-400 font-bold"
                          }`}
                        >
                          {clueNum}
                        </span>
                      )}

                      <input
                        ref={(el) => {
                          inputRefs.current[`${r}-${c}`] = el;
                        }}
                        type="text"
                        maxLength={1}
                        disabled={isFrozenEffective}
                        value={isRevealedEffective ? correctChar || "" : userChar}
                        onKeyDown={(e) => handleKeyDown(e, r, c)}
                        onChange={() => {}}
                        className={`w-full h-full text-center bg-transparent border-none outline-none font-mono font-black uppercase text-inherit ${
                          isFrozenEffective ? "cursor-not-allowed opacity-90" : "cursor-pointer"
                        }`}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Question Clue Box - Directly below the crossword as requested */}
          {activeClue && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-2xl p-3.5 rounded-xl bg-gradient-to-r from-neutral-900 to-neutral-950 border border-orange-500/30 text-white shadow-lg space-y-1"
            >
              <div className="flex items-center justify-between text-[11px] font-mono text-orange-400 font-black uppercase">
                <span>Active Clue #{activeClue.number} ({activeClue.direction})</span>
                <span>{activeClue.answer.length} Letters</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-neutral-100">
                "{activeClue.clue}"
              </p>
            </motion.div>
          )}

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            {!isFrozenEffective ? (
              <button
                type="button"
                onClick={handleCheckSolution}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-orange-500/20 flex items-center gap-1.5 border border-orange-400/40 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                <span>Submit & Freeze Solution</span>
              </button>
            ) : (
              <div className="px-4 py-2 rounded-xl bg-neutral-900 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5">
                <Lock size={13} className="text-amber-400" />
                <span>Answers Submitted & Frozen</span>
              </div>
            )}

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={handleResetGrid}
                  className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold transition-all cursor-pointer border border-neutral-800 flex items-center gap-1"
                >
                  <RotateCcw size={13} />
                  <span>Reset Grid</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAdminRevealedSolutions((prev) => !prev)}
                  className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 text-xs font-bold transition-all cursor-pointer border border-neutral-800 flex items-center gap-1"
                >
                  <Eye size={13} />
                  <span>{adminRevealedSolutions ? "Hide Answers" : "Reveal All"}</span>
                </button>
              </>
            )}
          </div>

          {/* Feedback message */}
          {feedbackMsg && (
            <div
              className={`w-full max-w-2xl p-3 rounded-xl border text-xs font-medium ${
                isCompleted
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-neutral-900 border-neutral-800 text-neutral-300"
              }`}
            >
              {feedbackMsg}
            </div>
          )}

          {/* Clues Summary Grid (Below Crossword & Actions) */}
          <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Across Clues */}
            <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-2">
              <h3 className="text-xs font-black font-mono text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>➡ 6 ACROSS CLUES</span>
              </h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {puzzle.clues
                  .filter((c) => c.direction === "across")
                  .map((clue) => {
                    const isThisActive =
                      activeClue?.number === clue.number && activeClue?.direction === "across";
                    return (
                      <div
                        key={clue.number}
                        onClick={() => handleClueClick(clue)}
                        className={`p-2 rounded-xl text-[11px] leading-snug cursor-pointer transition-all border ${
                          isThisActive
                            ? "bg-orange-500/20 border-orange-500 text-white font-bold shadow-sm"
                            : "bg-neutral-950/80 border-neutral-800/80 text-neutral-300 hover:bg-neutral-850"
                        }`}
                      >
                        <span className="font-mono font-black text-orange-400 mr-1.5">
                          {clue.number}.
                        </span>
                        <span>{clue.clue}</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Down Clues */}
            <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-2">
              <h3 className="text-xs font-black font-mono text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>⬇ 6 DOWN CLUES</span>
              </h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {puzzle.clues
                  .filter((c) => c.direction === "down")
                  .map((clue) => {
                    const isThisActive =
                      activeClue?.number === clue.number && activeClue?.direction === "down";
                    return (
                      <div
                        key={clue.number}
                        onClick={() => handleClueClick(clue)}
                        className={`p-2 rounded-xl text-[11px] leading-snug cursor-pointer transition-all border ${
                          isThisActive
                            ? "bg-orange-500/20 border-orange-500 text-white font-bold shadow-sm"
                            : "bg-neutral-950/80 border-neutral-800/80 text-neutral-300 hover:bg-neutral-850"
                        }`}
                      >
                        <span className="font-mono font-black text-orange-400 mr-1.5">
                          {clue.number}.
                        </span>
                        <span>{clue.clue}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
