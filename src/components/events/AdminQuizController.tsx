import { useState, useEffect } from "react";
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
  Puzzle,
  ChevronRight,
  StopCircle
} from "lucide-react";
import { doc, collection, onSnapshot, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { DEMO_QUIZ_QUESTIONS, QuizSessionData } from "../../data/quizQuestions";

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
  const [selectedActivity, setSelectedActivity] = useState<"quiz" | "crossword" | "riddles" | null>(null);
  const [session, setSession] = useState<QuizSessionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [responseCount, setResponseCount] = useState<number>(0);
  const [toastMsg, setToastMsg] = useState<string>("");
  const [timeRemaining, setTimeRemaining] = useState<number>(30);

  // Firestore Session Listener
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

  // Firestore Responses Listener
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

  // Timer Tick for Admin Monitor
  useEffect(() => {
    if (!session || session.status !== "running" || !session.questionStartTime) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - session.questionStartTime) / 1000);
      const remaining = Math.max(0, (session.timerDuration || 30) - elapsed);
      setTimeRemaining(remaining);
    }, 500);

    return () => clearInterval(interval);
  }, [session?.questionStartTime, session?.timerDuration, session?.status]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // Start Quiz Session
  const handleStartQuiz = async () => {
    try {
      const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");
      const initialSession: QuizSessionData = {
        status: "running",
        currentQuestionIndex: 0,
        currentQuestion: DEMO_QUIZ_QUESTIONS[0],
        startedAt: Date.now(),
        questionStartTime: Date.now(),
        timerDuration: 30,
        isRunning: true,
      };

      await setDoc(sessionRef, initialSession);
      setSelectedActivity("quiz");
    } catch (err: any) {
      console.error("Error starting quiz:", err);
      showToast("Failed to start quiz: " + err.message);
    }
  };

  // Next Question
  const handleNextQuestion = async () => {
    if (!session) return;
    const nextIdx = session.currentQuestionIndex + 1;

    try {
      const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");

      if (nextIdx >= DEMO_QUIZ_QUESTIONS.length) {
        // End quiz
        await updateDoc(sessionRef, {
          status: "ended",
          isRunning: false,
        });
        showToast("Quiz completed!");
      } else {
        await updateDoc(sessionRef, {
          currentQuestionIndex: nextIdx,
          currentQuestion: DEMO_QUIZ_QUESTIONS[nextIdx],
          questionStartTime: Date.now(),
          isRunning: true,
        });
      }
    } catch (err: any) {
      console.error("Error advancing question:", err);
      showToast("Failed to advance question: " + err.message);
    }
  };

  // End Quiz
  const handleEndQuiz = async () => {
    try {
      const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");
      await updateDoc(sessionRef, {
        status: "ended",
        isRunning: false,
      });
      showToast("Quiz ended by admin.");
    } catch (err: any) {
      console.error("Error ending quiz:", err);
      showToast("Failed to end quiz");
    }
  };

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
            Activities Panel
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {onBackToControls && (
            <button
              type="button"
              onClick={onBackToControls}
              className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono font-bold transition-all"
            >
              ← Back to Q&A
            </button>
          )}
          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-orange-500/15 border border-orange-500/30 text-orange-400">
            HOST CONTROLLER
          </span>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 p-5 sm:p-6 flex flex-col space-y-6 overflow-y-auto">
        {/* Three Activity Selection Buttons (Always Visible at top) */}
        <div>
          <h3 className="text-[11px] font-mono font-bold text-neutral-400 uppercase tracking-wider mb-2">
            Select Activity
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* 🧠 Quiz Button */}
            <button
              type="button"
              onClick={() => setSelectedActivity("quiz")}
              className={`p-3.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between cursor-pointer border ${
                selectedActivity === "quiz" || session?.status === "running"
                  ? "bg-orange-500/15 border-orange-500 text-orange-400 shadow-lg shadow-orange-500/10"
                  : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-850 hover:border-neutral-700"
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

            {/* 🧩 Crossword (Coming Soon) */}
            <button
              type="button"
              onClick={() => showToast("🧩 Crossword: Coming Soon!")}
              className="p-3.5 rounded-xl font-bold text-xs bg-neutral-900/60 border border-neutral-800/80 text-neutral-400 hover:text-neutral-300 transition-all flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🧩</span>
                <span>Crossword</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                Coming Soon
              </span>
            </button>

            {/* ❓ Riddles (Coming Soon) */}
            <button
              type="button"
              onClick={() => showToast("❓ Riddles: Coming Soon!")}
              className="p-3.5 rounded-xl font-bold text-xs bg-neutral-900/60 border border-neutral-800/80 text-neutral-400 hover:text-neutral-300 transition-all flex items-center justify-between cursor-pointer"
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

        {/* Dynamic Activity Content Area */}
        <AnimatePresence mode="wait">
          {session?.status === "running" ? (
            /* ACTIVE QUIZ MONITOR (ADMIN VIEW DURING QUIZ) */
            <motion.div
              key="running-quiz"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-orange-500/40 p-5 flex flex-col justify-between space-y-5 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-2xl rounded-full pointer-events-none" />

              {/* Status Header */}
              <div className="flex items-center justify-between gap-2 relative z-10">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider text-orange-400 bg-orange-500/15 border border-orange-500/30">
                  <Sparkles size={11} />
                  <span>Question {session.currentQuestionIndex + 1} of 5</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-black text-amber-400 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <Clock size={13} className="animate-spin" />
                    <span>{timeRemaining}s</span>
                  </span>
                </div>
              </div>

              {/* Question Text */}
              <div className="space-y-2 relative z-10 my-auto">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  {session.currentQuestion?.text}
                </h3>

                {/* Display Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {session.currentQuestion?.options.map((opt, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800/90 text-xs text-neutral-300 font-medium flex items-center gap-2"
                    >
                      <span className="w-5 h-5 rounded-lg bg-neutral-800 text-neutral-400 font-mono font-bold text-[10px] flex items-center justify-center">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="truncate">{opt}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Response Stats Footer & Next Control */}
              <div className="pt-3 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono font-bold text-orange-400 shadow-inner">
                  <Users size={14} />
                  <span>
                    Responses: {responseCount} / {participantCount || "?"}
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleEndQuiz}
                    className="px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <StopCircle size={14} />
                    <span>End Quiz</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-orange-500/20"
                  >
                    <span>
                      {session.currentQuestionIndex >= DEMO_QUIZ_QUESTIONS.length - 1
                        ? "Finish Quiz"
                        : "Next Question"}
                    </span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : selectedActivity === "quiz" ? (
            /* QUIZ SETUP CARD */
            <motion.div
              key="setup-quiz"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 rounded-2xl bg-neutral-950 border border-neutral-800 p-5 sm:p-6 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 uppercase tracking-wider">
                    <span>QUIZ SETUP</span>
                  </div>
                  {session?.status === "ended" && (
                    <span className="text-[10px] font-mono text-neutral-400">
                      Previous quiz ended
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-black text-white tracking-tight">
                  Engineering Basics Quiz
                </h3>

                <div className="grid grid-cols-2 gap-3 py-2">
                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-left">
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
                      Number of Questions
                    </span>
                    <span className="text-base font-black text-white font-mono mt-0.5 block">
                      5 Questions
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-left">
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
                      Time per Question
                    </span>
                    <span className="text-base font-black text-orange-400 font-mono mt-0.5 block">
                      30 Seconds
                    </span>
                  </div>
                </div>

                {/* Question Preview List */}
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                    Demo Questions Preview
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
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

              {/* Start Quiz Action */}
              <button
                type="button"
                onClick={handleStartQuiz}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-black text-sm tracking-wide transition-all shadow-xl shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-2 border border-orange-400/40"
              >
                <Play size={16} className="fill-white" />
                <span>Start Quiz</span>
              </button>
            </motion.div>
          ) : (
            /* IDLE SELECT ACTIVITY PLACEHOLDER */
            <motion.div
              key="idle-select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 p-6 flex flex-col items-center justify-center text-center space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center text-xl shadow-lg">
                🧠
              </div>
              <div className="space-y-1 max-w-xs">
                <h4 className="text-sm font-black text-white">
                  Ready to engage participants?
                </h4>
                <p className="text-xs text-neutral-400">
                  Select 🧠 Quiz above to start the 5-question Engineering Basics challenge.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
