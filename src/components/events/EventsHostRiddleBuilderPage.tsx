import { useState, useEffect, useMemo } from "react";
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
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Award,
  Sparkles,
  HelpCircle,
  Copy,
  FolderOpen,
  Calendar,
  Layers,
  ChevronRight,
  RotateCcw,
  Check,
  X,
  Lightbulb,
  FileQuestion,
  Eye,
  Info,
  Lock,
  Tag
} from "lucide-react";
import { auth, db, ALLOWED_ADMIN_EMAILS } from "../../lib/firebase";
import { EventActivity } from "../../services/eventActivityService";
import {
  GenericRiddleEntry,
  RiddleBuilderData,
  getRiddleBuilderData,
  createBlankRiddle,
  sanitizeRiddleAnswer,
  validateRiddleEntries,
  saveRiddleConfiguration,
  RiddleValidationError,
  generateRiddleEntryId,
} from "../../services/riddleBuilderService";

interface EventSummary {
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
}

const PRESET_TIMES = [10, 15, 20, 30, 45, 60];
const PRESET_POINTS = [50, 100, 150, 200];

export function EventsHostRiddleBuilderPage() {
  const { eventId, activityId } = useParams<{ eventId: string; activityId: string }>();
  const navigate = useNavigate();

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);

  // Event & Activity State
  const [eventData, setEventData] = useState<EventSummary | null>(null);
  const [activityData, setActivityData] = useState<EventActivity | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<{
    type: "not-found" | "unauthorized" | "network";
    message: string;
  } | null>(null);

  // Riddle Form State (Local React State - 0 writes per keystroke)
  const [riddleTitle, setRiddleTitle] = useState<string>("");
  const [riddleDescription, setRiddleDescription] = useState<string>("");
  const [riddleStatus, setRiddleStatus] = useState<"draft" | "ready">("draft");
  const [riddles, setRiddles] = useState<GenericRiddleEntry[]>([]);
  const [deletedRiddleIds, setDeletedRiddleIds] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // UI View Modes & Modals
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
  const [previewRiddleIndex, setPreviewRiddleIndex] = useState<number>(0);
  const [previewLetters, setPreviewLetters] = useState<string[]>([]);
  const [previewShowHint, setPreviewShowHint] = useState<boolean>(false);
  const [previewShowExplanation, setPreviewShowExplanation] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [saveErrorNotice, setSaveErrorNotice] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<RiddleValidationError[]>([]);
  const [globalValidationErrors, setGlobalValidationErrors] = useState<string[]>([]);
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);
  const [pendingNavigationPath, setPendingNavigationPath] = useState<string | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

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

  // 2. Load Event & Riddle Data (Single point-in-time read)
  useEffect(() => {
    if (!currentUser || !eventId || !activityId) return;

    let isMounted = true;

    async function loadRiddleData() {
      setIsLoading(true);
      setLoadError(null);

      try {
        // Point read on event document
        const eventDocRef = doc(db, "events", eventId);
        const eventSnap = await getDoc(eventDocRef);

        if (!eventSnap.exists()) {
          if (isMounted) {
            setLoadError({
              type: "not-found",
              message: "The requested event could not be found.",
            });
            setIsLoading(false);
          }
          return;
        }

        const rawEvent = eventSnap.data() as EventSummary;
        const eventOwnerId = rawEvent.ownerId;
        const currentUid = currentUser.uid;
        const userEmail = currentUser.email || "";
        const isAdmin = ALLOWED_ADMIN_EMAILS.includes(userEmail);

        // Security check: Only event owner or admin can configure
        if (eventOwnerId && eventOwnerId !== currentUid && !isAdmin) {
          if (isMounted) {
            setLoadError({
              type: "unauthorized",
              message: "You do not have host permissions for this event.",
            });
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setEventData({
            id: eventSnap.id,
            ...rawEvent,
          });
        }

        // Point read on Riddle Activity metadata and Riddle entries subcollection
        const riddleData: RiddleBuilderData | null = await getRiddleBuilderData(
          eventId,
          activityId
        );

        if (!riddleData) {
          if (isMounted) {
            setLoadError({
              type: "not-found",
              message: "The requested riddle activity does not exist.",
            });
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setActivityData(riddleData.activity);
          setRiddleTitle(riddleData.activity.title || "Engineering Riddles");
          setRiddleDescription(riddleData.activity.description || "");
          setRiddleStatus(
            riddleData.activity.status === "ready" ? "ready" : "draft"
          );

          // If no riddles exist yet, seed with 1 blank riddle template
          if (riddleData.riddles.length === 0) {
            const initialRiddle = createBlankRiddle(eventId, activityId, 1);
            setRiddles([initialRiddle]);
          } else {
            setRiddles(riddleData.riddles);
          }

          setIsDirty(false);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error("Error loading riddle builder data:", err);
        if (isMounted) {
          setLoadError({
            type: "network",
            message: "Failed to load riddle configuration. Please check your connection.",
          });
          setIsLoading(false);
        }
      }
    }

    loadRiddleData();

    return () => {
      isMounted = false;
    };
  }, [currentUser, eventId, activityId]);

  // Synchronize preview letter boxes when preview riddle changes
  useEffect(() => {
    const curRiddle = riddles[previewRiddleIndex] || riddles[0];
    if (curRiddle) {
      const len = sanitizeRiddleAnswer(curRiddle.answer).length;
      setPreviewLetters(Array(Math.max(len, 0)).fill(""));
    }
    setPreviewShowHint(false);
    setPreviewShowExplanation(false);
  }, [previewRiddleIndex, riddles]);

  // Handle browser back/refresh guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Navigation interceptor with dirty check
  const handleSafeNavigate = (targetPath: string) => {
    if (isDirty) {
      setPendingNavigationPath(targetPath);
      setShowUnsavedModal(true);
    } else {
      navigate(targetPath);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut(auth);
      navigate("/events/host", { replace: true });
    } catch (err) {
      console.error("Sign out error:", err);
      setIsSigningOut(false);
    }
  };

  // Real-time Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalRiddles = riddles.length;
    const totalPoints = riddles.reduce((acc, r) => acc + (Number(r.points) || 0), 0);
    const totalTimeSec = riddles.reduce((acc, r) => acc + (Number(r.timeLimitSec) || 0), 0);

    return { totalRiddles, totalPoints, totalTimeSec };
  }, [riddles]);

  // Local Form Mutations (0 Firestore writes per keystroke)
  const handleTitleChange = (val: string) => {
    setRiddleTitle(val);
    setIsDirty(true);
    setSaveErrorNotice(null);
  };

  const handleDescriptionChange = (val: string) => {
    setRiddleDescription(val);
    setIsDirty(true);
    setSaveErrorNotice(null);
  };

  const handleStatusToggle = (newStatus: "draft" | "ready") => {
    setRiddleStatus(newStatus);
    setIsDirty(true);
    setSaveErrorNotice(null);
  };

  const handleRiddleFieldChange = (
    index: number,
    field: keyof GenericRiddleEntry,
    value: any
  ) => {
    setRiddles((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
    setIsDirty(true);
    setSaveErrorNotice(null);
  };

  const handleAddRiddle = () => {
    if (!eventId || !activityId) return;
    const nextOrder = riddles.length + 1;
    const newRiddle = createBlankRiddle(eventId, activityId, nextOrder);
    setRiddles((prev) => [...prev, newRiddle]);
    setIsDirty(true);
    setSaveErrorNotice(null);
  };

  const handleDuplicateRiddle = (index: number) => {
    if (!eventId || !activityId) return;
    const source = riddles[index];
    if (!source) return;

    const newId = generateRiddleEntryId();
    const duplicated: GenericRiddleEntry = {
      ...source,
      id: newId,
      entryId: newId,
      title: `${source.title || "Riddle"} (Copy)`,
      order: index + 2,
    };

    setRiddles((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, duplicated);
      // Re-sequence order
      return next.map((r, i) => ({ ...r, order: i + 1 }));
    });
    setIsDirty(true);
    setSaveErrorNotice(null);
  };

  const handleDeleteRiddle = (index: number) => {
    const target = riddles[index];
    if (!target) return;

    if (target.id) {
      setDeletedRiddleIds((prev) => [...prev, target.id]);
    }

    setRiddles((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((r, i) => ({ ...r, order: i + 1 }));
    });

    setDeleteConfirmIndex(null);
    setIsDirty(true);
    setSaveErrorNotice(null);
  };

  const handleMoveRiddle = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === riddles.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;

    setRiddles((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next.map((r, i) => ({ ...r, order: i + 1 }));
    });

    setIsDirty(true);
    setSaveErrorNotice(null);
  };

  // Save Riddle Configuration via Atomic Batch
  const handleSave = async () => {
    if (!eventId || !activityId) return;

    // Run client validation
    const validation = validateRiddleEntries(riddles, riddleTitle);
    setValidationErrors(validation.errors);
    setGlobalValidationErrors(validation.globalErrors);

    if (riddleStatus === "ready" && !validation.isValid) {
      const firstErr =
        validation.globalErrors[0] ||
        validation.errors[0]?.errors[0] ||
        "Please fix all validation errors before marking as READY.";
      setSaveErrorNotice(`Cannot mark as READY: ${firstErr}`);
      return;
    }

    if (!validation.isValid && validation.globalErrors.length > 0) {
      setSaveErrorNotice(validation.globalErrors[0]);
      return;
    }

    try {
      setIsSaving(true);
      setSaveErrorNotice(null);
      setSaveSuccessNotice(null);

      const res = await saveRiddleConfiguration(
        eventId,
        activityId,
        {
          title: riddleTitle,
          description: riddleDescription,
          status: riddleStatus,
        },
        riddles,
        deletedRiddleIds
      );

      if (!res.success) {
        setSaveErrorNotice(res.error || "Failed to save riddle configuration.");
        setIsSaving(false);
        return;
      }

      // Success
      setIsDirty(false);
      setDeletedRiddleIds([]);
      setSaveSuccessNotice("Riddle configuration saved successfully!");

      // Clear success banner after 4 seconds
      setTimeout(() => {
        setSaveSuccessNotice(null);
      }, 4000);
    } catch (err: any) {
      console.error("Save error:", err);
      setSaveErrorNotice(err.message || "An unexpected error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  // Loading skeleton screen
  if (isLoadingAuth || isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-neutral-200 flex flex-col items-center justify-center p-6 font-sans">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Loading Riddle Builder...
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Fetching riddle entries and activity metadata
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error boundary state
  if (loadError) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-neutral-200 flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full p-6 rounded-2xl bg-neutral-900 border border-neutral-800 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 mx-auto flex items-center justify-center">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              {loadError.type === "unauthorized"
                ? "Access Denied"
                : loadError.type === "not-found"
                ? "Activity Not Found"
                : "Connection Error"}
            </h3>
            <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
              {loadError.message}
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate(`/events/host/events/${eventId}/activities`)}
              className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-white text-xs font-bold transition-all cursor-pointer"
            >
              ← Back to Activities
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-200 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#0E0E0E]/90 backdrop-blur-md border-b border-neutral-800 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Left: Breadcrumbs & Back Button */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() =>
              handleSafeNavigate(`/events/host/events/${eventId}/activities`)
            }
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-all cursor-pointer shrink-0"
            title="Back to Activities"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 overflow-hidden text-ellipsis whitespace-nowrap">
              <button
                type="button"
                onClick={() => handleSafeNavigate("/events/host/dashboard")}
                className="hover:text-white hover:underline cursor-pointer"
              >
                Dashboard
              </button>
              <ChevronRight size={10} className="shrink-0 text-neutral-600" />
              <button
                type="button"
                onClick={() =>
                  handleSafeNavigate(`/events/host/events/${eventId}/activities`)
                }
                className="hover:text-white hover:underline truncate cursor-pointer"
              >
                {eventData?.title || eventData?.name || "Event Activities"}
              </button>
              <ChevronRight size={10} className="shrink-0 text-neutral-600" />
              <span className="text-orange-400 font-bold truncate">
                Riddle Builder
              </span>
            </div>

            <h1 className="text-sm sm:text-base font-black text-white uppercase tracking-tight flex items-center gap-2 truncate">
              <span>❓</span>
              <span className="truncate">{riddleTitle || "Configure Riddles"}</span>
              {isDirty && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" title="Unsaved changes" />
              )}
            </h1>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Tab Toggle: Editor vs Preview */}
          <div className="hidden sm:flex items-center p-0.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("editor")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "editor"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Layers size={13} />
              <span>Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "preview"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>Save Riddle</span>
              </>
            )}
          </button>

          {/* Sign Out */}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-800 transition-all cursor-pointer"
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Banner: Notices */}
        <AnimatePresence>
          {saveSuccessNotice && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-between gap-3 shadow-lg"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>{saveSuccessNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setSaveSuccessNotice(null)}
                className="text-emerald-400/80 hover:text-emerald-300 cursor-pointer"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}

          {saveErrorNotice && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium flex items-center justify-between gap-3 shadow-lg"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <span>{saveErrorNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setSaveErrorNotice(null)}
                className="text-red-400/80 hover:text-red-300 cursor-pointer"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Selector on Mobile */}
        <div className="flex sm:hidden items-center p-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("editor")}
            className={`flex-1 py-2 rounded-lg transition-all text-center ${
              activeTab === "editor"
                ? "bg-orange-500 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Editor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`flex-1 py-2 rounded-lg transition-all text-center ${
              activeTab === "preview"
                ? "bg-orange-500 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Preview
          </button>
        </div>

        {activeTab === "editor" ? (
          <div className="space-y-6">
            {/* Top Config Card */}
            <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900 border border-neutral-800/90 shadow-xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
                <div>
                  <h2 className="text-xs font-mono font-bold text-orange-400 uppercase tracking-widest">
                    Activity Metadata
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Basic settings and lifecycle status for this riddle challenge
                  </p>
                </div>

                {/* Status Toggle: Draft vs Ready */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-neutral-400">Status:</span>
                  <div className="flex items-center p-0.5 rounded-xl bg-neutral-950 border border-neutral-800">
                    <button
                      type="button"
                      onClick={() => handleStatusToggle("draft")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        riddleStatus === "draft"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      DRAFT
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusToggle("ready")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        riddleStatus === "ready"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      READY
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                    Riddle Activity Title <span className="text-orange-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={riddleTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    maxLength={120}
                    placeholder="e.g. Engineering Riddles Challenge"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                  <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500 mt-1">
                    <span>Displayed on participant screens</span>
                    <span>{riddleTitle.length}/120</span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                    Activity Description <span className="text-neutral-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={riddleDescription}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    maxLength={200}
                    placeholder="e.g. Solve engineering puzzles with letter-by-letter clues"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                  <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500 mt-1">
                    <span>Host internal notes or instructions</span>
                    <span>{riddleDescription.length}/200</span>
                  </div>
                </div>
              </div>

              {/* Metrics Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-neutral-800/80">
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80">
                  <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                    Total Riddles
                  </span>
                  <span className="text-lg font-black text-white font-mono mt-0.5 block">
                    {summaryMetrics.totalRiddles}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80">
                  <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                    Total Points
                  </span>
                  <span className="text-lg font-black text-orange-400 font-mono mt-0.5 block">
                    {summaryMetrics.totalPoints} pts
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80">
                  <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                    Total Time
                  </span>
                  <span className="text-lg font-black text-white font-mono mt-0.5 block">
                    {summaryMetrics.totalTimeSec} sec
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80">
                  <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                    Validation State
                  </span>
                  <span className={`text-xs font-mono font-bold mt-1 inline-flex items-center gap-1 ${
                    validationErrors.length === 0 && globalValidationErrors.length === 0
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}>
                    {validationErrors.length === 0 && globalValidationErrors.length === 0 ? (
                      <>
                        <Check size={13} />
                        <span>Valid</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={13} />
                        <span>{validationErrors.length + globalValidationErrors.length} issues</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Riddles List Header */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <span>Riddle Cards</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
                    {riddles.length} Total
                  </span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Configure puzzle prompts, canonical solutions, hints, and scoring
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddRiddle}
                className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-neutral-700 shadow-md"
              >
                <Plus size={14} className="text-orange-400" />
                <span>Add Riddle</span>
              </button>
            </div>

            {/* Riddles List */}
            <div className="space-y-4">
              {riddles.map((riddle, index) => {
                const isFirst = index === 0;
                const isLast = index === riddles.length - 1;
                const cleanAnswer = sanitizeRiddleAnswer(riddle.answer);
                const answerLength = cleanAnswer.length;
                const entryErrorObj = validationErrors.find(
                  (v) => v.entryId === riddle.id || v.riddleIndex === index
                );

                return (
                  <div
                    key={riddle.id}
                    className={`p-5 rounded-2xl bg-neutral-900 border transition-all shadow-xl space-y-4 ${
                      entryErrorObj
                        ? "border-red-500/40 bg-red-950/10"
                        : "border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    {/* Riddle Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-mono font-black flex items-center justify-center">
                          #{index + 1}
                        </span>
                        <input
                          type="text"
                          value={riddle.title || ""}
                          onChange={(e) =>
                            handleRiddleFieldChange(index, "title", e.target.value)
                          }
                          placeholder={`Riddle ${index + 1} Title (Optional)`}
                          className="bg-transparent text-xs font-bold text-white placeholder:text-neutral-600 focus:outline-none focus:border-b focus:border-orange-500"
                        />
                      </div>

                      {/* Card Action Controls */}
                      <div className="flex items-center gap-1.5">
                        {/* Move Up/Down */}
                        <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-xl p-0.5">
                          <button
                            type="button"
                            onClick={() => handleMoveRiddle(index, "up")}
                            disabled={isFirst}
                            className="p-1 rounded-lg text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveRiddle(index, "down")}
                            disabled={isLast}
                            className="p-1 rounded-lg text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>

                        {/* Duplicate */}
                        <button
                          type="button"
                          onClick={() => handleDuplicateRiddle(index)}
                          className="p-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
                          title="Duplicate Riddle"
                        >
                          <Copy size={13} />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmIndex(index)}
                          disabled={riddles.length <= 1}
                          className="p-1.5 rounded-xl bg-neutral-950 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 border border-neutral-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Delete Riddle"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Delete Confirmation Modal Inline */}
                    {deleteConfirmIndex === index && (
                      <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-3 text-xs text-red-300">
                        <span>Are you sure you want to delete Riddle #{index + 1}?</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmIndex(null)}
                            className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRiddle(index)}
                            className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Riddle Text Prompt */}
                    <div>
                      <label className="block text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                        Riddle Prompt Text <span className="text-orange-400">*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={riddle.riddleText}
                        onChange={(e) =>
                          handleRiddleFieldChange(index, "riddleText", e.target.value)
                        }
                        maxLength={600}
                        placeholder="e.g. I am an energy-rich state, but I was left in the dark when temperatures dropped..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-orange-500 transition-colors resize-y leading-relaxed"
                      />
                      <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500 mt-1">
                        <span>The mystery clue prompt presented to participants</span>
                        <span>{riddle.riddleText.length}/600</span>
                      </div>
                    </div>

                    {/* Answer & Hint Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Solution Answer */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider">
                            Canonical Answer <span className="text-orange-400">*</span>
                          </label>
                          <span className="text-[10px] font-mono text-orange-400 font-bold">
                            {answerLength} Letters
                          </span>
                        </div>
                        <input
                          type="text"
                          value={riddle.answer}
                          onChange={(e) =>
                            handleRiddleFieldChange(
                              index,
                              "answer",
                              sanitizeRiddleAnswer(e.target.value)
                            )
                          }
                          maxLength={25}
                          placeholder="e.g. FREEZE"
                          className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono font-bold text-xs uppercase tracking-wider placeholder:text-neutral-600 focus:outline-none focus:border-orange-500 transition-colors"
                        />
                        <span className="text-[10px] font-mono text-neutral-500 mt-1 block">
                          Auto-formatted to uppercase letters (A–Z)
                        </span>

                        {/* Letter box preview strip */}
                        {answerLength > 0 && (
                          <div className="flex items-center gap-1 mt-2.5 flex-wrap">
                            {Array.from(cleanAnswer).map((char, charIdx) => (
                              <div
                                key={charIdx}
                                className="w-6 h-7 rounded-md bg-neutral-950 border border-orange-500/40 text-orange-300 font-mono font-black text-xs flex items-center justify-center shadow-inner"
                              >
                                {char}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Optional Hint */}
                      <div>
                        <label className="block text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Lightbulb size={12} className="text-amber-400" />
                          <span>Participant Hint</span>
                          <span className="text-neutral-500 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={riddle.hint || ""}
                          onChange={(e) =>
                            handleRiddleFieldChange(index, "hint", e.target.value)
                          }
                          maxLength={250}
                          placeholder="e.g. The physical state change that happens below zero."
                          className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-orange-500 transition-colors"
                        />
                        <span className="text-[10px] font-mono text-neutral-500 mt-1 block">
                          Unlocked when participants click "Need a Hint?"
                        </span>
                      </div>
                    </div>

                    {/* Technical Explanation (For Solution Reveal) */}
                    <div>
                      <label className="block text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Sparkles size={12} className="text-orange-400" />
                        <span>Technical Explanation</span>
                        <span className="text-neutral-500 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={riddle.explanation || ""}
                        onChange={(e) =>
                          handleRiddleFieldChange(index, "explanation", e.target.value)
                        }
                        maxLength={500}
                        placeholder="e.g. During Winter Storm Uri, un-winterized natural gas systems failed..."
                        className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-orange-500 transition-colors"
                      />
                      <span className="text-[10px] font-mono text-neutral-500 mt-1 block">
                        Displayed when the riddle is solved or revealed on stage
                      </span>
                    </div>

                    {/* Time & Points Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-neutral-800/70">
                      {/* Time Limit */}
                      <div>
                        <label className="block text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Clock size={12} className="text-neutral-400" />
                          <span>Time Limit (Seconds)</span>
                        </label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {PRESET_TIMES.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() =>
                                handleRiddleFieldChange(index, "timeLimitSec", preset)
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                                riddle.timeLimitSec === preset
                                  ? "bg-orange-500 text-white"
                                  : "bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800"
                              }`}
                            >
                              {preset}s
                            </button>
                          ))}
                          <input
                            type="number"
                            min={5}
                            max={300}
                            value={riddle.timeLimitSec}
                            onChange={(e) =>
                              handleRiddleFieldChange(
                                index,
                                "timeLimitSec",
                                Math.max(5, Math.min(300, parseInt(e.target.value) || 20))
                              )
                            }
                            className="w-16 px-2 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-white font-mono text-xs text-center focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>

                      {/* Points */}
                      <div>
                        <label className="block text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Award size={12} className="text-neutral-400" />
                          <span>Points Awarded</span>
                        </label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {PRESET_POINTS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() =>
                                handleRiddleFieldChange(index, "points", preset)
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                                riddle.points === preset
                                  ? "bg-orange-500 text-white"
                                  : "bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800"
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                          <input
                            type="number"
                            min={0}
                            max={1000}
                            value={riddle.points}
                            onChange={(e) =>
                              handleRiddleFieldChange(
                                index,
                                "points",
                                Math.max(0, Math.min(1000, parseInt(e.target.value) || 100))
                              )
                            }
                            className="w-16 px-2 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-white font-mono text-xs text-center focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Field Errors List */}
                    {entryErrorObj && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 space-y-1">
                        {entryErrorObj.errors.map((errText, errIdx) => (
                          <div
                            key={errIdx}
                            className="text-xs text-red-300 flex items-center gap-1.5"
                          >
                            <AlertCircle size={12} className="shrink-0" />
                            <span>{errText}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Add Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleAddRiddle}
                className="w-full py-4 rounded-2xl bg-neutral-900 hover:bg-neutral-850 border border-dashed border-neutral-700 hover:border-orange-500/50 text-neutral-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg"
              >
                <Plus size={16} className="text-orange-400" />
                <span>Add Another Riddle</span>
              </button>
            </div>
          </div>
        ) : (
          /* Participant Preview Sandbox Tab */
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center gap-2.5">
              <Info size={16} className="text-amber-400 shrink-0" />
              <span>
                <strong>Host Sandbox Preview:</strong> This interactive preview simulates the participant presentation. No live session, participant documents, or leaderboard scores are created.
              </span>
            </div>

            {/* Preview Navigation */}
            <div className="flex items-center justify-between gap-3 bg-neutral-900 p-3 rounded-2xl border border-neutral-800">
              <span className="text-xs font-mono font-bold text-neutral-300">
                Previewing Riddle {previewRiddleIndex + 1} of {riddles.length}
              </span>

              <div className="flex items-center gap-1.5">
                {riddles.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPreviewRiddleIndex(idx)}
                    className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center ${
                      previewRiddleIndex === idx
                        ? "bg-orange-500 text-white"
                        : "bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800"
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Mystery Riddle Sandbox Card */}
            {riddles[previewRiddleIndex] && (
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-950 border border-orange-500/30 shadow-2xl space-y-6 relative overflow-hidden text-left">
                <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/10 blur-3xl rounded-full pointer-events-none" />

                {/* Top Badge & Timer */}
                <div className="flex items-center justify-between gap-2 relative z-10">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black uppercase tracking-wider text-orange-400 bg-orange-500/15 border border-orange-500/30">
                    <Sparkles size={13} />
                    <span>{riddles[previewRiddleIndex].title || `Riddle ${previewRiddleIndex + 1}`}</span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 border border-neutral-700 flex items-center gap-1">
                      <Clock size={12} className="text-orange-400" />
                      <span>{riddles[previewRiddleIndex].timeLimitSec}s</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-neutral-800 text-orange-400 font-bold border border-neutral-700">
                      {riddles[previewRiddleIndex].points} PTS
                    </span>
                  </div>
                </div>

                {/* Riddle Text Prompt */}
                <div className="relative z-10 py-3">
                  <p className="text-lg sm:text-xl md:text-2xl font-black text-white tracking-tight leading-relaxed italic">
                    "{riddles[previewRiddleIndex].riddleText || "Riddle prompt text will appear here..."}"
                  </p>
                </div>

                {/* Hint Toggle */}
                {riddles[previewRiddleIndex].hint && (
                  <div className="pt-2 border-t border-neutral-800 relative z-10 space-y-2">
                    <button
                      type="button"
                      onClick={() => setPreviewShowHint((p) => !p)}
                      className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
                    >
                      <Lightbulb size={14} />
                      <span>{previewShowHint ? "Hide Clue" : "Need a Hint?"}</span>
                    </button>

                    {previewShowHint && (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed">
                        💡 <strong>Hint:</strong> {riddles[previewRiddleIndex].hint}
                      </div>
                    )}
                  </div>
                )}

                {/* Character Boxes Input Simulation */}
                <div className="relative z-10 flex flex-col items-center justify-center space-y-3 pt-4 border-t border-neutral-800">
                  <span className="text-[11px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                    Answer Length: {sanitizeRiddleAnswer(riddles[previewRiddleIndex].answer).length} Letters
                  </span>

                  <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                    {Array.from(sanitizeRiddleAnswer(riddles[previewRiddleIndex].answer)).map(
                      (char, cIdx) => (
                        <div
                          key={cIdx}
                          className="w-10 h-12 sm:w-12 sm:h-14 rounded-xl text-center font-mono font-black text-lg sm:text-xl uppercase flex items-center justify-center bg-neutral-900 border border-orange-500/50 text-white shadow-lg"
                        >
                          {char}
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Explanation Reveal Sandbox */}
                {riddles[previewRiddleIndex].explanation && (
                  <div className="pt-3 border-t border-neutral-800 space-y-2">
                    <button
                      type="button"
                      onClick={() => setPreviewShowExplanation((p) => !p)}
                      className="text-xs font-mono font-bold text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={12} className="text-orange-400" />
                      <span>
                        {previewShowExplanation ? "Hide Explanation" : "Reveal Technical Explanation"}
                      </span>
                    </button>

                    {previewShowExplanation && (
                      <div className="p-4 rounded-xl bg-neutral-900 border border-orange-500/30 text-xs text-neutral-300 leading-relaxed space-y-1">
                        <span className="font-mono font-black text-orange-400 uppercase tracking-widest block text-[10px]">
                          Technical Explanation
                        </span>
                        <p className="text-white">{riddles[previewRiddleIndex].explanation}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Unsaved Changes Confirmation Modal */}
      <AnimatePresence>
        {showUnsavedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md w-full p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-2xl text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  Unsaved Changes
                </h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  You have unsaved changes in this riddle activity. If you leave without saving, your edits will be discarded.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUnsavedModal(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Stay Here
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDirty(false);
                    setShowUnsavedModal(false);
                    if (pendingNavigationPath) {
                      navigate(pendingNavigationPath);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold cursor-pointer"
                >
                  Discard & Leave
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
