import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, 
  RotateCcw, 
  Clock, 
  Users, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  ChevronRight,
  StopCircle,
  Trophy,
  Zap
} from "lucide-react";
import { 
  doc, 
  collection, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  getDocs, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { DEMO_QUIZ_QUESTIONS, QuizSessionData, QuizLeaderboardEntry } from "../../data/quizQuestions";
import { QuizLeaderboardView } from "./QuizLeaderboardView";

interface AdminQuizControllerProps {
  eventId: string;
  participantCount?: number;
  onBackToControls?: () => void;
}

export function AdminQuizController({
  eventId,
  participantCount = 0,
  onBackToControls,
}: AdminQuizControllerProps) {
  const [selectedActivity, setSelectedActivity] = useState<"quiz" | "crossword" | "riddles">("quiz");
  const [session, setSession] = useState<QuizSessionData | null>(null);
  const [leaderboard, setLeaderboard] = useState<QuizLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [responseCount, setResponseCount] = useState<number>(0);
  const [toastMsg, setToastMsg] = useState<string>("");
  const [timeRemaining, setTimeRemaining] = useState<number>(30);

  const processedTimerZeroRef = useRef<boolean>(false);
  const answerRevealTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Listen to Quiz Session
  useEffect(() => {
    if (!eventId) return;

    setLoading(true);
    const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");

    const unsubSession = onSnapshot(
      sessionRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as QuizSessionData;
          setSession(data);
          if (data.status === "running") {
            setSelectedActivity("quiz");
          }
        } else {
          setSession(null);
        }
        setLoading(false);
      },
      (error) => {
        console.warn("Quiz session listener error:", error);
        setLoading(false);
      }
    );

    return () => unsubSession();
  }, [eventId]);

  // 2. Listen to Leaderboard
  useEffect(() => {
    if (!eventId) return;

    const leaderboardRef = collection(db, "events", eventId, "activities", "quiz", "leaderboard");

    const unsubLeaderboard = onSnapshot(
      leaderboardRef,
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

    return () => unsubLeaderboard();
  }, [eventId]);

  // 3. Listen to Responses Count for Current Question
  useEffect(() => {
    if (!eventId || !session || session.status !== "running") {
      setResponseCount(0);
      return;
    }

    const responsesRef = collection(db, "events", eventId, "activities", "quiz", "responses");

    const unsubResponses = onSnapshot(
      responsesRef,
      (snapshot) => {
        let count = 0;
        const qKey = `question${session.currentQuestionIndex}`;
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data[qKey] !== undefined) {
            count++;
          }
        });
        setResponseCount(count);
      },
      (error) => {
        console.warn("Quiz responses listener error:", error);
      }
    );

    return () => unsubResponses();
  }, [eventId, session?.currentQuestionIndex, session?.status]);

  // Reset timer zero tracker on question change
  useEffect(() => {
    processedTimerZeroRef.current = false;
  }, [session?.currentQuestionIndex]);

  // 4. Timer Countdown & Auto Transition to Answer Reveal
  useEffect(() => {
    if (!session || session.status !== "running" || session.stage !== "question" || !session.questionStartTime) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - session.questionStartTime) / 1000);
      const remaining = Math.max(0, (session.timerDuration || 30) - elapsed);
      setTimeRemaining(remaining);

      if (remaining === 0 && !processedTimerZeroRef.current) {
        processedTimerZeroRef.current = true;
        handleQuestionTimeExpired();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [session?.questionStartTime, session?.timerDuration, session?.status, session?.stage]);

  // 5. Answer Reveal 5-second Auto Timer -> Leaderboard
  useEffect(() => {
    if (session?.status === "running" && session.stage === "answer_reveal") {
      if (answerRevealTimerRef.current) clearTimeout(answerRevealTimerRef.current);

      answerRevealTimerRef.current = setTimeout(() => {
        transitionToLeaderboard();
      }, 5000);
    }

    return () => {
      if (answerRevealTimerRef.current) clearTimeout(answerRevealTimerRef.current);
    };
  }, [session?.stage, session?.status]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // Process Scoring & Transition to Answer Reveal
  const handleQuestionTimeExpired = async () => {
    if (!session || !eventId) return;

    const currentQIndex = session.currentQuestionIndex;
    const currentQ = DEMO_QUIZ_QUESTIONS[currentQIndex];
    if (!currentQ) return;

    try {
      // 1. Fetch all participant responses for this question
      const responsesRef = collection(db, "events", eventId, "activities", "quiz", "responses");
      const respSnap = await getDocs(responsesRef);

      const qKey = `question${currentQIndex}`;
      let fastestResponder: {
        participantId: string;
        participantName: string;
        responseTimeSec: number;
        speedBonus: number;
      } | null = null;

      let fastestTime = 999;

      // 2. Score each participant response
      const promises: Promise<void>[] = [];

      respSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const pId = docSnap.id;
        const pName = data.participantName || "Participant";
        const selectedOpt = data[qKey];
        const submittedAt = data[`${qKey}_submittedAt`] || session.questionStartTime + 30000;

        const isCorrect = selectedOpt === currentQ.correctOptionIndex;
        const elapsedSec = Math.max(0, Math.min(30, (submittedAt - session.questionStartTime) / 1000));
        const remainingSec = Math.max(0, 30 - elapsedSec);
        const speedBonus = isCorrect ? Math.round(remainingSec) : 0;
        const questionPoints = isCorrect ? 100 + speedBonus : 0;

        if (isCorrect && elapsedSec < fastestTime) {
          fastestTime = elapsedSec;
          fastestResponder = {
            participantId: pId,
            participantName: pName,
            responseTimeSec: Math.round(elapsedSec * 10) / 10,
            speedBonus,
          };
        }

        // Update leaderboard entry in Firestore
        const lbDocRef = doc(db, "events", eventId, "activities", "quiz", "leaderboard", pId);
        const existingEntry = leaderboard.find((e) => e.participantId === pId);
        const oldScore = existingEntry ? existingEntry.currentScore : 0;
        const oldAnsCount = existingEntry ? existingEntry.questionsAnswered : 0;
        const oldCorrectCount = existingEntry ? existingEntry.correctAnswers : 0;

        const updatedEntry: QuizLeaderboardEntry = {
          participantId: pId,
          name: pName,
          photo: data.photo || "",
          currentScore: oldScore + questionPoints,
          questionsAnswered: oldAnsCount + 1,
          correctAnswers: oldCorrectCount + (isCorrect ? 1 : 0),
          lastAnswerTime: Date.now(),
        };

        promises.push(setDoc(lbDocRef, updatedEntry, { merge: true }));
      });

      await Promise.all(promises);

      // 3. Update session stage to "answer_reveal"
      const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");
      await updateDoc(sessionRef, {
        stage: "answer_reveal",
        fastestResponse: fastestResponder,
      });
    } catch (err: any) {
      console.error("Error processing scoring:", err);
    }
  };

  // Transition to Leaderboard stage
  const transitionToLeaderboard = async () => {
    if (!eventId) return;
    try {
      const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");
      await updateDoc(sessionRef, {
        stage: "leaderboard",
      });
    } catch (err: any) {
      console.error("Error transitioning to leaderboard:", err);
    }
  };

  // Start Quiz Session
  const handleStartQuiz = async () => {
    try {
      // Clear old leaderboard and responses
      const respRef = collection(db, "events", eventId, "activities", "quiz", "responses");
      const respDocs = await getDocs(respRef);
      const deleteRespPromises = respDocs.docs.map((d) => deleteDoc(d.ref));

      const lbRef = collection(db, "events", eventId, "activities", "quiz", "leaderboard");
      const lbDocs = await getDocs(lbRef);
      const deleteLbPromises = lbDocs.docs.map((d) => deleteDoc(d.ref));

      await Promise.all([...deleteRespPromises, ...deleteLbPromises]);

      const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");
      const initialSession: QuizSessionData = {
        status: "running",
        stage: "question",
        currentQuestionIndex: 0,
        currentQuestion: DEMO_QUIZ_QUESTIONS[0],
        startedAt: Date.now(),
        questionStartTime: Date.now(),
        timerDuration: 30,
        isRunning: true,
        fastestResponse: null,
      };

      await setDoc(sessionRef, initialSession);
      setSelectedActivity("quiz");
    } catch (err: any) {
      console.error("Error starting quiz:", err);
      showToast("Failed to start quiz: " + err.message);
    }
  };

  // Advance to Next Question
  const handleNextQuestion = async () => {
    if (!session) return;
    const nextIdx = session.currentQuestionIndex + 1;

    try {
      const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");

      if (nextIdx >= DEMO_QUIZ_QUESTIONS.length) {
        // Quiz completed
        await updateDoc(sessionRef, {
          stage: "completed",
          isRunning: false,
        });
        showToast("Quiz completed! Showing final standings.");
      } else {
        await updateDoc(sessionRef, {
          stage: "question",
          currentQuestionIndex: nextIdx,
          currentQuestion: DEMO_QUIZ_QUESTIONS[nextIdx],
          questionStartTime: Date.now(),
          isRunning: true,
          fastestResponse: null,
        });
      }
    } catch (err: any) {
      console.error("Error advancing question:", err);
      showToast("Failed to advance question: " + err.message);
    }
  };

  // End Quiz (Returns participants back to normal room)
  const handleEndQuiz = async () => {
    try {
      const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");
      await updateDoc(sessionRef, {
        status: "ended",
        stage: "completed",
        isRunning: false,
      });
      showToast("Quiz ended. Participants returned to main room.");
    } catch (err: any) {
      console.error("Error ending quiz:", err);
      showToast("Failed to end quiz");
    }
  };

  const currentQ = session?.currentQuestion;

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-neutral-800/90 rounded-2xl overflow-hidden shadow-xl text-left font-sans relative">
      {/* Toast Overlay */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-orange-500 text-white font-mono text-xs font-bold shadow-2xl border border-orange-400"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="p-3.5 border-b border-neutral-800 bg-neutral-900/90 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">🧠</span>
          <h2 className="text-xs font-black uppercase tracking-wider text-white">
            Activities Controller
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {onBackToControls && (
            <button
              type="button"
              onClick={onBackToControls}
              className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono font-bold transition-all cursor-pointer"
            >
              ← Back to Q&A
            </button>
          )}
          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-orange-500/15 border border-orange-500/30 text-orange-400">
            HOST CONTROLLER
          </span>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 p-5 sm:p-6 flex flex-col space-y-5 overflow-y-auto">
        {/* Activity Selection Tabs */}
        <div>
          <h3 className="text-[11px] font-mono font-bold text-neutral-400 uppercase tracking-wider mb-2">
            Select Activity
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setSelectedActivity("quiz")}
              className={`p-3 rounded-xl font-bold text-xs transition-all flex items-center justify-between cursor-pointer border ${
                selectedActivity === "quiz" || session?.status === "running"
                  ? "bg-orange-500/15 border-orange-500 text-orange-400 shadow-lg shadow-orange-500/10"
                  : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-850"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🧠</span>
                <span>Quiz</span>
              </div>
              {session?.status === "running" && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => showToast("🧩 Crossword: Coming Soon!")}
              className="p-3 rounded-xl font-bold text-xs bg-neutral-900/60 border border-neutral-800/80 text-neutral-400 hover:text-neutral-300 transition-all flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🧩</span>
                <span>Crossword</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                Coming Soon
              </span>
            </button>

            <button
              type="button"
              onClick={() => showToast("❓ Riddles: Coming Soon!")}
              className="p-3 rounded-xl font-bold text-xs bg-neutral-900/60 border border-neutral-800/80 text-neutral-400 hover:text-neutral-300 transition-all flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">❓</span>
                <span>Riddles</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                Coming Soon
              </span>
            </button>
          </div>
        </div>

        {/* Dynamic Activity Area */}
        <AnimatePresence mode="wait">
          {session?.status === "running" ? (
            session.stage === "question" ? (
              /* ACTIVE QUESTION MONITOR */
              <motion.div
                key="running-question"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex-1 rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-orange-500/40 p-5 flex flex-col justify-between space-y-5 shadow-2xl relative overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider text-orange-400 bg-orange-500/15 border border-orange-500/30">
                    <Sparkles size={11} />
                    <span>Question {session.currentQuestionIndex + 1} of 5</span>
                  </div>

                  <span className="text-xs font-mono font-black text-amber-400 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <Clock size={13} className="animate-spin" />
                    <span>{timeRemaining}s</span>
                  </span>
                </div>

                <div className="space-y-3 my-auto">
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                    {currentQ?.text}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {currentQ?.options.map((opt, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                          idx === currentQ.correctOptionIndex
                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                            : "bg-neutral-950/80 border-neutral-800 text-neutral-300"
                        }`}
                      >
                        <span className="w-5 h-5 rounded-lg bg-neutral-800 text-neutral-400 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="truncate">{opt}</span>
                        {idx === currentQ.correctOptionIndex && (
                          <CheckCircle2 size={13} className="text-emerald-400 ml-auto shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-3 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono font-bold text-orange-400">
                    <Users size={14} />
                    <span>
                      Responses: {responseCount} / {participantCount || "?"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleQuestionTimeExpired}
                      className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
                    >
                      <span>Reveal Answer Now</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : session.stage === "answer_reveal" ? (
              /* ANSWER REVEAL MONITOR */
              <motion.div
                key="running-reveal"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex-1 rounded-2xl bg-neutral-950 border border-emerald-500/40 p-5 flex flex-col justify-between space-y-4 shadow-2xl"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/30">
                    ✔ CORRECT ANSWER REVEAL
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400">
                    Auto-advancing to leaderboard in 5s...
                  </span>
                </div>

                <div className="space-y-3 my-auto">
                  <div className="p-4 rounded-xl bg-emerald-500/15 border-2 border-emerald-500/60 text-white space-y-1">
                    <span className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-widest block">
                      Correct Answer
                    </span>
                    <p className="text-lg font-black text-emerald-300">
                      {String.fromCharCode(65 + (currentQ?.correctOptionIndex || 0))}.{" "}
                      {currentQ?.options[currentQ?.correctOptionIndex || 0]}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 leading-relaxed">
                    <span className="font-mono font-bold text-neutral-400 block mb-0.5">
                      Explanation:
                    </span>
                    {currentQ?.explanation}
                  </div>

                  {session.fastestResponse && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-2 text-xs font-mono font-bold">
                      <Zap size={16} className="text-amber-400 animate-bounce shrink-0" />
                      <span>
                        Fastest Correct Answer:{" "}
                        <strong className="text-white">{session.fastestResponse.participantName}</strong> in{" "}
                        {session.fastestResponse.responseTimeSec}s (+{session.fastestResponse.speedBonus} pts)
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={transitionToLeaderboard}
                  className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Show Leaderboard Now</span>
                  <ChevronRight size={14} />
                </button>
              </motion.div>
            ) : session.stage === "leaderboard" ? (
              /* LEADERBOARD MONITOR (ADMIN NEXT QUESTION CONTROL) */
              <motion.div
                key="running-leaderboard"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex-1 rounded-2xl bg-neutral-950 border border-orange-500/40 p-5 flex flex-col justify-between space-y-4 shadow-2xl"
              >
                <div className="max-h-[360px] overflow-y-auto pr-1">
                  <QuizLeaderboardView
                    leaderboard={leaderboard}
                    title={`🏆 Standings (Q${session.currentQuestionIndex + 1}/5)`}
                  />
                </div>

                <div className="pt-3 border-t border-neutral-800 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleEndQuiz}
                    className="px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <StopCircle size={14} />
                    <span>End Quiz</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-black text-xs transition-all shadow-xl shadow-orange-500/20 cursor-pointer flex items-center gap-1.5 border border-orange-400/40"
                  >
                    <span>
                      {session.currentQuestionIndex >= DEMO_QUIZ_QUESTIONS.length - 1
                        ? "Finish Quiz & Final Winners"
                        : "Next Question"}
                    </span>
                    <ChevronRight size={15} />
                  </button>
                </div>
              </motion.div>
            ) : (
              /* COMPLETED MONITOR */
              <motion.div
                key="running-completed"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex-1 rounded-2xl bg-neutral-950 border border-amber-500/40 p-5 flex flex-col justify-between space-y-4 shadow-2xl"
              >
                <div className="max-h-[380px] overflow-y-auto pr-1">
                  <QuizLeaderboardView
                    leaderboard={leaderboard}
                    isFinal={true}
                    title="🏆 QUIZ COMPLETE - FINAL WINNERS"
                  />
                </div>

                <div className="pt-3 border-t border-neutral-800 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleStartQuiz}
                    className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer border border-neutral-700"
                  >
                    <RotateCcw size={14} />
                    <span>Restart Quiz</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleEndQuiz}
                    className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs transition-all cursor-pointer shadow-lg shadow-orange-500/20"
                  >
                    <span>Exit Quiz Mode</span>
                  </button>
                </div>
              </motion.div>
            )
          ) : (
            /* QUIZ SETUP CARD */
            <motion.div
              key="setup-quiz"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 rounded-2xl bg-neutral-950 border border-neutral-800 p-5 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 uppercase tracking-wider">
                    QUIZ SETUP
                  </span>
                  {session?.status === "ended" && (
                    <span className="text-[10px] font-mono text-neutral-400">
                      Previous session completed
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-black text-white tracking-tight">
                  Engineering Basics Quiz
                </h3>

                <div className="grid grid-cols-2 gap-3 py-1">
                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-left">
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
                      Questions
                    </span>
                    <span className="text-sm font-black text-white font-mono block mt-0.5">
                      5 Questions
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-left">
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
                      Timer / Question
                    </span>
                    <span className="text-sm font-black text-orange-400 font-mono block mt-0.5">
                      30 Seconds
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                    Questions Overview
                  </span>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {DEMO_QUIZ_QUESTIONS.map((q, idx) => (
                      <div
                        key={q.id}
                        className="text-xs p-2 rounded-lg bg-neutral-900/80 border border-neutral-800/80 text-neutral-300 flex items-center justify-between gap-2"
                      >
                        <span className="truncate font-medium">
                          {idx + 1}. {q.text}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 font-bold shrink-0">
                          30s
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartQuiz}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-black text-sm tracking-wide transition-all shadow-xl shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-2 border border-orange-400/40"
              >
                <Play size={16} className="fill-white" />
                <span>Start Quiz</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
