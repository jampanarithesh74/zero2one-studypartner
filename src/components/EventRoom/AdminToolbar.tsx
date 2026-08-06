import { useState } from "react";
import { Users, HelpCircle, Presentation, Sparkles } from "lucide-react";

interface AdminToolbarProps {
  isAdmin?: boolean;
  onOpenAskModal?: () => void;
}

export function AdminToolbar({ isAdmin = false, onOpenAskModal }: AdminToolbarProps) {
  const [toastMsg, setToastMsg] = useState<string>("");

  if (!isAdmin) return null;

  const handleAction = (label: string) => {
    if (label === "Ask Question" && onOpenAskModal) {
      onOpenAskModal();
      return;
    }
    setToastMsg(`${label}: Coming Soon`);
    setTimeout(() => {
      setToastMsg("");
    }, 2500);
  };

  return (
    <div className="relative flex items-center gap-1.5 bg-neutral-900/90 border border-orange-500/30 p-1 rounded-xl shadow-lg backdrop-blur-md">
      <div className="px-2 py-0.5 rounded-lg bg-orange-500/20 text-orange-400 text-[9px] font-mono font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
        <Sparkles size={10} />
        <span className="hidden sm:inline">ADMIN</span>
      </div>

      <button
        type="button"
        onClick={() => handleAction("Members Management")}
        className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border border-neutral-700/60"
        title="Manage Room Members"
      >
        <Users size={12} className="text-orange-400" />
        <span className="hidden md:inline">Members</span>
      </button>

      <button
        type="button"
        onClick={() => handleAction("Ask Question")}
        className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border border-neutral-700/60"
        title="Trigger Live Question"
      >
        <HelpCircle size={12} className="text-orange-400" />
        <span className="hidden md:inline">Ask Question</span>
      </button>

      <button
        type="button"
        onClick={() => handleAction("Live Wall Control")}
        className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border border-neutral-700/60"
        title="Control Live Wall"
      >
        <Presentation size={12} className="text-orange-400" />
        <span className="hidden md:inline">Live Wall</span>
      </button>

      {toastMsg && (
        <div className="absolute top-full right-0 mt-2 px-3 py-1.5 rounded-lg bg-orange-500 text-white font-mono font-bold text-[10px] shadow-xl z-50 whitespace-nowrap animate-bounce">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
