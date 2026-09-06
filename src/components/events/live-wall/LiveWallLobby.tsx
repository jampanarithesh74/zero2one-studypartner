/**
 * ZERO2ONE EVENTS — FEATURE 6A
 * LIVE WALL: LOBBY & WAITING STAGE COMPONENT
 *
 * Full-screen projector lobby showing dynamic QR code, event join instructions,
 * real-time attendee stream, and activity sequence roadmap.
 */

import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  Sparkles, 
  Radio, 
  QrCode, 
  Layers, 
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { EventItem } from "../../PublicEventPage";
import { EventActivity } from "../../../services/eventActivityService";
import { EventJoinQRCode } from "../EventJoinQRCode";

interface LiveWallLobbyProps {
  event: EventItem;
  activities: EventActivity[];
  participants: Array<{ id: string; name: string; college?: string; department?: string; photo?: string }>;
  eventCode: string;
}

export function LiveWallLobby({
  event,
  activities,
  participants,
  eventCode,
}: LiveWallLobbyProps) {
  const joinUrl = `${window.location.origin}/events/${event.id}/join`;

  return (
    <div className="w-full h-full flex flex-col justify-between gap-6 p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 backdrop-blur-md shadow-2xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-mono font-black uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
              STAGE IS PRIMED
            </span>
            <span className="text-xs font-mono text-neutral-400">
              Lobby Open
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
            {event.title || (event as any).name || "Zero2One Live Event"}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-xl">
            {event.description || "Welcome! Scan the QR code on your phone or enter the code to join the interactive competition."}
          </p>
        </div>

        {/* Event Code Pill */}
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-neutral-950 border border-orange-500/30 shadow-inner shrink-0">
          <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
            ROOM EVENT CODE
          </span>
          <span className="text-3xl sm:text-4xl font-mono font-black text-orange-400 tracking-wider">
            {eventCode || "READY"}
          </span>
        </div>
      </div>

      {/* Center Layout: QR Code + Attendee Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left: QR Code Join Station */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-md text-center space-y-5">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-white tracking-tight flex items-center justify-center gap-2">
              <QrCode size={20} className="text-orange-400" />
              <span>Scan on Mobile to Join</span>
            </h2>
            <p className="text-xs font-mono text-neutral-400">
              Point phone camera to participate live
            </p>
          </div>

          {/* QR Code Container */}
          <div className="p-4 bg-white rounded-2xl shadow-2xl border-4 border-orange-500/20">
            <EventJoinQRCode eventCode={eventCode} eventId={event.id} eventName={event.title || ""} size={180} showDetails={false} />
          </div>

          <div className="space-y-1 text-center">
            <p className="text-xs font-mono text-neutral-400">
              Direct Link: <span className="text-orange-300 underline break-all">{joinUrl}</span>
            </p>
            <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-neutral-400">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Instant sync • No app installation needed</span>
            </div>
          </div>
        </div>

        {/* Right: Live Attendees Wall & Sequence Plan */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-6 p-6 sm:p-8 rounded-3xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-md">
          {/* Header Stats */}
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
                <Users size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Joined Attendees</h3>
                <p className="text-[11px] font-mono text-neutral-400">
                  Real-time participant presence
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-mono font-black text-white">
                {participants.length}
              </span>
              <span className="text-[10px] font-mono text-neutral-400 uppercase">
                Ready
              </span>
            </div>
          </div>

          {/* Attendee Badges Flow */}
          <div className="flex-1 overflow-y-auto max-h-[260px] pr-2">
            {participants.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-neutral-800/50 flex items-center justify-center text-neutral-500">
                  <Radio size={24} className="animate-pulse" />
                </div>
                <p className="text-xs font-mono text-neutral-400">
                  Awaiting participants to scan QR code and enter room...
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                <AnimatePresence>
                  {participants.map((p, idx) => (
                    <motion.div
                      key={p.id || idx}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="px-3.5 py-2 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-orange-500/40 text-neutral-200 text-xs font-medium flex items-center gap-2 shadow-md"
                    >
                      <div className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-bold font-mono text-[10px] flex items-center justify-center uppercase">
                        {p.name ? p.name.charAt(0) : "P"}
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-white block text-xs">{p.name}</span>
                        {p.college && (
                          <span className="text-[10px] text-neutral-400 font-mono block max-w-[120px] truncate">
                            {p.college}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Activity Sequence Roadmap */}
          <div className="pt-4 border-t border-neutral-800/80">
            <div className="flex items-center gap-2 mb-3">
              <Layers size={14} className="text-orange-400" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300">
                Scheduled Rounds Sequence ({activities.length})
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {activities.map((act, index) => (
                <div
                  key={act.id || index}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs shrink-0"
                >
                  <span className="w-5 h-5 rounded-full bg-neutral-800 text-orange-400 text-[10px] font-mono font-black flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="font-bold text-white truncate max-w-[140px]">
                    {act.title}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-neutral-850 text-neutral-400 border border-neutral-750">
                    {act.type}
                  </span>
                  {index < activities.length - 1 && (
                    <ArrowRight size={12} className="text-neutral-600 ml-1" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Strip */}
      <div className="flex items-center justify-between text-xs font-mono text-neutral-400 py-2 border-t border-neutral-850">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-orange-400" />
          <span>ZERO2ONE LIVE WALL • AUDIENCE PROJECTION DISPLAY</span>
        </div>
        <div>
          Waiting for host to start Round 1...
        </div>
      </div>
    </div>
  );
}
