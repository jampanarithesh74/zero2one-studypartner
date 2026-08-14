import React, { useState, useEffect, useRef, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  HelpCircle, 
  Sparkles, 
  CheckCircle2, 
  Lightbulb, 
  RotateCcw, 
  Trophy, 
  AlertCircle,
  Eye,
  Send,
  Loader2,
  Database,
  Lock,
  Radio
} from "lucide-react";
import { RIDDLE_ACTIVITIES, RiddleItem } from "../../data/engineeringFailureData";
import { Participant } from "../ParticipantOnboarding";
import { RiddleService, RiddleLeaderboardEntry, RiddleBroadcastState } from "../../services/activityService";
import { isRiddleConfigured } from "../../lib/firebaseProjects";

interface RiddleActivityViewProps {
  eventId: string;
  currentParticipant?: (Participant & { id: string }) | null;
  isAdmin?: boolean;
  broadcast?: RiddleBroadcastState;
}

export function RiddleActivityView({
  eventId,
  currentParticipant,
  isAdmin = false,
  broadcast,
}: RiddleActivityViewProps) {
  // If participant, current riddle is strictly controlled by admin broadcast
  const [internalRiddleIdx, setInternalRiddleIdx] = useState<number>(0);
  const currentRiddleIdx = !isAdmin && broadcast ? broadcast.riddleIndex : internalRiddleIdx;
  const riddle = RIDDLE_ACTIVITIES[currentRiddleIdx] || RIDDLE_ACTIVITIES[0];

  // Character boxes state for the current riddle
  const answerLength = riddle.answer.length;
  const [letters, setLetters] = useState<string[]>(Array(answerLength).fill(""));
  const [showHint, setShowHint] = useState<boolean>(false);
  const [adminRevealed, setAdminRevealed] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [isSubmittedLocal, setIsSubmittedLocal] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [solvedRiddles, setSolvedRiddles] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [internalViewMode, setInternalViewMode] = useState<"riddle" | "leaderboard">("riddle");
  const [leaderboard, setLeaderboard] = useState<RiddleLeaderboardEntry[]>([]);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Effective reveal & freeze states
  const isRevealedEffective = (!isAdmin && broadcast?.isRevealed) || (isAdmin && adminRevealed) || broadcast?.stage === "reveal";
  const isFrozenEffective = (!isAdmin && (broadcast?.isFrozen || broadcast?.stage === "frozen" || isSubmittedLocal));
  const viewMode = (!isAdmin && broadcast?.stage === "leaderboard") ? "leaderboard" : internalViewMode;

  // Load progress for this riddle
  useEffect(() => {
    const savedKey = `z2o_riddle_${eventId}_${riddle.id}_${currentParticipant?.id || "local"}`;
    const submitKey = `z2o_riddle_sub_${eventId}_${riddle.id}_${currentParticipant?.id || "local"}`;
    try {
      const raw = localStorage.getItem(savedKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.letters && Array.isArray(parsed.letters)) {
          setLetters(parsed.letters);
        } else {
          setLetters(Array(answerLength).fill(""));
        }
        setIsCorrect(Boolean(parsed.isCorrect));
      } else {
        setLetters(Array(answerLength).fill(""));
        setIsCorrect(false);
      }
      setIsSubmittedLocal(localStorage.getItem(submitKey) === "true");
    } catch (e) {
      setLetters(Array(answerLength).fill(""));
      setIsCorrect(false);
      setIsSubmittedLocal(false);
    }

    setShowHint(false);
    setAdminRevealed(false);
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

  // Handle letter input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (isFrozenEffective) return;
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
    }
  };

  const saveLocalProgress = (curLetters: string[], correctStatus: boolean) => {
    if (isFrozenEffective && !isAdmin) return;
    const savedKey = `z2o_riddle_${eventId}_${riddle.id}_${currentParticipant?.id || "local"}`;
    try {
      localStorage.setItem(savedKey, JSON.stringify({ letters: curLetters, isCorrect: correctStatus }));
    } catch (e) {
      console.warn("Could not save riddle locally:", e);
    }
  };

  // Check word & Write ONE atomic submission to Project 3 (Riddle Firestore)
  // Freezes answer right away upon submit
  const checkWord = async (inputWord: string) => {
    if (isFrozenEffective && !isAdmin) return;

    const cleanInput = inputWord.toUpperCase().trim();
    const cleanTarget = riddle.answer.toUpperCase().trim();
    const correct = cleanInput === cleanTarget;

    if (correct) {
      setIsCorrect(true);
      setSolvedRiddles((prev) => ({ ...prev, [riddle.id]: true }));
      setFeedbackMsg({
        text: `🎯 Phenomenal! Your answer has been submitted and locked in.`,
        type: "success",
      });
      saveLocalProgress(letters, true);
    } else {
      setIsCorrect(false);
      setFeedbackMsg({
        text: `Answer submitted & locked. (${cleanInput})`,
        type: "info",
      });
    }

    // Freeze participant submission locally
    if (!isAdmin) {
      setIsSubmittedLocal(true);
      const submitKey = `z2o_riddle_sub_${eventId}_${riddle.id}_${currentParticipant?.id || "local"}`;
      try {
        localStorage.setItem(submitKey, "true");
      } catch (e) {
        console.warn("Could not save submit state:", e);
      }
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
    if (isFrozenEffective && !isAdmin) return;
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
    if (isFrozenEffective && !isAdmin) return;
    const empty = Array(answerLength).fill("");
    setLetters(empty);
    setIsCorrect(false);
    setAdminRevealed(false);
    setFeedbackMsg(null);
    saveLocalProgress(empty, false);
    inputRefs.current[0]?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-neutral-800/90 rounded-2xl overflow-hidden shadow-xl text-left font-sans">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-neutral-800 bg-neutral-900/90 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">❓</span>
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
              <span>Engineering Riddles Challenge</span>
              {isFrozenEffective && !isAdmin && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 inline-flex items-center gap-1">
                  <Lock size={10} />
                  <span>LOCKED</span>
                </span>
              )}
            </h2>
            <span className="text-[10px] text-neutral-400 font-medium block">
              Riddle {currentRiddleIdx + 1} of {RIDDLE_ACTIVITIES.length}
            </span>
          </div>
        </div>

        {/* Navigation & Status */}
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              {RIDDLE_ACTIVITIES.map((r, idx) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setInternalRiddleIdx(idx);
                    setInternalViewMode("riddle");
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
                onClick={() => setInternalViewMode(viewMode === "leaderboard" ? "riddle" : "leaderboard")}
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
          ) : (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
                <Radio size={11} className="animate-pulse text-orange-400" />
                <span>QUESTION {currentRiddleIdx + 1} LIVE</span>
              </span>
            </div>
          )}

          <span
            className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border hidden sm:inline-flex items-center gap-1 ${
              isRiddleConfigured
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
            }`}
          >
            <Database size={9} />
            <span>PROJECT 3</span>
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
            {isAdmin && (
              <button
                type="button"
                onClick={() => setInternalViewMode("riddle")}
                className="text-xs font-mono font-bold text-orange-400 hover:underline cursor-pointer"
              >
                ← Back to Riddles
              </button>
            )}
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
                  <p className="text-base sm:text-lg md:text-xl font-black text-white tracking-tight leading-relaxed italic">
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
                  {isRevealedEffective ? "Revealed Answer" : "Enter Your Solution"}
                </span>

                <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                  {Array.from({ length: answerLength }).map((_, idx) => {
                    const letterVal = isRevealedEffective ? riddle.answer[idx] : letters[idx] || "";
                    return (
                      <input
                        key={idx}
                        ref={(el) => {
                          inputRefs.current[idx] = el;
                        }}
                        type="text"
                        maxLength={1}
                        disabled={isFrozenEffective}
                        value={letterVal}
                        onChange={() => {}}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        className={`w-10 h-12 sm:w-12 sm:h-14 rounded-xl text-center font-mono font-black text-lg sm:text-xl uppercase outline-none transition-all border shadow-lg ${
                          isCorrect
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/40"
                            : isRevealedEffective
                            ? "bg-neutral-900 border-amber-500/60 text-amber-300"
                            : letterVal
                            ? "bg-neutral-900 border-orange-500 text-white ring-2 ring-orange-500/30"
                            : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/40"
                        } ${isFrozenEffective ? "cursor-not-allowed opacity-90" : ""}`}
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

              {isRevealedEffective && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-neutral-900 border border-orange-500/30 text-xs text-neutral-300 leading-relaxed space-y-1"
                >
                  <span className="font-mono font-black text-orange-400 uppercase tracking-widest block text-[10px]">
                    Technical Explanation
                  </span>
                  <p className="text-white">{riddle.explanation}</p>
                </motion.div>
              )}

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-neutral-800/90 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {!isFrozenEffective ? (
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
                  ) : (
                    <div className="px-4 py-2 rounded-xl bg-neutral-900 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5">
                      <Lock size={13} className="text-amber-400" />
                      <span>Answer Locked In</span>
                    </div>
                  )}

                  {!isFrozenEffective && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-3 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-bold transition-all cursor-pointer border border-neutral-800 flex items-center gap-1"
                      title="Clear letters"
                    >
                      <RotateCcw size={13} />
                      <span className="hidden sm:inline">Clear</span>
                    </button>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAdminRevealed((p) => !p)}
                      className="px-3 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 text-xs font-bold transition-all cursor-pointer border border-neutral-800 flex items-center gap-1"
                    >
                      <Eye size={13} />
                      <span>{adminRevealed ? "Hide Answer" : "Reveal Answer"}</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
