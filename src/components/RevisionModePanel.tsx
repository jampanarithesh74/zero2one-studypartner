import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookMarked,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flame,
  HelpCircle,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { RevisionPack } from "../types/revision";

interface RevisionModePanelProps {
  noteUrl: string;
  fallbackOpenUrl?: string;
  year: number | string;
  dept: string;
  sem: number | string;
  subject: string;
  unitTitle: string;
  getAuthToken: () => Promise<string | null>;
  onClose?: () => void;
}

type RevisionTab = "topics" | "questions" | "checklist" | "mcqs";
type MarkFilter = "all" | 2 | 5 | 10;

const PACK_CACHE_PREFIX = "zero2one_revision_pack_v1:";
const CHECKLIST_CACHE_PREFIX = "zero2one_revision_checklist_v1:";
const REQUEST_TIMEOUT_MS = 30000;

function isValidRevisionPack(data: any): data is RevisionPack {
  return (
    Boolean(data) &&
    Array.isArray(data.importantTopics) &&
    Array.isArray(data.importantQuestions) &&
    Array.isArray(data.quickChecklist) &&
    Array.isArray(data.mcqs) &&
    (data.importantTopics.length > 0 ||
      data.importantQuestions.length > 0 ||
      data.quickChecklist.length > 0 ||
      data.mcqs.length > 0)
  );
}

export const RevisionModePanel: React.FC<RevisionModePanelProps> = ({
  noteUrl,
  fallbackOpenUrl,
  year,
  dept,
  sem,
  subject,
  unitTitle,
  getAuthToken,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<RevisionTab>("topics");
  const [pack, setPack] = useState<RevisionPack | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState<boolean>(false);

  const activeControllerRef = useRef<AbortController | null>(null);

  // Questions tab state
  const [markFilter, setMarkFilter] = useState<MarkFilter>("all");
  const [expandedQuestionIdxs, setExpandedQuestionIdxs] = useState<Record<number, boolean>>({ 0: true });

  // Checklist tab state (persisted in localStorage keyed by noteUrl)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // MCQs tab state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});

  const packCacheKey = `${PACK_CACHE_PREFIX}${noteUrl}`;
  const checklistCacheKey = `${CHECKLIST_CACHE_PREFIX}${noteUrl}`;

  // Load persisted checklist checks whenever noteUrl changes
  useEffect(() => {
    if (!noteUrl) {
      setCheckedItems({});
      return;
    }
    try {
      const saved = localStorage.getItem(checklistCacheKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setCheckedItems(parsed);
          return;
        }
      }
    } catch {
      // Ignore storage read errors
    }
    setCheckedItems({});
  }, [checklistCacheKey, noteUrl]);

  const fetchRevisionPack = async (bypassCache = false) => {
    // Cancel any previous in-flight request cleanly
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
      activeControllerRef.current = null;
    }

    if (!noteUrl) {
      setError("No readable note file or link is attached to this unit.");
      setPack(null);
      setIsGenerating(false);
      return;
    }

    if (!bypassCache) {
      try {
        const cachedRaw = localStorage.getItem(packCacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (isValidRevisionPack(cached)) {
            setPack(cached);
            setFromCache(true);
            setError(null);
            setIsGenerating(false);
            return;
          }
        }
      } catch {
        // Ignore corrupt cache and proceed to fetch
      }
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    setIsGenerating(true);
    setError(null);
    setFromCache(false);

    try {
      const token = await getAuthToken();
      if (controller.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      if (!token) {
        setError("Your student sign-in session could not be verified. Please sign in again to use Revision Mode.");
        setPack(null);
        return;
      }

      const response = await fetch("/api/revision", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          year,
          dept,
          sem,
          subject,
          unitTitle,
          fileUrl: noteUrl,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || `Could not build Revision Mode for these notes (HTTP ${response.status}).`);
        setPack(null);
        return;
      }

      if (!isValidRevisionPack(data?.revisionPack)) {
        setError("Revision Mode received an incomplete response. Please try regenerating.");
        setPack(null);
        return;
      }

      setPack(data.revisionPack);
      setExpandedQuestionIdxs({ 0: true });
      setSelectedAnswers({});
      try {
        localStorage.setItem(packCacheKey, JSON.stringify(data.revisionPack));
      } catch {
        // Ignore storage quota errors
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        if (didTimeout) {
          setError(
            "Revision Mode timed out after 30 seconds while analyzing these notes. Please retry or open the notes directly."
          );
          setPack(null);
        }
        return;
      }
      setError(err?.message || "Network error while generating Revision Mode. Please try again.");
      setPack(null);
    } finally {
      window.clearTimeout(timeoutId);
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
        setIsGenerating(false);
      } else if (!activeControllerRef.current) {
        setIsGenerating(false);
      }
    }
  };

  useEffect(() => {
    setSelectedAnswers({});
    setMarkFilter("all");
    fetchRevisionPack(false);

    return () => {
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
        activeControllerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteUrl]);

  const toggleChecklistItem = (id: string) => {
    setCheckedItems((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(checklistCacheKey, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  };

  const resetChecklist = () => {
    setCheckedItems({});
    try {
      localStorage.removeItem(checklistCacheKey);
    } catch {
      // Ignore
    }
  };

  const filteredQuestions = useMemo(() => {
    if (!pack) return [];
    return pack.importantQuestions
      .map((q, originalIdx) => ({ ...q, originalIdx }))
      .filter((q) => (markFilter === "all" ? true : q.marks === markFilter));
  }, [pack, markFilter]);

  const checklistProgress = useMemo(() => {
    const items = pack?.quickChecklist || [];
    const done = items.filter((item) => Boolean(checkedItems[item.id])).length;
    const total = items.length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, percent };
  }, [pack, checkedItems]);

  const mcqStats = useMemo(() => {
    const items = pack?.mcqs || [];
    let answered = 0;
    let correct = 0;
    for (const mcq of items) {
      const chosen = selectedAnswers[mcq.id];
      if (typeof chosen === "number") {
        answered++;
        if (chosen === mcq.correctIndex) correct++;
      }
    }
    return { answered, correct, total: items.length };
  }, [pack, selectedAnswers]);

  const questionCounts = useMemo(() => {
    const qs = pack?.importantQuestions || [];
    return {
      all: qs.length,
      m2: qs.filter((q) => q.marks === 2).length,
      m5: qs.filter((q) => q.marks === 5).length,
      m10: qs.filter((q) => q.marks === 10).length,
    };
  }, [pack]);

  const tabs: { id: RevisionTab; label: string; count?: number; icon: React.ReactNode }[] = [
    {
      id: "topics",
      label: "Important Topics",
      count: pack?.importantTopics.length,
      icon: <Flame size={13} />,
    },
    {
      id: "questions",
      label: "Important Questions",
      count: pack?.importantQuestions.length,
      icon: <BookMarked size={13} />,
    },
    {
      id: "checklist",
      label: "Quick-Revise Checklist",
      count: pack?.quickChecklist.length,
      icon: <ListChecks size={13} />,
    },
    {
      id: "mcqs",
      label: "Quick MCQs",
      count: pack?.mcqs.length,
      icon: <HelpCircle size={13} />,
    },
  ];

  const isDriveUrl = Boolean(fallbackOpenUrl && /drive\.google\.com|docs\.google\.com/i.test(fallbackOpenUrl));

  return (
    <div className="w-full rounded-2xl bg-[#09090b] text-neutral-100 border border-neutral-800/90 shadow-2xl overflow-hidden animate-fadeIn">
      {/* Editorial Top Header */}
      <div className="p-5 md:p-6 bg-gradient-to-br from-[#121215] via-[#0c0c0f] to-[#09090b] border-b border-neutral-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[10px] font-black uppercase tracking-[0.18em]">
                <Sparkles size={11} />
                Revision Mode
              </span>
              {fromCache && !isGenerating && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-md">
                  Saved Offline
                </span>
              )}
            </div>
            <h3 className="text-base md:text-lg font-black tracking-tight text-white leading-snug">
              {unitTitle}
            </h3>
            <p className="text-[11px] text-neutral-400 font-medium truncate">
              Grounded strictly in your attached unit notes
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => fetchRevisionPack(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-neutral-700/80 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
              title="Regenerate fresh revision pack from notes"
            >
              <RefreshCw size={13} className={isGenerating ? "animate-spin text-orange-400" : "text-orange-400"} />
              {isGenerating ? "Generating..." : "Regenerate"}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl bg-neutral-900/70 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 text-xs font-bold transition-all cursor-pointer"
              >
                Notes View
              </button>
            )}
          </div>
        </div>

        {/* Context Metadata Strip */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-neutral-300">
          <span className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800">
            Yr 0{year}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 max-w-[220px] truncate">
            {dept}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800">
            Sem 0{sem}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/25 text-orange-300 max-w-full truncate">
            {subject}
          </span>
        </div>
      </div>

      {/* Loading Skeleton (only while isGenerating is true) */}
      {isGenerating && (
        <div className="p-5 md:p-6 space-y-5">
          <div className="flex items-center gap-3 text-xs font-bold text-orange-400">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            <span>Reading your notes & distilling exam-focused revision pack...</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-9 rounded-xl bg-neutral-900 border border-neutral-800 animate-pulse" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="p-4 rounded-xl bg-[#0e0e11] border border-neutral-800/80 space-y-2.5 animate-pulse"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="h-4 w-48 bg-neutral-800 rounded" />
                  <div className="h-5 w-16 bg-orange-500/20 rounded-md" />
                </div>
                <div className="h-3 w-full bg-neutral-800/70 rounded" />
                <div className="h-3 w-3/4 bg-neutral-800/50 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clear Fallback Error Card */}
      {!isGenerating && error && (
        <div className="p-6 md:p-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <AlertTriangle size={22} />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h4 className="text-sm font-black text-white">Could Not Generate Revision Mode</h4>
            <p className="text-xs text-neutral-300 leading-relaxed">{error}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => fetchRevisionPack(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw size={13} /> Retry
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs font-bold transition-all cursor-pointer"
              >
                Back to Notes View
              </button>
            )}
            {fallbackOpenUrl && (
              <a
                href={fallbackOpenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-orange-300 border border-orange-500/30 text-xs font-bold transition-all"
              >
                <ExternalLink size={13} /> {isDriveUrl ? "Open in Drive" : "Open Notes"}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Loaded Revision Pack Content */}
      {!isGenerating && !error && pack && (
        <div className="flex flex-col">
          {/* Section Navigation Tabs */}
          <div className="px-4 md:px-6 pt-4 pb-3 border-b border-neutral-800/80 bg-[#0b0b0e] flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    isActive
                      ? "bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-500/15"
                      : "bg-neutral-900/90 text-neutral-400 hover:text-neutral-100 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {typeof tab.count === "number" && (
                    <span
                      className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-black ${
                        isActive ? "bg-black/25 text-white" : "bg-neutral-800 text-neutral-300"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Body */}
          <div className="p-5 md:p-6 space-y-4">
            {/* TAB 1: IMPORTANT TOPICS */}
            {activeTab === "topics" && (
              <div className="space-y-3">
                {pack.importantTopics.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-4 text-center">No topics extracted from these notes.</p>
                ) : (
                  pack.importantTopics.map((item, idx) => (
                    <div
                      key={`${item.topic}-${idx}`}
                      className="p-4 rounded-xl bg-[#101014] border border-neutral-800/90 hover:border-orange-500/35 transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="mt-0.5 w-6 h-6 rounded-lg bg-neutral-900 border border-neutral-800 text-[10px] font-mono font-black text-orange-400 flex items-center justify-center shrink-0">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <h4 className="text-sm font-extrabold text-white leading-snug">{item.topic}</h4>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 border ${
                            item.priority === "High"
                              ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                              : "bg-neutral-800 text-neutral-300 border-neutral-700"
                          }`}
                        >
                          {item.priority} Priority
                        </span>
                      </div>
                      <p className="text-xs text-neutral-300 leading-relaxed pl-8.5">{item.whyImportant}</p>
                      <div className="pl-8.5 pt-0.5">
                        <span className="inline-block text-[10px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded">
                          Ref: {item.noteRef}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 2: IMPORTANT QUESTIONS */}
            {activeTab === "questions" && (
              <div className="space-y-4">
                {/* Mark filter strip */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { key: "all", label: `All (${questionCounts.all})` },
                        { key: 2, label: `2M (${questionCounts.m2})` },
                        { key: 5, label: `5M (${questionCounts.m5})` },
                        { key: 10, label: `10M (${questionCounts.m10})` },
                      ] as { key: MarkFilter; label: string }[]
                    ).map((f) => (
                      <button
                        key={String(f.key)}
                        type="button"
                        onClick={() => setMarkFilter(f.key)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                          markFilter === f.key
                            ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                            : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 border-neutral-800"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {filteredQuestions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const anyClosed = filteredQuestions.some((q) => !expandedQuestionIdxs[q.originalIdx]);
                        const next: Record<number, boolean> = { ...expandedQuestionIdxs };
                        filteredQuestions.forEach((q) => {
                          next[q.originalIdx] = anyClosed;
                        });
                        setExpandedQuestionIdxs(next);
                      }}
                      className="text-[11px] font-bold text-neutral-400 hover:text-orange-400 transition-colors cursor-pointer"
                    >
                      {filteredQuestions.some((q) => !expandedQuestionIdxs[q.originalIdx])
                        ? "Expand all key points"
                        : "Collapse all"}
                    </button>
                  )}
                </div>

                {filteredQuestions.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-6 text-center">
                    No {markFilter === "all" ? "" : `${markFilter}-mark `}questions in this pack.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredQuestions.map((q) => {
                      const isExpanded = Boolean(expandedQuestionIdxs[q.originalIdx]);
                      return (
                        <div
                          key={q.originalIdx}
                          className="rounded-xl bg-[#101014] border border-neutral-800/90 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedQuestionIdxs((prev) => ({
                                ...prev,
                                [q.originalIdx]: !prev[q.originalIdx],
                              }))
                            }
                            className="w-full p-4 text-left flex items-start justify-between gap-3 hover:bg-neutral-900/50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <span
                                className={`mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-black shrink-0 border ${
                                  q.marks === 10
                                    ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                                    : q.marks === 5
                                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                    : "bg-neutral-800 text-neutral-200 border-neutral-700"
                                }`}
                              >
                                {q.marks}M
                              </span>
                              <div className="space-y-1.5 min-w-0">
                                <p className="text-xs md:text-sm font-bold text-white leading-snug">
                                  {q.question}
                                </p>
                                <span className="inline-block text-[10px] font-mono text-neutral-400">
                                  Ref: {q.noteRef}
                                </span>
                              </div>
                            </div>
                            <span className="text-neutral-400 shrink-0 mt-0.5">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-4 pt-1 border-t border-neutral-800/60 bg-[#0b0b0e]">
                              <p className="text-[10px] font-black uppercase tracking-widest text-orange-400 mb-2 mt-2">
                                Key Answer Points
                              </p>
                              <ul className="space-y-1.5">
                                {q.keyPoints.map((kp, kpIdx) => (
                                  <li key={kpIdx} className="flex items-start gap-2 text-xs text-neutral-300 leading-relaxed">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                                    <span>{kp}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: QUICK-REVISE CHECKLIST */}
            {activeTab === "checklist" && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-[#101014] border border-neutral-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-neutral-200">
                        {checklistProgress.done} of {checklistProgress.total} checks completed
                      </span>
                      <span className="font-mono font-black text-orange-400">{checklistProgress.percent}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full bg-orange-500 transition-all duration-300"
                        style={{ width: `${checklistProgress.percent}%` }}
                      />
                    </div>
                  </div>
                  {checklistProgress.done > 0 && (
                    <button
                      type="button"
                      onClick={resetChecklist}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 text-[11px] font-bold transition-colors cursor-pointer shrink-0 self-start sm:self-center"
                    >
                      <RotateCcw size={11} /> Reset
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {pack.quickChecklist.map((item) => {
                    const isChecked = Boolean(checkedItems[item.id]);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleChecklistItem(item.id)}
                        className={`w-full p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                          isChecked
                            ? "bg-emerald-950/20 border-emerald-500/30 text-neutral-400"
                            : "bg-[#101014] border-neutral-800/90 hover:border-orange-500/35 text-neutral-100"
                        }`}
                      >
                        <span
                          className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                            isChecked
                              ? "bg-emerald-500 border-emerald-400 text-black"
                              : "bg-neutral-900 border-neutral-700"
                          }`}
                        >
                          {isChecked && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className={`text-xs md:text-sm leading-relaxed ${isChecked ? "line-through text-neutral-500" : "font-medium"}`}>
                          {item.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 4: QUICK MCQs */}
            {activeTab === "mcqs" && (
              <div className="space-y-4">
                {/* Scoreboard bar */}
                <div className="p-3.5 rounded-xl bg-[#101014] border border-neutral-800/90 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-black uppercase tracking-wider text-orange-400">
                      Score: {mcqStats.correct} / {mcqStats.total}
                    </span>
                    <span className="text-neutral-500">•</span>
                    <span className="text-neutral-300 font-medium">
                      {mcqStats.answered} of {mcqStats.total} answered
                    </span>
                  </div>
                  {mcqStats.answered > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedAnswers({})}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <RotateCcw size={11} /> Reset Quiz
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {pack.mcqs.map((mcq, qIdx) => {
                    const chosen = selectedAnswers[mcq.id];
                    const hasAnswered = typeof chosen === "number";
                    const isCorrect = hasAnswered && chosen === mcq.correctIndex;

                    return (
                      <div
                        key={mcq.id}
                        className="p-4 rounded-xl bg-[#101014] border border-neutral-800/90 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs md:text-sm font-bold text-white leading-snug">
                            <span className="text-orange-400 font-mono mr-2">Q{qIdx + 1}.</span>
                            {mcq.question}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          {mcq.options.map((opt, oIdx) => {
                            const isThisChosen = chosen === oIdx;
                            const isThisCorrect = oIdx === mcq.correctIndex;

                            let optStyle =
                              "bg-neutral-900/90 border-neutral-800 text-neutral-200 hover:border-orange-500/40 hover:bg-neutral-900";
                            if (hasAnswered) {
                              if (isThisCorrect) {
                                optStyle = "bg-emerald-950/40 border-emerald-500/60 text-emerald-200";
                              } else if (isThisChosen) {
                                optStyle = "bg-red-950/40 border-red-500/60 text-red-200";
                              } else {
                                optStyle = "bg-neutral-900/40 border-neutral-800/60 text-neutral-500";
                              }
                            }

                            return (
                              <button
                                key={oIdx}
                                type="button"
                                disabled={hasAnswered}
                                onClick={() =>
                                  setSelectedAnswers((prev) => ({
                                    ...prev,
                                    [mcq.id]: oIdx,
                                  }))
                                }
                                className={`w-full px-3.5 py-2.5 rounded-xl border text-left text-xs font-medium flex items-center justify-between gap-2.5 transition-all ${
                                  hasAnswered ? "cursor-default" : "cursor-pointer"
                                } ${optStyle}`}
                              >
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <span className="font-mono text-[10px] font-black uppercase mt-0.5 text-neutral-400 shrink-0">
                                    {String.fromCharCode(65 + oIdx)}.
                                  </span>
                                  <span className="leading-snug">{opt}</span>
                                </div>
                                {hasAnswered && isThisCorrect && (
                                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                                )}
                                {hasAnswered && isThisChosen && !isThisCorrect && (
                                  <XCircle size={15} className="text-red-400 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {hasAnswered && (
                          <div
                            className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                              isCorrect
                                ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-100"
                                : "bg-red-950/20 border-red-500/30 text-red-100"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-black uppercase tracking-wider text-[10px]">
                                {isCorrect ? "Correct Answer" : `Incorrect • Answer: ${String.fromCharCode(65 + mcq.correctIndex)}`}
                              </span>
                              <span className="text-[10px] font-mono text-neutral-400">
                                Ref: {mcq.noteRef}
                              </span>
                            </div>
                            <p className="text-neutral-300 leading-relaxed">{mcq.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
