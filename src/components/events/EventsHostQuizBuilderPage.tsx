import { useState, useEffect, useCallback, useMemo } from "react";
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
  FileQuestion,
  Info
} from "lucide-react";
import { auth, db, ALLOWED_ADMIN_EMAILS } from "../../lib/firebase";
import { EventActivity } from "../../services/eventActivityService";
import {
  GenericQuizQuestion,
  QuizBuilderData,
  getQuizBuilderData,
  createBlankQuestion,
  validateQuizQuestions,
  saveQuizConfiguration,
  QuestionValidationError
} from "../../services/quizBuilderService";

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

export function EventsHostQuizBuilderPage() {
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

  // Quiz Form State (Local React State - 0 writes per keystroke)
  const [quizTitle, setQuizTitle] = useState<string>("");
  const [quizDescription, setQuizDescription] = useState<string>("");
  const [quizStatus, setQuizStatus] = useState<"draft" | "ready">("draft");
  const [questions, setQuestions] = useState<GenericQuizQuestion[]>([]);
  const [deletedQuestionIds, setDeletedQuestionIds] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Interaction Modals & States
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [saveErrorNotice, setSaveErrorNotice] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<QuestionValidationError[]>([]);
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

  // 2. Load Event & Quiz Data (Single point-in-time read)
  useEffect(() => {
    if (!currentUser || !eventId || !activityId) return;

    let isMounted = true;

    async function loadQuizData() {
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

        const eData = { id: eventSnap.id, ...eventSnap.data() } as EventSummary;

        // Check ownership
        const email = currentUser.email || "";
        const isAdminUser = ALLOWED_ADMIN_EMAILS.includes(email);
        const isOwner = eData.ownerId === currentUser.uid;

        if (!isOwner && !isAdminUser) {
          if (isMounted) {
            setLoadError({
              type: "unauthorized",
              message: "You are not authorized to configure activities for this event. Only the event creator or an authorized administrator may access this section.",
            });
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setEventData(eData);
        }

        // Point query for Activity and Questions
        const builderData: QuizBuilderData | null = await getQuizBuilderData(eventId, activityId);

        if (!builderData) {
          if (isMounted) {
            setLoadError({
              type: "not-found",
              message: "The requested quiz activity could not be found or has been deleted.",
            });
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setActivityData(builderData.activity);
          setQuizTitle(builderData.activity.title || "Interactive Quiz");
          setQuizDescription(builderData.activity.description || "");
          setQuizStatus((builderData.activity.status as "draft" | "ready") || "draft");

          if (builderData.questions.length > 0) {
            setQuestions(builderData.questions);
          } else {
            // Seed with 1 blank initial question if empty
            const initialQ = createBlankQuestion(eventId, activityId, 1);
            setQuestions([initialQ]);
          }

          setIsDirty(false);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error("Error loading quiz builder data:", err);
        if (isMounted) {
          setLoadError({
            type: "network",
            message: "Failed to load quiz details. Please check your network connection and try again.",
          });
          setIsLoading(false);
        }
      }
    }

    loadQuizData();

    return () => {
      isMounted = false;
    };
  }, [currentUser, eventId, activityId]);

  // Handle Unsaved Changes Before Unload
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

  // Handle Navigation with Dirty State Guard
  const handleProtectedNavigate = (path: string) => {
    if (isDirty) {
      setPendingNavigationPath(path);
      setShowUnsavedModal(true);
    } else {
      navigate(path);
    }
  };

  // Sign out handler
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

  // -------------------------------------------------------------
  // Question Manipulation Handlers (Local State Only)
  // -------------------------------------------------------------

  // Add Question
  const handleAddQuestion = () => {
    if (!eventId || !activityId) return;
    const nextOrder = questions.length + 1;
    const newQ = createBlankQuestion(eventId, activityId, nextOrder);
    setQuestions((prev) => [...prev, newQ]);
    setIsDirty(true);
  };

  // Duplicate Question
  const handleDuplicateQuestion = (index: number) => {
    if (!eventId || !activityId || index < 0 || index >= questions.length) return;
    const sourceQ = questions[index];
    const newQ: GenericQuizQuestion = {
      ...sourceQ,
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      questionId: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      order: questions.length + 1,
      text: `${sourceQ.text} (Copy)`.trim(),
      options: [...sourceQ.options] as [string, string, string, string],
    };
    setQuestions((prev) => [...prev, newQ]);
    setIsDirty(true);
  };

  // Update Question Field
  const handleUpdateQuestion = (
    index: number,
    field: keyof GenericQuizQuestion,
    value: any
  ) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
    setIsDirty(true);
  };

  // Update Option Text (A, B, C, D)
  const handleUpdateOption = (
    questionIndex: number,
    optionIndex: number,
    value: string
  ) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const currentOpts = [...(updated[questionIndex].options || ["", "", "", ""])];
      currentOpts[optionIndex] = value;
      updated[questionIndex] = {
        ...updated[questionIndex],
        options: currentOpts as [string, string, string, string],
      };
      return updated;
    });
    setIsDirty(true);
  };

  // Move Question Up / Down
  const handleMoveQuestion = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    setQuestions((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      // Re-assign display order
      return updated.map((q, idx) => ({ ...q, order: idx + 1 }));
    });
    setIsDirty(true);
  };

  // Delete Question
  const handleDeleteQuestion = (index: number) => {
    if (index < 0 || index >= questions.length) return;
    const targetQ = questions[index];

    // If it was already saved in database, track ID for batch deletion
    if (targetQ.id && !targetQ.id.startsWith("temp_")) {
      setDeletedQuestionIds((prev) => [...prev, targetQ.id]);
    }

    setQuestions((prev) => {
      const remaining = prev.filter((_, idx) => idx !== index);
      // Re-number remaining questions
      return remaining.map((q, idx) => ({ ...q, order: idx + 1 }));
    });
    setDeleteConfirmIndex(null);
    setIsDirty(true);
  };

  // -------------------------------------------------------------
  // Validation and Save Logic (Atomic Firestore Batch)
  // -------------------------------------------------------------

  // Save Quiz Handler
  const handleSaveQuiz = async (targetStatus?: "draft" | "ready") => {
    if (!eventId || !activityId) return;

    setSaveErrorNotice(null);
    setSaveSuccessNotice(null);

    // 1. Validate Quiz Title
    if (!quizTitle.trim()) {
      setSaveErrorNotice("Please provide a valid Quiz Title.");
      return;
    }

    // 2. Validate Questions
    if (questions.length === 0) {
      setSaveErrorNotice("A Quiz must have at least 1 question.");
      return;
    }

    const errors = validateQuizQuestions(questions);
    setValidationErrors(errors);

    if (errors.length > 0) {
      setSaveErrorNotice(
        `Please fix the errors in Question ${errors.map((e) => `#${e.questionNumber}`).join(", ")} before saving.`
      );
      return;
    }

    setIsSaving(true);

    try {
      const finalStatus = targetStatus || quizStatus;

      await saveQuizConfiguration(
        eventId,
        activityId,
        {
          title: quizTitle.trim(),
          description: quizDescription.trim(),
          status: finalStatus,
        },
        questions,
        deletedQuestionIds
      );

      setQuizStatus(finalStatus);
      setDeletedQuestionIds([]);
      setIsDirty(false);
      setValidationErrors([]);
      setSaveSuccessNotice(
        `Quiz saved successfully! (${questions.length} question${questions.length === 1 ? "" : "s"} configured as ${finalStatus.toUpperCase()})`
      );

      // Auto-hide success message after 4s
      setTimeout(() => {
        setSaveSuccessNotice(null);
      }, 4000);
    } catch (err: any) {
      console.error("Error saving quiz configuration:", err);
      setSaveErrorNotice(
        "Failed to save quiz configuration. Please check your network and try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Summary statistics
  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0),
    [questions]
  );
  const totalSeconds = useMemo(
    () => questions.reduce((sum, q) => sum + (Number(q.timeLimitSec) || 0), 0),
    [questions]
  );

  const formatTotalTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const remSecs = seconds % 60;
    if (mins === 0) return `${remSecs}s`;
    if (remSecs === 0) return `${mins}m`;
    return `${mins}m ${remSecs}s`;
  };

  // -------------------------------------------------------------
  // Render Loading / Unauthorized States
  // -------------------------------------------------------------

  if (isLoadingAuth || (!currentUser && !loadError)) {
    return (
      <div className="min-h-screen bg-[#070709] text-white flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <Loader2 size={36} className="text-orange-500 animate-spin mx-auto" />
          <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
            Authenticating Host Session...
          </p>
        </div>
      </div>
    );
  }

  const userEmail = currentUser?.email || "";
  const isSuperAdmin = ALLOWED_ADMIN_EMAILS.includes(userEmail);

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-between selection:bg-orange-500/30 selection:text-orange-200 font-sans">
      {/* Top Header */}
      <header className="border-b border-neutral-850/80 bg-[#0e0e12]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Left: Back & Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => handleProtectedNavigate(`/events/host/events/${eventId}/activities`)}
              className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-all cursor-pointer shrink-0"
              title="Back to Activities Sequence"
              aria-label="Back to Activities Sequence"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="min-w-0 flex items-center gap-1.5 text-xs text-neutral-400 font-semibold truncate">
              <span
                onClick={() => handleProtectedNavigate("/events/host/dashboard")}
                className="hover:text-white cursor-pointer transition-colors truncate hidden sm:inline"
              >
                Dashboard
              </span>
              <ChevronRight size={12} className="shrink-0 text-neutral-600 hidden sm:inline" />
              <span
                onClick={() => handleProtectedNavigate(`/events/host/events/${eventId}/activities`)}
                className="hover:text-white cursor-pointer transition-colors truncate"
              >
                {eventData?.title || "Event Activities"}
              </span>
              <ChevronRight size={12} className="shrink-0 text-neutral-600" />
              <span className="text-orange-400 font-bold uppercase truncate">
                Quiz Builder
              </span>
            </div>
          </div>

          {/* Right: Status & Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {isDirty && (
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 hidden md:inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Unsaved Changes</span>
              </span>
            )}

            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800 flex items-center gap-1">
              <Radio size={10} className="text-orange-500 animate-pulse" />
              <span>HOST</span>
            </span>

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
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-32">
        <div className="w-full max-w-4xl mx-auto space-y-6">

          {/* Toast / Notices */}
          <AnimatePresence>
            {saveSuccessNotice && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-xl shadow-emerald-500/5"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>{saveSuccessNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSaveSuccessNotice(null)}
                  className="text-neutral-400 hover:text-white ml-2"
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
                className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-between shadow-xl shadow-red-500/5"
              >
                <div className="flex items-center gap-2.5">
                  <AlertCircle size={16} className="text-red-400 shrink-0" />
                  <span>{saveErrorNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSaveErrorNotice(null)}
                  className="text-neutral-400 hover:text-white ml-2"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* STATE 1: LOADING */}
          {isLoading && (
            <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-12 shadow-2xl text-center space-y-4">
              <Loader2 size={36} className="text-orange-500 animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white uppercase tracking-wider">
                  Loading Quiz Builder...
                </p>
                <p className="text-xs text-neutral-500">
                  Retrieving activity schema and question configurations.
                </p>
              </div>
            </div>
          )}

          {/* STATE 2: ERROR SCREEN */}
          {!isLoading && loadError && (
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
                  {loadError.type === "unauthorized" ? "Access Denied" : "Error Loading Quiz"}
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

          {/* STATE 3: QUIZ BUILDER FORM */}
          {!isLoading && !loadError && (
            <div className="space-y-6">

              {/* CARD 1: QUIZ METADATA */}
              <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-neutral-850">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                        ZERO2ONE EVENTS // ACTIVITY BUILDER
                      </span>
                      <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                        QUIZ TYPE
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                      QUIZ BUILDER
                    </h1>
                    <p className="text-xs text-neutral-400">
                      Configure questions, multiple choice options, correct answers, timing, and point rewards.
                    </p>
                  </div>

                  {/* Status Selection Pill */}
                  <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-1 self-start">
                    <button
                      type="button"
                      onClick={() => {
                        setQuizStatus("draft");
                        setIsDirty(true);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        quizStatus === "draft"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      DRAFT
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQuizStatus("ready");
                        setIsDirty(true);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        quizStatus === "ready"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      READY
                    </button>
                  </div>
                </div>

                {/* Form Fields: Title & Description */}
                <div className="grid grid-cols-1 gap-5">
                  {/* Quiz Title */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                        <span>Quiz Title</span>
                        <span className="text-orange-500">*</span>
                      </label>
                      <span className="text-[10px] text-neutral-500">
                        {quizTitle.length}/100
                      </span>
                    </div>
                    <input
                      type="text"
                      value={quizTitle}
                      maxLength={100}
                      onChange={(e) => {
                        setQuizTitle(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="e.g. Computer Science Fundamentals Quiz"
                      className="w-full px-4 py-3 rounded-xl bg-neutral-900/90 border border-neutral-800 focus:border-orange-500 text-white placeholder-neutral-500 text-sm font-medium focus:outline-none transition-all"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-neutral-300 uppercase tracking-wider">
                        Description (Optional)
                      </label>
                      <span className="text-[10px] text-neutral-500">
                        {quizDescription.length}/300
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={quizDescription}
                      maxLength={300}
                      onChange={(e) => {
                        setQuizDescription(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="e.g. 10 rapid-fire questions on operating systems and network protocols."
                      className="w-full px-4 py-3 rounded-xl bg-neutral-900/90 border border-neutral-800 focus:border-orange-500 text-white placeholder-neutral-500 text-xs font-normal focus:outline-none transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0">
                      <FileQuestion size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase">Questions</div>
                      <div className="text-sm font-black text-white">{questions.length}</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                      <Award size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase">Total Points</div>
                      <div className="text-sm font-black text-white">{totalPoints} pts</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                      <Clock size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase">Est. Duration</div>
                      <div className="text-sm font-black text-white">{formatTotalTime(totalSeconds)}</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      validationErrors.length === 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {validationErrors.length === 0 ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase">Status</div>
                      <div className={`text-xs font-black uppercase ${
                        validationErrors.length === 0 ? "text-emerald-400" : "text-amber-400"
                      }`}>
                        {validationErrors.length === 0 ? "Valid" : `${validationErrors.length} Invalid`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 2: QUESTIONS LIST */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black text-white uppercase tracking-wider">
                      QUESTIONS ({questions.length})
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-lg shadow-orange-500/15"
                  >
                    <Plus size={14} className="stroke-[3]" />
                    <span>+ ADD QUESTION</span>
                  </button>
                </div>

                {/* Questions Iteration */}
                <div className="space-y-4">
                  {questions.map((q, qIndex) => {
                    const qErrors = validationErrors.find((v) => v.questionIndex === qIndex);
                    const isFirst = qIndex === 0;
                    const isLast = qIndex === questions.length - 1;

                    return (
                      <motion.div
                        key={q.id || `q_idx_${qIndex}`}
                        layout
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`bg-[#0e0e12] border rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 transition-all ${
                          qErrors ? "border-red-500/40 bg-red-950/5" : "border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        {/* Question Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-850">
                          {/* Number and Status */}
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-orange-500 text-white font-black text-xs flex items-center justify-center shadow-md shadow-orange-500/20">
                              {qIndex + 1}
                            </span>
                            <span className="text-xs font-black text-white uppercase tracking-tight">
                              QUESTION #{qIndex + 1}
                            </span>

                            {qErrors ? (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                                <AlertCircle size={10} />
                                <span>INCOMPLETE</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                <Check size={10} />
                                <span>READY</span>
                              </span>
                            )}
                          </div>

                          {/* Reorder and Actions */}
                          <div className="flex items-center gap-1.5">
                            {/* Move Up */}
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(qIndex, "up")}
                              disabled={isFirst}
                              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 disabled:opacity-30 disabled:hover:bg-neutral-900 disabled:cursor-not-allowed transition-all cursor-pointer"
                              title="Move Question Up"
                              aria-label="Move Question Up"
                            >
                              <ArrowUp size={13} />
                            </button>

                            {/* Move Down */}
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(qIndex, "down")}
                              disabled={isLast}
                              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 disabled:opacity-30 disabled:hover:bg-neutral-900 disabled:cursor-not-allowed transition-all cursor-pointer"
                              title="Move Question Down"
                              aria-label="Move Question Down"
                            >
                              <ArrowDown size={13} />
                            </button>

                            {/* Duplicate */}
                            <button
                              type="button"
                              onClick={() => handleDuplicateQuestion(qIndex)}
                              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-all cursor-pointer"
                              title="Duplicate Question"
                              aria-label="Duplicate Question"
                            >
                              <Copy size={13} />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmIndex(qIndex)}
                              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-neutral-400 border border-neutral-800 transition-all cursor-pointer"
                              title="Delete Question"
                              aria-label="Delete Question"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Inline Errors Banner */}
                        {qErrors && qErrors.errors.length > 0 && (
                          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs space-y-1">
                            {qErrors.errors.map((errStr, eIdx) => (
                              <div key={eIdx} className="flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-red-400" />
                                <span>{errStr}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Question Text */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
                            <span>Question Text</span>
                            <span className="text-[10px] text-neutral-500">Required</span>
                          </label>
                          <textarea
                            rows={2}
                            value={q.text}
                            onChange={(e) => handleUpdateQuestion(qIndex, "text", e.target.value)}
                            placeholder="e.g. Which algorithmic time complexity represents binary search in a sorted array?"
                            className="w-full px-4 py-3 rounded-xl bg-neutral-900/90 border border-neutral-800 focus:border-orange-500 text-white placeholder-neutral-500 text-sm font-medium focus:outline-none transition-all resize-none"
                          />
                        </div>

                        {/* Answer Options (A, B, C, D) */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                              Answer Options & Correct Choice
                            </label>
                            <span className="text-[10px] text-orange-400 font-semibold">
                              Click radio icon to set as correct answer
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {["A", "B", "C", "D"].map((letter, optIdx) => {
                              const isCorrect = q.correctOptionIndex === optIdx;
                              const optVal = q.options[optIdx] || "";

                              return (
                                <div
                                  key={letter}
                                  className={`p-3 rounded-2xl border transition-all flex flex-col gap-2 ${
                                    isCorrect
                                      ? "bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20"
                                      : "bg-neutral-900/80 border-neutral-800 hover:border-neutral-750"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUpdateQuestion(qIndex, "correctOptionIndex", optIdx)
                                        }
                                        className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center transition-all cursor-pointer ${
                                          isCorrect
                                            ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                                            : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                                        }`}
                                        title={`Set Option ${letter} as correct answer`}
                                      >
                                        {letter}
                                      </button>
                                      <span className="text-xs font-bold text-neutral-300">
                                        Option {letter}
                                      </span>
                                    </div>

                                    {/* Radio / Correct badge */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateQuestion(qIndex, "correctOptionIndex", optIdx)
                                      }
                                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                                        isCorrect
                                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                          : "bg-neutral-800/80 text-neutral-500 hover:text-neutral-300 border border-neutral-750"
                                      }`}
                                    >
                                      {isCorrect ? (
                                        <>
                                          <Check size={10} className="stroke-[3]" />
                                          <span>CORRECT</span>
                                        </>
                                      ) : (
                                        <span>Mark Correct</span>
                                      )}
                                    </button>
                                  </div>

                                  <input
                                    type="text"
                                    value={optVal}
                                    onChange={(e) =>
                                      handleUpdateOption(qIndex, optIdx, e.target.value)
                                    }
                                    placeholder={`e.g. Option ${letter} answer text`}
                                    className={`w-full px-3 py-2 rounded-xl bg-neutral-950/80 border text-xs font-medium text-white placeholder-neutral-600 focus:outline-none transition-all ${
                                      isCorrect
                                        ? "border-emerald-500/40 focus:border-emerald-400"
                                        : "border-neutral-800 focus:border-orange-500"
                                    }`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Timing and Points Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-850/80">
                          {/* Time Limit */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                              <Clock size={13} className="text-orange-400" />
                              <span>Time Limit (Seconds)</span>
                            </label>

                            <div className="flex items-center gap-2 flex-wrap">
                              {PRESET_TIMES.map((timeVal) => (
                                <button
                                  key={timeVal}
                                  type="button"
                                  onClick={() => handleUpdateQuestion(qIndex, "timeLimitSec", timeVal)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                                    q.timeLimitSec === timeVal
                                      ? "bg-orange-500 text-white shadow-sm"
                                      : "bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800"
                                  }`}
                                >
                                  {timeVal}s
                                </button>
                              ))}

                              <input
                                type="number"
                                min={5}
                                max={300}
                                value={q.timeLimitSec || 15}
                                onChange={(e) =>
                                  handleUpdateQuestion(
                                    qIndex,
                                    "timeLimitSec",
                                    parseInt(e.target.value) || 15
                                  )
                                }
                                className="w-16 px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-white font-mono text-xs font-bold text-center focus:outline-none focus:border-orange-500"
                                title="Custom time limit in seconds"
                              />
                            </div>
                          </div>

                          {/* Points */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                              <Award size={13} className="text-amber-400" />
                              <span>Score Value (Points)</span>
                            </label>

                            <div className="flex items-center gap-2 flex-wrap">
                              {PRESET_POINTS.map((ptVal) => (
                                <button
                                  key={ptVal}
                                  type="button"
                                  onClick={() => handleUpdateQuestion(qIndex, "points", ptVal)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                                    q.points === ptVal
                                      ? "bg-amber-500 text-neutral-950 shadow-sm"
                                      : "bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800"
                                  }`}
                                >
                                  {ptVal}
                                </button>
                              ))}

                              <input
                                type="number"
                                min={10}
                                max={1000}
                                step={10}
                                value={q.points || 100}
                                onChange={(e) =>
                                  handleUpdateQuestion(
                                    qIndex,
                                    "points",
                                    parseInt(e.target.value) || 100
                                  )
                                }
                                className="w-16 px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-white font-mono text-xs font-bold text-center focus:outline-none focus:border-amber-500"
                                title="Custom points"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Optional Explanation */}
                        <div className="space-y-1.5 pt-1">
                          <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                            Explanation / Trivia (Optional)
                          </label>
                          <input
                            type="text"
                            value={q.explanation || ""}
                            onChange={(e) =>
                              handleUpdateQuestion(qIndex, "explanation", e.target.value)
                            }
                            placeholder="e.g. Binary search halves the search space at each iteration, resulting in O(log n) complexity."
                            className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 focus:border-orange-500 text-xs font-normal text-white placeholder-neutral-600 focus:outline-none transition-all"
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Bottom Add Question Trigger */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="w-full py-4 px-6 rounded-2xl bg-[#121217] hover:bg-[#181820] border border-dashed border-neutral-750 hover:border-orange-500/50 text-neutral-300 hover:text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Plus size={16} className="text-orange-500 stroke-[3]" />
                    <span>+ ADD ANOTHER QUESTION</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Sticky Bottom Action Bar */}
      {!isLoading && !loadError && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0e0e12]/95 backdrop-blur border-t border-neutral-850 py-3.5 px-4 sm:px-8">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Left summary */}
            <div className="flex items-center gap-3 text-xs text-neutral-400">
              <span className="font-bold text-white">
                {questions.length} Question{questions.length === 1 ? "" : "s"}
              </span>
              <span className="text-neutral-600">•</span>
              <span>{totalPoints} Total Pts</span>
              <span className="text-neutral-600">•</span>
              <span>Status: <strong className="text-orange-400 uppercase">{quizStatus}</strong></span>
            </div>

            {/* Right save action buttons */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => handleProtectedNavigate(`/events/host/events/${eventId}/activities`)}
                className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Back
              </button>

              <button
                type="button"
                onClick={() => handleSaveQuiz("draft")}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                <span>Save as Draft</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveQuiz("ready")}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-orange-500/20"
              >
                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} className="stroke-[2.5]" />}
                <span>Save & Mark Ready</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: UNSAVED CHANGES WARNING */}
      <AnimatePresence>
        {showUnsavedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUnsavedModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#121217] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <AlertCircle size={24} />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  Unsaved Changes
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  You have unsaved changes in this quiz. If you leave now, your latest question modifications will be discarded.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUnsavedModal(false)}
                  className="w-full py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border border-neutral-800"
                >
                  Stay & Edit
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowUnsavedModal(false);
                    setIsDirty(false);
                    if (pendingNavigationPath) {
                      navigate(pendingNavigationPath);
                    }
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-red-500/20"
                >
                  Discard & Leave
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: DELETE QUESTION CONFIRMATION */}
      <AnimatePresence>
        {deleteConfirmIndex !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmIndex(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#121217] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  Delete Question #{deleteConfirmIndex + 1}?
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Are you sure you want to delete this question? Remaining questions will be automatically renumbered.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmIndex(null)}
                  className="w-full py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border border-neutral-800"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteQuestion(deleteConfirmIndex)}
                  className="w-full py-3 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-red-500/20"
                >
                  Delete Question
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-neutral-850/80 bg-[#0a0a0d] py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-400 uppercase tracking-widest">ZERO2ONE EVENTS</span>
            <span>•</span>
            <span>Activity Architecture v4.2</span>
          </div>
          <div>
            <span>Organizer Portal // Anurag University</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
