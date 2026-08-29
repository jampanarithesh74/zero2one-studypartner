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
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Wrench,
  Settings,
  Layers,
  AlertCircle,
  HelpCircle,
  Puzzle,
  FileQuestion,
  CheckCircle2,
  X,
  Clock,
  Sparkles,
  Info,
  Calendar,
  Save,
  RotateCcw,
  AlertTriangle,
  GripVertical
} from "lucide-react";
import { auth, db, ALLOWED_ADMIN_EMAILS } from "../../lib/firebase";
import {
  EventActivity,
  ActivityType,
  ACTIVITY_METADATA,
  getEventActivities,
  createEventActivity,
  saveActivitySequence,
  deleteEventActivity
} from "../../services/eventActivityService";

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
  createdAt?: any;
  updatedAt?: any;
}

export function EventsHostActivitiesPage() {
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

  // Activities State
  const [activities, setActivities] = useState<EventActivity[]>([]);
  const [initialActivities, setInitialActivities] = useState<EventActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState<boolean>(true);
  const [isSavingSequence, setIsSavingSequence] = useState<boolean>(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedTypeToAdd, setSelectedTypeToAdd] = useState<ActivityType>("quiz");
  const [customTitleInput, setCustomTitleInput] = useState<string>("");
  const [isCreatingActivity, setIsCreatingActivity] = useState<boolean>(false);

  const [configureNoticeActivity, setConfigureNoticeActivity] = useState<EventActivity | null>(null);
  const [deleteConfirmActivity, setDeleteConfirmActivity] = useState<EventActivity | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Unsaved Changes Navigation Guard
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // Helper to compute whether current sequence differs from initial
  const isDirty = (() => {
    if (activities.length !== initialActivities.length) return false;
    for (let i = 0; i < activities.length; i++) {
      if (activities[i].id !== initialActivities[i]?.id) {
        return true;
      }
    }
    return false;
  })();

  const changedCount = (() => {
    if (!isDirty) return 0;
    const initialMap = new Map<string, number>();
    initialActivities.forEach((act, idx) => initialMap.set(act.id, idx + 1));
    return activities.filter((act, idx) => initialMap.get(act.id) !== idx + 1).length;
  })();

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

  // 2. Unsaved Changes BeforeUnload Listener
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved activity sequence changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // 3. Load Event & Activities Data (Single point query on mount)
  useEffect(() => {
    if (!currentUser || !eventId) return;

    let isMounted = true;

    async function loadData() {
      setIsLoadingEvent(true);
      setIsLoadingActivities(true);
      setLoadError(null);

      try {
        // Point read on event document
        const eventDocRef = doc(db, "events", eventId);
        const eventSnap = await getDoc(eventDocRef);

        if (!eventSnap.exists()) {
          if (isMounted) {
            setLoadError({
              type: "not-found",
              message: "The requested event could not be found or has been deleted.",
            });
            setIsLoadingEvent(false);
            setIsLoadingActivities(false);
          }
          return;
        }

        const data = { id: eventSnap.id, ...eventSnap.data() } as EventData;

        // Check ownership
        const email = currentUser.email || "";
        const isAdminUser = ALLOWED_ADMIN_EMAILS.includes(email);
        const isOwner = data.ownerId === currentUser.uid;

        if (!isOwner && !isAdminUser) {
          if (isMounted) {
            setLoadError({
              type: "unauthorized",
              message: "You are not authorized to manage activities for this event. Only the event creator or an authorized administrator may access this section.",
            });
            setIsLoadingEvent(false);
            setIsLoadingActivities(false);
          }
          return;
        }

        if (isMounted) {
          setEventData(data);
          setIsLoadingEvent(false);
        }

        // Point query on activities collection (already sorted by order ASC)
        const loadedActivities = await getEventActivities(eventId);
        if (isMounted) {
          setActivities(loadedActivities);
          setInitialActivities(loadedActivities);
          setIsLoadingActivities(false);
        }
      } catch (err: any) {
        console.error("Error loading event activities:", err);
        if (isMounted) {
          setLoadError({
            type: "network",
            message: "Failed to load event data. Please check your connection and try again.",
          });
          setIsLoadingEvent(false);
          setIsLoadingActivities(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [currentUser, eventId]);

  // Safe navigation handler
  const handleSafeNavigate = useCallback(
    (path: string) => {
      if (isDirty) {
        setPendingNavPath(path);
        setShowUnsavedModal(true);
      } else {
        navigate(path);
      }
    },
    [isDirty, navigate]
  );

  // Handle Sign Out
  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut(auth);
      navigate("/events/host");
    } catch (err) {
      console.error("Error signing out:", err);
      setIsSigningOut(false);
    }
  };

  // Handle Add Activity
  const handleCreateActivity = async () => {
    if (!eventId) return;

    setIsCreatingActivity(true);
    try {
      const newAct = await createEventActivity(
        eventId,
        selectedTypeToAdd,
        customTitleInput.trim() || undefined
      );

      const updated = [...activities, newAct];
      setActivities(updated);
      setInitialActivities(updated);
      setShowAddModal(false);
      setCustomTitleInput("");
      showToast(`${ACTIVITY_METADATA[selectedTypeToAdd].label} added to event sequence`, "success");
    } catch (err: any) {
      console.error("Error creating activity:", err);
      showToast("Failed to create activity. Please try again.", "error");
    } finally {
      setIsCreatingActivity(false);
    }
  };

  // Handle Local Move Up / Move Down (Pure state mutation, no Firestore write)
  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activities.length) return;

    const updated = [...activities];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Normalize local 1-based order
    const normalized = updated.map((act, i) => ({
      ...act,
      order: i + 1,
    }));

    setActivities(normalized);
  };

  // Handle Reset / Discard local sequence changes
  const handleResetSequence = () => {
    setActivities(initialActivities);
    showToast("Sequence changes discarded.", "info");
  };

  // Handle Save Sequence (Atomic Batch Write to Firestore)
  const handleSaveSequence = async () => {
    if (!eventId || isSavingSequence) return;

    if (!isDirty) {
      showToast("Sequence is already up to date.", "info");
      return;
    }

    setIsSavingSequence(true);

    try {
      const result = await saveActivitySequence(eventId, activities, initialActivities);

      if (!result.success) {
        throw new Error(result.error || "Failed to commit sequence order changes.");
      }

      // Sync initial activities with the newly committed sequence
      const normalized = activities.map((act, i) => ({
        ...act,
        order: i + 1,
      }));
      setActivities(normalized);
      setInitialActivities(normalized);

      showToast(
        `Sequence saved successfully! (${result.updatedCount} ${
          result.updatedCount === 1 ? "activity" : "activities"
        } updated)`,
        "success"
      );
    } catch (err: any) {
      console.error("Failed to save activity sequence:", err);
      showToast(err.message || "Failed to save sequence. Please try again.", "error");
    } finally {
      setIsSavingSequence(false);
    }
  };

  // Handle Delete Activity
  const handleDeleteConfirm = async () => {
    if (!eventId || !deleteConfirmActivity || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteEventActivity(eventId, deleteConfirmActivity.id, activities);
      const remaining = activities
        .filter((a) => a.id !== deleteConfirmActivity.id)
        .map((a, i) => ({ ...a, order: i + 1 }));

      setActivities(remaining);
      setInitialActivities(remaining);
      showToast(`${deleteConfirmActivity.title} removed from sequence`, "success");
      setDeleteConfirmActivity(null);
    } catch (err: any) {
      console.error("Failed to delete activity:", err);
      showToast("Failed to remove activity. Please try again.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Render Activity Icon
  const renderActivityIcon = (type: ActivityType) => {
    switch (type) {
      case "quiz":
        return <span className="text-xl">🧠</span>;
      case "crossword":
        return <span className="text-xl">🧩</span>;
      case "riddle":
        return <span className="text-xl">❓</span>;
      default:
        return <span className="text-xl">⚡</span>;
    }
  };

  // 1. AUTH LOADING
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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSafeNavigate(`/events/host/events/${eventId}/setup`)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              aria-label="Back to Setup"
            >
              <ArrowLeft size={14} />
              <span>Back to Setup</span>
            </button>

            <button
              type="button"
              onClick={() => handleSafeNavigate("/events/host/dashboard")}
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
          {/* Toast Notification */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-xl ${
                  toastMessage.type === "error"
                    ? "bg-red-950/80 border-red-500/50 text-red-200 shadow-red-500/10"
                    : toastMessage.type === "info"
                    ? "bg-neutral-900 border-neutral-700 text-neutral-300 shadow-neutral-900/50"
                    : "bg-neutral-900 border-orange-500/40 text-orange-200 shadow-orange-500/5"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {toastMessage.type === "error" ? (
                    <AlertCircle size={16} className="text-red-400 shrink-0" />
                  ) : toastMessage.type === "info" ? (
                    <Info size={16} className="text-neutral-400 shrink-0" />
                  ) : (
                    <Sparkles size={16} className="text-orange-400 shrink-0" />
                  )}
                  <span>{toastMessage.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setToastMessage(null)}
                  className="text-neutral-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Unsaved Changes Banner */}
          <AnimatePresence>
            {isDirty && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-amber-500/5">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    <span className="text-xs font-bold">
                      You have unsaved activity sequence changes ({changedCount} {changedCount === 1 ? "position modified" : "positions modified"}).
                    </span>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={handleResetSequence}
                      disabled={isSavingSequence}
                      className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold border border-neutral-700 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw size={12} />
                      <span>Discard</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSequence}
                      disabled={isSavingSequence}
                      className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                    >
                      {isSavingSequence ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Save size={12} />
                      )}
                      <span>Save Sequence</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* STATE 1: LOADING EVENT */}
          {isLoadingEvent && (
            <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-10 sm:p-14 shadow-2xl text-center space-y-4">
              <Loader2 size={36} className="text-orange-500 animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white uppercase tracking-wider">
                  Loading Event Activities...
                </p>
                <p className="text-xs text-neutral-500">
                  Retrieving activity sequences from event schema.
                </p>
              </div>
            </div>
          )}

          {/* STATE 2: ERROR SCREEN */}
          {!isLoadingEvent && loadError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
                <ShieldAlert size={28} />
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-black text-white uppercase tracking-tight">
                  {loadError.type === "unauthorized" ? "Unauthorized Access" : "Error Loading Activities"}
                </h2>
                <p className="text-xs text-neutral-400 leading-relaxed max-w-md mx-auto">
                  {loadError.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate("/events/host/dashboard")}
                className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-lg shadow-orange-500/20"
              >
                Return to Dashboard
              </button>
            </motion.div>
          )}

          {/* STATE 3: ACTIVITIES MANAGER CONTENT */}
          {!isLoadingEvent && !loadError && eventData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Event Context Header */}
              <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4">
                {/* Navigation Tabs between Setup & Activities */}
                <div className="flex items-center gap-2 pb-4 border-b border-neutral-850">
                  <button
                    type="button"
                    onClick={() => handleSafeNavigate(`/events/host/events/${eventId}/setup`)}
                    className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-white border border-neutral-800 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Settings size={13} />
                    <span>1. Room Setup</span>
                  </button>

                  <div className="px-3.5 py-1.5 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/30 text-xs font-bold flex items-center gap-1.5">
                    <Layers size={13} />
                    <span>2. Activities Manager</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-400 uppercase">
                        EVENT ARCHITECTURE
                      </span>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-neutral-850 text-neutral-300 border border-neutral-750">
                        {eventStatus}
                      </span>
                      {eventData.roomType && (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          {eventData.roomType} room
                        </span>
                      )}
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
                      {eventTitle}
                    </h1>
                  </div>

                  <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-2xl px-3.5 py-2 self-start sm:self-auto">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                      CODE:
                    </span>
                    <span className="text-xs font-mono font-black text-orange-400 tracking-wider">
                      {eventCode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Activities Section Card */}
              <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-850">
                  <div className="space-y-0.5">
                    <h2 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                      <Layers size={18} className="text-orange-500" />
                      <span>EVENT SEQUENCE BUILDER</span>
                    </h2>
                    <p className="text-xs text-neutral-400">
                      Arrange the exact sequence in which activities will run during your event.
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 self-start sm:self-center">
                    {/* SAVE SEQUENCE BUTTON */}
                    <button
                      type="button"
                      onClick={handleSaveSequence}
                      disabled={isSavingSequence || !isDirty}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg ${
                        isDirty
                          ? "bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20 animate-pulse"
                          : "bg-neutral-850 text-neutral-500 border border-neutral-800 cursor-not-allowed opacity-60"
                      }`}
                      title={isDirty ? "Save sequence changes" : "No changes to save"}
                    >
                      {isSavingSequence ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save size={15} />
                          <span>Save Sequence</span>
                        </>
                      )}
                    </button>

                    {/* ADD ACTIVITY BUTTON */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTypeToAdd("quiz");
                        setCustomTitleInput("");
                        setShowAddModal(true);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/20 shrink-0"
                    >
                      <Plus size={15} className="stroke-[3]" />
                      <span>+ ADD ACTIVITY</span>
                    </button>
                  </div>
                </div>

                {/* ACTIVITIES LIST */}
                {isLoadingActivities ? (
                  <div className="py-12 text-center space-y-3">
                    <Loader2 size={28} className="text-orange-500 animate-spin mx-auto" />
                    <p className="text-xs text-neutral-400">Loading activities...</p>
                  </div>
                ) : activities.length === 0 ? (
                  /* EMPTY STATE */
                  <div className="py-12 px-6 rounded-2xl bg-neutral-900/40 border border-dashed border-neutral-800 text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-850 border border-neutral-750 text-neutral-400 flex items-center justify-center mx-auto">
                      <Layers size={24} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">
                        NO ACTIVITIES IN SEQUENCE
                      </h3>
                      <p className="text-xs text-neutral-400">
                        Add quizzes, crosswords, or riddles to compose your event sequence.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTypeToAdd("quiz");
                        setCustomTitleInput("");
                        setShowAddModal(true);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-orange-500/20"
                    >
                      <Plus size={15} className="stroke-[3]" />
                      <span>+ ADD ACTIVITY</span>
                    </button>
                  </div>
                ) : (
                  /* NON-EMPTY LIST */
                  <div className="space-y-3">
                    {activities.map((activity, index) => {
                      const isFirst = index === 0;
                      const isLast = index === activities.length - 1;

                      // Check if this item's position changed compared to initial
                      const initialIndex = initialActivities.findIndex((a) => a.id === activity.id);
                      const isPositionChanged = initialIndex !== -1 && initialIndex !== index;

                      return (
                        <div
                          key={activity.id}
                          className={`group relative rounded-2xl p-4 sm:p-5 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border ${
                            isPositionChanged
                              ? "bg-[#16151c] border-amber-500/40 shadow-md shadow-amber-500/5"
                              : "bg-[#121217] border-neutral-800 hover:border-neutral-700"
                          }`}
                        >
                          {/* Left Details */}
                          <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                            {/* Sequence Number / Handle */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div
                                className={`w-8 h-8 rounded-xl border font-mono font-black text-xs flex items-center justify-center ${
                                  isPositionChanged
                                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                                    : "bg-neutral-850 border-neutral-750 text-neutral-300"
                                }`}
                              >
                                {index + 1}
                              </div>
                            </div>

                            {/* Icon */}
                            <div className="w-10 h-10 rounded-xl bg-[#181820] border border-neutral-750 flex items-center justify-center shrink-0 shadow-inner">
                              {renderActivityIcon(activity.type)}
                            </div>

                            {/* Title & Info */}
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-black text-white uppercase tracking-tight truncate">
                                  {activity.title}
                                </h4>
                                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                                  {activity.type}
                                </span>
                                {activity.type === "quiz" && typeof activity.config?.questionCount === "number" && activity.config.questionCount > 0 && (
                                  <span className="text-[9px] font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                                    {activity.config.questionCount} Questions
                                  </span>
                                )}
                                {activity.type === "crossword" && typeof activity.config?.clueCount === "number" && activity.config.clueCount > 0 && (
                                  <span className="text-[9px] font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                                    {activity.config.clueCount} Clues ({activity.config.gridRows}×{activity.config.gridCols})
                                  </span>
                                )}
                                {activity.type === "riddle" && typeof activity.config?.riddleCount === "number" && activity.config.riddleCount > 0 && (
                                  <span className="text-[9px] font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                                    {activity.config.riddleCount} Riddles ({activity.config.totalPoints || 0} pts)
                                  </span>
                                )}
                                <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                  activity.status === "ready"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                }`}>
                                  {activity.status}
                                </span>
                                {isPositionChanged && (
                                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Moved (was #{initialIndex + 1})
                                  </span>
                                )}
                              </div>
                              {activity.description && (
                                <p className="text-xs text-neutral-400 truncate font-normal">
                                  {activity.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right Controls */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {/* Move Controls (Reorder locally) */}
                            <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl p-0.5">
                              <button
                                type="button"
                                onClick={() => handleMove(index, "up")}
                                disabled={isFirst}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer"
                                title="Move Up"
                                aria-label="Move Up"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMove(index, "down")}
                                disabled={isLast}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer"
                                title="Move Down"
                                aria-label="Move Down"
                              >
                                <ArrowDown size={14} />
                              </button>
                            </div>

                            {/* Configure Button */}
                            <button
                              type="button"
                              onClick={() => {
                                let targetRoute = "";
                                if (activity.type === "quiz") {
                                  targetRoute = `/events/host/events/${eventId}/activities/${activity.id}/quiz`;
                                } else if (activity.type === "crossword") {
                                  targetRoute = `/events/host/events/${eventId}/activities/${activity.id}/crossword`;
                                } else if (activity.type === "riddle") {
                                  targetRoute = `/events/host/events/${eventId}/activities/${activity.id}/riddle`;
                                }

                                if (targetRoute) {
                                  handleSafeNavigate(targetRoute);
                                } else {
                                  setConfigureNoticeActivity(activity);
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl bg-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-750 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <Wrench size={12} className="text-orange-400" />
                              <span>Configure →</span>
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmActivity(activity)}
                              className="p-2 rounded-xl bg-neutral-900 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-neutral-500 border border-neutral-800 text-xs transition-all cursor-pointer"
                              title="Delete Activity"
                              aria-label="Delete Activity"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Sequence Guidance */}
                <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-left text-[11px] text-neutral-400 flex items-start gap-2.5">
                  <Info size={15} className="text-orange-400 shrink-0 mt-0.5" />
                  <span>
                    Use the <strong>↑</strong> and <strong>↓</strong> buttons to organize the sequence. Activities will be executed in this order when running the live event. Click <strong>Save Sequence</strong> to persist changes.
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* MODAL 1: ADD ACTIVITY MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-[#0f0f14] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between pb-3 border-b border-neutral-850">
                <div className="space-y-0.5">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">
                    ADD ACTIVITY
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Choose an activity type to add to your sequence:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-850 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Activity Type Selection */}
              <div className="grid grid-cols-1 gap-3">
                {(["quiz", "crossword", "riddle"] as ActivityType[]).map((type) => {
                  const meta = ACTIVITY_METADATA[type];
                  const isSelected = selectedTypeToAdd === type;

                  return (
                    <div
                      key={type}
                      onClick={() => setSelectedTypeToAdd(type)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                        isSelected
                          ? "bg-[#181822] border-orange-500 ring-1 ring-orange-500/50 shadow-md shadow-orange-500/10"
                          : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-750 hover:bg-neutral-850/50"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-neutral-850 border border-neutral-750 flex items-center justify-center shrink-0">
                        {renderActivityIcon(type)}
                      </div>

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black text-white uppercase tracking-tight">
                            {meta.label}
                          </h4>
                          {isSelected && (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-400 leading-relaxed font-normal">
                          {meta.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Optional Custom Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  Activity Title (Optional)
                </label>
                <input
                  type="text"
                  value={customTitleInput}
                  onChange={(e) => setCustomTitleInput(e.target.value)}
                  placeholder={ACTIVITY_METADATA[selectedTypeToAdd].defaultTitle}
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isCreatingActivity}
                  className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateActivity}
                  disabled={isCreatingActivity}
                  className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-50"
                >
                  {isCreatingActivity ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} className="stroke-[3]" />
                      <span>Add Activity</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: UNSAVED CHANGES CONFIRMATION MODAL */}
      <AnimatePresence>
        {showUnsavedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0f0f14] border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <AlertTriangle size={22} />
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  UNSAVED SEQUENCE CHANGES
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  You have re-ordered activities without saving. If you leave now, your new sequence order will be lost.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    await handleSaveSequence();
                    setShowUnsavedModal(false);
                    if (pendingNavPath) {
                      navigate(pendingNavPath);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  Save & Continue
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowUnsavedModal(false);
                    if (pendingNavPath) {
                      navigate(pendingNavPath);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-white border border-neutral-800 text-xs font-semibold transition-all cursor-pointer"
                >
                  Discard Changes & Leave
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowUnsavedModal(false);
                    setPendingNavPath(null);
                  }}
                  className="w-full py-2 rounded-xl text-neutral-500 hover:text-neutral-400 text-xs transition-all cursor-pointer"
                >
                  Stay on Page
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: CONFIGURE NOTICE MODAL (Placeholder for future builders) */}
      <AnimatePresence>
        {configureNoticeActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0f0f14] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center mx-auto">
                <Wrench size={22} />
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  {configureNoticeActivity.type.toUpperCase()} BUILDER
                </h3>
                <p className="text-xs text-neutral-300 font-semibold">
                  {ACTIVITY_METADATA[configureNoticeActivity.type].label} Builder
                </p>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  This activity is staged in <strong>DRAFT</strong> status with ID: <span className="font-mono text-neutral-400">{configureNoticeActivity.activityId}</span>.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConfigureNoticeActivity(null)}
                className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-lg shadow-orange-500/20"
              >
                Understood
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deleteConfirmActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0f0f14] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
                <Trash2 size={22} />
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  REMOVE ACTIVITY?
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Are you sure you want to remove <strong className="text-white">{deleteConfirmActivity.title}</strong> from the event sequence? Remaining activities will be automatically re-sequenced.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmActivity(null)}
                  disabled={isDeleting}
                  className="w-1/2 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="w-1/2 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-red-500/20 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Removing...</span>
                    </>
                  ) : (
                    <span>Delete</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-900 bg-[#08080a] py-6 text-center text-xs text-neutral-500">
        ZERO2ONE EVENTS // Sequence Builder
      </footer>
    </div>
  );
}
