/**
 * ZERO2ONE EVENTS — FEATURE 6A
 * FULL LIVE WALL PROJECTOR DISPLAY ENGINE
 *
 * First-class source of truth projector screen for live events.
 * Fully synchronized with Canonical Live Session (Waiting -> Active Activities -> Stage Transitions -> Grand Finale).
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Radio, 
  Sparkles, 
  Maximize2, 
  Minimize2, 
  Volume2, 
  VolumeX, 
  Loader2, 
  AlertCircle,
  Tv,
  ArrowLeft,
  Crown
} from "lucide-react";
import { doc, getDoc, collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { EventItem } from "../PublicEventPage";
import { CanonicalLiveSession } from "../../types/liveEventEngine";
import { LiveEventEngineService } from "../../services/liveEventEngineService";
import { getEventActivities, EventActivity } from "../../services/eventActivityService";
import { GenericQuizQuestion } from "../../services/quizBuilderService";
import { CustomQuizLiveService } from "../../services/customQuizLiveService";
import { QuizActivityAdapter, QuizQuestionStats, QuizLeaderboardEntry } from "../../services/quizActivityAdapter";
import { CrosswordActivityAdapter, CompiledCrosswordPayload, CrosswordLeaderboardEntry } from "../../services/crosswordActivityAdapter";
import { RiddleActivityAdapter, GenericRiddleEntry, RiddleSubmissionStats, RiddleLeaderboardEntry } from "../../services/riddleActivityAdapter";
import { FinalResultsService } from "../../services/finalResultsService";
import { FinalEventResultsSummary } from "../../types/finalResults";

// Sub-components
import { LiveWallLobby } from "./live-wall/LiveWallLobby";
import { LiveWallQuiz } from "./live-wall/LiveWallQuiz";
import { LiveWallCrossword } from "./live-wall/LiveWallCrossword";
import { LiveWallRiddle } from "./live-wall/LiveWallRiddle";
import { LiveWallGrandFinale } from "./live-wall/LiveWallGrandFinale";

export function LiveWallPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  // Core Data States
  const [event, setEvent] = useState<EventItem | null>(null);
  const [activities, setActivities] = useState<EventActivity[]>([]);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string; college?: string; department?: string; photo?: string }>>([]);
  const [canonicalLiveSession, setCanonicalLiveSession] = useState<CanonicalLiveSession | null>(null);
  const [finalResults, setFinalResults] = useState<FinalEventResultsSummary | null>(null);

  // Loading & UI States
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Activity Specific Cache
  const [quizQuestions, setQuizQuestions] = useState<GenericQuizQuestion[]>([]);
  const [quizStats, setQuizStats] = useState<QuizQuestionStats>({
    questionId: "",
    totalSubmissions: 0,
    optionCounts: [0, 0, 0, 0],
    correctCount: 0,
  });
  const [quizLeaderboard, setQuizLeaderboard] = useState<QuizLeaderboardEntry[]>([]);

  const [crosswordPayload, setCrosswordPayload] = useState<CompiledCrosswordPayload | null>(null);
  const [crosswordLeaderboard, setCrosswordLeaderboard] = useState<CrosswordLeaderboardEntry[]>([]);

  const [riddles, setRiddles] = useState<GenericRiddleEntry[]>([]);
  const [riddleStats, setRiddleStats] = useState<RiddleSubmissionStats>({
    riddleId: "",
    totalSubmissions: 0,
    correctCount: 0,
    recentSubmissions: [],
  });
  const [riddleLeaderboard, setRiddleLeaderboard] = useState<RiddleLeaderboardEntry[]>([]);

  // 1. Initial Load: Event & Activities
  useEffect(() => {
    if (!eventId) {
      navigate("/events", { replace: true });
      return;
    }

    let isMounted = true;
    setLoading(true);

    async function initData() {
      try {
        const [eventSnap, acts] = await Promise.all([
          getDoc(doc(db, "events", eventId)),
          getEventActivities(eventId),
        ]);

        if (!eventSnap.exists()) {
          if (isMounted) {
            setErrorMsg("Event not found.");
            setLoading(false);
          }
          return;
        }

        if (isMounted) {
          setEvent({ id: eventSnap.id, ...eventSnap.data() } as EventItem);
          setActivities(acts);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Error loading Live Wall event data:", err);
        if (isMounted) {
          setErrorMsg("Could not load event data.");
          setLoading(false);
        }
      }
    }

    initData();

    return () => {
      isMounted = false;
    };
  }, [eventId, navigate]);

  // 2. Real-Time Subscription to Authoritative Live Session
  useEffect(() => {
    if (!eventId) return;

    const unsubSession = LiveEventEngineService.subscribeLiveSession(
      eventId,
      (session) => {
        setCanonicalLiveSession(session);
      }
    );

    return () => unsubSession();
  }, [eventId]);

  // 3. Real-Time Subscription to Participants Collection
  useEffect(() => {
    if (!eventId) return;

    const partsRef = collection(db, "events", eventId, "participants");
    const unsubParticipants = onSnapshot(
      partsRef,
      (snap) => {
        const list: Array<{ id: string; name: string; college?: string; department?: string; photo?: string }> = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            name: d.name || "Participant",
            college: d.college || "",
            department: d.department || "",
            photo: d.photo || "",
          });
        });
        setParticipants(list);
      },
      (err) => console.warn("Participants subscription warning:", err)
    );

    return () => unsubParticipants();
  }, [eventId]);

  // 4. Activity Specific Subscriptions
  const currentActivityId = canonicalLiveSession?.currentActivityId;
  const currentActivityType = canonicalLiveSession?.currentActivityType;
  const currentStepIndex = typeof canonicalLiveSession?.stepIndex === "number" ? canonicalLiveSession.stepIndex : 0;
  const isEnded = canonicalLiveSession?.status === "ended" || canonicalLiveSession?.stage === "completed";

  // QUIZ SUBSCRIPTIONS
  useEffect(() => {
    if (!eventId || !currentActivityId || currentActivityType !== "quiz") {
      setQuizQuestions([]);
      return;
    }

    let isMounted = true;
    CustomQuizLiveService.getQuizQuestions(eventId, currentActivityId).then((qs) => {
      if (isMounted) setQuizQuestions(qs);
    });

    return () => {
      isMounted = false;
    };
  }, [eventId, currentActivityId, currentActivityType]);

  // Quiz active question stats
  const activeQuizQuestion = quizQuestions[currentStepIndex] || null;
  const activeQuizQuestionId = activeQuizQuestion?.id || "";

  useEffect(() => {
    if (!eventId || !currentActivityId || currentActivityType !== "quiz" || !activeQuizQuestionId) {
      return;
    }

    const unsubStats = QuizActivityAdapter.subscribeQuestionStats(
      eventId,
      currentActivityId,
      activeQuizQuestionId,
      (stats) => setQuizStats(stats)
    );

    return () => unsubStats();
  }, [eventId, currentActivityId, currentActivityType, activeQuizQuestionId]);

  // Quiz Leaderboard
  useEffect(() => {
    if (!eventId || !currentActivityId || currentActivityType !== "quiz" || canonicalLiveSession?.stage !== "leaderboard") {
      return;
    }

    const unsubLeaderboard = CustomQuizLiveService.subscribeQuizLeaderboard(
      eventId,
      currentActivityId,
      10,
      (entries) => {
        setQuizLeaderboard(
          entries.map((e) => ({
            participantId: e.participantId,
            name: e.participantName,
            totalScore: e.score,
            correctAnswersCount: e.correctCount,
            totalAnswered: 0,
            lastSubmittedAt: e.lastAnswerAt,
            rank: e.rank,
          }))
        );
      }
    );

    return () => unsubLeaderboard();
  }, [eventId, currentActivityId, currentActivityType, canonicalLiveSession?.stage]);

  // CROSSWORD SUBSCRIPTIONS
  useEffect(() => {
    if (!eventId || !currentActivityId || currentActivityType !== "crossword") {
      setCrosswordPayload(null);
      return;
    }

    let isMounted = true;
    CrosswordActivityAdapter.fetchCrosswordData(eventId, currentActivityId).then((data) => {
      if (isMounted) setCrosswordPayload(data);
    });

    const unsubCrossLeaderboard = CrosswordActivityAdapter.subscribeCrosswordLeaderboard(
      eventId,
      currentActivityId,
      (entries) => {
        if (isMounted) setCrosswordLeaderboard(entries);
      }
    );

    return () => {
      isMounted = false;
      unsubCrossLeaderboard();
    };
  }, [eventId, currentActivityId, currentActivityType]);

  // RIDDLE SUBSCRIPTIONS
  useEffect(() => {
    if (!eventId || !currentActivityId || currentActivityType !== "riddle") {
      setRiddles([]);
      return;
    }

    let isMounted = true;
    RiddleActivityAdapter.fetchRiddleEntries(eventId, currentActivityId).then((entries) => {
      if (isMounted) setRiddles(entries);
    });

    return () => {
      isMounted = false;
    };
  }, [eventId, currentActivityId, currentActivityType]);

  const activeRiddle = riddles[currentStepIndex] || null;
  const activeRiddleId = activeRiddle?.id || "";

  useEffect(() => {
    if (!eventId || !currentActivityId || currentActivityType !== "riddle" || !activeRiddleId) {
      return;
    }

    const unsubRiddleStats = RiddleActivityAdapter.subscribeRiddleStats(
      eventId,
      currentActivityId,
      activeRiddleId,
      (stats) => setRiddleStats(stats)
    );

    return () => unsubRiddleStats();
  }, [eventId, currentActivityId, currentActivityType, activeRiddleId]);

  // Riddle Leaderboard
  useEffect(() => {
    if (!eventId || !currentActivityId || currentActivityType !== "riddle" || canonicalLiveSession?.stage !== "leaderboard") {
      return;
    }

    const unsubRiddleLeaderboard = RiddleActivityAdapter.subscribeRiddleLeaderboard(
      eventId,
      currentActivityId,
      (entries) => setRiddleLeaderboard(entries)
    );

    return () => unsubRiddleLeaderboard();
  }, [eventId, currentActivityId, currentActivityType, canonicalLiveSession?.stage]);

  // 5. FINAL RESULTS SUBSCRIPTION (When event is ended)
  useEffect(() => {
    if (!eventId || !isEnded) {
      return;
    }

    let isMounted = true;

    const unsubFinal = FinalResultsService.subscribeFinalResults(eventId, (summary) => {
      if (summary && isMounted) {
        setFinalResults(summary);
      }
    });

    // If summary doesn't exist yet, trigger calculation
    FinalResultsService.calculateFinalResults(eventId).then((summary) => {
      if (isMounted && summary) {
        setFinalResults(summary);
      }
    });

    return () => {
      isMounted = false;
      unsubFinal();
    };
  }, [eventId, isEnded]);

  // 6. Client-Side Drift-Free Countdown Timer Tick
  const [timerTick, setTimerTick] = useState<number>(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerTick((prev) => prev + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const timeData = LiveEventEngineService.calculateRemainingTime(canonicalLiveSession);

  // Toggle Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  }, []);

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center p-6 space-y-4 font-sans">
        <Loader2 size={40} className="text-orange-500 animate-spin" />
        <p className="text-xs font-mono tracking-widest uppercase text-neutral-400">
          Syncing Live Wall Stage...
        </p>
      </div>
    );
  }

  // Error State
  if (errorMsg || !event) {
    return (
      <div className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center p-6 text-center space-y-4 font-sans">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
          <AlertCircle size={28} />
        </div>
        <h2 className="text-xl font-bold text-white">Live Wall Sync Error</h2>
        <p className="text-xs text-neutral-400 max-w-sm">{errorMsg || "Unable to load live event."}</p>
        <button
          type="button"
          onClick={() => navigate("/events")}
          className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold uppercase cursor-pointer"
        >
          Return to Events
        </button>
      </div>
    );
  }

  const isLiveActive = canonicalLiveSession?.status === "active";
  const eventCode = event.eventCode || event.code || "";

  return (
    <div className="min-h-screen bg-[#060608] text-neutral-100 font-sans flex flex-col justify-between select-none overflow-hidden relative selection:bg-orange-500 selection:text-white">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP FLOATING CONTROLS (Host / Projector Controls) */}
      <header className="sticky top-0 z-50 px-4 sm:px-8 py-3 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-neutral-850 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center">
            <Tv size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-orange-400">
                LIVE WALL PROJECTION
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <h1 className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-md">
              {event.title || event.name}
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {eventCode && (
            <div className="hidden sm:flex items-center gap-1 px-3 py-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono">
              <span className="text-neutral-500">CODE:</span>
              <span className="font-bold text-orange-400">{eventCode}</span>
            </div>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-all cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen (Projector Mode)"}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </header>

      {/* MAIN STAGE ROUTER */}
      <main className="flex-1 flex flex-col justify-center relative z-10 p-2 sm:p-4 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* 1. EVENT COMPLETED / GRAND FINALE */}
          {isEnded ? (
            <motion.div
              key="stage-finale"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full h-full flex flex-col justify-center"
            >
              <LiveWallGrandFinale
                summary={finalResults}
                eventTitle={event.title || event.name || "Zero2One Live Event"}
              />
            </motion.div>
          ) : !isLiveActive || !currentActivityType ? (
            /* 2. LOBBY & WAITING STAGE */
            <motion.div
              key="stage-lobby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col justify-center"
            >
              <LiveWallLobby
                event={event}
                activities={activities}
                participants={participants}
                eventCode={eventCode}
              />
            </motion.div>
          ) : currentActivityType === "quiz" ? (
            /* 3. QUIZ ACTIVITY STAGE */
            <motion.div
              key={`stage-quiz-${activeQuizQuestionId}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full h-full flex flex-col justify-center"
            >
              <LiveWallQuiz
                session={canonicalLiveSession}
                question={activeQuizQuestion}
                questionIndex={currentStepIndex}
                totalQuestions={quizQuestions.length}
                remainingSeconds={timeData.remainingSeconds}
                progressPercentage={timeData.progressPercentage}
                stats={quizStats}
                leaderboard={quizLeaderboard}
              />
            </motion.div>
          ) : currentActivityType === "crossword" ? (
            /* 4. CROSSWORD ACTIVITY STAGE */
            <motion.div
              key="stage-crossword"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full h-full flex flex-col justify-center"
            >
              <LiveWallCrossword
                session={canonicalLiveSession}
                payload={crosswordPayload}
                remainingSeconds={timeData.remainingSeconds}
                progressPercentage={timeData.progressPercentage}
                leaderboard={crosswordLeaderboard}
              />
            </motion.div>
          ) : currentActivityType === "riddle" ? (
            /* 5. RIDDLE ACTIVITY STAGE */
            <motion.div
              key={`stage-riddle-${activeRiddleId}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full h-full flex flex-col justify-center"
            >
              <LiveWallRiddle
                session={canonicalLiveSession}
                riddle={activeRiddle}
                riddleIndex={currentStepIndex}
                totalRiddles={riddles.length}
                remainingSeconds={timeData.remainingSeconds}
                progressPercentage={timeData.progressPercentage}
                stats={riddleStats}
                leaderboard={riddleLeaderboard}
              />
            </motion.div>
          ) : (
            /* FALLBACK READY LOBBY */
            <div className="my-auto text-center space-y-4 max-w-lg mx-auto p-8 rounded-3xl bg-neutral-900/60 border border-neutral-800">
              <Tv size={36} className="text-orange-400 mx-auto" />
              <h2 className="text-2xl font-black text-white">Projector Display Ready</h2>
              <p className="text-xs font-mono text-neutral-400">
                Waiting for host to broadcast live activity...
              </p>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
