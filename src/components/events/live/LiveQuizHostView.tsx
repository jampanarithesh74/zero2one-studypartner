import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  Eye,
  Trophy,
  ChevronRight,
  Clock,
  Zap,
  Users,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BarChart2,
  ShieldCheck,
  Flag,
  Loader2,
} from "lucide-react";
import { CanonicalLiveSession, LiveActivityStage } from "../../../types/liveEventEngine";
import {
  QuizActivityAdapter,
  QuizQuestionStats,
  QuizLeaderboardEntry,
} from "../../../services/quizActivityAdapter";
import { GenericQuizQuestion } from "../../../services/quizBuilderService";
import { LiveEventEngineService } from "../../../services/liveEventEngineService";
import { EventActivity } from "../../../services/eventActivityService";

interface LiveQuizHostViewProps {
  eventId: string;
  activity: EventActivity;
  session: CanonicalLiveSession;
  allActivities: EventActivity[];
  isActionPending: boolean;
  onStartQuestion: (stepIndex: number, durationSeconds: number) => Promise<void>;
  onFreezeQuestion: () => Promise<void>;
  onRevealQuestion: () => Promise<void>;
  onShowLeaderboard: () => Promise<void>;
  onAdvanceNextQuestion: (nextStepIndex: number, durationSeconds: number) => Promise<void>;
  onAdvanceNextActivity: () => Promise<void>;
  onCompleteEvent: () => void;
}

export function LiveQuizHostView({
  eventId,
  activity,
  session,
  allActivities,
  isActionPending,
  onStartQuestion,
  onFreezeQuestion,
  onRevealQuestion,
  onShowLeaderboard,
  onAdvanceNextQuestion,
  onAdvanceNextActivity,
  onCompleteEvent,
}: LiveQuizHostViewProps) {
  const [questions, setQuestions] = useState<GenericQuizQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(true);
  const [questionStats, setQuestionStats] = useState<QuizQuestionStats>({
    questionId: "",
    totalSubmissions: 0,
    optionCounts: [0, 0, 0, 0],
    correctCount: 0,
  });

  const [leaderboard, setLeaderboard] = useState<QuizLeaderboardEntry[]>([]);

  // 1. Fetch all questions for this Quiz Activity
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoadingQuestions(true);
      try {
        const qList = await QuizActivityAdapter.fetchQuizQuestions(eventId, activity.id);
        if (isMounted) {
          setQuestions(qList);
          setIsLoadingQuestions(false);
        }
      } catch (err) {
        console.error("Failed to load quiz questions for host:", err);
        if (isMounted) setIsLoadingQuestions(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [eventId, activity.id]);

  const currentStepIndex = session.stepIndex ?? 0;
  const currentQuestion = questions[currentStepIndex] || null;
  const totalQuestions = questions.length;
  const isLastQuestion = currentStepIndex >= totalQuestions - 1;

  const currentActIdx = session.currentActivityIndex;
  const isLastActivity = currentActIdx >= allActivities.length - 1;
  const nextActivity = allActivities[currentActIdx + 1] || null;

  // 2. Real-time Subscription to Submissions for Active Question
  useEffect(() => {
    if (!eventId || !activity.id || !currentQuestion?.id) return;

    const unsubscribe = QuizActivityAdapter.subscribeQuestionStats(
      eventId,
      activity.id,
      currentQuestion.id,
      (stats) => {
        setQuestionStats(stats);
      }
    );

    return () => unsubscribe();
  }, [eventId, activity.id, currentQuestion?.id]);

  // 3. Real-time Subscription to Quiz Leaderboard
  useEffect(() => {
    if (!eventId || !activity.id) return;

    const unsubscribe = QuizActivityAdapter.subscribeQuizLeaderboard(
      eventId,
      activity.id,
      (entries) => {
        setLeaderboard(entries);
      }
    );

    return () => unsubscribe();
  }, [eventId, activity.id]);

  // Local drift-free timer
  const [timerData, setTimerData] = useState({
    remainingSeconds: 0,
    isExpired: false,
    progressPercentage: 0,
    formattedTime: "00:00",
  });

  useEffect(() => {
    const update = () => {
      const td = LiveEventEngineService.calculateRemainingTime(session);
      setTimerData(td);
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [session]);

  const currentStage: LiveActivityStage = session.stage || "ready";

  const OPTION_LETTERS = ["A", "B", "C", "D"];

  if (isLoadingQuestions) {
    return (
      <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-10 text-center space-y-3">
        <Loader2 size={28} className="text-orange-500 animate-spin mx-auto" />
        <div className="text-xs font-mono text-neutral-400">Loading Quiz Question Engine...</div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-8 text-center space-y-3">
        <AlertCircle size={32} className="text-amber-500 mx-auto" />
        <h3 className="text-sm font-bold text-white uppercase">No Questions Configured</h3>
        <p className="text-xs text-neutral-400">
          This Quiz activity has no questions attached. Please configure questions in the Quiz Builder.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. QUIZ QUESTION SCRUBBER / STEP TRACKER */}
      <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 size={16} className="text-orange-400" />
            <span className="text-xs font-black text-white uppercase tracking-wider">
              QUIZ QUESTIONS TIMELINE ({totalQuestions} TOTAL)
            </span>
          </div>

          <span className="text-[10px] font-mono font-bold text-neutral-400">
            CURRENT: Q{currentStepIndex + 1}
          </span>
        </div>

        {/* Step Pills */}
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {questions.map((q, idx) => {
            const isDone = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const isUpcoming = idx > currentStepIndex;

            return (
              <div
                key={q.id}
                className={`p-2 rounded-xl border text-center transition-all ${
                  isCurrent
                    ? "bg-orange-500/20 border-orange-500 text-orange-400 ring-1 ring-orange-500/50 shadow-md"
                    : isDone
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 opacity-80"
                    : "bg-neutral-900/60 border-neutral-800 text-neutral-500"
                }`}
              >
                <div className="text-[10px] font-mono font-bold">
                  {isDone ? `Q${idx + 1} ✓` : `Q${idx + 1}`}
                </div>
                <div className="text-[8px] font-mono text-neutral-400 mt-0.5">
                  {q.timeLimitSec || 15}s
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. ACTIVE QUESTION RADAR & HOST COCKPIT */}
      {currentQuestion && (
        <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-850">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-orange-400 uppercase tracking-wider">
                <span>QUESTION {currentStepIndex + 1} OF {totalQuestions}</span>
                <span>&bull;</span>
                <span className="text-emerald-400">{currentQuestion.points || 100} PTS</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight mt-1 leading-snug">
                {currentQuestion.text}
              </h3>
            </div>

            {/* Countdown / Status Widget */}
            <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 px-5 py-3 rounded-2xl shrink-0 self-start sm:self-center">
              <Clock
                size={22}
                className={currentStage === "running" ? "text-orange-400 animate-pulse" : "text-neutral-500"}
              />
              <div>
                <div className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                  {currentStage === "running" ? "TIME REMAINING" : "QUESTION TIME"}
                </div>
                <div className="text-2xl font-mono font-black text-white tracking-wider">
                  {currentStage === "running"
                    ? timerData.formattedTime
                    : `${Math.floor((currentQuestion.timeLimitSec || 15) / 60)
                        .toString()
                        .padStart(2, "0")}:${((currentQuestion.timeLimitSec || 15) % 60)
                        .toString()
                        .padStart(2, "0")}`}
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Submissions Meter */}
          <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-bold text-white uppercase">
                <Users size={15} className="text-orange-400" />
                <span>Live Submissions Received</span>
              </div>
              <div className="font-mono font-black text-orange-400">
                {questionStats.totalSubmissions} Submitted
              </div>
            </div>

            {/* Breakdown Bars for Options A, B, C, D */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {OPTION_LETTERS.map((letter, optIdx) => {
                const count = questionStats.optionCounts[optIdx] || 0;
                const isCorrect = optIdx === currentQuestion.correctOptionIndex;
                const pct = questionStats.totalSubmissions > 0
                  ? Math.round((count / questionStats.totalSubmissions) * 100)
                  : 0;

                return (
                  <div
                    key={letter}
                    className={`p-2.5 rounded-xl border text-xs flex flex-col justify-between ${
                      isCorrect
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400"
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-bold">
                      <span>Option {letter}</span>
                      {isCorrect && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase">
                          KEY ✓
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-sm font-mono font-black text-white">{count}</span>
                      <span className="text-[10px] font-mono text-neutral-400">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Options Display with Answer Key Highlight */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              ANSWER OPTIONS &amp; KEY
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentQuestion.options.map((optText, optIdx) => {
                const isCorrect = optIdx === currentQuestion.correctOptionIndex;

                return (
                  <div
                    key={optIdx}
                    className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 ${
                      isCorrect
                        ? "bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10"
                        : "bg-neutral-900/60 border-neutral-800 text-neutral-300"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                        isCorrect ? "bg-emerald-500 text-black" : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {OPTION_LETTERS[optIdx]}
                    </div>
                    <div className="text-xs font-medium pt-0.5 flex-1">{optText}</div>
                    {isCorrect && (
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    )}
                  </div>
                );
              })}
            </div>

            {currentQuestion.explanation && (
              <div className="p-3.5 rounded-2xl bg-neutral-900/40 border border-neutral-850 text-xs text-neutral-300 space-y-1">
                <span className="font-mono text-[10px] font-bold uppercase text-neutral-400 block">
                  Question Explanation (Shown on Reveal):
                </span>
                <p className="text-neutral-400 leading-relaxed">{currentQuestion.explanation}</p>
              </div>
            )}
          </div>

          {/* 3. AUTHORITATIVE ACTION BUTTONS */}
          <div className="space-y-3 pt-2 border-t border-neutral-850">
            <div className="text-xs font-black text-neutral-400 uppercase tracking-wider">
              AUTHORITATIVE STAGE ACTION
            </div>

            {/* STAGE: READY -> Enable [ START QUESTION X ] */}
            {currentStage === "ready" && (
              <button
                type="button"
                onClick={() =>
                  onStartQuestion(currentStepIndex, currentQuestion.timeLimitSec || 15)
                }
                disabled={isActionPending}
                className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-black font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isActionPending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>STARTING QUESTION {currentStepIndex + 1}...</span>
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    <span>
                      START QUESTION {currentStepIndex + 1} ({currentQuestion.timeLimitSec || 15}s TIMER)
                    </span>
                  </>
                )}
              </button>
            )}

            {/* STAGE: RUNNING -> Enable [ FREEZE ] and [ REVEAL ] */}
            {currentStage === "running" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onFreezeQuestion}
                  disabled={isActionPending}
                  className="py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-black font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isActionPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Pause size={18} />
                      <span>FREEZE QUESTION</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onRevealQuestion}
                  disabled={isActionPending}
                  className="py-4 px-6 rounded-2xl bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isActionPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Eye size={18} />
                      <span>REVEAL CORRECT ANSWER</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* STAGE: FROZEN -> Enable [ REVEAL ] */}
            {currentStage === "frozen" && (
              <button
                type="button"
                onClick={onRevealQuestion}
                disabled={isActionPending}
                className="w-full py-4 px-6 rounded-2xl bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isActionPending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>REVEALING ANSWER...</span>
                  </>
                ) : (
                  <>
                    <Eye size={18} />
                    <span>REVEAL CORRECT ANSWER</span>
                  </>
                )}
              </button>
            )}

            {/* STAGE: REVEAL -> Enable [ SHOW LEADERBOARD ] */}
            {currentStage === "reveal" && (
              <button
                type="button"
                onClick={onShowLeaderboard}
                disabled={isActionPending}
                className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isActionPending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>UPDATING LEADERBOARD...</span>
                  </>
                ) : (
                  <>
                    <Trophy size={18} />
                    <span>SHOW QUIZ STANDINGS / LEADERBOARD</span>
                  </>
                )}
              </button>
            )}

            {/* STAGE: LEADERBOARD -> Enable [ NEXT QUESTION ] or [ NEXT ACTIVITY / COMPLETE ] */}
            {currentStage === "leaderboard" && (
              <div>
                {!isLastQuestion ? (
                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx = currentStepIndex + 1;
                      const nextQ = questions[nextIdx];
                      onAdvanceNextQuestion(nextIdx, nextQ?.timeLimitSec || 15);
                    }}
                    disabled={isActionPending}
                    className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-black font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isActionPending ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>LAUNCHING NEXT QUESTION...</span>
                      </>
                    ) : (
                      <>
                        <span>START QUESTION {currentStepIndex + 2} OF {totalQuestions}</span>
                        <ChevronRight size={18} />
                      </>
                    )}
                  </button>
                ) : (
                  <div>
                    {!isLastActivity ? (
                      <button
                        type="button"
                        onClick={onAdvanceNextActivity}
                        disabled={isActionPending}
                        className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isActionPending ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            <span>ADVANCING TO NEXT ACTIVITY...</span>
                          </>
                        ) : (
                          <>
                            <span>NEXT ACTIVITY ({nextActivity?.title || "Next"})</span>
                            <ChevronRight size={18} />
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onCompleteEvent}
                        disabled={isActionPending}
                        className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-black font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Flag size={18} />
                        <span>FINALIZE &amp; COMPLETE LIVE EVENT 🏁</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
