import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  Search, 
  Linkedin, 
  ExternalLink, 
  ArrowLeft, 
  Copy, 
  Check, 
  Share2, 
  MapPin, 
  Sparkles,
  Building,
  GraduationCap,
  Filter,
  X
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

const COMMON_DEPTS = ["All", "CSE", "AIML", "DS", "IT", "ECE", "EEE", "MECH", "CIVIL"];

export function EventRoom({
  event,
  currentParticipant,
  onBackToEvent,
}: EventRoomProps) {
  const [participants, setParticipants] = useState<(Participant & { id: string })[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("All");
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
        console.warn("Ordered participants query error, falling back:", error);
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

  // Extract unique departments dynamically from real participant list
  const availableDepts = useMemo(() => {
    const set = new Set<string>(COMMON_DEPTS);
    participants.forEach((p) => {
      if (p.department) {
        const deptUpper = p.department.trim().toUpperCase();
        if (deptUpper.length <= 15) {
          set.add(deptUpper);
        }
      }
    });
    return Array.from(set);
  }, [participants]);

  // Realtime search & department filtering
  const filteredParticipants = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return participants.filter((p) => {
      // 1. Department Filter
      if (selectedDept !== "All") {
        const deptUpper = (p.department || "").toUpperCase();
        if (!deptUpper.includes(selectedDept)) {
          return false;
        }
      }

      // 2. Search Text Query
      if (!q) return true;

      const nameMatch = p.name?.toLowerCase().includes(q);
      const collegeMatch = p.college?.toLowerCase().includes(q);
      const deptMatch = p.department?.toLowerCase().includes(q);
      const yearMatch = p.year?.toLowerCase().includes(q);

      return nameMatch || collegeMatch || deptMatch || yearMatch;
    });
  }, [participants, searchQuery, selectedDept]);

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleConnectClick = (linkedinUrl?: string) => {
    if (!linkedinUrl) return;
    let url = linkedinUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500 selection:text-white pb-16 pt-3 px-2.5 sm:px-4 md:px-6">
      <div className="max-w-7xl mx-auto space-y-3 md:space-y-4">
        
        {/* Navigation Bar */}
        <header className="flex items-center justify-between p-3 px-4 rounded-2xl bg-[#121212] border border-neutral-800 shadow-md">
          <button
            type="button"
            onClick={onBackToEvent}
            className="flex items-center gap-1.5 text-xs font-bold text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} className="text-orange-500" />
            <span className="hidden xs:inline">Back to Event</span>
            <span className="xs:hidden">Back</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-widest text-orange-500 font-mono">
              ZERO2ONE ROOM
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyShareLink}
            className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-all border border-neutral-700 flex items-center gap-1.5 cursor-pointer"
          >
            {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
            <span className="hidden sm:inline">{copiedLink ? "Copied Link" : "Share"}</span>
          </button>
        </header>

        {/* Compact Room Banner & Details Header */}
        <div className="rounded-2xl bg-[#121212] border border-neutral-800 p-4 md:p-5 space-y-3.5 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800/80">
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-black uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/30">
                  NETWORKING LOBBY
                </span>
                <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  {Math.max(participants.length, 1)} Online
                </span>
              </div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-black text-white tracking-tight truncate">
                {event.title}
              </h1>
              <p className="text-xs text-neutral-400 font-medium flex items-center gap-1.5 truncate">
                <MapPin size={12} className="text-orange-500 shrink-0" />
                <span className="truncate">{event.venue}</span>
              </p>
            </div>

            {/* Current Participant Profile Chip */}
            <div className="flex items-center gap-2.5 p-2 px-3 rounded-xl bg-neutral-900 border border-neutral-800 shrink-0 self-start sm:self-auto">
              <img
                src={currentParticipant.photo || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentParticipant.name)}`}
                alt={currentParticipant.name}
                loading="lazy"
                className="w-8 h-8 rounded-full object-cover border border-orange-500/50 shrink-0"
              />
              <div className="text-left leading-tight">
                <span className="text-[8px] font-mono font-black text-emerald-400 uppercase tracking-widest block">
                  YOU
                </span>
                <span className="text-xs font-bold text-white block truncate max-w-[120px]">
                  {currentParticipant.name}
                </span>
              </div>
            </div>
          </div>

          {/* Search Input & Department Filters Bar */}
          <div className="space-y-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-3 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, college, department..."
                className="w-full pl-9 pr-8 py-2.5 text-xs bg-neutral-900 border border-neutral-800 hover:border-neutral-700 focus:border-orange-500 rounded-xl outline-none text-white font-medium transition-all placeholder:text-neutral-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Department Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 pt-0.5 text-left">
              <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase shrink-0 flex items-center gap-1 mr-1">
                <Filter size={11} /> Filter:
              </span>
              {availableDepts.map((dept) => {
                const isActive = selectedDept === dept;
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setSelectedDept(dept)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all shrink-0 cursor-pointer border ${
                      isActive
                        ? "bg-orange-500 text-white border-orange-400 shadow-md"
                        : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-neutral-200"
                    }`}
                  >
                    {dept}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Participant Count Sub-Header */}
        <div className="flex items-center justify-between px-1 text-left">
          <span className="text-[11px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
            Showing {filteredParticipants.length} {filteredParticipants.length === 1 ? "Attendee" : "Attendees"}
          </span>
          {selectedDept !== "All" && (
            <button
              type="button"
              onClick={() => setSelectedDept("All")}
              className="text-[10px] text-orange-400 hover:underline font-mono"
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Compact Participant Grid */}
        {loading ? (
          <div className="py-20 text-center space-y-3 text-neutral-400">
            <Sparkles size={28} className="text-orange-500 animate-spin mx-auto" />
            <p className="text-xs font-mono font-bold uppercase tracking-wider">
              Loading Networking Lobby...
            </p>
          </div>
        ) : filteredParticipants.length === 0 ? (
          /* Empty State */
          <div className="p-8 md:p-12 rounded-2xl bg-[#121212] border border-neutral-800 text-center space-y-3 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center mx-auto">
              <Users size={24} />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-sm md:text-base font-black text-white">
                {participants.length === 0
                  ? "You're the first attendee!"
                  : "No matching attendees"}
              </h3>
              <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                {participants.length === 0
                  ? "Share the event link to start networking with classmates."
                  : `No attendees matched your search filters.`}
              </p>
            </div>
          </div>
        ) : (
          /* 
            GRID LAYOUT REQUIREMENTS:
            Mobile: 2 cards per row (grid-cols-2)
            Tablet: 3 cards per row (sm:grid-cols-3)
            Desktop: 4-6 cards per row (md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6)
            Compact height: ~110-120px per card -> 6-8 cards visible on mobile view!
          */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-2.5">
            {filteredParticipants.map((p) => {
              const isYou = p.id === currentParticipant.id;

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={`p-2.5 rounded-xl bg-[#121212] border transition-all duration-150 flex flex-col justify-between space-y-2 shadow-md hover:border-neutral-700 hover:-translate-y-0.5 relative group ${
                    isYou ? "border-orange-500/60 bg-orange-500/5" : "border-neutral-800/90"
                  }`}
                >
                  {/* Top Row: Circular Photo (40-48px) + Green Online Indicator + Name */}
                  <div className="flex items-center gap-2 text-left">
                    {/* Avatar Container */}
                    <div className="relative shrink-0">
                      <img
                        src={p.photo || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}`}
                        alt={p.name}
                        loading="lazy"
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border border-neutral-700 shadow-sm"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}`;
                        }}
                      />
                      {/* Green Online Indicator */}
                      <span
                        className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#121212]"
                        title="Online"
                      />
                    </div>

                    {/* Name & Badge */}
                    <div className="min-w-0 flex-1 text-left leading-tight">
                      <div className="flex items-center gap-1">
                        <h3 className="text-xs font-black text-white truncate group-hover:text-orange-400 transition-colors">
                          {p.name}
                        </h3>
                        {isYou && (
                          <span className="px-1.5 py-0.2 text-[8px] font-mono font-black uppercase bg-orange-500/20 text-orange-400 rounded shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                      
                      {/* Department + Year */}
                      {(p.department || p.year) && (
                        <p className="text-[10px] font-medium text-neutral-400 truncate mt-0.5 flex items-center gap-1">
                          <GraduationCap size={10} className="shrink-0 text-neutral-500" />
                          <span className="truncate">
                            {[p.department, p.year].filter(Boolean).join(" • ")}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* College Name */}
                  <div className="text-left min-w-0">
                    <p className="text-[10px] font-bold text-neutral-400 flex items-center gap-1 truncate">
                      <Building size={10} className="shrink-0 text-orange-500/80" />
                      <span className="truncate">{p.college}</span>
                    </p>
                  </div>

                  {/* Connect Button */}
                  <button
                    type="button"
                    onClick={() => handleConnectClick(p.linkedinUrl)}
                    className="w-full py-1.5 px-2 rounded-lg bg-[#0A66C2] hover:bg-[#084e96] active:scale-[0.98] text-white font-black text-[10px] uppercase tracking-wider transition-all shadow flex items-center justify-center gap-1 cursor-pointer border border-blue-400/30"
                  >
                    <Linkedin size={12} />
                    <span>Connect</span>
                    <ExternalLink size={10} className="opacity-70" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
