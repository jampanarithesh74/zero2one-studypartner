import { HelpCircle, Send, Radio, Sparkles, Clock } from "lucide-react";
import { EventItem } from "../PublicEventPage";

interface LiveRoomPanelProps {
  event: EventItem;
}

export function LiveRoomPanel({ event }: LiveRoomPanelProps) {
  return (
    <div className="flex flex-col h-full bg-[#121212] border border-neutral-800/90 rounded-2xl overflow-hidden shadow-xl text-left">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-neutral-800 bg-neutral-900/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-orange-500 animate-pulse" />
          <h2 className="text-xs font-black uppercase tracking-wider text-white">
            Live Room
          </h2>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-orange-500/15 border border-orange-500/30 text-orange-400">
          MAIN STAGE
        </span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 flex flex-col justify-between space-y-6 overflow-y-auto">
        {/* Placeholder Screen / Stage */}
        <div className="flex-1 min-h-[220px] rounded-2xl bg-neutral-950 border border-neutral-800/80 p-6 flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden group">
          {/* Subtle Ambient Background Effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-purple-500/5 pointer-events-none" />
          
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center shadow-lg relative z-10">
            <HelpCircle size={24} />
          </div>

          <div className="space-y-1.5 max-w-sm relative z-10">
            <h3 className="text-base md:text-lg font-black text-white tracking-tight">
              Live Event Area
            </h3>
            <p className="text-xs text-neutral-400 font-medium leading-relaxed">
              Future live questions will appear here.
            </p>
          </div>

          <div className="pt-2 relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold text-neutral-400 bg-neutral-900 border border-neutral-800">
              <Clock size={11} className="text-orange-400" />
              Waiting for administrator...
            </span>
          </div>
        </div>

        {/* Disabled Input Section (Future Response Box) */}
        <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800/90 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono font-black uppercase tracking-wider text-neutral-400 block">
              Response Input
            </label>
            <span className="px-2 py-0.5 rounded-md text-[8px] font-mono font-black uppercase tracking-widest bg-neutral-800 text-orange-400 border border-neutral-700">
              Coming Soon
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              disabled
              placeholder="Your response..."
              className="flex-1 px-4 py-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl outline-none text-neutral-500 font-medium cursor-not-allowed placeholder:text-neutral-600"
            />
            <button
              type="button"
              disabled
              className="px-4 py-2.5 rounded-xl bg-orange-500/30 text-orange-300/50 text-xs font-bold uppercase tracking-wider cursor-not-allowed border border-orange-500/20 flex items-center gap-1.5 shrink-0"
            >
              <span>Submit</span>
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
