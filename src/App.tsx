/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Sparkles, ArrowLeft, BookOpen, Clock, Award, FileText, Download, Layers, Shield, LogIn, LogOut, Plus, Trash2, Maximize2, Minimize2, Instagram, ArrowUpRight, Edit2, ExternalLink, RotateCcw, RotateCw } from "lucide-react";
import { useState, useEffect, FormEvent, useRef } from "react";
import { DEPARTMENTS, SYLLABUS_MAP, SUBJECT_DETAILS } from "./data/syllabus";
import { auth, db, googleProvider, ALLOWED_ADMIN_EMAILS, handleFirestoreError, OperationType } from "./lib/firebase";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { doc, getDoc, setDoc, collection, addDoc, query, where, onSnapshot, serverTimestamp, deleteDoc, updateDoc } from "firebase/firestore";
import { PDFViewer } from "./components/PDFViewer";

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

  // Slow PDF failure detection
  const [showSlowPreviewNotice, setShowSlowPreviewNotice] = useState<boolean>(false);

  // Admin Resource Form Modal state
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"notes" | "pyqs">("notes");
  const [modalUnit, setModalUnit] = useState<number | null>(null);
  const [editingResource, setEditingResource] = useState<any | null>(null);

  // Admin form fields
  const [formTitle, setFormTitle] = useState("");
  const [formDriveLink, setFormDriveLink] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formYear, setFormYear] = useState<number>(new Date().getFullYear());
  const [formError, setFormError] = useState("");

  // PDF Rotation States & Dimension Tracking
  const [previewRotation, setPreviewRotation] = useState<number>(0);
  const [fullscreenRotation, setFullscreenRotation] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [previewDims, setPreviewDims] = useState({ w: 0, h: 0 });
  const [fullscreenDims, setFullscreenDims] = useState({ w: 0, h: 0 });

  // ResizeObserver for normal preview iframe container
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPreviewDims({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [expandedUnit, activeSubject, viewState]);

  // ResizeObserver for fullscreen iframe container
  useEffect(() => {
    if (!fullscreenContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setFullscreenDims({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    observer.observe(fullscreenContainerRef.current);
    return () => observer.disconnect();
  }, [isFullscreen]);

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
    setPreviewRotation(0);
    if (activeUnitNoteUrl) {
      setIframeLoading(true);
    } else {
      setIframeLoading(false);
    }
  }, [activeUnitNoteUrl, activeSubject, expandedUnit]);

  useEffect(() => {
    setFullscreenRotation(0);
    if (isFullscreen && activeUnitNoteUrl) {
      setFullscreenIframeLoading(true);
    } else {
      setFullscreenIframeLoading(false);
    }
  }, [isFullscreen, activeUnitNoteUrl]);

  useEffect(() => {
    let timer: any = null;
    if (iframeLoading) {
      setShowSlowPreviewNotice(false);
      timer = setTimeout(() => {
        setShowSlowPreviewNotice(true);
      }, 7000); // 7 seconds timeout for sluggish viewer loads
    } else {
      setShowSlowPreviewNotice(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [iframeLoading, activeSubject, expandedUnit]);

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

  const handleSaveResource = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !user || !selectedDept || !selectedSem || !activeSubject) {
      setFormError("Missing required admin privileges or university subject context nodes.");
      return;
    }

    // Validation
    if (!formTitle.trim()) {
      setFormError("A descriptive title is required for this resource package.");
      return;
    }

    if (formDriveLink.trim()) {
      // Validate drive link formatting recursively
      try {
        const url = new URL(formDriveLink.trim());
        if (!url.hostname.includes("drive.google.com") && !url.hostname.includes("google.com")) {
          setFormError("Please enter a valid Google Drive URL (drive.google.com).");
          return;
        }
      } catch (err) {
        setFormError("Please enter a valid Google Drive address URL starting with https://");
        return;
      }
    }

    // Either file or drive link must be present for a valid database object configuration
    if (!formFile && !formDriveLink.trim() && (!editingResource || !editingResource.fileUrl)) {
      setFormError("At least an uploaded PDF file OR a Google Drive backup link is required.");
      return;
    }

    setUploading(true);
    setFormError("");

    try {
      let downloadURL = editingResource?.fileUrl || "";

      // Check if we need to upload a newly selected file from UI input
      if (formFile) {
        console.log("Starting secure PDF upload to Supabase storage bucket...", formFile.name);
        const fileName = `${Date.now()}-${formFile.name}`;
        const finalUnit = modalType === "notes" ? (modalUnit || 1) : null;
        const storagePath = `resources/${selectedDept}/${selectedSem}/${activeSubject}/${modalType}/${finalUnit ? 'unit-' + finalUnit : 'pyq'}/${fileName}`;
        
        console.log("Target Supabase Node Path:", storagePath);
        
        const formData = new FormData();
        formData.append("file", formFile);
        formData.append("path", storagePath);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          let errorMessage = "Vercel server-proxy upload failed.";
          try {
            const errJson = await response.json();
            errorMessage = errJson.message || errJson.error || errorMessage;
          } catch(e) {}
          throw new Error(errorMessage);
        }

        const jsonResponse = await response.json();
        downloadURL = jsonResponse.url;
        console.log("Upload completed, URL registered:", downloadURL);
      }

      // Build target document payload
      const resourceData: any = {
        branch: selectedDept,
        sem: selectedSem,
        subjectCode: activeSubject,
        type: modalType,
        title: formTitle.trim(),
        fileUrl: downloadURL,
        driveLink: formDriveLink.trim(),
        uploadedAt: serverTimestamp(),
        uploadedBy: user.uid
      };

      if (modalType === "notes") {
        resourceData.unit = modalUnit || 1;
      } else {
        resourceData.year = formYear;
      }

      if (editingResource?.id) {
        // Edit and update flow (Requirement 4)
        console.log("Performing metadata update on Firestore resource...", editingResource.id);
        const updatedRef = doc(db, "resources", editingResource.id);
        await updateDoc(updatedRef, {
          title: resourceData.title,
          fileUrl: resourceData.fileUrl,
          driveLink: resourceData.driveLink,
          ...(modalType === "notes" ? { unit: resourceData.unit } : { year: formYear }),
          updatedAt: serverTimestamp(),
          uploadedBy: user.uid
        });
        alert("Resource configurations updated successfully!");
      } else {
        // Fresh creation flow (Requirement 5)
        console.log("Saving new resource metadata to Firestore...", resourceData);
        await addDoc(collection(db, "resources"), resourceData);
        alert("New resource published successfully!");
      }

      // Reset configurations and collapse admin drawer modal
      setIsAdminModalOpen(false);
      setFormTitle("");
      setFormDriveLink("");
      setFormFile(null);
      setEditingResource(null);
    } catch (error: any) {
      console.error("Core save transaction failure:", error);
      setFormError(error.message || "An unexpected error occurred while writing notes to database.");
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
            <div className="flex items-center gap-6">
              <a href="https://www.instagram.com/zero2one.study/" target="_blank" rel="noreferrer" className="hover:text-black transition-colors flex items-center gap-0.5 group" aria-label="Instagram">
                <Instagram size={15} className="md:w-[17px] md:h-[17px]" />
                <ArrowUpRight size={10} className="text-neutral-400 group-hover:text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
              </a>
              <a href="mailto:zero2onestudypartner@gmail.com" className="hover:text-black transition-colors flex items-center gap-0.5 group underline decoration-neutral-200 underline-offset-4">
                Academic Help
                <ArrowUpRight size={10} className="text-neutral-400 group-hover:text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
              </a>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {subjects.map((subject, index) => (
                  <motion.button
                    key={subject.code}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => { setActiveSubject(subject.code); setResourceTab("notes"); }}
                    whileHover={{ scale: 1.012, y: -1.5 }}
                    whileTap={{ scale: 0.985 }}
                    className="p-4 md:p-5 rounded-[18px] bg-white border border-neutral-105 hover:border-orange-500/40 hover:shadow-[0_0_20px_rgba(249,115,22,0.04)] transition-all duration-300 text-left flex flex-col justify-between h-[155px] md:h-[185px] group relative shadow-sm overflow-hidden animate-fadeIn"
                  >
                    {/* Subtle hover gradient strip */}
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/[0.01] to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    <div className="space-y-2 md:space-y-2.5 relative z-10 w-full animate-fadeIn">
                      {/* Icon Container */}
                      <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white group-hover:scale-105 transition-all duration-300 shadow-sm shrink-0">
                        <BookOpen size={14} className="md:w-4.5 md:h-4.5" />
                      </div>
                      
                      <div className="space-y-0.5">
                        <h3 className="text-sm md:text-base font-extrabold text-neutral-900 tracking-tight leading-snug line-clamp-2">
                          {subject.title}
                        </h3>
                        <p className="text-[10px] md:text-xs text-neutral-400 font-light font-sans truncate block">
                          Unit-wise handwritten lectures and PYQ papers.
                        </p>
                      </div>
                    </div>

                    {/* Card Footer: Metadata and Pill CTA */}
                    <div className="flex justify-between items-center pt-2 md:pt-2.5 border-t border-neutral-100/50 relative z-10 w-full mt-auto">
                      <span className="font-mono text-[8px] md:text-[9px] uppercase font-bold tracking-wider text-neutral-400 bg-neutral-50 px-1.5 py-0.5 rounded border border-neutral-100/60 leading-none">
                        {subject.code}
                      </span>
                      
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-105 text-neutral-600 font-sans border border-neutral-100 group-hover:bg-orange-500 group-hover:text-white group-hover:border-orange-400 transition-all duration-300 text-[9px] md:text-[11px] font-bold shadow-sm">
                        Open Notes
                        <ChevronRight size={11} className="transition-transform group-hover:translate-x-0.5" />
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
                        <div className="p-4 md:p-5 border-b border-neutral-100 bg-neutral-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 select-none">
                          <h4 className="text-xs md:text-sm font-extrabold text-neutral-900">
                            Unit 0{expandedUnit + 1} Notes Resource
                          </h4>
                          
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            {(() => {
                              const activeNote = uploadedResources.find(r => r.subjectCode === activeSubject && r.type === "notes" && r.unit === expandedUnit + 1);
                              if (activeNote) {
                                return (
                                  <>
                                    {activeNote.fileUrl && (
                                      <>
                                        {/* Rotate Controls */}
                                        <div className="flex items-center gap-1 border border-neutral-200 bg-neutral-100 p-1 rounded-xl shadow-sm shrink-0">
                                          <button 
                                            type="button"
                                            onClick={() => setPreviewRotation(prev => (prev - 90 + 360) % 360)}
                                            className="p-1 px-1.5 md:px-2 rounded-lg text-neutral-600 hover:text-orange-500 hover:bg-white transition-all duration-205 active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                                            title="Rotate Left 90°"
                                          >
                                            <RotateCcw size={11} />
                                            <span className="text-[10px] font-bold hidden md:inline">Rotate Left</span>
                                          </button>
                                          <div className="w-[1px] h-3 bg-neutral-250" />
                                          <button 
                                            type="button"
                                            onClick={() => setPreviewRotation(prev => (prev + 90) % 360)}
                                            className="p-1 px-1.5 md:px-2 rounded-lg text-neutral-600 hover:text-orange-500 hover:bg-white transition-all duration-205 active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                                            title="Rotate Right 90°"
                                          >
                                            <RotateCw size={11} />
                                            <span className="text-[10px] font-bold hidden md:inline">Rotate Right</span>
                                          </button>
                                        </div>

                                        <button 
                                          onClick={() => setIsFullscreen(true)}
                                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-750 text-xs font-bold transition-all border border-neutral-250 cursor-pointer shadow-sm active:scale-[0.98]"
                                        >
                                          <Maximize2 size={12} /> Full Screen
                                        </button>
                                        <a 
                                          href={activeNote.fileUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-all shadow-sm w-full sm:w-auto active:scale-[0.98]"
                                        >
                                          <Download size={12} /> Download PDF
                                        </a>
                                      </>
                                    )}
                                    {activeNote.driveLink && (
                                      <a 
                                        href={activeNote.driveLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 text-white text-xs font-bold hover:bg-black transition-all shadow-sm w-full sm:w-auto active:scale-[0.98]"
                                      >
                                        <ExternalLink size={12} /> Open Drive
                                      </a>
                                    )}
                                  </>
                                );
                              } else {
                                return (
                                  <button disabled className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 text-neutral-400 text-xs font-bold cursor-not-allowed w-full sm:w-auto">
                                    <Download size={12} /> No File Attached
                                  </button>
                                );
                              }
                            })()}
                          </div>
                        </div>

                        {/* Preview Body Area */}
                        <div className="flex-1 p-5 md:p-8 overflow-y-auto space-y-6">
                          {(() => {
                            const activeNote = uploadedResources.find(r => r.subjectCode === activeSubject && r.type === "notes" && r.unit === expandedUnit + 1);
                            if (activeNote) {
                              return (
                                <div className="h-full flex flex-col animate-fadeIn">
                                  {/* Metadata Banner with Edit/Delete for Admin */}
                                  <div className="px-5 py-4 bg-orange-50/50 border border-orange-500/20 rounded-2xl mb-4 relative group/info flex items-center justify-between gap-4">
                                    <div className="space-y-0.5 min-w-0">
                                      <h5 className="font-extrabold text-orange-950 text-xs md:text-sm pr-6 leading-normal truncate">
                                        {activeNote.title}
                                      </h5>
                                      <p className="text-[10px] text-orange-700/80">
                                        {activeNote.driveLink ? "Dual delivery enabled: Google Drive + Supabase Cloud Server." : "Premium quality handwriting document ready for academic study."}
                                      </p>
                                    </div>
                                    
                                    {isAdmin && (
                                      <div className="flex items-center gap-1.5 shrink-0 self-start">
                                        <button 
                                          onClick={() => {
                                            setEditingResource(activeNote);
                                            setModalType("notes");
                                            setModalUnit(expandedUnit + 1);
                                            setFormTitle(activeNote.title);
                                            setFormDriveLink(activeNote.driveLink || "");
                                            setFormYear(new Date().getFullYear());
                                            setFormFile(null);
                                            setFormError("");
                                            setIsAdminModalOpen(true);
                                          }}
                                          className="p-1.5 rounded-lg bg-white text-orange-600 shadow-sm border border-neutral-100 transition-all hover:bg-orange-50 cursor-pointer"
                                          title="Edit details"
                                        >
                                          <Edit2 size={13} />
                                        </button>
                                        <button 
                                          onClick={async () => {
                                            if(confirm("Are you sure you want to delete this resource?")) {
                                              await deleteDoc(doc(db, "resources", activeNote.id));
                                            }
                                          }}
                                          className="p-1.5 rounded-lg bg-white text-red-500 shadow-sm border border-neutral-100 transition-all hover:bg-red-50 cursor-pointer"
                                          title="Delete document"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* High-Performance Same-Origin canvas PDF viewer */}
                                  {activeNote.fileUrl ? (
                                    <div ref={containerRef} className="relative flex-1 w-full min-h-[300px] h-full rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-900 shadow-xl">
                                      <PDFViewer fileUrl={activeNote.fileUrl} rotation={previewRotation} />
                                    </div>
                                  ) : (
                                    /* Direct Google Drive Display Card (If fileUrl is omitted & only Drive link is present for handwritten PDFs) */
                                    <div className="flex-1 border-2 border-dashed border-orange-200 bg-orange-50/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 animate-fadeIn">
                                      <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
                                        <Layers size={28} />
                                      </div>
                                      <div className="space-y-1.5 max-w-sm">
                                        <p className="font-extrabold text-neutral-900 text-sm md:text-base leading-none">External Handwriting Notes</p>
                                        <p className="text-xs text-neutral-550 leading-relaxed font-semibold">
                                          This booklet of hand-written guidelines is hosted securely on Google Drive to manage data bandwidth limits.
                                        </p>
                                      </div>
                                      {activeNote.driveLink ? (
                                        <a 
                                          href={activeNote.driveLink}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl text-xs md:text-sm flex items-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer"
                                        >
                                          Open notes on Google Drive <ArrowUpRight size={14} />
                                        </a>
                                      ) : (
                                        <p className="text-xs text-red-500 font-bold">Error: Connection links are missing.</p>
                                      )}
                                    </div>
                                  )}

                                  {/* Inline Falling Back Notice underneath PDF Viewer */}
                                  {activeNote.driveLink && activeNote.fileUrl && (
                                    <div className="mt-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between gap-3 text-[10px] md:text-xs text-neutral-650 select-none animate-fadeIn transition-colors hover:bg-neutral-100">
                                      <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shrink-0" />
                                        <span>Having trouble loading notes? Play via backup.</span>
                                      </div>
                                      <a 
                                        href={activeNote.driveLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-orange-600 font-extrabold hover:text-orange-700 flex items-center gap-0.5 cursor-pointer"
                                      >
                                        Google Drive <ArrowUpRight size={12} />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              );
                            } else if (isAdmin) {
                              return (
                                /* Beautiful drop box for Administrator upload */
                                <div className="flex flex-col items-center justify-center h-full text-center space-y-5 border-2 border-dashed border-neutral-200 bg-neutral-50/50 rounded-2xl p-6">
                                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shadow-inner">
                                    <Plus size={24} />
                                  </div>
                                  <div className="space-y-1 select-none">
                                    <p className="font-extrabold text-neutral-800 text-sm">Upload Unit {expandedUnit + 1} Study Notes</p>
                                    <p className="text-xs text-neutral-400 max-w-xs mx-auto">Configure a PDF record and/or Google Drive alternative link.</p>
                                  </div>
                                  <button 
                                    onClick={() => {
                                      setEditingResource(null);
                                      setModalType("notes");
                                      setModalUnit(expandedUnit + 1);
                                      setFormTitle(`Unit ${expandedUnit + 1} Notes - ${activeSubject}`);
                                      setFormDriveLink("");
                                      setFormYear(new Date().getFullYear());
                                      setFormFile(null);
                                      setFormError("");
                                      setIsAdminModalOpen(true);
                                    }}
                                    className="px-5 py-2.5 rounded-full bg-neutral-900 hover:bg-black text-white text-xs font-bold cursor-pointer transition-all flex items-center gap-2 active:scale-95 shadow-sm"
                                  >
                                    <Plus size={13} />
                                    Configure Notes
                                  </button>
                                </div>
                              );
                            } else {
                              return (
                                /* Students Empty view */
                                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                  <div className="w-14 h-14 rounded-2xl bg-neutral-50 flex items-center justify-center text-neutral-300 shadow-inner">
                                    <FileText size={28} />
                                  </div>
                                  <div className="space-y-1 select-none">
                                    <p className="font-extrabold text-neutral-800 text-sm">No Notes Uploaded</p>
                                    <p className="text-xs text-neutral-400 max-w-xs mx-auto">This academic resource has not been uploaded by the course coordinator yet.</p>
                                  </div>
                                </div>
                              );
                            }
                          })()}
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
                        <button 
                          onClick={() => {
                            setEditingResource(null);
                            setModalType("pyqs");
                            setModalUnit(null);
                            setFormTitle(`Previous Year Paper - ${activeSubject}`);
                            setFormDriveLink("");
                            setFormYear(new Date().getFullYear());
                            setFormFile(null);
                            setFormError("");
                            setIsAdminModalOpen(true);
                          }}
                          className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center cursor-pointer hover:bg-orange-500 hover:text-white transition-all shadow-sm"
                        >
                          <Plus size={20} />
                        </button>
                        <div className="space-y-1 select-none">
                          <p className="font-extrabold text-neutral-800 text-xs md:text-sm font-sans">Upload Exam Paper</p>
                          <p className="text-[10px] text-neutral-400">Add official past and model PYQ exams</p>
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
                            <div className="absolute top-5 right-5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => {
                                  setEditingResource(res);
                                  setModalType("pyqs");
                                  setModalUnit(null);
                                  setFormTitle(res.title);
                                  setFormDriveLink(res.driveLink || "");
                                  setFormYear(res.year || new Date().getFullYear());
                                  setFormFile(null);
                                  setFormError("");
                                  setIsAdminModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-neutral-50 hover:bg-neutral-100 text-orange-600 shadow-inner cursor-pointer"
                                title="Edit PYQ details"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button 
                                onClick={async () => {
                                  if(confirm("Delete this PYQ?")) {
                                    await deleteDoc(doc(db, "resources", res.id));
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-neutral-50 hover:bg-neutral-100 text-red-500 shadow-inner cursor-pointer"
                                title="Delete model paper"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}

                          <div className="flex justify-between items-start mb-4 select-none">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-550 flex items-center justify-center text-orange-600">
                              <Layers size={18} />
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              {res.fileUrl && (
                                <a 
                                  href={res.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-8 h-8 rounded-full bg-neutral-50 hover:bg-orange-500 hover:text-white hover:border-orange-400 border border-neutral-100 text-neutral-400 flex items-center justify-center shadow-sm transition-all"
                                  title="Download past paper"
                                >
                                  <Download size={13} />
                                </a>
                              )}
                              {res.driveLink && (
                                <a 
                                  href={res.driveLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-black text-white hover:border-black border border-neutral-800 flex items-center justify-center shadow-sm transition-all"
                                  title="Open in Google Drive"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <h3 className="text-sm md:text-base font-extrabold text-neutral-905 tracking-tight leading-snug line-clamp-2">
                              {res.title}
                            </h3>
                            <div className="flex items-center gap-2 select-none">
                              <p className="text-[10px] text-neutral-450 font-extrabold uppercase tracking-wide font-mono">
                                {res.year || "Past"} Paper
                              </p>
                              {res.driveLink && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-black bg-orange-100 text-orange-900 uppercase tracking-widest leading-none">
                                  Drive Backup
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      /* Empty state paper */
                      <div className="col-span-full py-16 text-center space-y-4 bg-white/20 select-none">
                        <div className="w-14 h-14 mx-auto rounded-3xl bg-neutral-50 flex items-center justify-center text-neutral-200 animate-pulse">
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
        {isFullscreen && (() => {
          const activeNote = uploadedResources.find(r => r.subjectCode === activeSubject && r.type === "notes" && r.unit === expandedUnit! + 1);
          if (activeNote && activeNote.fileUrl) {
            return (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] bg-neutral-900 flex flex-col"
              >
                <div className="p-4 bg-neutral-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-white px-8 select-none">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-orange-400 font-bold uppercase tracking-widest">{activeSubject}</span>
                    <h2 className="font-bold truncate text-sm md:text-base">{activeNote.title}</h2>
                  </div>
                  <div className="flex items-center flex-wrap gap-2 md:gap-4 shrink-0">
                    {/* Rotate Controls */}
                    <div className="flex items-center gap-1 border border-neutral-700 bg-neutral-900/60 p-1 rounded-xl shadow-inner shrink-0 leading-none">
                      <button 
                        type="button"
                        onClick={() => setFullscreenRotation(prev => (prev - 90 + 360) % 360)}
                        className="p-1 px-1.5 md:px-2 rounded-lg text-neutral-300 hover:text-orange-400 hover:bg-neutral-800 transition-all duration-205 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                        title="Rotate Left 90°"
                      >
                        <RotateCcw size={13} />
                        <span className="text-[11px] font-bold hidden md:inline">Rotate Left</span>
                      </button>
                      <div className="w-[1px] h-3.5 bg-neutral-750" />
                      <button 
                        type="button"
                        onClick={() => setFullscreenRotation(prev => (prev + 90) % 360)}
                        className="p-1 px-1.5 md:px-2 rounded-lg text-neutral-300 hover:text-orange-400 hover:bg-neutral-800 transition-all duration-205 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                        title="Rotate Right 90°"
                      >
                        <RotateCw size={13} />
                        <span className="text-[11px] font-bold hidden md:inline">Rotate Right</span>
                      </button>
                    </div>

                    {activeNote.driveLink && (
                      <a 
                        href={activeNote.driveLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg bg-neutral-900 text-white text-xs font-bold hover:bg-black transition-all border border-neutral-700 shadow-sm"
                      >
                        <ExternalLink size={14} /> Open Drive
                      </a>
                    )}
                    <a 
                      href={activeNote.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-all shadow-md"
                    >
                      <Download size={14} /> Download
                    </a>
                    <button 
                      onClick={() => setIsFullscreen(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      <Minimize2 size={16} /> Exit
                    </button>
                  </div>
                </div>
                <div ref={fullscreenContainerRef} className="flex-1 bg-neutral-900 relative overflow-hidden">
                  <PDFViewer 
                    fileUrl={activeNote.fileUrl} 
                    rotation={fullscreenRotation} 
                    isFullscreen={true} 
                  />
                </div>
              </motion.div>
            );
          }
          return null;
        })()}
      </AnimatePresence>

      {/* Centralized Academic Admin Config Modal */}
      <AnimatePresence>
        {isAdminModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Background glassmorphic layer */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if(!uploading) {
                  setIsAdminModalOpen(false);
                  setEditingResource(null);
                }
              }}
              className="absolute inset-0 bg-neutral-950/60 backdrop-blur-md"
            />

            {/* Modal Body card */}
            <motion.div 
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.35 }}
              className="relative w-full max-w-lg bg-white rounded-[28px] border border-neutral-100 shadow-2xl p-6 md:p-8 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="absolute top-0 left-0 w-32 h-32 bg-orange-500/5 rounded-full filter blur-xl -translate-x-12 -translate-y-12" />
              
              <div className="relative flex justify-between items-start pb-5 border-b border-neutral-100 select-none mb-6">
                <div>
                  <span className="text-[9px] font-black uppercase text-orange-600 tracking-widest block mb-0.5">
                    {editingResource ? "Update Configuration" : "Add Resource Workspace"}
                  </span>
                  <h3 className="text-base md:text-lg font-black text-neutral-900 font-sans tracking-tight leading-none">
                    {editingResource ? `Edit: ${editingResource.title.split(" - ")[0]}` : `Publish ${modalType === 'notes' ? 'Unit notes' : 'Past Exams'}`}
                  </h3>
                  <p className="text-[10px] text-neutral-400 mt-1">Colleges: JNTU-H &amp; Autonomous Syllabus Nodes.</p>
                </div>
                {!uploading && (
                  <button 
                    onClick={() => {
                      setIsAdminModalOpen(false);
                      setEditingResource(null);
                    }}
                    className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                  >
                    <Minimize2 size={16} />
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveResource} className="space-y-5 overflow-y-auto flex-1 pr-1.5 scrollbar-thin">
                {formError && (
                  <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold leading-normal animate-fadeIn">
                    {formError}
                  </div>
                )}

                {/* Form Title Field */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-sans">
                    Resource Title
                  </label>
                  <input 
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={modalType === "notes" ? `Unit ${modalUnit} Notes` : "2024 Exam Paper"}
                    className="w-full px-4 py-3 text-xs md:text-sm border border-neutral-200 hover:border-neutral-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 rounded-xl outline-none transition-all placeholder:text-neutral-400 text-neutral-900 font-bold"
                  />
                </div>

                {/* Conditional Fields: Unit vs Year */}
                {modalType === "notes" ? (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-sans">
                      Target Unit (1-5)
                    </label>
                    <select
                      value={modalUnit || 1}
                      onChange={(e) => setModalUnit(parseInt(e.target.value))}
                      className="w-full px-4 py-3 text-xs md:text-sm border border-neutral-200 hover:border-neutral-300 focus:border-orange-500 rounded-xl outline-none transition-all font-bold text-[#2d2d2d]"
                    >
                      {[1,2,3,4,5].map(u => (
                        <option key={u} value={u}>Unit {u} Notes System</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-sans">
                      Exam Year
                    </label>
                    <input 
                      type="number"
                      required
                      min={2018}
                      max={new Date().getFullYear() + 1}
                      value={formYear}
                      onChange={(e) => setFormYear(parseInt(e.target.value))}
                      className="w-full px-4 py-3 text-xs md:text-sm border border-neutral-200 hover:border-neutral-300 focus:border-orange-500 rounded-xl outline-none transition-all text-neutral-900 font-bold"
                    />
                  </div>
                )}

                {/* Google Drive Link (Requirement 5) */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center select-none">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-sans font-extrabold pb-0.5">
                      Google Drive Link <span className="text-[9px] font-bold text-neutral-400 italic">(Optional Backup)</span>
                    </label>
                    {formDriveLink && (
                      <span className="text-[9px] font-extrabold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                        Configured
                      </span>
                    )}
                  </div>
                  <input 
                    type="url"
                    value={formDriveLink}
                    onChange={(e) => setFormDriveLink(e.target.value)}
                    placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                    className="w-full px-4 py-3 text-xs border border-neutral-200 hover:border-neutral-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 rounded-xl outline-none transition-all placeholder:text-neutral-400 font-mono text-neutral-800"
                  />
                  <p className="text-[9px] text-neutral-400 leading-normal font-medium">
                    💡 Ideal for handwritten notebooks or massive files. Saves critical bandwidth under high load. Ensure folder links are set to <strong>"Anyone with Link can view"</strong>.
                  </p>
                </div>

                {/* File Upload Selector (Requirement 5 &amp; 6) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-sans">
                    Supabase PDF Document {editingResource ? <span className="text-[9px] font-extrabold text-orange-500 italic">(Leave empty to keep existing)</span> : <span className="text-[9px] font-bold text-neutral-400 italic">(Optional if Google Drive alternative link supplied)</span>}
                  </label>
                  
                  {formFile ? (
                    <div className="p-3 bg-orange-50/40 border border-orange-500/20 rounded-xl flex items-center justify-between gap-3 text-xs font-bold text-neutral-805">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={16} className="text-orange-500 shrink-0" />
                        <span className="truncate">{formFile.name}</span>
                        <span className="text-[9px] text-neutral-400 font-mono">({(formFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setFormFile(null)}
                        className="text-red-500 hover:text-red-600 font-black cursor-pointer px-2 py-1 text-[10px] uppercase tracking-wider rounded bg-white hover:bg-red-50 border border-neutral-100"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="border border-dashed border-neutral-200 hover:border-orange-500/35 bg-neutral-50/10 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all select-none relative group">
                      <input 
                        type="file"
                        id="modal-file-picker"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Download size={18} className="text-neutral-400 group-hover:text-orange-500 transition-colors mb-1.5" />
                      <span className="text-xs font-extrabold text-neutral-700">Choose Academic PDF file</span>
                      <span className="text-[9px] text-neutral-450 font-medium">Or drag &amp; drop here</span>
                    </div>
                  )}
                </div>

                {/* Submitting Buttons / Actions */}
                <div className="pt-4 border-t border-neutral-100 flex gap-3 justify-end items-center">
                  {!uploading && (
                    <button 
                      type="button"
                      onClick={() => {
                        setIsAdminModalOpen(false);
                        setEditingResource(null);
                      }}
                      className="px-5 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <button 
                    type="submit"
                    disabled={uploading}
                    className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <Sparkles size={13} className="animate-spin" />
                        Saving configurations...
                      </>
                    ) : (
                      <>
                        <Layers size={13} />
                        {editingResource ? "Save Configurations" : "Publish Resource"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


