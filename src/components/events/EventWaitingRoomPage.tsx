import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, 
  Sparkles, 
  Clock, 
  MapPin, 
  Calendar, 
  Users, 
  Radio, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  RadioTower,
  Play,
  ArrowRight,
  ShieldCheck,
  UserCheck
} from "lucide-react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { EventItem } from "../PublicEventPage";
import { Participant } from "../ParticipantOnboarding";
import { BroadcastService, ActiveBroadcastData } from "../../services/activityService";

export function EventWaitingRoomPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [participant, setParticipant] = useState<(Participant & { id: string }) | null>(null);
  const [activeBroadcast, setActiveBroadcast] = useState<ActiveBroadcastData | null>(null);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isEventLive, setIsEventLive] = useState<boolean>(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Verify Local Session and Load Event Document
  useEffect(() => {
    if (!eventId) {
      navigate("/events/join", { replace: true });
      return;
    }

    let isMounted = true;

    async function loadParticipantAndEvent() {
      setLoading(true);
      setErrorMsg("");

      // Read participant session from localStorage
      let localParticipant: (Participant & { id: string }) | null = null;
      try {
        const raw = localStorage.getItem(`z2o_participant_${eventId}`);
        if (raw) {
          localParticipant = JSON.parse(raw);
        }
      } catch (e) {
        console.warn("Error reading local participant session:", e);
      }

      if (!localParticipant || !localParticipant.id) {
        console.warn("No participant session found for event in waiting room. Redirecting to join.");
        if (isMounted) {
          navigate(`/events/join`, { replace: true });
        }
        return;
      }

      setParticipant(localParticipant);

      // Fetch single event document and participant doc from Firestore
      try {
        const [eventSnap, partSnap] = await Promise.all([
          getDoc(doc(db, "events", eventId)),
          getDoc(doc(db, "events", eventId, "participants", localParticipant.id)),
        ]);

        if (!eventSnap.exists()) {
          if (isMounted) {
            setErrorMsg("We couldn't find this event.");
            setLoading(false);
          }
          return;
        }

        const eventData = { id: eventSnap.id, ...eventSnap.data() } as EventItem;

        if (isMounted) {
          setEvent(eventData);

          // If participant doc exists, update state with fresh server data
          if (partSnap.exists()) {
            const freshData = { id: partSnap.id, ...partSnap.data() } as Participant & { id: string };
            setParticipant(freshData);
          }

          // Initial check if event is already active
          if (eventData.status === "active") {
            setIsEventLive(true);
          }

          setLoading(false);
        }
      } catch (err: any) {
        console.error("Error loading waiting room data:", err);
        if (isMounted) {
          setErrorMsg("Could not verify waiting room access.");
          setLoading(false);
        }
      }
    }

    loadParticipantAndEvent();

    return () => {
      isMounted = false;
    };
  }, [eventId, navigate]);

  // 2. Real-time minimal subscription to Event status & Active Broadcast
  useEffect(() => {
    if (!eventId) return;

    // Listen to active broadcast document: events/{eventId}/activities/activeBroadcast
    const unsubBroadcast = BroadcastService.subscribe(eventId, (data) => {
      setActiveBroadcast(data);
      if (data && data.activeActivity && data.activeActivity !== "none") {
        setIsEventLive(true);
      }
    });

    // Listen to event root doc for live status changes
    const eventRef = doc(db, "events", eventId);
    const unsubEvent = onSnapshot(
      eventRef,
      (snap) => {
        if (snap.exists()) {
          const updatedEvent = { id: snap.id, ...snap.data() } as EventItem;
          setEvent(updatedEvent);
          if (updatedEvent.status === "active") {
            setIsEventLive(true);
          }
        }
      },
      (err) => {
        console.warn("Event status listener notice:", err);
      }
    );

    return () => {
      unsubBroadcast();
      unsubEvent();
    };
  }, [eventId]);

  // 3. Auto-redirect trigger when Event / Activity goes Live
  useEffect(() => {
    if (isEventLive && eventId) {
      // Begin 3-second auto-redirect countdown
      setRedirectCountdown(3);

      const countdownInterval = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            navigate(`/events/${eventId}/room`, { replace: true });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(countdownInterval);
      };
    }
  }, [isEventLive, eventId, navigate]);

  const handleEnterLiveRoom = () => {
    if (!eventId) return;
    navigate(`/events/${eventId}/room`);
  };

  const formatEventDate = (isoStr: string) => {
    if (!isoStr) return "TBD";
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoStr;
    }
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center p-6 space-y-4 font-sans">
        <Loader2 size={36} className="text-orange-500 animate-spin" />
        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-white uppercase tracking-wider">
            Entering Waiting Room...
          </p>
          <p className="text-xs text-neutral-500">
            Verifying your participant pass
          </p>
        </div>
      </div>
    );
  }

  // Error Screen
  if (errorMsg || !event || !participant) {
    return (
      <div className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center p-6 space-y-5 text-center font-sans">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
          <AlertCircle size={28} />
        </div>
        <div className="space-y-1 max-w-sm">
          <h2 className="text-lg font-black text-white uppercase tracking-tight">Access Required</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {errorMsg || "We could not find an active participant session for this event."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/events/join")}
          className="px-5 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-orange-500/20"
        >
          <ArrowLeft size={14} />
          <span>Return to Join Page</span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-between selection:bg-orange-500/30 selection:text-orange-200 font-sans">
      {/* Top Navigation */}
      <header className="w-full border-b border-neutral-900 bg-[#09090c]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/events")}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <ArrowLeft size={14} />
            <span>Events Hub</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-tight text-white uppercase">
              ZERO<span className="text-orange-500">2</span>ONE
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
              WAITING ROOM
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10 sm:py-14">
        <div className="w-full max-w-lg mx-auto space-y-6">
          {/* 1. Main Status Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center"
          >
            {/* Status Icon & Joined Badge */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-black uppercase tracking-wider">
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span>Joined Successfully</span>
              </div>

              {/* Event Name */}
              <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight leading-tight">
                {event.title}
              </h1>

              {/* Personalized Welcome */}
              <p className="text-sm font-medium text-neutral-300">
                Welcome, <span className="font-bold text-orange-400">{participant.name}</span>
              </p>
              <p className="text-xs text-neutral-400">
                You are in the event waiting room.
              </p>
            </div>

            {/* Live Status Box */}
            <div className="p-5 rounded-2xl bg-[#14141a] border border-neutral-800 space-y-3">
              {isEventLive ? (
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black uppercase tracking-wider animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Host Started Event</span>
                  </div>
                  <p className="text-xs text-neutral-300 font-medium">
                    The session is now live! Connecting you automatically...
                  </p>
                  {redirectCountdown !== null && (
                    <p className="text-[11px] font-mono text-orange-400 font-bold">
                      Entering live room in {redirectCountdown}s
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleEnterLiveRoom}
                    className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                  >
                    <span>Enter Live Room Now</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="space-y-3 py-2">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-black uppercase tracking-wider">
                    <RadioTower size={14} className="animate-pulse text-orange-400" />
                    <span>WAITING FOR HOST</span>
                  </div>
                  <p className="text-xs text-neutral-400 font-normal leading-relaxed max-w-sm mx-auto">
                    The host has not started the session yet. Stay on this screen—it will automatically update when the event begins.
                  </p>
                  <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-500 font-mono pt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                    <span>Real-time listener connected</span>
                  </div>
                </div>
              )}
            </div>

            {/* Participant Profile Card */}
            <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-850 text-left space-y-2 text-xs">
              <div className="flex items-center justify-between text-neutral-400 border-b border-neutral-800 pb-2">
                <span className="font-bold uppercase tracking-wider text-[10px] text-neutral-500">Your Participant Pass</span>
                <span className="font-mono text-[10px] text-neutral-400">{participant.id}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-300 pt-1">
                <div>
                  <span className="text-[10px] text-neutral-500 block">Name</span>
                  <span className="font-semibold text-white">{participant.name}</span>
                </div>
                {participant.college && (
                  <div>
                    <span className="text-[10px] text-neutral-500 block">College</span>
                    <span className="truncate block">{participant.college}</span>
                  </div>
                )}
                {participant.department && (
                  <div>
                    <span className="text-[10px] text-neutral-500 block">Department</span>
                    <span>{participant.department}</span>
                  </div>
                )}
                {participant.year && (
                  <div>
                    <span className="text-[10px] text-neutral-500 block">Year</span>
                    <span>{participant.year}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* 2. Event Details Card */}
          <div className="bg-[#0e0e12] border border-neutral-800/80 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Event Details
            </h3>
            <div className="space-y-2 text-xs text-neutral-300">
              {event.venue && (
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-orange-400 shrink-0" />
                  <span>{event.venue}</span>
                </div>
              )}
              {event.startDate && (
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-orange-400 shrink-0" />
                  <span>{formatEventDate(event.startDate)}</span>
                </div>
              )}
              {event.description && (
                <p className="text-neutral-400 text-xs leading-relaxed pt-1 border-t border-neutral-850">
                  {event.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-900 py-6 text-center text-xs text-neutral-500">
        <div className="max-w-5xl mx-auto px-4">
          ZERO2ONE Events &bull; Participant Waiting Room
        </div>
      </footer>
    </div>
  );
}
