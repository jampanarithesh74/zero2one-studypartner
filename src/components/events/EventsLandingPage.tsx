import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Users, 
  Radio, 
  ShieldCheck
} from "lucide-react";

export function EventsLandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-between selection:bg-orange-500/30 selection:text-orange-200 font-sans">
      {/* Top Header / Navigation Bar */}
      <header className="w-full border-b border-neutral-900 bg-[#09090c]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Product Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shadow-md shadow-black/40 overflow-hidden shrink-0">
              <img 
                src="https://raw.githubusercontent.com/jampanapadmaja/ZERO2ONE/main/logo.png" 
                alt="ZERO2ONE Logo" 
                className="w-6 h-6 object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://img.icons8.com/color/96/graduation-cap.png"; }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-white uppercase">
                ZERO<span className="text-orange-500">2</span>ONE
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                EVENTS
              </span>
            </div>
          </div>

          {/* Quick link back to StudyPartner Notes & Resources */}
          <button
            type="button"
            id="back-to-studypartner-btn"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            aria-label="Return to ZERO2ONE StudyPartner"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">StudyPartner</span>
            <span className="sm:hidden">Study</span>
          </button>
        </div>
      </header>

      {/* Main Hero & Action Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="max-w-3xl w-full mx-auto text-center space-y-8 md:space-y-12">
          
          {/* Hero Header Area */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs font-semibold">
              <Sparkles size={13} className="text-orange-500" />
              <span>Interactive Live Platform</span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight uppercase">
              ZERO2ONE <span className="text-orange-500">EVENTS</span>
            </h1>

            <p className="text-lg sm:text-2xl font-bold text-neutral-200 tracking-tight">
              Create. Host. Participate.
            </p>

            <p className="text-sm sm:text-base text-neutral-400 font-normal max-w-xl mx-auto leading-relaxed">
              ZERO2ONE lets people participate in interactive live events and lets organizers host them with real-time stage tools.
            </p>
          </motion.div>

          {/* Primary Action Cards / Buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-2xl mx-auto w-full pt-2"
          >
            {/* Action 1: JOIN AN EVENT */}
            <motion.button
              type="button"
              id="join-event-action-btn"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/events/join")}
              className="group relative flex flex-col justify-between p-6 sm:p-8 rounded-3xl bg-neutral-900/90 border border-neutral-800 hover:border-orange-500/50 hover:bg-neutral-900 transition-all duration-300 text-left shadow-xl shadow-black/40 cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              aria-label="Join an event"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all duration-300 shadow-sm shrink-0">
                  <Users size={22} />
                </div>

                <div className="space-y-1.5 text-left">
                  <div className="text-xs font-black uppercase tracking-wider text-orange-400">
                    For Participants
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight uppercase">
                    JOIN AN EVENT
                  </h2>
                  <p className="text-xs text-neutral-400 leading-relaxed font-normal">
                    Enter an event code or scan to participate in interactive sessions.
                  </p>
                </div>
              </div>

              <div className="pt-6 mt-4 border-t border-neutral-800/80 flex items-center justify-between text-xs font-bold text-neutral-300 group-hover:text-orange-400 transition-colors">
                <span>Enter Session</span>
                <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all">
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </motion.button>

            {/* Action 2: HOST AN EVENT */}
            <motion.button
              type="button"
              id="host-event-action-btn"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/events/host")}
              className="group relative flex flex-col justify-between p-6 sm:p-8 rounded-3xl bg-neutral-900/90 border border-neutral-800 hover:border-orange-500/50 hover:bg-neutral-900 transition-all duration-300 text-left shadow-xl shadow-black/40 cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              aria-label="Host an event"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all duration-300 shadow-sm shrink-0">
                  <Radio size={22} />
                </div>

                <div className="space-y-1.5 text-left">
                  <div className="text-xs font-black uppercase tracking-wider text-orange-400">
                    For Organizers
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight uppercase">
                    HOST AN EVENT
                  </h2>
                  <p className="text-xs text-neutral-400 leading-relaxed font-normal">
                    Create, manage, and run live interactive events with full control.
                  </p>
                </div>
              </div>

              <div className="pt-6 mt-4 border-t border-neutral-800/80 flex items-center justify-between text-xs font-bold text-neutral-300 group-hover:text-orange-400 transition-colors">
                <span>Organizer Portal</span>
                <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all">
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </motion.button>
          </motion.div>

          {/* Trust / Reliability Micro-tag */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-500 font-medium">
            <ShieldCheck size={14} className="text-neutral-600" />
            <span>Built for high-concurrency real-time campus events</span>
          </div>

        </div>
      </main>

      {/* Clean Bottom Footer */}
      <footer className="w-full border-t border-neutral-900 bg-[#08080a] py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-400">ZERO2ONE EVENTS</span>
            <span>•</span>
            <span>Interactive Live Engine</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs"
            >
              StudyPartner Home
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => navigate("/tools")}
              className="text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs"
            >
              Academic Tools
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
