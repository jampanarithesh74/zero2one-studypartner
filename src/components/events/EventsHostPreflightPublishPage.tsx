import { useState, useEffect, useCallback } from "react";
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
  Sparkles,
  Settings,
  Layers,
  Send,
  RotateCw,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Users,
  Clock,
  Calendar,
  Lock,
  Unlock,
  Wrench,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  HelpCircle,
  Eye,
  Activity
} from "lucide-react";
import { auth, db, ALLOWED_ADMIN_EMAILS } from "../../lib/firebase";
import { EventJoinQRCode } from "./EventJoinQRCode";
import {
  runEventPreflightValidation,
  publishEvent,
  unpublishEvent,
  PreflightValidationSummary,
  PreflightCheckItem
} from "../../services/preflightValidationService";

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
  roomType?: "normal" | "linkedin";
  publishedAt?: any;
  createdAt?: any;
  updatedAt?: any;
}

export function EventsHostPreflightPublishPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);

  // Event State
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [isLoadingEvent, setIsLoadingEvent] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<{
    type: "not-found" | "unauthorized" | "network";
    message: string;
  } | null>(null);

  // Pre-flight Validation State
  const [validationSummary, setValidationSummary] = useState<PreflightValidationSummary | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null);

  // Publish / Unpublish Actions State
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [showUnpublishModal, setShowUnpublishModal] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isUnpublishing, setIsUnpublishing] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Copy Feedback States
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // 1. Auth Listener
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

  // 2. Fetch Event Document
  const fetchEventDoc = useCallback(async () => {
    if (!currentUser || !eventId) return;

    setIsLoadingEvent(true);
    setLoadError(null);

    try {
      const eventDocRef = doc(db, "events", eventId);
      const eventSnapshot = await getDoc(eventDocRef);

      if (!eventSnapshot.exists()) {
        setLoadError({
          type: "not-found",
          message: "This event could not be found. It may have been deleted or the link is invalid."
        });
        setIsLoadingEvent(false);
        return;
      }

      const data = { id: eventSnapshot.id, ...eventSnapshot.data() } as EventData;
      const userEmail = currentUser.email || "";
      const isSuperAdmin = ALLOWED_ADMIN_EMAILS.includes(userEmail);

      // Security check: Only event owner or platform admin may access Pre-flight
      if (data.ownerId && data.ownerId !== currentUser.uid && !isSuperAdmin) {
        setLoadError({
          type: "unauthorized",
          message: "Access Denied: You do not have permission to validate or publish this event."
        });
        setIsLoadingEvent(false);
        return;
      }

      setEventData(data);
    } catch (err: any) {
      console.error("Error fetching event for preflight:", err);
      setLoadError({
        type: "network",
        message: "Unable to load event details. Please check your internet connection."
      });
    } finally {
      setIsLoadingEvent(false);
    }
  }, [currentUser, eventId]);

  useEffect(() => {
    fetchEventDoc();
  }, [fetchEventDoc]);

  // 3. Run Pre-flight Validation
  const runValidation = useCallback(async () => {
    if (!eventId || !currentUser) return;

    setIsValidating(true);
    setValidationError(null);
    setActionError(null);

    try {
      const summary = await runEventPreflightValidation(
        eventId,
        currentUser.uid,
        currentUser.email || ""
      );
      setValidationSummary(summary);

      // Auto-expand the first failed check if any
      const firstFail = summary.checks.find((c) => c.status === "fail");
      if (firstFail) {
        setExpandedCheckId(firstFail.id);
      }
    } catch (err: any) {
      console.error("Error running preflight validation:", err);
      setValidationError("Failed to complete pre-flight validation. Please try again.");
    } finally {
      setIsValidating(false);
    }
  }, [eventId, currentUser]);

  useEffect(() => {
    if (eventData && currentUser) {
      runValidation();
    }
  }, [eventData, currentUser, runValidation]);

  // 4. Handle Publish Event
  const handleConfirmPublish = async () => {
    if (!eventId || !currentUser || isPublishing) return;

    setIsPublishing(true);
    setActionError(null);

    try {
      const res = await publishEvent(eventId, currentUser.uid, currentUser.email || "");

      if (!res.success) {
        setActionError(res.error || "Publishing failed. Please resolve all validation checks.");
        setIsPublishing(false);
        return;
      }

      // Success: update local event data and close modal
      setEventData((prev) => (prev ? { ...prev, status: "published", acceptingParticipants: true } : null));
      setShowPublishModal(false);
      // Re-run validation to show pristine post-publish state
      await runValidation();
    } catch (err: any) {
      console.error("Error publishing event:", err);
      setActionError("Failed to publish event. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  // 5. Handle Unpublish Event (Revert to Draft)
  const handleConfirmUnpublish = async () => {
    if (!eventId || isUnpublishing) return;

    setIsUnpublishing(true);
    setActionError(null);

    try {
      const res = await unpublishEvent(eventId);

      if (!res.success) {
        setActionError(res.error || "Failed to revert event to draft.");
        setIsUnpublishing(false);
        return;
      }

      setEventData((prev) => (prev ? { ...prev, status: "draft", acceptingParticipants: false } : null));
      setShowUnpublishModal(false);
      await runValidation();
    } catch (err: any) {
      console.error("Error unpublishing event:", err);
      setActionError("Failed to unpublish event. Please try again.");
    } finally {
      setIsUnpublishing(false);
    }
  };

  // Copy helper functions
  const handleCopyCode = async () => {
    const code = eventData?.eventCode || eventData?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.warn("Copy code failed:", err);
    }
  };

  const handleCopyJoinLink = async () => {
    const code = eventData?.eventCode || eventData?.code;
    if (!code) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const joinUrl = `${origin}/events/join?code=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.warn("Copy link failed:", err);
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

  // Render Activity Builder Route Link
  const getActivityBuilderUrl = (type: string, activityId: string) => {
    switch (type) {
      case "quiz":
        return `/events/host/events/${eventId}/activities/${activityId}/quiz`;
      case "crossword":
        return `/events/host/events/${eventId}/activities/${activityId}/crossword`;
      case "riddle":
        return `/events/host/events/${eventId}/activities/${activityId}/riddle`;
      default:
        return `/events/host/events/${eventId}/activities`;
    }
  };

  // Loading Session
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
  const isPublished = eventData?.status === "published";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const joinUrl = `${origin}/events/join?code=${encodeURIComponent(eventCode)}`;

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-between selection:bg-orange-500/30 selection:text-orange-200 font-sans">
      {/* Top Header */}
      <header className="w-full border-b border-neutral-900 bg-[#09090c]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(`/events/host/events/${eventId}/activities`)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              aria-label="Back to Activities"
            >
              <ArrowLeft size={14} />
              <span>Back to Activities</span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/events/host/dashboard")}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900/60 hover:bg-neutral-850 text-neutral-400 hover:text-neutral-200 border border-neutral-800/80 text-xs transition-all cursor-pointer"
            >
              <span>Dashboard</span>
            </button>
          </div>

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
      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="w-full max-w-3xl mx-auto space-y-6">
          {/* STATE 1: LOADING EVENT */}
          {isLoadingEvent && (
            <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-10 sm:p-14 shadow-2xl text-center space-y-4">
              <Loader2 size={36} className="text-orange-500 animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white uppercase tracking-wider">
                  Loading Event Configuration...
                </p>
                <p className="text-xs text-neutral-500">
                  Retrieving pre-flight parameters and security rules
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

          {/* STATE 3: PRE-FLIGHT VALIDATION & PUBLISH CONTENT */}
          {!isLoadingEvent && !loadError && eventData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Event Context Header */}
              <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4">
                {/* 3-Step Navigation Tabs */}
                <div className="flex items-center gap-2 pb-4 border-b border-neutral-850 overflow-x-auto scrollbar-none">
                  <button
                    type="button"
                    onClick={() => navigate(`/events/host/events/${eventId}/setup`)}
                    className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-white border border-neutral-800 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Settings size={13} />
                    <span>1. Room Setup</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/events/host/events/${eventId}/activities`)}
                    className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-white border border-neutral-800 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Layers size={13} />
                    <span>2. Activities Manager</span>
                  </button>

                  <div className="px-3.5 py-1.5 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/30 text-xs font-bold flex items-center gap-1.5 shrink-0">
                    <Send size={13} />
                    <span>3. Pre-Flight &amp; Publish</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-400 uppercase">
                        ZERO2ONE EVENTS
                      </span>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                        isPublished
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      }`}>
                        {eventStatus}
                      </span>
                      {eventData.roomType && (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-neutral-850 text-neutral-300 border border-neutral-750">
                          {eventData.roomType === "linkedin" ? "LinkedIn Room" : "Normal Room"}
                        </span>
                      )}
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase truncate">
                      {eventTitle}
                    </h1>
                  </div>

                  <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-2xl px-3.5 py-2 self-start sm:self-auto shrink-0">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                      CODE:
                    </span>
                    <span className="text-xs font-mono font-black text-orange-400 tracking-wider">
                      {eventCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="text-neutral-400 hover:text-white transition-colors cursor-pointer ml-1"
                      title="Copy Event Code"
                    >
                      {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* POST-PUBLISH ACTIVE BANNER & WAITING ROOM RADAR (If status === "published") */}
              {isPublished && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-950/40 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-500/20">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                          EVENT PUBLISHED &amp; WAITING ROOM OPEN
                        </span>
                      </div>
                      <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
                        Participants Can Now Join
                      </h2>
                      <p className="text-xs text-emerald-200/80 leading-relaxed max-w-xl">
                        Your event is actively accepting attendees. Participants entering with this code or QR code are placed in the live Waiting Room.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowUnpublishModal(true)}
                        className="px-3.5 py-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Lock size={13} />
                        <span>Revert to Draft</span>
                      </button>
                    </div>
                  </div>

                  {/* QR Code & Join Link Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    {/* QR Code Box */}
                    <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-3 text-center">
                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                        ATTENDEE SCAN TO JOIN
                      </span>
                      <div className="p-3 bg-white rounded-2xl shadow-xl">
                        <EventJoinQRCode eventCode={eventCode} size={150} />
                      </div>
                      <span className="text-xs font-mono font-bold text-orange-400 tracking-wider">
                        CODE: {eventCode}
                      </span>
                    </div>

                    {/* Join Link & Waiting Room Actions */}
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-2">
                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">
                          Direct Participant Join Link:
                        </span>
                        <div className="flex items-center gap-2 bg-[#09090c] border border-neutral-800 rounded-xl p-2 font-mono text-xs text-neutral-300 break-all">
                          <span className="truncate flex-1">{joinUrl}</span>
                          <button
                            type="button"
                            onClick={handleCopyJoinLink}
                            className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-[11px] shrink-0 transition-all cursor-pointer"
                          >
                            {copiedLink ? "Copied!" : "Copy"}
                          </button>
                        </div>
                      </div>

                      <div className="pt-1 flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/events/host/events/${eventId}/live`)}
                          className="flex-1 py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25"
                        >
                          <Radio size={15} className="animate-pulse" />
                          <span>OPEN LIVE CONTROL DECK</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => window.open(`/events/${eventId}/waiting`, "_blank")}
                          className="py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center"
                        >
                          <Users size={14} className="text-emerald-400" />
                          <span>Waiting Room ↗</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* PRE-FLIGHT VALIDATION CARD */}
              <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-850">
                  <div className="space-y-0.5">
                    <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                      <Activity size={18} className="text-orange-500" />
                      <span>PRE-FLIGHT VALIDATION DIAGNOSTICS</span>
                    </h2>
                    <p className="text-xs text-neutral-400">
                      Automated audit verifies room setup, activities readiness, questions, clues, and security.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={runValidation}
                    disabled={isValidating}
                    className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0 self-start sm:self-center disabled:opacity-50"
                  >
                    <RotateCw size={13} className={isValidating ? "animate-spin text-orange-500" : ""} />
                    <span>Re-Run Audit</span>
                  </button>
                </div>

                {/* VALIDATION RUNNER SPINNER */}
                {isValidating && (
                  <div className="py-12 text-center space-y-3">
                    <Loader2 size={32} className="text-orange-500 animate-spin mx-auto" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-white uppercase tracking-wider">
                        Running Pre-Flight Checks...
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Auditing questions, crossword bounds, riddle letter matches, and sequence continuity.
                      </p>
                    </div>
                  </div>
                )}

                {/* VALIDATION ERROR BANNER */}
                {!isValidating && validationError && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2.5">
                    <AlertCircle size={18} className="shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}

                {/* AUDIT SUMMARY STATUS BANNER */}
                {!isValidating && validationSummary && (
                  <div className="space-y-6">
                    {/* Status Scorecard */}
                    <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      validationSummary.isValid
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-red-500/10 border-red-500/30 text-red-300"
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          validationSummary.isValid
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            : "bg-red-500/20 text-red-400 border border-red-500/40"
                        }`}>
                          {validationSummary.isValid ? (
                            <CheckCircle2 size={22} className="stroke-[2.5]" />
                          ) : (
                            <AlertCircle size={22} className="stroke-[2.5]" />
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <h3 className="text-sm font-black uppercase tracking-tight text-white">
                            {validationSummary.isValid
                              ? "ALL PRE-FLIGHT CHECKS PASSED"
                              : `${validationSummary.failedChecks} BLOCKING ERROR${validationSummary.failedChecks === 1 ? "" : "S"} FOUND`}
                          </h3>
                          <p className="text-xs leading-relaxed opacity-90">
                            {validationSummary.isValid
                              ? "Event configuration is complete and verified. Ready to publish."
                              : "The event cannot be published until all blocking errors in activities or metadata are resolved."}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        <div className="text-right">
                          <div className="text-xs font-mono font-bold text-white">
                            {validationSummary.passedChecks} / {validationSummary.totalChecks}
                          </div>
                          <div className="text-[10px] uppercase font-bold text-neutral-400">
                            Checks Passed
                          </div>
                        </div>

                        {validationSummary.estimatedTotalTimeSec > 0 && (
                          <div className="text-right pl-3 border-l border-neutral-750">
                            <div className="text-xs font-mono font-bold text-orange-400">
                              ~{Math.ceil(validationSummary.estimatedTotalTimeSec / 60)} min
                            </div>
                            <div className="text-[10px] uppercase font-bold text-neutral-400">
                              Est. Runtime
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CHECKLIST ITEMS */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-neutral-400 uppercase tracking-wider px-1">
                        <span>Check Details</span>
                        <span>Status</span>
                      </div>

                      {validationSummary.checks.map((check) => {
                        const isExpanded = expandedCheckId === check.id;
                        const hasDetails = (check.details && check.details.length > 0) || check.errorMessage;

                        return (
                          <div
                            key={check.id}
                            className={`rounded-2xl border transition-all ${
                              check.status === "fail"
                                ? "bg-red-950/20 border-red-500/40"
                                : check.status === "warning"
                                ? "bg-amber-950/20 border-amber-500/40"
                                : "bg-neutral-900/60 border-neutral-800"
                            }`}
                          >
                            <div
                              onClick={() => {
                                if (hasDetails) {
                                  setExpandedCheckId(isExpanded ? null : check.id);
                                }
                              }}
                              className={`p-4 flex items-center justify-between gap-3 ${
                                hasDetails ? "cursor-pointer hover:bg-neutral-850/40" : ""
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="shrink-0">
                                  {check.status === "pass" && (
                                    <CheckCircle2 size={18} className="text-emerald-400" />
                                  )}
                                  {check.status === "fail" && (
                                    <AlertCircle size={18} className="text-red-400" />
                                  )}
                                  {check.status === "warning" && (
                                    <AlertTriangle size={18} className="text-amber-400" />
                                  )}
                                </div>

                                <div className="space-y-0.5 min-w-0">
                                  <div className="text-xs font-black text-white uppercase tracking-tight truncate">
                                    {check.title}
                                  </div>
                                  <div className="text-[11px] text-neutral-400 font-normal">
                                    {check.description}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                                  check.status === "pass"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : check.status === "fail"
                                    ? "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse"
                                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                }`}>
                                  {check.status === "pass" ? "PASSED" : check.status === "fail" ? "ACTION REQUIRED" : "WARNING"}
                                </span>

                                {hasDetails && (
                                  <button
                                    type="button"
                                    className="text-neutral-400 hover:text-white p-1"
                                  >
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* EXPANDABLE DETAILS & BUILDER JUMP BUTTON */}
                            <AnimatePresence>
                              {isExpanded && hasDetails && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="px-4 pb-4 pt-2 border-t border-neutral-850/80 space-y-3"
                                >
                                  {check.errorMessage && (
                                    <div className="text-xs text-red-300 font-semibold flex items-start gap-1.5">
                                      <span className="text-red-400 font-bold">•</span>
                                      <span>{check.errorMessage}</span>
                                    </div>
                                  )}

                                  {check.details && check.details.length > 0 && (
                                    <div className="space-y-1.5 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800 text-[11px] font-mono text-neutral-300 max-h-48 overflow-y-auto">
                                      {check.details.map((detail, dIdx) => (
                                        <div key={dIdx} className="text-neutral-300 flex items-start gap-1.5">
                                          <span className="text-orange-400 font-bold">›</span>
                                          <span>{detail}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Direct 1-Click Builder Jump */}
                                  {check.activityId && check.activityType && (
                                    <div className="pt-1 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          navigate(getActivityBuilderUrl(check.activityType!, check.activityId!))
                                        }
                                        className="px-3.5 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                                      >
                                        <Wrench size={13} />
                                        <span>Open in {check.activityType.toUpperCase()} Builder &rarr;</span>
                                      </button>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>

                    {/* PUBLISH ACTION TRIGGER BUTTON */}
                    <div className="pt-4 border-t border-neutral-850 space-y-3">
                      {actionError && (
                        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2">
                          <AlertCircle size={16} className="shrink-0" />
                          <span>{actionError}</span>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/events/host/events/${eventId}/activities`)}
                          className="w-full sm:w-1/3 py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer text-center"
                        >
                          &larr; Back to Activities
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowPublishModal(true)}
                          disabled={!validationSummary.isValid || isPublished}
                          className={`w-full sm:w-2/3 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl ${
                            !validationSummary.isValid
                              ? "bg-neutral-850 text-neutral-500 border border-neutral-800 cursor-not-allowed opacity-60"
                              : isPublished
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed"
                              : "bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white shadow-orange-500/20"
                          }`}
                        >
                          {isPublished ? (
                            <>
                              <CheckCircle2 size={16} className="text-emerald-400" />
                              <span>EVENT IS ALREADY PUBLISHED</span>
                            </>
                          ) : (
                            <>
                              <Send size={15} />
                              <span>PUBLISH EVENT (ALLOW ATTENDEES)</span>
                            </>
                          )}
                        </button>
                      </div>

                      {!validationSummary.isValid && (
                        <p className="text-[11px] text-neutral-500 text-center">
                          Resolve all highlighted checks above before publishing becomes available.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* MODAL 1: PUBLISH CONFIRMATION MODAL */}
      <AnimatePresence>
        {showPublishModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#0f0f14] border border-orange-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center mx-auto">
                  <Send size={22} />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  PUBLISH EVENT
                </h3>
                <p className="text-xs text-neutral-400">
                  Ready to make this event available for attendees to join?
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2.5 text-xs text-neutral-300">
                <div className="flex justify-between border-b border-neutral-800 pb-1.5">
                  <span className="text-neutral-500 uppercase font-bold">Event Title:</span>
                  <span className="text-white font-bold truncate max-w-[200px]">{eventTitle}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-1.5">
                  <span className="text-neutral-500 uppercase font-bold">Event Code:</span>
                  <span className="font-mono text-orange-400 font-bold">{eventCode}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-1.5">
                  <span className="text-neutral-500 uppercase font-bold">Room Type:</span>
                  <span className="text-white font-bold">{eventData?.roomType === "linkedin" ? "LinkedIn Room" : "Normal Room"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500 uppercase font-bold">Activities:</span>
                  <span className="text-emerald-400 font-bold">{validationSummary?.activityCount || 0} Ready</span>
                </div>
              </div>

              {/* Informational Guidance */}
              <div className="p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-left text-xs text-orange-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles size={14} className="text-orange-400" />
                  <span>What happens when you publish:</span>
                </div>
                <ul className="text-[11px] text-neutral-300 space-y-1 list-disc list-inside">
                  <li>Participants may now join via Event Code or QR code.</li>
                  <li>Participants will wait in the <strong>Waiting Room</strong>.</li>
                  <li>The live event and activities will <strong>NOT start</strong> until you launch it live.</li>
                </ul>
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
                  {actionError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  disabled={isPublishing}
                  className="w-1/2 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmPublish}
                  disabled={isPublishing}
                  className="w-1/2 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-black text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-50"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <Check size={15} className="stroke-[3]" />
                      <span>Confirm &amp; Publish</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: UNPUBLISH CONFIRMATION MODAL */}
      <AnimatePresence>
        {showUnpublishModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0f0f14] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <Lock size={22} />
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  REVERT TO DRAFT?
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Reverting to Draft will close the event to new participants until published again.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUnpublishModal(false)}
                  disabled={isUnpublishing}
                  className="w-1/2 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  Keep Published
                </button>

                <button
                  type="button"
                  onClick={handleConfirmUnpublish}
                  disabled={isUnpublishing}
                  className="w-1/2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {isUnpublishing ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Reverting...</span>
                    </>
                  ) : (
                    <span>Revert to Draft</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-900 bg-[#08080a] py-6 text-center text-xs text-neutral-500">
        ZERO2ONE EVENTS // Pre-Flight Validation Engine
      </footer>
    </div>
  );
}
