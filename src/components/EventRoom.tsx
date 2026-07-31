import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  Search, 
  Linkedin, 
  ExternalLink, 
  Radio, 
  MessageSquare, 
  ArrowLeft, 
  Sparkles, 
  Share2, 
  Copy, 
  Check, 
  Calendar, 
  MapPin, 
  Clock, 
  Globe,
  UserCheck,
  Building,
  Briefcase
} from "lucide-react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { EventItem } from "./PublicEventPage";
import { Participant } from "./ParticipantOnboarding";

interface EventRoomProps {
  event: EventItem;
  currentParticipant: Participant & { id: string };
  onBackToEvent: () => void;
  onNavigateHome: () => void;
}

export function EventRoom({
  event,
  currentParticipant,
  onBackToEvent,
  onNavigateHome,
}: EventRoomProps) {
  const [activeTab, setActiveTab] = useState<"connect" | "live" | "community">("connect");
  const [participants, setParticipants] = useState<(Participant & { id: string })[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Subscribe to real-time participants subcollection
  useEffect(() => {
    setLoading(true);
    const participantsRef = collection(db, "events", event.id, "participants");
    const q = query(participantsRef, orderBy("joinedAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: (Participant & { id: string })[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Participant & { id: string });
        });
        setParticipants(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching participants:", error);
        // Fallback without query order
        const fallbackUnsub = onSnapshot(
          collection(db, "events", event.id, "participants"),
          (snapshot) => {
            const list: (Participant & { id: string })[] = [];
            snapshot.forEach((doc) => {
              list.push({ id: doc.id, ...doc.data() } as Participant & { id: string });
            });
            setParticipants(list);
            setLoading(false);
          }
        );
        return () => fallbackUnsub();
      }
    );

    return () => unsubscribe();
  }, [event.id]);

  // Realtime search filtering by Name, College, or Department
  const filteredParticipants = useMemo(() => {
    if (!searchQuery.trim()) return participants;
    const q = searchQuery.toLowerCase().trim();
    return participants.filter((p) => {
      const nameMatch = p.name?.toLowerCase().includes(q);
      const collegeMatch = p.college?.toLowerCase().includes(q);
      const deptMatch = p.department?.toLowerCase().includes(q);
      const yearMatch = p.year?.toLowerCase().includes(q);
      return nameMatch || collegeMatch || deptMatch || yearMatch;
    });
  }, [participants, searchQuery]);

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleConnectClick = (linkedinUrl: string) => {
    if (!linkedinUrl) return;
    let url = linkedinUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500 selection:text-white pb-20 pt-4 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <header className="flex items-center justify-between p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-md">
          <button
            type="button"
            onClick={onBackToEvent}
            className="flex items-center gap-2 text-xs font-bold text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} className="text-orange-500" />
            <span>Event Details</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            <span className="text-[11px] font-black uppercase tracking-widest text-orange-500 font-mono">
              EVENT ROOM
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyShareLink}
            className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-all border border-neutral-700 flex items-center gap-1.5 cursor-pointer"
          >
            {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span className="hidden sm:inline">{copiedLink ? "Copied" : "Share Room"}</span>
          </button>
        </header>

        {/* Room Header Card */}
        <div className="rounded-3xl bg-[#121212] border border-neutral-800 overflow-hidden shadow-2xl relative">
          {/* Top Banner */}
          <div className="relative h-44 sm:h-52 bg-neutral-950 overflow-hidden border-b border-neutral-800">
            {event.banner ? (
              <img
                src={event.banner}
                alt={event.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-70"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-orange-950/40 via-neutral-950 to-neutral-900" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent" />

            {/* Online Count Badge Overlay */}
            <div className="absolute top-4 right-4 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Users size={14} />
              <span>{Math.max(participants.length, 1)} Online</span>
            </div>
          </div>

          {/* Event Room Details Header Body */}
          <div className="p-6 md:p-8 -mt-12 relative z-10 space-y-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-1.5 text-left">
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-orange-500 block">
                  ZERO2ONE LIVE NETWORKING ROOM
                </span>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-snug">
                  {event.title}
                </h1>
                <p className="text-xs text-neutral-400 font-medium flex items-center gap-2">
                  <MapPin size={13} className="text-orange-500 shrink-0" />
                  <span>{event.venue}</span>
                </p>
              </div>

              {/* Current Participant Profile Chip */}
              <div className="flex items-center gap-3 p-2.5 px-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 shrink-0">
                <img
                  src={currentParticipant.photo}
                  alt={currentParticipant.name}
                  className="w-10 h-10 rounded-xl object-cover border border-orange-500/40"
                />
                <div className="text-left">
                  <span className="text-[9px] font-mono font-extrabold text-emerald-400 uppercase tracking-widest block">
                    YOU ARE CONNECTED
                  </span>
                  <span className="text-xs font-black text-white block truncate max-w-[150px]">
                    {currentParticipant.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Room Tabs Header */}
            <div className="flex items-center gap-2 border-b border-neutral-800 pt-4 overflow-x-auto scrollbar-none">
              {/* Connect Tab (Active Default) */}
              <button
                type="button"
                onClick={() => setActiveTab("connect")}
                className={`pb-3 px-5 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                  activeTab === "connect"
                    ? "border-orange-500 text-orange-400"
                    : "border-transparent text-neutral-400 hover:text-white"
                }`}
              >
                <Users size={15} />
                <span>Connect ({participants.length})</span>
              </button>

              {/* Live Tab (Coming Soon) */}
              <button
                type="button"
                onClick={() => setActiveTab("live")}
                className={`pb-3 px-5 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                  activeTab === "live"
                    ? "border-orange-500 text-orange-400"
                    : "border-transparent text-neutral-500 hover:text-neutral-300"
                }`}
              >
                <Radio size={15} />
                <span>Live</span>
                <span className="px-1.5 py-0.2 rounded text-[8px] font-mono bg-neutral-800 text-neutral-400">
                  Coming Soon
                </span>
              </button>

              {/* Community Tab (Coming Soon) */}
              <button
                type="button"
                onClick={() => setActiveTab("community")}
                className={`pb-3 px-5 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                  activeTab === "community"
                    ? "border-orange-500 text-orange-400"
                    : "border-transparent text-neutral-500 hover:text-neutral-300"
                }`}
              >
                <MessageSquare size={15} />
                <span>Community</span>
                <span className="px-1.5 py-0.2 rounded text-[8px] font-mono bg-neutral-800 text-neutral-400">
                  Coming Soon
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content rendering */}
        <AnimatePresence mode="wait">
          {/* CONNECT TAB */}
          {activeTab === "connect" && (
            <motion.div
              key="tab-connect"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Search Bar */}
              <div className="relative">
                <Search size={18} className="absolute left-4 top-3.5 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Participants by Name, College, or Department..."
                  className="w-full pl-11 pr-4 py-3.5 text-xs md:text-sm bg-[#121212] border border-neutral-800 hover:border-neutral-700 focus:border-orange-500 rounded-2xl outline-none text-white font-medium transition-all placeholder:text-neutral-500 shadow-md"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-3.5 text-xs text-neutral-400 hover:text-white cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Participants Grid / Empty State */}
              {loading ? (
                <div className="py-16 text-center space-y-3 text-neutral-400">
                  <Sparkles size={28} className="text-orange-500 animate-spin mx-auto" />
                  <p className="text-xs font-bold uppercase tracking-wider">
                    Loading Room Participants...
                  </p>
                </div>
              ) : filteredParticipants.length === 0 ? (
                /* Empty State */
                <div className="p-10 md:p-14 rounded-3xl bg-[#121212] border border-neutral-800 text-center space-y-4 shadow-xl">
                  <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center mx-auto">
                    <Users size={28} />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="text-base md:text-lg font-black text-white">
                      {participants.length === 0
                        ? "You're the first participant!"
                        : "No matching participants found"}
                    </h3>
                    <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                      {participants.length === 0
                        ? "Invite others to join this event room by sharing the link!"
                        : `No participants matched "${searchQuery}". Try searching with a different name or college.`}
                    </p>
                  </div>
                  {participants.length === 0 && (
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer inline-flex items-center gap-2 border border-orange-400/40"
                    >
                      <Share2 size={14} /> Share Event Link
                    </button>
                  )}
                </div>
              ) : (
                /* Participant Card Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredParticipants.map((p) => {
                    const isYou = p.id === currentParticipant.id;
                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`p-5 rounded-2xl bg-[#121212] border transition-all duration-200 flex flex-col justify-between space-y-4 shadow-lg hover:border-neutral-700 relative group ${
                          isYou ? "border-orange-500/50 bg-orange-500/5" : "border-neutral-800"
                        }`}
                      >
                        {/* Header: Photo & Online badge */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="relative">
                            <img
                              src={p.photo}
                              alt={p.name}
                              className="w-14 h-14 rounded-2xl object-cover border border-neutral-700 shadow-md"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}`;
                              }}
                            />
                            <span
                              className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#121212]"
                              title="Online"
                            />
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            {isYou && (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-orange-500/15 border border-orange-500/30 text-orange-400">
                                YOU
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#0A66C2]/15 border border-[#0A66C2]/30 text-[#0A66C2]">
                              <Linkedin size={10} /> Verified
                            </span>
                          </div>
                        </div>

                        {/* Info Body */}
                        <div className="space-y-1.5 text-left flex-1">
                          <h4 className="text-sm font-black text-white tracking-tight leading-snug line-clamp-1">
                            {p.name}
                          </h4>

                          <p className="text-xs text-orange-400 font-bold flex items-center gap-1.5 truncate">
                            <Building size={12} className="shrink-0 text-neutral-400" />
                            <span className="truncate">{p.college}</span>
                          </p>

                          {(p.department || p.year) && (
                            <p className="text-[11px] text-neutral-400 font-medium flex items-center gap-1.5 truncate">
                              <GraduationCap size={12} className="shrink-0 text-neutral-500" />
                              <span className="truncate">
                                {[p.department, p.year].filter(Boolean).join(" • ")}
                              </span>
                            </p>
                          )}

                          {p.interests && (
                            <div className="pt-1 flex flex-wrap gap-1">
                              {p.interests.split(",").slice(0, 3).map((tag, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-[9px] font-mono text-neutral-400">
                                  #{tag.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Action: Connect Button */}
                        <button
                          type="button"
                          onClick={() => handleConnectClick(p.linkedinUrl)}
                          className="w-full py-2.5 px-3 rounded-xl bg-[#0A66C2] hover:bg-[#084e96] active:scale-[0.98] text-white font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-blue-400/30"
                        >
                          <Linkedin size={14} />
                          <span>Connect</span>
                          <ExternalLink size={12} className="opacity-70" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* LIVE TAB (COMING SOON) */}
          {activeTab === "live" && (
            <motion.div
              key="tab-live"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-12 md:p-16 rounded-3xl bg-[#121212] border border-neutral-800 text-center space-y-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center mx-auto">
                <Radio size={28} />
              </div>
              <h3 className="text-xl font-black text-white">Live Stream &amp; Stage</h3>
              <p className="text-xs text-neutral-400 font-medium max-w-sm mx-auto">
                Coming Soon. Stage streaming, keynotes, and presentation slides will be available in Phase 3.
              </p>
            </motion.div>
          )}

          {/* COMMUNITY TAB (COMING SOON) */}
          {activeTab === "community" && (
            <motion.div
              key="tab-community"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-12 md:p-16 rounded-3xl bg-[#121212] border border-neutral-800 text-center space-y-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center mx-auto">
                <MessageSquare size={28} />
              </div>
              <h3 className="text-xl font-black text-white">Community &amp; Discussion</h3>
              <p className="text-xs text-neutral-400 font-medium max-w-sm mx-auto">
                Coming Soon. Group discussions, Q&amp;A, and event announcements will be available in Phase 3.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
