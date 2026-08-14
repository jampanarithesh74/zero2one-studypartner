import { ArrowLeft, Users, Share2, Check, Radio, Globe, Shield } from "lucide-react";
import { EventItem } from "../PublicEventPage";
import { AdminToolbar } from "./AdminToolbar";

interface RoomHeaderProps {
  event: EventItem;
  participantCount: number;
  isAdmin?: boolean;
  onOpenAskModal?: () => void;
  onNavigateLiveWall?: () => void;
  onBackToEvent: () => void;
  onNavigateHome: () => void;
  onCopyShareLink: () => void;
  copied: boolean;
}

export function RoomHeader({
  event,
  participantCount,
  isAdmin = false,
  onOpenAskModal,
  onNavigateLiveWall,
  onBackToEvent,
  onNavigateHome,
  onCopyShareLink,
  copied,
}: RoomHeaderProps) {
  const isNormalRoom = event.roomType === "normal";

  const formatStartTime = (isoStr: string) => {
    if (!isoStr) return "Live";
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "Live";
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-neutral-800/90 text-white font-sans">
      {/* Top Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Left: Navigation & Branding */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToEvent}
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer border border-neutral-800 shrink-0"
            title="Back to Event Details"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                {event.title}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-black uppercase tracking-wider bg-orange-500/15 border border-orange-500/30 text-orange-400 shrink-0">
                {isNormalRoom ? "○ Normal Room" : "○ LinkedIn Sync"}
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 font-medium truncate hidden sm:block">
              {event.venue}
            </p>
          </div>
        </div>

        {/* Right: Actions & Admin Toolbar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Share Button */}
          <button
            type="button"
            onClick={onCopyShareLink}
            className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white text-xs font-bold transition-all cursor-pointer border border-neutral-800 flex items-center gap-1.5 shrink-0"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-400" />
                <span className="text-emerald-400 font-mono text-[11px]">Copied!</span>
              </>
            ) : (
              <>
                <Share2 size={13} className="text-orange-400" />
                <span className="hidden sm:inline">Share</span>
              </>
            )}
          </button>

          {/* Admin Toolbar (Only rendered if admin) */}
          <AdminToolbar
            isAdmin={isAdmin}
            onOpenAskModal={onOpenAskModal}
            eventId={event.id}
            onNavigateLiveWall={onNavigateLiveWall}
          />
        </div>
      </div>

      {/* Conference Status Bar */}
      <div className="bg-neutral-900/60 border-t border-neutral-800/60 px-4 sm:px-6 py-1.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[10px] font-mono text-neutral-400 overflow-x-auto scrollbar-none gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1.5 text-emerald-400 font-black tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              🟢 LIVE NOW
            </span>
            <span className="text-neutral-600">|</span>
            <span>
              <strong className="text-neutral-300">Room Type:</strong>{" "}
              {isNormalRoom ? "Normal Room" : "LinkedIn Sync"}
            </span>
            {isAdmin && (
              <>
                <span className="text-neutral-600">|</span>
                <span className="flex items-center gap-1 text-neutral-300 font-bold">
                  <Users size={11} className="text-orange-400" />
                  {participantCount} Active
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span>
              <strong className="text-neutral-300">Started:</strong> {formatStartTime(event.startDate)}
            </span>
            <span className="text-neutral-600">|</span>
            <span className="text-orange-400 font-bold">ZERO2ONE Platform</span>
          </div>
        </div>
      </div>
    </header>
  );
}
