/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Sparkles, ArrowLeft, BookOpen, Clock, Award, FileText, Download, Layers, Shield, LogIn, LogOut, Plus, Trash2, Maximize2, Minimize2 } from "lucide-react";
import { useState, useEffect, FormEvent } from "react";
import { DEPARTMENTS, SYLLABUS_MAP, SUBJECT_DETAILS } from "./data/syllabus";
import { auth, db, googleProvider, ALLOWED_ADMIN_EMAILS, handleFirestoreError, OperationType } from "./lib/firebase";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { doc, getDoc, setDoc, collection, addDoc, query, where, onSnapshot, serverTimestamp, deleteDoc } from "firebase/firestore";

type ViewState = "year-selection" | "dept-selection" | "sem-selection" | "choice-selection" | "syllabus-view" | "resources-view";

export default function App() {
  const [viewState, setViewState] = useState<ViewState>("year-selection");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedSem, setSelectedSem] = useState<number | null>(null);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [resourceTab, setResourceTab] = useState<"notes" | "pyqs">("notes");
  const [expandedUnit, setExpandedUnit] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeLoading, setIframeLoading] = useState<boolean>(false);
  const [fullscreenIframeLoading, setFullscreenIframeLoading] = useState<boolean>(false);

  // Auth & Admin State
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Firestore Data State
  const [uploadedResources, setUploadedResources] = useState<any[]>([]);

  // Admin Upload State
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isFullscreen]);

  const activeUnitNote = expandedUnit !== null 
    ? uploadedResources.find(r => r.subjectCode === activeSubject && r.type === "notes" && r.unit === expandedUnit + 1)
    : null;
  const activeUnitNoteUrl = activeUnitNote?.fileUrl || "";

  useEffect(() => {
    if (activeUnitNoteUrl) {
      setIframeLoading(true);
    } else {
      setIframeLoading(false);
    }
  }, [activeUnitNoteUrl, activeSubject, expandedUnit]);

  useEffect(() => {
    if (isFullscreen && activeUnitNoteUrl) {
      setFullscreenIframeLoading(true);
    } else {
      setFullscreenIframeLoading(false);
    }
  }, [isFullscreen, activeUnitNoteUrl]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Check if user is in admins collection
        try {
          const adminDoc = await getDoc(doc(db, "admins", user.uid));
          if (adminDoc.exists()) {
            setIsAdmin(true);
          } else if (ALLOWED_ADMIN_EMAILS.includes(user.email || "")) {
            // Bootstrap: Add to admins collection if email is allowed
            await setDoc(doc(db, "admins", user.uid), {
              email: user.email,
              addedAt: serverTimestamp()
            });
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch resources based on selection
  useEffect(() => {
    if (viewState === "resources-view" && selectedDept && selectedSem) {
      const q = query(
        collection(db, "resources"),
        where("branch", "==", selectedDept),
        where("sem", "==", selectedSem)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const resources = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUploadedResources(resources);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, "resources");
      });

      return () => unsubscribe();
    }
  }, [viewState, selectedDept, selectedSem]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleFileUpload = async (file: File, type: "notes" | "pyqs", unit?: number) => {
    if (!isAdmin || !user || !selectedDept || !selectedSem || !activeSubject) {
      console.error("Upload aborted: Missing admin status or context", { isAdmin, user, selectedDept, selectedSem, activeSubject });
      return;
    }

    console.log("Starting upload process via proxy...", { fileName: file.name, type, unit });
    setUploading(true);
    
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const storagePath = `resources/${selectedDept}/${selectedSem}/${activeSubject}/${type}/${unit ? 'unit-' + unit : 'pyq'}/${fileName}`;
      
      console.log("Storage Path:", storagePath);
      
      // Use the server-side proxy
      const formData = new FormData();
      formData.append("file", file);
      formData.append("path", storagePath);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `Upload failed with status ${response.status}`;
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
            if (errorData.action) {
              errorMessage += `\n\nAction required: ${errorData.action}`;
            }
          } else {
            const text = await response.text();
            console.error("Non-JSON error from server:", text.substring(0, 500));
            errorMessage += ". The server returned an unexpected format (likely HTML).";
          }
        } catch (e) {
          errorMessage += ". Could not parse error details.";
        }
        throw new Error(errorMessage);
      }

      const jsonResponse = await response.json().catch(async (e) => {
        console.error("Failed to parse success response:", e);
        throw new Error("Upload seemed to succeed but returned invalid response format.");
      });
      
      const downloadURL = jsonResponse.url;
      console.log("Upload successful, URL:", downloadURL);

      const resourceData: any = {
        branch: selectedDept,
        sem: selectedSem,
        subjectCode: activeSubject,
        type: type,
        title: `${type === 'notes' ? 'Unit ' + unit : 'Previous Year Question'} - ${file.name}`,
        fileUrl: downloadURL,
        uploadedAt: serverTimestamp(),
        uploadedBy: user.uid
      };

      if (type === "notes") resourceData.unit = unit;
      if (type === "pyqs") resourceData.year = new Date().getFullYear();

      console.log("Saving metadata to Firestore...", resourceData);
      await addDoc(collection(db, "resources"), resourceData);
      alert("Resource uploaded successfully!");
    } catch (error) {
      console.error("Upload failure:", error);
      alert(`Failed to upload: ${error instanceof Error ? error.message : "Check console for details."}`);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setViewState("year-selection");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

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
      <section className="relative flex flex-col justify-center lg:justify-between p-6 md:p-12 lg:p-16 bg-[#0a0a0a] text-white overflow-hidden min-h-[28vh] md:min-h-[35vh] lg:min-h-screen">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <motion.div animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, -30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} className="absolute -top-20 -left-20 w-80 h-80 bg-orange-500/10 blur-[100px] rounded-full" />
          <motion.div animate={{ scale: [1.2, 1, 1.2], x: [0, -40, 0], y: [0, 60, 0] }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute -bottom-40 -right-20 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full" />
        </div>

        <nav className="z-10 lg:mb-0 mb-4 md:mb-8 animate-fade-in">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 md:gap-4">
            <img src="https://raw.githubusercontent.com/jampanapadmaja/ZERO2ONE/main/logo.png" alt="ZERO2ONE Logo" className="w-10 h-10 md:w-12 md:h-12 rounded-xl object-contain shadow-2xl shadow-orange-500/20" onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://img.icons8.com/color/96/graduation-cap.png"; }} />
            <span className="font-bold tracking-tighter text-lg md:text-2xl uppercase">ZERO2ONE</span>
          </motion.div>
        </nav>

        <div className="z-10 mt-auto md:mb-8 lg:mb-20">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <h1 className="text-4xl md:text-7xl lg:text-[112px] font-bold leading-[0.85] tracking-tighter mb-4 md:mb-8">ZERO<span className="text-orange-500 italic">2</span>ONE</h1>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="relative pl-6 border-l border-white/10 mt-8 mb-12 hidden lg:block">
              <p className="text-lg text-neutral-400 font-light leading-relaxed italic max-w-sm">"Excellence is not a skill, it's an attitude. From zero knowledge to one master, we're with you."</p>
              <div className="text-orange-500/40 absolute -top-4 -left-2 rotate-12"><Sparkles size={40} /></div>
            </motion.div>
            <div className="flex gap-2 md:gap-4 flex-wrap">
              <div className="px-3 py-1.5 md:px-5 md:py-2.5 rounded-full bg-white/5 border border-white/10 text-[8px] md:text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-semibold flex items-center gap-1.5 md:gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> Platform Open
              </div>
              <div className="px-3 py-1.5 md:px-5 md:py-2.5 rounded-full bg-white/5 border border-white/10 text-[8px] md:text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-semibold">Academic Excellence</div>
            </div>
          </motion.div>
        </div>
        <div className="z-10 mt-12 text-xs text-neutral-600 font-mono tracking-widest hidden lg:block">STK // 2026 // BUILD 1.0.4</div>
      </section>

      {/* Right Side: Selection */}
      <section className="flex flex-col justify-center p-5 md:p-12 lg:p-24 pb-28 lg:pb-24 bg-white z-10 lg:z-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="max-w-md w-full mx-auto space-y-6 md:space-y-10">
          <div className="space-y-1 md:space-y-3">
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900">Select Your Year</h2>
            <p className="text-neutral-500 text-sm md:text-lg font-light">Tailored resources are just a click away.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {years.map((year, index) => (
              <motion.button 
                key={year.id} 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                transition={{ delay: 0.5 + index * 0.1 }} 
                onClick={() => handleYearSelect(year.id)} 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.98 }} 
                className={`group relative flex flex-col justify-between p-4 md:p-6 rounded-2xl md:rounded-3xl border-2 transition-all duration-400 text-left ${selectedYear === year.id ? "border-orange-500 bg-orange-50/30 ring-4 ring-orange-100 shadow-sm" : "border-neutral-100 hover:border-neutral-300 hover:bg-neutral-50"}`}
              >
                <div className="space-y-1">
                  <span className={`block text-xl md:text-3xl font-black tracking-tight ${selectedYear === year.id ? "text-orange-600" : "text-neutral-800"}`}>0{year.id}</span>
                  <span className={`text-[9px] md:text-sm uppercase tracking-widest font-bold ${selectedYear === year.id ? "text-orange-400" : "text-neutral-400"}`}>{year.label}</span>
                </div>
                <div className={`absolute top-4 right-4 md:top-6 md:right-6 w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-all ${selectedYear === year.id ? "bg-orange-500 text-white" : "bg-neutral-100 text-neutral-300 group-hover:bg-neutral-200 group-hover:text-neutral-600"}`}>
                  <ChevronRight size={12} className="md:w-4 md:h-4" />
                </div>
              </motion.button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {selectedYear && (
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-neutral-100/50 z-40 lg:relative lg:p-0 lg:bg-transparent lg:border-none shadow-lg lg:shadow-none flex justify-center">
                <motion.button 
                  key="continue-btn" 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  exit={{ opacity: 0, scale: 0.95 }} 
                  whileHover={{ scale: 1.01 }} 
                  whileTap={{ scale: 0.99 }} 
                  onClick={handleContinue} 
                  className="w-full max-w-md bg-[#0a0a0a] text-white py-4 lg:py-6 rounded-2xl lg:rounded-[2rem] font-bold text-sm lg:text-xl shadow-2xl shadow-neutral-300 hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 lg:gap-3 active:scale-95"
                >
                  Continue to {getSelectedYearLabel()} <ChevronRight size={18} className="lg:w-6 lg:h-6 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </div>
            )}
          </AnimatePresence>

          <div className="pt-6 md:pt-8 border-t border-neutral-100 flex flex-col sm:flex-row justify-between items-center gap-3 text-[10px] md:text-xs text-neutral-400 uppercase tracking-widest font-bold">
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
    <div className="min-h-screen bg-white p-5 md:p-12 lg:p-24 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6 md:space-y-10">
        <motion.button 
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setViewState("year-selection")} 
          className="flex items-center gap-2 text-neutral-400 hover:text-[#0a0a0a] transition-all font-bold uppercase tracking-wider text-[10px] md:text-xs"
        >
          <ArrowLeft size={14} className="md:w-4 md:h-4" /> Back to Year Selection
        </motion.button>
        
        <div className="space-y-[4px] md:space-y-2">
          <h2 className="text-2xl md:text-5xl lg:text-5xl font-extrabold tracking-tight text-neutral-900 leading-tight">Choose Your Department</h2>
          <p className="text-neutral-400 text-xs md:text-base lg:text-lg font-light leading-relaxed">Select your branch to view the specific first-year syllabus.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 lg:gap-6">
          {DEPARTMENTS.map((dept, index) => (
            <motion.button
              key={dept}
              initial={{ opacity: 0, scale: 0.97, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              onClick={() => { setSelectedDept(dept); setViewState("sem-selection"); }}
              whileHover={{ scale: 1.01, x: 2 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-between p-4 md:p-6 lg:p-8 rounded-2xl md:rounded-[2rem] bg-neutral-50/75 border border-neutral-100 hover:border-orange-500/30 hover:bg-orange-50/15 transition-all text-left shadow-sm hover:shadow-md hover:shadow-orange-500/5 group"
            >
              <span className="text-sm md:text-base lg:text-lg font-extrabold text-neutral-800 pr-2 leading-snug line-clamp-2">{dept}</span>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-neutral-300 group-hover:bg-orange-500 group-hover:text-white transition-all shrink-0">
                <ChevronRight size={16} className="md:w-5 md:h-5" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSemSelection = () => (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col justify-between p-5 md:p-12 lg:p-20 overflow-y-auto">
      <div className="max-w-xl w-full mx-auto space-y-10 md:space-y-12 my-auto">
        
        {/* Top Section */}
        <div className="space-y-6">
          <motion.button 
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setViewState("dept-selection")} 
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-all font-bold uppercase tracking-wider text-[10px] md:text-xs"
          >
            <ArrowLeft size={14} className="md:w-4 md:h-4" /> Back to Departments
          </motion.button>

          <div className="space-y-3">
            <div className="inline-block px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest leading-none">
              {selectedDept}
            </div>
            
            <div className="space-y-1 md:space-y-2">
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">Select Semester</h2>
              <p className="text-neutral-400 text-xs md:text-sm font-light leading-relaxed">
                Access semester-wise academic resources
              </p>
            </div>
          </div>
        </div>

        {/* Semester Cards */}
        <div className="flex flex-col gap-4 md:gap-5">
          {[1, 2].map((sem) => (
            <motion.button
              key={sem}
              onClick={() => { setSelectedSem(sem); setViewState("choice-selection"); }}
              whileHover={{ scale: 1.015, y: -2 }}
              whileTap={{ scale: 0.985 }}
              className="group relative flex flex-col justify-between p-5 md:p-8 rounded-[28px] bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm shadow-xl hover:border-orange-500/50 hover:shadow-[0_0_25px_rgba(249,115,22,0.12)] transition-all duration-300 text-left w-full cursor-pointer overflow-hidden min-h-[140px] md:min-h-[160px]"
            >
              {/* Subtle hover glow strip */}
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/[0.015] to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="flex justify-between items-start w-full relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 group-hover:text-orange-500 group-hover:scale-110 transition-all duration-300 shadow-inner">
                    {sem === 1 ? <Clock size={18} className="md:w-5 md:h-5" /> : <BookOpen size={18} className="md:w-5 md:h-5" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] md:text-[10px] uppercase tracking-widest font-extrabold text-neutral-500 group-hover:text-neutral-400 transition-colors">FIRST YEAR</span>
                    <h3 className="text-xl md:text-2xl font-black text-neutral-100 tracking-tight mt-0.5">Semester 0{sem}</h3>
                  </div>
                </div>

                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700/60 flex items-center justify-center shadow-md group-hover:bg-orange-500 group-hover:text-white group-hover:border-orange-400 group-hover:scale-105 transition-all duration-300 shrink-0">
                  <ChevronRight size={14} className="md:w-5 md:h-5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-neutral-800/40 text-[11px] md:text-xs font-sans text-neutral-400 leading-relaxed font-light relative z-10">
                {sem === 1 
                  ? "Build structural foundations with basic sciences, programming essentials, and lab experimentation." 
                  : "Enhance core expertise with applied physics, structured algorithms, engineering drawings, and labs."
                }
              </div>
            </motion.button>
          ))}
        </div>

        {/* Custom Dark Footer Area */}
        <div className="pt-8 md:pt-12 border-t border-neutral-900/80 flex flex-col items-center gap-4 text-center">
          <div className="space-y-0.5">
            <h2 className="text-base font-black tracking-tighter text-white">ZERO2ONE</h2>
            <p className="text-[10px] text-neutral-500 font-medium font-sans">Empowering Anurag University Students</p>
          </div>
          
          <div className="mt-1">
            {user ? (
              <div className="flex items-center gap-3 font-sans">
                <div className="flex flex-col items-center text-center">
                  <span className="text-[10px] font-bold text-neutral-300 leading-none">{user.displayName}</span>
                  {isAdmin && <span className="text-[8px] font-black uppercase text-orange-500 tracking-widest mt-1 leading-none">Admin</span>}
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-1.5 rounded-full bg-neutral-900 text-neutral-400 hover:text-red-500 transition-all border border-neutral-800 shadow-sm hover:bg-neutral-800"
                  title="Logout"
                >
                  <LogOut size={12} />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-900 text-neutral-300 hover:text-white text-[9px] md:text-[10px] font-bold hover:bg-neutral-800 hover:scale-105 active:scale-95 transition-all font-sans border border-neutral-800/60"
              >
                <Shield size={12} /> Admin Login
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );

  const renderChoiceSelection = () => (
    <div className="min-h-screen bg-white flex flex-col justify-between p-5 md:p-12 lg:p-20 overflow-y-auto">
      <div className="max-w-xl w-full mx-auto flex-1 flex flex-col justify-center space-y-8 md:space-y-12">
        
        {/* Header Section */}
        <div className="space-y-6">
          <motion.button 
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setViewState("sem-selection")} 
            className="flex items-center gap-2 text-neutral-400 hover:text-black transition-all font-bold uppercase tracking-wider text-[10px] md:text-xs"
          >
            <ArrowLeft size={14} className="md:w-4 md:h-4" /> Back to Semesters
          </motion.button>

          <div className="space-y-3">
            <div className="inline-block px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 text-[9px] md:text-[10px] font-bold uppercase tracking-widest leading-none">
              {selectedDept} // SEM 0{selectedSem}
            </div>
            
            <div className="space-y-1 md:space-y-2">
              <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-neutral-900 leading-tight">What are you looking for?</h2>
              <p className="text-neutral-500 text-xs md:text-sm font-light leading-relaxed">
                Choose the resource type you want to access
              </p>
            </div>
          </div>
        </div>

        {/* Resource Cards */}
        <div className="flex flex-col gap-4 md:gap-5">
          {/* Syllabus Copy Card */}
          <motion.button
            whileHover={{ scale: 1.015, y: -2 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => setViewState("syllabus-view")}
            className="group relative flex flex-col justify-between p-6 md:p-8 rounded-[28px] bg-white border border-neutral-100 hover:border-orange-500/50 hover:shadow-[0_0_25px_rgba(249,115,22,0.06)] transition-all duration-300 text-left w-full cursor-pointer shadow-sm overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/[0.01]/70 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="flex items-start gap-4 z-10 relative">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white group-hover:scale-105 transition-all duration-300 shadow-sm shrink-0">
                <FileText size={20} className="md:w-6 md:h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg md:text-xl font-extrabold text-neutral-900 tracking-tight leading-snug">Syllabus Copy</h3>
                <p className="text-xs md:text-sm text-neutral-400 font-light leading-relaxed">
                  Structure, subjects, and credits for this semester.
                </p>
              </div>
            </div>
            
            <div className="absolute top-6 right-6 md:top-8 md:right-8 w-8 h-8 rounded-full bg-neutral-50 text-neutral-300 border border-neutral-100/50 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white group-hover:border-orange-400 group-hover:scale-105 transition-all duration-300 shrink-0">
              <ChevronRight size={14} className="md:w-4 md:h-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </motion.button>

          {/* View Resources Card */}
          <motion.button
            whileHover={{ scale: 1.015, y: -2 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => setViewState("resources-view")}
            className="group relative flex flex-col justify-between p-6 md:p-8 rounded-[28px] bg-white border border-neutral-100 hover:border-orange-500/50 hover:shadow-[0_0_25px_rgba(249,115,22,0.06)] transition-all duration-300 text-left w-full cursor-pointer shadow-sm overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/[0.01]/70 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="flex items-start gap-4 z-10 relative">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white group-hover:scale-105 transition-all duration-300 shadow-sm shrink-0">
                <Layers size={20} className="md:w-6 md:h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg md:text-xl font-extrabold text-neutral-900 tracking-tight leading-snug">View Resources</h3>
                <p className="text-xs md:text-sm text-neutral-400 font-light leading-relaxed">
                  Unit-wise notes, previous year questions, and study material.
                </p>
              </div>
            </div>
            
            <div className="absolute top-6 right-6 md:top-8 md:right-8 w-8 h-8 rounded-full bg-neutral-50 text-neutral-300 border border-neutral-100/50 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white group-hover:border-orange-400 group-hover:scale-105 transition-all duration-300 shrink-0">
              <ChevronRight size={14} className="md:w-4 md:h-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </motion.button>
        </div>

        {/* Custom Light Footer Area */}
        <div className="pt-8 border-t border-neutral-100/60 flex flex-col items-center gap-4 text-center">
          <div className="space-y-0.5">
            <h2 className="text-base font-black tracking-tighter text-neutral-900">ZERO2ONE</h2>
            <p className="text-[10px] text-neutral-400 font-medium font-sans">Empowering Anurag University Students</p>
          </div>
          
          <div className="mt-1">
            {user ? (
              <div className="flex items-center gap-3 font-sans">
                <div className="flex flex-col items-center text-center">
                  <span className="text-[10px] font-bold text-neutral-800 leading-none">{user.displayName}</span>
                  {isAdmin && <span className="text-[8px] font-black uppercase text-orange-500 tracking-widest mt-1 leading-none">Admin</span>}
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-1.5 rounded-full bg-neutral-100 text-neutral-400 hover:text-red-500 transition-all border border-neutral-200 shadow-sm hover:bg-neutral-200"
                  title="Logout"
                >
                  <LogOut size={12} />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-50 text-neutral-600 hover:text-neutral-900 text-[9px] md:text-[10px] font-bold hover:bg-neutral-100 hover:scale-105 active:scale-95 transition-all font-sans border border-neutral-200"
              >
                <Shield size={12} /> Admin Login
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );

  const renderResourcesView = () => {
    const subjects = SYLLABUS_MAP[selectedDept || ""]?.[selectedSem || 1] || [];
    const activeSubjectData = activeSubject ? SUBJECT_DETAILS[activeSubject] : null;

    return (
      <div className="min-h-screen bg-white flex flex-col justify-between overflow-y-auto font-sans selection:bg-orange-100/60 pb-16">
        
        {/* Sticky Compact Top Navigation Header */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-100/80 px-4 py-4 md:px-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-6">
            <motion.button 
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setViewState("choice-selection"); setActiveSubject(null); }} 
              className="flex items-center gap-2 text-neutral-400 hover:text-black transition-all font-bold uppercase tracking-wider text-[10px] md:text-xs"
            >
              <ArrowLeft size={14} className="md:w-4 md:h-4" /> Back to Choice
            </motion.button>
            
            <div className="flex flex-col text-left sm:text-right">
              <span className="text-[9px] md:text-[10px] font-extrabold uppercase tracking-widest text-orange-500 line-clamp-1">{selectedDept} // NOTES</span>
              <span className="text-xs md:text-sm font-bold text-neutral-900 mt-0.5">Year 01 // Semester 0{selectedSem}</span>
            </div>
          </div>
        </header>

        {/* Primary Container */}
        <div className="max-w-6xl w-full mx-auto p-4 md:p-8 lg:p-12 space-y-8 md:space-y-12 flex-1 animate-fadeIn">
          
          {/* STATE 1: List of Subject resource cards */}
          {!activeSubject && (
            <div className="space-y-8">
              {/* Heading & Intro */}
              <div className="space-y-2 max-w-xl">
                <span className="text-[9px] uppercase tracking-[0.2em] font-extrabold text-orange-500">ACADEMIC CONTENT</span>
                <h2 className="text-2xl md:text-4xl font-extrabold text-neutral-955 tracking-tight">Subject Resources</h2>
                <p className="text-neutral-500 text-xs md:text-sm font-light leading-relaxed">
                  Select a subject to view handwritten lecture notes, previous year exam papers, and learning material.
                </p>
              </div>

              {/* Subject cards stacked or grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                {subjects.map((subject, index) => (
                  <motion.button
                    key={subject.code}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => { setActiveSubject(subject.code); setResourceTab("notes"); }}
                    whileHover={{ scale: 1.015, y: -2 }}
                    whileTap={{ scale: 0.985 }}
                    className="p-6 md:p-8 rounded-[24px] bg-white border border-neutral-105 hover:border-orange-500/40 hover:shadow-[0_0_25px_rgba(249,115,22,0.05)] transition-all duration-300 text-left flex flex-col justify-between h-[230px] md:h-[260px] group relative shadow-sm overflow-hidden animate-fadeIn"
                  >
                    {/* Subtle hover gradient strip */}
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/[0.01] to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    <div className="space-y-4 relative z-10 w-full animate-fadeIn">
                      {/* Icon Container */}
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white group-hover:scale-105 transition-all duration-300 shadow-sm shrink-0">
                        <BookOpen size={18} className="md:w-5 md:h-5" />
                      </div>
                      
                      <div className="space-y-1">
                        <h3 className="text-lg md:text-xl font-extrabold text-neutral-900 tracking-tight leading-snug line-clamp-2">
                          {subject.title}
                        </h3>
                        <p className="text-xs text-neutral-400 font-light font-sans leading-relaxed">
                          Unit-wise handwritten lectures and PYQ papers.
                        </p>
                      </div>
                    </div>

                    {/* Card Footer: Metadata and Pill CTA */}
                    <div className="flex justify-between items-center pt-4 border-t border-neutral-100/50 relative z-10 w-full mt-auto">
                      <span className="font-mono text-[9px] md:text-[10px] uppercase font-bold tracking-wider text-neutral-400 bg-neutral-50 px-2 py-0.5 rounded border border-neutral-100/60 leading-none">
                        {subject.code}
                      </span>
                      
                      <span className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-neutral-105 text-neutral-600 font-sans border border-neutral-100 group-hover:bg-orange-500 group-hover:text-white group-hover:border-orange-400 group-hover:scale-102 transition-all duration-300 text-[10px] md:text-xs font-bold shadow-sm">
                        Open Notes
                        <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
          {activeSubject && activeSubjectData && (
            <div className="space-y-8 animate-fadeIn">
              
              {/* Refined Back Button & Contextual Badge */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-neutral-100">
                <div className="space-y-2 max-w-xl">
                  {/* Small inline badge */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => { setActiveSubject(null); setExpandedUnit(null); }}
                      className="text-[10px] md:text-xs font-bold text-neutral-400 hover:text-orange-500 transition-colors flex items-center gap-1 font-sans"
                    >
                      <ArrowLeft size={12} /> ALL SUBJECTS
                    </button>
                    <span className="text-neutral-300 font-light">•</span>
                    <span className="text-[10px] md:text-xs font-mono font-bold text-orange-500">{activeSubject}</span>
                  </div>
                  
                  <h2 className="text-xl md:text-3xl font-extrabold tracking-tight text-neutral-950 leading-tight">
                    {activeSubjectData.title}
                  </h2>
                </div>

                {/* Styled Matte Capsule Switcher for Tabs */}
                <div className="flex bg-neutral-100 p-1 rounded-2xl border border-neutral-200/40 w-full sm:w-auto self-start shrink-0">
                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setResourceTab("notes"); setExpandedUnit(null); }}
                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs md:text-sm font-extrabold transition-all duration-300 text-center ${
                      resourceTab === "notes" 
                        ? "bg-white text-orange-600 shadow-sm font-black border border-neutral-100" 
                        : "text-neutral-500 hover:text-neutral-800"
                    }`}
                  >
                    Unit Notes
                  </motion.button>
                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setResourceTab("pyqs"); setExpandedUnit(null); }}
                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs md:text-sm font-extrabold transition-all duration-300 text-center ${
                      resourceTab === "pyqs" 
                        ? "bg-white text-orange-600 shadow-sm font-black border border-neutral-100" 
                        : "text-neutral-500 hover:text-neutral-800"
                    }`}
                  >
                    Question Papers
                  </motion.button>
                </div>
              </div>

              {/* Active Tab: Notes layout (Unit list left column + Preview column right) */}
              {resourceTab === "notes" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Left: Unit Cards list (5 portions out of 12) */}
                  <div className="lg:col-span-5 flex flex-col gap-3">
                    <div className="space-y-0.5 pb-1 select-none">
                      <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">UNIT BREAKDOWN</span>
                      <h4 className="text-xs font-bold text-neutral-400">Pick a unit to view and download study notes</h4>
                    </div>

                    {activeSubjectData.units.map((unit, index) => {
                      const isExpanded = expandedUnit === index;
                      return (
                        <motion.button
                          key={index}
                          onClick={() => setExpandedUnit(isExpanded ? null : index)}
                          whileHover={{ x: 2, scale: 1.005 }}
                          whileTap={{ scale: 0.995 }}
                          className={`w-full p-4 md:p-5 rounded-2xl border transition-all text-left group flex items-center justify-between relative overflow-hidden ${
                            isExpanded 
                              ? "bg-orange-50/10 border-orange-500/40 shadow-sm text-neutral-900" 
                              : "bg-white border-neutral-100 hover:border-orange-500/20"
                          }`}
                        >
                          <div className="flex items-center gap-4 pr-3 min-w-0">
                            {/* Short Unit Index Bubble */}
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${
                              isExpanded 
                                ? "bg-orange-500 text-white" 
                                : "bg-neutral-50 text-neutral-400 group-hover:bg-orange-50 group-hover:text-orange-500"
                            }`}>
                              0{index + 1}
                            </div>
                            <div className="min-w-0">
                              <span className={`block text-[8px] font-extrabold uppercase tracking-widest ${
                                isExpanded ? "text-orange-600" : "text-neutral-400"
                              }`}>
                                Unit Note
                              </span>
                              <h4 className={`text-xs md:text-sm font-extrabold leading-snug tracking-tight truncate ${
                                isExpanded ? "text-neutral-950 font-black" : "text-neutral-700"
                              }`}>
                                {unit.title.split(": ")[1] || unit.title}
                              </h4>
                            </div>
                          </div>
                          
                          <ChevronRight size={14} className={`shrink-0 transition-transform duration-300 ${
                            isExpanded ? "rotate-90 text-orange-500" : "text-neutral-305 group-hover:text-neutral-400"
                          }`} />
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Right: Embedded Preview / Admin Upload Box (7 portions out of 12) */}
                  <div className="lg:col-span-7">
                    {expandedUnit !== null ? (
                      <div className="bg-white rounded-[24px] border border-neutral-100 shadow-md overflow-hidden h-[450px] md:h-[550px] flex flex-col sticky top-28">
                        
                        {/* Preview Topbar Header */}
                        <div className="p-4 md:p-5 border-b border-neutral-100 bg-neutral-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <h4 className="text-xs md:text-sm font-extrabold text-neutral-900">
                            Unit 0{expandedUnit + 1} Notes Resource
                          </h4>
                          
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            {uploadedResources.find(r => r.subjectCode === activeSubject && r.type === "notes" && r.unit === expandedUnit + 1) ? (
                              <>
                                <button 
                                  onClick={() => setIsFullscreen(true)}
                                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-205 text-neutral-700 text-xs font-bold transition-colors w-full sm:w-auto border border-neutral-200"
                                >
                                  <Maximize2 size={12} /> Full Screen
                                </button>
                                <a 
                                  href={uploadedResources.find(r => r.subjectCode === activeSubject && r.type === "notes" && r.unit === expandedUnit + 1).fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors shadow-sm w-full sm:w-auto"
                                >
                                  <Download size={12} /> Download PDF
                                </a>
                              </>
                            ) : (
                              <button disabled className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 text-neutral-305 text-xs font-bold cursor-not-allowed w-full sm:w-auto">
                                <Download size={12} /> No File Attached
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Preview Body Area */}
                        <div className="flex-1 p-5 md:p-8 overflow-y-auto space-y-6">
                          {uploadedResources.find(r => r.subjectCode === activeSubject && r.type === "notes" && r.unit === expandedUnit + 1) ? (
                            <div className="h-full flex flex-col animate-fadeIn">
                              {/* Metadata Banner with Delete for Admin */}
                              <div className="px-5 py-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl mb-4 relative group/info flex items-center justify-between gap-4">
                                <div className="space-y-0.5">
                                  <h5 className="font-extrabold text-orange-950 text-xs md:text-sm pr-6 leading-normal">
                                    {uploadedResources.find(r => r.subjectCode === activeSubject && r.type === "notes" && r.unit === expandedUnit + 1).title}
                                  </h5>
                                  <p className="text-[10px] text-orange-700/80">Premium quality handwriting document ready for academic study.</p>
                                </div>
                                {isAdmin && (
                                  <button 
                                    onClick={async () => {
                                      if(confirm("Delete this resource?")) {
                                        const res = uploadedResources.find(r => r.subjectCode === activeSubject && r.type === "notes" && r.unit === expandedUnit + 1);
                                        await deleteDoc(doc(db, "resources", res.id));
                                      }
                                    }}
                                    className="p-1.5 rounded-lg bg-white/85 text-red-500 shadow-sm transition-all hover:bg-red-50 shrink-0 self-start animate-fadeIn"
                                    title="Delete document"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                              
                              {/* Embedded Iframe Previewer with Buffer Loader */}
                              <div className="relative flex-1 w-full min-h-[225px] rounded-xl overflow-hidden border border-neutral-100 bg-white">
                                {iframeLoading && (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm z-30 transition-all duration-300">
                                    <div className="flex flex-col items-center space-y-4">
                                      <div className="relative w-12 h-12">
                                        <div className="absolute inset-0 rounded-full border-2 border-orange-500/10" />
                                        <div className="absolute inset-0 rounded-full border-t-2 border-orange-500 animate-spin" />
                                        <div className="absolute inset-2 rounded-full border-r-2 border-orange-400/40 animate-spin [animation-duration:1.5s]" />
                                      </div>
                                      <div className="text-center space-y-1 select-none">
                                        <p className="text-xs font-extrabold tracking-widest text-neutral-900 uppercase">
                                          Zero2One Previewer
                                        </p>
                                        <p className="text-[10px] text-neutral-400 font-medium font-sans animate-pulse">
                                          Rendering secure PDF document...
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                <iframe 
                                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(uploadedResources.find(r => r.subjectCode === activeSubject && r.type === "notes" && r.unit === expandedUnit + 1).fileUrl)}&embedded=true`} 
                                  className="w-full h-full min-h-[225px] border-none"
                                  title="Notes Preview"
                                  onLoad={() => setIframeLoading(false)}
                                />
                              </div>
                            </div>
                          ) : isAdmin ? (
                            /* Beautiful drop box for Administrator upload */
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-5 border-2 border-dashed border-neutral-200 bg-neutral-50/50 rounded-2xl p-6">
                              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shadow-inner">
                                <Plus size={24} />
                              </div>
                              <div className="space-y-1">
                                <p className="font-extrabold text-neutral-800 text-sm">Upload Unit {expandedUnit + 1} Study Notes</p>
                                <p className="text-xs text-neutral-400 max-w-xs mx-auto">Upload premium academic notes in PDF or Doc formatting for students.</p>
                              </div>
                              <input 
                                type="file" 
                                id={`upload-unit-${expandedUnit}`}
                                className="hidden"
                                accept=".pdf,.doc,.docx"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(file, "notes", expandedUnit + 1);
                                }}
                              />
                              <label 
                                htmlFor={`upload-unit-${expandedUnit}`}
                                className={`px-5 py-2.5 rounded-full bg-neutral-900 hover:bg-black text-white text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                              >
                                {uploading ? <Sparkles size={13} className="animate-spin" /> : <FileText size={13} />}
                                {uploading ? 'Uploading notes...' : 'Select Study Document'}
                              </label>
                            </div>
                          ) : (
                            /* Students Empty view */
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                              <div className="w-14 h-14 rounded-2xl bg-neutral-50 flex items-center justify-center text-neutral-300 shadow-inner">
                                <FileText size={28} />
                              </div>
                              <div className="space-y-1">
                                <p className="font-extrabold text-neutral-800 text-sm">No Notes Uploaded</p>
                                <p className="text-xs text-neutral-400 max-w-xs mx-auto">This academic resource has not been uploaded by the course coordinator yet.</p>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    ) : (
                      /* Instructions to expand a unit card first */
                      <div className="h-[250px] md:h-[350px] rounded-[24px] border-4 border-dashed border-neutral-100 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-white animate-fadeIn">
                        <div className="w-12 h-12 rounded-2xl bg-neutral-50 flex items-center justify-center text-neutral-200 shadow-inner">
                          <Layers size={24} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Preview Pane</p>
                          <p className="text-xs text-neutral-305">Select any syllabus unit card from the left side list breakdown to read.</p>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {resourceTab === "pyqs" && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="space-y-0.5 select-none">
                    <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">PREVIOUS YEAR PAPERS</span>
                    <h4 className="text-xs font-bold text-neutral-400 font-sans">Practice questions compiled from past university exams</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* Admin trigger to upload a new PYQ */}
                    {isAdmin && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-6 md:p-8 rounded-[24px] bg-neutral-50/50 border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center text-center space-y-4 group hover:border-orange-500/30 transition-all min-h-[160px]"
                      >
                        <input 
                          type="file" 
                          id="upload-pyq"
                          className="hidden"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, "pyqs");
                          }}
                        />
                        <label 
                          htmlFor="upload-pyq"
                          className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center cursor-pointer group-hover:bg-orange-500 group-hover:text-white transition-all shadow-sm"
                        >
                          <Plus size={20} />
                        </label>
                        <div className="space-y-1">
                          <p className="font-extrabold text-neutral-800 text-xs md:text-sm font-sans">Upload Exam Paper</p>
                          <p className="text-[10px] text-neutral-400">Add official PYQ paper schema</p>
                        </div>
                      </motion.div>
                    )}

                    {/* Listing of papers */}
                    {uploadedResources.filter(r => r.subjectCode === activeSubject && r.type === "pyqs").length > 0 ? (
                      uploadedResources.filter(r => r.subjectCode === activeSubject && r.type === "pyqs").map((res) => (
                        <motion.div
                          key={res.id}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          whileHover={{ y: -2, scale: 1.005 }}
                          className="p-6 md:p-8 rounded-[24px] bg-white border border-neutral-100 shadow-sm hover:border-orange-500/30 transition-all group relative flex flex-col justify-between min-h-[160px]"
                        >
                          {isAdmin && (
                            <button 
                              onClick={async () => {
                                if(confirm("Delete this PYQ?")) {
                                  await deleteDoc(doc(db, "resources", res.id));
                                }
                              }}
                              className="absolute top-5 right-5 p-1.5 rounded-lg bg-neutral-50 hover:bg-neutral-100 text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow-inner shrink-0"
                              title="Delete model paper"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}

                          <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center text-orange-600">
                              <Layers size={18} />
                            </div>
                            
                            <a 
                              href={res.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="w-8 h-8 rounded-full bg-neutral-50 hover:bg-orange-500 hover:text-white hover:border-orange-400 border border-neutral-100 text-neutral-400 flex items-center justify-center shadow-sm transition-all"
                              title="Download past paper"
                            >
                              <Download size={13} />
                            </a>
                          </div>

                          <div className="space-y-1">
                            <h3 className="text-sm md:text-base font-extrabold text-neutral-905 tracking-tight leading-snug line-clamp-2">
                              {res.title}
                            </h3>
                            <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-wide font-mono">
                              {res.year} Paper
                            </p>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      /* Empty state paper */
                      <div className="col-span-full py-16 text-center space-y-4 bg-white/20 select-none">
                        <div className="w-14 h-14 mx-auto rounded-3xl bg-neutral-50 flex items-center justify-center text-neutral-200">
                          <Layers size={26} />
                        </div>
                        <p className="text-neutral-400 text-xs md:text-sm font-light">
                          No previous year model papers have been compiled for this subject yet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Custom Elegant Embedded Footer inside Scroll */}
          <div className="pt-8 border-t border-neutral-100/60 flex flex-col items-center gap-4 text-center mt-12 md:mt-16 animate-fadeIn">
            <div className="space-y-0.5 select-none">
              <h2 className="text-base font-black tracking-tighter text-neutral-950">ZERO2ONE</h2>
              <p className="text-[10px] text-neutral-400 font-medium font-sans">Empowering Anurag University Students</p>
            </div>
            
            <div className="mt-1">
              {user ? (
                <div className="flex items-center gap-3 font-sans">
                  <div className="flex flex-col items-center text-center">
                    <span className="text-[10px] font-bold text-neutral-850 leading-none">{user.displayName}</span>
                    {isAdmin && <span className="text-[8px] font-black uppercase text-orange-500 tracking-widest mt-1 leading-none">Admin</span>}
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="p-1.5 rounded-full bg-neutral-100 text-neutral-400 hover:text-red-500 transition-all border border-neutral-200 shadow-sm hover:bg-neutral-200"
                    title="Logout"
                  >
                    <LogOut size={12} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-50 text-neutral-600 hover:text-neutral-950 text-[9px] md:text-[10px] font-bold hover:bg-neutral-100 hover:scale-105 active:scale-95 transition-all font-sans border border-neutral-200"
                >
                  <Shield size={12} /> Admin Login
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  };

  const renderFooter = () => (
    <footer className="bg-neutral-50/40 border-t border-neutral-100/60 py-6 md:py-8 px-6 md:px-8 mt-auto">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-8">
        <div className="space-y-0.5 text-center sm:text-left">
          <h2 className="text-base md:text-lg font-black tracking-tighter">ZERO2ONE</h2>
          <p className="text-[10px] md:text-xs text-neutral-400 font-medium font-sans">Empowering Anurag University Students</p>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3 font-sans">
              <div className="flex flex-col items-end text-right">
                <span className="text-[11px] md:text-xs font-bold text-neutral-900">{user.displayName}</span>
                {isAdmin && <span className="text-[8px] md:text-[9px] font-black uppercase text-orange-500 tracking-widest mt-0.5 leading-none">Admin</span>}
              </div>
              <button 
                onClick={handleLogout}
                className="p-1.5 md:p-2 rounded-full bg-white text-neutral-400 hover:text-red-500 transition-all border border-neutral-200 shadow-sm hover:shadow-md hover:bg-neutral-100"
                title="Logout"
              >
                <LogOut size={14} className="md:w-[16px] md:h-[16px]" />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-900 text-white text-[10px] md:text-xs font-bold hover:bg-black transition-all hover:scale-105 active:scale-95 font-sans"
            >
              <Shield size={12} /> Admin Login
            </button>
          )}
        </div>
      </div>
    </footer>
  );

  const renderSyllabusView = () => {
    const subjects = SYLLABUS_MAP[selectedDept || ""]?.[selectedSem || 1] || [];
    const currentActiveSubject = activeSubject || (subjects.length > 0 ? subjects[0].code : null);
    const activeSubjectData = currentActiveSubject ? SUBJECT_DETAILS[currentActiveSubject] : null;
    const selectedSubjectObj = subjects.find(s => s.code === currentActiveSubject);

    return (
      <div className="min-h-screen bg-white overflow-y-auto pb-24 font-sans selection:bg-orange-100/60">
        
        {/* Sticky Compact Top Navigation Header */}
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-neutral-100/80 px-4 py-4 transition-all">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-6">
            <motion.button 
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setViewState("choice-selection"); setActiveSubject(null); }} 
              className="flex items-center gap-2 text-neutral-400 hover:text-black transition-all font-bold uppercase tracking-wider text-[10px] md:text-xs"
            >
              <ArrowLeft size={14} className="md:w-4 md:h-4" /> Back to Choice
            </motion.button>
            
            <div className="flex flex-col text-left sm:text-right">
              <span className="text-[9px] md:text-[10px] font-extrabold uppercase tracking-widest text-orange-500 line-clamp-1">{selectedDept}</span>
              <span className="text-xs md:text-sm font-bold text-neutral-900 mt-0.5">Year 01 // Semester 0{selectedSem}</span>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-12 space-y-8 md:space-y-12">
          
          {/* Main Content Responsive Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            
            {/* Left Column: Subject Selection / Course Structure */}
            <div className="lg:col-span-5 space-y-4 md:space-y-6">
              <div className="space-y-1 md:space-y-2">
                <span className="text-[9px] uppercase tracking-[0.2em] font-extrabold text-orange-500">ACADEMIC JOURNEY</span>
                <h3 className="text-xl md:text-3xl font-extrabold text-neutral-950 tracking-tight">Course Structure</h3>
                <p className="text-neutral-500 text-xs md:text-sm font-light">
                  Select a subject below to view its specific unit breakdown.
                </p>
              </div>

              {/* Total credits indicator banner */}
              <div className="flex items-center justify-between p-3.5 md:p-4 rounded-2xl bg-neutral-50 border border-neutral-100/80 text-neutral-900 text-xs font-semibold">
                <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-wider text-neutral-500">
                  <Award size={14} className="text-orange-500" />
                  Syllabus Copy
                </div>
                <div className="text-orange-600 font-extrabold">
                  Total Credits: {subjects.reduce((sum, s) => sum + s.credits, 0)}
                </div>
              </div>

              {/* Responsive Subject Selection: Mobile-friendly buttons layout */}
              <div className="block lg:hidden space-y-2.5">
                {subjects.map((subject) => {
                  const isSelected = currentActiveSubject === subject.code;
                  return (
                    <motion.button
                      key={subject.code}
                      onClick={() => setActiveSubject(subject.code)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`w-full flex items-start justify-between p-4 rounded-2xl border transition-all text-left relative overflow-hidden ${
                        isSelected 
                          ? "border-orange-500/50 bg-orange-50/10 shadow-md" 
                          : "border-neutral-100 bg-white hover:border-neutral-200 shadow-sm"
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] text-neutral-400 font-bold tracking-wider">{subject.code}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                            isSelected ? "bg-orange-500/10 text-orange-600" : "bg-neutral-100 text-neutral-500"
                          }`}>
                            {subject.type}
                          </span>
                        </div>
                        <h4 className={`text-sm font-extrabold leading-snug tracking-tight truncate ${
                          isSelected ? "text-neutral-950 font-black" : "text-neutral-850"
                        }`}>
                          {subject.title}
                        </h4>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[11px] font-black ${isSelected ? "text-orange-600" : "text-neutral-400"}`}>
                          {subject.credits} Cr
                        </span>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                          isSelected ? "bg-orange-500 text-white" : "bg-neutral-50 text-neutral-300"
                        }`}>
                          <ChevronRight size={10} />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-widest font-black text-neutral-400 border-b border-neutral-100 bg-neutral-50/40">
                        <th className="px-5 py-4">Code</th>
                        <th className="px-4 py-4">Title</th>
                        <th className="px-4 py-4 text-center">Type</th>
                        <th className="px-5 py-4 text-right">Cr</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {subjects.map((subject) => {
                        const isSelected = currentActiveSubject === subject.code;
                        return (
                          <tr 
                            key={subject.code} 
                            onClick={() => setActiveSubject(subject.code)} 
                            className={`cursor-pointer transition-all ${
                              isSelected 
                                ? "bg-orange-50/10 text-orange-900 border-l-4 border-l-orange-500" 
                                : "hover:bg-neutral-50/60"
                            }`}
                          >
                            <td className={`px-5 py-4.5 font-mono text-[10.5px] font-bold ${isSelected ? "text-orange-600" : "text-neutral-400"}`}>{subject.code}</td>
                            <td className={`px-4 py-4.5 font-bold text-sm tracking-tight ${isSelected ? "text-neutral-950 font-black" : "text-neutral-700"}`}>{subject.title}</td>
                            <td className="px-4 py-4.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase ${
                                isSelected ? "bg-orange-500/10 text-orange-600" : "bg-neutral-100 text-neutral-400"
                              }`}>{subject.type}</span>
                            </td>
                            <td className={`px-5 py-4.5 text-right font-black ${isSelected ? "text-orange-600" : "text-neutral-800"}`}>{subject.credits}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column: Active Subject Detailed Syllabus copy */}
            <div className="lg:col-span-7 space-y-6 md:space-y-8">
              <AnimatePresence mode="wait">
                {activeSubjectData && selectedSubjectObj ? (
                  <motion.div 
                    key={currentActiveSubject} 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -15 }} 
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="space-y-6 md:space-y-8"
                  >
                    
                    {/* 1. Hero Card */}
                    <div className="relative rounded-[28px] bg-white border border-orange-100 p-6 md:p-8 shadow-xl shadow-orange-500/[0.02] overflow-hidden">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/[0.03] blur-[40px] rounded-full pointer-events-none" />
                      
                      <div className="space-y-4 relative z-10">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest shadow-sm shadow-orange-500/10">
                            <FileText size={10} /> SYLLABUS COPY
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <h4 className="text-xl md:text-3xl font-extrabold tracking-tight text-neutral-950 leading-snug">
                            {activeSubjectData.title}
                          </h4>
                          <span className="inline-block text-xs uppercase tracking-wider font-extrabold text-orange-500">
                            Course Code: {selectedSubjectObj.code}
                          </span>
                        </div>

                        {/* Metadata row */}
                        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-neutral-100 text-center">
                          <div className="bg-neutral-50/50 p-2.5 rounded-xl border border-neutral-100 flex flex-col justify-center">
                            <span className="text-[8px] uppercase tracking-wider font-extrabold text-neutral-400">Credits</span>
                            <span className="text-xs md:text-sm font-black text-orange-600 mt-0.5">{selectedSubjectObj.credits} Credits</span>
                          </div>
                          
                          <div className="bg-neutral-50/50 p-2.5 rounded-xl border border-neutral-100 flex flex-col justify-center">
                            <span className="text-[8px] uppercase tracking-wider font-extrabold text-neutral-400">Regulation</span>
                            <span className="text-xs md:text-sm font-black text-neutral-800 mt-0.5">R22 Scheme</span>
                          </div>

                          <div className="bg-neutral-50/50 p-2.5 rounded-xl border border-neutral-100 flex flex-col justify-center">
                            <span className="text-[8px] uppercase tracking-wider font-extrabold text-neutral-400">Course Type</span>
                            <span className="text-xs md:text-sm font-black text-neutral-800 mt-0.5">{selectedSubjectObj.type} Course</span>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* 2. Course Outcomes Section (Bullet points converted to outcome cards) */}
                    <div className="space-y-3">
                      <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">Course Outcomes</h5>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeSubjectData.outcomes.map((outcome, i) => (
                          <motion.div 
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm flex items-start gap-3 hover:border-orange-500/10 transition-colors"
                          >
                            <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                              ✓
                            </span>
                            <p className="text-xs md:text-sm text-neutral-600 leading-relaxed font-normal">
                              {outcome}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* 3. Unit Sections (Separate cards with Unit badge and cleaned titles) */}
                    <div className="space-y-4 pb-8">
                      <div className="flex justify-between items-center-b pb-1 border-b border-neutral-100">
                        <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">Syllabus Breakdown</h5>
                        <span className="text-[10px] text-neutral-400 font-bold">{activeSubjectData.units.length} Core Units</span>
                      </div>

                      <div className="flex flex-col gap-4">
                        {activeSubjectData.units.map((unit, i) => (
                          <motion.div 
                            key={i}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + i * 0.04 }}
                            whileHover={{ y: -2, scale: 1.005 }}
                            whileTap={{ scale: 0.995 }}
                            className="bg-white rounded-[24px] border border-neutral-100 hover:border-orange-500/20 shadow-sm hover:shadow-md hover:shadow-orange-500/[0.015] p-5 md:p-6 transition-all duration-300 text-left relative overflow-hidden"
                          >
                            <div className="flex items-start gap-4">
                              {/* Dedicated Unit badge indicator */}
                              <div className="px-2.5 py-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-600 rounded-xl text-[10px] font-black shrink-0 uppercase tracking-wider text-center flex flex-col justify-center min-w-[54px] shadow-inner">
                                <span className="text-[8px] tracking-normal font-bold">UNIT</span>
                                <span className="text-xs md:text-sm leading-none mt-0.5">0{i + 1}</span>
                              </div>
                              
                              <div className="space-y-1.5 flex-1 select-text">
                                <h6 className="text-[14px] md:text-base font-extrabold text-neutral-950 tracking-tight leading-snug">
                                  {unit.title.replace(/^UNIT\s*[I|V|X|0-9]+:?\s*/i, "")}
                                </h6>
                                <p className="text-xs md:text-sm text-neutral-500 leading-relaxed font-light font-sans">
                                  {unit.content}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                  </motion.div>
                ) : (
                  <div className="h-[350px] rounded-[28px] border-4 border-dashed border-neutral-100 flex flex-col items-center justify-center p-10 text-center space-y-4 bg-white">
                    <div className="w-14 h-14 rounded-2xl bg-neutral-50 flex items-center justify-center text-neutral-200"><BookOpen size={28} /></div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">No Subject Selected</p>
                      <p className="text-xs text-neutral-300">Select a subject from the Course Structure to view its detailed units list.</p>
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
        {viewState === "choice-selection" && (
          <motion.div key="choice" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {renderChoiceSelection()}
          </motion.div>
        )}
        {viewState === "syllabus-view" && (
          <motion.div key="view" initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {renderSyllabusView()}
          </motion.div>
        )}
        {viewState === "resources-view" && (
          <motion.div key="resources" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {renderResourcesView()}
          </motion.div>
        )}
      </AnimatePresence>
      {viewState !== "sem-selection" && viewState !== "choice-selection" && viewState !== "resources-view" && renderFooter()}

      {/* Fullscreen Document Viewer Overlay */}
      <AnimatePresence>
        {isFullscreen && uploadedResources.find(r => r.subjectCode === activeSubject && r.type === "notes" && r.unit === expandedUnit! + 1) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-neutral-900 flex flex-col"
          >
            <div className="p-4 bg-neutral-800 flex justify-between items-center text-white px-8">
              <div className="flex flex-col">
                <span className="text-[10px] text-orange-400 font-bold uppercase tracking-widest">{activeSubject}</span>
                <h2 className="font-bold">Unit {expandedUnit! + 1} PDF Viewer</h2>
              </div>
              <div className="flex items-center gap-4">
                <a 
                  href={uploadedResources.find(r => r.subjectCode === activeSubject && r.type === "notes" && r.unit === expandedUnit! + 1).fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors"
                >
                  <Download size={14} /> Download
                </a>
                <button 
                  onClick={() => setIsFullscreen(false)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
                >
                  <Minimize2 size={16} /> Exit Full Screen
                </button>
              </div>
            </div>
            <div className="flex-1 bg-white relative">
              {fullscreenIframeLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/95 backdrop-blur-sm z-30 transition-all duration-300">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative w-12 h-12">
                      <div className="absolute inset-0 rounded-full border-2 border-orange-500/10" />
                      <div className="absolute inset-0 rounded-full border-t-2 border-orange-500 animate-spin" />
                      <div className="absolute inset-2 rounded-full border-r-2 border-orange-400/40 animate-spin [animation-duration:1.5s]" />
                    </div>
                    <div className="text-center space-y-1 select-none">
                      <p className="text-xs font-extrabold tracking-widest text-white uppercase">
                        Zero2One Previewer
                      </p>
                      <p className="text-[10px] text-neutral-400 font-medium font-sans animate-pulse">
                        Rendering premium full screen view...
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <iframe 
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(uploadedResources.find(r => r.subjectCode === activeSubject && r.type === "notes" && r.unit === expandedUnit! + 1).fileUrl)}&embedded=true`} 
                className="w-full h-full border-none"
                title="Fullscreen Viewer"
                onLoad={() => setFullscreenIframeLoading(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


