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
  ChevronLeft,
  StopCircle, 
  Trophy, 
  Zap,
  Lock,
  Eye,
  Radio,
  ShieldCheck, 
  Activity,
  Send,
  EyeOff
} from "lucide-react";
import { 
  doc, 
  collection, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  getDocs, 
  deleteDoc, 
  serverTimestamp,
  query,
  orderBy,
  limit,
  writeBatch
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { DEMO_QUIZ_QUESTIONS, QuizSessionData, QuizLeaderboardEntry } from "../../data/quizQuestions";
import { CROSSWORD_ACTIVITIES, RIDDLE_ACTIVITIES } from "../../data/engineeringFailureData";
import { 
  BroadcastService, 
  ActiveBroadcastData, 
  CrosswordService, 
  RiddleService 
} from "../../services/activityService";
import { QuizLeaderboardView } from "./QuizLeaderboardView";
import { CrosswordActivityView } from "./CrosswordActivityView";
import { RiddleActivityView } from "./RiddleActivityView";
import { runMultiProjectDiagnostic, getFirebaseProjectsStatus, DiagnosticResult } from "../../lib/firebaseProjects";

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
  const [toastMsg, setToastMsg] = useState<string>("");
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [activeBroadcast, setActiveBroadcast] = useState<ActiveBroadcastData | null>(null);
  const [showDiagModal, setShowDiagModal] = useState<boolean>(false);
  const [diagLoading, setDiagLoading] = useState<boolean>(false);
  const [diagResults, setDiagResults] = useState<DiagnosticResult[] | null>(null);

  const handleRunDiagnosticTest = async () => {
    setDiagLoading(true);
    try {
      const res = await runMultiProjectDiagnostic(eventId);
      setDiagResults(res);
    } catch (err: any) {
      console.error("Diagnostic execution error:", err);
    } finally {
      setDiagLoading(false);
    }
  };

  const processedTimerZeroRef = useRef<boolean>(false);
  const answerRevealTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Listen to Active Broadcast for entire room
  useEffect(() => {
    if (!eventId) return;
    const unsubBroadcast = BroadcastService.subscribe(eventId, (data) => {
      setActiveBroadcast(data);
    });
    return () => unsubBroadcast();
  }, [eventId]);

  const setLiveBroadcast = async (activity: "quiz" | "crossword" | "riddles" | "none") => {
    try {
      if (activity === "none") {
        await BroadcastService.clearBroadcast(eventId);
        setToastMsg("Participants Stage broadcast cleared");
      } else if (activity === "crossword") {
        await handleDisplayCrossword(0);
      } else if (activity === "riddles") {
        await handleStartRiddles(0);
      } else {
        const broadcastRef = doc(db, "events", eventId, "activities", "activeBroadcast");
        await setDoc(broadcastRef, {
          activeActivity: activity,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        setToastMsg(`Participants Stage set to: ${activity.toUpperCase()}`);
      }
      setTimeout(() => setToastMsg(""), 3000);
    } catch (err: any) {
      console.error("Error setting broadcast:", err);
    }
  };

  // Crossword Admin Action Controls
  const handleDisplayCrossword = async (puzzleIdx: number) => {
    try {
      const puzzle = CROSSWORD_ACTIVITIES[puzzleIdx] || CROSSWORD_ACTIVITIES[0];
      await BroadcastService.broadcastCrossword(eventId, puzzleIdx, puzzle.id, "active", false, false);
      await CrosswordService.startSession(eventId, puzzleIdx);
      setToastMsg(`Displaying Crossword #${puzzleIdx + 1} on participant screens & Live Wall!`);
      setTimeout(() => setToastMsg(""), 3500);
    } catch (err: any) {
      console.error("Error displaying crossword:", err);
    }
  };

  const handleToggleCrosswordFreeze = async () => {
    const isCurrentlyFrozen = activeBroadcast?.crossword?.isFrozen || activeBroadcast?.crossword?.stage === "frozen";
    const newFrozen = !isCurrentlyFrozen;
    await BroadcastService.updateCrosswordState(eventId, {
      isFrozen: newFrozen,
      stage: newFrozen ? "frozen" : "active",
    });
    setToastMsg(newFrozen ? "Crossword answers frozen for all participants" : "Crossword inputs unlocked");
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleRevealCrosswordAnswer = async () => {
    const isRevealed = activeBroadcast?.crossword?.isRevealed || activeBroadcast?.crossword?.stage === "reveal";
    if (isRevealed) {
      await BroadcastService.updateCrosswordState(eventId, {
        isRevealed: false,
        stage: "active",
      });
      setToastMsg("Crossword solutions hidden");
    } else {
      await BroadcastService.updateCrosswordState(eventId, {
        isRevealed: true,
        stage: "reveal",
      });
      setToastMsg("Crossword solutions revealed on Stage & Live Wall!");
    }
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleShowCrosswordLeaderboard = async () => {
    const isLeaderboard = activeBroadcast?.crossword?.stage === "leaderboard";
    if (isLeaderboard) {
      await BroadcastService.updateCrosswordState(eventId, {
        stage: "active",
      });
      setToastMsg("Resumed crossword puzzle view");
    } else {
      await BroadcastService.updateCrosswordState(eventId, {
        stage: "leaderboard",
      });
      setToastMsg("Crossword Leaderboard displayed on Stage & Live Wall!");
    }
    setTimeout(() => setToastMsg(""), 3000);
  };

  // Riddle Admin Action Controls
  const handleStartRiddles = async (riddleIdx: number = 0) => {
    try {
      const riddle = RIDDLE_ACTIVITIES[riddleIdx] || RIDDLE_ACTIVITIES[0];
      await BroadcastService.broadcastRiddle(eventId, riddleIdx, riddle.id, "active", false, false);
      await RiddleService.startSession(eventId, riddleIdx);
      setToastMsg(`Broadcasting Riddle Question ${riddleIdx + 1} of ${RIDDLE_ACTIVITIES.length} live!`);
      setTimeout(() => setToastMsg(""), 3500);
    } catch (err: any) {
      console.error("Error starting riddles:", err);
    }
  };

  const handleToggleRiddleFreeze = async () => {
    const isCurrentlyFrozen = activeBroadcast?.riddles?.isFrozen || activeBroadcast?.riddles?.stage === "frozen";
    const newFrozen = !isCurrentlyFrozen;
    await BroadcastService.updateRiddleState(eventId, {
      isFrozen: newFrozen,
      stage: newFrozen ? "frozen" : "active",
    });
    setToastMsg(newFrozen ? "Riddle answers frozen for all participants" : "Riddle inputs unlocked");
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleRevealRiddleAnswer = async () => {
    const isRevealed = activeBroadcast?.riddles?.isRevealed || activeBroadcast?.riddles?.stage === "reveal";
    if (isRevealed) {
      await BroadcastService.updateRiddleState(eventId, {
        isRevealed: false,
        stage: "active",
      });
      setToastMsg("Riddle answer hidden");
    } else {
      await BroadcastService.updateRiddleState(eventId, {
        isRevealed: true,
        stage: "reveal",
      });
      setToastMsg("Riddle answer & explanation revealed on Stage & Live Wall!");
    }
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleShowRiddleLeaderboard = async () => {
    const isLeaderboard = activeBroadcast?.riddles?.stage === "leaderboard";
    if (isLeaderboard) {
      await BroadcastService.updateRiddleState(eventId, {
        stage: "active",
      });
      setToastMsg("Resumed riddle question view");
    } else {
      await BroadcastService.updateRiddleState(eventId, {
        stage: "leaderboard",
      });
      setToastMsg("Riddle Leaderboard displayed on Stage & Live Wall!");
    }
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleNextRiddleQuestion = async () => {
    const currentIdx = activeBroadcast?.riddles?.riddleIndex ?? 0;
    if (currentIdx < RIDDLE_ACTIVITIES.length - 1) {
      const nextIdx = currentIdx + 1;
      const nextRiddle = RIDDLE_ACTIVITIES[nextIdx];
      await BroadcastService.broadcastRiddle(eventId, nextIdx, nextRiddle.id, "active", false, false);
      setToastMsg(`Moved to Riddle Question ${nextIdx + 1} of ${RIDDLE_ACTIVITIES.length}`);
      setTimeout(() => setToastMsg(""), 3000);
    }
  };

  const handlePrevRiddleQuestion = async () => {
    const currentIdx = activeBroadcast?.riddles?.riddleIndex ?? 0;
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      const prevRiddle = RIDDLE_ACTIVITIES[prevIdx];
      await BroadcastService.broadcastRiddle(eventId, prevIdx, prevRiddle.id, "active", false, false);
      setToastMsg(`Moved back to Riddle Question ${prevIdx + 1} of ${RIDDLE_ACTIVITIES.length}`);
      setTimeout(() => setToastMsg(""), 3000);
    }
  };

  // 1. Listen to Quiz Session
  useEffect(() => {
    if (!eventId) return;

    setLoading(true);
    const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");

    const unsub = onSnapshot(
      sessionRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setSession(docSnap.data() as QuizSessionData);
        } else {
          setSession(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to quiz session:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [eventId]);

  // 2. Listen to Quiz Leaderboard
  useEffect(() => {
    if (!eventId) return;

    const lbRef = collection(db, "events", eventId, "activities", "quiz", "leaderboard");
    const q = query(lbRef, orderBy("currentScore", "desc"), limit(20));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: QuizLeaderboardEntry[] = [];
        snap.forEach((d) => list.push(d.data() as QuizLeaderboardEntry));
        setLeaderboard(list);
      },
      (err) => console.error("Error listening to leaderboard:", err)
    );

    return () => unsub();
  }, [eventId]);

  // 3. Quiz 30-Second Question Timer Clock
  useEffect(() => {
    if (!session || session.status !== "running" || session.stage !== "question") {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const expiresAt = session.expiresAt || (session.questionStartedAt ? session.questionStartedAt + 30000 : now + 30000);
      const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0 && !processedTimerZeroRef.current) {
        processedTimerZeroRef.current = true;
        handleQuestionTimeExpired();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [session]);

  const handleQuestionTimeExpired = async () => {
    if (!session || !eventId) return;
    try {
      const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");
      await updateDoc(sessionRef, {
        stage: "answer_reveal",
        updatedAt: serverTimestamp(),
      });
      setToastMsg("Time expired! Answer revealed.");
      setTimeout(() => setToastMsg(""), 3000);
    } catch (err: any) {
      console.error("Error updating quiz stage to reveal:", err);
    }
  };

  const handleStartQuiz = async () => {
    if (!eventId) return;
    try {
      processedTimerZeroRef.current = false;
      const initialQ = DEMO_QUIZ_QUESTIONS[0];
      const now = Date.now();

      const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");
      await setDoc(sessionRef, {
        eventId,
        status: "running",
        stage: "question",
        currentQuestionIndex: 0,
        currentQuestion: initialQ,
        questionStartedAt: now,
        expiresAt: now + 30000,
        totalQuestions: DEMO_QUIZ_QUESTIONS.length,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      const broadcastRef = doc(db, "events", eventId, "activities", "activeBroadcast");
      await setDoc(broadcastRef, {
        activeActivity: "quiz",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setToastMsg("Quiz started! Question 1 is live on stage.");
      setTimeout(() => setToastMsg(""), 3000);
    } catch (err: any) {
      console.error("Error starting quiz:", err);
    }
  };

  const transitionToLeaderboard = async () => {
    if (!eventId) return;
    try {
      const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");
      await updateDoc(sessionRef, {
        stage: "leaderboard",
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      console.error("Error transitioning to leaderboard:", err);
    }
  };

  const handleNextQuestion = async () => {
    if (!session || !eventId) return;
    try {
      processedTimerZeroRef.current = false;
      const nextIdx = session.currentQuestionIndex + 1;

      if (nextIdx >= DEMO_QUIZ_QUESTIONS.length) {
        const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");
        await updateDoc(sessionRef, {
          status: "ended",
          stage: "completed",
          updatedAt: serverTimestamp(),
        });
        setToastMsg("Quiz completed! Showing final standings.");
        setTimeout(() => setToastMsg(""), 3000);
      } else {
        const nextQ = DEMO_QUIZ_QUESTIONS[nextIdx];
        const now = Date.now();
        const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");
        await updateDoc(sessionRef, {
          stage: "question",
          currentQuestionIndex: nextIdx,
          currentQuestion: nextQ,
          questionStartedAt: now,
          expiresAt: now + 30000,
          fastestResponse: null,
          updatedAt: serverTimestamp(),
        });
        setToastMsg(`Question ${nextIdx + 1} is now live!`);
        setTimeout(() => setToastMsg(""), 3000);
      }
    } catch (err: any) {
      console.error("Error advancing question:", err);
    }
  };

  const handleEndQuiz = async () => {
    if (!eventId) return;
    try {
      const sessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");
      await updateDoc(sessionRef, {
        status: "ended",
        stage: "completed",
        updatedAt: serverTimestamp(),
      });
      setToastMsg("Quiz session ended.");
      setTimeout(() => setToastMsg(""), 3000);
    } catch (err: any) {
      console.error("Error ending quiz:", err);
    }
  };

  const currentQ = session?.currentQuestion || DEMO_QUIZ_QUESTIONS[session?.currentQuestionIndex || 0];

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl text-left font-sans">
      {/* Header Bar */}
      <div className="p-4 border-b border-neutral-800 bg-neutral-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">🎛️</span>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <span>Admin Activity & Stage Orchestrator</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                PROD
              </span>
            </h2>
            <span className="text-[11px] text-neutral-400 font-medium block">
              Host controls for Quiz, Crossword, and Riddles
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onBackToControls && (
            <button
              type="button"
              onClick={onBackToControls}
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-all cursor-pointer border border-neutral-700"
            >
              ← Back to Stage
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setShowDiagModal(true);
              handleRunDiagnosticTest();
            }}
            className="px-3 py-1.5 rounded-xl bg-neutral-800/90 hover:bg-neutral-700 text-orange-400 hover:text-orange-300 text-xs font-mono font-bold transition-all cursor-pointer border border-neutral-700 flex items-center gap-1.5"
            title="Run 3-Project Firebase Verification Diagnostic"
          >
            <ShieldCheck size={14} className="text-orange-400" />
            <span className="hidden sm:inline">Verify 3 Projects</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-4 mt-3 p-2.5 rounded-xl bg-orange-500/15 border border-orange-500/40 text-orange-300 text-xs font-bold flex items-center gap-2 shadow-lg"
          >
            <Sparkles size={14} className="text-orange-400" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="flex-1 p-4 sm:p-5 flex flex-col space-y-4 overflow-y-auto">
        {/* Activity Selection Tabs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
              Select Stage Activity
            </h3>
            {activeBroadcast?.activeActivity && activeBroadcast.activeActivity !== "none" && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                  <Radio size={11} className="text-emerald-400 animate-pulse" />
                  Live Broadcast: {activeBroadcast.activeActivity.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => setLiveBroadcast("none")}
                  className="text-[10px] font-mono text-neutral-400 hover:text-red-400 underline cursor-pointer"
                >
                  Clear Broadcast
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Quiz Tab */}
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
                <span>1. Engineering Quiz</span>
              </div>
              {session?.status === "running" && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>

            {/* Crossword Tab */}
            <button
              type="button"
              onClick={() => setSelectedActivity("crossword")}
              className={`p-3 rounded-xl font-bold text-xs transition-all flex items-center justify-between cursor-pointer border ${
                selectedActivity === "crossword"
                  ? "bg-orange-500/15 border-orange-500 text-orange-400 shadow-lg shadow-orange-500/10"
                  : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-850"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🧩</span>
                <span>2. Crossword Puzzles</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-orange-400 font-bold">
                2 Puzzles
              </span>
            </button>

            {/* Riddles Tab */}
            <button
              type="button"
              onClick={() => setSelectedActivity("riddles")}
              className={`p-3 rounded-xl font-bold text-xs transition-all flex items-center justify-between cursor-pointer border ${
                selectedActivity === "riddles"
                  ? "bg-orange-500/15 border-orange-500 text-orange-400 shadow-lg shadow-orange-500/10"
                  : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-850"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">❓</span>
                <span>3. Mystery Riddles</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-orange-400 font-bold">
                5 Riddles
              </span>
            </button>
          </div>
        </div>

        {/* Dynamic Activity Area */}
        <AnimatePresence mode="wait">
          {selectedActivity === "crossword" ? (
            /* CROSSWORD DEDICATED ADMIN CONTROL PANEL */
            <motion.div
              key="crossword-admin-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col space-y-4"
            >
              {/* PRIMARY ADMIN DISPLAY BUTTONS AS REQUESTED */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                    Stage Broadcast Selection
                  </span>
                  {activeBroadcast?.activeActivity === "crossword" && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      <span>CROSSWORD #{(activeBroadcast.crossword?.puzzleIndex ?? 0) + 1} LIVE ON STAGE</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleDisplayCrossword(0)}
                    className={`p-3.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between cursor-pointer border shadow-lg ${
                      activeBroadcast?.activeActivity === "crossword" && activeBroadcast.crossword?.puzzleIndex === 0
                        ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white border-orange-400 ring-2 ring-orange-500/30"
                        : "bg-neutral-900 hover:bg-neutral-850 text-neutral-200 border-neutral-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🧩</span>
                      <span>Display 1st Crossword Puzzle</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-80 uppercase">
                      {CROSSWORD_ACTIVITIES[0].title}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDisplayCrossword(1)}
                    className={`p-3.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between cursor-pointer border shadow-lg ${
                      activeBroadcast?.activeActivity === "crossword" && activeBroadcast.crossword?.puzzleIndex === 1
                        ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white border-orange-400 ring-2 ring-orange-500/30"
                        : "bg-neutral-900 hover:bg-neutral-850 text-neutral-200 border-neutral-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🧩</span>
                      <span>Display 2nd Crossword Puzzle</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-80 uppercase">
                      {CROSSWORD_ACTIVITIES[1].title}
                    </span>
                  </button>
                </div>

                {/* Crossword Live Controls Strip */}
                {activeBroadcast?.activeActivity === "crossword" && (
                  <div className="pt-3 border-t border-neutral-850 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleToggleCrosswordFreeze}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                          activeBroadcast.crossword?.isFrozen || activeBroadcast.crossword?.stage === "frozen"
                            ? "bg-amber-500 text-slate-950 border-amber-400"
                            : "bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800"
                        }`}
                      >
                        <Lock size={13} />
                        <span>
                          {activeBroadcast.crossword?.isFrozen || activeBroadcast.crossword?.stage === "frozen"
                            ? "Unfreeze Answers"
                            : "Freeze Answers"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRevealCrosswordAnswer}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                          activeBroadcast.crossword?.isRevealed || activeBroadcast.crossword?.stage === "reveal"
                            ? "bg-emerald-500 text-slate-950 border-emerald-400"
                            : "bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800"
                        }`}
                      >
                        <Eye size={13} />
                        <span>
                          {activeBroadcast.crossword?.isRevealed || activeBroadcast.crossword?.stage === "reveal"
                            ? "Hide Answers"
                            : "Reveal Answers"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleShowCrosswordLeaderboard}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                          activeBroadcast.crossword?.stage === "leaderboard"
                            ? "bg-amber-500 text-slate-950 border-amber-400"
                            : "bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800"
                        }`}
                      >
                        <Trophy size={13} />
                        <span>
                          {activeBroadcast.crossword?.stage === "leaderboard"
                            ? "Resume Puzzle"
                            : "Show Leaderboard"}
                        </span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setLiveBroadcast("none")}
                      className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-mono font-bold transition-all cursor-pointer"
                    >
                      Stop Broadcast
                    </button>
                  </div>
                )}
              </div>

              {/* Host Interactive Crossword Workspace */}
              <div className="flex-1 min-h-[500px]">
                <CrosswordActivityView eventId={eventId} isAdmin={true} />
              </div>
            </motion.div>
          ) : selectedActivity === "riddles" ? (
            /* RIDDLES DEDICATED ADMIN CONTROL PANEL */
            <motion.div
              key="riddles-admin-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col space-y-4"
            >
              {/* PRIMARY ADMIN RIDDLES CONTROLS AS REQUESTED */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                    Riddle Question Stage Controls
                  </span>
                  {activeBroadcast?.activeActivity === "riddles" && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      <span>QUESTION {(activeBroadcast.riddles?.riddleIndex ?? 0) + 1} OF 5 LIVE</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartRiddles(0)}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-black text-xs transition-all shadow-lg flex items-center gap-1.5 cursor-pointer border border-orange-400/40"
                  >
                    <Play size={14} className="fill-white" />
                    <span>Start Riddle Questions</span>
                  </button>

                  <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
                    {RIDDLE_ACTIVITIES.map((r, idx) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleStartRiddles(idx)}
                        className={`w-7 h-7 rounded-lg text-xs font-mono font-black transition-all cursor-pointer flex items-center justify-center ${
                          activeBroadcast?.activeActivity === "riddles" && activeBroadcast.riddles?.riddleIndex === idx
                            ? "bg-orange-500 text-white shadow-md"
                            : "text-neutral-400 hover:text-white"
                        }`}
                        title={`Broadcast Riddle ${idx + 1}`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Riddle Live Controls Strip */}
                {activeBroadcast?.activeActivity === "riddles" && (
                  <div className="pt-3 border-t border-neutral-850 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleToggleRiddleFreeze}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                          activeBroadcast.riddles?.isFrozen || activeBroadcast.riddles?.stage === "frozen"
                            ? "bg-amber-500 text-slate-950 border-amber-400"
                            : "bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800"
                        }`}
                      >
                        <Lock size={13} />
                        <span>
                          {activeBroadcast.riddles?.isFrozen || activeBroadcast.riddles?.stage === "frozen"
                            ? "Unfreeze Answers"
                            : "Freeze Answers"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRevealRiddleAnswer}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                          activeBroadcast.riddles?.isRevealed || activeBroadcast.riddles?.stage === "reveal"
                            ? "bg-emerald-500 text-slate-950 border-emerald-400"
                            : "bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800"
                        }`}
                      >
                        <Eye size={13} />
                        <span>
                          {activeBroadcast.riddles?.isRevealed || activeBroadcast.riddles?.stage === "reveal"
                            ? "Hide Answer"
                            : "Reveal Answer"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleShowRiddleLeaderboard}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                          activeBroadcast.riddles?.stage === "leaderboard"
                            ? "bg-amber-500 text-slate-950 border-amber-400"
                            : "bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800"
                        }`}
                      >
                        <Trophy size={13} />
                        <span>
                          {activeBroadcast.riddles?.stage === "leaderboard"
                            ? "Resume Riddle"
                            : "Show Leaderboard"}
                        </span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={(activeBroadcast.riddles?.riddleIndex ?? 0) <= 0}
                          onClick={handlePrevRiddleQuestion}
                          className="px-2.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 disabled:opacity-30 border border-neutral-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <ChevronLeft size={13} />
                          <span>Prev</span>
                        </button>

                        <button
                          type="button"
                          disabled={(activeBroadcast.riddles?.riddleIndex ?? 0) >= RIDDLE_ACTIVITIES.length - 1}
                          onClick={handleNextRiddleQuestion}
                          className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white disabled:opacity-30 border border-neutral-700 text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                        >
                          <span>Move to Next Question</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setLiveBroadcast("none")}
                      className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-mono font-bold transition-all cursor-pointer"
                    >
                      Stop Broadcast
                    </button>
                  </div>
                )}
              </div>

              {/* Host Interactive Riddle Workspace */}
              <div className="flex-1 min-h-[500px]">
                <RiddleActivityView eventId={eventId} isAdmin={true} />
              </div>
            </motion.div>
          ) : session?.status === "running" ? (
            session.stage === "question" ? (
              /* ACTIVE QUIZ QUESTION MONITOR */
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
                    <span>Question {session.currentQuestionIndex + 1} of {DEMO_QUIZ_QUESTIONS.length}</span>
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
                      Participants: {participantCount || "?"}
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
                    title={`🏆 Standings (Q${session.currentQuestionIndex + 1}/${DEMO_QUIZ_QUESTIONS.length})`}
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
                  Engineering Failure Analysis Quiz
                </h3>

                <div className="grid grid-cols-2 gap-3 py-1">
                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-left">
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
                      Questions
                    </span>
                    <span className="text-sm font-black text-white font-mono block mt-0.5">
                      {DEMO_QUIZ_QUESTIONS.length} Questions
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

      {/* Multi-Project Diagnostics Modal */}
      <AnimatePresence>
        {showDiagModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-orange-400" size={20} />
                  <h3 className="text-base font-bold text-white font-mono">
                    3-Project Firebase Verification
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDiagModal(false)}
                  className="text-neutral-400 hover:text-white text-xs font-mono px-2 py-1 rounded-lg bg-neutral-800"
                >
                  ✕ Close
                </button>
              </div>

              <p className="text-xs text-neutral-400">
                Verifies that Project 1, Project 2, and Project 3 resolve to independent Firebase projects with no silent fallbacks.
              </p>

              <div className="space-y-2.5">
                {diagLoading ? (
                  <div className="p-6 text-center text-xs font-mono text-neutral-400 space-y-2">
                    <div className="animate-spin w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full mx-auto" />
                    <span>Running lightweight 1-probe read/write verification across all 3 databases...</span>
                  </div>
                ) : diagResults ? (
                  diagResults.map((r, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border text-xs font-mono flex flex-col gap-1.5 ${
                        r.status === "success"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                          : r.status === "missing_config"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                          : "bg-red-500/10 border-red-500/30 text-red-300"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>{r.project}</span>
                        <span>
                          {r.status === "success" && "✅ CONNECTED & ISOLATED"}
                          {r.status === "missing_config" && "⚠️ CONFIG MISSING"}
                          {r.status === "error" && "❌ ERROR"}
                        </span>
                      </div>
                      <div className="text-[11px] opacity-80 flex flex-wrap gap-x-4">
                        <span>Expected: <b className="text-white">{r.expectedProjectId}</b></span>
                        {r.actualProjectId && (
                          <span>Configured: <b className="text-white">{r.actualProjectId}</b></span>
                        )}
                        {r.latencyMs !== undefined && (
                          <span>Probe Latency: <b className="text-white">{r.latencyMs}ms</b></span>
                        )}
                      </div>
                      <div className="text-[11px] mt-0.5 opacity-90">
                        {r.message}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs font-mono text-neutral-500">
                    No diagnostic run yet.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  disabled={diagLoading}
                  onClick={handleRunDiagnosticTest}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-mono text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Activity size={14} />
                  <span>Re-test Connections</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
