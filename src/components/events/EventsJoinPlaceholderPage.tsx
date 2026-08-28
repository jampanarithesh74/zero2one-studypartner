import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Users, Sparkles } from "lucide-react";

export function EventsJoinPlaceholderPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-between selection:bg-orange-500/30 selection:text-orange-200 font-sans">
      {/* Top Bar */}
      <header className="w-full border-b border-neutral-900 bg-[#09090c]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/events")}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            aria-label="Back to Events"
          >
            <ArrowLeft size={14} />
            <span>Back to Events</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-tight text-white uppercase">
              ZERO<span className="text-orange-500">2</span>ONE
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
              JOIN
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Placeholder */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-16">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="max-w-md w-full mx-auto text-center space-y-6 bg-neutral-900/60 border border-neutral-800 p-8 sm:p-10 rounded-3xl shadow-2xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto shadow-sm">
            <Users size={28} />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles size={12} />
              <span>Feature In Progress</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
              JOIN AN EVENT
            </h1>
            <p className="text-sm text-neutral-400 font-normal leading-relaxed">
              Join flow coming next.
            </p>
          </div>

          <div className="pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => navigate("/events")}
              className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border border-neutral-700"
            >
              Return to Events Hub
            </button>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-900 bg-[#08080a] py-6 text-center text-xs text-neutral-500">
        ZERO2ONE EVENTS // 2026
      </footer>
    </div>
  );
}
