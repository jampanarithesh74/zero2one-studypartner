import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Trophy,
  AlertCircle,
  HelpCircle,
  Send,
  Zap,
  Lock,
  ChevronRight,
  Award,
  Medal,
  Users,
} from "lucide-react";
import { CanonicalLiveSession, LiveActivityStage } from "../../../types/liveEventEngine";
import {
  QuizActivityAdapter,
  SanitizedQuizQuestion,
  QuizLeaderboardEntry,
} from "../../../services/quizActivityAdapter";
import { GenericQuizQuestion } from "../../../services/quizBuilderService";
import { LiveEventEngineService } from "../../../services/liveEventEngineService";

interface LiveQuizParticipantViewProps {
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

export function LiveQuizParticipantView({
  eventId,
  activityId,
  session,
  participant,
}: LiveQuizParticipantViewProps) {
  const [questions, setQuestions] = useState<GenericQuizQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(true);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<{
    isCorrect: boolean;
    pointsEarned: number;
  } | null>(null);

  // Leaderboard data
  const [leaderboard, setLeaderboard] = useState<QuizLeaderboardEntry[]>([]);

  // Local drift-free timer state
  const [timerData, setTimerData] = useState({
    remainingSeconds: 0,
    isExpired: false,
    progressPercentage: 0,
    formattedTime: "00:00",
  });

  // Track start time for speed bonus calculation
  const questionStartTimeRef = useRef<number>(Date.now());

  // 1. Fetch Questions for this Quiz Activity (Point in time read)
  useEffect(() => {
    let isMounted = true;
    async function loadQuestions() {
      setLoadingQuestions(true);
      try {
        const fetched = await QuizActivityAdapter.fetchQuizQuestions(eventId, activityId);
        if (isMounted) {
          setQuestions(fetched);
          setLoadingQuestions(false);
        }
      } catch (err) {
        console.error("Failed to load quiz questions:", err);
        if (isMounted) setLoadingQuestions(false);
      }
    }

    loadQuestions();
    return () => {
      isMounted = false;
    };
  }, [eventId, activityId]);

  // 2. Real-time Leaderboard Subscription (only when in reveal/leaderboard stages)
  useEffect(() => {
    if (!eventId || !activityId) return;

    const unsubscribe = QuizActivityAdapter.subscribeQuizLeaderboard(
      eventId,
      activityId,
      (entries) => {
        setLeaderboard(entries);
      }
    );

    return () => unsubscribe();
  }, [eventId, activityId]);

  // 3. Current Question Index
  const currentStepIndex = session.stepIndex ?? 0;
  const currentQuestion = questions[currentStepIndex] || null;
  const totalQuestions = questions.length || session.totalSteps || 1;

  // 4. Reset or restore submission state on question change
  useEffect(() => {
    if (!currentQuestion) return;

    questionStartTimeRef.current = Date.now();
    const storageKey = `z2o_quiz_${eventId}_${currentQuestion.id}_${participant.id}`;
    const cached = localStorage.getItem(storageKey);

    if (cached === "true") {
      setHasSubmitted(true);
    } else {
      setSelectedOption(null);
      setHasSubmitted(false);
      setSubmissionResult(null);
    }
  }, [currentQuestion?.id, eventId, participant.id]);

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

  // 6. Handle Answer Submission
  const handleSelectOption = async (optionIndex: number) => {
    if (
      !currentQuestion ||
      hasSubmitted ||
      isSubmitting ||
      session.stage !== "running" ||
      session.isFrozen
    ) {
      return;
    }

    setSelectedOption(optionIndex);
    setIsSubmitting(true);

    try {
      const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - (session.stageStartedAt || questionStartTimeRef.current)) / 1000)
      );

      const result = await QuizActivityAdapter.submitAnswer(
        eventId,
        activityId,
        currentQuestion,
        participant,
        optionIndex,
        elapsedSeconds
      );

      setSubmissionResult(result);
      setHasSubmitted(true);
    } catch (err) {
      console.error("Failed to submit quiz answer:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Participant's personal standing in the leaderboard
  const myLeaderboardEntry = useMemo(() => {
    return leaderboard.find((e) => e.participantId === participant.id) || null;
  }, [leaderboard, participant.id]);

  // Letters helper for option cards
  const OPTION_LETTERS = ["A", "B", "C", "D"];
  const OPTION_COLORS = [
    { border: "border-blue-500/40", bg: "bg-blue-500/10", text: "text-blue-400", activeBg: "bg-blue-600 text-white" },
    { border: "border-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-400", activeBg: "bg-emerald-600 text-white" },
    { border: "border-amber-500/40", bg: "bg-amber-500/10", text: "text-amber-400", activeBg: "bg-amber-600 text-white" },
    { border: "border-purple-500/40", bg: "bg-purple-500/10", text: "text-purple-400", activeBg: "bg-purple-600 text-white" },
  ];

  // ==========================================
  // STAGE 1: READY / LOBBY (Intro screen)
  // ==========================================
  if (session.stage === "ready") {
    return (
      <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 bg-[#0e0e12] border border-neutral-800/90 rounded-3xl text-left font-sans shadow-2xl relative overflow-hidden">
        {/* Subtle Ambient Radial Lighting */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-neutral-950/40 to-transparent pointer-events-none" />

        {/* Top Tag */}
        <div className="flex items-center justify-between relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
            <span>ACTIVITY LOBBY</span>
          </div>

          <span className="text-xs font-mono text-neutral-400">
            {totalQuestions} {totalQuestions === 1 ? "Question" : "Questions"}
          </span>
        </div>

        {/* Middle Hero Content */}
        <div className="my-auto py-8 text-center space-y-4 relative z-10 max-w-md mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center mx-auto shadow-xl shadow-orange-500/10">
            <Sparkles size={32} />
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-400">
              ROUND READY
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              {session.currentActivityTitle || "Interactive Quiz"}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              The host will start Question 1 momentarily. Keep this tab open—answers will unlock instantly when the timer starts.
            </p>
          </div>

          {/* Quick Rules Strip */}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center">
            <div className="p-3 rounded-2xl bg-neutral-900/90 border border-neutral-800">
              <div className="text-[10px] font-bold text-neutral-500 uppercase">Questions</div>
              <div className="text-sm font-mono font-bold text-white mt-0.5">{totalQuestions}</div>
            </div>
            <div className="p-3 rounded-2xl bg-neutral-900/90 border border-neutral-800">
              <div className="text-[10px] font-bold text-neutral-500 uppercase">Speed Bonus</div>
              <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">+20%</div>
            </div>
            <div className="p-3 rounded-2xl bg-neutral-900/90 border border-neutral-800">
              <div className="text-[10px] font-bold text-neutral-500 uppercase">Standings</div>
              <div className="text-sm font-mono font-bold text-orange-400 mt-0.5">Live</div>
            </div>
          </div>
        </div>

        {/* Bottom Status */}
        <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between text-xs text-neutral-400 relative z-10">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-orange-400 animate-pulse" />
            <span className="font-medium text-neutral-300">Awaiting Host Broadcast...</span>
          </div>
          <span className="font-mono text-[11px] text-neutral-500">Live Sync Active</span>
        </div>
      </div>
    );
  }

  // ==========================================
  // STAGE 5: LEADERBOARD VIEW
  // ==========================================
  if (session.stage === "leaderboard") {
    const top3 = leaderboard.slice(0, 3);
    const rest = leaderboard.slice(3, 10);

    return (
      <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 bg-[#0e0e12] border border-neutral-800/90 rounded-3xl text-left font-sans shadow-2xl space-y-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-850">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-orange-400" />
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                QUIZ STANDINGS
              </h2>
              <div className="text-[10px] font-mono text-neutral-400">
                Question {currentStepIndex + 1} of {totalQuestions}
              </div>
            </div>
          </div>

          {myLeaderboardEntry && (
            <div className="px-3 py-1 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-mono font-bold">
              Your Rank: #{myLeaderboardEntry.rank} &bull; {myLeaderboardEntry.totalScore} pts
            </div>
          )}
        </div>

        {/* Podium Top 3 */}
        {leaderboard.length > 0 ? (
          <div className="space-y-4 flex-1 overflow-y-auto">
            {top3.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {top3.map((entry, idx) => {
                  const isFirst = idx === 0;
                  const isSecond = idx === 1;
                  const isThird = idx === 2;

                  return (
                    <motion.div
                      key={entry.participantId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`p-3.5 rounded-2xl border flex flex-col justify-between text-center relative ${
                        isFirst
                          ? "bg-gradient-to-b from-amber-500/20 to-neutral-900 border-amber-500/50 shadow-lg shadow-amber-500/10 order-1 sm:order-2"
                          : isSecond
                          ? "bg-neutral-900 border-neutral-700 order-2 sm:order-1"
                          : "bg-neutral-900 border-neutral-800 order-3 sm:order-3"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="text-lg">
                          {isFirst ? "🥇" : isSecond ? "🥈" : "🥉"}
                        </div>
                        <div className="text-xs font-bold text-white truncate px-1">
                          {entry.name}
                        </div>
                        {entry.department && (
                          <div className="text-[10px] text-neutral-400 font-mono">
                            {entry.department}
                          </div>
                        )}
                      </div>

                      <div className="mt-2 pt-2 border-t border-neutral-800 font-mono text-xs font-black text-orange-400">
                        {entry.totalScore} PTS
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Rest of Leaderboard List (Ranks 4-10) */}
            {rest.length > 0 && (
              <div className="space-y-1.5">
                {rest.map((entry) => (
                  <div
                    key={entry.participantId}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                      entry.participantId === participant.id
                        ? "bg-orange-500/10 border-orange-500/40 text-orange-200"
                        : "bg-neutral-900/60 border-neutral-850 text-neutral-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono font-bold text-neutral-500 w-5">
                        #{entry.rank}
                      </span>
                      <span className="font-bold truncate">{entry.name}</span>
                    </div>
                    <span className="font-mono font-bold text-orange-400 shrink-0">
                      {entry.totalScore} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-neutral-500 font-mono">
            No submissions recorded yet for this round.
          </div>
        )}

        {/* Footer */}
        <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <span className="font-medium">Standby for host progression...</span>
          <span className="font-mono text-[10px] text-neutral-500">Live Stage</span>
        </div>
      </div>
    );
  }

  // ==========================================
  // STAGES 2, 3, 4: QUESTION ACTIVE (RUNNING / FROZEN / REVEAL)
  // ==========================================
  if (!currentQuestion) {
    return (
      <div className="p-8 text-center text-xs text-neutral-400 font-mono bg-[#0e0e12] border border-neutral-800 rounded-3xl">
        Question data is synchronizing with server...
      </div>
    );
  }

  const isRevealStage = session.stage === "reveal";
  const isFrozenStage = session.stage === "frozen" || session.isFrozen;
  const isRunningStage = session.stage === "running";

  return (
    <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 bg-[#0e0e12] border border-neutral-800/90 rounded-3xl text-left font-sans shadow-2xl space-y-5">
      {/* 1. Top Bar: Question Progress, Points, & Countdown Timer */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-neutral-850">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center font-mono font-black text-xs">
            {currentStepIndex + 1}
          </div>
          <div>
            <div className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
              QUESTION {currentStepIndex + 1} OF {totalQuestions}
            </div>
            <div className="text-xs font-bold text-white">
              {currentQuestion.points || 100} Points
            </div>
          </div>
        </div>

        {/* Timer Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 font-mono text-xs">
          <Clock
            size={14}
            className={
              isRunningStage && !timerData.isExpired
                ? "text-orange-400 animate-pulse"
                : "text-neutral-500"
            }
          />
          <span
            className={`font-black ${
              isRunningStage && !timerData.isExpired
                ? "text-white"
                : "text-neutral-400"
            }`}
          >
            {isRunningStage ? timerData.formattedTime : isFrozenStage ? "LOCKED" : "REVEAL"}
          </span>
        </div>
      </div>

      {/* 2. Question Text */}
      <div className="space-y-3 py-2">
        <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug">
          {currentQuestion.text}
        </h3>
      </div>

      {/* 3. Options Grid (A, B, C, D) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
        {currentQuestion.options.map((optionText, optIdx) => {
          const isSelected = selectedOption === optIdx;
          const letter = OPTION_LETTERS[optIdx];
          const colorMeta = OPTION_COLORS[optIdx];

          // In reveal stage, determine correct vs wrong highlight
          const isCorrectAnswer = isRevealStage && currentQuestion.correctOptionIndex === optIdx;
          const isWrongSelection = isRevealStage && isSelected && !isCorrectAnswer;

          let cardStyle = "bg-neutral-900/80 border-neutral-800 text-neutral-200 hover:border-neutral-700";

          if (isRevealStage) {
            if (isCorrectAnswer) {
              cardStyle = "bg-emerald-500/20 border-emerald-500 text-white ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20";
            } else if (isWrongSelection) {
              cardStyle = "bg-red-500/20 border-red-500 text-red-200 opacity-90";
            } else {
              cardStyle = "bg-neutral-950 border-neutral-850 text-neutral-500 opacity-50";
            }
          } else if (isSelected) {
            cardStyle = "bg-orange-500/20 border-orange-500 text-white ring-2 ring-orange-500/50 shadow-lg shadow-orange-500/20";
          } else if (hasSubmitted || isFrozenStage) {
            cardStyle = "bg-neutral-900/40 border-neutral-850 text-neutral-500 cursor-not-allowed opacity-60";
          }

          return (
            <motion.button
              key={optIdx}
              type="button"
              onClick={() => handleSelectOption(optIdx)}
              disabled={hasSubmitted || isFrozenStage || isRevealStage || isSubmitting}
              whileHover={!hasSubmitted && !isFrozenStage && !isRevealStage ? { scale: 1.01 } : {}}
              whileTap={!hasSubmitted && !isFrozenStage && !isRevealStage ? { scale: 0.99 } : {}}
              className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${cardStyle}`}
            >
              {/* Option Letter Pill */}
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                  isRevealStage && isCorrectAnswer
                    ? "bg-emerald-500 text-black"
                    : isRevealStage && isWrongSelection
                    ? "bg-red-500 text-white"
                    : isSelected
                    ? "bg-orange-500 text-white"
                    : "bg-neutral-800 text-neutral-400"
                }`}
              >
                {letter}
              </div>

              {/* Option Text */}
              <div className="flex-1 font-medium text-xs sm:text-sm pt-0.5 leading-relaxed">
                {optionText}
              </div>

              {/* Reveal Icons */}
              {isRevealStage && isCorrectAnswer && (
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              )}
              {isRevealStage && isWrongSelection && (
                <XCircle size={18} className="text-red-400 shrink-0" />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* 4. Stage-specific Feedback & Explanation Banner */}
      <div className="pt-2">
        {/* REVEAL STAGE FEEDBACK */}
        {isRevealStage && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-2 text-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedOption === currentQuestion.correctOptionIndex ? (
                  <div className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
                    <CheckCircle2 size={16} />
                    <span>CORRECT ANSWER!</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-red-400 font-bold">
                    <XCircle size={16} />
                    <span>INCORRECT</span>
                  </div>
                )}
              </div>

              <div className="font-mono font-bold text-orange-400">
                {submissionResult?.pointsEarned || (selectedOption === currentQuestion.correctOptionIndex ? currentQuestion.points : 0)} PTS GAINED
              </div>
            </div>

            {currentQuestion.explanation && (
              <p className="text-neutral-300 text-xs leading-relaxed pt-1 border-t border-neutral-800">
                <strong className="text-neutral-400 uppercase font-mono text-[10px] block mb-0.5">
                  Explanation:
                </strong>
                {currentQuestion.explanation}
              </p>
            )}
          </motion.div>
        )}

        {/* RUNNING / FROZEN SUBMITTED FEEDBACK */}
        {!isRevealStage && hasSubmitted && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Answer submitted! Standby for host reveal...</span>
            </div>
            <span className="font-mono text-[10px] text-emerald-400 font-bold uppercase">
              Locked
            </span>
          </div>
        )}

        {/* FROZEN (NO SUBMISSION) */}
        {!isRevealStage && !hasSubmitted && isFrozenStage && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-semibold flex items-center gap-2">
            <Lock size={16} className="text-amber-400 shrink-0" />
            <span>Time expired. Submissions are frozen for this question.</span>
          </div>
        )}
      </div>
    </div>
  );
}
