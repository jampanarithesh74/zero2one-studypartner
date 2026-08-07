import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Radio, 
  HelpCircle, 
  PlusCircle, 
  Tv, 
  Sparkles, 
  MessageSquare, 
  RefreshCw,
  CheckCircle2,
  Users,
  Gamepad2
} from "lucide-react";
import { doc, collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { EventItem } from "../PublicEventPage";
import { ActiveQuestionData, LiveAnswerData } from "./LiveRoomPanel";
import { AdminQuizController } from "../events/AdminQuizController";

interface AdminLiveControlsPanelProps {
  event: EventItem;
  onOpenAskModal: () => void;
  onNavigateLiveWall: () => void;
  participantCount?: number;
}

export function AdminLiveControlsPanel({
  event,
  onOpenAskModal,
  onNavigateLiveWall,
  participantCount = 0,
}: AdminLiveControlsPanelProps) {
  const [controlMode, setControlMode] = useState<"qna" | "activities">("qna");
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestionData | null>(null);
  const [answers, setAnswers] = useState<LiveAnswerData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Listen to active question in Firestore
  useEffect(() => {
    if (!event.id) return;

    setLoading(true);
    const activeQRef = doc(db, "events", event.id, "liveRoom", "activeQuestion");

    const unsubQuestion = onSnapshot(
      activeQRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as ActiveQuestionData;
          if (data && data.isActive && data.question && data.question.trim().length > 0) {
            setActiveQuestion(data);
          } else {
            setActiveQuestion(null);
          }
        } else {
          setActiveQuestion(null);
        }
        setLoading(false);
      },
      (error) => {
        console.warn("Active question listener warning:", error);
        setLoading(false);
      }
    );

    return () => unsubQuestion();
  }, [event.id]);

  // Listen to answers collection in Firestore for response counting
  useEffect(() => {
    if (!event.id) return;

    const answersRef = collection(db, "events", event.id, "liveAnswers");

    const unsubAnswers = onSnapshot(
      answersRef,
      (snapshot) => {
        const list: LiveAnswerData[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as LiveAnswerData);
        });
        setAnswers(list);
      },
      (error) => {
        console.warn("Answers collection listener warning:", error);
      }
    );

    return () => unsubAnswers();
  }, [event.id]);

  const currentQuestionId = activeQuestion?.questionId || "";
  const matchingAnswers = currentQuestionId
    ? answers.filter((a) => a.questionId === currentQuestionId)
    : [];
  const responseCount = matchingAnswers.length;

  if (controlMode === "activities") {
    return (
      <AdminQuizController
        eventId={event.id}
        participantCount={participantCount}
        onBackToControls={() => setControlMode("qna")}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-neutral-800/90 rounded-2xl overflow-hidden shadow-xl text-left font-sans">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-neutral-800 bg-neutral-900/90 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-orange-500 animate-pulse shrink-0" />
          <h2 className="text-xs font-black uppercase tracking-wider text-white">
            Live Room Controls
          </h2>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
          <button
            type="button"
            onClick={() => setControlMode("qna")}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
              controlMode === "qna"
                ? "bg-orange-500 text-white shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Radio size={12} />
            <span>Q&A</span>
          </button>

          <button
            type="button"
            onClick={() => setControlMode("activities")}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
              controlMode === "activities"
                ? "bg-orange-500 text-white shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Gamepad2 size={12} />
            <span>Activities</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between space-y-6 overflow-y-auto">
        {/* Stage Active Question Monitor or Idle Stage Status */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 min-h-[180px] rounded-2xl bg-neutral-950 border border-neutral-800/80 p-6 flex flex-col items-center justify-center text-center space-y-3"
            >
              <RefreshCw size={24} className="text-orange-500 animate-spin" />
              <p className="text-xs text-neutral-400 font-mono">Syncing room state...</p>
            </motion.div>
          ) : activeQuestion && activeQuestion.question ? (
            <motion.div
              key={currentQuestionId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 min-h-[180px] rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-orange-500/40 p-5 sm:p-6 flex flex-col justify-between space-y-4 relative overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 right-0 w-36 h-36 bg-orange-500/10 blur-3xl rounded-full pointer-events-none" />

              <div className="flex items-center justify-between gap-2 relative z-10">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider text-orange-400 bg-orange-500/15 border border-orange-500/30">
                  <Sparkles size={11} className="text-orange-400" />
                  <span>CURRENTLY PUBLISHED QUESTION</span>
                </div>

                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Broadcast
                </span>
              </div>

              <div className="space-y-2 relative z-10 my-auto">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug whitespace-pre-line">
                  {activeQuestion.question}
                </h3>
              </div>

              <div className="pt-3 border-t border-neutral-800/90 flex items-center justify-between relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono font-extrabold text-orange-400 shadow-inner">
                  <MessageSquare size={14} className="text-orange-400" />
                  <span>
                    {responseCount} {responseCount === 1 ? "response" : "responses"} received
                  </span>
                </div>

                <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-1">
                  <Users size={12} className="text-neutral-500" />
                  <span>{participantCount} connected</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 min-h-[180px] rounded-2xl bg-neutral-950 border border-neutral-800/80 p-6 flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden"
            >
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shadow-lg">
                <HelpCircle size={22} />
              </div>

              <div className="space-y-1 max-w-sm">
                <h3 className="text-base font-black text-white tracking-tight">
                  No Active Question
                </h3>
                <p className="text-xs text-neutral-400 font-medium">
                  Use the controls below to publish a question, switch to Activities, or open the Projector Live Wall.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* THREE LARGE ACTION BUTTONS (Admin Control Center) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0 pt-2">
          {/* Action Button 1: + Ask Question */}
          <button
            type="button"
            onClick={onOpenAskModal}
            className="group relative p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-black transition-all cursor-pointer shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] border border-orange-400/40 flex flex-col items-center justify-center text-center space-y-1.5 overflow-hidden"
          >
            <div className="p-2.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm group-hover:scale-110 transition-transform">
              <PlusCircle size={22} className="text-white" />
            </div>
            <div>
              <span className="text-xs font-black tracking-tight block">
                + Ask Question
              </span>
              <span className="text-[9px] font-mono text-orange-100/80 uppercase tracking-wider block mt-0.5">
                Q&A Broadcast
              </span>
            </div>
          </button>

          {/* Action Button 2: 🧠 Activities */}
          <button
            type="button"
            onClick={() => setControlMode("activities")}
            className="group relative p-4 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-950 hover:from-neutral-850 hover:to-neutral-900 text-white font-black transition-all cursor-pointer shadow-xl shadow-black/40 hover:scale-[1.02] active:scale-[0.98] border border-orange-500/40 hover:border-orange-500/70 flex flex-col items-center justify-center text-center space-y-1.5 overflow-hidden"
          >
            <div className="p-2.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 group-hover:scale-110 transition-transform text-lg">
              🧠
            </div>
            <div>
              <span className="text-xs font-black tracking-tight block">
                Activities
              </span>
              <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider block mt-0.5">
                Quiz & Challenges
              </span>
            </div>
          </button>

          {/* Action Button 3: 🖥 Live Wall */}
          <button
            type="button"
            onClick={onNavigateLiveWall}
            className="group relative p-4 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-950 hover:from-neutral-850 hover:to-neutral-900 text-white font-black transition-all cursor-pointer shadow-xl shadow-black/40 hover:scale-[1.02] active:scale-[0.98] border border-purple-500/40 hover:border-purple-500/70 flex flex-col items-center justify-center text-center space-y-1.5 overflow-hidden"
          >
            <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 group-hover:scale-110 transition-transform">
              <Tv size={22} />
            </div>
            <div>
              <span className="text-xs font-black tracking-tight block">
                Live Wall
              </span>
              <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider block mt-0.5">
                Projector Mode
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
