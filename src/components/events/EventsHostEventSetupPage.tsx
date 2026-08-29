import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Radio,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Check,
  Save,
  Layers,
  Share2,
  AlertCircle,
  Clock,
  Calendar,
  Settings,
  Info,
  ExternalLink,
  Copy,
  FileQuestion,
  Send
} from "lucide-react";
import { auth, db, ALLOWED_ADMIN_EMAILS } from "../../lib/firebase";
import { EventJoinQRCode } from "./EventJoinQRCode";

export type RoomTypeOption = "normal" | "linkedin";

interface EventData {
  id: string;
  eventId?: string;
  title?: string;
  name?: string;
  description?: string;
  eventCode?: string;
  code?: string;
  ownerId?: string;
  date?: string;
  time?: string;
  status?: string;
  acceptingParticipants?: boolean;
  roomType?: RoomTypeOption;
  createdAt?: any;
  updatedAt?: any;
}

export function EventsHostEventSetupPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);

  // Event State
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [isLoadingEvent, setIsLoadingEvent] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<{ type: "not-found" | "unauthorized" | "network"; message: string } | null>(null);

  // Selected Room Type State
  const [selectedRoomType, setSelectedRoomType] = useState<RoomTypeOption>("normal");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string>("");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string>("");

  // Copy Feedback
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (!user) {
        navigate("/events/host", { replace: true });
        return;
      }

      const email = user.email || "";
      const isAdminEmail = ALLOWED_ADMIN_EMAILS.includes(email);
      const isValidDomain = email.endsWith("@anurag.edu.in") || isAdminEmail;

      if (!isValidDomain) {
        signOut(auth).then(() => {
          navigate("/events/host", { replace: true });
        });
        return;
      }

      setCurrentUser(user);
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  // Load Event Document (Single point read)
  useEffect(() => {
    if (!currentUser || !eventId) return;

    let isMounted = true;

    async function fetchEventDoc() {
      setIsLoadingEvent(true);
      setLoadError(null);

      try {
        const eventDocRef = doc(db, "events", eventId!);
        const eventSnapshot = await getDoc(eventDocRef);

        if (!isMounted) return;

        if (!eventSnapshot.exists()) {
          setLoadError({
            type: "not-found",
            message: "This event could not be found. It may have been deleted or the link is invalid."
          });
          setIsLoadingEvent(false);
          return;
        }

        const data = eventSnapshot.data() as EventData;
        const userEmail = currentUser?.email || "";
        const isSuperAdmin = ALLOWED_ADMIN_EMAILS.includes(userEmail);

        // Security check: Only event owner or platform admin may access Event Setup
        if (data.ownerId && data.ownerId !== currentUser?.uid && !isSuperAdmin) {
          setLoadError({
            type: "unauthorized",
            message: "Access Denied: You do not have permission to configure this event."
          });
          setIsLoadingEvent(false);
          return;
        }

        setEventData(data);
        // Pre-select existing room type if configured
        if (data.roomType === "linkedin" || data.roomType === "normal") {
          setSelectedRoomType(data.roomType);
        } else {
          setSelectedRoomType("normal");
        }
      } catch (err: any) {
        console.error("Error fetching event for setup:", err);
        if (!isMounted) return;
        setLoadError({
          type: "network",
          message: "Unable to load event details. Please verify your internet connection and try again."
        });
      } finally {
        if (isMounted) {
          setIsLoadingEvent(false);
        }
      }
    }

    fetchEventDoc();

    return () => {
      isMounted = false;
    };
  }, [currentUser, eventId]);

  // Handle Save Room Type Configuration
  const handleSaveRoomType = async () => {
    if (isSaving || !eventId || !eventData) return;

    setIsSaving(true);
    setSaveSuccessMessage("");
    setSaveErrorMessage("");

    try {
      const eventDocRef = doc(db, "events", eventId);

      // Targeted single-write update to events/{eventId}
      await updateDoc(eventDocRef, {
        roomType: selectedRoomType,
        updatedAt: serverTimestamp()
      });

      // Update local state without modifying status or acceptingParticipants
      setEventData((prev) => (prev ? { ...prev, roomType: selectedRoomType } : null));
      setSaveSuccessMessage("Room type saved.");

      // Clear success banner after 4 seconds
      setTimeout(() => {
        setSaveSuccessMessage("");
      }, 4000);
    } catch (err: any) {
      console.error("Error saving room type:", err);
      const code = err?.code || "";
      if (code === "permission-denied") {
        setSaveErrorMessage("Permission Denied: Only the verified event organizer may update this event.");
      } else {
        setSaveErrorMessage("Failed to save room configuration. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Copy code helper
  const handleCopyCode = async () => {
    const code = eventData?.eventCode || eventData?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.warn("Copy failed:", err);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut(auth);
      navigate("/events/host", { replace: true });
    } catch (err) {
      console.warn("Sign out error:", err);
      navigate("/events/host", { replace: true });
    } finally {
      setIsSigningOut(false);
    }
  };

  // Global Auth Loading View
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#070709] text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 size={32} className="text-orange-500 animate-spin" />
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
            Verifying Organizer Session...
          </p>
        </div>
      </div>
    );
  }

  const eventTitle = eventData?.title || eventData?.name || "Untitled Event";
  const eventCode = eventData?.eventCode || eventData?.code || "N/A";
  const eventStatus = (eventData?.status || "draft").toUpperCase();

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-between selection:bg-orange-500/30 selection:text-orange-200 font-sans">
      {/* Top Header */}
      <header className="w-full border-b border-neutral-900 bg-[#09090c]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/events/host/dashboard")}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft size={14} />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-tight text-white uppercase">
                ZERO<span className="text-orange-500">2</span>ONE
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center gap-1">
                <Radio size={10} className="animate-pulse text-orange-500" />
                <span>HOST</span>
              </span>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-neutral-400 border border-neutral-800 text-xs font-semibold transition-all cursor-pointer"
              title="Sign Out"
            >
              {isSigningOut ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <LogOut size={13} />
              )}
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="w-full max-w-2xl mx-auto">
          {/* STATE 1: LOADING EVENT */}
          {isLoadingEvent && (
            <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-10 sm:p-14 shadow-2xl text-center space-y-4">
              <Loader2 size={36} className="text-orange-500 animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white uppercase tracking-wider">
                  Loading Event Setup...
                </p>
                <p className="text-xs text-neutral-500">
                  Retrieving event configuration details
                </p>
              </div>
            </div>
          )}

          {/* STATE 2: ERROR / NOT FOUND / UNAUTHORIZED */}
          {!isLoadingEvent && loadError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                {loadError.type === "unauthorized" ? <ShieldAlert size={28} /> : <FileQuestion size={28} />}
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                  {loadError.type === "unauthorized" ? "ACCESS RESTRICTED" : "EVENT NOT FOUND"}
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight uppercase">
                  {loadError.type === "unauthorized" ? "Unauthorized Access" : "Event Not Found"}
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
                  {loadError.message}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate("/events/host/dashboard")}
                  className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Back to Dashboard
                </button>
              </div>
            </motion.div>
          )}

          {/* STATE 3: EVENT SETUP UI */}
          {!isLoadingEvent && !loadError && eventData && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8"
            >
              {/* Navigation Tabs between Setup & Activities & Publish */}
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-850 flex-wrap">
                <div className="px-3.5 py-1.5 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/30 text-xs font-bold flex items-center gap-1.5">
                  <Settings size={13} />
                  <span>1. Room Setup</span>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/events/host/events/${eventId}/activities`)}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-white border border-neutral-800 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Layers size={13} />
                  <span>2. Activities Manager</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/events/host/events/${eventId}/publish`)}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-white border border-neutral-800 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Send size={13} />
                  <span>3. Pre-flight &amp; Publish</span>
                </button>
              </div>

              {/* Header Details */}
              <div className="text-center space-y-3">
                <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                  ZERO2ONE EVENTS
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                  EVENT SETUP
                </h1>

                <div className="p-4 rounded-2xl bg-[#14141a] border border-neutral-800 space-y-3 text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                        Event Name
                      </div>
                      <div className="text-base sm:text-lg font-black text-white truncate">
                        {eventTitle}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md bg-neutral-800 text-neutral-300 border border-neutral-700">
                        Status: <strong className="text-amber-400 uppercase">{eventStatus}</strong>
                      </span>
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md bg-neutral-800 text-neutral-300 border border-neutral-700">
                        Participants: <strong className="text-neutral-400">Closed</strong>
                      </span>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-400 font-medium">Event Code:</span>
                      <span className="font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                        {eventCode}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title="Copy Code"
                      >
                        {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      </button>
                    </div>

                    {(eventData.date || eventData.time) && (
                      <div className="flex items-center gap-3 text-neutral-400 text-[11px]">
                        {eventData.date && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} className="text-neutral-500" />
                            <span>{eventData.date}</span>
                          </span>
                        )}
                        {eventData.time && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-neutral-500" />
                            <span>{eventData.time}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Feedback Messages */}
              <AnimatePresence>
                {saveSuccessMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2.5 shadow-sm"
                  >
                    <Check size={16} className="shrink-0 stroke-[3]" />
                    <span>{saveSuccessMessage}</span>
                  </motion.div>
                )}

                {saveErrorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2.5 shadow-sm"
                  >
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{saveErrorMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ROOM TYPE SECTION */}
              <div className="space-y-4">
                <div className="space-y-1 text-left">
                  <div className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Settings size={14} className="text-orange-500" />
                    <span>ROOM TYPE</span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Choose how your event will be conducted.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* OPTION 1: NORMAL ROOM */}
                  <div
                    onClick={() => setSelectedRoomType("normal")}
                    className={`relative rounded-2xl p-5 border transition-all duration-200 cursor-pointer text-left flex flex-col justify-between space-y-4 ${
                      selectedRoomType === "normal"
                        ? "bg-[#16161e] border-orange-500 ring-1 ring-orange-500/50 shadow-lg shadow-orange-500/10"
                        : "bg-[#111116] border-neutral-800 hover:border-neutral-700 hover:bg-[#14141a]"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          selectedRoomType === "normal"
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                            : "bg-neutral-850 text-neutral-400 border border-neutral-750"
                        }`}>
                          <Layers size={18} />
                        </div>

                        {selectedRoomType === "normal" && (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                            <Check size={11} className="stroke-[3]" />
                            <span>Selected</span>
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">
                          NORMAL ROOM
                        </h3>
                        <p className="text-xs text-neutral-400 leading-relaxed font-normal">
                          Standard ZERO2ONE event experience.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRoomType("normal");
                      }}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                        selectedRoomType === "normal"
                          ? "bg-orange-500 text-white shadow-sm"
                          : "bg-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-750"
                      }`}
                    >
                      {selectedRoomType === "normal" ? "Selected" : "Select"}
                    </button>
                  </div>

                  {/* OPTION 2: LINKEDIN ROOM */}
                  <div
                    onClick={() => setSelectedRoomType("linkedin")}
                    className={`relative rounded-2xl p-5 border transition-all duration-200 cursor-pointer text-left flex flex-col justify-between space-y-4 ${
                      selectedRoomType === "linkedin"
                        ? "bg-[#16161e] border-orange-500 ring-1 ring-orange-500/50 shadow-lg shadow-orange-500/10"
                        : "bg-[#111116] border-neutral-800 hover:border-neutral-700 hover:bg-[#14141a]"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          selectedRoomType === "linkedin"
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                            : "bg-neutral-850 text-neutral-400 border border-neutral-750"
                        }`}>
                          <Share2 size={18} />
                        </div>

                        {selectedRoomType === "linkedin" && (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                            <Check size={11} className="stroke-[3]" />
                            <span>Selected</span>
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">
                          LINKEDIN ROOM
                        </h3>
                        <p className="text-xs text-neutral-400 leading-relaxed font-normal">
                          Event format designed for LinkedIn-oriented events.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRoomType("linkedin");
                      }}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                        selectedRoomType === "linkedin"
                          ? "bg-orange-500 text-white shadow-sm"
                          : "bg-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-750"
                      }`}
                    >
                      {selectedRoomType === "linkedin" ? "Selected" : "Select"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Note */}
              <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-left text-[11px] text-neutral-400 flex items-start gap-2.5">
                <Info size={15} className="text-orange-400 shrink-0 mt-0.5" />
                <span>
                  Saving room configuration updates the event template. The event remains in <strong>DRAFT</strong> status and closed to participants until you publish or start the live event.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col-reverse sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate("/events/host/dashboard")}
                    disabled={isSaving}
                    className="w-full sm:w-1/3 py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveRoomType}
                    disabled={isSaving}
                    className="w-full sm:w-2/3 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Saving Room Type...</span>
                      </>
                    ) : (
                      <>
                        <Save size={15} />
                        <span>Save Room Configuration</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/events/host/events/${eventId}/activities`)}
                  className="w-full py-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-850 text-orange-400 hover:text-orange-300 border border-orange-500/20 hover:border-orange-500/40 font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Layers size={14} />
                  <span>Configure Activities Sequence →</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-900 bg-[#08080a] py-6 text-center text-xs text-neutral-500">
        ZERO2ONE EVENTS // Organizer Portal
      </footer>
    </div>
  );
}
