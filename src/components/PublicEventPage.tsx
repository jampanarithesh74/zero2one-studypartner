import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Globe, 
  ArrowLeft, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  Copy, 
  Check, 
  Info, 
  Users 
} from "lucide-react";
import { doc, getDoc, collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Participant } from "./ParticipantOnboarding";

export interface EventItem {
  id: string;
  title: string;
  description: string;
  venue: string;
  banner: string;
  adminNote?: string;
  startDate: string;
  endDate: string;
  status: "active" | "upcoming" | "completed";
  eventType: "public" | "internal";
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
}

interface PublicEventPageProps {
  eventId?: string | null;
  onNavigateHome?: () => void;
}

export function PublicEventPage({ eventId: propEventId, onNavigateHome }: PublicEventPageProps) {
  const routeParams = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const activeEventId = propEventId || routeParams.eventId || null;

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const [currentParticipant, setCurrentParticipant] = useState<(Participant & { id: string }) | null>(null);
  const [onlineCount, setOnlineCount] = useState<number>(0);

  // 1. Fetch Event metadata
  useEffect(() => {
    let isMounted = true;

    async function fetchEvent() {
      if (!activeEventId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setNotFound(false);

      try {
        const docRef = doc(db, "events", activeEventId);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
          if (isMounted) {
            setEvent({ id: snapshot.id, ...snapshot.data() } as EventItem);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setNotFound(true);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Error loading public event:", err);
        if (isMounted) {
          setNotFound(true);
          setLoading(false);
        }
      }
    }

    fetchEvent();

    return () => {
      isMounted = false;
    };
  }, [activeEventId]);

  // 2. Check local session for existing participant
  useEffect(() => {
    if (!activeEventId) return;
    try {
      const stored = localStorage.getItem(`z2o_participant_${activeEventId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id && parsed.name) {
          setCurrentParticipant(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed reading stored participant:", e);
    }
  }, [activeEventId]);

  // 3. Realtime listener for online participants count
  useEffect(() => {
    if (!activeEventId) return;
    const participantsRef = collection(db, "events", activeEventId, "participants");
    const unsubscribe = onSnapshot(
      participantsRef,
      (snapshot) => {
        setOnlineCount(snapshot.size);
      },
      (err) => {
        console.error("Participants count error:", err);
      }
    );
    return () => unsubscribe();
  }, [activeEventId]);

  const formatDateTime = (isoStr: string) => {
    if (!isoStr) return "TBD";
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return isoStr;
      return date.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoStr;
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBackToEvents = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      navigate("/events");
    }
  };

  const handlePrimaryAction = () => {
    if (!activeEventId) return;
    if (currentParticipant) {
      navigate(`/events/${activeEventId}/room`);
    } else {
      navigate(`/events/${activeEventId}/join`);
    }
  };

  const getStatusBadge = (statusVal: string) => {
    switch (statusVal) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-sm animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Active Now
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-neutral-800 border border-neutral-700 text-neutral-400">
            <CheckCircle size={12} />
            Completed
          </span>
        );
      case "upcoming":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-orange-500/15 border border-orange-500/30 text-orange-400">
            <Clock size={12} />
            Published
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500 selection:text-white pb-20 pt-4 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Top Header Bar */}
        <header className="flex items-center justify-between p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-md">
          <button
            type="button"
            onClick={handleBackToEvents}
            className="flex items-center gap-2 text-xs font-bold text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} className="text-orange-500" />
            <span>Events Directory</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            <span className="text-[11px] font-black uppercase tracking-widest text-orange-500 font-mono">
              ZERO2ONE EVENTS
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-all border border-neutral-700 flex items-center gap-1.5 cursor-pointer"
            title="Copy Share Link"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
          </button>
        </header>

        {/* Loading State */}
        {loading && (
          <div className="p-12 md:p-16 rounded-3xl bg-[#121212] border border-neutral-800 text-center flex flex-col items-center justify-center gap-4">
            <Sparkles size={36} className="text-orange-500 animate-spin" />
            <p className="text-xs font-black uppercase tracking-widest text-neutral-400">
              Loading Event Details...
            </p>
          </div>
        )}

        {/* Event Not Found State */}
        {!loading && (notFound || !event) && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-10 md:p-16 rounded-3xl bg-[#121212] border border-neutral-800 text-center flex flex-col items-center justify-center gap-5 shadow-2xl"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <AlertCircle size={32} />
            </div>

            <div className="space-y-2 max-w-md">
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Event Not Found
              </h2>
              <p className="text-xs md:text-sm text-neutral-400 font-medium leading-relaxed">
                This event may have been removed or is unavailable. Please check the URL link or scan a valid QR code.
              </p>
            </div>

            <button
              type="button"
              onClick={handleBackToEvents}
              className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-orange-500/20 active:scale-95 cursor-pointer flex items-center gap-2 border border-orange-400/40"
            >
              <ArrowLeft size={16} />
              Return to Events Directory
            </button>
          </motion.div>
        )}

        {/* Public Event Content */}
        {!loading && event && !notFound && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-[#121212] border border-neutral-800 overflow-hidden shadow-2xl"
          >
            {/* Banner Section */}
            <div className="relative aspect-[16/9] bg-neutral-950 overflow-hidden border-b border-neutral-800">
              {event.banner ? (
                <img
                  src={event.banner}
                  alt={event.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black text-neutral-500 p-6 text-center">
                  <Calendar size={48} className="text-orange-500/40" />
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-400">
                    ZERO2ONE PUBLIC EVENT
                  </span>
                </div>
              )}

              {/* Top Badges Overlay */}
              <div className="absolute top-4 left-4 right-4 flex justify-between items-center gap-2 pointer-events-none">
                {getStatusBadge(event.status)}

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-black/80 backdrop-blur-md border border-white/10 text-white shadow-md">
                  <Globe size={12} className="text-orange-400" /> Public Event
                </span>
              </div>
            </div>

            {/* Event Details Body */}
            <div className="p-6 md:p-8 space-y-6">
              {/* Event Title & Realtime Online Badge */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 font-mono">
                    ANURAG UNIVERSITY • ZERO2ONE
                  </span>

                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <Users size={12} />
                    <span>{onlineCount} Joined</span>
                  </span>
                </div>

                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-snug">
                  {event.title}
                </h1>
              </div>

              {/* Meta Grid: Date, Time & Venue */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80">
                {/* Date & Time */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                  <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-500 shrink-0">
                    <Clock size={18} />
                  </div>
                  <div className="space-y-1 text-left">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
                      Date &amp; Time
                    </span>
                    <p className="text-xs font-bold text-neutral-200 leading-snug">
                      {formatDateTime(event.startDate)}
                    </p>
                    {event.endDate && (
                      <p className="text-[11px] text-neutral-400">
                        Until {formatDateTime(event.endDate)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Venue */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                  <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-500 shrink-0">
                    <MapPin size={18} />
                  </div>
                  <div className="space-y-1 text-left">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">
                      Venue Location
                    </span>
                    <p className="text-xs font-bold text-neutral-200 leading-snug">
                      {event.venue}
                    </p>
                  </div>
                </div>
              </div>

              {/* Event Description */}
              <div className="space-y-2 text-left">
                <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">
                  About Event
                </h3>
                <p className="text-sm text-neutral-300 font-normal leading-relaxed whitespace-pre-line bg-neutral-900/30 p-4 rounded-2xl border border-neutral-800/60">
                  {event.description}
                </p>
              </div>

              {/* Admin Note if available */}
              {event.adminNote && (
                <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/25 text-left space-y-1">
                  <div className="flex items-center gap-2 text-orange-400 font-extrabold text-xs">
                    <Info size={14} />
                    <span>Admin Announcement Note</span>
                  </div>
                  <p className="text-xs text-orange-200/90 leading-relaxed font-medium">
                    {event.adminNote}
                  </p>
                </div>
              )}

              {/* Action Button: Join Event / Enter Room */}
              <div className="pt-4 border-t border-neutral-800 space-y-3">
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-orange-500/10 hover:shadow-orange-500/25 cursor-pointer flex items-center justify-center gap-3 border border-orange-400/40"
                >
                  <Sparkles size={18} />
                  <span>
                    {currentParticipant ? "Enter Event Room" : "Join Event"}
                  </span>
                </button>

                <p className="text-[11px] text-center text-neutral-500 font-medium">
                  Organized via ZERO2ONE Academic Portal
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
