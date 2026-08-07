import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  HelpCircle, 
  Send, 
  Radio, 
  Sparkles, 
  Clock, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle,
  PlusCircle,
  RefreshCw
} from "lucide-react";
import { 
  doc, 
  collection, 
  onSnapshot, 
  addDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { EventItem } from "../PublicEventPage";
import { Participant } from "../ParticipantOnboarding";
import { QuizModeCard } from "../events/QuizModeCard";
import { QuizSessionData } from "../../data/quizQuestions";

export interface ActiveQuestionData {
  question: string;
  createdAt?: any;
  createdBy?: string;
  isActive: boolean;
  questionId: string;
}

export interface LiveAnswerData {
  id?: string;
  participantId: string;
  participantName: string;
  answer: string;
  submittedAt?: any;
  questionId: string;
}

interface LiveRoomPanelProps {
  event: EventItem;
  currentParticipant?: Participant | null;
  isAdmin?: boolean;
  onOpenAskModal?: () => void;
}

export function LiveRoomPanel({
  event,
  currentParticipant,
  isAdmin = false,
  onOpenAskModal,
}: LiveRoomPanelProps) {
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestionData | null>(null);
  const [quizSession, setQuizSession] = useState<QuizSessionData | null>(null);
  const [answers, setAnswers] = useState<LiveAnswerData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Listen to Quiz Session in Firestore
  useEffect(() => {
    if (!event.id) return;

    const quizSessionRef = doc(db, "events", event.id, "activities", "quiz", "session", "current");

    const unsubQuizSession = onSnapshot(
      quizSessionRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setQuizSession(docSnap.data() as QuizSessionData);
        } else {
          setQuizSession(null);
        }
      },
      (err) => {
        console.warn("Quiz session listener warning:", err);
      }
    );

    return () => unsubQuizSession();
  }, [event.id]);
  
  // User answer input state
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>("");

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

  // Listen to answers collection in Firestore
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

  // Derived calculations
  const currentQuestionId = activeQuestion?.questionId || "";
  const matchingAnswers = currentQuestionId
    ? answers.filter((a) => a.questionId === currentQuestionId)
    : [];
  const responseCount = matchingAnswers.length;

  // Check if participant has submitted an answer for this active question
  const participantId = currentParticipant?.id || currentParticipant?.name || "guest_participant";
  const localStorageKey = `z2o_ans_${event.id}_${currentQuestionId}_${participantId}`;

  const hasAlreadySubmitted = Boolean(
    currentQuestionId &&
      (matchingAnswers.some(
        (a) =>
          a.participantId === participantId ||
          (currentParticipant?.id && a.participantId === currentParticipant.id)
      ) ||
        localStorage.getItem(localStorageKey) === "true")
  );

  // Clear user input whenever active question changes
  useEffect(() => {
    setUserAnswer("");
    setSubmitError("");
  }, [currentQuestionId]);

  // Submit Answer Handler
  const handleSubmitAnswer = async () => {
    const trimmed = userAnswer.trim();
    if (!trimmed || !activeQuestion || !currentQuestionId || isSubmitting || hasAlreadySubmitted) {
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");

      const answersRef = collection(db, "events", event.id, "liveAnswers");
      await addDoc(answersRef, {
        participantId: currentParticipant?.id || participantId,
        participantName: currentParticipant?.name || "Event Participant",
        answer: trimmed,
        submittedAt: serverTimestamp(),
        questionId: currentQuestionId,
      });

      // Cache submission state locally
      try {
        localStorage.setItem(localStorageKey, "true");
      } catch (e) {
        console.warn("localStorage write skipped:", e);
      }

      setUserAnswer("");
    } catch (err: any) {
      console.error("Error submitting answer:", err);
      setSubmitError(err.message || "Failed to submit answer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (quizSession && quizSession.status === "running") {
    return <QuizModeCard eventId={event.id} currentParticipant={currentParticipant} />;
  }

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-neutral-800/90 rounded-2xl overflow-hidden shadow-xl text-left font-sans">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-neutral-800 bg-neutral-900/90 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-orange-500 animate-pulse shrink-0" />
          <h2 className="text-xs font-black uppercase tracking-wider text-white">
            Live Room
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && onOpenAskModal && (
            <button
              type="button"
              onClick={onOpenAskModal}
              className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center gap-1 border border-orange-400/30"
              title="Ask or update question"
            >
              <PlusCircle size={12} />
              <span>Ask Question</span>
            </button>
          )}

          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-orange-500/15 border border-orange-500/30 text-orange-400">
            MAIN STAGE
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 sm:p-6 flex flex-col justify-between space-y-6 overflow-y-auto">
        {/* Stage Container */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 min-h-[220px] rounded-2xl bg-neutral-950 border border-neutral-800/80 p-6 flex flex-col items-center justify-center text-center space-y-3"
            >
              <RefreshCw size={24} className="text-orange-500 animate-spin" />
              <p className="text-xs text-neutral-400 font-mono">Syncing live room...</p>
            </motion.div>
          ) : activeQuestion && activeQuestion.question ? (
            /* ACTIVE QUESTION CARD */
            <motion.div
              key={currentQuestionId}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="flex-1 min-h-[220px] rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-orange-500/30 p-5 sm:p-6 flex flex-col justify-between space-y-5 relative overflow-hidden shadow-2xl group"
            >
              {/* Subtle Ambient Background Flare */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 blur-3xl rounded-full pointer-events-none" />

              {/* Stage Top Bar */}
              <div className="flex items-center justify-between gap-2 relative z-10">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider text-orange-400 bg-orange-500/15 border border-orange-500/30">
                  <Sparkles size={11} className="text-orange-400" />
                  <span>ACTIVE QUESTION</span>
                </div>

                {activeQuestion.createdBy && (
                  <span className="text-[10px] font-mono text-neutral-500">
                    Host: {activeQuestion.createdBy.split("@")[0]}
                  </span>
                )}
              </div>

              {/* Question Text */}
              <div className="space-y-2 relative z-10 my-auto">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight leading-snug whitespace-pre-line">
                  {activeQuestion.question}
                </h3>
              </div>

              {/* Response Counter Footer */}
              <div className="pt-3 border-t border-neutral-800/90 flex items-center justify-between relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-xs font-mono font-extrabold text-orange-400 shadow-inner">
                  <MessageSquare size={14} className="text-orange-400" />
                  <span>
                    {responseCount} {responseCount === 1 ? "response" : "responses"} received
                  </span>
                </div>

                <span className="text-[10px] font-mono text-neutral-500 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
            </motion.div>
          ) : (
            /* NO ACTIVE QUESTION PLACEHOLDER */
            <motion.div
              key="no-question"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="flex-1 min-h-[220px] rounded-2xl bg-neutral-950 border border-neutral-800/80 p-6 flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-purple-500/5 pointer-events-none" />

              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center shadow-lg relative z-10">
                <HelpCircle size={24} />
              </div>

              <div className="space-y-1.5 max-w-sm relative z-10">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Live Event Area
                </h3>
                <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                  Future live questions will appear here.
                </p>
              </div>

              <div className="pt-2 relative z-10">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold text-neutral-400 bg-neutral-900 border border-neutral-800">
                  <Clock size={11} className="text-orange-400" />
                  Waiting for host to publish a question...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Answer Submission Box */}
        <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800/90 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono font-black uppercase tracking-wider text-neutral-300 block">
              Your Answer
            </label>

            {hasAlreadySubmitted && (
              <span className="px-2.5 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 size={11} />
                Submitted
              </span>
            )}
          </div>

          {submitError && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium flex items-center gap-1.5">
              <AlertCircle size={13} className="shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {hasAlreadySubmitted ? (
            /* SUBMITTED SUCCESS STATE */
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold leading-relaxed flex items-center gap-2.5">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <span>
                Your response has been submitted. Waiting for the next question...
              </span>
            </div>
          ) : activeQuestion && activeQuestion.question ? (
            /* ACTIVE RESPONSE INPUT FORM */
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => {
                  setUserAnswer(e.target.value);
                  if (submitError) setSubmitError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitAnswer();
                  }
                }}
                disabled={isSubmitting}
                placeholder="Type your response..."
                className="flex-1 px-4 py-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl outline-none text-white font-medium placeholder:text-neutral-600 focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/40 transition-all"
              />

              <button
                type="button"
                onClick={handleSubmitAnswer}
                disabled={!userAnswer.trim() || isSubmitting}
                className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5 shrink-0"
              >
                {isSubmitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Submit</span>
                    <Send size={12} />
                  </>
                )}
              </button>
            </div>
          ) : (
            /* DISABLED INPUT FOR NO ACTIVE QUESTION */
            <div className="flex items-center gap-2 opacity-60">
              <input
                type="text"
                disabled
                placeholder="Your response..."
                className="flex-1 px-4 py-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl outline-none text-neutral-500 font-medium cursor-not-allowed placeholder:text-neutral-600"
              />
              <button
                type="button"
                disabled
                className="px-4 py-2.5 rounded-xl bg-neutral-800 text-neutral-500 text-xs font-bold uppercase tracking-wider cursor-not-allowed border border-neutral-700/60 flex items-center gap-1.5 shrink-0"
              >
                <span>Submit</span>
                <Send size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
