import { motion } from "motion/react";
import { Search, X, Filter, GraduationCap, Building, Linkedin, ExternalLink } from "lucide-react";
import { EventItem } from "../PublicEventPage";
import { Participant } from "../ParticipantOnboarding";

interface ParticipantsPanelProps {
  event: EventItem;
  participants: (Participant & { id: string })[];
  filteredParticipants: (Participant & { id: string })[];
  currentParticipant: Participant & { id: string };
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedDept: string;
  setSelectedDept: (dept: string) => void;
  availableDepts: string[];
  onConnectClick: (p: Participant & { id: string }) => void;
}

export function ParticipantsPanel({
  event,
  participants,
  filteredParticipants,
  currentParticipant,
  searchQuery,
  setSearchQuery,
  selectedDept,
  setSelectedDept,
  availableDepts,
  onConnectClick,
}: ParticipantsPanelProps) {
  const isNormalRoom = event.roomType === "normal";

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-neutral-800/90 rounded-2xl overflow-hidden shadow-xl">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-neutral-800 bg-neutral-900/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
            <span>Participants</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
              {participants.length}
            </span>
          </h2>
          <span className="text-[10px] font-mono text-neutral-400">
            {filteredParticipants.length} shown
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isNormalRoom ? "Search by participant name..." : "Search by name, college..."}
            className="w-full pl-8 pr-7 py-2 text-xs bg-neutral-900 border border-neutral-800 hover:border-neutral-700 focus:border-orange-500 rounded-xl outline-none text-white font-medium transition-all placeholder:text-neutral-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Department Filter Chips (LinkedIn Sync Only) */}
        {!isNormalRoom && availableDepts.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pt-1 text-left">
            <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase shrink-0 flex items-center gap-0.5 mr-1">
              <Filter size={10} /> Dept:
            </span>
            {availableDepts.map((dept) => {
              const isActive = selectedDept === dept;
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setSelectedDept(dept)}
                  className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold transition-all shrink-0 cursor-pointer border ${
                    isActive
                      ? "bg-orange-500 text-white border-orange-400"
                      : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200"
                  }`}
                >
                  {dept}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-neutral-800">
        {filteredParticipants.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 space-y-1">
            <p className="text-xs font-bold">No participants found</p>
            <p className="text-[10px]">Try adjusting your search criteria</p>
          </div>
        ) : (
          filteredParticipants.map((p) => {
            const isYou = p.id === currentParticipant.id;
            const isNormalParticipant = isNormalRoom || p.roomType === "normal";

            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl bg-neutral-900/90 border transition-all hover:border-neutral-700 space-y-2 text-left ${
                  isYou ? "border-orange-500/60 bg-orange-500/5" : "border-neutral-800/90"
                }`}
              >
                {/* Top Row: Avatar + Name + Online Badge */}
                <div className="flex items-center gap-2.5 text-left">
                  <div className="relative shrink-0">
                    <img
                      src={
                        isNormalParticipant
                          ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}`
                          : p.photo || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}`
                      }
                      alt={p.name}
                      loading="lazy"
                      className="w-9 h-9 rounded-full object-cover border border-neutral-700 shadow-sm"
                    />
                    <span
                      className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#121212]"
                      title="Online Now"
                    />
                  </div>

                  <div className="min-w-0 flex-1 text-left leading-tight">
                    <div className="flex items-center gap-1">
                      <h3 className="text-xs font-black text-white truncate group-hover:text-orange-400 transition-colors">
                        {p.name}
                      </h3>
                      {isYou && (
                        <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-black bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase shrink-0">
                          YOU
                        </span>
                      )}
                    </div>

                    {isNormalParticipant ? (
                      <p className="text-[9px] font-mono font-bold text-emerald-400 truncate mt-0.5 flex items-center gap-1 uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        ONLINE
                      </p>
                    ) : (
                      (p.department || p.year) && (
                        <p className="text-[10px] font-medium text-neutral-400 truncate mt-0.5 flex items-center gap-1">
                          <GraduationCap size={10} className="shrink-0 text-neutral-500" />
                          <span className="truncate">
                            {[p.department, p.year].filter(Boolean).join(" • ")}
                          </span>
                        </p>
                      )
                    )}
                  </div>
                </div>

                {/* College Info (LinkedIn Only) */}
                {!isNormalParticipant && p.college && (
                  <div className="text-left min-w-0 pt-0.5">
                    <p className="text-[10px] font-bold text-neutral-400 flex items-center gap-1 truncate">
                      <Building size={10} className="shrink-0 text-orange-500/80" />
                      <span className="truncate">{p.college}</span>
                    </p>
                  </div>
                )}

                {/* Connect Button (LinkedIn Only) */}
                {!isNormalParticipant && (
                  <button
                    type="button"
                    onClick={() => onConnectClick(p)}
                    className="w-full py-1 px-2 rounded-lg bg-[#0A66C2] hover:bg-[#084e96] active:scale-[0.98] text-white font-black text-[10px] uppercase tracking-wider transition-all shadow flex items-center justify-center gap-1 cursor-pointer border border-blue-400/30"
                  >
                    <Linkedin size={11} />
                    <span>Connect</span>
                    <ExternalLink size={9} className="opacity-70" />
                  </button>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
