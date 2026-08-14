import React, { useState, useEffect, useRef, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  HelpCircle, 
  Sparkles, 
  CheckCircle2, 
  Lightbulb, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  Trophy, 
  AlertCircle,
  Eye,
  Send,
  Loader2,
  Database
} from "lucide-react";
import { RIDDLE_ACTIVITIES, RiddleItem } from "../../data/engineeringFailureData";
import { Participant } from "../ParticipantOnboarding";
import { RiddleService, RiddleLeaderboardEntry } from "../../services/activityService";
import { isRiddleConfigured } from "../../lib/firebaseProjects";

interface RiddleActivityViewProps {
  eventId: string;
  currentParticipant?: (Participant & { id: string }) | null;
  isAdmin?: boolean;
}

export function RiddleActivityView({
  eventId,
  currentParticipant,
  isAdmin = false,
}: RiddleActivityViewProps) {
  const [currentRiddleIdx, setCurrentRiddleIdx] = useState<number>(0);
  const riddle = RIDDLE_ACTIVITIES[currentRiddleIdx] || RIDDLE_ACTIVITIES[0];

  // Character boxes state for the current riddle
  const answerLength = riddle.answer.length;
  const [letters, setLetters] = useState<string[]>(Array(answerLength).fill(""));
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [solvedRiddles, setSolvedRiddles] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"riddle" | "leaderboard">("riddle");
  const [leaderboard, setLeaderboard] = useState<RiddleLeaderboardEntry[]>([]);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Load progress for this riddle
  useEffect(() => {
    const savedKey = `z2o_riddle_${eventId}_${riddle.id}_${currentParticipant?.id || "local"}`;
    try {
      const raw = localStorage.getItem(savedKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.letters && Array.isArray(parsed.letters)) {
          setLetters(parsed.letters);
        } else {
          setLetters(Array(answerLength).fill(""));
        }
        if (parsed.isCorrect) {
          setIsCorrect(true);
        } else {
          setIsCorrect(false);
        }
      } else {
        setLetters(Array(answerLength).fill(""));
        setIsCorrect(false);
      }
    } catch (e) {
      setLetters(Array(answerLength).fill(""));
      setIsCorrect(false);
    }

    setShowHint(false);
    setIsRevealed(false);
    setFeedbackMsg(null);
  }, [riddle.id, eventId, answerLength, currentParticipant?.id]);

  // Subscribe to Riddle Leaderboard on Project 3 if configured
  useEffect(() => {
    if (!isRiddleConfigured || !eventId) return;
    const unsub = RiddleService.subscribeLeaderboard(eventId, (lb) => {
      setLeaderboard(lb);
    });
    return () => unsub();
  }, [eventId]);

  // Handle letter input (Local only - Zero Firestore writes per keystroke!)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    const key = e.key;

    if (key === "Backspace") {
      e.preventDefault();
      const newLetters = [...letters];
      if (newLetters[idx]) {
        newLetters[idx] = "";
      } else if (idx > 0) {
        newLetters[idx - 1] = "";
        inputRefs.current[idx - 1]?.focus();
      }
      setLetters(newLetters);
      saveLocalProgress(newLetters, isCorrect);
      return;
    }

    if (key === "ArrowLeft" && idx > 0) {
      e.preventDefault();
      inputRefs.current[idx - 1]?.focus();
      return;
    }

    if (key === "ArrowRight" && idx < answerLength - 1) {
      e.preventDefault();
      inputRefs.current[idx + 1]?.focus();
      return;
    }

    if (/^[a-zA-Z]$/.test(key)) {
      e.preventDefault();
      const upper = key.toUpperCase();
      const newLetters = [...letters];
      newLetters[idx] = upper;
      setLetters(newLetters);

      // Auto-focus next box
      if (idx < answerLength - 1) {
        inputRefs.current[idx + 1]?.focus();
      }

      saveLocalProgress(newLetters, isCorrect);

      // If user filled the last box, automatically verify
      const fullWord = newLetters.join("");
      if (fullWord.length === answerLength && !newLetters.includes("")) {
        checkWord(fullWord);
      }
    }
  };

  const saveLocalProgress = (curLetters: string[], correctStatus: boolean) => {
    const savedKey = `z2o_riddle_${eventId}_${riddle.id}_${currentParticipant?.id || "local"}`;
    try {
      localStorage.setItem(savedKey, JSON.stringify({ letters: curLetters, isCorrect: correctStatus }));
    } catch (e) {
      console.warn("Could not save riddle locally:", e);
    }
  };

  // Check word & Write ONE atomic submission to Project 3 (Riddle Firestore)
  const checkWord = async (inputWord: string) => {
    const cleanInput = inputWord.toUpperCase().trim();
    const cleanTarget = riddle.answer.toUpperCase().trim();
    const correct = cleanInput === cleanTarget;

    if (correct) {
      setIsCorrect(true);
      setSolvedRiddles((prev) => ({ ...prev, [riddle.id]: true }));
      setFeedbackMsg({
        text: `🎯 Phenomenal! "${cleanTarget}" is correct!`,
        type: "success",
      });
      saveLocalProgress(letters, true);
    } else {
      setIsCorrect(false);
      setFeedbackMsg({
        text: `Not quite! Check the clues, or click Hint for engineering context.`,
        type: "error",
      });
    }

    // Submit to Project 3 (Riddle Firestore)
    if (isRiddleConfigured && eventId) {
      try {
        setIsSubmitting(true);
        const pId = currentParticipant?.id || "participant_guest";
        const pName = currentParticipant?.name || "Participant";
        const res = await RiddleService.submitResult(
          eventId,
          pId,
          pName,
          String(riddle.id),
          currentRiddleIdx,
          cleanInput,
          correct
        );
        if (res.score > 0) {
          setFeedbackMsg((prev) =>
            prev ? { ...prev, text: `${prev.text} (+${res.score} pts on Riddle Leaderboard)` } : null
          );
        }
      } catch (err: any) {
        console.error("Error recording riddle submission:", err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleManualSubmit = () => {
    const fullWord = letters.join("");
    if (fullWord.length < answerLength || letters.includes("")) {
      setFeedbackMsg({
        text: `Please enter all ${answerLength} letters before submitting.`,
        type: "info",
      });
      return;
    }
    checkWord(fullWord);
  };

  const handleReset = () => {
    const empty = Array(answerLength).fill("");
    setLetters(empty);
    setIsCorrect(false);
    setIsRevealed(false);
    setFeedbackMsg(null);
    saveLocalProgress(empty, false);
    inputRefs.current[0]?.focus();
  };

  const handleRevealSolution = () => {
    setIsRevealed(true);
    setLetters(riddle.answer.split(""));
  };

  const totalSolved = Object.values(solvedRiddles).filter(Boolean).length;

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-neutral-800/90 rounded-2xl overflow-hidden shadow-xl text-left font-sans">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-neutral-800 bg-neutral-900/90 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">❓</span>
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-white">
              Engineering Riddles Challenge
            </h2>
            <span className="text-[10px] text-neutral-400 font-medium block">
              Riddle {currentRiddleIdx + 1} of {RIDDLE_ACTIVITIES.length} • {totalSolved}/{RIDDLE_ACTIVITIES.length} Solved
            </span>
          </div>
        </div>

        {/* Navigation, Standings & Project 3 Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
            <button
              type="button"
              disabled={currentRiddleIdx === 0}
              onClick={() => {
                setCurrentRiddleIdx((p) => Math.max(0, p - 1));
                setViewMode("riddle");
              }}
              className="p-1 rounded-lg text-neutral-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-all"
              title="Previous Riddle"
            >
              <ChevronLeft size={16} />
            </button>

            {RIDDLE_ACTIVITIES.map((r, idx) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setCurrentRiddleIdx(idx);
                  setViewMode("riddle");
                }}
                className={`w-6 h-6 rounded-lg text-[10px] font-mono font-bold transition-all flex items-center justify-center cursor-pointer ${
                  currentRiddleIdx === idx && viewMode === "riddle"
                    ? "bg-orange-500 text-white shadow-md"
                    : solvedRiddles[r.id]
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {idx + 1}
              </button>
            ))}

            <button
              type="button"
              disabled={currentRiddleIdx === RIDDLE_ACTIVITIES.length - 1}
              onClick={() => {
                setCurrentRiddleIdx((p) => Math.min(RIDDLE_ACTIVITIES.length - 1, p + 1));
                setViewMode("riddle");
              }}
              className="p-1 rounded-lg text-neutral-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-all"
              title="Next Riddle"
            >
              <ChevronRight size={16} />
            </button>

            <button
              type="button"
              onClick={() => setViewMode(viewMode === "leaderboard" ? "riddle" : "leaderboard")}
              className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
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
              isRiddleConfigured
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
            }`}
            title={
              isRiddleConfigured
                ? "Project 3 (Riddle Firestore) Isolated"
                : "Project 3 configuration needed for multi-project isolation"
            }
          >
            <Database size={9} />
            <span>{isRiddleConfigured ? "PROJECT 3 ACTIVE" : "PROJECT 3 PENDING"}</span>
          </span>
        </div>
      </div>

      {/* Main Riddle Container */}
      {viewMode === "leaderboard" ? (
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Trophy size={16} className="text-amber-400" />
              <span>Riddle Challenge Standings (Project 3 Isolated)</span>
            </h3>
            <button
              type="button"
              onClick={() => setViewMode("riddle")}
              className="text-xs font-mono font-bold text-orange-400 hover:underline cursor-pointer"
            >
              ← Back to Riddles
            </button>
          </div>

          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400 bg-neutral-950 rounded-xl border border-neutral-800">
              No riddle submissions recorded yet. Solve a riddle to earn your spot on the Project 3 leaderboard!
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
                    <span className="text-neutral-400">{entry.riddlesSolved} solved</span>
                    <span className="text-orange-400 font-black">{entry.currentScore} pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between space-y-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={riddle.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col justify-between space-y-6"
            >
              {/* Riddle Mystery Card */}
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-orange-500/30 space-y-4 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-36 h-36 bg-orange-500/10 blur-3xl rounded-full pointer-events-none" />

                <div className="flex items-center justify-between gap-2 relative z-10">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider text-orange-400 bg-orange-500/15 border border-orange-500/30">
                    <Sparkles size={11} />
                    <span>{riddle.title}</span>
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    {riddle.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-neutral-800 text-neutral-400 border border-neutral-700/60"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Riddle Text */}
                <div className="relative z-10 my-auto py-2">
                  <p className="text-base sm:text-lg font-black text-white tracking-tight leading-relaxed italic">
                    "{riddle.riddleText}"
                  </p>
                </div>

                {/* Hint Toggle */}
                <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between relative z-10">
                  <button
                    type="button"
                    onClick={() => setShowHint((p) => !p)}
                    className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                  >
                    <Lightbulb size={14} className={showHint ? "text-amber-400" : "text-neutral-500"} />
                    <span>{showHint ? "Hide Clue" : "Need a Hint?"}</span>
                  </button>

                  <span className="text-[10px] font-mono text-neutral-500">
                    Answer Length: {answerLength} Letters
                  </span>
                </div>

                {showHint && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium leading-relaxed"
                  >
                    💡 <strong>Hint:</strong> {riddle.hint}
                  </motion.div>
                )}
              </div>

              {/* Character-Box Inputs */}
              <div className="flex flex-col items-center justify-center space-y-4">
                <span className="text-[11px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                  Enter Your Solution
                </span>

                <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                  {Array.from({ length: answerLength }).map((_, idx) => {
                    const letterVal = isRevealed ? riddle.answer[idx] : letters[idx] || "";
                    return (
                      <input
                        key={idx}
                        ref={(el) => {
                          inputRefs.current[idx] = el;
                        }}
                        type="text"
                        maxLength={1}
                        value={letterVal}
                        onChange={() => {}} // handled via keydown
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        className={`w-10 h-12 sm:w-12 sm:h-14 rounded-xl text-center font-mono font-black text-lg sm:text-xl uppercase outline-none transition-all border shadow-lg ${
                          isCorrect
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/40"
                            : isRevealed
                            ? "bg-neutral-900 border-amber-500/60 text-amber-300"
                            : letterVal
                            ? "bg-neutral-900 border-orange-500 text-white ring-2 ring-orange-500/30"
                            : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/40"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Feedback & Solution Card */}
              {feedbackMsg && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                    feedbackMsg.type === "success"
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      : feedbackMsg.type === "error"
                      ? "bg-red-500/15 border-red-500/40 text-red-300"
                      : "bg-neutral-900 border-neutral-800 text-neutral-300"
                  }`}
                >
                  {feedbackMsg.type === "success" ? (
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle size={16} className="shrink-0 text-orange-400" />
                  )}
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              {(isCorrect || isRevealed) && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 leading-relaxed space-y-1"
                >
                  <span className="font-mono font-black text-orange-400 uppercase tracking-widest block text-[10px]">
                    Technical Explanation
                  </span>
                  <p>{riddle.explanation}</p>
                </motion.div>
              )}

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-neutral-800/90 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleManualSubmit}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center gap-1.5 border border-orange-400/30 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Send size={13} />
                    )}
                    <span>Submit Answer</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-3 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-bold transition-all cursor-pointer border border-neutral-800 flex items-center gap-1"
                    title="Clear letters"
                  >
                    <RotateCcw size={13} />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRevealSolution}
                    className="px-3 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 text-xs font-bold transition-all cursor-pointer border border-neutral-800 flex items-center gap-1"
                  >
                    <Eye size={13} />
                    <span>Reveal Answer</span>
                  </button>

                  {currentRiddleIdx < RIDDLE_ACTIVITIES.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setCurrentRiddleIdx((p) => p + 1)}
                      className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-black transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>Next Riddle</span>
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
