import { MessageSquare, Send, Sparkles } from "lucide-react";
import { EventItem } from "../PublicEventPage";

interface ChatPanelProps {
  event: EventItem;
}

export function ChatPanel({ event }: ChatPanelProps) {
  return (
    <div className="flex flex-col h-full bg-[#121212] border border-neutral-800/90 rounded-2xl overflow-hidden shadow-xl text-left">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-neutral-800 bg-neutral-900/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-orange-500" />
          <h2 className="text-xs font-black uppercase tracking-wider text-white">
            Chat Room
          </h2>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-neutral-800 text-orange-400 border border-neutral-700">
          Coming Soon
        </span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-5 flex flex-col justify-between space-y-4 overflow-y-auto">
        {/* Placeholder Chat Log */}
        <div className="flex-1 min-h-[200px] rounded-2xl bg-neutral-950 border border-neutral-800/80 p-5 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shadow-md">
            <Sparkles size={20} />
          </div>

          <div className="space-y-1 max-w-xs">
            <h3 className="text-sm font-black text-white">
              Live event chat
            </h3>
            <p className="text-xs text-neutral-400 font-medium leading-relaxed">
              Realtime messaging for this room will be activated in an upcoming platform release.
            </p>
          </div>
        </div>

        {/* Disabled Chat Input */}
        <div className="space-y-1.5 pt-2 border-t border-neutral-800/80">
          <div className="flex items-center gap-2">
            <input
              type="text"
              disabled
              placeholder="Type message..."
              className="flex-1 px-3.5 py-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl outline-none text-neutral-500 font-medium cursor-not-allowed placeholder:text-neutral-600"
            />
            <button
              type="button"
              disabled
              className="px-3.5 py-2.5 rounded-xl bg-orange-500/30 text-orange-300/50 text-xs font-bold uppercase tracking-wider cursor-not-allowed border border-orange-500/20 flex items-center gap-1 shrink-0"
            >
              <span>Send</span>
              <Send size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
