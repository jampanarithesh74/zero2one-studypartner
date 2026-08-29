import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Sparkles,
  HelpCircle,
  Copy,
  Calendar,
  Layers,
  ChevronRight,
  RotateCcw,
  Check,
  X,
  Grid,
  Grid3X3,
  Hash,
  Eye,
  Info,
  Sliders,
  Maximize2
} from "lucide-react";
import { auth, db, ALLOWED_ADMIN_EMAILS } from "../../lib/firebase";
import { EventActivity } from "../../services/eventActivityService";
import {
  CrosswordDirection,
  GenericCrosswordEntry,
  CrosswordGridConfig,
  CrosswordBuilderData,
  GeneratedCrosswordGrid,
  getCrosswordBuilderData,
  createBlankEntry,
  compileCrosswordGrid,
  saveCrosswordConfiguration,
  sanitizeAnswer
} from "../../services/crosswordBuilderService";

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

const GRID_PRESETS = [
  { label: "8 × 8 (Compact)", rows: 8, cols: 8 },
  { label: "10 × 10 (Standard)", rows: 10, cols: 10 },
  { label: "12 × 12 (Recommended)", rows: 12, cols: 12 },
  { label: "15 × 15 (Classic)", rows: 15, cols: 15 },
  { label: "20 × 20 (Large)", rows: 20, cols: 20 },
];

export function EventsHostCrosswordBuilderPage() {
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

  // Form State (Local React state - 0 writes per keystroke)
  const [crosswordTitle, setCrosswordTitle] = useState<string>("");
  const [crosswordDescription, setCrosswordDescription] = useState<string>("");
  const [crosswordStatus, setCrosswordStatus] = useState<"draft" | "ready">("draft");
  const [gridRows, setGridRows] = useState<number>(12);
  const [gridCols, setGridCols] = useState<number>(12);
  const [entries, setEntries] = useState<GenericCrosswordEntry[]>([]);
  const [deletedEntryIds, setDeletedEntryIds] = useState<string[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [activeTabFilter, setActiveTabFilter] = useState<"all" | "across" | "down">("all");
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Interaction Modals & Notices
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [saveErrorNotice, setSaveErrorNotice] = useState<string | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);
  const [pendingNavigationPath, setPendingNavigationPath] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

  // 2. Load Event & Crossword Data (Single point-in-time read)
  useEffect(() => {
    if (!currentUser || !eventId || !activityId) return;

    let isMounted = true;

    async function loadCrosswordData() {
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
              message:
                "You are not authorized to configure activities for this event. Only the event creator or an authorized administrator may access this section.",
            });
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setEventData(eData);
        }

        // Point query for Activity and Clue Entries
        const builderData: CrosswordBuilderData | null = await getCrosswordBuilderData(
          eventId,
          activityId
        );

        if (!builderData) {
          if (isMounted) {
            setLoadError({
              type: "not-found",
              message: "The requested crossword activity could not be found or has been deleted.",
            });
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setActivityData(builderData.activity);
          setCrosswordTitle(builderData.activity.title || "Custom Crossword Puzzle");
          setCrosswordDescription(builderData.activity.description || "");
          setCrosswordStatus((builderData.activity.status as "draft" | "ready") || "draft");
          setGridRows(builderData.gridConfig.gridRows || 12);
          setGridCols(builderData.gridConfig.gridCols || 12);

          if (builderData.entries.length > 0) {
            setEntries(builderData.entries);
            setSelectedEntryId(builderData.entries[0].id);
          } else {
            // Seed with 2 blank starter entries (1 across, 1 down) for a great initial experience
            const initialAcross = createBlankEntry(eventId, activityId, "across", 0, 0, 1);
            const initialDown = createBlankEntry(eventId, activityId, "down", 0, 0, 2);
            setEntries([initialAcross, initialDown]);
            setSelectedEntryId(initialAcross.id);
          }

          setIsDirty(false);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error("Error loading crossword builder data:", err);
        if (isMounted) {
          setLoadError({
            type: "network",
            message: "Failed to load crossword details. Please check your network connection and try again.",
          });
          setIsLoading(false);
        }
      }
    }

    loadCrosswordData();

    return () => {
      isMounted = false;
    };
  }, [currentUser, eventId, activityId]);

  // Handle Unsaved Changes Before Browser Unload
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
  // Realtime Grid Compilation & Validation
  // -------------------------------------------------------------
  const compiledGrid: GeneratedCrosswordGrid = useMemo(() => {
    return compileCrosswordGrid(gridRows, gridCols, entries);
  }, [gridRows, gridCols, entries]);

  // Selected Entry helper
  const selectedEntry = useMemo(() => {
    return compiledGrid.computedEntries.find((e) => e.id === selectedEntryId) || null;
  }, [compiledGrid.computedEntries, selectedEntryId]);

  // Cells belonging to currently selected clue
  const selectedCellCoords = useMemo(() => {
    if (!selectedEntry || !selectedEntry.answer) return new Set<string>();
    const coords = new Set<string>();
    const isAcross = selectedEntry.direction === "across";
    for (let i = 0; i < selectedEntry.answer.length; i++) {
      const r = isAcross ? selectedEntry.row : selectedEntry.row + i;
      const c = isAcross ? selectedEntry.col + i : selectedEntry.col;
      coords.add(`${r},${c}`);
    }
    return coords;
  }, [selectedEntry]);

  // -------------------------------------------------------------
  // Clue Manipulation Handlers (Local State Only)
  // -------------------------------------------------------------

  // Add Clue
  const handleAddEntry = (direction: CrosswordDirection = "across") => {
    if (!eventId || !activityId) return;

    // Smart default coordinates: if an entry is currently selected, place next to it or at next row
    let defaultRow = 0;
    let defaultCol = 0;

    if (selectedEntry) {
      if (direction === "across") {
        defaultRow = Math.min(gridRows - 1, selectedEntry.row + (selectedEntry.direction === "across" ? 2 : 1));
        defaultCol = 0;
      } else {
        defaultRow = 0;
        defaultCol = Math.min(gridCols - 1, selectedEntry.col + (selectedEntry.direction === "down" ? 2 : 1));
      }
    }

    const nextOrder = entries.length + 1;
    const newEntry = createBlankEntry(
      eventId,
      activityId,
      direction,
      defaultRow,
      defaultCol,
      nextOrder
    );

    setEntries((prev) => [...prev, newEntry]);
    setSelectedEntryId(newEntry.id);
    setIsDirty(true);
  };

  // Duplicate Clue
  const handleDuplicateEntry = (id: string) => {
    if (!eventId || !activityId) return;
    const source = entries.find((e) => e.id === id);
    if (!source) return;

    const newId = `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newEntry: GenericCrosswordEntry = {
      ...source,
      id: newId,
      entryId: newId,
      clue: `${source.clue} (Copy)`.trim(),
      order: entries.length + 1,
    };

    setEntries((prev) => [...prev, newEntry]);
    setSelectedEntryId(newId);
    setIsDirty(true);
  };

  // Update Clue Field
  const handleUpdateEntry = (id: string, field: keyof GenericCrosswordEntry, value: any) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id === id) {
          let updatedVal = value;
          if (field === "answer") {
            updatedVal = sanitizeAnswer(value);
          } else if (field === "row" || field === "col") {
            updatedVal = Math.max(0, parseInt(value) || 0);
          }
          return {
            ...e,
            [field]: updatedVal,
          };
        }
        return e;
      })
    );
    setIsDirty(true);
  };

  // Move Clue Up / Down in list
  const handleMoveEntry = (id: string, direction: "up" | "down") => {
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= entries.length) return;

    setEntries((prev) => {
      const updated = [...prev];
      const temp = updated[idx];
      updated[idx] = updated[targetIdx];
      updated[targetIdx] = temp;
      return updated.map((e, index) => ({ ...e, order: index + 1 }));
    });
    setIsDirty(true);
  };

  // Delete Clue
  const handleDeleteEntry = (id: string) => {
    const target = entries.find((e) => e.id === id);
    if (!target) return;

    if (target.id && !target.id.startsWith("temp_")) {
      setDeletedEntryIds((prev) => [...prev, target.id]);
    }

    setEntries((prev) => {
      const remaining = prev.filter((e) => e.id !== id);
      return remaining.map((e, idx) => ({ ...e, order: idx + 1 }));
    });

    if (selectedEntryId === id) {
      const remaining = entries.filter((e) => e.id !== id);
      setSelectedEntryId(remaining.length > 0 ? remaining[0].id : null);
    }

    setDeleteConfirmId(null);
    setIsDirty(true);
  };

  // Click on a cell in the grid preview
  const handleGridCellClick = (r: number, c: number) => {
    const cellKey = `${r},${c}`;
    const cluesInCell = compiledGrid.cellCluesMap[cellKey];

    if (cluesInCell && cluesInCell.length > 0) {
      // Cell is part of existing clue(s)
      if (selectedEntry && cluesInCell.some((ci) => ci.entryId === selectedEntry.id)) {
        // Toggle to other clue if intersection
        if (cluesInCell.length > 1) {
          const other = cluesInCell.find((ci) => ci.entryId !== selectedEntry.id);
          if (other) {
            setSelectedEntryId(other.entryId);
          }
        }
      } else {
        // Select the first clue in this cell
        setSelectedEntryId(cluesInCell[0].entryId);
      }
    } else {
      // Cell is empty: if an entry is currently selected, quick-set its start coordinates!
      if (selectedEntryId) {
        handleUpdateEntry(selectedEntryId, "row", r);
        handleUpdateEntry(selectedEntryId, "col", c);
      }
    }
  };

  // -------------------------------------------------------------
  // Validation and Save Logic (Atomic Firestore Batch)
  // -------------------------------------------------------------

  const handleSaveCrossword = async (targetStatus?: "draft" | "ready") => {
    if (!eventId || !activityId) return;

    setSaveErrorNotice(null);
    setSaveSuccessNotice(null);

    // 1. Validate Crossword Title
    if (!crosswordTitle.trim()) {
      setSaveErrorNotice("Please provide a valid Crossword Title.");
      return;
    }

    // 2. Validate Entries
    if (entries.length === 0) {
      setSaveErrorNotice("A Crossword must contain at least 1 clue entry.");
      return;
    }

    const finalStatus = targetStatus || crosswordStatus;

    // If attempting to mark READY, require 0 validation errors
    if (finalStatus === "ready" && !compiledGrid.isValid) {
      const errCount = compiledGrid.validationErrors.length;
      setSaveErrorNotice(
        `Cannot mark as READY: please resolve all ${errCount} validation issue${errCount === 1 ? "" : "s"} before finalizing.`
      );
      return;
    }

    setIsSaving(true);

    try {
      await saveCrosswordConfiguration(
        eventId,
        activityId,
        {
          title: crosswordTitle.trim(),
          description: crosswordDescription.trim(),
          status: finalStatus,
        },
        {
          gridRows,
          gridCols,
        },
        entries,
        deletedEntryIds
      );

      setCrosswordStatus(finalStatus);
      setDeletedEntryIds([]);
      setIsDirty(false);
      setSaveSuccessNotice(
        `Crossword saved successfully! (${compiledGrid.computedEntries.length} clues, ${gridRows}×${gridCols} grid marked as ${finalStatus.toUpperCase()})`
      );

      // Auto-dismiss notice after 4s
      setTimeout(() => {
        setSaveSuccessNotice(null);
      }, 4000);
    } catch (err: any) {
      console.error("Error saving crossword configuration:", err);
      setSaveErrorNotice(
        "Failed to save crossword configuration. Please check your network connection and try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered entries for list view
  const visibleEntries = useMemo(() => {
    if (activeTabFilter === "across") {
      return compiledGrid.computedEntries.filter((e) => e.direction === "across");
    }
    if (activeTabFilter === "down") {
      return compiledGrid.computedEntries.filter((e) => e.direction === "down");
    }
    return compiledGrid.computedEntries;
  }, [compiledGrid.computedEntries, activeTabFilter]);

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

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-between selection:bg-orange-500/30 selection:text-orange-200 font-sans">
      {/* Top Header */}
      <header className="border-b border-neutral-850/80 bg-[#0e0e12]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Left: Back & Breadcrumbs */}
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
                Crossword Builder
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
      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-36">
        <div className="w-full max-w-7xl mx-auto space-y-6">

          {/* Toasts / Feedback */}
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
                  Loading Crossword Builder...
                </p>
                <p className="text-xs text-neutral-500">
                  Retrieving crossword schema and grid configurations.
                </p>
              </div>
            </div>
          )}

          {/* STATE 2: ERROR */}
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
                  {loadError.type === "unauthorized" ? "Access Denied" : "Error Loading Crossword"}
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

          {/* STATE 3: BUILDER INTERFACE */}
          {!isLoading && !loadError && (
            <div className="space-y-6">

              {/* CARD 1: METADATA & GRID DIMENSIONS */}
              <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-neutral-850">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                        ZERO2ONE EVENTS // ACTIVITY BUILDER
                      </span>
                      <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                        CROSSWORD TYPE
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                      CROSSWORD BUILDER
                    </h1>
                    <p className="text-xs text-neutral-400">
                      Configure custom crossword dimensions, Across & Down clues, answer placements, and live preview.
                    </p>
                  </div>

                  {/* Status Toggle Pill */}
                  <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-1 self-start">
                    <button
                      type="button"
                      onClick={() => {
                        setCrosswordStatus("draft");
                        setIsDirty(true);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        crosswordStatus === "draft"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      DRAFT
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCrosswordStatus("ready");
                        setIsDirty(true);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        crosswordStatus === "ready"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      READY
                    </button>
                  </div>
                </div>

                {/* Fields: Title & Description */}
                <div className="grid grid-cols-1 gap-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                        <span>Crossword Title</span>
                        <span className="text-orange-500">*</span>
                      </label>
                      <span className="text-[10px] text-neutral-500">
                        {crosswordTitle.length}/100
                      </span>
                    </div>
                    <input
                      type="text"
                      value={crosswordTitle}
                      maxLength={100}
                      onChange={(e) => {
                        setCrosswordTitle(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="e.g. Engineering Terms & Failure Modes"
                      className="w-full px-4 py-3 rounded-xl bg-neutral-900/90 border border-neutral-800 focus:border-orange-500 text-white placeholder-neutral-500 text-sm font-medium focus:outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-neutral-300 uppercase tracking-wider">
                        Description (Optional)
                      </label>
                      <span className="text-[10px] text-neutral-500">
                        {crosswordDescription.length}/300
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={crosswordDescription}
                      maxLength={300}
                      onChange={(e) => {
                        setCrosswordDescription(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="e.g. Fill in the critical terms from industrial case studies."
                      className="w-full px-4 py-3 rounded-xl bg-neutral-900/90 border border-neutral-800 focus:border-orange-500 text-white placeholder-neutral-500 text-xs font-normal focus:outline-none transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Grid Dimensions Configurator */}
                <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sliders size={16} className="text-orange-400" />
                      <span className="text-xs font-black text-white uppercase tracking-wider">
                        Grid Dimension Configuration (Min 5×5, Max 25×25)
                      </span>
                    </div>

                    <span className="text-xs font-mono font-bold text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20 self-start sm:self-auto">
                      Current Grid: {gridRows} Rows × {gridCols} Cols ({gridRows * gridCols} Cells)
                    </span>
                  </div>

                  {/* Dimension Presets */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase mr-1">Presets:</span>
                    {GRID_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setGridRows(preset.rows);
                          setGridCols(preset.cols);
                          setIsDirty(true);
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          gridRows === preset.rows && gridCols === preset.cols
                            ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                            : "bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-750"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom Row / Col Steppers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-800">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
                        <span>Grid Rows (Height)</span>
                        <span className="text-[10px] font-mono text-neutral-500">5 – 25</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={5}
                          max={25}
                          value={gridRows}
                          onChange={(e) => {
                            setGridRows(parseInt(e.target.value) || 12);
                            setIsDirty(true);
                          }}
                          className="flex-1 accent-orange-500 cursor-pointer"
                        />
                        <input
                          type="number"
                          min={5}
                          max={25}
                          value={gridRows}
                          onChange={(e) => {
                            const val = Math.max(5, Math.min(25, parseInt(e.target.value) || 5));
                            setGridRows(val);
                            setIsDirty(true);
                          }}
                          className="w-16 px-2.5 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono text-xs font-bold text-center focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
                        <span>Grid Columns (Width)</span>
                        <span className="text-[10px] font-mono text-neutral-500">5 – 25</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={5}
                          max={25}
                          value={gridCols}
                          onChange={(e) => {
                            setGridCols(parseInt(e.target.value) || 12);
                            setIsDirty(true);
                          }}
                          className="flex-1 accent-orange-500 cursor-pointer"
                        />
                        <input
                          type="number"
                          min={5}
                          max={25}
                          value={gridCols}
                          onChange={(e) => {
                            const val = Math.max(5, Math.min(25, parseInt(e.target.value) || 5));
                            setGridCols(val);
                            setIsDirty(true);
                          }}
                          className="w-16 px-2.5 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono text-xs font-bold text-center focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0">
                      <Grid size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase">Total Clues</div>
                      <div className="text-sm font-black text-white">{entries.length} clues</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                      <Sliders size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase">Directions</div>
                      <div className="text-xs font-bold text-neutral-300">
                        {compiledGrid.acrossCount} Across / {compiledGrid.downCount} Down
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                      <Hash size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase">Grid Letters</div>
                      <div className="text-sm font-black text-white">{compiledGrid.totalLetters} cells</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      compiledGrid.isValid ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {compiledGrid.isValid ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase">Validation</div>
                      <div className={`text-xs font-black uppercase ${
                        compiledGrid.isValid ? "text-emerald-400" : "text-amber-400"
                      }`}>
                        {compiledGrid.isValid ? "Valid Grid" : `${compiledGrid.validationErrors.length} Issue(s)`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* TWO COLUMN WORKSPACE: CLUES LIST + LIVE GRID PREVIEW */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* LEFT: CLUE MANAGEMENT COLUMN (7 Cols on LG) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Clues Top Bar */}
                  <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-black text-white uppercase tracking-wider">
                          CLUE ENTRIES ({entries.length})
                        </h2>
                      </div>

                      {/* Add Clue Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddEntry("across")}
                          className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-md shadow-orange-500/15"
                        >
                          <Plus size={13} className="stroke-[3]" />
                          <span>+ ACROSS</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAddEntry("down")}
                          className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-white font-bold text-xs uppercase tracking-wider border border-neutral-700 transition-all cursor-pointer flex items-center gap-1 shadow-md"
                        >
                          <Plus size={13} className="stroke-[3]" />
                          <span>+ DOWN</span>
                        </button>
                      </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setActiveTabFilter("all")}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                          activeTabFilter === "all"
                            ? "bg-neutral-800 text-white shadow-sm"
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        All ({entries.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTabFilter("across")}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                          activeTabFilter === "across"
                            ? "bg-orange-500/20 text-orange-300 border border-orange-500/30 shadow-sm"
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        Across ({compiledGrid.acrossCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTabFilter("down")}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                          activeTabFilter === "down"
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        Down ({compiledGrid.downCount})
                      </button>
                    </div>
                  </div>

                  {/* Clues List */}
                  <div className="space-y-4">
                    {visibleEntries.length === 0 ? (
                      <div className="bg-[#0e0e12] border border-neutral-800 rounded-3xl p-8 text-center space-y-3">
                        <HelpCircle size={28} className="text-neutral-500 mx-auto" />
                        <p className="text-xs text-neutral-400 font-semibold">
                          No {activeTabFilter.toUpperCase()} clues created yet. Click <span className="text-orange-400 font-bold">+ ACROSS</span> or <span className="text-orange-400 font-bold">+ DOWN</span> to add your first clue.
                        </p>
                      </div>
                    ) : (
                      visibleEntries.map((entry, idx) => {
                        const isSelected = selectedEntryId === entry.id;
                        const entryError = compiledGrid.validationErrors.find((v) => v.entryId === entry.id);
                        const isAcross = entry.direction === "across";

                        return (
                          <motion.div
                            key={entry.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`bg-[#0e0e12] border rounded-3xl p-5 shadow-xl space-y-4 transition-all cursor-pointer ${
                              isSelected
                                ? "border-orange-500/60 ring-1 ring-orange-500/30 bg-orange-950/10"
                                : entryError
                                ? "border-red-500/40 bg-red-950/5 hover:border-red-500/60"
                                : "border-neutral-800 hover:border-neutral-700"
                            }`}
                            onClick={() => setSelectedEntryId(entry.id)}
                          >
                            {/* Clue Header Bar */}
                            <div className="flex items-center justify-between gap-2 pb-3 border-b border-neutral-850">
                              <div className="flex items-center gap-2">
                                {/* Clue Number Badge */}
                                <span
                                  className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shadow-md ${
                                    isAcross
                                      ? "bg-orange-500 text-white shadow-orange-500/20"
                                      : "bg-cyan-600 text-white shadow-cyan-500/20"
                                  }`}
                                >
                                  {entry.number}
                                </span>

                                {/* Direction Toggle */}
                                <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl p-0.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateEntry(entry.id, "direction", "across");
                                    }}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                                      isAcross
                                        ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                                        : "text-neutral-500 hover:text-neutral-300"
                                    }`}
                                  >
                                    ACROSS
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateEntry(entry.id, "direction", "down");
                                    }}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                                      !isAcross
                                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                        : "text-neutral-500 hover:text-neutral-300"
                                    }`}
                                  >
                                    DOWN
                                  </button>
                                </div>

                                {entryError ? (
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                                    <AlertCircle size={10} />
                                    <span>ISSUE</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                    <Check size={10} />
                                    <span>VALID</span>
                                  </span>
                                )}
                              </div>

                              {/* Action Tools */}
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleMoveEntry(entry.id, "up")}
                                  disabled={idx === 0}
                                  className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 disabled:opacity-25 transition-all cursor-pointer"
                                  title="Move Up"
                                  aria-label="Move Up"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveEntry(entry.id, "down")}
                                  disabled={idx === visibleEntries.length - 1}
                                  className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 disabled:opacity-25 transition-all cursor-pointer"
                                  title="Move Down"
                                  aria-label="Move Down"
                                >
                                  <ArrowDown size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateEntry(entry.id)}
                                  className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-all cursor-pointer"
                                  title="Duplicate Clue"
                                  aria-label="Duplicate Clue"
                                >
                                  <Copy size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(entry.id)}
                                  className="p-1.5 rounded-lg bg-neutral-900 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-neutral-400 border border-neutral-800 transition-all cursor-pointer"
                                  title="Delete Clue"
                                  aria-label="Delete Clue"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Inline Error Messages */}
                            {entryError && entryError.errors.length > 0 && (
                              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs space-y-1">
                                {entryError.errors.map((errStr, eIdx) => (
                                  <div key={eIdx} className="flex items-center gap-1.5">
                                    <span className="w-1 h-1 rounded-full bg-red-400" />
                                    <span>{errStr}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Clue Prompt Text */}
                            <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
                                <span>Clue Hint / Prompt</span>
                                <span className="text-[10px] text-neutral-500">Required</span>
                              </label>
                              <input
                                type="text"
                                value={entry.clue}
                                onChange={(e) => handleUpdateEntry(entry.id, "clue", e.target.value)}
                                placeholder="e.g. The Texas power grid system that failed during freeze"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 focus:border-orange-500 text-white placeholder-neutral-500 text-xs font-medium focus:outline-none transition-all"
                              />
                            </div>

                            {/* Answer Word & Placement Grid Coordinates */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3" onClick={(e) => e.stopPropagation()}>
                              {/* Answer Input (7 cols) */}
                              <div className="sm:col-span-6 space-y-1.5">
                                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
                                  <span>Answer Key</span>
                                  <span className="text-[10px] font-mono text-orange-400 font-bold">
                                    {entry.answer ? `${entry.answer.length} Letters` : "A-Z"}
                                  </span>
                                </label>
                                <input
                                  type="text"
                                  value={entry.answer}
                                  onChange={(e) => handleUpdateEntry(entry.id, "answer", e.target.value)}
                                  placeholder="e.g. FREEZE"
                                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-orange-500 text-white font-mono text-xs font-bold tracking-widest uppercase focus:outline-none transition-all"
                                />
                              </div>

                              {/* Start Row (3 cols) */}
                              <div className="sm:col-span-3 space-y-1.5">
                                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
                                  <span>Row (Y)</span>
                                  <span className="text-[10px] font-mono text-neutral-500">1-{gridRows}</span>
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={gridRows}
                                  value={entry.row + 1}
                                  onChange={(e) =>
                                    handleUpdateEntry(
                                      entry.id,
                                      "row",
                                      Math.max(0, (parseInt(e.target.value) || 1) - 1)
                                    )
                                  }
                                  className="w-full px-2.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-orange-500 text-white font-mono text-xs font-bold text-center focus:outline-none transition-all"
                                />
                              </div>

                              {/* Start Col (3 cols) */}
                              <div className="sm:col-span-3 space-y-1.5">
                                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
                                  <span>Col (X)</span>
                                  <span className="text-[10px] font-mono text-neutral-500">1-{gridCols}</span>
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={gridCols}
                                  value={entry.col + 1}
                                  onChange={(e) =>
                                    handleUpdateEntry(
                                      entry.id,
                                      "col",
                                      Math.max(0, (parseInt(e.target.value) || 1) - 1)
                                    )
                                  }
                                  className="w-full px-2.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-orange-500 text-white font-mono text-xs font-bold text-center focus:outline-none transition-all"
                                />
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* RIGHT: LIVE CROSSWORD GRID PREVIEW (5 Cols on LG) */}
                <div className="lg:col-span-5 space-y-4 sticky top-20">
                  <div className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-850">
                      <div className="flex items-center gap-2">
                        <Grid3X3 size={18} className="text-orange-400" />
                        <h2 className="text-sm font-black text-white uppercase tracking-wider">
                          GRID PREVIEW ({gridRows}×{gridCols})
                        </h2>
                      </div>

                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
                        HOST KEY VIEW
                      </span>
                    </div>

                    {/* Interactive Matrix Display */}
                    <div className="p-3 bg-neutral-950/90 border border-neutral-800 rounded-2xl overflow-x-auto flex justify-center">
                      <div
                        className="grid gap-[2px] bg-neutral-900 p-1.5 rounded-xl select-none"
                        style={{
                          gridTemplateColumns: `repeat(${gridCols}, minmax(18px, 1fr))`,
                          width: "100%",
                          maxWidth: "420px",
                        }}
                      >
                        {Array.from({ length: gridRows }).map((_, r) =>
                          Array.from({ length: gridCols }).map((_, c) => {
                            const cellKey = `${r},${c}`;
                            const letter = compiledGrid.matrix[r][c];
                            const startNum = compiledGrid.cellStartNumberMap[cellKey];
                            const isPartOfSelected = selectedCellCoords.has(cellKey);
                            const cluesInCell = compiledGrid.cellCluesMap[cellKey] || [];
                            const hasClues = cluesInCell.length > 0;

                            return (
                              <button
                                key={cellKey}
                                type="button"
                                onClick={() => handleGridCellClick(r, c)}
                                className={`aspect-square rounded-[4px] relative flex items-center justify-center transition-all text-xs font-black cursor-pointer ${
                                  isPartOfSelected
                                    ? "bg-orange-500 text-white ring-2 ring-orange-400 z-10 shadow-md shadow-orange-500/30"
                                    : letter !== null
                                    ? "bg-neutral-800 text-white hover:bg-neutral-750 border border-neutral-700"
                                    : "bg-neutral-950/90 text-neutral-800 hover:bg-neutral-900 border border-neutral-900"
                                }`}
                                title={
                                  letter !== null
                                    ? `Row ${r + 1}, Col ${c + 1}: '${letter}'`
                                    : `Row ${r + 1}, Col ${c + 1} (Empty - click to place active clue)`
                                }
                              >
                                {/* Clue Number Label Top-Left */}
                                {startNum && (
                                  <span
                                    className={`absolute top-0.5 left-0.5 text-[8px] font-bold leading-none ${
                                      isPartOfSelected ? "text-white/90" : "text-orange-400"
                                    }`}
                                  >
                                    {startNum}
                                  </span>
                                )}

                                {/* Letter Content */}
                                <span className={isPartOfSelected ? "scale-110" : ""}>
                                  {letter || ""}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Selected Clue Inspector Banner */}
                    {selectedEntry ? (
                      <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider">
                            SELECTED: #{selectedEntry.number} {selectedEntry.direction.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-400">
                            Start: R{selectedEntry.row + 1}, C{selectedEntry.col + 1}
                          </span>
                        </div>
                        <p className="font-bold text-white text-xs line-clamp-2">
                          {selectedEntry.clue || "(No clue text entered)"}
                        </p>
                        <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-neutral-300">
                          <span>Answer:</span>
                          <span className="font-bold text-orange-300 tracking-wider">
                            {selectedEntry.answer || "(None)"}
                          </span>
                          <span className="text-neutral-500">
                            ({selectedEntry.answer.length} letters)
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-center text-neutral-500 text-xs font-medium">
                        Click any cell or clue to inspect its coordinates and position.
                      </div>
                    )}

                    {/* Legend & Instructions */}
                    <div className="text-[11px] text-neutral-400 space-y-1 bg-neutral-900/40 p-3 rounded-xl border border-neutral-850">
                      <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
                        <Info size={13} className="text-orange-400 shrink-0" />
                        <span>Host Helper:</span>
                      </div>
                      <p>
                        • Click an empty cell on the preview grid to instantly set the start coordinates of the active clue.
                      </p>
                      <p>
                        • Number labels (1, 2, 3...) are automatically assigned in reading order.
                      </p>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      </main>

      {/* STICKY BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0e0e12]/95 backdrop-blur border-t border-neutral-800/90 py-3.5 px-4 sm:px-6 lg:px-8 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Summary / Status */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-400">Status:</span>
              <span
                className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  crosswordStatus === "ready"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                }`}
              >
                {crosswordStatus}
              </span>
            </div>

            <span className="text-xs font-semibold text-neutral-500 hidden sm:inline">|</span>

            <span className="text-xs font-semibold text-neutral-400">
              {entries.length} Clues configured ({gridRows}×{gridCols} grid)
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => handleProtectedNavigate(`/events/host/events/${eventId}/activities`)}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Cancel
            </button>

            {/* Save as Draft */}
            <button
              type="button"
              onClick={() => handleSaveCrossword("draft")}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>Save Draft</span>
            </button>

            {/* Save & Ready */}
            <button
              type="button"
              onClick={() => handleSaveCrossword("ready")}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-orange-500/20 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              <span>Save Crossword</span>
            </button>
          </div>
        </div>
      </div>

      {/* UNSAVED CHANGES MODAL */}
      <AnimatePresence>
        {showUnsavedModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0e0e12] border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <AlertCircle size={24} />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  Unsaved Crossword Changes
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  You have unsaved changes in your crossword configuration. If you leave now, your modifications will be discarded.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUnsavedModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs uppercase tracking-wider border border-neutral-800 transition-all cursor-pointer"
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
                  className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-red-500/20"
                >
                  Discard Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0e0e12] border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  Delete Clue Entry?
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Are you sure you want to delete this clue from your crossword? This action cannot be undone once saved.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs uppercase tracking-wider border border-neutral-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteEntry(deleteConfirmId)}
                  className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-red-500/20"
                >
                  Delete Clue
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
