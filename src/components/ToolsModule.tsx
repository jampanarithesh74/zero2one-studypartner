import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, Calculator, BookOpen, Clock, Settings, Sparkles, 
  Trash2, AlertCircle, Check, HelpCircle, ChevronRight, Book, 
  TrendingUp, Award, Lock, Play, RotateCcw, User as UserIcon
} from "lucide-react";
import { SYLLABUS_MAP, SUBJECT_LTP } from "../data/syllabus";

interface ToolsModuleProps {
  userProfile: any;
  navigate: (path: string) => void;
  showToast: (msg: string) => void;
  activeSubView: "menu" | "sgpa" | "cgpa";
  setActiveSubView: (view: "menu" | "sgpa" | "cgpa") => void;
  setViewState: (state: any) => void;
}

// Default standard UGC CBCS grading scale
interface GradeBoundary {
  grade: string;
  min: number;
  max: number;
  points: number;
}

const DEFAULT_GRADING_SCALE: GradeBoundary[] = [
  { grade: "O", min: 90, max: 100, points: 10 },
  { grade: "A+", min: 80, max: 89, points: 9 },
  { grade: "A", min: 70, max: 79, points: 8 },
  { grade: "B+", min: 60, max: 69, points: 7 },
  { grade: "B", min: 50, max: 59, points: 6 },
  { grade: "C", min: 40, max: 49, points: 5 },
  { grade: "F", min: 0, max: 39, points: 0 },
];

export function ToolsModule({ 
  userProfile, 
  navigate, 
  showToast, 
  activeSubView, 
  setActiveSubView,
  setViewState 
}: ToolsModuleProps) {

  // Format first name nicely
  const studentName = userProfile?.email ? userProfile.email.split("@")[0].toUpperCase() : "STUDENT";
  const formalName = userProfile?.displayName ? userProfile.displayName.trim() : studentName;
  const firstName = formalName.split(" ")[0].charAt(0).toUpperCase() + formalName.split(" ")[0].slice(1).toLowerCase();

  // Helper: Resolve department case/abbreviation-insensitively
  const resolveDepartmentName = (deptUri: string | undefined): string => {
    if (!deptUri) return "Information Technology";
    const decoded = decodeURIComponent(deptUri).trim();
    const DEPT_KEYS = Object.keys(SYLLABUS_MAP);
    if (DEPT_KEYS.includes(decoded)) return decoded;
    
    const cleanUri = decoded.toLowerCase().replace(/[-_]/g, " ");
    const found = DEPT_KEYS.find(d => {
      const cleanD = d.toLowerCase();
      const upperUri = decoded.toUpperCase();
      return cleanD === cleanUri || 
             cleanD.startsWith(cleanUri) || 
             cleanUri.startsWith(cleanD) ||
             (upperUri === "CSE" && d === "Computer Science and Engineering") ||
             (upperUri === "CS" && d === "Computer Science and Engineering") ||
             (upperUri === "IT" && d === "Information Technology") ||
             (upperUri === "AI" && d === "Artificial Intelligence") ||
             (upperUri === "AIML" && d === "Artificial Intelligence & Machine Learning") ||
             (upperUri === "DATA SCIENCE" && d === "CSE (Data Science)") ||
             (upperUri === "CYBER SECURITY" && d === "CSE (Cyber Security)") ||
             (upperUri === "EEE" && d === "Electrical & Electronics Engineering") ||
             (upperUri === "ECE" && d === "Electronics & Communication Engineering") ||
             (upperUri === "ME" && d === "Mechanical Engineering") ||
             (upperUri === "CE" && d === "Civil Engineering");
    });
    return found || "Information Technology";
  };

  const detectedDept = resolveDepartmentName(userProfile?.departmentName || userProfile?.departmentCode);
  const detectedYear = userProfile?.effectiveAcademicYear || 1;

  // Configuration for Grade boundaries (Configurability Requirement)
  const [gradingScale, setGradingScale] = useState<GradeBoundary[]>(DEFAULT_GRADING_SCALE);
  const [showConfig, setShowConfig] = useState(false);

  // --- SGPA Predictor State ---
  const [sgpaDept, setSgpaDept] = useState<string>(detectedDept);
  
  // Available semesters for the chosen department
  const availableSemicons = SYLLABUS_MAP[sgpaDept] ? Object.keys(SYLLABUS_MAP[sgpaDept]).map(Number).sort((a,b)=>a-b) : [1, 2];
  
  // Choose default semester based on year: e.g. Year 2 -> Sem 3
  const defaultSem = availableSemicons.includes((detectedYear * 2) - 1) ? (detectedYear * 2) - 1 : availableSemicons[0] || 1;
  const [sgpaSem, setSgpaSem] = useState<number>(defaultSem);

  // Sync default values when profile loads
  useEffect(() => {
    if (detectedDept) {
      setSgpaDept(detectedDept);
    }
  }, [detectedDept]);

  useEffect(() => {
    const semic = SYLLABUS_MAP[sgpaDept] ? Object.keys(SYLLABUS_MAP[sgpaDept]).map(Number).sort((a,b)=>a-b) : [1, 2];
    const def = semic.includes((detectedYear * 2) - 1) ? (detectedYear * 2) - 1 : semic[0] || 1;
    setSgpaSem(def);
  }, [sgpaDept, detectedYear]);

  // SGPA Marks mapping: code -> marks fields
  // Using strings for inputs so students can edit peacefully without '0' prefix issues
  type SubjectMark = {
    mid1: string;
    mid2: string;
    assignment: string;
    semester: string;
    skillTest: string;
    dayToDay: string;
    semLab: string;
  };
  const [marks, setMarks] = useState<Record<string, SubjectMark>>({});

  // Reset or initialize marks for active subjects
  const getCurrentSubjects = () => {
    if (!SYLLABUS_MAP[sgpaDept]) return [];
    return SYLLABUS_MAP[sgpaDept][sgpaSem] || [];
  };

  const isLabSubject = (subject: any) => {
    const code = subject.code;
    const ltp = SUBJECT_LTP[code] || { L: 3, T: 0, P: 0 };
    const titleLower = (subject.title || "").toLowerCase();
    
    if (ltp.L === 0) return true;
    if (titleLower.includes("lab") || 
        titleLower.includes("laboratory") || 
        titleLower.includes("workshop") || 
        titleLower.includes("practice") || 
        titleLower.includes("practices") || 
        titleLower.includes("project") ||
        titleLower.includes("seminar")) {
      return true;
    }
    return false;
  };

  const handleMarkChange = (code: string, field: keyof SubjectMark, val: string) => {
    // Validate value max boundaries to prevent typing ridiculous numbers
    let max = 100;
    if (field === "mid1" || field === "mid2" || field === "dayToDay") max = 20;
    if (field === "assignment") max = 10;
    if (field === "semester" || field === "semLab") max = 50;
    if (field === "skillTest") max = 30;

    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      if (num < 0) return;
      if (num > max) {
        val = max.toString();
      }
    }

    setMarks(prev => ({
      ...prev,
      [code]: {
        ...(prev[code] || { mid1: "", mid2: "", assignment: "", semester: "", skillTest: "", dayToDay: "", semLab: "" }),
        [field]: val
      }
    }));
  };

  const clearAllMarks = () => {
    setMarks({});
    showToast("Cleared all entered marks!");
  };

  // Helper to convert total marks to grade and grade points based on custom scale
  const getGradeAndPoints = (total: number): { grade: string; points: number } => {
    const matched = gradingScale.find(scale => total >= scale.min && total <= scale.max);
    return matched ? { grade: matched.grade, points: matched.points } : { grade: "F", points: 0 };
  };

  // Live SGPA calculation
  const calculateLiveSGPA = () => {
    const subjects = getCurrentSubjects();
    if (subjects.length === 0) return { sgpa: "0.00", totalCredits: 0 };

    let totalSum = 0;
    let totalCredits = 0;

    subjects.forEach(sub => {
      const code = sub.code;
      const credit = sub.credits;
      const isLab = isLabSubject(sub);
      const subMark = marks[code] || { mid1: "", mid2: "", assignment: "", semester: "", skillTest: "", dayToDay: "", semLab: "" };

      let totalMarksForSubject = 0;
      if (isLab) {
        const skill = parseFloat(subMark.skillTest) || 0;
        const dtd = parseFloat(subMark.dayToDay) || 0;
        const labsem = parseFloat(subMark.semLab) || 0;
        totalMarksForSubject = skill + dtd + labsem;
      } else {
        const m1 = parseFloat(subMark.mid1) || 0;
        const m2 = parseFloat(subMark.mid2) || 0;
        const assign = parseFloat(subMark.assignment) || 0;
        const sem = parseFloat(subMark.semester) || 0;
        totalMarksForSubject = m1 + m2 + assign + sem;
      }

      // Constrain max marks to 100
      totalMarksForSubject = Math.min(100, Math.max(0, totalMarksForSubject));
      const { points } = getGradeAndPoints(totalMarksForSubject);

      totalSum += (points * credit);
      totalCredits += credit;
    });

    if (totalCredits === 0) return { sgpa: "0.00", totalCredits: 0 };
    const calculated = totalSum / totalCredits;
    return { sgpa: calculated.toFixed(2), totalCredits };
  };

  const { sgpa: predictedSGPA, totalCredits: sgpaTotalCredits } = calculateLiveSGPA();


  // --- CGPA Calculator State ---
  const yearsToRender = [1, 2, 3, 4].filter(yr => yr <= detectedYear);
  const totalSemesters = detectedYear * 2;
  const [cgpaInputs, setCgpaInputs] = useState<string[]>(Array(8).fill(""));

  const handleCgpaInputChange = (index: number, value: string) => {
    // Only allow floating numbers between 0 and 10
    if (value !== "") {
      const num = parseFloat(value);
      if (isNaN(num)) return;
      if (num < 0) return;
      if (num > 10) {
        value = "10.0";
      }
    }
    setCgpaInputs(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const clearAllCGPA = () => {
    setCgpaInputs(Array(8).fill(""));
    showToast("Cleared CGPA calculator fields!");
  };

  // Sequence Validation for CGPA
  // Users may stop entering values at any semester.
  // Valid: Sem1=8.1, Sem2=8.4, Sem3="", Sem4=""
  // Invalid: Sem1=8.1, Sem2="", Sem3=8.4
  const validateCGPASequence = (): { isValid: boolean; errorSemIndex: number | null } => {
    // Check semester sequence up to totalSemesters
    let seenEmpty = false;
    for (let i = 0; i < totalSemesters; i++) {
      const val = cgpaInputs[i].trim();
      if (val === "") {
        seenEmpty = true;
      } else {
        if (seenEmpty) {
          // Found an entered semester after an empty one: invalid sequence!
          return { isValid: false, errorSemIndex: i };
        }
      }
    }
    return { isValid: true, errorSemIndex: null };
  };

  const { isValid: sequenceValid, errorSemIndex } = validateCGPASequence();

  // CGPA calculation
  const calculateLiveCGPA = () => {
    if (!sequenceValid) return "--";
    
    let sum = 0;
    let count = 0;
    for (let i = 0; i < totalSemesters; i++) {
      const val = cgpaInputs[i].trim();
      if (val !== "") {
        const parsed = parseFloat(val);
        if (!isNaN(parsed)) {
          sum += parsed;
          count++;
        }
      }
    }

    if (count === 0) return "0.00";
    return (sum / count).toFixed(2);
  };

  const predictedCGPA = calculateLiveCGPA();


  // --- Render Functions ---

  // Category view home
  if (activeSubView === "menu") {
    return (
      <div className="w-full h-screen bg-[#070707] text-white flex overflow-hidden select-none">
        
        {/* Desktop Sidebar Layout */}
        <aside className="hidden md:flex flex-col w-64 bg-neutral-950 border-r border-neutral-900 justify-between p-6 shrink-0 h-screen sticky top-0 font-sans">
          <div className="space-y-8">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <img 
                src="https://raw.githubusercontent.com/jampanapadmaja/ZERO2ONE/main/logo.png" 
                alt="ZERO2ONE" 
                className="w-8 h-8 object-contain" 
                onError={(e) => { e.currentTarget.src = "https://img.icons8.com/color/96/graduation-cap.png"; }} 
              />
              <span className="font-black text-lg tracking-wider text-white">ZERO<span className="text-orange-500">2</span>ONE</span>
            </div>

            {/* Navigation links */}
            <nav className="flex flex-col gap-2.5">
              <button 
                type="button" 
                onClick={() => { setViewState("dashboard"); navigate("/dashboard"); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 text-neutral-400 hover:text-neutral-300 hover:bg-neutral-900/50 text-left border-none cursor-pointer"
              >
                <TrendingUp size={16} /> Dashboard
              </button>
              <button 
                type="button" 
                onClick={() => { setViewState("resources-view"); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 text-neutral-400 hover:text-neutral-300 hover:bg-neutral-900/50 text-left border-none cursor-pointer"
              >
                <BookOpen size={16} /> Resources
              </button>
              <button 
                type="button" 
                onClick={() => { setActiveSubView("menu"); }}
                className="flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-250 text-orange-500 bg-orange-500/5 border border-orange-500/10 text-left cursor-pointer"
              >
                <span className="flex items-center gap-3"><Calculator size={16} /> Tools</span>
              </button>
              <button 
                type="button" 
                onClick={() => { setViewState("profile-page"); navigate("/profile"); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 text-neutral-400 hover:text-neutral-300 hover:bg-neutral-900/50 text-left border-none cursor-pointer"
              >
                <UserIcon size={16} /> Profile
              </button>
            </nav>
          </div>

          <div className="bg-[#0f0f0f] border border-neutral-900 p-4 rounded-2xl flex flex-col items-center gap-3 text-center">
            <Award size={24} className="text-orange-500 animate-[pulse_3s_infinite]" />
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase text-neutral-300 tracking-wider">Empowering Excellence</p>
              <p className="text-[9px] text-[#525252] leading-tight font-light">Dedicated platform for students of Anurag University</p>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 flex flex-col h-full bg-[#070707] overflow-hidden">
          {/* Header */}
          <header className="bg-[#070707]/90 backdrop-blur-md z-50 p-4 border-b border-neutral-900/60 flex justify-between items-center select-none shrink-0 font-sans">
            {/* Mobile Back / Title */}
            <div className="flex items-center gap-3">
              <ArrowLeft 
                size={20} 
                className="text-neutral-400 cursor-pointer hover:text-white transition-colors" 
                onClick={() => { setViewState("dashboard"); navigate("/dashboard"); }} 
              />
              <div className="flex flex-col">
                <h2 className="text-base font-black text-white uppercase tracking-tight leading-none">Tools Hub</h2>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Academic Station</span>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-[#0d0d0d] border border-neutral-900 px-3 py-1.5 rounded-xl font-mono text-[10px] text-neutral-400">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              <span>STK READY</span>
            </div>
          </header>

          {/* Scaffold Scroll container */}
          <div className="flex-1 overflow-y-auto max-w-lg mx-auto w-full p-4 md:p-6 space-y-6 pb-28 md:pb-6 font-sans">
            
            {/* Introduction info */}
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-orange-500">STUDENT ESSENTIALS</p>
              <h1 className="text-2xl font-black text-white tracking-tight leading-none">Academic Tools Suite</h1>
              <p className="text-xs text-neutral-400 font-light leading-relaxed">
                Supercharge your academic performance tracker. Quickly predict SGPAs with correct university subjects, or compute your cumulative CGPA.
              </p>
            </div>

            {/* Category 1: Academic Calculators (Functional) */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase text-neutral-400 tracking-wider">
                <Calculator size={14} className="text-orange-500" />
                <span>Academic Calculators</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {/* SGPA Predictor */}
                <button 
                  type="button"
                  onClick={() => setActiveSubView("sgpa")}
                  className="group p-4 bg-[#0c0c0c] border border-neutral-900 hover:border-orange-500/30 rounded-2xl text-left transition-all duration-200 cursor-pointer flex justify-between items-center"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/5 border border-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                      <BookOpen size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-extrabold text-white uppercase tracking-tight group-hover:text-orange-500 transition-colors">SGPA Predictor</h4>
                      <p className="text-[10px] text-neutral-450 tracking-tight leading-tight mt-0.5">Predict sem grade point based on expected subject scores.</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-neutral-500 group-hover:text-white transition-colors shrink-0 font-bold" />
                </button>

                {/* CGPA Calculator */}
                <button 
                  type="button"
                  onClick={() => setActiveSubView("cgpa")}
                  className="group p-4 bg-[#0c0c0c] border border-neutral-900 hover:border-orange-500/30 rounded-2xl text-left transition-all duration-200 cursor-pointer flex justify-between items-center"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/5 border border-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                      <TrendingUp size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-extrabold text-white uppercase tracking-tight group-hover:text-purple-400 transition-colors">CGPA Calculator</h4>
                      <p className="text-[10px] text-neutral-450 tracking-tight leading-tight mt-0.5">Combine your semester records to compute your overall pointer.</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-neutral-500 group-hover:text-white transition-colors shrink-0 font-bold" />
                </button>
              </div>
            </div>

            {/* Category 2: Productivity (Coming Soon) */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase text-neutral-400 tracking-wider">
                <Clock size={14} className="text-orange-550" />
                <span>Productivity Tools</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Pomodoro Timer */}
                <div 
                  onClick={() => showToast("Pomodoro timer is coming soon! ⏱️")}
                  className="group p-4 bg-[#0a0a0a] border border-neutral-950 rounded-2xl text-left cursor-not-allowed opacity-75 relative flex justify-between items-center"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-850 flex items-center justify-center text-neutral-600 shrink-0">
                      <Clock size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-tight">Pomodoro Timer</h4>
                      <p className="text-[9px] text-neutral-650 tracking-tight mt-0.5">Focus intervals for studying.</p>
                    </div>
                  </div>
                  <span className="text-[8px] bg-neutral-900 text-neutral-500 px-1.5 py-0.5 border border-neutral-850 rounded-md font-mono shrink-0 uppercase tracking-widest font-black">SOON</span>
                </div>

                {/* Study Planner */}
                <div 
                  onClick={() => showToast("Study planner and scheduler is coming soon! 📅")}
                  className="group p-4 bg-[#0a0a0a] border border-neutral-950 rounded-2xl text-left cursor-not-allowed opacity-75 relative flex justify-between items-center"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-850 flex items-center justify-center text-neutral-600 shrink-0">
                      <Book size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-tight">Study Planner</h4>
                      <p className="text-[9px] text-neutral-650 tracking-tight mt-0.5">Organize daily revisions.</p>
                    </div>
                  </div>
                  <span className="text-[8px] bg-neutral-900 text-neutral-500 px-1.5 py-0.5 border border-neutral-850 rounded-md font-mono shrink-0 uppercase tracking-widest font-black">SOON</span>
                </div>
              </div>
            </div>

            {/* Category 3: Academic Tracking (Coming Soon) */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase text-neutral-400 tracking-wider">
                <Check size={14} className="text-orange-550" />
                <span>Academic Tracking</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Attendance Calculator */}
                <div 
                  onClick={() => showToast("Attendance predictor module is coming soon! 📊")}
                  className="group p-4 bg-[#0a0a0a] border border-neutral-950 rounded-2xl text-left cursor-not-allowed opacity-75 relative flex justify-between items-center"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-850 flex items-center justify-center text-neutral-600 shrink-0">
                      <HelpCircle size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-tight">Attendance Tool</h4>
                      <p className="text-[9px] text-neutral-650 tracking-tight mt-0.5">75% criteria target manager.</p>
                    </div>
                  </div>
                  <span className="text-[8px] bg-neutral-900 text-neutral-500 px-1.5 py-0.5 border border-neutral-850 rounded-md font-mono shrink-0 uppercase tracking-widest font-black">SOON</span>
                </div>

                {/* Backlog Tracker */}
                <div 
                  onClick={() => showToast("Backlog tracker lists are coming soon! 📑")}
                  className="group p-4 bg-[#0a0a0a] border border-neutral-950 rounded-2xl text-left cursor-not-allowed opacity-75 relative flex justify-between items-center"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-850 flex items-center justify-center text-neutral-600 shrink-0">
                      <AlertCircle size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-tight">Backlog Tracker</h4>
                      <p className="text-[9px] text-neutral-650 tracking-tight mt-0.5">Keep track of supplementary exams.</p>
                    </div>
                  </div>
                  <span className="text-[8px] bg-neutral-900 text-neutral-500 px-1.5 py-0.5 border border-neutral-850 rounded-md font-mono shrink-0 uppercase tracking-widest font-black">SOON</span>
                </div>
              </div>
            </div>

            {/* Note / Footnote */}
            <div className="bg-[#0b0b0b] border border-neutral-900/60 p-4 rounded-xl flex items-start gap-3 mt-4">
              <Sparkles className="text-orange-500 shrink-0 mt-0.5" size={15} />
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-white uppercase tracking-tight">Personalized Engine Active</span>
                <p className="text-[10px] text-neutral-400 leading-normal font-light">
                  ZERO2ONE reads syllabus criteria from the university database matching your branch code to assure precise computations.
                </p>
              </div>
            </div>

            <div className="text-center pt-2 select-none shrink-0 border-t border-neutral-900/30 flex justify-center items-center gap-1.5 text-[10px] text-neutral-600 font-medium leading-none">
              <span className="font-extrabold tracking-wider uppercase text-neutral-500 text-[9px]">ZERO2ONE STUDY</span>
              <span>·</span>
              <span>© 2026</span>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // --- SGPA PREDICTOR VIEW ---
  if (activeSubView === "sgpa") {
    const activeSubjects = getCurrentSubjects();

    return (
      <div className="w-full h-screen bg-[#070707] text-white flex overflow-hidden select-none">
        
        {/* Reuse the Same Sidebar Option on Desktop */}
        <aside className="hidden md:flex flex-col w-64 bg-neutral-950 border-r border-neutral-900 justify-between p-6 shrink-0 h-screen sticky top-0 font-sans">
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <img 
                src="https://raw.githubusercontent.com/jampanapadmaja/ZERO2ONE/main/logo.png" 
                alt="ZERO2ONE" 
                className="w-8 h-8 object-contain" 
                onError={(e) => { e.currentTarget.src = "https://img.icons8.com/color/96/graduation-cap.png"; }} 
              />
              <span className="font-black text-lg tracking-wider text-white">ZERO<span className="text-orange-500">2</span>ONE</span>
            </div>

            <nav className="flex flex-col gap-2.5">
              <button 
                type="button" 
                onClick={() => { setViewState("dashboard"); navigate("/dashboard"); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 text-neutral-400 hover:text-neutral-300 hover:bg-neutral-900/50 text-left border-none cursor-pointer"
              >
                <TrendingUp size={16} /> Dashboard
              </button>
              <button 
                type="button" 
                onClick={() => { setViewState("resources-view"); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 text-neutral-400 hover:text-neutral-300 hover:bg-neutral-900/50 text-left border-none cursor-pointer"
              >
                <BookOpen size={16} /> Resources
              </button>
              <button 
                type="button" 
                onClick={() => { setActiveSubView("menu"); }}
                className="flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-250 text-orange-500 bg-orange-500/5 border border-orange-500/10 text-left cursor-pointer"
              >
                <span className="flex items-center gap-3"><Calculator size={16} /> Tools</span>
              </button>
              <button 
                type="button" 
                onClick={() => { setViewState("profile-page"); navigate("/profile"); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 text-neutral-400 hover:text-neutral-300 hover:bg-neutral-900/50 text-left border-none cursor-pointer"
              >
                <UserIcon size={16} /> Profile
              </button>
            </nav>
          </div>

          <div className="bg-[#0f0f0f] border border-neutral-900 p-4 rounded-2xl flex flex-col items-center gap-3 text-center">
            <Award size={24} className="text-orange-500 animate-[pulse_3s_infinite]" />
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase text-neutral-300 tracking-wider">Empowering Excellence</p>
              <p className="text-[9px] text-[#525252] leading-tight font-light font-sans">Anurag University student briefcase</p>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 flex flex-col h-full bg-[#070707] overflow-hidden">
          {/* Header */}
          <header className="bg-[#070707]/90 backdrop-blur-md z-50 p-4 border-b border-neutral-900/60 flex justify-between items-center select-none shrink-0 font-sans">
            <div className="flex items-center gap-3">
              <ArrowLeft 
                size={20} 
                className="text-neutral-400 cursor-pointer hover:text-white transition-colors" 
                onClick={() => setActiveSubView("menu")} 
              />
              <div className="flex flex-col">
                <h2 className="text-base font-black text-white uppercase tracking-tight leading-none">SGPA Predictor</h2>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Sem grade predictor</span>
              </div>
            </div>

            <button 
              type="button"
              onClick={clearAllMarks}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-850 hover:border-red-500/20 text-neutral-300 hover:text-red-400 transition-all flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
            >
              <Trash2 size={12} /> Reset Marks
            </button>
          </header>

          <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full p-4 md:p-6 space-y-4 pb-28 md:pb-6 font-sans select-text">
            
            {/* Sync Summary Selector Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
              {/* Department read-only or selector */}
              <div className="bg-[#0b0b0b] border border-neutral-900 p-3 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-400">
                  <BookOpen size={14} className="text-orange-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Department</span>
                </div>
                <select 
                  value={sgpaDept}
                  onChange={(e) => setSgpaDept(e.target.value)}
                  className="bg-neutral-900 border border-neutral-850 rounded-lg p-1.5 py-1 text-xs font-bold text-white max-w-[180px] focus:border-orange-500 focus:outline-none"
                >
                  {Object.keys(SYLLABUS_MAP).map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Semester tab selectors */}
              <div className="bg-[#0b0b0b] border border-neutral-900 p-3 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-400">
                  <TrendingUp size={14} className="text-orange-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Semester Selection</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {availableSemicons.map(sem => (
                    <button
                      key={sem}
                      type="button"
                      onClick={() => setSgpaSem(sem)}
                      className={`px-2.5 py-1 rounded bg-neutral-900 border text-[10px] font-bold cursor-pointer ${
                        sgpaSem === sem 
                        ? 'border-orange-500 text-orange-500' 
                        : 'border-neutral-850 text-neutral-400 hover:text-white'
                      }`}
                    >
                      Sem {sem}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Configurable grading boundaries helper (Collapsible) */}
            <div className="bg-[#0a0a0a] border border-neutral-900 rounded-xl overflow-hidden font-sans">
              <button 
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className="w-full flex justify-between items-center p-3 pl-4 text-[11px] font-black uppercase text-neutral-400 tracking-wider hover:bg-neutral-900/50 transition-colors border-none cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Settings size={13} className="text-orange-500" />
                  <span>Configure Grade Boundaries ({gradingScale === DEFAULT_GRADING_SCALE ? "Standard UGC" : "Customized"})</span>
                </span>
                <span className="text-orange-500 font-bold hover:underline">
                  {showConfig ? "Collapse [x]" : "Edit Scale [⚙]"}
                </span>
              </button>
              
              <AnimatePresence>
                {showConfig && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-neutral-900/60 p-4 bg-[#080808] text-xs space-y-3"
                  >
                    <p className="text-[10px] text-neutral-500 font-medium">To modify target grades, change the minimum marks boundaries below. Calculations update dynamically instantly.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {gradingScale.map((boundary, i) => (
                        <div key={boundary.grade} className="flex flex-col gap-1 p-2 bg-[#0d0d0d] border border-neutral-900 rounded-lg">
                          <span className="font-extrabold uppercase text-orange-400 text-[10px]">{boundary.grade} Grade (Points: {boundary.points})</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-neutral-500 font-mono">Min %:</span>
                            <input 
                              type="number"
                              value={boundary.min}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setGradingScale(prev => {
                                  const next = [...prev];
                                  next[i] = { ...next[i], min: Math.min(100, Math.max(0, val)) };
                                  return next;
                                });
                              }}
                              className="w-full bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-start gap-2">
                      <button 
                        type="button" 
                        onClick={() => { setGradingScale(DEFAULT_GRADING_SCALE); showToast("Reset grading scale!"); }}
                        className="px-2 py-1 rounded bg-neutral-900 text-neutral-400 border border-neutral-800 text-[10px] hover:text-white uppercase font-bold cursor-pointer"
                      >
                        Reset to UGC Default
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* SUBJECT MARKS ROWS CONTAINER */}
            <div className="space-y-3 font-sans">
              
              <div className="flex justify-between items-center text-xs font-black uppercase text-neutral-400 tracking-wider">
                <span>Core Subjects & Marks Input</span>
                <span className="text-[10px] text-neutral-500 font-normal">Compact row layout</span>
              </div>

              {activeSubjects.length === 0 ? (
                <div className="p-8 bg-[#0a0a0a] border border-neutral-900 rounded-2xl text-center space-y-2">
                  <HelpCircle className="text-neutral-600 mx-auto" size={24} />
                  <p className="text-xs text-neutral-500">No subjects resolved from database for {sgpaDept} - Semester {sgpaSem}.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {activeSubjects.map(sub => {
                    const isLab = isLabSubject(sub);
                    const subMark = marks[sub.code] || { mid1: "", mid2: "", assignment: "", semester: "", skillTest: "", dayToDay: "", semLab: "" };

                    // Calculate live totals for this row
                    let rowSum = 0;
                    if (isLab) {
                      const skill = parseFloat(subMark.skillTest) || 0;
                      const dtd = parseFloat(subMark.dayToDay) || 0;
                      const labsem = parseFloat(subMark.semLab) || 0;
                      rowSum = skill + dtd + labsem;
                    } else {
                      const m1 = parseFloat(subMark.mid1) || 0;
                      const m2 = parseFloat(subMark.mid2) || 0;
                      const assign = parseFloat(subMark.assignment) || 0;
                      const sem = parseFloat(subMark.semester) || 0;
                      rowSum = m1 + m2 + assign + sem;
                    }
                    rowSum = Math.min(100, Math.max(0, rowSum));
                    const { grade, points } = getGradeAndPoints(rowSum);

                    return (
                      <div 
                        key={sub.code}
                        id={`subject-row-${sub.code}`}
                        className="p-3 bg-[#0c0c0c] border border-neutral-900 hover:border-neutral-850 transition-all rounded-[16px] text-neutral-200"
                      >
                        {/* Row Header - Code, Title, Credits */}
                        <div className="flex flex-wrap justify-between items-baseline gap-2 pb-2 mb-2 border-b border-neutral-900/60 select-none">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className="text-[10px] bg-neutral-900 border border-neutral-850 text-orange-400 font-mono px-1.5 py-0.5 rounded leading-none">
                              {sub.code}
                            </span>
                            <span className="text-xs font-black text-white leading-none truncate font-sans">
                              {sub.title}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 font-mono text-[9px]/none text-neutral-450 shrink-0 uppercase font-black">
                            <span>{sub.type}</span>
                            <span>•</span>
                            <span className="text-orange-500">{sub.credits} CREDITS</span>
                            <span>•</span>
                            <span className={isLab ? "text-purple-400" : "text-emerald-400"}>
                              {isLab ? "LAB" : "THEORY"}
                            </span>
                          </div>
                        </div>

                        {/* Row Action Inputs Blocks */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                          
                          {/* Left: Input Columns */}
                          <div className="md:col-span-8">
                            {isLab ? (
                              /* LAB INPUT COLS */
                              <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-black uppercase text-neutral-500 tracking-wider leading-none">Skill Test /30</label>
                                  <input 
                                    type="text"
                                    pattern="[0-9]*"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={subMark.skillTest}
                                    onChange={(e) => handleMarkChange(sub.code, "skillTest", e.target.value)}
                                    className="w-full bg-[#080808] border border-neutral-850 hover:border-neutral-800 focus:border-orange-500 focus:outline-none p-2 rounded-lg text-xs font-bold font-mono text-white text-center h-9 leading-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-black uppercase text-neutral-500 tracking-wider leading-none">Day-to-day /20</label>
                                  <input 
                                    type="text"
                                    pattern="[0-9]*"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={subMark.dayToDay}
                                    onChange={(e) => handleMarkChange(sub.code, "dayToDay", e.target.value)}
                                    className="w-full bg-[#080808] border border-neutral-850 hover:border-neutral-800 focus:border-orange-500 focus:outline-none p-2 rounded-lg text-xs font-bold font-mono text-white text-center h-9 leading-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-black uppercase text-neutral-500 tracking-wider leading-none">End Sem /50</label>
                                  <input 
                                    type="text"
                                    pattern="[0-9]*"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={subMark.semLab}
                                    onChange={(e) => handleMarkChange(sub.code, "semLab", e.target.value)}
                                    className="w-full bg-[#080808] border border-neutral-850 hover:border-neutral-800 focus:border-orange-500 focus:outline-none p-2 rounded-lg text-xs font-bold font-mono text-white text-center h-9 leading-none"
                                  />
                                </div>
                              </div>
                            ) : (
                              /* THEORY INPUT COLS */
                              <div className="grid grid-cols-4 gap-2">
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-black uppercase text-neutral-500 tracking-wider leading-none">Mid 1 /20</label>
                                  <input 
                                    type="text"
                                    pattern="[0-9]*"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={subMark.mid1}
                                    onChange={(e) => handleMarkChange(sub.code, "mid1", e.target.value)}
                                    className="w-full bg-[#080808] border border-neutral-850 hover:border-neutral-800 focus:border-orange-500 focus:outline-none p-2 rounded-lg text-xs font-bold font-mono text-white text-center h-9 leading-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-black uppercase text-neutral-500 tracking-wider leading-none">Mid 2 /20</label>
                                  <input 
                                    type="text"
                                    pattern="[0-9]*"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={subMark.mid2}
                                    onChange={(e) => handleMarkChange(sub.code, "mid2", e.target.value)}
                                    className="w-full bg-[#080808] border border-neutral-850 hover:border-neutral-800 focus:border-orange-500 focus:outline-none p-2 rounded-lg text-xs font-bold font-mono text-white text-center h-9 leading-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-black uppercase text-neutral-500 tracking-wider leading-none">Assign /10</label>
                                  <input 
                                    type="text"
                                    pattern="[0-9]*"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={subMark.assignment}
                                    onChange={(e) => handleMarkChange(sub.code, "assignment", e.target.value)}
                                    className="w-full bg-[#080808] border border-neutral-850 hover:border-neutral-800 focus:border-orange-500 focus:outline-none p-2 rounded-lg text-xs font-bold font-mono text-white text-center h-9 leading-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[9px] font-black uppercase text-neutral-500 tracking-wider leading-none">Sem End /50</label>
                                  <input 
                                    type="text"
                                    pattern="[0-9]*"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={subMark.semester}
                                    onChange={(e) => handleMarkChange(sub.code, "semester", e.target.value)}
                                    className="w-full bg-[#080808] border border-neutral-850 hover:border-neutral-800 focus:border-orange-500 focus:outline-none p-2 rounded-lg text-xs font-bold font-mono text-white text-center h-9 leading-none"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Right: Calculated Indicators */}
                          <div className="md:col-span-4 bg-[#080808] p-2 py-2.5 rounded-xl border border-neutral-900 flex justify-around items-center text-center select-none shrink-0 h-[52px] md:h-11">
                            <div className="flex flex-col select-none">
                              <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wide leading-none">Total</span>
                              <span className="text-xs font-black text-white font-mono mt-0.5">{rowSum}</span>
                            </div>
                            <div className="w-[1.5px] h-4.5 bg-neutral-900" />
                            <div className="flex flex-col select-none">
                              <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wide leading-none">Grade</span>
                              <span className={`text-xs font-black font-mono mt-0.5 ${grade === "F" ? "text-red-500" : "text-orange-500"}`}>{grade}</span>
                            </div>
                            <div className="w-[1.5px] h-4.5 bg-neutral-900" />
                            <div className="flex flex-col select-none">
                              <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wide leading-none">GP</span>
                              <span className="text-xs font-black text-neutral-350 font-mono mt-0.5">{points}</span>
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* PREDICTED SGPA RESULT BLOCK */}
            <div className="bg-[#0b0b0b] border border-orange-500/10 rounded-[24px] p-5 relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left select-none shrink-0">
              <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-44 h-44 bg-orange-500/5 blur-[60px] rounded-full" />
              </div>

              <div className="space-y-1 z-10">
                <span className="text-[10px] font-black uppercase text-orange-500 tracking-wider">LIVE PREDICTION RESULT</span>
                <h3 className="text-base font-extrabold text-neutral-100 tracking-tight leading-none">Your Predicted SGPA</h3>
                <p className="text-[10px] text-neutral-450 font-light max-w-sm mt-0.5">Calculated dynamically in real-time as expected credits are populated.</p>
              </div>

              <div className="flex items-center gap-4 shrink-0 z-10">
                <div className="text-center rounded-2xl bg-[#070707] border border-neutral-900 p-2.5 px-3">
                  <span className="text-[9px] text-neutral-500 font-extrabold uppercase leading-none block">Total Credits</span>
                  <span className="text-sm font-black text-white font-mono mt-0.5 block">{sgpaTotalCredits}</span>
                </div>
                <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl p-0.5 shadow-lg shadow-orange-500/5">
                  <div className="bg-[#070707] rounded-[14px] p-3 pl-4 pr-5 flex items-center gap-3">
                    <span className="text-3xl font-black text-orange-500 font-mono tracking-tight leading-none">
                      {predictedSGPA}
                    </span>
                    <Award size={20} className="text-orange-500 animate-[bounce_3s_infinite]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Footnote */}
            <div className="text-center pt-2 select-none shrink-0 border-t border-neutral-900/30 flex justify-center items-center gap-1.5 text-[10px] text-neutral-600 font-medium leading-none font-sans">
              <span className="font-extrabold tracking-wider uppercase text-neutral-500 text-[9px]">ZERO2ONE STUDY</span>
              <span>·</span>
              <span>© 2026</span>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // --- CGPA CALCULATOR VIEW ---
  if (activeSubView === "cgpa") {
    return (
      <div className="w-full h-screen bg-[#070707] text-white flex overflow-hidden select-none">
        
        {/* Sidebar Layout on Desktop */}
        <aside className="hidden md:flex flex-col w-64 bg-neutral-950 border-r border-neutral-900 justify-between p-6 shrink-0 h-screen sticky top-0 font-sans">
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <img 
                src="https://raw.githubusercontent.com/jampanapadmaja/ZERO2ONE/main/logo.png" 
                alt="ZERO2ONE" 
                className="w-8 h-8 object-contain" 
                onError={(e) => { e.currentTarget.src = "https://img.icons8.com/color/96/graduation-cap.png"; }} 
              />
              <span className="font-black text-lg tracking-wider text-white">ZERO<span className="text-orange-500">2</span>ONE</span>
            </div>

            <nav className="flex flex-col gap-2.5">
              <button 
                type="button" 
                onClick={() => { setViewState("dashboard"); navigate("/dashboard"); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 text-neutral-400 hover:text-neutral-300 hover:bg-neutral-900/50 text-left border-none cursor-pointer"
              >
                <TrendingUp size={16} /> Dashboard
              </button>
              <button 
                type="button" 
                onClick={() => { setViewState("resources-view"); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 text-neutral-400 hover:text-neutral-300 hover:bg-neutral-900/50 text-left border-none cursor-pointer"
              >
                <BookOpen size={16} /> Resources
              </button>
              <button 
                type="button" 
                onClick={() => { setActiveSubView("menu"); }}
                className="flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-250 text-orange-500 bg-orange-500/5 border border-orange-500/10 text-left cursor-pointer"
              >
                <span className="flex items-center gap-3"><Calculator size={16} /> Tools</span>
              </button>
              <button 
                type="button" 
                onClick={() => { setViewState("profile-page"); navigate("/profile"); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 text-neutral-400 hover:text-neutral-300 hover:bg-neutral-900/50 text-left border-none cursor-pointer"
              >
                <UserIcon size={16} /> Profile
              </button>
            </nav>
          </div>

          <div className="bg-[#0f0f0f] border border-neutral-900 p-4 rounded-2xl flex flex-col items-center gap-3 text-center">
            <Award size={24} className="text-orange-500 animate-[pulse_3s_infinite]" />
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase text-neutral-300 tracking-wider">Empowering Excellence</p>
              <p className="text-[9px] text-[#525252] leading-tight font-light font-sans">Providing curated educational helpers</p>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 flex flex-col h-full bg-[#070707] overflow-hidden">
          {/* Header */}
          <header className="bg-[#070707]/90 backdrop-blur-md z-50 p-4 border-b border-neutral-900/60 flex justify-between items-center select-none shrink-0 font-sans">
            <div className="flex items-center gap-3 font-sans">
              <ArrowLeft 
                size={20} 
                className="text-neutral-400 cursor-pointer hover:text-white transition-colors" 
                onClick={() => setActiveSubView("menu")} 
              />
              <div className="flex flex-col">
                <h2 className="text-base font-black text-white uppercase tracking-tight leading-none">CGPA Calculator</h2>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Pointer aggregator</span>
              </div>
            </div>

            <button 
              type="button"
              onClick={clearAllCGPA}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-850 hover:border-red-500/20 text-neutral-300 hover:text-red-400 transition-all flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
            >
              <Trash2 size={12} /> Clear GPAs
            </button>
          </header>

          <div className="flex-1 overflow-y-auto max-w-lg mx-auto w-full p-4 md:p-6 space-y-5 pb-28 md:pb-6 font-sans">
            
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-500 block">MULTIPLE SEMESTER CUMULATOR</span>
              <h1 className="text-xl font-black text-white tracking-tight leading-none">Target Cumulative GPA</h1>
              <p className="text-xs text-neutral-405 leading-relaxed font-light font-sans">
                Enter your semester GPA records sequentially based on your active academic year ({detectedYear} Year). Non-completed target semesters can simply be left blank.
              </p>
            </div>

            {/* Sequence warning row if any Gap exists */}
            {!sequenceValid && (
              <div className="p-3.5 bg-red-500/5 border border-red-500/20 text-red-400 rounded-xl flex gap-3 text-xs justify-start items-start font-sans leading-relaxed select-none animate-pulse">
                <AlertCircle className="shrink-0 mt-0.5" size={15} />
                <div className="space-y-0.5">
                  <span className="font-extrabold uppercase text-[10px]">Sequence Gap Detected!</span>
                  <p className="text-[11px] leading-normal font-medium text-neutral-400">
                    Please enter semester GPAs sequentially. You cannot skip a semester and enter a later semester.
                  </p>
                </div>
              </div>
            )}

            {/* DYNAMIC SEMESTER FIELDS GRID BY YEAR */}
            <div className="space-y-4 font-sans">
              {yearsToRender.map(yr => {
                const s1Index = (yr - 1) * 2;
                const s2Index = s1Index + 1;

                return (
                  <div key={yr} className="bg-[#0b0b0b] border border-neutral-900 rounded-[20px] p-4 space-y-3">
                    {/* Header line for year card */}
                    <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase text-orange-400 tracking-wider pb-1.5 border-b border-neutral-900 select-none">
                      <Sparkles size={13} className="text-orange-500" />
                      <span>Academic Year {yr}</span>
                    </div>

                    {/* Sem 1 and Sem 2 Inputs split columns */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Semester odd */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-neutral-405 uppercase tracking-wide leading-none block select-none">
                          Semester {s1Index + 1} SGPA
                        </label>
                        <div className="relative">
                          <input 
                            type="text"
                            placeholder="e.g. 8.4"
                            value={cgpaInputs[s1Index]}
                            onChange={(e) => handleCgpaInputChange(s1Index, e.target.value)}
                            className="w-full bg-[#080808] border border-neutral-850 hover:border-neutral-800 focus:border-orange-500 focus:outline-none p-3.5 rounded-xl text-sm font-black font-mono text-white tracking-wide h-11 leading-none text-center"
                          />
                        </div>
                      </div>

                      {/* Semester even */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-neutral-405 uppercase tracking-wide leading-none block select-none">
                          Semester {s2Index + 1} SGPA
                        </label>
                        <div className="relative">
                          <input 
                            type="text"
                            placeholder="e.g. 8.1"
                            value={cgpaInputs[s2Index]}
                            onChange={(e) => handleCgpaInputChange(s2Index, e.target.value)}
                            className="w-full bg-[#080808] border border-neutral-850 hover:border-neutral-800 focus:border-orange-500 focus:outline-none p-3.5 rounded-xl text-sm font-black font-mono text-white tracking-wide h-11 leading-none text-center"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PREDICTED CGPA RESULT SECTION */}
            <div className="bg-[#0b0b0b] border border-orange-500/10 rounded-[24px] p-5 relative overflow-hidden flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left select-none">
              <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-44 h-44 bg-orange-500/5 blur-[60px] rounded-full" />
              </div>

              <div className="space-y-1 z-10">
                <span className="text-[10px] font-black uppercase text-orange-400 tracking-wider">CUMULATOR LIVE RESULT</span>
                <h3 className="text-base font-extrabold text-neutral-100 tracking-tight leading-none">Your CGPA</h3>
                <p className="text-[10px] text-neutral-450 font-light mt-0.5 max-w-xs leading-normal">Overall cumulative grade score updated dynamically based on completed semesters.</p>
              </div>

              <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl p-0.5 shadow-lg shadow-orange-500/5 z-10">
                <div className="bg-[#070707] rounded-[14px] p-3 pl-4 pr-5 flex items-center gap-3">
                  <span className="text-3xl font-black text-orange-500 font-mono tracking-tight leading-none">
                    {predictedCGPA}
                  </span>
                  <Award size={20} className="text-orange-500 animate-[bounce_3s_infinite]" />
                </div>
              </div>
            </div>

            {/* Footnote */}
            <div className="text-center pt-2 select-none shrink-0 border-t border-neutral-900/30 flex justify-center items-center gap-1.5 text-[10px] text-neutral-600 font-medium leading-none font-sans">
              <span className="font-extrabold tracking-wider uppercase text-neutral-500 text-[9px]">ZERO2ONE STUDY</span>
              <span>·</span>
              <span>© 2026</span>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return null;
}
