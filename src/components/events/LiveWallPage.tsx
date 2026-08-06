import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react";
import { motion } from "motion/react";
import { Tv, ArrowLeft, Radio, Sparkles, MessageSquare, Clock } from "lucide-react";
import { doc, collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { EventItem } from "../PublicEventPage";
import { ActiveQuestionData, LiveAnswerData } from "../EventRoom/LiveRoomPanel";

export function LiveWallPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestionData | null>(null);
  const [answers, setAnswers] = useState<LiveAnswerData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch Event details
  useEffect(() => {
    if (!eventId) return;

    const eventRef = doc(db, "events", eventId);
    const unsubEvent = onSnapshot(
      eventRef,
      (snap) => {
        if (snap.exists()) {
          setEvent({ id: snap.id, ...snap.data() } as EventItem);
        } else {
          setEvent(null);
        }
      },
      (err) => console.warn("Live wall event listener error:", err)
    );

    return () => unsubEvent();
  }, [eventId]);

  // Fetch Active Question
  useEffect(() => {
    if (!eventId) return;

    setLoading(true);
    const activeQRef = doc(db, "events", eventId, "liveRoom", "activeQuestion");

    const unsubQuestion = onSnapshot(
      activeQRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as ActiveQuestionData;
          if (data && data.isActive && data.question) {
            setActiveQuestion(data);
          } else {
            setActiveQuestion(null);
          }
        } else {
          setActiveQuestion(null);
        }
        setLoading(false);
      },
      (err) => {
        console.warn("Live wall question listener error:", err);
        setLoading(false);
      }
    );

    return () => unsubQuestion();
  }, [eventId]);

  // Fetch Live Answers
  useEffect(() => {
    if (!eventId) return;

    const answersRef = collection(db, "events", eventId, "liveAnswers");
    const unsubAnswers = onSnapshot(
      answersRef,
      (snap) => {
        const list: LiveAnswerData[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as LiveAnswerData));
        setAnswers(list);
      },
      (err) => console.warn("Live wall answers listener error:", err)
    );

    return () => unsubAnswers();
  }, [eventId]);

  const currentQuestionId = activeQuestion?.questionId || "";
  const matchingAnswers = currentQuestionId
    ? answers.filter((a) => a.questionId === currentQuestionId)
    : [];

  return (
    <div className="min-h-screen bg-[#070707] text-white flex flex-col font-sans select-none overflow-x-hidden">
      {/* Top Presentation Bar */}
      <div className="p-4 sm:p-6 border-b border-neutral-800 bg-[#0c0c0c] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/events/${eventId}/admin`)}
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all cursor-pointer border border-neutral-800 flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Admin Dashboard</span>
          </button>

          <div className="h-5 w-px bg-neutral-800" />

          <div>
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight leading-none">
              {event?.title || "ZERO2ONE Live Event Stage"}
            </h1>
            <p className="text-[11px] font-mono text-neutral-400 mt-1">
              Projector Display View • {event?.roomType === "normal" ? "Standard Room" : "LinkedIn Sync"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-black uppercase tracking-wider bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center gap-1.5">
            <Tv size={14} className="text-purple-400" />
            <span>LIVE WALL</span>
          </span>
        </div>
      </div>

      {/* Main Screen Body */}
      <div className="flex-1 p-6 sm:p-10 max-w-6xl mx-auto w-full flex flex-col justify-center space-y-8">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-mono text-neutral-400">Loading Stage Display...</p>
          </div>
        ) : activeQuestion && activeQuestion.question ? (
          <div className="space-y-8">
            {/* Display Active Question */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-neutral-900 via-[#111111] to-neutral-950 border-2 border-orange-500/50 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-3xl rounded-full pointer-events-none" />

              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/40">
                  <Sparkles size={14} />
                  STAGE QUESTION
                </span>

                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                  <Radio size={14} className="animate-pulse" />
                  REAL-TIME SYNC
                </span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                {activeQuestion.question}
              </h2>

              <div className="mt-6 pt-4 border-t border-neutral-800/80 flex items-center justify-between">
                <span className="text-sm font-mono font-bold text-orange-400 flex items-center gap-2">
                  <MessageSquare size={16} />
                  {matchingAnswers.length} Responses Submitted
                </span>
              </div>
            </motion.div>

            {/* Live Responses Stream Grid */}
            <div className="space-y-4">
              <h3 className="text-xs font-mono font-black uppercase tracking-widest text-neutral-400">
                Live Responses Stream
              </h3>

              {matchingAnswers.length === 0 ? (
                <div className="p-8 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-center text-neutral-500 text-xs font-mono">
                  Waiting for participant submissions...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {matchingAnswers.map((ans, idx) => (
                    <motion.div
                      key={ans.id || idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-orange-400 truncate">
                          {ans.participantName}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-500">
                          #{idx + 1}
                        </span>
                      </div>
                      <p className="text-sm text-white font-medium leading-relaxed">
                        "{ans.answer}"
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-16 p-8 rounded-3xl bg-neutral-900/60 border border-neutral-800 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto">
              <Tv size={32} />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h2 className="text-xl font-black text-white">Projector Display Ready</h2>
              <p className="text-xs text-neutral-400 font-medium">
                No active question currently broadcasted. Questions published from the Admin Dashboard will appear here live.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
