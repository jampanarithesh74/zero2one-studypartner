/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Sparkles, ArrowLeft, BookOpen, Clock, Award, FileText } from "lucide-react";
import { useState } from "react";
import { DEPARTMENTS, SYLLABUS_MAP, SUBJECT_DETAILS } from "./data/syllabus";

type ViewState = "year-selection" | "dept-selection" | "sem-selection" | "syllabus-view";

export default function App() {
  const [viewState, setViewState] = useState<ViewState>("year-selection");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedSem, setSelectedSem] = useState<number | null>(null);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);

  const years = [
    { id: 1, label: "1st Year" },
    { id: 2, label: "2nd Year" },
    { id: 3, label: "3rd Year" },
    { id: 4, label: "4th Year" },
  ];

  const handleYearSelect = (id: number) => {
    setSelectedYear(id);
  };

  const handleContinue = () => {
    if (selectedYear === 1) {
      setViewState("dept-selection");
    }
  };

  const getSelectedYearLabel = () => {
    return years.find(y => y.id === selectedYear)?.label || "";
  };

  const renderYearSelection = () => (
    <main className="flex flex-col lg:grid lg:grid-cols-2 lg:h-screen overflow-hidden">
      {/* Left Side: Branding */}
      <section className="relative flex flex-col justify-center lg:justify-between p-8 lg:p-16 bg-[#0a0a0a] text-white overflow-hidden min-h-[40vh] lg:min-h-screen">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <motion.div animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, -30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} className="absolute -top-20 -left-20 w-80 h-80 bg-orange-500/10 blur-[100px] rounded-full" />
          <motion.div animate={{ scale: [1.2, 1, 1.2], x: [0, -40, 0], y: [0, 60, 0] }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute -bottom-40 -right-20 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full" />
        </div>

        <nav className="z-10 lg:mb-0 mb-12">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
            <img src="https://raw.githubusercontent.com/jampanapadmaja/ZERO2ONE/main/logo.png" alt="ZERO2ONE Logo" className="w-12 h-12 rounded-xl object-contain shadow-2xl shadow-orange-500/20" onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://img.icons8.com/color/96/graduation-cap.png"; }} />
            <span className="font-bold tracking-tighter text-2xl uppercase">ZERO2ONE</span>
          </motion.div>
        </nav>

        <div className="z-10 mt-auto md:mb-12 lg:mb-20">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <h1 className="text-6xl md:text-8xl lg:text-[112px] font-bold leading-[0.85] tracking-tighter mb-8">ZERO<span className="text-orange-500 italic">2</span>ONE</h1>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="relative pl-6 border-l border-white/10 mt-8 mb-12 hidden lg:block">
              <p className="text-lg text-neutral-400 font-light leading-relaxed italic max-w-sm">"Excellence is not a skill, it's an attitude. From zero knowledge to one master, we're with you."</p>
              <div className="text-orange-500/40 absolute -top-4 -left-2 rotate-12"><Sparkles size={40} /></div>
            </motion.div>
            <div className="flex gap-4">
              <div className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-semibold flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> Platform Open
              </div>
              <div className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-semibold">Academic Excellence</div>
            </div>
          </motion.div>
        </div>
        <div className="z-10 mt-12 text-xs text-neutral-600 font-mono tracking-widest hidden lg:block">STK // 2026 // BUILD 1.0.4</div>
      </section>

      {/* Right Side: Selection */}
      <section className="flex flex-col justify-center p-8 md:p-12 lg:p-24 bg-white z-10 lg:z-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="max-w-md w-full mx-auto space-y-10">
          <div className="space-y-3">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-neutral-900">Select Your Year</h2>
            <p className="text-neutral-500 text-lg font-light">Tailored resources are just a click away.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {years.map((year, index) => (
              <motion.button key={year.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + index * 0.1 }} onClick={() => handleYearSelect(year.id)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={`group relative flex flex-col justify-between p-6 rounded-3xl border-2 transition-all duration-400 text-left ${selectedYear === year.id ? "border-orange-500 bg-orange-50/30 ring-4 ring-orange-100" : "border-neutral-100 hover:border-neutral-300 hover:bg-neutral-50"}`}>
                <div className="space-y-1">
                  <span className={`block text-3xl font-black tracking-tight ${selectedYear === year.id ? "text-orange-600" : "text-neutral-800"}`}>0{year.id}</span>
                  <span className={`text-sm uppercase tracking-widest font-bold ${selectedYear === year.id ? "text-orange-400" : "text-neutral-400"}`}>{year.label}</span>
                </div>
                <div className={`absolute top-6 right-6 w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedYear === year.id ? "bg-orange-500 text-white" : "bg-neutral-100 text-neutral-300 group-hover:bg-neutral-200 group-hover:text-neutral-600"}`}><ChevronRight size={16} /></div>
              </motion.button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {selectedYear && (
              <motion.button key="continue-btn" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={handleContinue} className="w-full bg-[#0a0a0a] text-white py-6 rounded-[2rem] font-bold text-xl shadow-2xl shadow-neutral-300 hover:bg-neutral-800 transition-all flex items-center justify-center gap-3 active:scale-95">
                Continue to {getSelectedYearLabel()} <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
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
  );

  const renderDeptSelection = () => (
    <div className="min-h-screen bg-white p-8 md:p-16 lg:p-24 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-12">
        <button onClick={() => setViewState("year-selection")} className="flex items-center gap-2 text-neutral-400 hover:text-black transition-colors font-bold uppercase tracking-widest text-xs">
          <ArrowLeft size={16} /> Back to Year Selection
        </button>
        
        <div className="space-y-4">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tighter">Choose Your Department</h2>
          <p className="text-neutral-500 text-xl font-light">Select your branch to view the specific 1st year syllabus.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DEPARTMENTS.map((dept, index) => (
            <motion.button
              key={dept}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => { setSelectedDept(dept); setViewState("sem-selection"); }}
              whileHover={{ x: 10 }}
              className="flex items-center justify-between p-8 rounded-[2rem] bg-neutral-50 border border-neutral-100 hover:border-orange-500/30 hover:bg-orange-50/20 transition-all text-left group"
            >
              <span className="text-xl font-bold text-neutral-800 pr-4">{dept}</span>
              <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-neutral-300 group-hover:bg-orange-500 group-hover:text-white transition-all">
                <ChevronRight size={20} />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSemSelection = () => (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 md:p-16 lg:p-24 flex items-center">
      <div className="max-w-4xl mx-auto w-full space-y-16">
        <button onClick={() => setViewState("dept-selection")} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs">
          <ArrowLeft size={16} /> Back to Departments
        </button>

        <div className="space-y-6">
          <div className="inline-block px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-bold uppercase tracking-widest leading-none mb-4">
            {selectedDept}
          </div>
          <h2 className="text-5xl md:text-7xl font-bold tracking-tighter">Select Semester</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1, 2].map((sem) => (
            <motion.button
              key={sem}
              onClick={() => { setSelectedSem(sem); setViewState("syllabus-view"); }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative h-64 rounded-[3rem] bg-neutral-900 border border-neutral-800 overflow-hidden flex flex-col justify-end p-10 hover:border-orange-500/50 transition-all"
            >
              <div className="absolute top-10 left-10 text-orange-500 opacity-20 group-hover:opacity-100 transition-opacity">
                <Clock size={48} />
              </div>
              <div className="relative z-10 text-left space-y-2">
                <span className="block text-neutral-500 font-bold uppercase tracking-widest text-sm">First Year</span>
                <span className="block text-4xl font-bold">Semester 0{sem}</span>
              </div>
              <div className="absolute top-10 right-10 w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                <ChevronRight size={24} />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSyllabusView = () => {
    const subjects = SYLLABUS_MAP[selectedDept || ""]?.[selectedSem || 1] || [];
    const activeSubjectData = activeSubject ? SUBJECT_DETAILS[activeSubject] : null;

    return (
      <div className="min-h-screen bg-[#fafaf9] overflow-y-auto pb-24">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-neutral-100 p-6">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <button onClick={() => setViewState("sem-selection")} className="flex items-center gap-2 text-neutral-400 hover:text-black transition-colors font-bold uppercase tracking-widest text-xs">
              <ArrowLeft size={16} /> Change Semester
            </button>
            <div className="hidden md:flex flex-col items-center">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">{selectedDept}</span>
              <span className="text-sm font-bold text-neutral-900">Year 01 // Semester 0{selectedSem}</span>
            </div>
            <div className="w-20" />
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-8 pt-16 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-neutral-100 overflow-hidden">
                <div className="p-10 border-b border-neutral-50 bg-neutral-50/50 flex justify-between items-center text-neutral-900">
                  <h3 className="text-2xl font-bold tracking-tight">Course Structure</h3>
                  <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-widest">
                    <Award size={14} className="text-orange-500" />
                    Total Credits: {subjects.reduce((sum, s) => sum + s.credits, 0)}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest font-black text-neutral-400 border-b border-neutral-50">
                        <th className="px-10 py-5">Code</th>
                        <th className="px-6 py-5">Title</th>
                        <th className="px-6 py-5 text-center">Type</th>
                        <th className="px-10 py-5 text-right">Credits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {subjects.map((subject) => (
                        <tr key={subject.code} onClick={() => setActiveSubject(subject.code)} className={`cursor-pointer transition-colors ${activeSubject === subject.code ? "bg-orange-50/50" : "hover:bg-neutral-50/80"}`}>
                          <td className="px-10 py-6 font-mono text-xs text-neutral-500">{subject.code}</td>
                          <td className="px-6 py-6 font-bold text-neutral-800">{subject.title}</td>
                          <td className="px-6 py-6 text-center">
                            <span className="px-2.5 py-1 rounded-md bg-neutral-100 text-[10px] font-black text-neutral-500 uppercase">{subject.type}</span>
                          </td>
                          <td className="px-10 py-6 text-right font-black text-orange-600">{subject.credits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <AnimatePresence mode="wait">
                {activeSubjectData ? (
                  <motion.div key={activeSubject} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-white rounded-[2.5rem] shadow-xl shadow-orange-100/50 border border-orange-100 p-10 space-y-8 sticky top-32 text-neutral-900">
                    <div className="space-y-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest"><FileText size={12} /> Syllabus</div>
                      <h4 className="text-3xl font-bold tracking-tight leading-tightSelection:bg-orange-100">{activeSubjectData.title}</h4>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Outcomes</h5>
                        <ul className="space-y-2">
                          {activeSubjectData.outcomes.map((outcome, i) => (
                            <li key={i} className="text-sm text-neutral-600 flex gap-3 leading-relaxedSelection:bg-neutral-50">
                              <span className="text-orange-500 font-black flex-shrink-0">•</span> {outcome}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-6 pt-4 border-t border-neutral-100">
                        {activeSubjectData.units.map((unit, i) => (
                          <div key={i} className="space-y-2">
                            <h6 className="text-[11px] font-bold text-neutral-900 border-b border-neutral-50 pb-1 uppercase tracking-wider">{unit.title}</h6>
                            <p className="text-sm text-neutral-500 leading-relaxed font-lightSelection:bg-neutral-50">{unit.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-[400px] rounded-[2.5rem] border-4 border-dashed border-neutral-100 flex flex-col items-center justify-center p-12 text-center space-y-6">
                    <div className="w-16 h-16 rounded-[2rem] bg-neutral-50 flex items-center justify-center text-neutral-200"><BookOpen size={32} /></div>
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest">No Subject Selected</p>
                      <p className="text-xs text-neutral-300Selection:bg-neutral-50">Select a subject from the list to view its detailed unit-wise syllabus.</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] text-[#0a0a0a] font-sans selection:bg-orange-100">
      <AnimatePresence mode="wait">
        {viewState === "year-selection" && (
          <motion.div key="year" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderYearSelection()}
          </motion.div>
        )}
        {viewState === "dept-selection" && (
          <motion.div key="dept" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            {renderDeptSelection()}
          </motion.div>
        )}
        {viewState === "sem-selection" && (
          <motion.div key="sem" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            {renderSemSelection()}
          </motion.div>
        )}
        {viewState === "syllabus-view" && (
          <motion.div key="view" initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {renderSyllabusView()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


