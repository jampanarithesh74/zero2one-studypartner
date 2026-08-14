import React, { useState, useEffect, useMemo, useRef, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  CheckCircle2, 
  HelpCircle, 
  RotateCcw, 
  Sparkles, 
  Trophy, 
  Lightbulb, 
  ChevronRight, 
  ChevronLeft,
  AlertCircle,
  Eye,
  Send,
  Loader2,
  Database
} from "lucide-react";
import { CROSSWORD_ACTIVITIES, CrosswordActivity, CrosswordClue } from "../../data/engineeringFailureData";
import { Participant } from "../ParticipantOnboarding";
import { CrosswordService, CrosswordLeaderboardEntry } from "../../services/activityService";
import { isCrosswordConfigured } from "../../lib/firebaseProjects";

interface CrosswordActivityViewProps {
  eventId: string;
  currentParticipant?: (Participant & { id: string }) | null;
  isAdmin?: boolean;
}

export function CrosswordActivityView({
  eventId,
  currentParticipant,
  isAdmin = false,
}: CrosswordActivityViewProps) {
  const [selectedPuzzleIdx, setSelectedPuzzleIdx] = useState<number>(0);
  const puzzle = CROSSWORD_ACTIVITIES[selectedPuzzleIdx] || CROSSWORD_ACTIVITIES[0];

  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [activeDirection, setActiveDirection] = useState<"across" | "down">("across");
  const [userGrid, setUserGrid] = useState<Record<string, string>>({});
  const [revealedSolutions, setRevealedSolutions] = useState<boolean>(false);
  const [showHintForClue, setShowHintForClue] = useState<number | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"grid" | "leaderboard">("grid");
  const [leaderboard, setLeaderboard] = useState<CrosswordLeaderboardEntry[]>([]);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
    try {
      const raw = localStorage.getItem(savedKey);
      if (raw) {
        setUserGrid(JSON.parse(raw));
      } else {
        setUserGrid({});
      }
    } catch (e) {
      setUserGrid({});
    }
    setRevealedSolutions(false);
    setIsCompleted(false);
    setFeedbackMsg("");
    setSelectedCell(null);
  }, [puzzle.id, eventId, currentParticipant?.id]);

  // Save local progress on update (Local only - Zero Firestore writes per keystroke!)
  const saveUserGridLocal = (newGrid: Record<string, string>) => {
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
  const handleCheckSolution = async () => {
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
      setFeedbackMsg("🎉 Flawless! You've correctly solved the entire crossword puzzle!");
    } else {
      const pct = Math.round((correctCells / totalCells) * 100);
      setFeedbackMsg(
        `Accuracy: ${correctCells}/${totalCells} letters correct (${pct}%). ${
          !isFullyFilled ? "Some cells are still blank." : "Keep refining your entries!"
        }`
      );
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

  // Reset grid
  const handleResetGrid = () => {
    saveUserGridLocal({});
    setRevealedSolutions(false);
    setIsCompleted(false);
    setFeedbackMsg("Grid cleared.");
    setTimeout(() => setFeedbackMsg(""), 2500);
  };

  // Check if a clue is currently active/highlighted
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
            <h2 className="text-xs font-black uppercase tracking-wider text-white">
              {puzzle.title}
            </h2>
            <span className="text-[10px] text-neutral-400 font-medium block">
              {puzzle.theme}
            </span>
          </div>
        </div>

        {/* View Switcher & Project 2 Indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
            {CROSSWORD_ACTIVITIES.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedPuzzleIdx(idx);
                  setViewMode("grid");
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
              onClick={() => setViewMode(viewMode === "leaderboard" ? "grid" : "leaderboard")}
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

          <span
            className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border hidden sm:inline-flex items-center gap-1 ${
              isCrosswordConfigured
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
            }`}
            title={
              isCrosswordConfigured
                ? "Project 2 (Crossword Firestore) Isolated"
                : "Project 2 configuration needed for multi-project isolation"
            }
          >
            <Database size={9} />
            <span>{isCrosswordConfigured ? "PROJECT 2 ACTIVE" : "PROJECT 2 PENDING"}</span>
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === "leaderboard" ? (
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Trophy size={16} className="text-amber-400" />
              <span>Crossword Standings (Project 2 Isolated)</span>
            </h3>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className="text-xs font-mono font-bold text-orange-400 hover:underline cursor-pointer"
            >
              ← Back to Puzzle
            </button>
          </div>

          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400 bg-neutral-950 rounded-xl border border-neutral-800">
              No crossword submissions recorded yet. Complete the puzzle and click "Check & Submit Solution" to enter the leaderboard!
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
        <div className="flex-1 p-4 sm:p-5 flex flex-col lg:flex-row gap-5 overflow-y-auto">
          {/* Left: Crossword Interactive Grid */}
          <div className="flex-1 flex flex-col items-center justify-start space-y-4">
            {/* Active Clue Bar */}
            <div className="w-full p-2.5 rounded-xl bg-neutral-900/90 border border-orange-500/30 text-xs text-white flex items-center justify-between gap-2 shadow-inner">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-400 font-mono font-black text-[10px] shrink-0 uppercase">
                  {activeClue ? `${activeClue.number} ${activeClue.direction}` : "Select a cell"}
                </span>
                <span className="font-medium text-neutral-200 truncate text-[11px]">
                  {activeClue ? activeClue.clue : "Click any crossword cell or clue to begin"}
                </span>
              </div>
              {activeClue && (
                <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                  ({activeClue.answer.length} letters)
                </span>
              )}
            </div>

            {/* Crossword Grid Matrix */}
            <div className="p-3 sm:p-4 rounded-2xl bg-neutral-950 border border-neutral-800 shadow-2xl flex items-center justify-center overflow-x-auto max-w-full">
              <div
                className="grid gap-1 select-none"
                style={{
                  gridTemplateColumns: `repeat(${puzzle.gridCols}, minmax(28px, 36px))`,
                  gridTemplateRows: `repeat(${puzzle.gridRows}, minmax(28px, 36px))`,
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
                              isSelected ? "text-white" : "text-neutral-400 font-bold"
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
                          value={revealedSolutions ? correctChar || "" : userChar}
                          onKeyDown={(e) => handleKeyDown(e, r, c)}
                          onChange={() => {}}
                          className="w-full h-full text-center bg-transparent border-none outline-none font-mono font-black uppercase text-inherit cursor-pointer"
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleCheckSolution}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-orange-500/20 flex items-center gap-1.5 border border-orange-400/40 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                <span>Check & Submit Solution</span>
              </button>

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
                onClick={() => setRevealedSolutions((prev) => !prev)}
                className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 text-xs font-bold transition-all cursor-pointer border border-neutral-800 flex items-center gap-1"
              >
                <Eye size={13} />
                <span>{revealedSolutions ? "Hide Answers" : "Reveal All"}</span>
              </button>
            </div>

            {/* Feedback message */}
            {feedbackMsg && (
              <div
                className={`w-full p-2.5 rounded-xl border text-xs font-medium ${
                  isCompleted
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-neutral-900 border-neutral-800 text-neutral-300"
                }`}
              >
                {feedbackMsg}
              </div>
            )}
          </div>

          {/* Right: Across & Down Clues Panels */}
          <div className="w-full lg:w-72 flex flex-col space-y-4 shrink-0">
            {/* Across Clues */}
            <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-2">
              <h3 className="text-xs font-black font-mono text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>➡ ACROSS CLUES</span>
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
                <span>⬇ DOWN CLUES</span>
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
