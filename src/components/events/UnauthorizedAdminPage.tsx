import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export function UnauthorizedAdminPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 text-center space-y-6 font-sans">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shadow-lg">
        <ShieldAlert size={32} />
      </div>

      <div className="space-y-2 max-w-md">
        <span className="text-[10px] font-black uppercase tracking-widest text-red-500 font-mono">
          403 UNAUTHORIZED
        </span>
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
          Access Restricted
        </h1>
        <p className="text-xs md:text-sm text-neutral-400 font-medium leading-relaxed">
          Event creation, editing, and management controls are reserved exclusively for authorized campus platform administrators.
        </p>
      </div>

      <button
        type="button"
        onClick={() => navigate("/events")}
        className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border border-orange-400/40 shadow-xl"
      >
        <ArrowLeft size={16} />
        <span>Return to Campus Events</span>
      </button>
    </div>
  );
}
