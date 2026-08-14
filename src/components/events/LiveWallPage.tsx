import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Tv, 
  ArrowLeft, 
  Radio, 
  Sparkles, 
  MessageSquare, 
  Maximize2, 
  Minimize2, 
  Flame,
  Users,
  Trophy,
  Lock,
  CheckCircle2,
  HelpCircle,
  Zap,
  Clock,
  Eye
} from "lucide-react";
import { doc, collection, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { EventItem } from "../PublicEventPage";
import { ActiveQuestionData, LiveAnswerData } from "../EventRoom/LiveRoomPanel";
import { QuizSessionData, QuizLeaderboardEntry } from "../../data/quizQuestions";
import { CROSSWORD_ACTIVITIES, RIDDLE_ACTIVITIES } from "../../data/engineeringFailureData";
import { 
  BroadcastService, 
  ActiveBroadcastData, 
  CrosswordLeaderboardEntry, 
  CrosswordService, 
  RiddleLeaderboardEntry, 
  RiddleService 
} from "../../services/activityService";
import { QuizLeaderboardView } from "./QuizLeaderboardView";

interface AggregatedBubble {
  key: string;
  displayText: string;
  count: number;
  latestTimestamp: number;
  isNewOrUpdated: boolean;
  colorIndex: number;
}

interface LiveWallPageProps {
  isAdmin?: boolean;
}

export function LiveWallPage({ isAdmin }: LiveWallPageProps) {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestionData | null>(null);
  const [answers, setAnswers] = useState<LiveAnswerData[]>([]);
  const [quizSession, setQuizSession] = useState<QuizSessionData | null>(null);
  const [quizLeaderboard, setQuizLeaderboard] = useState<QuizLeaderboardEntry[]>([]);
  const [activeBroadcast, setActiveBroadcast] = useState<ActiveBroadcastData | null>(null);
  const [crosswordLeaderboard, setCrosswordLeaderboard] = useState<CrosswordLeaderboardEntry[]>([]);
  const [riddleLeaderboard, setRiddleLeaderboard] = useState<RiddleLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Track highlighted bubble keys
  const [highlightedKeys, setHighlightedKeys] = useState<Set<string>>(new Set());
  const prevCountsRef = useRef<Map<string, number>>(new Map());

  // Listen to Fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("Error attempting to enable fullscreen:", err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn("Error attempting to exit fullscreen:", err);
        });
      }
    }
  };

  // 1. Listen to Event Details
  useEffect(() => {
    if (!eventId) return;

    const eventRef = doc(db, "events", eventId);
    const unsubEvent = onSnapshot(
      eventRef,
      (snap) => {
        if (snap.exists()) {
          setEvent({ id: snap.id, ...snap.data() } as EventItem);
        } else {
          setEvent(null);
        }
      },
      (err) => console.warn("Live wall event listener error:", err)
    );

    return () => unsubEvent();
  }, [eventId]);

  // 2. Listen to Active Broadcast for entire room
  useEffect(() => {
    if (!eventId) return;
    const unsub = BroadcastService.subscribe(eventId, (data) => {
      setActiveBroadcast(data);
    });
    return () => unsub();
  }, [eventId]);

  // 3. Listen to Crossword & Riddle Leaderboards when active
  useEffect(() => {
    if (!eventId) return;
    const unsubCw = CrosswordService.subscribeLeaderboard(eventId, (lb) => {
      setCrosswordLeaderboard(lb);
    });
    const unsubRd = RiddleService.subscribeLeaderboard(eventId, (lb) => {
      setRiddleLeaderboard(lb);
    });
    return () => {
      unsubCw();
      unsubRd();
    };
  }, [eventId]);

  // 4. Listen to Active Question (Open stage Q&A)
  useEffect(() => {
    if (!eventId) return;

    setLoading(true);
    const activeQRef = doc(db, "events", eventId, "liveRoom", "activeQuestion");

    const unsubQuestion = onSnapshot(
      activeQRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as ActiveQuestionData;
          if (data && data.isActive && data.question) {
            setActiveQuestion(data);
          } else {
            setActiveQuestion(null);
          }
        } else {
          setActiveQuestion(null);
        }
        setLoading(false);
      },
      (err) => {
        console.warn("Live wall question listener error:", err);
        setLoading(false);
      }
    );

    return () => unsubQuestion();
  }, [eventId]);

  const currentQuestionId = activeQuestion?.questionId || "";

  // 5. Listen to Live Answers
  useEffect(() => {
    if (!eventId || !currentQuestionId) {
      setAnswers([]);
      return;
    }

    const answersRef = collection(db, "events", eventId, "liveAnswers");
    const qAnswers = query(answersRef, where("questionId", "==", currentQuestionId));
    const unsubAnswers = onSnapshot(
      qAnswers,
      (snap) => {
        const list: LiveAnswerData[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as LiveAnswerData));
        setAnswers(list);
      },
      (err) => console.warn("Live wall answers listener error:", err)
    );

    return () => unsubAnswers();
  }, [eventId, currentQuestionId]);

  // 6. Listen to Quiz Session
  useEffect(() => {
    if (!eventId) return;

    const quizSessionRef = doc(db, "events", eventId, "activities", "quiz", "session", "current");
    const unsubQuizSession = onSnapshot(
      quizSessionRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setQuizSession(docSnap.data() as QuizSessionData);
        } else {
          setQuizSession(null);
        }
      },
      (err) => console.warn("Live wall quiz session listener error:", err)
    );

    return () => unsubQuizSession();
  }, [eventId]);

  // 7. Listen to Quiz Leaderboard
  useEffect(() => {
    if (!eventId) return;

    const leaderboardRef = collection(db, "events", eventId, "activities", "quiz", "leaderboard");
    const qLb = query(leaderboardRef, orderBy("currentScore", "desc"), limit(10));
    const unsubLb = onSnapshot(
      qLb,
      (snap) => {
        const list: QuizLeaderboardEntry[] = [];
        snap.forEach((d) => list.push(d.data() as QuizLeaderboardEntry));
        setQuizLeaderboard(list);
      },
      (err) => console.warn("Live wall quiz leaderboard listener error:", err)
    );

    return () => unsubLb();
  }, [eventId]);

  // Filter matching answers for current active question
  const matchingAnswers = useMemo(() => {
    if (!currentQuestionId) return [];
    return answers.filter((a) => a.questionId === currentQuestionId);
  }, [answers, currentQuestionId]);

  // Aggregate duplicate responses
  const aggregatedBubbles = useMemo(() => {
    const map = new Map<string, { displayText: string; count: number; latestTimestamp: number }>();

    matchingAnswers.forEach((ans) => {
      const rawText = ans.answer || "";
      const key = rawText.trim().toLowerCase();
      if (!key) return;

      const existing = map.get(key);
      const ts = typeof ans.createdAt === "number" ? ans.createdAt : Date.now();

      if (existing) {
        existing.count += 1;
        if (ts > existing.latestTimestamp) {
          existing.latestTimestamp = ts;
        }
      } else {
        map.set(key, {
          displayText: rawText.trim(),
          count: 1,
          latestTimestamp: ts,
        });
      }
    });

    const result: AggregatedBubble[] = [];
    let idx = 0;

    map.forEach((value, key) => {
      result.push({
        key,
        displayText: value.displayText,
        count: value.count,
        latestTimestamp: value.latestTimestamp,
        isNewOrUpdated: highlightedKeys.has(key),
        colorIndex: idx % 4,
      });
      idx++;
    });

    return result.sort((a, b) => b.count - a.count);
  }, [matchingAnswers, highlightedKeys]);

  // Bubble colors
  const bubbleColorStyles = [
    {
      bg: "bg-gradient-to-br from-cyan-950/80 via-cyan-900/40 to-neutral-950/90",
      border: "border-cyan-500/50 hover:border-cyan-400",
      text: "text-cyan-100",
      countBg: "bg-cyan-500 text-black",
      glow: "shadow-[0_0_25px_rgba(6,182,212,0.3)]",
      highlightGlow: "shadow-[0_0_45px_rgba(6,182,212,0.85)] border-cyan-400",
    },
    {
      bg: "bg-gradient-to-br from-purple-950/80 via-purple-900/40 to-neutral-950/90",
      border: "border-purple-500/50 hover:border-purple-400",
      text: "text-purple-100",
      countBg: "bg-purple-500 text-white",
      glow: "shadow-[0_0_25px_rgba(168,85,247,0.3)]",
      highlightGlow: "shadow-[0_0_45px_rgba(168,85,247,0.85)] border-purple-400",
    },
    {
      bg: "bg-gradient-to-br from-orange-950/80 via-orange-900/40 to-neutral-950/90",
      border: "border-orange-500/50 hover:border-orange-400",
      text: "text-orange-100",
      countBg: "bg-orange-500 text-black",
      glow: "shadow-[0_0_25px_rgba(249,115,22,0.3)]",
      highlightGlow: "shadow-[0_0_45px_rgba(249,115,22,0.85)] border-orange-400",
    },
    {
      bg: "bg-gradient-to-br from-blue-950/80 via-blue-900/40 to-neutral-950/90",
      border: "border-blue-500/50 hover:border-blue-400",
      text: "text-blue-100",
      countBg: "bg-blue-500 text-white",
      glow: "shadow-[0_0_25px_rgba(59,130,246,0.3)]",
      highlightGlow: "shadow-[0_0_45px_rgba(59,130,246,0.85)] border-blue-400",
    },
  ];

  // Crossword matrix helpers for Live Wall
  const crosswordState = activeBroadcast?.crossword;
  const currentPuzzleIdx = crosswordState?.puzzleIndex ?? 0;
  const currentCrossword = CROSSWORD_ACTIVITIES[currentPuzzleIdx] || CROSSWORD_ACTIVITIES[0];

  const { cwMatrix, cwStartMap } = useMemo(() => {
    const matrix: (string | null)[][] = Array.from({ length: currentCrossword.gridRows }, () =>
      Array.from({ length: currentCrossword.gridCols }, () => null)
    );
    const startMap: Record<string, number> = {};

    currentCrossword.clues.forEach((clue) => {
      const startKey = `${clue.row},${clue.col}`;
      if (!startMap[startKey]) {
        startMap[startKey] = clue.number;
      }
      for (let i = 0; i < clue.answer.length; i++) {
        const r = clue.direction === "across" ? clue.row : clue.row + i;
        const c = clue.direction === "across" ? clue.col + i : clue.col;
        if (r < currentCrossword.gridRows && c < currentCrossword.gridCols) {
          matrix[r][c] = clue.answer[i].toUpperCase();
        }
      }
    });

    return { cwMatrix: matrix, cwStartMap: startMap };
  }, [currentCrossword]);

  // Riddle helper for Live Wall
  const riddleState = activeBroadcast?.riddles;
  const currentRiddleIdx = riddleState?.riddleIndex ?? 0;
  const currentRiddle = RIDDLE_ACTIVITIES[currentRiddleIdx] || RIDDLE_ACTIVITIES[0];

  return (
    <div className="min-h-screen h-screen bg-[#050508] text-white flex flex-col font-sans select-none overflow-hidden relative selection:bg-orange-500 selection:text-black">
      {/* Ambient Conference Background Lights */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-600/10 blur-[140px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-cyan-600/10 blur-[140px] rounded-full animate-pulse" />
        <div className="absolute top-[40%] right-[30%] w-[35vw] h-[35vw] bg-orange-600/5 blur-[160px] rounded-full" />
      </div>

      {/* Top Presentation Bar */}
      <header className="p-4 sm:p-5 bg-neutral-950/85 border-b border-neutral-800 backdrop-blur-md flex items-center justify-between gap-4 z-20 shrink-0 relative">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => navigate(`/events/${eventId}/admin`)}
            className="p-2.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all cursor-pointer border border-neutral-800 shrink-0 flex items-center gap-2 text-xs font-extrabold"
            title="Exit to Admin Dashboard"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Admin</span>
          </button>

          <div className="min-w-0 text-left">
            <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-none truncate">
              {event?.title || "ZERO2ONE Live Event Stage"}
            </h1>
            <p className="text-xs font-mono text-neutral-400 mt-1 flex items-center gap-2">
              <span className="text-orange-400 font-bold uppercase tracking-wider">
                {event?.college || "ZERO2ONE Stage"}
              </span>
              <span>•</span>
              <span className="text-neutral-400">
                {activeBroadcast?.activeActivity === "crossword"
                  ? `Crossword #${currentPuzzleIdx + 1} (${currentCrossword.title})`
                  : activeBroadcast?.activeActivity === "riddles"
                  ? `Engineering Riddle ${currentRiddleIdx + 1} of 5`
                  : quizSession?.status === "running"
                  ? "Live Quiz Challenge"
                  : `${matchingAnswers.length} Responses`}
              </span>
            </p>
          </div>
        </div>

        {/* Header Right Stage Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3 py-1.5 rounded-full text-xs font-mono font-black uppercase tracking-wider bg-orange-500/15 border border-orange-500/30 text-orange-300 flex items-center gap-2">
            <Tv size={14} className="text-orange-400" />
            <span className="hidden sm:inline">PROJECTOR VIEW</span>
          </div>

          <div className="px-3 py-1.5 rounded-full text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-1.5">
            <Radio size={13} className="animate-pulse" />
            <span className="hidden sm:inline">LIVE SYNC</span>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all border border-neutral-800 cursor-pointer flex items-center gap-1.5 text-xs font-extrabold"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span className="hidden md:inline">{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
          </button>
        </div>
      </header>

      {/* Main Presentation Stage */}
      <main className="flex-1 flex flex-col justify-between p-4 sm:p-6 z-10 relative overflow-hidden">
        {activeBroadcast?.activeActivity === "crossword" ? (
          /* CROSSWORD LIVE STAGE PRESENTATION */
          <AnimatePresence mode="wait">
            {crosswordState?.stage === "leaderboard" ? (
              <motion.div
                key="cw-leaderboard"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="max-w-4xl mx-auto w-full my-auto space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-black uppercase tracking-widest text-amber-400 bg-amber-500/15 border border-amber-500/30">
                    <Trophy size={14} className="text-amber-400" />
                    <span>CROSSWORD #{currentPuzzleIdx + 1} • LEADERBOARD</span>
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                    Crossword Champions Standings
                  </h2>
                </div>

                <div className="p-6 rounded-3xl bg-neutral-950/90 border border-neutral-800 shadow-2xl space-y-3 max-h-[60vh] overflow-y-auto">
                  {crosswordLeaderboard.length === 0 ? (
                    <div className="p-8 text-center text-sm font-mono text-neutral-500">
                      No crossword scores recorded yet.
                    </div>
                  ) : (
                    crosswordLeaderboard.map((entry, idx) => (
                      <div
                        key={entry.participantId}
                        className={`p-4 rounded-2xl border flex items-center justify-between font-mono ${
                          idx === 0
                            ? "bg-amber-500/20 border-amber-500/50 text-white shadow-lg"
                            : "bg-neutral-900 border-neutral-800 text-neutral-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-xl bg-neutral-800 text-orange-400 font-black flex items-center justify-center text-sm">
                            #{idx + 1}
                          </span>
                          <span className="text-base font-black text-white">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-neutral-400">{entry.puzzlesCompleted} solved</span>
                          <span className="text-orange-400 font-black text-base">{entry.currentScore} pts</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`cw-grid-${currentPuzzleIdx}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="flex-1 flex flex-col justify-between h-full max-w-7xl mx-auto w-full gap-4"
              >
                {/* Crossword Header */}
                <div className="flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="px-3.5 py-1.5 rounded-full text-xs font-mono font-black text-orange-400 bg-orange-500/15 border border-orange-500/30 uppercase tracking-wider">
                      CROSSWORD #{currentPuzzleIdx + 1}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {currentCrossword.title}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs">
                    {crosswordState?.isRevealed || crosswordState?.stage === "reveal" ? (
                      <span className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1.5">
                        <Eye size={14} className="text-emerald-400" />
                        <span>SOLUTIONS REVEALED</span>
                      </span>
                    ) : crosswordState?.isFrozen || crosswordState?.stage === "frozen" ? (
                      <span className="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-1.5">
                        <Lock size={14} className="text-amber-400" />
                        <span>SUBMISSIONS LOCKED</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-300 font-bold flex items-center gap-1.5">
                        <Radio size={14} className="text-orange-400 animate-pulse" />
                        <span>PUZZLE ACTIVE</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 2-Column Split: Left = 6 Across & 6 Down Clues, Right = Crossword Grid */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-h-0">
                  {/* Left Column: 6 Across and 6 Down Clues */}
                  <div className="lg:col-span-5 flex flex-col gap-3 overflow-y-auto pr-1">
                    {/* 6 Across Clues */}
                    <div className="p-4 rounded-2xl bg-neutral-950/90 border border-neutral-800 space-y-2">
                      <h3 className="text-xs font-black font-mono text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span>➡ 6 ACROSS CLUES</span>
                      </h3>
                      <div className="space-y-2">
                        {currentCrossword.clues
                          .filter((c) => c.direction === "across")
                          .map((clue) => (
                            <div
                              key={clue.number}
                              className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800/90 text-xs leading-snug"
                            >
                              <span className="font-mono font-black text-orange-400 mr-2">
                                {clue.number}.
                              </span>
                              <span className="text-neutral-100 font-medium">{clue.clue}</span>
                              {(crosswordState?.isRevealed || crosswordState?.stage === "reveal") && (
                                <span className="ml-2 font-mono font-black text-emerald-400 uppercase">
                                  [{clue.answer}]
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* 6 Down Clues */}
                    <div className="p-4 rounded-2xl bg-neutral-950/90 border border-neutral-800 space-y-2">
                      <h3 className="text-xs font-black font-mono text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span>⬇ 6 DOWN CLUES</span>
                      </h3>
                      <div className="space-y-2">
                        {currentCrossword.clues
                          .filter((c) => c.direction === "down")
                          .map((clue) => (
                            <div
                              key={clue.number}
                              className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800/90 text-xs leading-snug"
                            >
                              <span className="font-mono font-black text-orange-400 mr-2">
                                {clue.number}.
                              </span>
                              <span className="text-neutral-100 font-medium">{clue.clue}</span>
                              {(crosswordState?.isRevealed || crosswordState?.stage === "reveal") && (
                                <span className="ml-2 font-mono font-black text-emerald-400 uppercase">
                                  [{clue.answer}]
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Crossword Grid (Empty or Revealed) */}
                  <div className="lg:col-span-7 flex flex-col items-center justify-center p-6 rounded-3xl bg-neutral-950/95 border border-neutral-800 shadow-2xl overflow-auto">
                    <div
                      className="grid gap-1.5 select-none"
                      style={{
                        gridTemplateColumns: `repeat(${currentCrossword.gridCols}, minmax(36px, 48px))`,
                        gridTemplateRows: `repeat(${currentCrossword.gridRows}, minmax(36px, 48px))`,
                      }}
                    >
                      {Array.from({ length: currentCrossword.gridRows }).map((_, r) =>
                        Array.from({ length: currentCrossword.gridCols }).map((_, c) => {
                          const correctChar = cwMatrix[r][c];
                          const isBlocked = correctChar === null;
                          const cellKey = `${r},${c}`;
                          const clueNum = cwStartMap[cellKey];
                          const isRevealed =
                            crosswordState?.isRevealed || crosswordState?.stage === "reveal";

                          if (isBlocked) {
                            return (
                              <div
                                key={`${r}-${c}`}
                                className="w-full h-full bg-[#0a0a0c] rounded-lg border border-neutral-900"
                              />
                            );
                          }

                          return (
                            <div
                              key={`${r}-${c}`}
                              className={`relative w-full h-full rounded-lg font-mono font-black text-lg sm:text-xl flex items-center justify-center border shadow-md transition-all ${
                                isRevealed
                                  ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/30"
                                  : "bg-neutral-900 border-neutral-700 text-white"
                              }`}
                            >
                              {clueNum && (
                                <span className="absolute top-0.5 left-1 text-[9px] font-mono leading-none text-neutral-400 font-bold">
                                  {clueNum}
                                </span>
                              )}
                              <span className="uppercase">{isRevealed ? correctChar : ""}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        ) : activeBroadcast?.activeActivity === "riddles" ? (
          /* RIDDLES LIVE STAGE PRESENTATION */
          <AnimatePresence mode="wait">
            {riddleState?.stage === "leaderboard" ? (
              <motion.div
                key="riddle-leaderboard"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="max-w-4xl mx-auto w-full my-auto space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-black uppercase tracking-widest text-amber-400 bg-amber-500/15 border border-amber-500/30">
                    <Trophy size={14} className="text-amber-400" />
                    <span>RIDDLE CHALLENGE • LEADERBOARD</span>
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                    Riddle Master Standings
                  </h2>
                </div>

                <div className="p-6 rounded-3xl bg-neutral-950/90 border border-neutral-800 shadow-2xl space-y-3 max-h-[60vh] overflow-y-auto">
                  {riddleLeaderboard.length === 0 ? (
                    <div className="p-8 text-center text-sm font-mono text-neutral-500">
                      No riddle scores recorded yet.
                    </div>
                  ) : (
                    riddleLeaderboard.map((entry, idx) => (
                      <div
                        key={entry.participantId}
                        className={`p-4 rounded-2xl border flex items-center justify-between font-mono ${
                          idx === 0
                            ? "bg-amber-500/20 border-amber-500/50 text-white shadow-lg"
                            : "bg-neutral-900 border-neutral-800 text-neutral-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-xl bg-neutral-800 text-orange-400 font-black flex items-center justify-center text-sm">
                            #{idx + 1}
                          </span>
                          <span className="text-base font-black text-white">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-neutral-400">{entry.riddlesSolved} solved</span>
                          <span className="text-orange-400 font-black text-base">{entry.currentScore} pts</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`riddle-question-${currentRiddleIdx}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-4xl mx-auto w-full my-auto space-y-8 text-center"
              >
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-black uppercase tracking-widest text-orange-400 bg-orange-500/15 border border-orange-500/30">
                    <Sparkles size={14} className="text-orange-400" />
                    <span>RIDDLE QUESTION {currentRiddleIdx + 1} OF 5</span>
                  </div>

                  <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-relaxed italic px-4">
                    "{currentRiddle.riddleText}"
                  </h2>
                </div>

                {/* Empty or Revealed Letter Boxes on Live Wall */}
                <div className="space-y-4">
                  <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest block">
                    {riddleState?.isRevealed || riddleState?.stage === "reveal"
                      ? "Revealed Solution"
                      : `Answer: ${currentRiddle.answer.length} Letters`}
                  </span>

                  <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
                    {Array.from({ length: currentRiddle.answer.length }).map((_, idx) => {
                      const isRevealed =
                        riddleState?.isRevealed || riddleState?.stage === "reveal";
                      const letter = isRevealed ? currentRiddle.answer[idx] : "";
                      return (
                        <div
                          key={idx}
                          className={`w-14 h-16 sm:w-16 sm:h-20 rounded-2xl border-2 flex items-center justify-center font-mono font-black text-2xl sm:text-3xl uppercase shadow-2xl transition-all ${
                            isRevealed
                              ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/40"
                              : "bg-neutral-900/90 border-neutral-700 text-transparent"
                          }`}
                        >
                          {letter}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Technical Explanation when Revealed */}
                {(riddleState?.isRevealed || riddleState?.stage === "reveal") && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 rounded-2xl bg-neutral-950/90 border border-orange-500/40 text-left max-w-3xl mx-auto space-y-2 shadow-2xl"
                  >
                    <span className="text-xs font-mono font-black text-orange-400 uppercase tracking-widest block">
                      Engineering Breakdown
                    </span>
                    <p className="text-sm sm:text-base text-neutral-200 leading-relaxed">
                      {currentRiddle.explanation}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        ) : quizSession && quizSession.status === "running" ? (
          /* LIVE QUIZ STAGE PRESENTATION */
          <AnimatePresence mode="wait">
            {quizSession.stage === "answer_reveal" ? (
              <motion.div
                key="quiz-reveal-stage"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-4xl mx-auto w-full my-auto space-y-6 text-center"
              >
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/15 border border-emerald-500/30">
                  <span>✔ CORRECT ANSWER REVEAL</span>
                </div>

                <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-neutral-950 border-2 border-emerald-500/60 text-white space-y-3 shadow-2xl">
                  <span className="text-xs font-mono font-black text-emerald-400 uppercase tracking-widest block">
                    Correct Option
                  </span>
                  <h2 className="text-3xl sm:text-5xl font-black text-emerald-300">
                    {String.fromCharCode(65 + (quizSession.currentQuestion?.correctOptionIndex || 0))}.{" "}
                    {quizSession.currentQuestion?.options[quizSession.currentQuestion?.correctOptionIndex || 0]}
                  </h2>
                </div>

                <div className="p-6 rounded-2xl bg-neutral-900/90 border border-neutral-800 text-sm sm:text-base text-neutral-200 leading-relaxed max-w-3xl mx-auto text-left">
                  <span className="font-mono font-bold text-neutral-400 block mb-1 text-xs uppercase">
                    Explanation:
                  </span>
                  {quizSession.currentQuestion?.explanation}
                </div>

                {quizSession.fastestResponse && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 max-w-2xl mx-auto flex items-center justify-between gap-4 font-mono font-bold text-sm shadow-xl">
                    <div className="flex items-center gap-3">
                      <Zap size={24} className="text-amber-400 animate-bounce shrink-0" />
                      <div className="text-left">
                        <span className="text-[10px] text-amber-400 uppercase tracking-wider block">
                          ⚡ Fastest Correct Answer
                        </span>
                        <span className="text-base font-black text-white block">
                          {quizSession.fastestResponse.participantName}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-amber-300 block">
                        {quizSession.fastestResponse.responseTimeSec}s
                      </span>
                      <span className="text-xs text-emerald-400 font-black">
                        +{quizSession.fastestResponse.speedBonus} Speed Bonus
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : quizSession.stage === "leaderboard" || quizSession.stage === "completed" ? (
              <motion.div
                key="quiz-leaderboard-stage"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto w-full my-auto"
              >
                <QuizLeaderboardView
                  leaderboard={quizLeaderboard}
                  isFinal={quizSession.stage === "completed"}
                  title={
                    quizSession.stage === "completed"
                      ? "🏆 QUIZ CHAMPIONS - FINAL STANDINGS"
                      : `🏆 Standings (Question ${quizSession.currentQuestionIndex + 1} of 5)`
                  }
                />
              </motion.div>
            ) : (
              <motion.div
                key={`quiz-question-${quizSession.currentQuestionIndex}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-4xl mx-auto w-full my-auto space-y-8"
              >
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-black uppercase tracking-widest text-orange-400 bg-orange-500/15 border border-orange-500/30">
                    <Sparkles size={14} className="text-orange-400" />
                    <span>QUESTION {quizSession.currentQuestionIndex + 1} OF 5</span>
                  </div>

                  <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                    {quizSession.currentQuestion?.text}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
                  {quizSession.currentQuestion?.options.map((opt, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-neutral-900/90 border-2 border-neutral-800 text-white font-bold text-base flex items-center gap-4 shadow-xl"
                    >
                      <span className="w-9 h-9 rounded-xl bg-orange-500 text-white font-mono font-extrabold text-sm flex items-center justify-center shrink-0 border border-orange-400">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        ) : activeQuestion && activeQuestion.question ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionId}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col justify-between h-full"
            >
              <div className="max-w-4xl mx-auto w-full text-center space-y-3 pt-2 sm:pt-4 shrink-0">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-mono font-black uppercase tracking-widest text-orange-400 bg-orange-500/15 border border-orange-500/30">
                  <Sparkles size={14} className="text-orange-400" />
                  <span>CURRENT STAGE QUESTION</span>
                </div>

                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-lg px-4">
                  "{activeQuestion.question}"
                </h2>
              </div>

              {/* Response Bubble Stage */}
              <div className="flex-1 relative w-full my-4 flex items-center justify-center overflow-hidden min-h-[350px]">
                {aggregatedBubbles.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center text-center p-8 space-y-4 max-w-md mx-auto"
                  >
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center animate-pulse">
                        <MessageSquare size={36} />
                      </div>
                      <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping" />
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-xl font-black text-white">Waiting for responses...</h3>
                      <p className="text-xs font-mono text-neutral-400">
                        Participant responses will appear here live as floating bubbles.
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center max-w-6xl mx-auto">
                    {aggregatedBubbles.map((bubble, index) => {
                      const count = aggregatedBubbles.length;
                      const phi = 137.5 * (Math.PI / 180);
                      const radiusFactor = Math.min(260, 40 + Math.sqrt(index + 1) * 55);
                      const angle = (index + 1) * phi;

                      const posX = Math.cos(angle) * radiusFactor;
                      const posY = Math.sin(angle) * (radiusFactor * 0.62);

                      const floatX = (index % 2 === 0 ? 1 : -1) * (10 + (index % 4) * 4);
                      const floatY = (index % 3 === 0 ? -1 : 1) * (12 + (index % 3) * 5);
                      const duration = 5 + (index % 5) * 1.2;

                      const baseScale = 1 + Math.min(0.6, (bubble.count - 1) * 0.12);
                      const style = bubbleColorStyles[bubble.colorIndex];

                      return (
                        <motion.div
                          key={bubble.key}
                          initial={{ opacity: 0, scale: 0.3, x: 0, y: 0 }}
                          animate={{
                            opacity: 1,
                            scale: bubble.isNewOrUpdated ? [baseScale * 1.4, baseScale] : baseScale,
                            x: [posX, posX + floatX, posX - floatX, posX],
                            y: [posY, posY + floatY, posY - floatY, posY],
                          }}
                          transition={{
                            opacity: { duration: 0.5 },
                            scale: { duration: bubble.isNewOrUpdated ? 0.8 : 0.4 },
                            x: { duration, repeat: Infinity, ease: "easeInOut" },
                            y: { duration: duration * 1.1, repeat: Infinity, ease: "easeInOut" },
                          }}
                          className={`absolute px-5 py-3.5 rounded-full border ${style.bg} ${style.border} ${style.text} ${
                            bubble.isNewOrUpdated ? style.highlightGlow : style.glow
                          } backdrop-blur-md flex items-center gap-2.5 transition-shadow cursor-default group shadow-2xl z-10`}
                          style={{
                            transformOrigin: "center center",
                          }}
                        >
                          <span className="text-base sm:text-lg md:text-xl font-extrabold tracking-tight whitespace-nowrap">
                            {bubble.displayText}
                          </span>

                          {bubble.count > 1 && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-mono font-black tracking-wider ${style.countBg} flex items-center gap-1 shadow-md`}
                            >
                              <Flame size={12} className="animate-pulse" />
                              <span>×{bubble.count}</span>
                            </span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer Strip */}
              <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs font-mono text-neutral-400 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-white font-bold">{aggregatedBubbles.length} Unique Responses</span>
                </div>

                <div className="text-neutral-500 hidden sm:block">
                  ZERO2ONE Interactive Stage System
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          /* IDLE STAGE STATE */
          <div className="my-auto text-center space-y-5 max-w-lg mx-auto p-8 rounded-3xl bg-neutral-900/60 border border-neutral-800">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center mx-auto shadow-xl">
              <Tv size={32} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white tracking-tight">Projector Display Ready</h2>
              <p className="text-xs font-mono text-neutral-400 leading-relaxed">
                Stage is synced with host controls. Start Quiz, Crossword, or Riddles from the Admin Panel to broadcast live to this wall.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
