/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Sparkles } from "lucide-react";
import { useState } from "react";

export default function App() {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const years = [
    { id: 1, label: "1st Year" },
    { id: 2, label: "2nd Year" },
    { id: 3, label: "3rd Year" },
    { id: 4, label: "4th Year" },
  ];

  const getSelectedYearLabel = () => {
    return years.find(y => y.id === selectedYear)?.label || "";
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] text-[#0a0a0a] font-sans selection:bg-orange-100">
      <main className="flex flex-col lg:grid lg:grid-cols-2 lg:h-screen overflow-hidden">
        
        {/* Left Side: Branding */}
        <section className="relative flex flex-col justify-center lg:justify-between p-8 lg:p-16 bg-[#0a0a0a] text-white overflow-hidden min-h-[40vh] lg:min-h-screen">
          
          {/* Subtle Animated Background Elements */}
          <div className="absolute inset-0 z-0">
            {/* Moving Grid */}
            <div 
              className="absolute inset-0 opacity-[0.03]" 
              style={{ 
                backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', 
                backgroundSize: '40px 40px' 
              }} 
            />
            {/* Animated Glow Blobs */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                x: [0, 50, 0],
                y: [0, -30, 0],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute -top-20 -left-20 w-80 h-80 bg-orange-500/10 blur-[100px] rounded-full"
            />
            <motion.div
              animate={{
                scale: [1.2, 1, 1.2],
                x: [0, -40, 0],
                y: [0, 60, 0],
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="absolute -bottom-40 -right-20 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full"
            />
          </div>

          {/* Logo & Header (Always Top on Mobile) */}
          <nav className="z-10 lg:mb-0 mb-12">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4"
            >
              <img 
                src="https://raw.githubusercontent.com/jampanapadmaja/ZERO2ONE/main/logo.png" 
                alt="ZERO2ONE Logo" 
                className="w-12 h-12 rounded-xl object-contain shadow-2xl shadow-orange-500/20"
                onError={(e) => {
                  // Fallback if the logo URL isn't ready or accessible
                  (e.currentTarget as HTMLImageElement).src = "https://img.icons8.com/color/96/graduation-cap.png";
                }}
              />
              <span className="font-bold tracking-tighter text-2xl">ZERO2ONE</span>
            </motion.div>
          </nav>

          {/* Main Title & Content */}
          <div className="z-10 mt-auto md:mb-12 lg:mb-20">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-6xl md:text-8xl lg:text-[112px] font-bold leading-[0.85] tracking-tighter mb-8">
                ZERO<span className="text-orange-500 italic">2</span>ONE
              </h1>
              
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="relative pl-6 border-l border-white/10 mt-8 mb-12 hidden lg:block"
              >
                <p className="text-lg text-neutral-400 font-light leading-relaxed italic max-w-sm">
                  "Excellence is not a skill, it's an attitude. From zero knowledge to one master, we're with you."
                </p>
                <div className="text-orange-500/40 absolute -top-4 -left-2 rotate-12">
                  <Sparkles size={40} />
                </div>
              </motion.div>
              
              <div className="flex gap-4 flex-wrap lg:flex-nowrap">
                <div className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-semibold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> Platform Open
                </div>
                <div className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-semibold flex items-center gap-2">
                  Academic Excellence
                </div>
              </div>
            </motion.div>
          </div>

          <div className="z-10 mt-12 text-xs text-neutral-600 font-mono tracking-widest hidden lg:block">
            STK // 2026 // BUILD 1.0.4
          </div>
        </section>

        {/* Right Side: Selection */}
        <section className="flex flex-col justify-center p-8 md:p-12 lg:p-24 bg-white z-10 lg:z-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="max-w-md w-full mx-auto space-y-10"
          >
            <div className="space-y-3">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-neutral-900">
                Select Your Year
              </h2>
              <p className="text-neutral-500 text-lg font-light">
                Tailored resources are just a click away.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {years.map((year, index) => (
                <motion.button
                  key={year.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  onClick={() => setSelectedYear(year.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`
                    group relative flex flex-col justify-between p-6 rounded-3xl border-2 transition-all duration-400 text-left
                    ${selectedYear === year.id 
                      ? "border-orange-500 bg-orange-50/30 ring-4 ring-orange-100" 
                      : "border-neutral-100 hover:border-neutral-300 hover:bg-neutral-50"
                    }
                  `}
                >
                  <div className="space-y-1">
                    <span className={`block text-3xl font-black tracking-tight ${selectedYear === year.id ? "text-orange-600" : "text-neutral-800"}`}>
                      {year.id === 1 ? '01' : year.id === 2 ? '02' : year.id === 3 ? '03' : '04'}
                    </span>
                    <span className={`text-sm uppercase tracking-widest font-bold ${selectedYear === year.id ? "text-orange-400" : "text-neutral-400"}`}>
                      {year.label}
                    </span>
                  </div>
                  
                  <div className={`
                    absolute top-6 right-6 w-8 h-8 rounded-full flex items-center justify-center transition-all
                    ${selectedYear === year.id ? "bg-orange-500 text-white" : "bg-neutral-100 text-neutral-300 group-hover:bg-neutral-200 group-hover:text-neutral-600"}
                  `}>
                    <ChevronRight size={16} />
                  </div>
                </motion.button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {selectedYear && (
                <motion.button
                  key="continue-btn"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full bg-[#0a0a0a] text-white py-6 rounded-[2rem] font-bold text-xl shadow-2xl shadow-neutral-300 hover:bg-neutral-800 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  Continue to {getSelectedYearLabel()}
                  <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                </motion.button>
              )}
            </AnimatePresence>

            <div className="pt-12 border-t border-neutral-100 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-neutral-400 uppercase tracking-widest font-bold">
              <span>ZERO2ONE © 2026</span>
              <div className="flex gap-6">
                <a href="#" className="hover:text-black transition-colors underline decoration-neutral-200 underline-offset-4">Terms</a>
                <a href="#" className="hover:text-black transition-colors underline decoration-neutral-200 underline-offset-4">Academic Help</a>
              </div>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}


