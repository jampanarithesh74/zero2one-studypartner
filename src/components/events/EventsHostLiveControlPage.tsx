import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Radio,
  LogOut,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Play,
  Pause,
  Eye,
  Trophy,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Layers,
  Users,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Zap,
  Lock,
  Flag,
  Calendar,
  Settings,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import { auth, db, ALLOWED_ADMIN_EMAILS } from "../../lib/firebase";
import {
  LiveEventEngineService,
  LiveEngineValidationResult,
} from "../../services/liveEventEngineService";
import {
  CanonicalLiveSession,
  LiveActivityStage,
} from "../../types/liveEventEngine";
import {
  getEventActivities,
  EventActivity,
  ACTIVITY_METADATA,
} from "../../services/eventActivityService";
import {
  CustomQuizLiveService,
  CustomQuizLeaderboardEntry,
} from "../../services/customQuizLiveService";
import { GenericQuizQuestion } from "../../services/quizBuilderService";
import { LiveCrosswordHostView } from "./live/LiveCrosswordHostView";
import { GenericRiddleEntry } from "../../services/riddleBuilderService";
import { RiddleActivityAdapter } from "../../services/riddleActivityAdapter";
import { LiveRiddleHostView } from "./live/LiveRiddleHostView";

interface EventDocData {
  id: string;
  title?: string;
  name?: string;
  eventCode?: string;
  code?: string;
  ownerId?: string;
  status?: string;
  roomType?: "normal" | "linkedin";
  participantCount?: number;
  date?: string;
  time?: string;
}

export function EventsHostLiveControlPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);

  // Event & Activities State
  const [eventData, setEventData] = useState<EventDocData | null>(null);
  const [activities, setActivities] = useState<EventActivity[]>([]);
  const [isLoadingEvent, setIsLoadingEvent] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<{
    type: "not-found" | "unauthorized" | "not-published" | "no-activities" | "generic";
    message: string;
  } | null>(null);

  // Realtime Live Session State
  const [liveSession, setLiveSession] = useState<CanonicalLiveSession | null>(null);
  const [isActionPending, setIsActionPending] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Local Drift-Free Countdown Timer State (calculated locally, 0 Firestore writes)
  const [localTimer, setLocalTimer] = useState<{
    remainingSeconds: number;
    isExpired: boolean;
    progressPercentage: number;
    formattedTime: string;
  }>({
    remainingSeconds: 0,
    isExpired: false,
    progressPercentage: 0,
    formattedTime: "00:00",
  });

  // Copy Feedback
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Modal State
  const [showEndModal, setShowEndModal] = useState<boolean>(false);

  // Custom Quiz Activity State
  const [quizQuestions, setQuizQuestions] = useState<GenericQuizQuestion[]>([]);
  const [isLoadingQuizQuestions, setIsLoadingQuizQuestions] = useState<boolean>(false);
  const [quizLeaderboard, setQuizLeaderboard] = useState<CustomQuizLeaderboardEntry[]>([]);

  // Custom Riddle Activity State
  const [riddles, setRiddles] = useState<GenericRiddleEntry[]>([]);
  const [isLoadingRiddles, setIsLoadingRiddles] = useState<boolean>(false);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (!user) {
        navigate("/events/host", { replace: true });
        return;
      }

      const email = user.email || "";
      const isAdmin = ALLOWED_ADMIN_EMAILS.includes(email);
      const isValidDomain = email.endsWith("@anurag.edu.in") || isAdmin;

      if (!isValidDomain) {
        signOut(auth).then(() => {
          navigate("/events/host", { replace: true });
        });
        return;
      }

      setCurrentUser(user);
      setIsAdminUser(isAdmin);
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  // 2. Fetch & Validate Event and Activities
  const loadEventData = useCallback(async () => {
    if (!currentUser || !eventId) return;

    setIsLoadingEvent(true);
    setLoadError(null);

    try {
      const validation: LiveEngineValidationResult =
        await LiveEventEngineService.validateEventForLive(
          eventId,
          currentUser.uid,
          isAdminUser
        );

      if (!validation.isEligible) {
        let errorType: "not-found" | "unauthorized" | "not-published" | "no-activities" | "generic" = "generic";
        if (validation.errorMessage?.includes("not found")) errorType = "not-found";
        else if (validation.errorMessage?.includes("Unauthorized")) errorType = "unauthorized";
        else if (validation.errorMessage?.includes("draft")) errorType = "not-published";
        else if (validation.errorMessage?.includes("No activities")) errorType = "no-activities";

        setLoadError({
          type: errorType,
          message: validation.errorMessage || "Unable to load event for live execution.",
        });
        setIsLoadingEvent(false);
        return;
      }

      setEventData({
        id: eventId,
        ...validation.event,
      });
      setActivities(validation.activities || []);
    } catch (err: any) {
      setLoadError({
        type: "generic",
        message: err.message || "Failed to load event data. Please check your network connection.",
      });
    } finally {
      setIsLoadingEvent(false);
    }
  }, [currentUser, eventId, isAdminUser]);

  useEffect(() => {
    if (currentUser && eventId) {
      loadEventData();
    }
  }, [currentUser, eventId, loadEventData]);

  // 3. Realtime Subscription to Canonical Live Session (`events/{eventId}/liveSession/current`)
  useEffect(() => {
    if (!eventId) return;

    const unsubscribe = LiveEventEngineService.subscribeLiveSession(
      eventId,
      (session) => {
        setLiveSession(session);
      }
    );

    return () => unsubscribe();
  }, [eventId]);

  // 4. Local Clock Tick: Recalculate remaining countdown without Firestore writes
  useEffect(() => {
    const updateCountdown = () => {
      const timerData = LiveEventEngineService.calculateRemainingTime(liveSession);
      setLocalTimer(timerData);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 500);
    return () => clearInterval(interval);
  }, [liveSession]);

  // Copy Event Code Helper
  const handleCopyCode = () => {
    const code = eventData?.eventCode || eventData?.code;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Clear feedback messages after 4s
  const triggerSuccessFeedback = (msg: string) => {
    setActionSuccessMessage(msg);
    setActionError(null);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  // ==========================================
  // AUTHORITATIVE STATE TRANSITION HANDLERS
  // ==========================================

  // Transition 0: Start Live Event Session (Waiting Room -> First Activity Ready)
  const handleStartLiveEvent = async () => {
    if (!eventId || !currentUser) return;
    setIsActionPending(true);
    setActionError(null);

    try {
      await LiveEventEngineService.startLiveEvent(eventId, currentUser.uid, activities);
      triggerSuccessFeedback("Live event session initialized! Activity #1 is now in READY stage.");
    } catch (err: any) {
      setActionError(err.message || "Failed to initialize live session.");
    } finally {
      setIsActionPending(false);
    }
  };

  // Transition 1: Start Activity (Ready -> Running)
  const handleStartActivity = async () => {
    if (!eventId || !liveSession) return;
    setIsActionPending(true);
    setActionError(null);

    try {
      await LiveEventEngineService.startActivity(
        eventId,
        liveSession.stageSequenceNumber,
        liveSession.durationSeconds || undefined
      );
      triggerSuccessFeedback("Activity timer started! Participants can now interact.");
    } catch (err: any) {
      setActionError(err.message || "Failed to start activity.");
    } finally {
      setIsActionPending(false);
    }
  };

  // Transition 2: Freeze Activity (Running -> Frozen)
  const handleFreezeActivity = async () => {
    if (!eventId || !liveSession) return;
    setIsActionPending(true);
    setActionError(null);

    try {
      await LiveEventEngineService.freezeActivity(
        eventId,
        liveSession.stageSequenceNumber
      );
      triggerSuccessFeedback("Submissions frozen! Participants can no longer submit.");
    } catch (err: any) {
      setActionError(err.message || "Failed to freeze activity.");
    } finally {
      setIsActionPending(false);
    }
  };

  // Transition 3: Reveal Solutions (Frozen / Running -> Reveal)
  const handleRevealSolutions = async () => {
    if (!eventId || !liveSession) return;
    setIsActionPending(true);
    setActionError(null);

    try {
      await LiveEventEngineService.revealActivity(
        eventId,
        liveSession.stageSequenceNumber
      );
      triggerSuccessFeedback("Correct solutions revealed across all participant screens.");
    } catch (err: any) {
      setActionError(err.message || "Failed to reveal solutions.");
    } finally {
      setIsActionPending(false);
    }
  };

  // Transition 4: Show Leaderboard (Reveal / Frozen -> Leaderboard)
  const handleShowLeaderboard = async () => {
    if (!eventId || !liveSession) return;
    setIsActionPending(true);
    setActionError(null);

    try {
      await LiveEventEngineService.showLeaderboard(
        eventId,
        liveSession.stageSequenceNumber
      );
      triggerSuccessFeedback("Leaderboard standings presented.");
    } catch (err: any) {
      setActionError(err.message || "Failed to show leaderboard.");
    } finally {
      setIsActionPending(false);
    }
  };

  // Transition 5: Next Activity (Leaderboard -> Next Activity Ready)
  const handleNextActivity = async () => {
    if (!eventId || !liveSession) return;
    setIsActionPending(true);
    setActionError(null);

    try {
      const result = await LiveEventEngineService.advanceToNextActivity(
        eventId,
        liveSession.stageSequenceNumber,
        activities
      );

      if (result.hasNext) {
        triggerSuccessFeedback(`Advanced to Next Activity: ${result.nextActivityTitle || "Ready"}.`);
      } else {
        triggerSuccessFeedback("All event activities completed! Live event finished.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to advance activity.");
    } finally {
      setIsActionPending(false);
    }
  };

  // Transition 6: Conclude Event
  const handleCompleteEvent = async () => {
    if (!eventId || !liveSession) return;
    setIsActionPending(true);
    setActionError(null);

    try {
      await LiveEventEngineService.completeLiveEvent(
        eventId,
        liveSession.stageSequenceNumber
      );
      setShowEndModal(false);
      triggerSuccessFeedback("Event concluded successfully.");
    } catch (err: any) {
      setActionError(err.message || "Failed to conclude event.");
    } finally {
      setIsActionPending(false);
    }
  };

  // Helper variables for UI rendering
  const eventTitle = eventData?.title || eventData?.name || "Zero2One Event";
  const eventCode = eventData?.eventCode || eventData?.code || "";
  const currentStage: LiveActivityStage = liveSession?.stage || "ready";
  const isLiveActive = liveSession?.status === "active";
  const isEventCompleted = liveSession?.status === "ended" || liveSession?.stage === "completed";
  const currentActIdx = liveSession ? liveSession.currentActivityIndex : 0;
  const currentActivity = activities[currentActIdx] || null;
  const isLastActivity = currentActIdx >= activities.length - 1;

  // Active activity identifier & type
  const currentActivityId = liveSession?.currentActivityId || currentActivity?.id || null;
  const currentActivityType = liveSession?.currentActivityType || currentActivity?.type || null;

  // Load Quiz questions when active activity is "quiz"
  useEffect(() => {
    if (!eventId || !currentActivityId || currentActivityType !== "quiz") {
      setQuizQuestions([]);
      return;
    }

    let isMounted = true;
    setIsLoadingQuizQuestions(true);

    CustomQuizLiveService.getQuizQuestions(eventId, currentActivityId)
      .then((qs) => {
        if (isMounted) {
          setQuizQuestions(qs);
          setIsLoadingQuizQuestions(false);
        }
      })
      .catch((err) => {
        console.error("Error loading live quiz questions for host deck:", err);
        if (isMounted) {
          setIsLoadingQuizQuestions(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [eventId, currentActivityId, currentActivityType]);

  // Subscribe to Quiz Leaderboard when active activity is "quiz" and stage is "leaderboard"
  useEffect(() => {
    if (!eventId || !currentActivityId || currentActivityType !== "quiz" || liveSession?.stage !== "leaderboard") {
      setQuizLeaderboard([]);
      return;
    }

    const unsub = CustomQuizLiveService.subscribeQuizLeaderboard(
      eventId,
      currentActivityId,
      10,
      (entries) => {
        setQuizLeaderboard(entries);
      }
    );

    return () => unsub();
  }, [eventId, currentActivityId, currentActivityType, liveSession?.stage]);

  // Load Riddle entries when active activity is "riddle"
  useEffect(() => {
    if (!eventId || !currentActivityId || currentActivityType !== "riddle") {
      setRiddles([]);
      return;
    }

    let isMounted = true;
    setIsLoadingRiddles(true);

    RiddleActivityAdapter.fetchRiddleEntries(eventId, currentActivityId)
      .then((entries) => {
        if (isMounted) {
          setRiddles(entries);
          setIsLoadingRiddles(false);
        }
      })
      .catch((err) => {
        console.error("Error loading live riddle entries for host deck:", err);
        if (isMounted) {
          setIsLoadingRiddles(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [eventId, currentActivityId, currentActivityType]);

  // Quiz-specific current question pointers
  const currentQuizQuestionIndex = typeof liveSession?.stepIndex === "number" ? liveSession.stepIndex : 0;
  const currentQuizQuestion = quizQuestions[currentQuizQuestionIndex] || null;
  const isLastQuizQuestion = currentQuizQuestionIndex >= quizQuestions.length - 1;

  // Riddle-specific current question pointers
  const currentRiddleIndex = typeof liveSession?.stepIndex === "number" ? liveSession.stepIndex : 0;
  const currentRiddleQuestion = riddles[currentRiddleIndex] || null;
  const isLastRiddleQuestion = currentRiddleIndex >= riddles.length - 1;

  // Riddle Question Transitions
  const handleStartRiddleQuestion = async () => {
    if (!eventId || !liveSession || !currentRiddleQuestion) return;
    setIsActionPending(true);
    setActionError(null);

    try {
      await RiddleActivityAdapter.startRiddleQuestion(
        eventId,
        liveSession.stageSequenceNumber,
        currentRiddleQuestion.timeLimitSec || 20
      );
      triggerSuccessFeedback(`Riddle #${currentRiddleIndex + 1} timer started! Attendees can now submit answers.`);
    } catch (err: any) {
      setActionError(err.message || "Failed to start riddle.");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleFreezeRiddleQuestion = async () => {
    if (!eventId || !liveSession) return;
    setIsActionPending(true);
    setActionError(null);

    try {
      await RiddleActivityAdapter.freezeRiddleQuestion(
        eventId,
        liveSession.stageSequenceNumber
      );
      triggerSuccessFeedback(`Riddle #${currentRiddleIndex + 1} frozen! Submissions locked.`);
    } catch (err: any) {
      setActionError(err.message || "Failed to freeze riddle.");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleRevealRiddleQuestion = async () => {
    if (!eventId || !liveSession) return;
    setIsActionPending(true);
    setActionError(null);

    try {
      await RiddleActivityAdapter.revealRiddleQuestion(
        eventId,
        liveSession.stageSequenceNumber
      );
      triggerSuccessFeedback(`Riddle #${currentRiddleIndex + 1} solution revealed to all attendees.`);
    } catch (err: any) {
      setActionError(err.message || "Failed to reveal riddle solution.");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleShowRiddleLeaderboard = async () => {
    if (!eventId || !liveSession) return;
    setIsActionPending(true);
    setActionError(null);

    try {
      await RiddleActivityAdapter.showRiddleLeaderboard(
        eventId,
        liveSession.stageSequenceNumber
      );
      triggerSuccessFeedback("Riddle leaderboard standings displayed.");
    } catch (err: any) {
      setActionError(err.message || "Failed to show riddle leaderboard.");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleNextRiddleQuestion = async () => {
    if (!eventId || !liveSession || isLastRiddleQuestion) return;
    setIsActionPending(true);
    setActionError(null);

    const nextIdx = currentRiddleIndex + 1;
    const nextR = riddles[nextIdx];

    try {
      await RiddleActivityAdapter.advanceToNextRiddle(
        eventId,
        liveSession.stageSequenceNumber,
        nextIdx,
        nextR?.timeLimitSec || 20
      );
      triggerSuccessFeedback(`Advanced to Riddle #${nextIdx + 1} of ${riddles.length}. Ready for launch!`);
    } catch (err: any) {
      setActionError(err.message || "Failed to advance to next riddle.");
    } finally {
      setIsActionPending(false);
    }
  };

  // Quiz Question Transitions
  const handleStartQuizQuestion = async () => {
    if (!eventId || !liveSession || !currentQuizQuestion) return;
    setIsActionPending(true);
    setActionError(null);

    try {
      await CustomQuizLiveService.startQuizQuestion(
        eventId,
        liveSession.stageSequenceNumber,
        currentQuizQuestion.timeLimitSec || 15
      );
      triggerSuccessFeedback(`Question ${currentQuizQuestionIndex + 1} timer started! Attendees can now submit answers.`);
    } catch (err: any) {
      setActionError(err.message || "Failed to start quiz question.");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleFreezeQuizQuestion = async () => {
    if (!eventId || !liveSession) return;
    setIsActionPending(true);
    setActionError(null);

    try {
      await CustomQuizLiveService.freezeQuizQuestion(
        eventId,
        liveSession.stageSequenceNumber
      );
      triggerSuccessFeedback(`Question ${currentQuizQuestionIndex + 1} frozen! Submissions locked.`);
    } catch (err: any) {
      setActionError(err.message || "Failed to freeze quiz question.");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleRevealQuizQuestion = async () => {
    if (!eventId || !liveSession) return;
    setIsActionPending(true);
    setActionError(null);

    try {
      await CustomQuizLiveService.revealQuizQuestion(
        eventId,
        liveSession.stageSequenceNumber
      );
      triggerSuccessFeedback(`Question ${currentQuizQuestionIndex + 1} solution revealed to all attendees.`);
    } catch (err: any) {
      setActionError(err.message || "Failed to reveal question solution.");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleShowQuizLeaderboard = async () => {
    if (!eventId || !liveSession) return;
    setIsActionPending(true);
    setActionError(null);

    try {
      await CustomQuizLiveService.showQuizLeaderboard(
        eventId,
        liveSession.stageSequenceNumber
      );
      triggerSuccessFeedback("Quiz leaderboard standings displayed.");
    } catch (err: any) {
      setActionError(err.message || "Failed to show quiz leaderboard.");
    } finally {
      setIsActionPending(false);
    }
  };

  const handleNextQuizQuestion = async () => {
    if (!eventId || !liveSession || isLastQuizQuestion) return;
    setIsActionPending(true);
    setActionError(null);

    const nextIdx = currentQuizQuestionIndex + 1;
    const nextQ = quizQuestions[nextIdx];

    try {
      await CustomQuizLiveService.advanceToNextQuizQuestion(
        eventId,
        liveSession.stageSequenceNumber,
        nextIdx,
        nextQ?.timeLimitSec || 15
      );
      triggerSuccessFeedback(`Advanced to Question ${nextIdx + 1} of ${quizQuestions.length}. Ready for launch!`);
    } catch (err: any) {
      setActionError(err.message || "Failed to advance to next question.");
    } finally {
      setIsActionPending(false);
    }
  };

  // Active Stage Indicator Metadata
  const getStageMetadata = (stage: LiveActivityStage) => {
    switch (stage) {
      case "ready":
        return {
          label: "READY TO START",
          color: "bg-blue-500/10 text-blue-400 border-blue-500/30",
          icon: Clock,
          desc: "Activity is primed. Attendees are in the intro lobby. Timer has NOT started.",
        };
      case "running":
        return {
          label: "ACTIVELY RUNNING",
          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          icon: Zap,
          desc: "Timer is live. Attendees are submitting answers in real-time.",
        };
      case "frozen":
        return {
          label: "SUBMISSIONS FROZEN",
          color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          icon: Pause,
          desc: "Submissions locked. Host can discuss questions before revealing answers.",
        };
      case "reveal":
        return {
          label: "SOLUTIONS REVEALED",
          color: "bg-purple-500/10 text-purple-400 border-purple-500/30",
          icon: Eye,
          desc: "Correct answers and explanations are broadcasted to all attendee screens.",
        };
      case "leaderboard":
        return {
          label: "LEADERBOARD STAGE",
          color: "bg-orange-500/10 text-orange-400 border-orange-500/30",
          icon: Trophy,
          desc: "Rankings and top scores for this round are displayed.",
        };
      case "completed":
        return {
          label: "EVENT COMPLETED",
          color: "bg-neutral-800 text-neutral-300 border-neutral-700",
          icon: Flag,
          desc: "All activities in the sequence have concluded.",
        };
      default:
        return {
          label: "STANDBY",
          color: "bg-neutral-800 text-neutral-400 border-neutral-700",
          icon: Clock,
          desc: "Waiting for host action.",
        };
    }
  };

  const stageMeta = getStageMetadata(currentStage);

  return (
    <div className="min-h-screen bg-[#070709] text-neutral-100 font-sans selection:bg-orange-500/30 selection:text-orange-200">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-neutral-850 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/events/host/events/${eventId}/publish`)}
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-all cursor-pointer"
            title="Back to Pre-Flight / Publish"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <Radio size={16} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-widest text-red-400 uppercase">
                  LIVE CONTROL DECK
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              </div>
              <h1 className="text-sm font-bold text-white tracking-tight truncate max-w-[200px] sm:max-w-md">
                {eventTitle}
              </h1>
            </div>
          </div>
        </div>

        {/* Quick Links & Host Profile */}
        <div className="flex items-center gap-2.5">
          {eventCode && (
            <button
              type="button"
              onClick={handleCopyCode}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-xs font-mono text-neutral-300 transition-all cursor-pointer"
              title="Copy Event Code"
            >
              <span className="text-neutral-400">CODE:</span>
              <span className="font-bold text-orange-400">{eventCode}</span>
              {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          )}

          <button
            type="button"
            onClick={() => window.open(`/events/${eventId}/waiting`, "_blank")}
            className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Open Participant Waiting Room in New Tab"
          >
            <Users size={13} className="text-emerald-400" />
            <span className="hidden md:inline">Waiting Room</span>
            <ExternalLink size={11} className="text-neutral-400" />
          </button>

          <button
            type="button"
            onClick={() => window.open(`/events/${eventId}/live-wall`, "_blank")}
            className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Open Live Wall in New Tab"
          >
            <Sparkles size={13} className="text-purple-400" />
            <span className="hidden md:inline">Live Wall</span>
            <ExternalLink size={11} className="text-neutral-400" />
          </button>

          <button
            type="button"
            onClick={() => navigate("/events/host/dashboard")}
            className="px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold transition-all cursor-pointer"
          >
            Dashboard
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* STATE 1: LOADING */}
        {(isLoadingAuth || isLoadingEvent) && (
          <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-12 text-center space-y-4 shadow-2xl">
            <Loader2 size={36} className="text-orange-500 animate-spin mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-white uppercase tracking-wider">
                Connecting to Live Session Engine...
              </p>
              <p className="text-xs text-neutral-500">
                Synchronizing sequence order and host authorization
              </p>
            </div>
          </div>
        )}

        {/* STATE 2: ERROR / UNPUBLISHED / UNAUTHORIZED */}
        {!isLoadingAuth && !isLoadingEvent && loadError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-8 sm:p-12 shadow-2xl space-y-6 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              {loadError.type === "unauthorized" ? <ShieldAlert size={28} /> : <AlertTriangle size={28} />}
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                {loadError.type === "not-published" ? "EVENT NOT PUBLISHED" : "LIVE CONTROL ACCESS RESTRICTED"}
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">
                {loadError.type === "not-published"
                  ? "Publish Required Before Launch"
                  : "Cannot Open Live Deck"}
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
                {loadError.message}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              {loadError.type === "not-published" && (
                <button
                  type="button"
                  onClick={() => navigate(`/events/host/events/${eventId}/publish`)}
                  className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Go to Pre-Flight &amp; Publish
                </button>
              )}

              {loadError.type === "no-activities" && (
                <button
                  type="button"
                  onClick={() => navigate(`/events/host/events/${eventId}/activities`)}
                  className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Configure Activities
                </button>
              )}

              <button
                type="button"
                onClick={() => navigate("/events/host/dashboard")}
                className="px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          </motion.div>
        )}

        {/* STATE 3: LIVE HOST CONTROL DECK */}
        {!isLoadingAuth && !isLoadingEvent && !loadError && eventData && (
          <div className="space-y-6">
            {/* Feedback Notifications */}
            <AnimatePresence>
              {actionError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-between gap-3 shadow-lg"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertCircle size={18} className="text-red-400 shrink-0" />
                    <span>{actionError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionError(null)}
                    className="text-red-400 hover:text-white text-xs font-bold"
                  >
                    Dismiss
                  </button>
                </motion.div>
              )}

              {actionSuccessMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between gap-3 shadow-lg"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                    <span>{actionSuccessMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionSuccessMessage(null)}
                    className="text-emerald-400 hover:text-white text-xs font-bold"
                  >
                    Dismiss
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* EVENT METADATA STRIP */}
            <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center font-mono font-bold text-lg shrink-0">
                  {currentActIdx + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                      EVENT:
                    </span>
                    <span className="text-xs font-bold text-white">{eventTitle}</span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      PUBLISHED
                    </span>
                    {eventData.roomType && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-neutral-850 text-neutral-300 border border-neutral-750">
                        {eventData.roomType === "linkedin" ? "LinkedIn Room" : "Normal Room"}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5 flex items-center gap-3">
                    <span>
                      Sequence: <strong className="text-neutral-200">{activities.length} Total Activities</strong>
                    </span>
                    <span>•</span>
                    <span className="font-mono text-orange-400">
                      Code: <strong>{eventCode}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Badge & Sequence Tag */}
              <div className="flex items-center gap-3 self-end md:self-center">
                <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 ${stageMeta.color}`}>
                  <stageMeta.icon size={15} />
                  <span className="text-xs font-black uppercase tracking-wider">{stageMeta.label}</span>
                </div>

                <div className="text-right pl-3 border-l border-neutral-800 hidden sm:block">
                  <div className="text-xs font-mono font-bold text-white">
                    Seq #{liveSession?.stageSequenceNumber || 1}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-neutral-400">
                    State Monotonic
                  </div>
                </div>
              </div>
            </div>

            {/* MAIN TWO-COLUMN DECK LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT COLUMN: ACTIVITY SEQUENCE LIST (4 COLS) */}
              <div className="lg:col-span-4 bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-850">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-orange-500" />
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                      ACTIVITY SEQUENCE ({activities.length})
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-neutral-400">
                    ORDER ASC
                  </span>
                </div>

                <div className="space-y-2.5">
                  {activities.map((act, index) => {
                    const isDone = liveSession ? index < liveSession.currentActivityIndex : false;
                    const isCurrent = liveSession ? index === liveSession.currentActivityIndex : index === 0;
                    const isUpcoming = liveSession ? index > liveSession.currentActivityIndex : index > 0;
                    const meta = ACTIVITY_METADATA[act.type] || {
                      label: act.type,
                      icon: "⚡",
                    };

                    return (
                      <div
                        key={act.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isCurrent
                            ? "bg-orange-500/10 border-orange-500/50 shadow-md shadow-orange-500/5"
                            : isDone
                            ? "bg-neutral-900/40 border-neutral-850 opacity-70"
                            : "bg-neutral-900/80 border-neutral-800"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Step Marker */}
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                              isCurrent
                                ? "bg-orange-500 text-white shadow-md shadow-orange-500/30"
                                : isDone
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-neutral-800 text-neutral-400"
                            }`}
                          >
                            {isDone ? (
                              <Check size={14} className="text-emerald-400" />
                            ) : (
                              index + 1
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs">{meta.icon}</span>
                              <span
                                className={`text-xs font-bold truncate ${
                                  isCurrent ? "text-white" : isDone ? "text-neutral-400 line-through" : "text-neutral-300"
                                }`}
                              >
                                {act.title}
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono flex items-center gap-2 mt-0.5">
                              <span className="uppercase">{meta.label}</span>
                              <span>•</span>
                              <span>
                                {act.durationSeconds || act.config?.timeLimit || 60}s
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Tag */}
                        <div className="shrink-0">
                          {isCurrent && (
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
                              ACTIVE
                            </span>
                          )}
                          {isDone && (
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              DONE
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-750">
                              UPCOMING
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 rounded-2xl bg-neutral-900/60 border border-neutral-850 text-[11px] text-neutral-400 space-y-1">
                  <div className="font-bold text-neutral-300 flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-orange-400" />
                    <span>Sequence Integrity</span>
                  </div>
                  <p className="text-[10px] leading-relaxed">
                    Live progression is deterministic and forward-only. Same-type activities retain discrete IDs.
                  </p>
                </div>
              </div>

              {/* RIGHT COLUMN: ACTIVE ACTIVITY RADAR & HOST CONTROL DECK (8 COLS) */}
              <div className="lg:col-span-8 space-y-6">
                {/* 1. NOT YET LAUNCHED / INITIALIZE PROMPT */}
                {!isLiveActive && !isEventCompleted && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0e0e12] border border-orange-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center mx-auto shadow-xl shadow-orange-500/10">
                      <Radio size={28} className="animate-pulse" />
                    </div>

                    <div className="space-y-2 max-w-lg mx-auto">
                      <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest">
                        WAITING ROOM OPEN • READY FOR HOST
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                        Launch Live Event Orchestrator
                      </h2>
                      <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                        Attendees in the waiting room will transition into synchronized activity mode once you launch. Starting the event puts Activity #1 in <strong>READY</strong> stage without starting its timer yet.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 max-w-md mx-auto text-xs text-neutral-300 text-left space-y-2">
                      <div className="flex justify-between border-b border-neutral-800 pb-1.5">
                        <span className="text-neutral-500 uppercase font-bold">First Activity:</span>
                        <span className="text-white font-bold">{activities[0]?.title || "Round 1"}</span>
                      </div>
                      <div className="flex justify-between border-b border-neutral-800 pb-1.5">
                        <span className="text-neutral-500 uppercase font-bold">Activity Type:</span>
                        <span className="text-orange-400 font-bold uppercase">{activities[0]?.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500 uppercase font-bold">Total Sequence:</span>
                        <span className="text-emerald-400 font-bold">{activities.length} Activities</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleStartLiveEvent}
                        disabled={isActionPending}
                        className="w-full max-w-md py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
                      >
                        {isActionPending ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            <span>INITIALIZING CANONICAL SESSION...</span>
                          </>
                        ) : (
                          <>
                            <Play size={18} />
                            <span>START LIVE EVENT</span>
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* 2. ACTIVE LIVE ACTIVITY CONTROLS */}
                {isLiveActive && !isEventCompleted && currentActivity && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {currentActivity.type === "crossword" && liveSession ? (
                      <LiveCrosswordHostView
                        eventId={eventId!}
                        activityId={currentActivity.id}
                        session={liveSession}
                        isActionPending={isActionPending}
                        onStartActivity={handleStartActivity}
                        onFreezeActivity={handleFreezeActivity}
                        onRevealSolutions={handleRevealSolutions}
                        onShowLeaderboard={handleShowLeaderboard}
                        onNextActivity={handleNextActivity}
                        onCompleteEvent={handleCompleteEvent}
                        isLastActivity={isLastActivity}
                      />
                    ) : (
                      /* ACTIVE ACTIVITY HEADER CARD */
                      <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-850">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider">
                            <span>CURRENT ACTIVITY #{currentActIdx + 1} OF {activities.length}</span>
                          </div>
                          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mt-1">
                            {currentActivity.title}
                          </h2>
                          <div className="text-xs text-neutral-400 mt-1 flex items-center gap-2">
                            <span className="font-semibold text-neutral-300 uppercase">
                              Type: {currentActivity.type}
                            </span>
                            <span>•</span>
                            <span className="font-mono text-neutral-400">
                              ID: {currentActivity.id}
                            </span>
                          </div>
                        </div>

                      {/* DRIFT-FREE COUNTDOWN RADAR */}
                      <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 px-5 py-3 rounded-2xl self-start sm:self-center">
                        <Clock size={22} className={currentStage === "running" ? "text-orange-400 animate-pulse" : "text-neutral-500"} />
                        <div>
                          <div className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                            {currentStage === "running" ? "TIME REMAINING" : "STAGE DURATION"}
                          </div>
                          <div className="text-2xl font-mono font-black text-white tracking-wider">
                            {currentStage === "running"
                              ? localTimer.formattedTime
                              : currentActivity.type === "quiz" && currentQuizQuestion
                              ? `${Math.floor((currentQuizQuestion.timeLimitSec || 15) / 60)
                                  .toString()
                                  .padStart(2, "0")}:${((currentQuizQuestion.timeLimitSec || 15) % 60)
                                  .toString()
                                  .padStart(2, "0")}`
                              : currentActivity.type === "riddle" && currentRiddleQuestion
                              ? `${Math.floor((currentRiddleQuestion.timeLimitSec || 20) / 60)
                                  .toString()
                                  .padStart(2, "0")}:${((currentRiddleQuestion.timeLimitSec || 20) % 60)
                                  .toString()
                                  .padStart(2, "0")}`
                              : `${Math.floor((currentActivity.durationSeconds || currentActivity.config?.timeLimit || 60) / 60)
                                  .toString()
                                  .padStart(2, "0")}:${((currentActivity.durationSeconds || currentActivity.config?.timeLimit || 60) % 60)
                                  .toString()
                                  .padStart(2, "0")}`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RIDDLE-SPECIFIC RADAR & HOST VIEW (When type === "riddle") */}
                    {currentActivity.type === "riddle" && liveSession && (
                      <LiveRiddleHostView
                        eventId={eventId!}
                        activityId={currentActivity.id}
                        session={liveSession}
                        riddles={riddles}
                        isLoadingRiddles={isLoadingRiddles}
                      />
                    )}

                    {/* QUIZ-SPECIFIC QUESTION RADAR (When type === "quiz") */}
                    {currentActivity.type === "quiz" && (
                      <div className="p-5 rounded-2xl bg-neutral-950 border border-orange-500/30 space-y-4 shadow-xl">
                        <div className="flex items-center justify-between gap-3 border-b border-neutral-850 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                              Question {currentQuizQuestionIndex + 1} of {quizQuestions.length || 1}
                            </span>
                            <span className="text-xs font-mono font-bold text-neutral-400">
                              {currentQuizQuestion?.points || 100} PTS • {currentQuizQuestion?.timeLimitSec || 15}s Limit
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] font-mono text-neutral-500">
                              {isLastQuizQuestion ? "Final Question in Quiz" : `Next: Q${currentQuizQuestionIndex + 2}`}
                            </span>
                          </div>
                        </div>

                        {/* Question Prompt */}
                        {currentQuizQuestion ? (
                          <div className="space-y-3">
                            <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                              {currentQuizQuestion.text}
                            </h3>

                            {/* 4 Options Grid (Host View with Correct Option Highlighted) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                              {currentQuizQuestion.options.map((optText, optIdx) => {
                                const isCorrect = optIdx === currentQuizQuestion.correctOptionIndex;
                                const labels = ["A", "B", "C", "D"];

                                return (
                                  <div
                                    key={optIdx}
                                    className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                                      isCorrect
                                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                                        : "bg-neutral-900/80 border-neutral-800 text-neutral-300"
                                    }`}
                                  >
                                    <span
                                      className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-mono font-black shrink-0 ${
                                        isCorrect
                                          ? "bg-emerald-500 text-black font-black"
                                          : "bg-neutral-800 text-neutral-400"
                                      }`}
                                    >
                                      {labels[optIdx]}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="leading-snug break-words">{optText}</p>
                                      {isCorrect && (
                                        <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase mt-0.5 block">
                                          ✓ Correct Option (Host Preview)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Explanation preview if available */}
                            {currentQuizQuestion.explanation && (
                              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 text-xs text-neutral-400 leading-relaxed">
                                <strong className="text-neutral-300 font-mono uppercase text-[10px] block mb-0.5">
                                  Explanation Note:
                                </strong>
                                {currentQuizQuestion.explanation}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-xs text-neutral-400 font-mono">
                            {isLoadingQuizQuestions ? "Loading quiz questions..." : "No questions configured for this quiz."}
                          </div>
                        )}

                        {/* Leaderboard Table in Leaderboard stage */}
                        {currentStage === "leaderboard" && (
                          <div className="mt-4 pt-4 border-t border-neutral-800 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Trophy size={14} />
                                <span>Quiz Standings (Top 10)</span>
                              </span>
                              <span className="text-[10px] font-mono text-neutral-500">
                                {quizLeaderboard.length} Attendees Scored
                              </span>
                            </div>

                            <div className="rounded-xl bg-neutral-900/80 border border-neutral-800 overflow-hidden divide-y divide-neutral-800/60 max-h-56 overflow-y-auto">
                              {quizLeaderboard.length === 0 ? (
                                <div className="p-4 text-center text-xs text-neutral-500 font-mono">
                                  Awaiting participant score submissions...
                                </div>
                              ) : (
                                quizLeaderboard.map((entry, idx) => (
                                  <div
                                    key={entry.participantId}
                                    className="p-2.5 px-3 flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <span className="font-mono font-bold text-neutral-400 w-5">
                                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                                      </span>
                                      <span className="font-bold text-white truncate">
                                        {entry.participantName}
                                      </span>
                                    </div>
                                    <span className="font-mono font-black text-orange-400 shrink-0">
                                      {entry.score} pts
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* STAGE STATUS EXPLANATION BANNER */}
                    <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex items-start gap-3.5">
                      <div className="p-2.5 rounded-xl bg-neutral-800 text-orange-400 shrink-0">
                        <stageMeta.icon size={18} />
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-white uppercase">
                          CURRENT STAGE: <span className="text-orange-400">{stageMeta.label}</span>
                        </div>
                        <p className="text-xs text-neutral-400 leading-relaxed">
                          {stageMeta.desc}
                        </p>
                      </div>
                    </div>

                    {/* STAGE TRANSITION ACTION BUTTONS */}
                    <div className="space-y-3 pt-2">
                      <div className="text-xs font-black text-neutral-400 uppercase tracking-wider px-1">
                        HOST AUTHORITATIVE ACTION
                      </div>

                      {/* --- QUIZ ACTIVITY CONTROLS --- */}
                      {currentActivity.type === "quiz" ? (
                        <>
                          {/* STAGE: READY -> Enable [ START QUESTION & TIMER ] */}
                          {currentStage === "ready" && (
                            <button
                              type="button"
                              onClick={handleStartQuizQuestion}
                              disabled={isActionPending || !currentQuizQuestion}
                              className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-black font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isActionPending ? (
                                <>
                                  <Loader2 size={18} className="animate-spin" />
                                  <span>STARTING QUESTION...</span>
                                </>
                              ) : (
                                <>
                                  <Play size={18} />
                                  <span>
                                    START QUESTION {currentQuizQuestionIndex + 1} &amp; TIMER (
                                    {currentQuizQuestion?.timeLimitSec || 15}s)
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
                                onClick={handleFreezeQuizQuestion}
                                disabled={isActionPending}
                                className="py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-black font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isActionPending ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <>
                                    <Pause size={18} />
                                    <span>FREEZE SUBMISSIONS</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={handleRevealQuizQuestion}
                                disabled={isActionPending}
                                className="py-4 px-6 rounded-2xl bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isActionPending ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <>
                                    <Eye size={18} />
                                    <span>REVEAL SOLUTION</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          {/* STAGE: FROZEN -> Enable [ REVEAL ] */}
                          {currentStage === "frozen" && (
                            <button
                              type="button"
                              onClick={handleRevealQuizQuestion}
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
                                  <span>REVEAL SOLUTION</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* STAGE: REVEAL -> Enable [ SHOW LEADERBOARD ] */}
                          {currentStage === "reveal" && (
                            <button
                              type="button"
                              onClick={handleShowQuizLeaderboard}
                              disabled={isActionPending}
                              className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isActionPending ? (
                                <>
                                  <Loader2 size={18} className="animate-spin" />
                                  <span>LOADING LEADERBOARD...</span>
                                </>
                              ) : (
                                <>
                                  <Trophy size={18} />
                                  <span>SHOW QUIZ LEADERBOARD</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* STAGE: LEADERBOARD -> Enable [ NEXT QUESTION ] OR [ NEXT ACTIVITY ] / [ COMPLETE EVENT ] */}
                          {currentStage === "leaderboard" && (
                            <div>
                              {!isLastQuizQuestion ? (
                                <button
                                  type="button"
                                  onClick={handleNextQuizQuestion}
                                  disabled={isActionPending}
                                  className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isActionPending ? (
                                    <>
                                      <Loader2 size={18} className="animate-spin" />
                                      <span>PREPARING NEXT QUESTION...</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>
                                        NEXT QUESTION (Q{currentQuizQuestionIndex + 2} of {quizQuestions.length})
                                      </span>
                                      <ChevronRight size={18} />
                                    </>
                                  )}
                                </button>
                              ) : !isLastActivity ? (
                                <button
                                  type="button"
                                  onClick={handleNextActivity}
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
                                      <span>NEXT ACTIVITY ({activities[currentActIdx + 1]?.title})</span>
                                      <ChevronRight size={18} />
                                    </>
                                  )}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setShowEndModal(true)}
                                  disabled={isActionPending}
                                  className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-black font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Flag size={18} />
                                  <span>FINALIZE &amp; COMPLETE LIVE EVENT 🏁</span>
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      ) : currentActivity.type === "riddle" ? (
                        /* --- RIDDLE ACTIVITY CONTROLS --- */
                        <>
                          {/* STAGE: READY -> Enable [ START RIDDLE & TIMER ] */}
                          {currentStage === "ready" && (
                            <button
                              type="button"
                              onClick={handleStartRiddleQuestion}
                              disabled={isActionPending || !currentRiddleQuestion}
                              className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-black font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isActionPending ? (
                                <>
                                  <Loader2 size={18} className="animate-spin" />
                                  <span>STARTING RIDDLE...</span>
                                </>
                              ) : (
                                <>
                                  <Play size={18} />
                                  <span>
                                    START RIDDLE #{currentRiddleIndex + 1} &amp; TIMER (
                                    {currentRiddleQuestion?.timeLimitSec || 20}s)
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
                                onClick={handleFreezeRiddleQuestion}
                                disabled={isActionPending}
                                className="py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-black font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isActionPending ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <>
                                    <Pause size={18} />
                                    <span>FREEZE SUBMISSIONS</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={handleRevealRiddleQuestion}
                                disabled={isActionPending}
                                className="py-4 px-6 rounded-2xl bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isActionPending ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <>
                                    <Eye size={18} />
                                    <span>REVEAL SOLUTION</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          {/* STAGE: FROZEN -> Enable [ REVEAL ] */}
                          {currentStage === "frozen" && (
                            <button
                              type="button"
                              onClick={handleRevealRiddleQuestion}
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
                                  <span>REVEAL SOLUTION</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* STAGE: REVEAL -> Enable [ SHOW LEADERBOARD ] */}
                          {currentStage === "reveal" && (
                            <button
                              type="button"
                              onClick={handleShowRiddleLeaderboard}
                              disabled={isActionPending}
                              className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isActionPending ? (
                                <>
                                  <Loader2 size={18} className="animate-spin" />
                                  <span>LOADING LEADERBOARD...</span>
                                </>
                              ) : (
                                <>
                                  <Trophy size={18} />
                                  <span>SHOW RIDDLE LEADERBOARD</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* STAGE: LEADERBOARD -> Enable [ NEXT RIDDLE ] OR [ NEXT ACTIVITY ] / [ COMPLETE EVENT ] */}
                          {currentStage === "leaderboard" && (
                            <div>
                              {!isLastRiddleQuestion ? (
                                <button
                                  type="button"
                                  onClick={handleNextRiddleQuestion}
                                  disabled={isActionPending}
                                  className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isActionPending ? (
                                    <>
                                      <Loader2 size={18} className="animate-spin" />
                                      <span>PREPARING NEXT RIDDLE...</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>
                                        NEXT RIDDLE (#{currentRiddleIndex + 2} of {riddles.length})
                                      </span>
                                      <ChevronRight size={18} />
                                    </>
                                  )}
                                </button>
                              ) : !isLastActivity ? (
                                <button
                                  type="button"
                                  onClick={handleNextActivity}
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
                                      <span>NEXT ACTIVITY ({activities[currentActIdx + 1]?.title})</span>
                                      <ChevronRight size={18} />
                                    </>
                                  )}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setShowEndModal(true)}
                                  disabled={isActionPending}
                                  className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-black font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Flag size={18} />
                                  <span>FINALIZE &amp; COMPLETE LIVE EVENT 🏁</span>
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        /* --- NON-QUIZ GENERIC ACTIVITY CONTROLS --- */
                        <>
                          {/* STAGE: READY -> Enable [ START ACTIVITY ] */}
                          {currentStage === "ready" && (
                            <button
                              type="button"
                              onClick={handleStartActivity}
                              disabled={isActionPending}
                              className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-black font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isActionPending ? (
                                <>
                                  <Loader2 size={18} className="animate-spin" />
                                  <span>STARTING ACTIVITY...</span>
                                </>
                              ) : (
                                <>
                                  <Play size={18} />
                                  <span>START ACTIVITY &amp; TIMER</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* STAGE: RUNNING -> Enable [ FREEZE ] and [ REVEAL ] */}
                          {currentStage === "running" && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={handleFreezeActivity}
                                disabled={isActionPending}
                                className="py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-black font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isActionPending ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <>
                                    <Pause size={18} />
                                    <span>FREEZE SUBMISSIONS</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={handleRevealSolutions}
                                disabled={isActionPending}
                                className="py-4 px-6 rounded-2xl bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isActionPending ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <>
                                    <Eye size={18} />
                                    <span>REVEAL SOLUTIONS</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          {/* STAGE: FROZEN -> Enable [ REVEAL ] */}
                          {currentStage === "frozen" && (
                            <button
                              type="button"
                              onClick={handleRevealSolutions}
                              disabled={isActionPending}
                              className="w-full py-4 px-6 rounded-2xl bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isActionPending ? (
                                <>
                                  <Loader2 size={18} className="animate-spin" />
                                  <span>REVEALING ANSWERS...</span>
                                </>
                              ) : (
                                <>
                                  <Eye size={18} />
                                  <span>REVEAL SOLUTIONS</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* STAGE: REVEAL -> Enable [ SHOW LEADERBOARD ] */}
                          {currentStage === "reveal" && (
                            <button
                              type="button"
                              onClick={handleShowLeaderboard}
                              disabled={isActionPending}
                              className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isActionPending ? (
                                <>
                                  <Loader2 size={18} className="animate-spin" />
                                  <span>LOADING LEADERBOARD...</span>
                                </>
                              ) : (
                                <>
                                  <Trophy size={18} />
                                  <span>SHOW ACTIVITY LEADERBOARD</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* STAGE: LEADERBOARD -> Enable [ NEXT ACTIVITY ] or [ COMPLETE EVENT ] */}
                          {currentStage === "leaderboard" && (
                            <div>
                              {!isLastActivity ? (
                                <button
                                  type="button"
                                  onClick={handleNextActivity}
                                  disabled={isActionPending}
                                  className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isActionPending ? (
                                    <>
                                      <Loader2 size={18} className="animate-spin" />
                                      <span>ADVANCING SEQUENCE...</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>NEXT ACTIVITY ({activities[currentActIdx + 1]?.title})</span>
                                      <ChevronRight size={18} />
                                    </>
                                  )}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setShowEndModal(true)}
                                  disabled={isActionPending}
                                  className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-black font-extrabold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Flag size={18} />
                                  <span>FINALIZE &amp; COMPLETE LIVE EVENT 🏁</span>
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                      {/* FORWARD-ONLY GUARD NOTICE & PREVIOUS BUTTON (DISABLED) */}
                      <div className="pt-2 flex items-center justify-between text-xs text-neutral-400 border-t border-neutral-850">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled
                            className="px-3 py-1.5 rounded-xl bg-neutral-900 text-neutral-600 border border-neutral-800 text-[11px] font-bold uppercase cursor-not-allowed opacity-50 flex items-center gap-1"
                            title="Previous activity is disabled in live execution to prevent state corruption"
                          >
                            <RotateCcw size={12} />
                            <span>Previous Activity</span>
                          </button>
                          <span className="text-[10px] text-neutral-400">
                            (Forward-only deterministic flow)
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowEndModal(true)}
                          className="text-red-400 hover:text-red-300 text-[11px] font-bold uppercase transition-all cursor-pointer"
                        >
                          Conclude Early
                        </button>
                      </div>
                    </div>
                    )}
                  </motion.div>
                )}

                {/* 3. EVENT COMPLETED SUMMARY */}
                {isEventCompleted && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#0e0e12] border border-emerald-500/40 rounded-3xl p-8 sm:p-12 shadow-2xl text-center space-y-6"
                  >
                    <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
                      <Flag size={32} />
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                        LIVE EVENT CONCLUDED
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
                        All Activities Completed!
                      </h2>
                      <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
                        All {activities.length} activities in this sequence have been successfully orchestrated and broadcasted.
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => navigate("/events/host/dashboard")}
                        className="px-6 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Return to Host Dashboard
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: EARLY EVENT CONCLUSION MODAL */}
      <AnimatePresence>
        {showEndModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0f0f14] border border-red-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
                  <Flag size={24} />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  CONCLUDE LIVE EVENT?
                </h3>
                <p className="text-xs text-neutral-400">
                  This will transition the canonical session to COMPLETED status and end all active timers.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEndModal(false)}
                  className="flex-1 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCompleteEvent}
                  disabled={isActionPending}
                  className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isActionPending ? <Loader2 size={14} className="animate-spin" /> : "Conclude Event"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
