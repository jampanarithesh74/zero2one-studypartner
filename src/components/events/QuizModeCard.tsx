import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Sparkles,
  Hourglass,
  Zap
} from "lucide-react";
import { doc, collection, onSnapshot, setDoc, serverTimestamp, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Participant } from "../ParticipantOnboarding";
import { QuizSessionData, QuizLeaderboardEntry } from "../../data/quizQuestions";
import { QuizLeaderboardView } from "./QuizLeaderboardView";

interface QuizModeCardProps {
  eventId: string;
  currentParticipant?: Participant | null;
  quizSession?: QuizSessionData | null;
}

export function QuizModeCard({ eventId, currentParticipant, quizSession: passedQuizSession }: QuizModeCardProps) {
  const [session, setSession] = useState<QuizSessionData | null>(passedQuizSession || null);
  const [leaderboard, setLeaderboard] = useState<QuizLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(!passedQuizSession);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [isTimesUp, setIsTimesUp] = useState<boolean>(false);
  const [transitionCountdown, setTransitionCountdown] = useState<number>(3);

  const participantId =
    currentParticipant?.id ||
    currentParticipant?.name ||
    `participant_${Math.random().toString(36).substring(2, 9)}`;

  // 1. Sync passed quizSession or listen if not passed
  useEffect(() => {
    if (passedQuizSession) {
      setSession(passedQuizSession);
      setLoading(false);
      return;
    }

    if (!eventId) return;

    setLoading(true);
    const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");

    const unsubSession = onSnapshot(
      sessionRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setSession(docSnap.data() as QuizSessionData);
        } else {
          setSession(null);
        }
        setLoading(false);
      },
      (error) => {
        console.warn("Participant quiz session listener warning:", error);
        setLoading(false);
      }
    );

    return () => unsubSession();
  }, [eventId, passedQuizSession]);

  // 2. Listen to Top 10 Leaderboard + Participant's own entry
  useEffect(() => {
    if (!eventId) return;

    const leaderboardRef = collection(db, "events", eventId, "activities", "quiz", "leaderboard");
    const qLb = query(leaderboardRef, orderBy("currentScore", "desc"), limit(10));

    const unsubLeaderboard = onSnapshot(
      qLb,
      (snapshot) => {
        const list: QuizLeaderboardEntry[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as QuizLeaderboardEntry);
        });
        setLeaderboard(list);
      },
      (error) => {
        console.warn("Leaderboard listener error:", error);
      }
    );

    const userLbRef = doc(db, "events", eventId, "activities", "quiz", "leaderboard", participantId);
    const unsubUserLb = onSnapshot(userLbRef, (docSnap) => {
      if (docSnap.exists()) {
        const userEntry = docSnap.data() as QuizLeaderboardEntry;
        setLeaderboard((prev) => {
          if (prev.some((e) => e.participantId === participantId)) {
            return prev.map((e) => (e.participantId === participantId ? userEntry : e));
          } else {
            return [...prev, userEntry];
          }
        });
      }
    });

    return () => {
      unsubLeaderboard();
      unsubUserLb();
    };
  }, [eventId, participantId]);

  // 3. Reset selection state whenever currentQuestionIndex changes
  useEffect(() => {
    setSelectedOption(null);
    setIsSubmitted(false);
    setIsTimesUp(false);
    setTransitionCountdown(3);
  }, [session?.currentQuestionIndex]);

  // 4. Listen if participant already submitted for current question in Firestore
  useEffect(() => {
    if (!eventId || !session || session.status !== "running" || session.currentQuestionIndex === undefined) {
      return;
    }

    const responseRef = doc(
      db,
      "events",
      eventId,
      "activities",
      "quiz",
      "responses",
      participantId
    );

    const unsubResp = onSnapshot(responseRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const qKey = `question${session.currentQuestionIndex}`;
        if (data && data[qKey] !== undefined) {
          setSelectedOption(data[qKey]);
          setIsSubmitted(true);
        }
      }
    });

    return () => unsubResp();
  }, [eventId, session?.currentQuestionIndex, session?.status, participantId]);

  // 5. Question Timer Logic
  useEffect(() => {
    if (!session || session.status !== "running" || session.stage !== "question" || !session.questionStartTime) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - session.questionStartTime) / 1000);
      const remaining = Math.max(0, (session.timerDuration || 30) - elapsed);
      setTimeRemaining(remaining);

      if (remaining === 0 && !isTimesUp) {
        setIsTimesUp(true);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [session?.questionStartTime, session?.timerDuration, session?.status, session?.stage, isTimesUp]);

  // 6. 3-2-1 Transition countdown when question timer reaches 0
  useEffect(() => {
    if (!isTimesUp) return;

    // Auto-submit "No Response" (-1) if timer expired and no option selected
    if (!isSubmitted) {
      handleOptionSelect(-1, true);
    }

    const timer = setInterval(() => {
      setTransitionCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimesUp, isSubmitted]);

  // Save Option Selection to Firestore
  const handleOptionSelect = async (optionIdx: number, forceAutoSubmit = false) => {
    if (isSubmitted && !forceAutoSubmit) return;
    if (session?.status !== "running") return;

    setSelectedOption(optionIdx);
    setIsSubmitted(true);

    try {
      const responseRef = doc(
        db,
        "events",
        eventId,
        "activities",
        "quiz",
        "responses",
        participantId
      );

      const qKey = `question${session.currentQuestionIndex}`;
      const submittedTime = Date.now();

      await setDoc(
        responseRef,
        {
          participantId,
          participantName: currentParticipant?.name || "Participant",
          [qKey]: optionIdx,
          [`${qKey}_submittedAt`]: submittedTime,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Error saving quiz response:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
        <Loader2 size={24} className="text-orange-500 animate-spin" />
        <p className="text-xs font-mono text-neutral-400">Loading quiz room...</p>
      </div>
    );
  }

  if (!session || session.status !== "running") {
    return null;
  }

  const currentQ = session.currentQuestion;
  const timerPercentage = Math.max(0, Math.min(100, (timeRemaining / 30) * 100));

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-orange-500/40 rounded-2xl overflow-hidden shadow-2xl text-left font-sans relative">
      {/* Top Banner Header */}
      <div className="p-3.5 border-b border-neutral-800 bg-neutral-900/90 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">🧠</span>
          <h2 className="text-xs font-black uppercase tracking-wider text-white">
            Quiz Mode
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-black text-orange-400 bg-orange-500/15 border border-orange-500/30 uppercase tracking-wider">
            Question {session.currentQuestionIndex + 1} of 5
          </span>
        </div>
      </div>

      {/* Progress Bar (Visible during Question stage) */}
      {session.stage === "question" && (
        <div className="w-full bg-neutral-900 h-1.5 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-500 ${
              timeRemaining <= 5 ? "bg-red-500 animate-pulse" : "bg-orange-500"
            }`}
            style={{ width: `${timerPercentage}%` }}
          />
        </div>
      )}

      {/* Main Dynamic View */}
      <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between space-y-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          {session.stage === "answer_reveal" ? (
            /* ANSWER REVEAL SCREEN */
            <motion.div
              key="reveal-screen"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 flex flex-col justify-between space-y-5 my-auto"
            >
              <div className="space-y-4 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase text-emerald-400 bg-emerald-500/15 border border-emerald-500/30">
                  <span>✔ CORRECT ANSWER REVEAL</span>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-neutral-900 border-2 border-emerald-500/60 text-white space-y-2 shadow-xl">
                  <span className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-widest block">
                    Correct Answer
                  </span>
                  <p className="text-xl font-black text-emerald-300">
                    {String.fromCharCode(65 + (currentQ?.correctOptionIndex || 0))}.{" "}
                    {currentQ?.options[currentQ?.correctOptionIndex || 0]}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 leading-relaxed text-left">
                  <span className="font-mono font-bold text-neutral-400 block mb-1">
                    Explanation:
                  </span>
                  {currentQ?.explanation}
                </div>

                {/* Fastest Answer Badge */}
                {session.fastestResponse && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between gap-3 text-xs font-mono font-bold shadow-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Zap size={18} className="text-amber-400 animate-bounce shrink-0" />
                      <div>
                        <span className="text-[10px] text-amber-400 uppercase tracking-wider block">
                          ⚡ Fastest Correct Answer
                        </span>
                        <span className="text-sm font-black text-white block">
                          {session.fastestResponse.participantName}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-amber-400 block">
                        {session.fastestResponse.responseTimeSec}s
                      </span>
                      <span className="text-[10px] text-emerald-400 font-black">
                        +{session.fastestResponse.speedBonus} Speed Bonus
                      </span>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="text-center text-xs font-mono text-neutral-400 pt-2 border-t border-neutral-800">
                <span>Waiting for leaderboard...</span>
              </div>
            </motion.div>
          ) : session.stage === "leaderboard" || session.stage === "completed" ? (
            /* LEADERBOARD / PODIUM VIEW */
            <motion.div
              key="leaderboard-screen"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1"
            >
              <QuizLeaderboardView
                leaderboard={leaderboard}
                currentParticipantId={participantId}
                isFinal={session.stage === "completed"}
                title={
                  session.stage === "completed"
                    ? "🏆 FINAL QUIZ WINNERS"
                    : `🏆 Question ${session.currentQuestionIndex + 1} Standings`
                }
              />
            </motion.div>
          ) : isTimesUp && transitionCountdown > 0 ? (
            /* 3-2-1 TIME'S UP TRANSITION */
            <motion.div
              key="times-up-transition"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex-1 min-h-[220px] rounded-2xl bg-neutral-950 border border-orange-500/30 p-6 flex flex-col items-center justify-center text-center space-y-3 my-auto"
            >
              <Hourglass size={32} className="text-orange-400 animate-bounce" />
              <h3 className="text-xl font-black text-white uppercase tracking-tight">
                Time's Up!
              </h3>
              <p className="text-xs text-neutral-400 font-mono">
                Revealing correct answer in
              </p>
              <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/40 text-orange-400 font-mono font-black text-2xl flex items-center justify-center shadow-xl">
                {transitionCountdown}
              </div>
            </motion.div>
          ) : (
            /* QUESTION & 4 OPTIONS VIEW */
            <motion.div
              key={`question-${session.currentQuestionIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col justify-between space-y-6"
            >
              {/* Question Header & Countdown */}
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight leading-snug">
                  {currentQ?.text}
                </h3>

                <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-amber-400 font-mono font-black text-xs">
                  <Clock size={14} className="animate-spin" />
                  <span>{timeRemaining}s</span>
                </div>
              </div>

              {/* 4 Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-auto">
                {currentQ?.options.map((optionText, idx) => {
                  const isThisSelected = selectedOption === idx;
                  const isDisabled = isSubmitted;

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleOptionSelect(idx)}
                      className={`p-4 rounded-xl border text-left font-bold text-sm transition-all flex items-center gap-3 cursor-pointer ${
                        isThisSelected
                          ? "bg-orange-500/20 border-orange-500 text-white shadow-lg shadow-orange-500/10 ring-2 ring-orange-500/40"
                          : isDisabled
                          ? "bg-neutral-900/40 border-neutral-800/60 text-neutral-500 cursor-not-allowed"
                          : "bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-200 hover:bg-neutral-850"
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-lg font-mono font-extrabold text-xs flex items-center justify-center shrink-0 border ${
                          isThisSelected
                            ? "bg-orange-500 text-white border-orange-400"
                            : "bg-neutral-800 text-neutral-400 border-neutral-700"
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="flex-1 leading-snug">{optionText}</span>
                    </button>
                  );
                })}
              </div>

              {/* Footer Status */}
              <div className="pt-3 border-t border-neutral-800/90 flex items-center justify-between">
                {isSubmitted ? (
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span>
                      {selectedOption === -1
                        ? "No Response recorded."
                        : "Your answer has been recorded."}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs font-mono text-neutral-400 flex items-center gap-2">
                    <Sparkles size={14} className="text-orange-400" />
                    <span>Select 1 option to submit your response</span>
                  </div>
                )}

                <span className="text-[10px] font-mono text-neutral-400">
                  Waiting for next question...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
