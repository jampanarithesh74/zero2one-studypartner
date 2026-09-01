/**
 * ZERO2ONE EVENTS — CUSTOM EVENT QUIZ LIVE PARTICIPANT VIEW
 * Feature 5C: Real-time Participant UI for Custom Event Quiz
 *
 * Renders live quiz questions, drift-free client-side countdown timer,
 * single-click atomic submissions, solution reveal, and custom leaderboard.
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trophy,
  Sparkles,
  Zap,
  Loader2,
  Lock,
  Medal,
  Award,
  Users,
} from "lucide-react";
import { EventItem } from "../PublicEventPage";
import { Participant } from "../ParticipantOnboarding";
import { CanonicalLiveSession } from "../../types/liveEventEngine";
import { GenericQuizQuestion } from "../../services/quizBuilderService";
import {
  CustomQuizLiveService,
  CustomQuizParticipantResponse,
  CustomQuizLeaderboardEntry,
} from "../../services/customQuizLiveService";

interface CustomQuizLiveParticipantViewProps {
  event: EventItem;
  currentParticipant?: (Participant & { id?: string }) | null;
  liveSession: CanonicalLiveSession;
}

const OPTION_LABELS = ["A", "B", "C", "D"];
const OPTION_COLORS = [
  { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", badge: "bg-blue-500/20 text-blue-300" },
  { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-300" },
  { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400", badge: "bg-purple-500/20 text-purple-300" },
  { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", badge: "bg-amber-500/20 text-amber-300" },
];

export function CustomQuizLiveParticipantView({
  event,
  currentParticipant,
  liveSession,
}: CustomQuizLiveParticipantViewProps) {
  const activityId = liveSession.currentActivityId;
  const participantId = currentParticipant?.id || "anonymous_participant";
  const participantName = currentParticipant?.name || "Participant";
  const participantPhoto = (currentParticipant as any)?.photo || (currentParticipant as any)?.profilePhotoUrl || "";

  // 1. Load Quiz Questions (ordered by order ASC)
  const [questions, setQuestions] = useState<GenericQuizQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(true);
  const [questionsError, setQuestionsError] = useState<string>("");

  useEffect(() => {
    if (!event.id || !activityId) return;

    let isMounted = true;
    setLoadingQuestions(true);

    CustomQuizLiveService.getQuizQuestions(event.id, activityId)
      .then((loaded) => {
        if (isMounted) {
          setQuestions(loaded);
          setLoadingQuestions(false);
        }
      })
      .catch((err) => {
        console.error("Failed loading quiz questions:", err);
        if (isMounted) {
          setQuestionsError("Unable to load quiz questions.");
          setLoadingQuestions(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [event.id, activityId]);

  // 2. Determine Current Active Question
  const currentQuestionIndex = typeof liveSession.stepIndex === "number" ? liveSession.stepIndex : 0;
  const currentQuestion = questions[currentQuestionIndex] || null;
  const totalQuestions = questions.length || liveSession.totalSteps || 1;

  // 3. Listen to Participant's Response Document (Only 1 doc)
  const [participantResponse, setParticipantResponse] = useState<CustomQuizParticipantResponse | null>(null);

  useEffect(() => {
    if (!event.id || !activityId || !participantId) return;

    const unsub = CustomQuizLiveService.subscribeParticipantResponse(
      event.id,
      activityId,
      participantId,
      (resp) => {
        setParticipantResponse(resp);
      }
    );

    return () => unsub();
  }, [event.id, activityId, participantId]);

  // 4. Listen to Leaderboard when in Leaderboard stage
  const [leaderboard, setLeaderboard] = useState<CustomQuizLeaderboardEntry[]>([]);

  useEffect(() => {
    if (!event.id || !activityId || liveSession.stage !== "leaderboard") return;

    const unsub = CustomQuizLiveService.subscribeQuizLeaderboard(
      event.id,
      activityId,
      15,
      (entries) => {
        setLeaderboard(entries);
      }
    );

    return () => unsub();
  }, [event.id, activityId, liveSession.stage]);

  // 5. Local Drift-Free Countdown Timer
  const [remainingSec, setRemainingSec] = useState<number>(0);

  useEffect(() => {
    if (liveSession.stage !== "running" || !liveSession.stageStartedAt || !liveSession.durationSeconds) {
      setRemainingSec(0);
      return;
    }

    const startMs = liveSession.stageStartedAt;
    const durSec = liveSession.durationSeconds;

    const updateTimer = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const left = Math.max(0, durSec - elapsed);
      setRemainingSec(left);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 250);

    return () => clearInterval(interval);
  }, [liveSession.stage, liveSession.stageStartedAt, liveSession.durationSeconds]);

  // 6. Submission Handling
  const [submittingOption, setSubmittingOption] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string>("");

  const questionAnswerRecord = currentQuestion
    ? participantResponse?.answers?.[currentQuestion.id || currentQuestion.questionId]
    : undefined;

  const hasAnsweredCurrentQuestion = !!questionAnswerRecord;
  const selectedOptionIndex = questionAnswerRecord ? questionAnswerRecord.selectedOptionIndex : submittingOption;

  const handleSelectOption = async (optionIdx: number) => {
    if (
      liveSession.stage !== "running" ||
      hasAnsweredCurrentQuestion ||
      submittingOption !== null ||
      !currentQuestion ||
      !activityId
    ) {
      return;
    }

    setSubmittingOption(optionIdx);
    setSubmitError("");

    const elapsed = liveSession.stageStartedAt
      ? Math.max(0, Math.floor((Date.now() - liveSession.stageStartedAt) / 1000))
      : 0;

    try {
      await CustomQuizLiveService.submitQuizAnswer({
        eventId: event.id,
        activityId,
        participantId,
        participantName,
        participantPhoto,
        questionId: currentQuestion.id || currentQuestion.questionId,
        selectedOptionIndex: optionIdx,
        question: currentQuestion,
        timeTakenSec: elapsed,
      });
    } catch (err: any) {
      console.error("Submission failed:", err);
      setSubmitError(err.message || "Failed to submit answer. Please retry.");
    } finally {
      setSubmittingOption(null);
    }
  };

  // Loading State
  if (loadingQuestions) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3 min-h-[350px]">
        <Loader2 size={32} className="text-orange-500 animate-spin" />
        <p className="text-xs font-mono text-neutral-400">Loading custom event quiz questions...</p>
      </div>
    );
  }

  if (questionsError || !currentQuestion) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3 text-center min-h-[350px]">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
          <AlertCircle size={24} />
        </div>
        <p className="text-sm font-bold text-white">Quiz Question Sync</p>
        <p className="text-xs text-neutral-400 max-w-sm">
          {questionsError || "No questions found for this quiz activity. Please wait for the host."}
        </p>
      </div>
    );
  }

  // Render LEADERBOARD Stage
  if (liveSession.stage === "leaderboard") {
    const userRankEntry = leaderboard.find((e) => e.participantId === participantId);

    return (
      <div className="flex-1 flex flex-col space-y-4 font-sans">
        {/* Leaderboard Header */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-neutral-900 border border-orange-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shadow-inner">
              <Trophy size={20} />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-orange-400 block">
                Quiz Standings
              </span>
              <h2 className="text-base font-black text-white">
                {liveSession.currentActivityTitle || "Live Quiz"} Leaderboard
              </h2>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-mono text-neutral-400 block">Your Score</span>
            <span className="text-base font-mono font-black text-orange-400">
              {participantResponse?.totalScore || 0} pts
            </span>
          </div>
        </div>

        {/* Top 10 Standings Table */}
        <div className="flex-1 rounded-2xl bg-neutral-950/80 border border-neutral-800/80 p-4 space-y-2 overflow-y-auto max-h-[420px]">
          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500 font-mono">
              Computing final question scores...
            </div>
          ) : (
            leaderboard.map((entry, idx) => {
              const isCurrentUser = entry.participantId === participantId;
              const rank = entry.rank || idx + 1;

              return (
                <div
                  key={entry.participantId}
                  className={`p-3 rounded-xl flex items-center justify-between border transition-all ${
                    isCurrentUser
                      ? "bg-orange-500/15 border-orange-500/40 text-white shadow-md ring-1 ring-orange-500/30"
                      : "bg-neutral-900/60 border-neutral-800/60 text-neutral-300"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-black shrink-0 ${
                        rank === 1
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : rank === 2
                          ? "bg-slate-300/20 text-slate-200 border border-slate-300/30"
                          : rank === 3
                          ? "bg-amber-700/20 text-amber-500 border border-amber-700/30"
                          : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                    </span>

                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">
                        {entry.participantName} {isCurrentUser && "(You)"}
                      </p>
                      <p className="text-[10px] font-mono text-neutral-500">
                        {entry.correctCount} correct
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-black text-orange-400">
                      {entry.score} pts
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Stage Status Footer */}
        <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 text-center text-xs text-neutral-400 font-mono flex items-center justify-center gap-2">
          <Clock size={13} className="text-orange-400" />
          <span>Host is reviewing the leaderboard. Standby for next step...</span>
        </div>
      </div>
    );
  }

  // Render QUESTION / PLAY Stages (ready, running, frozen, reveal)
  const isReveal = liveSession.stage === "reveal" || liveSession.isRevealed;
  const isFrozen = liveSession.stage === "frozen" || liveSession.isFrozen;
  const isReady = liveSession.stage === "ready";
  const isRunning = liveSession.stage === "running";

  return (
    <div className="flex-1 flex flex-col space-y-4 font-sans selection:bg-orange-500 selection:text-white">
      {/* 1. Header Tracker Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
            Question {currentQuestionIndex + 1} / {totalQuestions}
          </span>

          <span className="text-xs font-mono font-bold text-neutral-400">
            {currentQuestion.points || 100} PTS
          </span>
        </div>

        {/* Live Countdown / State Pill */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-300 font-mono font-black text-xs animate-pulse">
              <Clock size={13} />
              <span>{remainingSec}s left</span>
            </div>
          ) : isFrozen ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs">
              <Lock size={12} />
              <span>FROZEN</span>
            </div>
          ) : isReveal ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-xs">
              <CheckCircle2 size={12} />
              <span>SOLUTIONS REVEALED</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-800 text-neutral-400 font-mono font-bold text-xs">
              <Sparkles size={12} className="text-orange-400" />
              <span>GET READY</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Question Prompt Canvas */}
      <div className="p-5 sm:p-6 rounded-2xl bg-neutral-950 border border-neutral-800 relative overflow-hidden shadow-xl">
        <div className="space-y-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-500">
            Current Question
          </span>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight leading-snug">
            {currentQuestion.text}
          </h2>
        </div>

        {/* Optional Question Explanation on Reveal */}
        {isReveal && currentQuestion.explanation && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs leading-relaxed"
          >
            <span className="font-bold font-mono uppercase text-[10px] block text-emerald-400 mb-0.5">
              Explanation
            </span>
            {currentQuestion.explanation}
          </motion.div>
        )}
      </div>

      {/* 3. Interactive Options Grid (4 Options) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {currentQuestion.options.map((optionText, idx) => {
          const isSelected = selectedOptionIndex === idx;
          const isCorrectAnswer = idx === currentQuestion.correctOptionIndex;
          const style = OPTION_COLORS[idx % OPTION_COLORS.length];

          // Post-Reveal Styling
          let buttonBg = "bg-neutral-900/80";
          let buttonBorder = "border-neutral-800";
          let badgeBg = style.badge;
          let textColor = "text-neutral-200";

          if (isReveal) {
            if (isCorrectAnswer) {
              buttonBg = "bg-emerald-500/20";
              buttonBorder = "border-emerald-500/60 ring-1 ring-emerald-500/40";
              textColor = "text-emerald-200 font-bold";
              badgeBg = "bg-emerald-500 text-black font-black";
            } else if (isSelected && !isCorrectAnswer) {
              buttonBg = "bg-red-500/20";
              buttonBorder = "border-red-500/60";
              textColor = "text-red-300";
              badgeBg = "bg-red-500/40 text-red-200";
            } else {
              buttonBg = "bg-neutral-950/60";
              buttonBorder = "border-neutral-900";
              textColor = "text-neutral-500";
            }
          } else if (isSelected) {
            buttonBg = "bg-orange-500/20";
            buttonBorder = "border-orange-500 ring-2 ring-orange-500/30";
            textColor = "text-white font-bold";
            badgeBg = "bg-orange-500 text-white font-black";
          } else if (isRunning && !hasAnsweredCurrentQuestion) {
            buttonBg = "hover:bg-neutral-800/80 active:scale-[0.99]";
            buttonBorder = "hover:border-neutral-700";
          }

          const isDisabled = !isRunning || hasAnsweredCurrentQuestion || submittingOption !== null;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectOption(idx)}
              disabled={isDisabled}
              className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer disabled:cursor-not-allowed ${buttonBg} ${buttonBorder}`}
            >
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-black shrink-0 ${badgeBg}`}
              >
                {OPTION_LABELS[idx]}
              </span>

              <div className="flex-1 min-w-0 pt-0.5">
                <p className={`text-xs sm:text-sm leading-snug break-words ${textColor}`}>
                  {optionText}
                </p>
              </div>

              {/* Status Icons */}
              {isReveal && isCorrectAnswer && (
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              )}
              {isReveal && isSelected && !isCorrectAnswer && (
                <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              )}
              {!isReveal && isSelected && (
                <CheckCircle2 size={16} className="text-orange-400 shrink-0 mt-0.5 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Feedback & Status Banner */}
      {submitError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-between text-xs font-mono text-neutral-400">
        <div className="flex items-center gap-2">
          {hasAnsweredCurrentQuestion ? (
            <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
              <CheckCircle2 size={14} />
              Answer locked in (Option {OPTION_LABELS[questionAnswerRecord.selectedOptionIndex]})
            </span>
          ) : isRunning ? (
            <span className="text-orange-400 flex items-center gap-1.5 font-bold">
              <Zap size={14} />
              Select an option above before time expires!
            </span>
          ) : isReady ? (
            <span>Awaiting host to start Question {currentQuestionIndex + 1}...</span>
          ) : isFrozen ? (
            <span>Submissions locked. Host is discussing the question...</span>
          ) : (
            <span>Solutions revealed. Standby for leaderboard...</span>
          )}
        </div>

        <div className="text-right font-bold text-neutral-300">
          Total Score: <span className="text-orange-400">{participantResponse?.totalScore || 0} pts</span>
        </div>
      </div>
    </div>
  );
}
