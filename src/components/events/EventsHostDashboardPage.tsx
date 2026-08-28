import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, 
  Radio, 
  LogOut, 
  ShieldCheck, 
  User as UserIcon, 
  Mail, 
  Sparkles,
  Loader2,
  Calendar,
  Clock,
  FileText,
  Type,
  Plus,
  Check,
  Copy,
  AlertCircle,
  QrCode,
  ArrowRight,
  Settings,
  Info,
  ExternalLink
} from "lucide-react";
import { auth, db, ALLOWED_ADMIN_EMAILS } from "../../lib/firebase";
import { generateUniqueEventCode } from "../../lib/eventCodeService";
import { EventJoinQRCode } from "./EventJoinQRCode";

export interface CreatedEventInfo {
  eventId: string;
  title: string;
  description: string;
  eventCode: string;
  date: string;
  time: string;
  status: string;
  acceptingParticipants: boolean;
  ownerId: string;
}

type DashboardView = "dashboard" | "create" | "success" | "setup-placeholder";

export function EventsHostDashboardPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);

  // View state
  const [currentView, setCurrentView] = useState<DashboardView>("dashboard");

  // Form State
  const [eventName, setEventName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [eventDate, setEventDate] = useState<string>(() => {
    // Default to today's ISO date string (YYYY-MM-DD)
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [eventTime, setEventTime] = useState<string>("10:00");

  // Validation & Submission State
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    description?: string;
    date?: string;
    time?: string;
    general?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Created Event Result
  const [createdEvent, setCreatedEvent] = useState<CreatedEventInfo | null>(null);

  // Copy Feedback States
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Verify host authentication on mount
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

  // Handle Form Validation
  const validateForm = (): boolean => {
    const errors: typeof formErrors = {};
    const trimmedName = eventName.trim();
    const trimmedDesc = description.trim();

    // Event Name Validation
    if (!trimmedName) {
      errors.name = "Event name is required.";
    } else if (trimmedName.length > 120) {
      errors.name = "Event name must be 120 characters or fewer.";
    }

    // Description Validation
    if (trimmedDesc.length > 800) {
      errors.description = "Description must be 800 characters or fewer.";
    }

    // Date Validation
    if (!eventDate) {
      errors.date = "Event date is required.";
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      errors.date = "Please provide a valid date format (YYYY-MM-DD).";
    }

    // Time Validation
    if (!eventTime) {
      errors.time = "Event time is required.";
    } else if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(eventTime)) {
      errors.time = "Please provide a valid time format (HH:MM).";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Event Creation
  const handleCreateEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!currentUser) {
      setFormErrors({ general: "Your session has expired. Please sign in again." });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      // 1. Generate unique collision-resistant event code
      const uniqueEventCode = await generateUniqueEventCode();

      // 2. Generate new Firestore document reference under events/{eventId}
      const newEventDocRef = doc(collection(db, "events"));
      const eventId = newEventDocRef.id;

      const trimmedTitle = eventName.trim();
      const trimmedDescription = description.trim();
      const isoDateTime = `${eventDate}T${eventTime}`;

      // 3. Construct canonical event document payload
      const eventPayload = {
        id: eventId,
        eventId: eventId,
        title: trimmedTitle,
        name: trimmedTitle, // Backwards compatibility for components referencing name
        description: trimmedDescription,
        eventCode: uniqueEventCode,
        code: uniqueEventCode, // Backwards compatibility for Feature 2A
        date: eventDate,
        time: eventTime,
        startDate: isoDateTime,
        endDate: isoDateTime,
        ownerId: currentUser.uid,
        createdBy: currentUser.email || currentUser.uid,
        status: "draft",
        acceptingParticipants: false,
        venue: "Campus / Online",
        banner: "",
        eventType: "public",
        roomType: "normal",
        participantCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // 4. Perform single Firestore document write
      await setDoc(newEventDocRef, eventPayload);

      // 5. Store created event state and transition to success view
      setCreatedEvent({
        eventId,
        title: trimmedTitle,
        description: trimmedDescription,
        eventCode: uniqueEventCode,
        date: eventDate,
        time: eventTime,
        status: "draft",
        acceptingParticipants: false,
        ownerId: currentUser.uid,
      });

      // Reset form fields
      setEventName("");
      setDescription("");
      setCurrentView("success");
    } catch (err: any) {
      console.error("Error creating event:", err);
      setFormErrors({
        general: err?.message || "Failed to create event. Please check your network and permissions."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy helper functions
  const handleCopyCode = async () => {
    if (!createdEvent?.eventCode) return;
    try {
      await navigator.clipboard.writeText(createdEvent.eventCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.warn("Clipboard write failed:", err);
    }
  };

  const handleCopyLink = async () => {
    if (!createdEvent?.eventCode) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const joinUrl = `${origin}/events/join?code=${encodeURIComponent(createdEvent.eventCode)}`;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.warn("Clipboard write failed:", err);
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

  if (isLoadingAuth || !currentUser) {
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

  const displayName = currentUser.displayName || currentUser.email?.split("@")[0] || "Organizer";
  const userEmail = currentUser.email || "No email";
  const isSuperAdmin = ALLOWED_ADMIN_EMAILS.includes(userEmail);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const createdJoinUrl = createdEvent?.eventCode ? `${origin}/events/join?code=${encodeURIComponent(createdEvent.eventCode)}` : "";

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-between selection:bg-orange-500/30 selection:text-orange-200 font-sans">
      {/* Top Bar */}
      <header className="w-full border-b border-neutral-900 bg-[#09090c]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (currentView !== "dashboard") {
                setCurrentView("dashboard");
              } else {
                navigate("/events");
              }
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            aria-label="Back to Events"
          >
            <ArrowLeft size={14} />
            <span>{currentView !== "dashboard" ? "Back to Dashboard" : "Back to Events"}</span>
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
          <AnimatePresence mode="wait">
            {/* VIEW 1: HOST DASHBOARD */}
            {currentView === "dashboard" && (
              <motion.div
                key="dashboard-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8"
              >
                {/* Title & Status Badge */}
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <ShieldCheck size={14} />
                    <span>Authenticated Organizer Session</span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                      ZERO2ONE EVENTS
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                      HOST DASHBOARD
                    </h1>
                    <p className="text-sm sm:text-base text-neutral-300 font-medium">
                      Welcome, <span className="text-orange-400 font-bold">{displayName}</span>
                    </p>
                  </div>
                </div>

                {/* Primary Action Button: CREATE EVENT */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormErrors({});
                      setCurrentView("create");
                    }}
                    className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2.5 shadow-xl shadow-orange-500/20"
                  >
                    <Plus size={18} className="stroke-[3]" />
                    <span>+ CREATE EVENT</span>
                  </button>
                </div>

                {/* Organizer Status Card */}
                <div className="p-5 rounded-2xl bg-[#14141a] border border-neutral-800 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                      <UserIcon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white uppercase tracking-tight flex items-center gap-2">
                        <span>{displayName}</span>
                        {isSuperAdmin && (
                          <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[9px] font-extrabold uppercase">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 truncate flex items-center gap-1.5 mt-0.5">
                        <Mail size={12} className="shrink-0 text-neutral-500" />
                        <span>{userEmail}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
                    <span>Access Status:</span>
                    <span className="font-semibold text-emerald-400">You are signed in as an organizer.</span>
                  </div>
                </div>

                {/* Return Hub Link */}
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => navigate("/events")}
                    className="text-xs font-bold text-neutral-400 hover:text-white uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    &larr; Return to Events Hub
                  </button>
                </div>
              </motion.div>
            )}

            {/* VIEW 2: CREATE EVENT FORM */}
            {currentView === "create" && (
              <motion.div
                key="create-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6"
              >
                {/* Header */}
                <div className="text-center space-y-2">
                  <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                    ZERO2ONE EVENTS
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                    CREATE EVENT
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-400 font-normal max-w-sm mx-auto">
                    Fill in the event details to generate your unique event code and join QR.
                  </p>
                </div>

                {/* General Error Notice */}
                {formErrors.general && (
                  <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{formErrors.general}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleCreateEvent} className="space-y-4">
                  {/* EVENT NAME */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Type size={13} className="text-orange-500" />
                        <span>Event Name <span className="text-orange-500">*</span></span>
                      </label>
                      <span className="text-[10px] font-mono text-neutral-500">
                        {eventName.length}/120
                      </span>
                    </div>
                    <input
                      type="text"
                      value={eventName}
                      onChange={(e) => {
                        setEventName(e.target.value);
                        if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                      }}
                      placeholder="e.g. Freshers 2026 Interactive Orientation"
                      maxLength={120}
                      disabled={isSubmitting}
                      className={`w-full px-4 py-3 rounded-xl bg-neutral-900 border text-white placeholder-neutral-500 text-sm font-medium focus:outline-none focus:ring-1 transition-all disabled:opacity-60 ${
                        formErrors.name 
                          ? "border-red-500/60 focus:border-red-500 focus:ring-red-500" 
                          : "border-neutral-800 focus:border-orange-500 focus:ring-orange-500"
                      }`}
                    />
                    {formErrors.name && (
                      <p className="text-[11px] text-red-400 font-medium mt-1">
                        {formErrors.name}
                      </p>
                    )}
                  </div>

                  {/* DESCRIPTION */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText size={13} className="text-orange-500" />
                        <span>Description <span className="text-neutral-500 font-normal lowercase">(optional)</span></span>
                      </label>
                      <span className="text-[10px] font-mono text-neutral-500">
                        {description.length}/800
                      </span>
                    </div>
                    <textarea
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        if (formErrors.description) setFormErrors({ ...formErrors, description: undefined });
                      }}
                      placeholder="Brief overview or instructions for attendees..."
                      rows={3}
                      maxLength={800}
                      disabled={isSubmitting}
                      className={`w-full px-4 py-3 rounded-xl bg-neutral-900 border text-white placeholder-neutral-500 text-sm font-medium focus:outline-none focus:ring-1 transition-all disabled:opacity-60 resize-none ${
                        formErrors.description 
                          ? "border-red-500/60 focus:border-red-500 focus:ring-red-500" 
                          : "border-neutral-800 focus:border-orange-500 focus:ring-orange-500"
                      }`}
                    />
                    {formErrors.description && (
                      <p className="text-[11px] text-red-400 font-medium mt-1">
                        {formErrors.description}
                      </p>
                    )}
                  </div>

                  {/* DATE & TIME ROW */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* DATE */}
                    <div className="space-y-1.5 text-left">
                      <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar size={13} className="text-orange-500" />
                        <span>Date <span className="text-orange-500">*</span></span>
                      </label>
                      <input
                        type="date"
                        value={eventDate}
                        onChange={(e) => {
                          setEventDate(e.target.value);
                          if (formErrors.date) setFormErrors({ ...formErrors, date: undefined });
                        }}
                        disabled={isSubmitting}
                        className={`w-full px-4 py-3 rounded-xl bg-neutral-900 border text-white text-sm font-medium focus:outline-none focus:ring-1 transition-all disabled:opacity-60 [color-scheme:dark] ${
                          formErrors.date 
                            ? "border-red-500/60 focus:border-red-500 focus:ring-red-500" 
                            : "border-neutral-800 focus:border-orange-500 focus:ring-orange-500"
                        }`}
                      />
                      {formErrors.date && (
                        <p className="text-[11px] text-red-400 font-medium mt-1">
                          {formErrors.date}
                        </p>
                      )}
                    </div>

                    {/* TIME */}
                    <div className="space-y-1.5 text-left">
                      <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock size={13} className="text-orange-500" />
                        <span>Time <span className="text-orange-500">*</span></span>
                      </label>
                      <input
                        type="time"
                        value={eventTime}
                        onChange={(e) => {
                          setEventTime(e.target.value);
                          if (formErrors.time) setFormErrors({ ...formErrors, time: undefined });
                        }}
                        disabled={isSubmitting}
                        className={`w-full px-4 py-3 rounded-xl bg-neutral-900 border text-white text-sm font-medium focus:outline-none focus:ring-1 transition-all disabled:opacity-60 [color-scheme:dark] ${
                          formErrors.time 
                            ? "border-red-500/60 focus:border-red-500 focus:ring-red-500" 
                            : "border-neutral-800 focus:border-orange-500 focus:ring-orange-500"
                        }`}
                      />
                      {formErrors.time && (
                        <p className="text-[11px] text-red-400 font-medium mt-1">
                          {formErrors.time}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Submission note */}
                  <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 text-[11px] text-neutral-400 flex items-start gap-2">
                    <Info size={14} className="text-orange-400 shrink-0 mt-0.5" />
                    <span>The event will be created in <strong>DRAFT</strong> status and will remain closed to participants until you open it.</span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col-reverse sm:flex-row items-center gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setCurrentView("dashboard")}
                      disabled={isSubmitting}
                      className="w-full sm:w-1/3 py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-2/3 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Creating Event...</span>
                        </>
                      ) : (
                        <>
                          <Plus size={15} />
                          <span>Create Event</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* VIEW 3: EVENT CREATION SUCCESS */}
            {currentView === "success" && createdEvent && (
              <motion.div
                key="success-view"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 text-center"
              >
                {/* Header Badge */}
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <Check size={14} className="stroke-[3]" />
                    <span>Event Created Successfully</span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                    {createdEvent.title}
                  </h2>

                  {/* Status & Participants indicator */}
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md bg-neutral-800 text-neutral-300 border border-neutral-700">
                      Status: <strong className="text-amber-400 uppercase">{createdEvent.status}</strong>
                    </span>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md bg-neutral-800 text-neutral-300 border border-neutral-700">
                      Participants: <strong className="text-neutral-400">0 (Closed)</strong>
                    </span>
                  </div>
                </div>

                {/* Event Code Display */}
                <div className="p-4 rounded-2xl bg-[#14141a] border border-neutral-800/90 space-y-2">
                  <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest">
                    EVENT CODE
                  </span>
                  <div className="text-2xl sm:text-3xl font-mono font-black text-orange-400 tracking-wider">
                    {createdEvent.eventCode}
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Participants can enter this code at <strong className="text-neutral-400">/events/join</strong>
                  </p>
                </div>

                {/* Reusable QR Component */}
                <div className="flex justify-center">
                  <EventJoinQRCode
                    eventCode={createdEvent.eventCode}
                    eventId={createdEvent.eventId}
                    eventName={createdEvent.title}
                    size={180}
                    showDetails={false}
                    className="max-w-xs"
                  />
                </div>

                {/* Join Link Display */}
                <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-left space-y-1">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    Direct Join URL
                  </span>
                  <div className="text-xs font-mono text-neutral-300 break-all select-all">
                    {createdJoinUrl}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-200 hover:text-white border border-neutral-800 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {copiedCode ? (
                        <>
                          <Check size={14} className="text-emerald-400" />
                          <span className="text-emerald-400">Code Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copy Event Code</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-200 hover:text-white border border-neutral-800 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {copiedLink ? (
                        <>
                          <Check size={14} className="text-emerald-400" />
                          <span className="text-emerald-400">Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <ExternalLink size={14} />
                          <span>Copy Join Link</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Continue to Event Setup */}
                  <button
                    type="button"
                    onClick={() => {
                      if (createdEvent?.eventId) {
                        navigate(`/events/host/events/${createdEvent.eventId}/setup`);
                      }
                    }}
                    className="w-full py-3.5 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                  >
                    <span>Continue to Event Setup</span>
                    <ArrowRight size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentView("dashboard")}
                    className="w-full py-2.5 text-neutral-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Return to Host Dashboard
                  </button>
                </div>
              </motion.div>
            )}

            {/* VIEW 4: SETUP PLACEHOLDER (Feature Boundary) */}
            {currentView === "setup-placeholder" && (
              <motion.div
                key="setup-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto">
                  <Settings size={26} />
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                    ZERO2ONE EVENTS // NEXT FEATURE
                  </div>
                  <h2 className="text-2xl font-black text-white tracking-tight uppercase">
                    EVENT SETUP
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
                    Your event has been saved in <strong className="text-white">DRAFT</strong> mode. Activity builders (Quizzes, Crosswords, Riddles) and live session controls will be configured in the next update.
                  </p>
                </div>

                {createdEvent && (
                  <div className="p-4 rounded-2xl bg-[#14141a] border border-neutral-800 text-left space-y-1.5 max-w-sm mx-auto">
                    <div className="text-xs font-bold text-white uppercase truncate">
                      {createdEvent.title}
                    </div>
                    <div className="text-xs text-orange-400 font-mono font-bold">
                      Code: {createdEvent.eventCode}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      Scheduled: {createdEvent.date} at {createdEvent.time}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentView("dashboard")}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Back to Host Dashboard
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormErrors({});
                      setCurrentView("create");
                    }}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    + Create Another Event
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-900 bg-[#08080a] py-6 text-center text-xs text-neutral-500">
        ZERO2ONE EVENTS // Organizer Portal
      </footer>
    </div>
  );
}
