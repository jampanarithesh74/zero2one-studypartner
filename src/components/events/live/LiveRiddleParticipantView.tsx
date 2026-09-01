import { useState, useEffect, useMemo, useRef, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  HelpCircle,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Trophy,
  AlertCircle,
  Lightbulb,
  Send,
  Zap,
  Lock,
  ChevronRight,
  Award,
  Medal,
  Users,
  RotateCcw,
} from "lucide-react";
import { CanonicalLiveSession, LiveActivityStage } from "../../../types/liveEventEngine";
import {
  RiddleActivityAdapter,
  SanitizedRiddleEntry,
  RiddleLeaderboardEntry,
} from "../../../services/riddleActivityAdapter";
import { GenericRiddleEntry } from "../../../services/riddleBuilderService";
import { LiveEventEngineService } from "../../../services/liveEventEngineService";

interface LiveRiddleParticipantViewProps {
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

export function LiveRiddleParticipantView({
  eventId,
  activityId,
  session,
  participant,
}: LiveRiddleParticipantViewProps) {
  const [riddles, setRiddles] = useState<GenericRiddleEntry[]>([]);
  const [loadingRiddles, setLoadingRiddles] = useState<boolean>(true);
  const [letters, setLetters] = useState<string[]>([]);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedAnswer, setSubmittedAnswer] = useState<string>("");
  const [submissionResult, setSubmissionResult] = useState<{
    isCorrect: boolean;
    pointsEarned: number;
  } | null>(null);

  // Leaderboard data
  const [leaderboard, setLeaderboard] = useState<RiddleLeaderboardEntry[]>([]);

  // Local drift-free timer state
  const [timerData, setTimerData] = useState({
    remainingSeconds: 0,
    isExpired: false,
    progressPercentage: 0,
    formattedTime: "00:00",
  });

  // Track start time for speed bonus calculation
  const riddleStartTimeRef = useRef<number>(Date.now());
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 1. Fetch Riddles for this Riddle Activity (Point in time read)
  useEffect(() => {
    let isMounted = true;
    async function loadRiddles() {
      setLoadingRiddles(true);
      try {
        const fetched = await RiddleActivityAdapter.fetchRiddleEntries(eventId, activityId);
        if (isMounted) {
          setRiddles(fetched);
          setLoadingRiddles(false);
        }
      } catch (err) {
        console.error("Failed to load riddle entries:", err);
        if (isMounted) setLoadingRiddles(false);
      }
    }

    loadRiddles();
    return () => {
      isMounted = false;
    };
  }, [eventId, activityId]);

  // 2. Real-time Leaderboard Subscription
  useEffect(() => {
    if (!eventId || !activityId) return;

    const unsubscribe = RiddleActivityAdapter.subscribeRiddleLeaderboard(
      eventId,
      activityId,
      (entries) => {
        setLeaderboard(entries);
      }
    );

    return () => unsubscribe();
  }, [eventId, activityId]);

  // 3. Current Riddle Index
  const currentStepIndex = session.stepIndex ?? 0;
  const currentRiddle = riddles[currentStepIndex] || null;
  const totalRiddles = riddles.length || session.totalSteps || 1;

  // Sanitized riddle for participant (security guard: strips answer until revealed)
  const isRevealedStage = session.stage === "reveal" || session.isRevealed;
  const sanitizedRiddle = useMemo(() => {
    if (!currentRiddle) return null;
    return RiddleActivityAdapter.sanitizeRiddle(currentRiddle, isRevealedStage);
  }, [currentRiddle, isRevealedStage]);

  const answerLength = sanitizedRiddle?.answerLength || 5;

  // 4. Reset or restore submission state on riddle question change
  useEffect(() => {
    if (!currentRiddle) return;

    riddleStartTimeRef.current = Date.now();
    setShowHint(false);

    const storageKey = `z2o_riddle_${eventId}_${currentRiddle.id}_${participant.id}`;
    const cached = localStorage.getItem(storageKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.submitted) {
          setHasSubmitted(true);
          setSubmittedAnswer(parsed.userAnswer || "");
          setSubmissionResult({
            isCorrect: Boolean(parsed.isCorrect),
            pointsEarned: Number(parsed.pointsEarned) || 0,
          });

          // Set letters to submitted answer
          const ansLetters = (parsed.userAnswer || "").split("");
          while (ansLetters.length < answerLength) ansLetters.push("");
          setLetters(ansLetters);
          return;
        }
      } catch (e) {
        console.warn("Could not parse cached riddle state:", e);
      }
    }

    // New/Unsubmitted riddle
    setLetters(Array(answerLength).fill(""));
    setHasSubmitted(false);
    setSubmittedAnswer("");
    setSubmissionResult(null);
  }, [currentRiddle?.id, eventId, participant.id, answerLength]);

  // 5. Local Drift-Free Countdown Timer Loop
  useEffect(() => {
    const updateCountdown = () => {
      const td = LiveEventEngineService.calculateRemainingTime(session);
      setTimerData(td);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 250);
    return () => clearInterval(interval);
  }, [session]);

  // Handle letter-box keystroke input (0 Firestore writes)
  const handleLetterChange = (index: number, val: string) => {
    if (hasSubmitted || isSubmitting || session.stage !== "running" || session.isFrozen) {
      return;
    }

    const cleanChar = val.toUpperCase().replace(/[^A-Z]/g, "").slice(-1);
    const nextLetters = [...letters];
    nextLetters[index] = cleanChar;
    setLetters(nextLetters);

    // Auto-advance focus to next letter box
    if (cleanChar && index < answerLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle Backspace and Arrow Key navigation
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (hasSubmitted || isSubmitting || session.stage !== "running" || session.isFrozen) {
      return;
    }

    if (e.key === "Backspace") {
      if (!letters[index] && index > 0) {
        // Move to previous box and clear
        inputRefs.current[index - 1]?.focus();
        const nextLetters = [...letters];
        nextLetters[index - 1] = "";
        setLetters(nextLetters);
      } else {
        const nextLetters = [...letters];
        nextLetters[index] = "";
        setLetters(nextLetters);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < answerLength - 1) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === "Enter") {
      handleSubmitAnswer();
    }
  };

  // 6. Handle Answer Submission
  const handleSubmitAnswer = async () => {
    const answerString = letters.join("").trim();
    if (
      !currentRiddle ||
      hasSubmitted ||
      isSubmitting ||
      session.stage !== "running" ||
      session.isFrozen ||
      answerString.length === 0
    ) {
      return;
    }

    setIsSubmitting(true);

    try {
      const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - (session.stageStartedAt || riddleStartTimeRef.current)) / 1000)
      );

      const result = await RiddleActivityAdapter.submitAnswer(
        eventId,
        activityId,
        currentRiddle,
        participant,
        answerString,
        elapsedSeconds
      );

      setSubmittedAnswer(result.sanitizedAnswer);
      setSubmissionResult({
        isCorrect: result.isCorrect,
        pointsEarned: result.pointsEarned,
      });
      setHasSubmitted(true);
    } catch (err) {
      console.error("Failed to submit riddle answer:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Participant current user rank
  const myLeaderboardRank = useMemo(() => {
    const myEntry = leaderboard.find((l) => l.participantId === participant.id);
    return myEntry ? { rank: myEntry.rank, score: myEntry.totalScore } : null;
  }, [leaderboard, participant.id]);

  if (loadingRiddles || !sanitizedRiddle) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 animate-spin">
          <HelpCircle size={24} />
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">
          Synchronizing Live Riddle Challenge...
        </p>
      </div>
    );
  }

  const stage: LiveActivityStage = session.stage || "ready";
  const isReady = stage === "ready";
  const isRunning = stage === "running";
  const isFrozen = stage === "frozen" || session.isFrozen;
  const isReveal = stage === "reveal" || session.isRevealed;
  const isLeaderboard = stage === "leaderboard";

  return (
    <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 1. TOP HEADER & TIMING RADAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
            <HelpCircle size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                Riddle {currentStepIndex + 1} of {totalRiddles}
              </span>
              <span className="text-xs font-mono font-bold text-neutral-400">
                {sanitizedRiddle.points} PTS • {sanitizedRiddle.timeLimitSec}s Limit
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white mt-0.5 tracking-tight">
              {sanitizedRiddle.title || `Engineering Riddle #${currentStepIndex + 1}`}
            </h1>
          </div>
        </div>

        {/* Drift-Free Stage Countdown Timer */}
        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border transition-all ${
              isRunning
                ? "bg-orange-500/10 border-orange-500/40 text-orange-400 shadow-lg shadow-orange-500/10"
                : isFrozen
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : isReveal
                ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                : "bg-neutral-950 border-neutral-800 text-neutral-400"
            }`}
          >
            <Clock
              size={18}
              className={isRunning && !timerData.isExpired ? "animate-pulse text-orange-400" : ""}
            />
            <div className="text-right">
              <div className="text-[9px] font-mono uppercase font-bold tracking-wider text-neutral-400">
                {isRunning
                  ? "Time Remaining"
                  : isFrozen
                  ? "Locked"
                  : isReveal
                  ? "Solution Revealed"
                  : isLeaderboard
                  ? "Standings"
                  : "Get Ready"}
              </div>
              <div className="text-xl font-mono font-black tracking-wider leading-none">
                {isRunning ? timerData.formattedTime : `${sanitizedRiddle.timeLimitSec}s`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. STAGE: READY -> Waiting Briefing */}
      {isReady && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 sm:p-12 rounded-3xl bg-neutral-900/60 border border-neutral-800 text-center space-y-6 shadow-xl"
        >
          <div className="w-16 h-16 rounded-3xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center mx-auto shadow-inner">
            <Sparkles size={32} />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Get Ready for Riddle #{currentStepIndex + 1}!
            </h2>
            <p className="text-sm text-neutral-400 leading-relaxed">
              The host will start the countdown shortly. Decipher the prompt, fill in the letters, and submit before time expires to claim speed points!
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-400">
            <Clock size={14} className="text-orange-400" />
            <span>Allocated Duration: {sanitizedRiddle.timeLimitSec} Seconds</span>
          </div>
        </motion.div>
      )}

      {/* 3. STAGE: RUNNING or FROZEN -> Active Riddle Solving */}
      {(isRunning || isFrozen) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Riddle Prompt Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="text-xs font-mono uppercase tracking-wider text-orange-400 font-bold flex items-center gap-2">
                <Lightbulb size={16} />
                <span>Riddle Prompt</span>
              </div>
              <span className="text-[11px] font-mono text-neutral-500">
                Word Length: {sanitizedRiddle.answerLength} Letters
              </span>
            </div>

            <p className="text-lg sm:text-2xl font-bold text-white leading-relaxed tracking-tight">
              "{sanitizedRiddle.riddleText}"
            </p>

            {/* Optional Hint Toggle */}
            {sanitizedRiddle.hint && (
              <div className="pt-2">
                {!showHint ? (
                  <button
                    type="button"
                    onClick={() => setShowHint(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono transition-all cursor-pointer"
                  >
                    <Lightbulb size={13} />
                    <span>Need a Clue? Reveal Hint</span>
                  </button>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                    <Lightbulb size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-mono uppercase text-[10px] text-amber-400 block">
                        Hint Clue:
                      </strong>
                      <span>{sanitizedRiddle.hint}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Letter Input Character Boxes Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl space-y-6 text-center">
            <div className="space-y-1">
              <div className="text-xs font-mono uppercase font-bold text-neutral-400">
                Your Solution Answer
              </div>
              <p className="text-xs text-neutral-500">
                Type the letters below. Use Backspace to edit or Arrow Keys to navigate.
              </p>
            </div>

            {/* Character Boxes Row */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 py-2 max-w-full">
              {Array.from({ length: sanitizedRiddle.answerLength }).map((_, idx) => {
                const char = letters[idx] || "";
                const isFilled = char.length > 0;

                return (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    maxLength={1}
                    value={char}
                    disabled={hasSubmitted || isFrozen || !isRunning}
                    onChange={(e) => handleLetterChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className={`w-11 h-13 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-mono font-black uppercase rounded-2xl border transition-all outline-none ${
                      hasSubmitted
                        ? "bg-neutral-950 border-neutral-800 text-neutral-400 cursor-not-allowed"
                        : isFilled
                        ? "bg-orange-500/15 border-orange-500 text-white shadow-lg shadow-orange-500/15 ring-2 ring-orange-500/30"
                        : "bg-neutral-950 border-neutral-800 text-white focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30"
                    }`}
                  />
                );
              })}
            </div>

            {/* Submission Status & Action */}
            <div className="pt-2 max-w-md mx-auto space-y-3">
              {hasSubmitted ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-center gap-3">
                  <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                  <div className="text-left text-xs font-mono">
                    <div className="font-bold text-white">Answer Locked &amp; Submitted!</div>
                    <div className="text-neutral-400 mt-0.5">
                      Submitted: <strong className="text-orange-400">{submittedAnswer}</strong>. Awaiting host reveal.
                    </div>
                  </div>
                </div>
              ) : isFrozen ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-center gap-3">
                  <Lock size={18} className="text-amber-400 shrink-0" />
                  <span className="text-xs font-mono font-bold">
                    Submissions have been frozen by the host.
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={
                    isSubmitting ||
                    letters.join("").trim().length === 0 ||
                    !isRunning
                  }
                  className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-black font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                  <span>
                    {isSubmitting ? "Submitting Solution..." : "Submit Answer"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* 4. STAGE: REVEAL -> Show Authoritative Solution & Score */}
      {isReveal && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl space-y-6"
        >
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-2 text-sm font-mono font-black uppercase text-purple-400">
              <Sparkles size={18} />
              <span>Official Riddle Solution</span>
            </div>
            <span className="text-xs font-mono text-neutral-400">
              Riddle #{currentStepIndex + 1}
            </span>
          </div>

          {/* Correct Answer Display */}
          <div className="p-6 rounded-2xl bg-neutral-950 border border-purple-500/30 text-center space-y-4">
            <div className="text-xs font-mono uppercase font-bold text-neutral-400">
              The Correct Answer Is:
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 py-1">
              {(sanitizedRiddle.answer || "").split("").map((letter, idx) => (
                <div
                  key={idx}
                  className="w-12 h-14 sm:w-14 sm:h-16 rounded-2xl bg-emerald-500 text-black font-mono font-black text-2xl sm:text-3xl flex items-center justify-center shadow-lg shadow-emerald-500/20"
                >
                  {letter}
                </div>
              ))}
            </div>

            {/* Explanation Note if provided */}
            {sanitizedRiddle.explanation && (
              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 leading-relaxed text-left max-w-xl mx-auto">
                <strong className="text-purple-400 font-mono uppercase text-[10px] block mb-1">
                  Explanation Note:
                </strong>
                {sanitizedRiddle.explanation}
              </div>
            )}
          </div>

          {/* Participant's Performance Breakdown */}
          <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  submissionResult?.isCorrect
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                    : "bg-red-500/15 border border-red-500/30 text-red-400"
                }`}
              >
                {submissionResult?.isCorrect ? (
                  <CheckCircle2 size={24} />
                ) : (
                  <XCircle size={24} />
                )}
              </div>
              <div>
                <div className="text-xs font-mono uppercase text-neutral-400">
                  {hasSubmitted
                    ? `Your Submission: "${submittedAnswer || "—"}"`
                    : "No Submission Recorded"}
                </div>
                <div className="text-base sm:text-lg font-black text-white">
                  {submissionResult?.isCorrect
                    ? "Correct! Full Points Awarded 🎉"
                    : hasSubmitted
                    ? "Incorrect Answer"
                    : "Missed Deadline"}
                </div>
              </div>
            </div>

            <div className="text-right sm:border-l sm:border-neutral-800 sm:pl-6">
              <div className="text-xs font-mono uppercase text-neutral-400">Points Earned</div>
              <div className="text-2xl font-mono font-black text-orange-400">
                +{submissionResult?.pointsEarned || 0}{" "}
                <span className="text-xs font-normal text-neutral-500">PTS</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 5. STAGE: LEADERBOARD -> Standings Podium */}
      {isLeaderboard && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl space-y-6"
        >
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-2 text-sm font-mono font-black uppercase text-orange-400">
              <Trophy size={18} />
              <span>Riddle Activity Leaderboard</span>
            </div>
            {myLeaderboardRank && (
              <div className="px-3 py-1 rounded-xl bg-orange-500/10 border border-orange-500/30 text-xs font-mono text-orange-300">
                Your Rank: #{myLeaderboardRank.rank} • {myLeaderboardRank.score} PTS
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {leaderboard.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-neutral-500">
                Calculating solver rankings...
              </div>
            ) : (
              leaderboard.map((entry, idx) => {
                const isMe = entry.participantId === participant.id;

                return (
                  <div
                    key={entry.participantId}
                    className={`p-3.5 px-4 rounded-2xl border flex items-center justify-between transition-all ${
                      isMe
                        ? "bg-orange-500/15 border-orange-500/40 text-white shadow-lg shadow-orange-500/10"
                        : "bg-neutral-950 border-neutral-850 text-neutral-300"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="font-mono font-bold text-sm w-7 text-center text-neutral-400">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-white truncate flex items-center gap-2">
                          <span>{entry.name}</span>
                          {isMe && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-orange-500 text-black">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-neutral-500">
                          {entry.correctAnswersCount}/{entry.totalAnswered} Correct
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-base font-mono font-black text-orange-400">
                        {entry.totalScore}
                      </div>
                      <div className="text-[9px] font-mono text-neutral-500">PTS</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
