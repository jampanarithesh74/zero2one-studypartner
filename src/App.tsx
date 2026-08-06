/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, ChevronDown, Sparkles, ArrowLeft, BookOpen, Clock, Award, FileText, Download, Layers, Shield, LogIn, LogOut, Plus, Trash2, Maximize2, Minimize2, Instagram, ArrowUpRight, Edit2, ExternalLink, RotateCcw, RotateCw, X, Bell, Menu, User as UserIcon, Calendar, Bot, Calculator, Book, TrendingUp, HelpCircle, Check, CheckCircle } from "lucide-react";
import { useState, useEffect, FormEvent, useRef, Fragment } from "react";
import { useLocation, useNavigate, matchPath, Routes, Route } from "react-router-dom";
import { DEPARTMENTS, SYLLABUS_MAP, SUBJECT_DETAILS, SUBJECT_LTP } from "./data/syllabus";
import { auth, db, googleProvider, ALLOWED_ADMIN_EMAILS, handleFirestoreError, OperationType, storage } from "./lib/firebase";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { doc, getDoc, setDoc, collection, addDoc, query, where, onSnapshot, serverTimestamp, deleteDoc, updateDoc, getDocs, writeBatch, Timestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { PDFViewer } from "./components/PDFViewer";
import { ToolsModule } from "./components/ToolsModule";
import { EventsModule } from "./components/EventsModule";
import { PublicEventPage } from "./components/PublicEventPage";
import { EventsListingPage } from "./components/events/EventsListingPage";
import { ParticipantJoinPage } from "./components/events/ParticipantJoinPage";
import { ParticipantOnboardingPage } from "./components/events/ParticipantOnboardingPage";
import { EventRoomPage } from "./components/events/EventRoomPage";
import { ParticipantProfilePage } from "./components/events/ParticipantProfilePage";
import { UnauthorizedAdminPage } from "./components/events/UnauthorizedAdminPage";

type ViewState = "year-selection" | "dept-selection" | "sem-selection" | "choice-selection" | "syllabus-view" | "resources-view" | "onboarding" | "login" | "syllabus-copy-view" | "dashboard" | "profile-page" | "tools-page" | "public-event-page";

export interface UserProfile {
  uid: string;
  email: string;
  batch: string;
  departmentCode: string;
  departmentName: string;
  section: string;
  rollNumber: string;
  selectedUserType: "regular" | "rejoined" | "rejoinee" | "supply";
  effectiveAcademicYear: number;
  onboardingCompleted: boolean;
  createdAt: any;
  lastLogin: any;
  profileVersion: number;
  lastOpenedRoute?: string;
}

export const parseStudentEmail = (email: string) => {
  const regex = /^([0-9]{2})(eg)([0-9]{3})([a-zA-Z])([0-9]{2})@anurag\.edu\.in$/i;
  const match = email.match(regex);
  if (!match) return null;

  const batch = match[1];
  const deptCode = match[3];
  const section = match[4].toUpperCase();
  const rollNumber = match[5];

  const deptMapping: Record<string, string> = {
    "101": "Civil",
    "102": "EEE",
    "104": "ECE",
    "105": "CSE",
    "106": "AI",
    "107": "AIML",
    "109": "CS",
    "110": "Data Science",
    "112": "Information Technology"
  };

  const departmentName = deptMapping[deptCode] || "Unknown Department";

  return {
    batch,
    departmentCode: deptCode,
    departmentName,
    section,
    rollNumber
  };
};

export const FALLBACK_BATCH_YEAR_MAPPING: Record<string, number> = {
  "25": 1,
  "24": 2,
  "23": 3,
  "22": 4
};


export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isRoute404, setIsRoute404] = useState(false);

  const [viewState, setViewState] = useState<ViewState>("year-selection");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedSem, setSelectedSem] = useState<number | null>(null);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [dynamicSubjects, setDynamicSubjects] = useState<any[]>([]);

  // College Login Profile & Settings States
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [tempParsedProfile, setTempParsedProfile] = useState<{
    email: string;
    batch: string;
    departmentCode: string;
    departmentName: string;
    section: string;
    rollNumber: string;
  } | null>(null);
  const [academicSettings, setAcademicSettings] = useState<{ batchYearMapping: Record<string, number> }>({
    batchYearMapping: FALLBACK_BATCH_YEAR_MAPPING
  });

  // Helper: Resolve department case/abbreviation-insensitively
  const resolveDepartment = (deptUri: string | undefined): string | null => {
    if (!deptUri) return null;
    const decoded = decodeURIComponent(deptUri).trim();
    if (DEPARTMENTS.includes(decoded)) return decoded;
    const cleanUri = decoded.toLowerCase().replace(/[-_]/g, " ");
    const found = DEPARTMENTS.find(d => {
      const cleanD = d.toLowerCase();
      const upperUri = decoded.toUpperCase();
      return cleanD === cleanUri || 
             cleanD.startsWith(cleanUri) || 
             cleanUri.startsWith(cleanD) ||
             (upperUri === "CSE" && d === "Computer Science and Engineering") ||
             (upperUri === "CS" && d === "Computer Science and Engineering") ||
             (upperUri === "IT" && d === "Information Technology") ||
             (upperUri === "AI" && d === "Artificial Intelligence") ||
             (upperUri === "AIML" && d === "AI & Machine Learning") ||
             (upperUri === "DATA SCIENCE" && d === "CSE (Data Science)") ||
             (upperUri === "CYBER SECURITY" && d === "CSE (Cyber Security)") ||
             (upperUri === "EEE" && d === "Electrical & Electronics Engineering") ||
             (upperUri === "ECE" && d === "Electronics & Communication Engineering") ||
             (upperUri === "ME" && d === "Mechanical Engineering") ||
             (upperUri === "CE" && d === "Civil Engineering");
    });
    return found || null;
  };

  // Helper: Look up static or dynamic syllabus subject by customized code
  const findSubjectByCode = (code: string | undefined) => {
    if (!code) return null;
    const upperCode = code.toUpperCase();
    
    // 1. Search in main static SYLLABUS_MAP first to find exact department and semester
    for (const dept in SYLLABUS_MAP) {
      for (const sem in SYLLABUS_MAP[dept]) {
        const sub = SYLLABUS_MAP[dept][sem].find(s => s.code === upperCode);
        if (sub) {
          const detail = (SUBJECT_DETAILS[upperCode] || {}) as any;
          return {
            code: upperCode,
            title: sub.title || detail.title || "Subject",
            isStatic: true,
            semester: Number(sem),
            department: dept,
            ...detail
          };
        }
      }
    }

    // 2. Search in fallback syllabus lists
    for (const dept of DEPARTMENTS) {
      for (let sem = 3; sem <= 8; sem++) {
        const fallbacks = getFallbackSyllabusList(dept, sem);
        const sub = fallbacks.find(s => s.code === upperCode);
        if (sub) {
          const detail = (SUBJECT_DETAILS[upperCode] || {}) as any;
          return {
            code: upperCode,
            title: sub.title || detail.title || "Subject",
            isStatic: true,
            semester: sem,
            department: dept,
            ...detail
          };
        }
      }
    }

    // 3. Search in SUBJECT_DETAILS directly as fallback
    if (SUBJECT_DETAILS[upperCode]) {
      return {
        code: upperCode,
        title: SUBJECT_DETAILS[upperCode].title,
        isStatic: true,
        ...SUBJECT_DETAILS[upperCode]
      };
    }

    // 4. Search in dynamic subjects from Firestore
    const dyn = dynamicSubjects.find(s => s.subjectCode === upperCode || s.code === upperCode || s.id === upperCode);
    if (dyn) {
      return {
        code: upperCode,
        title: dyn.title || dyn.subjectName || "Custom Subject",
        isStatic: false,
        semester: dyn.semester,
        department: dyn.linked_departments?.[0] || selectedDept
      };
    }
    return null;
  };

  // URL State Synchronizer Effect
  useEffect(() => {
    const handleUrlSync = () => {
      const pathname = location.pathname;

      // 0. Matches `/semester/:dept/:sem/syllabus-copy`
      const matchSyllabusCopy = matchPath("/semester/:dept/:sem/syllabus-copy", pathname);
      if (matchSyllabusCopy) {
        setIsRoute404(false);
        const resolvedDept = resolveDepartment(matchSyllabusCopy.params.dept);
        const semNum = Number(matchSyllabusCopy.params.sem);
        if (resolvedDept && (semNum >= 1 && semNum <= 8)) {
          setSelectedDept(resolvedDept);
          setSelectedSem(semNum);
          setSelectedYear(Math.ceil(semNum / 2));
          setActiveSubject(null);
          setViewState("syllabus-copy-view");
        } else {
          navigate(`/department/${matchSyllabusCopy.params.dept || "select"}`, { replace: true });
        }
        return;
      }

      // 1. Matches `/subject/:subjectCode/resources`
      const matchSubNotes = matchPath("/subject/:subjectCode/resources", pathname);
      if (matchSubNotes) {
        setIsRoute404(false);
        const rawCode = matchSubNotes.params.subjectCode;
        if (rawCode === "all") {
          setActiveSubject(null);
          setExpandedUnit(null);
          setViewState("resources-view");
          setResourceTab("notes");
          return;
        }
        const found = findSubjectByCode(rawCode);
        if (found) {
          setSelectedDept(found.department || selectedDept);
          setSelectedSem(found.semester || selectedSem);
          setActiveSubject(found.code);
          setViewState("resources-view");
          setResourceTab("notes");
        } else {
          setActiveSubject(rawCode.toUpperCase());
          setViewState("resources-view");
        }
        return;
      }

      // 2. Matches `/subject/:subjectCode/pyqs`
      const matchSubPyqs = matchPath("/subject/:subjectCode/pyqs", pathname);
      if (matchSubPyqs) {
        setIsRoute404(false);
        const rawCode = matchSubPyqs.params.subjectCode;
        if (rawCode === "all") {
          setActiveSubject(null);
          setExpandedUnit(null);
          setViewState("resources-view");
          setResourceTab("pyqs");
          return;
        }
        const found = findSubjectByCode(rawCode);
        if (found) {
          setSelectedDept(found.department || selectedDept);
          setSelectedSem(found.semester || selectedSem);
          setActiveSubject(found.code);
          setViewState("resources-view");
          setResourceTab("pyqs");
        } else {
          setActiveSubject(rawCode.toUpperCase());
          setViewState("resources-view");
        }
        return;
      }

      // 3. Matches `/subject/:subjectCode`
      const matchSubSyllabus = matchPath("/subject/:subjectCode", pathname);
      if (matchSubSyllabus) {
        setIsRoute404(false);
        const rawCode = matchSubSyllabus.params.subjectCode;
        const found = findSubjectByCode(rawCode);
        if (found) {
          setSelectedDept(found.department || selectedDept);
          setSelectedSem(found.semester || selectedSem);
          setActiveSubject(found.code);
          setViewState("syllabus-view");
        } else {
          setActiveSubject(rawCode.toUpperCase());
          setViewState("syllabus-view");
        }
        return;
      }

      // 4. Matches `/semester/:dept/:sem`
      const matchSemester = matchPath("/semester/:dept/:sem", pathname);
      if (matchSemester) {
        setIsRoute404(false);
        const resolvedDept = resolveDepartment(matchSemester.params.dept);
        const semNum = Number(matchSemester.params.sem);
        if (resolvedDept && (semNum >= 1 && semNum <= 8)) {
          setSelectedDept(resolvedDept);
          setSelectedSem(semNum);
          setSelectedYear(Math.ceil(semNum / 2));
          setActiveSubject(null);
          setExpandedUnit(null);
          setViewState("choice-selection");
        } else {
          navigate(`/department/${matchSemester.params.dept || "select"}`, { replace: true });
        }
        return;
      }

      // 4.5. Matches `/year/:year/department/:dept`
      const matchYearDept = matchPath("/year/:year/department/:dept", pathname);
      if (matchYearDept) {
        setIsRoute404(false);
        const yr = Number(matchYearDept.params.year);
        const deptParam = matchYearDept.params.dept;
        if (yr >= 1 && yr <= 4) {
          setSelectedYear(yr);
          if (deptParam === "select" || deptParam === "all") {
            setSelectedDept(null);
            setViewState("dept-selection");
          } else {
            const resolvedDept = resolveDepartment(deptParam);
            if (resolvedDept) {
              setSelectedDept(resolvedDept);
              setSelectedSem(null);
              setActiveSubject(null);
              setExpandedUnit(null);
              setViewState("sem-selection");
            } else {
              setViewState("dept-selection");
            }
          }
        } else {
          navigate("/", { replace: true });
        }
        return;
      }

      // 5. Matches `/department/:dept`
      const matchDept = matchPath("/department/:dept", pathname);
      if (matchDept) {
        setIsRoute404(false);
        const dParam = matchDept.params.dept;
        if (dParam === "select" || dParam === "all") {
          setViewState("dept-selection");
          return;
        }
        const resolvedDept = resolveDepartment(dParam);
        if (resolvedDept) {
          setSelectedDept(resolvedDept);
          setSelectedSem(null);
          setActiveSubject(null);
          setExpandedUnit(null);
          setViewState("sem-selection");
        } else {
          setViewState("dept-selection");
        }
        return;
      }

      // 6. Matches `/year/:year`
      const matchYear = matchPath("/year/:year", pathname);
      if (matchYear) {
        setIsRoute404(false);
        const yr = Number(matchYear.params.year);
        if (yr >= 1 && yr <= 4) {
          setSelectedYear(yr);
          setViewState("year-selection");
        } else {
          navigate("/", { replace: true });
        }
        return;
      }

      // 6.5. Matches `/dashboard`
      const matchDashboard = matchPath("/dashboard", pathname);
      if (matchDashboard) {
        setIsRoute404(false);
        setViewState("dashboard");
        return;
      }

      // 6.7. Matches `/profile`
      const matchProfile = matchPath("/profile", pathname);
      if (matchProfile) {
        setIsRoute404(false);
        setViewState("profile-page");
        return;
      }

      // 6.8. Matches `/tools`
      const matchTools = matchPath("/tools", pathname);
      if (matchTools) {
        setIsRoute404(false);
        setViewState("tools-page");
        return;
      }

      // 6.9. Matches `/events` or any subroutes like `/events/*`
      if (pathname.startsWith("/events")) {
        setIsRoute404(false);
        return;
      }

      // 7. Matches `/`
      const matchRoot = matchPath("/", pathname);
      if (matchRoot) {
        setIsRoute404(false);
        if (userProfile) {
          setViewState("dashboard");
        } else {
          setViewState("year-selection");
        }
        return;
      }

      // 8. Error fallback
      setIsRoute404(true);
    };

    handleUrlSync();
  }, [location.pathname, dynamicSubjects, selectedDept, userProfile]);
  const [resourceTab, setResourceTab] = useState<"notes" | "pyqs">("notes");
  const [expandedUnit, setExpandedUnit] = useState<number | null>(null);
  const [expandedSyllabusSubject, setExpandedSyllabusSubject] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeLoading, setIframeLoading] = useState<boolean>(false);
  const [fullscreenIframeLoading, setFullscreenIframeLoading] = useState<boolean>(false);

  // Auth & Admin State
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(true);



  // Onboarding Selection State
  const [selectedStatus, setSelectedStatus] = useState<"regular" | "rejoined" | "supply" | null>(null);
  const [rejoinedStudyYear, setRejoinedStudyYear] = useState<number | null>(null);
  const [supplyPrepYear, setSupplyPrepYear] = useState<number | null>(null);
  const [academicMode, setAcademicMode] = useState<"regular" | "rejoinee" | "supply" | null>(null);
  const [subStep, setSubStep] = useState<"mode" | "year" | "sem">("mode");
  const [toolsSubView, setToolsSubView] = useState<"menu" | "sgpa" | "cgpa">("menu");

  // Firestore Data State
  const [uploadedResources, setUploadedResources] = useState<any[]>([]);
  
  // Normalization Panel Hub States
  const [isNormPanelOpen, setIsNormPanelOpen] = useState(false);
  const [normStatus, setNormStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [normLogs, setNormLogs] = useState<string[]>([]);
  
  // Subject Manager Edit state
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [subjectFormCode, setSubjectFormCode] = useState("");
  const [subjectFormName, setSubjectFormName] = useState("");
  const [subjectFormSem, setSubjectFormSem] = useState<number>(1);
  const [subjectFormDepts, setSubjectFormDepts] = useState<string[]>([]);
  const [subjectFormSemMapping, setSubjectFormSemMapping] = useState<Record<string, number>>({});
  const [subjectFormCredits, setSubjectFormCredits] = useState<number>(4);
  const [subjectFormTheoryCredits, setSubjectFormTheoryCredits] = useState<number>(3);
  const [subjectFormLabCredits, setSubjectFormLabCredits] = useState<number>(1);
  const [subjectFormType, setSubjectFormType] = useState<string>("PC");
  const [subjectFormError, setSubjectFormError] = useState("");
  const [subjectFormSaving, setSubjectFormSaving] = useState(false);

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

  // Notifications & Announcements State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("dismissedNotifications") || "[]");
    } catch {
      return [];
    }
  });

  // Toast overlay state
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" } | null>(null);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);

  const showToast = (message: string, type: "info" | "success" = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Admin Announcement Form State
  const [activeAdminTab, setActiveAdminTab] = useState<"norm" | "notifications" | "ai_syllabus" | "events">("norm");
  const [aiSelectedDept, setAiSelectedDept] = useState<string>(DEPARTMENTS[0]);
  const [aiSelectedSem, setAiSelectedSem] = useState<number>(1);
  const [aiIsParsing, setAiIsParsing] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>("");
  const [aiSubjects, setAiSubjects] = useState<any[] | null>(null);
  const [aiIsSaving, setAiIsSaving] = useState<boolean>(false);
  const [aiSaveProgress, setAiSaveProgress] = useState<string>("");
  const [aiCurrentExpandedIdx, setAiCurrentExpandedIdx] = useState<number | null>(null);

  const [notifTitle, setNotifTitle] = useState("");
  const [notifDescription, setNotifDescription] = useState("");
  const [notifType, setNotifType] = useState<"text" | "image" | "link">("text");
  const [notifImageSource, setNotifImageSource] = useState<"upload" | "url">("upload");
  const [notifImageUrl, setNotifImageUrl] = useState("");
  const [notifFile, setNotifFile] = useState<File | null>(null);
  const [notifButtonText, setNotifButtonText] = useState("");
  const [notifButtonUrl, setNotifButtonUrl] = useState("");
  const [notifPriority, setNotifPriority] = useState<"low" | "medium" | "high">("medium");
  const [notifExpiresAt, setNotifExpiresAt] = useState("");
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifError, setNotifError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // In-session query cache references and change tracker versions to prevent duplicate database reads
  const subjectsCacheRef = useRef<Record<string, any[]>>({});
  const resourcesCacheRef = useRef<Record<string, any[]>>({});
  const [subjectVersion, setSubjectVersion] = useState<number>(0);
  const [resourceVersion, setResourceVersion] = useState<number>(0);

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
        const email = user.email || "";
        const isAdminEmail = ALLOWED_ADMIN_EMAILS.includes(email);
        const isValidDomain = email.endsWith("@anurag.edu.in") || isAdminEmail;

        if (!isValidDomain) {
          setAuthError("Access Denied: Only student emails ending with @anurag.edu.in are permitted access.");
          await signOut(auth);
          setUser(null);
          setIsAdmin(false);
          setUserProfile(null);
          setShowLoginModal(true);
          setIsLoadingAuth(false);
          return;
        }

        setAuthError(null);

        // Check if user is in admins collection (by uid or email document)
        let isCurrentUserAdmin = false;
        try {
          const adminUidDoc = await getDoc(doc(db, "admins", user.uid));
          let adminEmailDoc = null;
          if (user.email) {
            try {
              adminEmailDoc = await getDoc(doc(db, "admins", user.email));
            } catch (e) {
              // Ignore if email path document not found
            }
          }

          if (
            adminUidDoc.exists() || 
            (adminEmailDoc && adminEmailDoc.exists()) || 
            ALLOWED_ADMIN_EMAILS.includes(user.email || "")
          ) {
            setIsAdmin(true);
            isCurrentUserAdmin = true;
          } else {
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          if (ALLOWED_ADMIN_EMAILS.includes(user.email || "")) {
            setIsAdmin(true);
            isCurrentUserAdmin = true;
          } else {
            setIsAdmin(false);
          }
        }

        if (isCurrentUserAdmin) {
          setUserProfile(null);
          setShowLoginModal(false);
          setIsLoadingAuth(false);
          navigate("/");
          return;
        }

        // Fetch user profile from users collection
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setUserProfile(profile);
            
            // Sync last login
            await updateDoc(userDocRef, {
              lastLogin: serverTimestamp()
            });

            const currentPath = window.location.pathname;
            setShowLoginModal(false);
            if (currentPath === "/" || currentPath === "/login" || currentPath === "") {
              navigate("/dashboard");
            }
          } else {
            // No profile found! Parse student email
            const parsed = parseStudentEmail(email);
            let pDept = "Computer Science and Engineering";
            let pDeptCode = "105";
            let pBatch = "25";
            let pSection = "A";
            let pRoll = "01";
            if (parsed) {
              pDept = parsed.departmentName;
              pDeptCode = parsed.departmentCode;
              pBatch = parsed.batch;
              pSection = parsed.section;
              pRoll = parsed.rollNumber;
            }

            const batchYearMapping = academicSettings?.batchYearMapping || FALLBACK_BATCH_YEAR_MAPPING;
            const effectiveAcademicYear = batchYearMapping[pBatch] || 1;
            const targetRoute = `/year/${effectiveAcademicYear}/department/${encodeURIComponent(pDept)}`;

            const profileData: UserProfile = {
              uid: user.uid,
              email: email,
              batch: pBatch,
              departmentCode: pDeptCode,
              departmentName: pDept,
              section: pSection,
              rollNumber: pRoll,
              selectedUserType: "regular",
              effectiveAcademicYear: effectiveAcademicYear,
              onboardingCompleted: true,
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
              profileVersion: 1,
              lastOpenedRoute: targetRoute
            };

            await setDoc(doc(db, "users", user.uid), profileData);
            setUserProfile(profileData);
            setShowLoginModal(false);
            navigate("/dashboard");
          }
        } catch (err) {
          console.error("Error fetching student profile:", err);
        }
      } else {
        setIsAdmin(false);
        setUserProfile(null);
      }
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Watch academic batch mapping settings
  useEffect(() => {
    const docRef = doc(db, "academic_settings", "default");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.batchYearMapping) {
          setAcademicSettings({ batchYearMapping: data.batchYearMapping });
        }
      } else {
        // Safe bootstrapping of settings if the page is running in a fresh workspace
        if (isAdmin) {
          setDoc(docRef, {
            batchYearMapping: FALLBACK_BATCH_YEAR_MAPPING
          }).catch(err => console.error("Failed to seed academic_settings/default:", err));
        }
      }
    }, (error) => {
      console.error("Error playing academic_settings listener:", error);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  // Sync user profile effective academic year when academic settings change or load
  useEffect(() => {
    if (user && userProfile && academicSettings?.batchYearMapping) {
      const batchCode = userProfile.batch;
      if (batchCode) {
        const expectedYear = academicSettings.batchYearMapping[batchCode] || FALLBACK_BATCH_YEAR_MAPPING[batchCode] || 1;
        if (expectedYear !== userProfile.effectiveAcademicYear) {
          console.log(`Auto-syncing outdated Year ${userProfile.effectiveAcademicYear} to updated Year ${expectedYear} for batch ${batchCode}`);
          
          // Update local state to keep the UI in sync
          setUserProfile(prev => prev ? {
            ...prev,
            effectiveAcademicYear: expectedYear
          } : null);

          // Update the document in Firestore users collection
          const userDocRef = doc(db, "users", user.uid);
          updateDoc(userDocRef, {
            effectiveAcademicYear: expectedYear
          }).catch(err => {
            console.error("Error auto-syncing expected academic year in Firestore:", err);
          });
        }
      }
    }
  }, [user, userProfile?.effectiveAcademicYear, userProfile?.batch, academicSettings?.batchYearMapping]);

  // Synchronize academicMode state with userProfile.selectedUserType
  useEffect(() => {
    if (userProfile?.selectedUserType) {
      if (userProfile.selectedUserType === "regular") {
        setAcademicMode("regular");
      } else if (userProfile.selectedUserType === "rejoinee" || userProfile.selectedUserType === "rejoined") {
        setAcademicMode("rejoinee");
      } else if (userProfile.selectedUserType === "supply") {
        setAcademicMode("supply");
      }
    } else {
      setAcademicMode(null);
    }
  }, [userProfile?.selectedUserType]);

  // Track and save lastOpenedRoute to database
  useEffect(() => {
    if (user && userProfile && userProfile.onboardingCompleted) {
      const path = location.pathname;
      if (path && path !== "/" && path !== "/login" && path !== "/onboarding" && !path.startsWith("/login")) {
        const userDocRef = doc(db, "users", user.uid);
        updateDoc(userDocRef, {
          lastOpenedRoute: path
        }).catch(err => console.error("Error saving lastOpenedRoute:", err));
      }
    }
  }, [location.pathname, user, userProfile]);

  // Fetch global announcements in real time
  useEffect(() => {
    // If the user is an admin they can see all notifications including muted/inactive ones for management.
    // If they are a normal user, we restrict the Firestore query to active == true.
    const q = isAdmin 
      ? query(collection(db, "notifications"))
      : query(collection(db, "notifications"), where("active", "==", true));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        };
      });
      setNotifications(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "notifications");
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const activeNotifications = notifications.filter(notif => {
    // 0. Filter out inactive ones for regular users
    if (!notif.active) return false;

    // 1. Filter out if dismissed locally by this user
    if (dismissedIds.includes(notif.id)) return false;

    // 2. Filter out if expired
    if (notif.expiresAt) {
      const expiryDate = notif.expiresAt.toDate ? notif.expiresAt.toDate() : new Date(notif.expiresAt);
      if (new Date() > expiryDate) return false;
    }

    return true;
  }).sort((a, b) => {
    // 3. Sort high -> medium -> low, then createdAt dec
    const weights: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const wA = weights[a.priority] || 1;
    const wB = weights[b.priority] || 1;

    if (wA !== wB) return wB - wA;

    const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return tB - tA;
  });

  const handleDismissNotification = (id: string) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    localStorage.setItem("dismissedNotifications", JSON.stringify(updated));
  };

  const handlePublishNotification = async (e: FormEvent) => {
    e.preventDefault();
    if (!notifTitle || !notifDescription) {
      setNotifError("Please fill out all required fields.");
      return;
    }

    if (notifType === "image") {
      if (notifImageSource === "url" && !notifImageUrl.trim()) {
        setNotifError("Please specify a valid image URL.");
        return;
      }
      if (notifImageSource === "upload" && !notifFile) {
        setNotifError("Please select an image file to upload.");
        return;
      }
    }

    setNotifSaving(true);
    setNotifError("");
    setUploadProgress(null);

    try {
      let imageUrl = "";

      // Handle image input
      if (notifType === "image") {
        if (notifImageSource === "url") {
          imageUrl = notifImageUrl.trim();
        } else if (notifImageSource === "upload" && notifFile) {
          setUploadProgress(0);
          const fileExtension = notifFile.name.split(".").pop();
          const storagePath = `notifications/images/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExtension}`;
          const imageRef = storageRef(storage, storagePath);
          
          const uploadTask = uploadBytesResumable(imageRef, notifFile);

          imageUrl = await new Promise<string>((resolve, reject) => {
            // Set up a safeguard timeout (e.g. 15 seconds) so it doesn't spin infinitely if Storage is blocked/unconfigured
            const timer = setTimeout(() => {
              uploadTask.cancel();
              reject(new Error("Upload timed out (15s). Browser sandbox may be blocking direct Firebase Storage uploads (CORS). Please use the 'Direct Image URL' option instead!"));
            }, 15000);

            uploadTask.on(
              "state_changed",
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(Math.round(progress));
              },
              (error) => {
                clearTimeout(timer);
                reject(error);
              },
              async () => {
                clearTimeout(timer);
                try {
                  const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                  resolve(downloadUrl);
                } catch (err) {
                  reject(err);
                }
              }
            );
          });
        }
      }

      // Add to Firestore notifications/ collection
      await addDoc(collection(db, "notifications"), {
        title: notifTitle,
        description: notifDescription,
        type: notifType,
        imageUrl: imageUrl || null,
        buttonText: notifButtonText || null,
        buttonUrl: notifButtonUrl || null,
        priority: notifPriority,
        active: true,
        createdAt: serverTimestamp(),
        expiresAt: notifExpiresAt ? Timestamp.fromDate(new Date(`${notifExpiresAt}T23:59:59`)) : null
      });

      // Clear Form state values
      setNotifTitle("");
      setNotifDescription("");
      setNotifType("text");
      setNotifImageSource("upload");
      setNotifImageUrl("");
      setNotifFile(null);
      setNotifButtonText("");
      setNotifButtonUrl("");
      setNotifPriority("medium");
      setNotifExpiresAt("");
      setNotifError("");
    } catch (err: any) {
      console.error(err);
      setNotifError(err.message || "Failed to publish announcement.");
    } finally {
      setNotifSaving(false);
      setUploadProgress(null);
    }
  };

  const handleToggleActiveNotification = async (id: string, currentActive: boolean) => {
    try {
      await updateDoc(doc(db, "notifications", id), {
        active: !currentActive
      });
    } catch (e: any) {
      console.error(e);
      alert("Error toggling active state: " + e.message);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this announcement?")) return;
    try {
      await deleteDoc(doc(db, "notifications", id));
    } catch (e: any) {
      console.error(e);
      alert("Error deleting announcement: " + e.message);
    }
  };

  const getStaticSemesterForSubject = (dept: string, code: string): number | null => {
    const deptSyllabus = SYLLABUS_MAP[dept];
    if (!deptSyllabus) return null;
    const upperCode = code.toUpperCase().trim();
    for (const [semStr, subjects] of Object.entries(deptSyllabus)) {
      if (subjects.some(s => s.code.toUpperCase().trim() === upperCode)) {
        return parseInt(semStr);
      }
    }
    return null;
  };

  // Fetch dynamic subjects from Firestore with in-session caching and semester-level query filtering
  useEffect(() => {
    let isMounted = true;
    if (selectedDept && selectedSem) {
      const cacheKey = `${selectedDept}_${selectedSem}`;

      // Bypasses cache for admin role so they always manage real data
      if (subjectsCacheRef.current[cacheKey] && !isAdmin) {
        setDynamicSubjects(subjectsCacheRef.current[cacheKey]);
        return;
      }

      const fetchSubjects = async () => {
        try {
          const q = query(
            collection(db, "subjects"),
            where("linked_departments", "array-contains", selectedDept)
          );
          const snapshot = await getDocs(q);
          const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
          
          // Re-apply client-side semester filtering to handle semester shifting smoothly
          const filteredList = list.filter(sub => {
            const code = sub.subjectCode || sub.id || "";
            if (sub.semester_mapping && typeof sub.semester_mapping === "object" && sub.semester_mapping[selectedDept] !== undefined) {
              return sub.semester_mapping[selectedDept] === selectedSem;
            }
            const staticSem = getStaticSemesterForSubject(selectedDept, code);
            if (staticSem !== null) {
              return staticSem === selectedSem;
            }
            return sub.semester === selectedSem;
          });

          if (isMounted) {
            subjectsCacheRef.current[cacheKey] = filteredList;
            setDynamicSubjects(filteredList);
          }
        } catch (error: any) {
          console.error("Error fetching subjects:", error);
          if (isMounted) {
            handleFirestoreError(error, OperationType.LIST, "subjects");
          }
        }
      };

      fetchSubjects();
    } else {
      setDynamicSubjects([]);
    }

    return () => {
      isMounted = false;
    };
  }, [selectedDept, selectedSem, isAdmin, subjectVersion]);

  // Fetch resources based on active subject selection with in-session caching
  useEffect(() => {
    let isMounted = true;
    if (viewState === "resources-view" && activeSubject) {
      
      if (resourcesCacheRef.current[activeSubject] && !isAdmin) {
        setUploadedResources(resourcesCacheRef.current[activeSubject]);
        return;
      }

      const fetchResources = async () => {
        try {
          const q = query(
            collection(db, "resources"),
            where("subjectCode", "==", activeSubject)
          );
          const snapshot = await getDocs(q);
          const resources = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          if (isMounted) {
            resourcesCacheRef.current[activeSubject] = resources;
            setUploadedResources(resources);
          }
        } catch (error: any) {
          console.error("Error fetching resources:", error);
          if (isMounted) {
            handleFirestoreError(error, OperationType.LIST, "resources");
          }
        }
      };

      fetchResources();
    } else if (!activeSubject) {
      setUploadedResources([]);
    }

    return () => {
      isMounted = false;
    };
  }, [viewState, activeSubject, isAdmin, resourceVersion]);

  function getFallbackSyllabusList(dept: string, sem: number): any[] {
    if (sem < 3 || sem > 8) {
      return [];
    }

    const isComputing = dept.includes("Computer") || 
                        dept.includes("Information Technology") || 
                        dept.includes("Artificial Intelligence") || 
                        dept.includes("Data Science") || 
                        dept.includes("Cyber") || 
                        dept.includes("Computer Engineering");

    const isECE = dept.includes("Electronics");
    const isEEE = dept.includes("Electrical");
    const isCivil = dept.includes("Civil");
    const isMech = dept.includes("Mechanical");

    if (isComputing) {
      if (sem === 3) {
        return [
          { code: "EMA2101", title: "Discrete Mathematical Structures", credits: 3, type: "BS" },
          { code: "EMA2103", title: "Advanced Data Structures and Algorithms", credits: 4, type: "PC" },
          { code: "EMA2104", title: "Object Oriented Programming through Java", credits: 4, type: "PC" },
          { code: "EMA2116", title: (dept.includes("Artificial") || dept.includes("Data Science")) ? "Artificial Intelligence & Knowledge Representation" : "Database Management Systems", credits: 4, type: "PC" },
          { code: "EMA2120", title: "Python Programming & Data Analytics", credits: 3, type: "PC" },
          { code: "EMD2X01", title: "Computer Oriented Statistical Methods", credits: 3, type: "BS" },
          { code: "EVA2101", title: "Integrated Project - I", credits: 1, type: "PC" }
        ];
      }
      if (sem === 4) {
        return [
          { code: "EMA2201", title: "Operating Systems", credits: 3, type: "PC" },
          { code: "EMA2202", title: "Design and Analysis of Algorithms", credits: 3, type: "PC" },
          { code: "EMA2204", title: (dept.includes("Artificial") || dept.includes("Data Science")) ? "Database Management Systems" : "Computer Networks", credits: 4, type: "PC" },
          { code: "EMA2215", title: (dept.includes("Artificial") || dept.includes("Data Science")) ? "Essentials of Machine Learning" : dept.includes("Cyber") ? "Principles of Cyber Security" : "Formal Languages and Automata Theory", credits: 4, type: "PC" },
          { code: "EMA2205", title: "Software Engineering & Agile Methodologies", credits: 3, type: "PC" },
          { code: "EAE2221", title: "Effective English Communication & Employability Skills", credits: 2, type: "HS" },
          { code: "EVA2201", title: "Integrated Project - II", credits: 1, type: "PC" },
          { code: "INT2201", title: "Summer Internship / Certification", credits: 0, type: "IN" }
        ];
      }
      if (sem === 5) {
        return [
          { code: "EMA3101", title: "Computer Networks & Distributed Systems", credits: 3, type: "PC" },
          { code: "EMA3102", title: "Compiler Design", credits: 4, type: "PC" },
          { code: "EMA3103", title: "Software Quality Assurance & Cloud Engineering", credits: 3, type: "PC" },
          { code: "EMA3104", title: (dept.includes("Artificial") || dept.includes("Data Science")) ? "Deep Learning Foundations" : dept.includes("Cyber") ? "Cryptography & Network Security" : "Web Technologies & Systems", credits: 4, type: "PC" },
          { code: "EMA3140", title: "Professional Elective - I", credits: 3, type: "PE" },
          { code: "EMA3180", title: "Open Elective - I", credits: 3, type: "OE" },
          { code: "EVA3101", title: "Integrated Project - III", credits: 1, type: "PC" }
        ];
      }
      if (sem === 6) {
        return [
          { code: "EMA3201", title: (dept.includes("Artificial") || dept.includes("Data Science")) ? "Natural Language Processing" : dept.includes("Cyber") ? "Ethical Hacking & Penetration Testing" : "Cloud Computing Architectures", credits: 4, type: "PC" },
          { code: "EMA3202", title: "Data Warehousing & Data Mining Technologies", credits: 3, type: "PC" },
          { code: "EMA3203", title: "Mobile Application Development using Kotlin", credits: 3, type: "PC" },
          { code: "EMA3240", title: "Professional Elective - II", credits: 3, type: "PE" },
          { code: "EMA3250", title: "Professional Elective - III", credits: 3, type: "PE" },
          { code: "EMA3280", title: "Open Elective - II", credits: 3, type: "OE" },
          { code: "EVA3201", title: "Technical Seminar & Industrial Certification", credits: 1, type: "PC" }
        ];
      }
      if (sem === 7) {
        return [
          { code: "EMA4101", title: (dept.includes("Artificial") || dept.includes("Data Science")) ? "Reinforcement Learning & Big Data System" : "Information Security Foundations", credits: 4, type: "PC" },
          { code: "EMA4102", title: "Managerial Economics & Financial Analysis", credits: 3, type: "HS" },
          { code: "EMA4140", title: "Professional Elective - IV", credits: 3, type: "PE" },
          { code: "EMA4150", title: "Professional Elective - V", credits: 3, type: "PE" },
          { code: "EMA4180", title: "Open Elective - III", credits: 3, type: "OE" },
          { code: "EVA4101", title: "Major Project Phase - I", credits: 2, type: "PC" },
          { code: "INT4101", title: "Industrial Summer Internship", credits: 1, type: "PC" }
        ];
      }
      if (sem === 8) {
        return [
          { code: "EMA4240", title: "Professional Elective - VI", credits: 3, type: "PE" },
          { code: "EMA4280", title: "Open Elective - IV", credits: 3, type: "OE" },
          { code: "EVA4201", title: "Major Project Phase - II / Industrial Project Implementation", credits: 8, type: "PC" }
        ];
      }
    }

    if (isECE) {
      if (sem === 3) {
        return [
          { code: "ECE2101", title: "Electronic Devices & Circuits", credits: 3, type: "PC" },
          { code: "ECE2102", title: "Digital System Design", credits: 3, type: "PC" },
          { code: "ECE2103", title: "Signals & Systems", credits: 4, type: "PC" },
          { code: "ECE2104", title: "Network Theory", credits: 3, type: "PC" },
          { code: "ECE2105", title: "Probability Theory & Stochastic Processes", credits: 3, type: "BS" },
          { code: "ECE2106", title: "Electronic Devices & Circuits Lab", credits: 1.5, type: "PC" },
          { code: "ECE2107", title: "Basic Simulation Lab", credits: 1.5, type: "PC" },
          { code: "EVA2101", title: "Integrated Project - I", credits: 1, type: "PC" }
        ];
      }
      if (sem === 4) {
        return [
          { code: "ECE2201", title: "Analog Circuit Analysis", credits: 4, type: "PC" },
          { code: "ECE2202", title: "Electromagnetic Fields & Transmission Lines", credits: 4, type: "PC" },
          { code: "ECE2203", title: "Analog and Digital Communications", credits: 4, type: "PC" },
          { code: "ECE2204", title: "Linear IC Applications", credits: 3, type: "PC" },
          { code: "ECE2205", title: "Switching Theory & Logic Design", credits: 3, type: "PC" },
          { code: "EAE2221", title: "English through Theatre Arts", credits: 2, type: "HS" },
          { code: "EVA2201", title: "Integrated Project - II", credits: 1, type: "PC" }
        ];
      }
      if (sem === 5) {
        return [
          { code: "ECE3101", title: "Microprocessors & Microcontrollers", credits: 4, type: "PC" },
          { code: "ECE3102", title: "Digital Signal Processing", credits: 4, type: "PC" },
          { code: "ECE3103", title: "Antennas & Wave Propagation", credits: 4, type: "PC" },
          { code: "ECE3140", title: "Professional Elective - I", credits: 3, type: "PE" },
          { code: "ECE3180", title: "Open Elective - I", credits: 3, type: "OE" },
          { code: "EVA3101", title: "Integrated Project - III", credits: 1, type: "PC" }
        ];
      }
      if (sem === 6) {
        return [
          { code: "ECE3201", title: "Microcontrollers & Embedded Systems", credits: 4, type: "PC" },
          { code: "ECE3202", title: "VLSI Design & Technology", credits: 4, type: "PC" },
          { code: "ECE3203", title: "Microwave Engineering & Optical Communications", credits: 4, type: "PC" },
          { code: "ECE3240", title: "Professional Elective - II", credits: 3, type: "PE" },
          { code: "ECE3250", title: "Professional Elective - III", credits: 3, type: "PE" },
          { code: "ECE3280", title: "Open Elective - II", credits: 3, type: "OE" },
          { code: "EVA3201", title: "Technical Seminar & Project", credits: 1, type: "PC" }
        ];
      }
      if (sem === 7) {
        return [
          { code: "ECE4101", title: "Wireless & Mobile Communications", credits: 3, type: "PC" },
          { code: "ECE4102", title: "Radar Systems & Satellite Communications", credits: 3, type: "PC" },
          { code: "ECE4140", title: "Professional Elective - IV", credits: 3, type: "PE" },
          { code: "ECE4150", title: "Professional Elective - V", credits: 3, type: "PE" },
          { code: "ECE4180", title: "Open Elective - III", credits: 3, type: "OE" },
          { code: "EVA4101", title: "Major Project Phase - I", credits: 2, type: "PC" },
          { code: "INT4101", title: "Summer Internship", credits: 1, type: "PC" }
        ];
      }
      if (sem === 8) {
        return [
          { code: "ECE4240", title: "Professional Elective - VI", credits: 3, type: "PE" },
          { code: "ECE4280", title: "Open Elective - IV", credits: 3, type: "OE" },
          { code: "EVA4201", title: "Major Project Phase - II", credits: 8, type: "PC" }
        ];
      }
    }

    if (isEEE) {
      if (sem === 3) {
        return [
          { code: "EEE2101", title: "Numerical Techniques & Complex Variables", credits: 3, type: "BS" },
          { code: "EEE2102", title: "Network Theory & Circuit Analysis", credits: 4, type: "PC" },
          { code: "EEE2103", title: "Electrical Machines - I", credits: 4, type: "PC" },
          { code: "EEE2104", title: "Electronic Devices & Circuits", credits: 3, type: "PC" },
          { code: "EEE2105", title: "Electromagnetic Fields", credits: 3, type: "PC" },
          { code: "EEE2106", title: "Electrical Circuits Lab", credits: 1.5, type: "PC" },
          { code: "EEE2107", title: "Environmental Studies", credits: 1.5, type: "HS" },
          { code: "EVA2101", title: "Integrated Project - I", credits: 1, type: "PC" }
        ];
      }
      if (sem === 4) {
        return [
          { code: "EEE2201", title: "Electrical Machines - II", credits: 4, type: "PC" },
          { code: "EEE2202", title: "Power Systems - I", credits: 3, type: "PC" },
          { code: "EEE2203", title: "Control Systems", credits: 4, type: "PC" },
          { code: "EEE2204", title: "Digital Electronics & Logic Design", credits: 3, type: "PC" },
          { code: "EEE2205", title: "Analog Electronic Circuits", credits: 3, type: "PC" },
          { code: "EAE2221", title: "English through Theatre Arts", credits: 2, type: "HS" },
          { code: "EVA2201", title: "Integrated Project - II", credits: 1, type: "PC" }
        ];
      }
      if (sem === 5) {
        return [
          { code: "EEE3101", title: "Power Electronics", credits: 4, type: "PC" },
          { code: "EEE3102", title: "Power Systems - II", credits: 4, type: "PC" },
          { code: "EEE3103", title: "Microprocessors & Microcontrollers", credits: 3, type: "PC" },
          { code: "EEE3104", title: "Electrical Measurements & Instrumentation", credits: 3, type: "PC" },
          { code: "EEE3140", title: "Professional Elective - I", credits: 3, type: "PE" },
          { code: "EEE3180", title: "Open Elective - I", credits: 3, type: "OE" },
          { code: "EVA3101", title: "Integrated Project - III", credits: 1, type: "PC" }
        ];
      }
      if (sem === 6) {
        return [
          { code: "EEE3201", title: "Power System Analysis", credits: 4, type: "PC" },
          { code: "EEE3202", title: "Power System Protection", credits: 3, type: "PC" },
          { code: "EEE3203", title: "Signals & Systems", credits: 3, type: "PC" },
          { code: "EEE3240", title: "Professional Elective - II", credits: 3, type: "PE" },
          { code: "EEE3250", title: "Professional Elective - III", credits: 3, type: "PE" },
          { code: "EEE3280", title: "Open Elective - II", credits: 3, type: "OE" },
          { code: "EVA3201", title: "Technical Seminar & Project", credits: 1, type: "PC" }
        ];
      }
      if (sem === 7) {
        return [
          { code: "EEE4101", title: "Utilization of Electrical Energy", credits: 3, type: "PC" },
          { code: "EEE4102", title: "Industrial Electrical Systems", credits: 3, type: "PC" },
          { code: "EEE4140", title: "Professional Elective - IV", credits: 3, type: "PE" },
          { code: "EEE4150", title: "Professional Elective - V", credits: 3, type: "PE" },
          { code: "EEE4180", title: "Open Elective - III", credits: 3, type: "OE" },
          { code: "EVA4101", title: "Major Project Phase - I", credits: 2, type: "PC" },
          { code: "INT4101", title: "Summer Internship", credits: 1, type: "PC" }
        ];
      }
      if (sem === 8) {
        return [
          { code: "EEE4240", title: "Professional Elective - VI", credits: 3, type: "PE" },
          { code: "EEE4280", title: "Open Elective - IV", credits: 3, type: "OE" },
          { code: "EVA4201", title: "Major Project Phase - II", credits: 8, type: "PC" }
        ];
      }
    }

    if (isCivil) {
      if (sem === 3) {
        return [
          { code: "CIV2101", title: "Numerical Methods & Partial Differential Equations", credits: 3, type: "BS" },
          { code: "CIV2102", title: "Surveying & Geomatics", credits: 4, type: "PC" },
          { code: "CIV2103", title: "Strength of Materials - I", credits: 4, type: "PC" },
          { code: "CIV2104", title: "Building Planning & Construction Materials", credits: 3, type: "PC" },
          { code: "CIV2105", title: "Fluid Mechanics", credits: 4, type: "PC" },
          { code: "CIV2106", title: "Engineering Geology Lab", credits: 1, type: "PC" },
          { code: "CIV2107", title: "Strength of Materials Lab", credits: 1, type: "PC" },
          { code: "EVA2101", title: "Integrated Project - I", credits: 1, type: "PC" }
        ];
      }
      if (sem === 4) {
        return [
          { code: "CIV2201", title: "Strength of Materials - II", credits: 3, type: "PC" },
          { code: "CIV2202", title: "Hydraulics & Hydraulic Machinery", credits: 4, type: "PC" },
          { code: "CIV2203", title: "Structural Analysis - I", credits: 4, type: "PC" },
          { code: "CIV2204", title: "Concrete Technology", credits: 3, type: "PC" },
          { code: "CIV2205", title: "Geotechnical Engineering - I", credits: 4, type: "PC" },
          { code: "EAE2221", title: "English through Theatre Arts", credits: 2, type: "HS" },
          { code: "EVA2201", title: "Integrated Project - II", credits: 1, type: "PC" }
        ];
      }
      if (sem === 5) {
        return [
          { code: "CIV3101", title: "Design of Reinforced Concrete Structures", credits: 4, type: "PC" },
          { code: "CIV3102", title: "Structural Analysis - II", credits: 4, type: "PC" },
          { code: "CIV3103", title: "Transportation Engineering", credits: 3, type: "PC" },
          { code: "CIV3104", title: "Hydrology & Water Resources Engineering", credits: 3, type: "PC" },
          { code: "CIV3140", title: "Professional Elective - I", credits: 3, type: "PE" },
          { code: "CIV3180", title: "Open Elective - I", credits: 3, type: "OE" },
          { code: "EVA3101", title: "Integrated Project - III", credits: 1, type: "PC" }
        ];
      }
      if (sem === 6) {
        return [
          { code: "CIV3201", title: "Design of Steel Structures", credits: 4, type: "PC" },
          { code: "CIV3202", title: "Environmental Engineering", credits: 4, type: "PC" },
          { code: "CIV3203", title: "Geotechnical Engineering - II", credits: 4, type: "PC" },
          { code: "CIV3240", title: "Professional Elective - II", credits: 3, type: "PE" },
          { code: "CIV3250", title: "Professional Elective - III", credits: 3, type: "PE" },
          { code: "CIV3280", title: "Open Elective - II", credits: 3, type: "OE" },
          { code: "EVA3201", title: "Technical Seminar & Project", credits: 1, type: "PC" }
        ];
      }
      if (sem === 7) {
        return [
          { code: "CIV4101", title: "Estimation, Costing & Valuation", credits: 3, type: "PC" },
          { code: "CIV4102", title: "Construction Project Management", credits: 3, type: "PC" },
          { code: "CIV4140", title: "Professional Elective - IV", credits: 3, type: "PE" },
          { code: "CIV4150", title: "Professional Elective - V", credits: 3, type: "PE" },
          { code: "CIV4180", title: "Open Elective - III", credits: 3, type: "OE" },
          { code: "EVA4101", title: "Major Project Phase - I", credits: 2, type: "PC" },
          { code: "INT4101", title: "Summer Internship", credits: 1, type: "PC" }
        ];
      }
      if (sem === 8) {
        return [
          { code: "CIV4240", title: "Professional Elective - VI", credits: 3, type: "PE" },
          { code: "CIV4280", title: "Open Elective - IV", credits: 3, type: "OE" },
          { code: "EVA4201", title: "Major Project Phase - II", credits: 8, type: "PC" }
        ];
      }
    }

    if (isMech) {
      if (sem === 3) {
        return [
          { code: "MEC2101", title: "Metallurgy & Material Science", credits: 3, type: "PC" },
          { code: "MEC2102", title: "Mechanics of Solids", credits: 4, type: "PC" },
          { code: "MEC2103", title: "Thermodynamics", credits: 4, type: "PC" },
          { code: "MEC2104", title: "Kinematics of Machinery", credits: 3, type: "PC" },
          { code: "MEC2105", title: "Manufacturing Processes", credits: 4, type: "PC" },
          { code: "MEC2106", title: "Material Science Lab", credits: 1, type: "PC" },
          { code: "MEC2107", title: "Machine Drawing Lab", credits: 1, type: "PC" },
          { code: "EVA2101", title: "Integrated Project - I", credits: 1, type: "PC" }
        ];
      }
      if (sem === 4) {
        return [
          { code: "MEC2201", title: "Dynamics of Machinery", credits: 4, type: "PC" },
          { code: "MEC2202", title: "Applied Thermodynamics", credits: 4, type: "PC" },
          { code: "MEC2203", title: "Fluid Mechanics & Hydraulic Machines", credits: 4, type: "PC" },
          { code: "MEC2204", title: "Machine Tools & Metrology", credits: 3, type: "PC" },
          { code: "MEC2205", title: "Instrumentation & Control Systems", credits: 3, type: "PC" },
          { code: "EAE2221", title: "English through Theatre Arts", credits: 2, type: "HS" },
          { code: "EVA2201", title: "Integrated Project - II", credits: 1, type: "PC" }
        ];
      }
      if (sem === 5) {
        return [
          { code: "MEC3101", title: "Design of Machine Elements - I", credits: 4, type: "PC" },
          { code: "MEC3102", title: "Heat Transfer", credits: 4, type: "PC" },
          { code: "MEC3103", title: "Thermal Engineering", credits: 4, type: "PC" },
          { code: "MEC3140", title: "Professional Elective - I", credits: 3, type: "PE" },
          { code: "MEC3180", title: "Open Elective - I", credits: 3, type: "OE" },
          { code: "EVA3101", title: "Integrated Project - III", credits: 1, type: "PC" }
        ];
      }
      if (sem === 6) {
        return [
          { code: "MEC3201", title: "Design of Machine Elements - II", credits: 4, type: "PC" },
          { code: "MEC3202", title: "CAD/CAM & Digital Manufacturing", credits: 4, type: "PC" },
          { code: "MEC3203", title: "Finite Element Methods", credits: 4, type: "PC" },
          { code: "MEC3240", title: "Professional Elective - II", credits: 3, type: "PE" },
          { code: "MEC3250", title: "Professional Elective - III", credits: 3, type: "PE" },
          { code: "MEC3280", title: "Open Elective - II", credits: 3, type: "OE" },
          { code: "EVA3201", title: "Technical Seminar & Project", credits: 1, type: "PC" }
        ];
      }
      if (sem === 7) {
        return [
          { code: "MEC4101", title: "Operations Research", credits: 3, type: "PC" },
          { code: "MEC4102", title: "Refrigeration & Air Conditioning", credits: 3, type: "PC" },
          { code: "MEC4140", title: "Professional Elective - IV", credits: 3, type: "PE" },
          { code: "MEC4150", title: "Professional Elective - V", credits: 3, type: "PE" },
          { code: "MEC4180", title: "Open Elective - III", credits: 3, type: "OE" },
          { code: "EVA4101", title: "Major Project Phase - I", credits: 2, type: "PC" },
          { code: "INT4101", title: "Summer Internship", credits: 1, type: "PC" }
        ];
      }
      if (sem === 8) {
        return [
          { code: "MEC4240", title: "Professional Elective - VI", credits: 3, type: "PE" },
          { code: "MEC4280", title: "Open Elective - IV", credits: 3, type: "OE" },
          { code: "EVA4201", title: "Major Project Phase - II", credits: 8, type: "PC" }
        ];
      }
    }

    return [
      { code: `CORE${sem}01`, title: "Core Engineering Principles", credits: 4, type: "PC" },
      { code: `CORE${sem}02`, title: "Computational Methods & Tools", credits: 4, type: "ES" },
      { code: `CORE${sem}03`, title: "Applied Structural Design", credits: 3, type: "PC" },
      { code: `ELECT${sem}1`, title: "Professional Elective - I", credits: 3, type: "PE" },
      { code: `OPEN${sem}1`, title: "Open Elective - I", credits: 3, type: "OE" },
      { code: `PRJ${sem}01`, title: "Integrated Semestral Project", credits: 1, type: "PC" }
    ];
  };

  const getMergedSubjects = () => {
    let staticList = SYLLABUS_MAP[selectedDept || ""]?.[selectedSem || 1] || [];
    if (staticList.length === 0) {
      staticList = getFallbackSyllabusList(selectedDept || "", selectedSem || 1);
    }
    const mergedList: any[] = [];
    const processedCodes = new Set<string>();

    const dynamicMap = new Map<string, any>();
    if (dynamicSubjects && dynamicSubjects.length > 0) {
      dynamicSubjects.forEach(ds => {
        const code = ds.subjectCode || ds.id;
        if (code) {
          dynamicMap.set(code.toUpperCase().trim(), ds);
        }
      });
    }

    // 1. Process static subjects and enrich them if they exist in dynamicMap
    staticList.forEach(s => {
      const CodeUpper = s.code.toUpperCase().trim();
      processedCodes.add(CodeUpper);

      const dyn = dynamicMap.get(CodeUpper);
      if (dyn) {
        mergedList.push({
          ...dyn,
          code: s.code, // Keep original static casing
          title: dyn.subjectName || dyn.title || s.title,
          credits: Number(dyn.credits !== undefined ? dyn.credits : s.credits),
          theoryCredits: dyn.theoryCredits !== undefined ? Number(dyn.theoryCredits) : undefined,
          labCredits: dyn.labCredits !== undefined ? Number(dyn.labCredits) : undefined,
          type: dyn.type || s.type,
          isStatic: false,
          linked_departments: dyn.linked_departments || []
        });
      } else {
        mergedList.push({
          code: s.code,
          title: s.title,
          credits: Number(s.credits || 4),
          type: s.type,
          isStatic: true,
          linked_departments: [selectedDept || ""]
        });
      }
    });

    // 2. Append any dynamic subjects that are NOT in the static list for this semester
    if (dynamicSubjects && dynamicSubjects.length > 0) {
      dynamicSubjects.forEach(ds => {
        const code = (ds.subjectCode || ds.id || "").toUpperCase().trim();
        if (code && !processedCodes.has(code)) {
          mergedList.push({
            ...ds,
            code: ds.subjectCode || ds.id,
            title: ds.subjectName || ds.title,
            credits: Number(ds.credits !== undefined ? ds.credits : 4),
            theoryCredits: ds.theoryCredits !== undefined ? Number(ds.theoryCredits) : undefined,
            labCredits: ds.labCredits !== undefined ? Number(ds.labCredits) : undefined,
            type: ds.type || "PC",
            isStatic: false,
            linked_departments: ds.linked_departments || []
          });
        }
      });
    }

    return mergedList;
  };

  const getActiveSubjectData = () => {
    if (!activeSubject) return null;
    const upperCode = activeSubject.toUpperCase().trim();
    
    // Match static record first
    if (SUBJECT_DETAILS[upperCode]) {
      return SUBJECT_DETAILS[upperCode];
    }
    
    // Match dynamic Subject model from Firestore
    const dynSub = dynamicSubjects.find(s => 
      (s.subjectCode || "").toUpperCase().trim() === upperCode || 
      (s.id || "").toUpperCase().trim() === upperCode
    );
    if (dynSub) {
      return {
        title: dynSub.subjectName || dynSub.title || "Custom Subject",
        outcomes: dynSub.outcomes || [
          "Gain comprehensive theoretical and practical insights of the course curriculum.",
          "Apply subject guidelines to solve technical problems.",
          "Excel in autonomous examinations and secure higher grades."
        ],
        units: dynSub.units && dynSub.units.length > 0 ? dynSub.units : [
          { title: "UNIT I: Course Fundamentals", content: "Comprehensive overview of foundational modules, key definitions, and introduction to core subject systems." },
          { title: "UNIT II: Core Structural Methods", content: "Investigation of design models, operational paradigms, and mathematical or procedural algorithms." },
          { title: "UNIT III: Intermediate Applications", content: "Technical details of workflow execution, system parameters, and hands-on laboratory exercises." },
          { title: "UNIT IV: Advanced Integrations", content: "Complex architectures, performance analytics, mitigation techniques, and contemporary paradigms." },
          { title: "UNIT V: Practical Projects & Case Studies", content: "Review of typical autonomous exams, industrial application studies, and final project deliverables." }
        ]
      };
    }

    // Match programmatically fallback-generated syllabus subjects
    const mergedList = getMergedSubjects();
    const foundMerged = mergedList.find(s => (s.code || "").toUpperCase().trim() === upperCode);
    if (foundMerged) {
      const displayTitle = foundMerged.title || foundMerged.subjectName || activeSubject;
      return {
        title: displayTitle,
        outcomes: [
          `Formulate fundamental strategies and standard design practices for ${displayTitle}.`,
          `Analyze core structural paradigms, system properties, and operational parameters of the course scope.`,
          `Develop deep computational, practical, or analytical methodologies to implement practical projects.`
        ],
        units: [
          { title: "UNIT I: Foundational Concepts", content: `Introduction to the primary concepts of ${displayTitle}, scope definition, introductory terminology, and fundamental tenets.` },
          { title: "UNIT II: Core Architectures & Modeling", content: `Study of key structural modules, architectural components, operational guidelines, and computational frameworks relative to ${displayTitle}.` },
          { title: "UNIT III: Applied Methodologies", content: `Detailed analysis of practical tools, standard algorithms, procedures, and experimental modeling paradigms specified in the ${displayTitle} guidelines.` },
          { title: "UNIT IV: System Integrations & Analysis", content: `Advanced techniques for integrating cross-module functionalities, debugging structural issues, and analyzing output performance metrics.` },
          { title: "UNIT V: Future Paradigms & Case Studies", content: `Investigation of state-of-the-art developments, research topics, final academic project deliverables, and industrial case studies.` }
        ]
      };
    }

    // Abstract Fallback Template
    return {
      title: activeSubject,
      outcomes: ["Understand core concepts of " + activeSubject],
      units: [
        { title: "UNIT I: Introduction & Core Concepts", content: "Fundamental principles and overview of the course syllabus." },
        { title: "UNIT II: Intermediate Methods", content: "Core structural methodologies, calculations, and analytical components." },
        { title: "UNIT III: Advanced Frameworks", content: "In-depth case studies, problem solving matrices, and modeling." },
        { title: "UNIT IV: Contemporary Applications", content: "Real-world implementations, current trends, and system integration." },
        { title: "UNIT V: Practical Research", content: "Review guidelines, practical procedures, and advanced exercises." }
      ]
    };
  };

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error?.code !== "auth/popup-closed-by-user") {
        setAuthError(error.message || "Login failed. Please try again.");
      }
    }
  };

  const handleSaveResource = async (e: FormEvent) => {
    e.preventDefault();
    
    // Dynamically resolve department and semester context nodes from code if currently missing from URL state
    let finalDept = selectedDept;
    let finalSem = selectedSem;
    if (activeSubject && (!finalDept || !finalSem)) {
      const found = findSubjectByCode(activeSubject);
      if (found) {
        if (!finalDept && found.department) {
          finalDept = found.department;
          setSelectedDept(found.department);
        }
        if (!finalSem && found.semester) {
          finalSem = found.semester;
          setSelectedSem(found.semester);
        }
      }
    }

    if (!isAdmin || !user || !finalDept || !finalSem || !activeSubject) {
      setFormError(`Missing required admin privileges or university subject context nodes (Dept: ${finalDept || 'None'}, Sem: ${finalSem || 'None'}, Sub: ${activeSubject || 'None'}).`);
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
        const storagePath = `resources/${finalDept}/${finalSem}/${activeSubject}/${modalType}/${finalUnit ? 'unit-' + finalUnit : 'pyq'}/${fileName}`;
        
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

      // Identify all departments offering this course dynamically/statically to populate department_visibility
      const offeringDepts = new Set<string>([finalDept]);
      Object.entries(SYLLABUS_MAP).forEach(([deptName, semMap]) => {
        Object.entries(semMap).forEach(([semStr, subList]) => {
          if (subList.some(s => s.code === activeSubject)) {
            offeringDepts.add(deptName);
          }
        });
      });

      // Build target document payload
      const resourceData: any = {
        branch: finalDept,
        sem: finalSem,
        subjectCode: activeSubject,
        type: modalType,
        title: formTitle.trim(),
        fileUrl: downloadURL,
        driveLink: formDriveLink.trim(),
        uploadedAt: serverTimestamp(),
        uploadedBy: user.uid,
        semester: finalSem,
        department_visibility: Array.from(offeringDepts)
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
      resourcesCacheRef.current = {};
      setResourceVersion(prev => prev + 1);
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

  // Trigger AI Syllabus Extractor using server endpoint
  const handleAiParseSyllabus = async () => {
    if (!isAdmin) {
      setAiError("Unauthorized operation.");
      return;
    }
    
    setAiIsParsing(true);
    setAiError("");
    setAiSubjects(null);
    setAiCurrentExpandedIdx(null);

    try {
      console.log(`Sending parse-syllabus-pdf request to backend for branch: ${aiSelectedDept}, sem: ${aiSelectedSem}`);
      const res = await fetch("/api/parse-syllabus-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          department: aiSelectedDept,
          semester: aiSelectedSem,
          fileName: "B Tech Curriculum_copy.pdf"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to contact Gemini API via server route.");
      }

      if (data.success && data.subjects) {
        setAiSubjects(data.subjects);
        showToast(`AI successfully parsed ${data.subjects.length} subjects!`, "success");
      } else {
        throw new Error("Invalid response form from server endpoint.");
      }
    } catch (err: any) {
      console.error("AI Extractor parsing error:", err);
      setAiError(err.message || "An unexpected error occurred during AI curriculum extraction. Please try again.");
    } finally {
      setAiIsParsing(false);
    }
  };

  // Save the parsed objects into Firestore with automatic merge capabilities
  const handleSaveAiParsedSubjects = async () => {
    if (!isAdmin || !aiSubjects || aiSubjects.length === 0) {
      setAiError("No subjects to save or unauthorized operation.");
      return;
    }

    setAiIsSaving(true);
    setAiError("");
    setAiSaveProgress("Preparing database transfer...");

    try {
      const batch = writeBatch(db);

      for (let i = 0; i < aiSubjects.length; i++) {
        const sub = aiSubjects[i];
        const rawCode = (sub.subjectCode || "").trim();
        if (!rawCode) continue;

        const code = rawCode.toUpperCase();
        setAiSaveProgress(`Formatting subject ${i + 1} of ${aiSubjects.length}: ${sub.subjectName || code}...`);

        const subRef = doc(db, "subjects", code);

        // Standardize dynamic properties
        const updatedDoc = {
          subjectCode: code,
          subjectName: sub.subjectName || "Unnamed Subject",
          credits: parseInt(sub.credits) || 3,
          theoryCredits: parseInt(sub.theoryCredits) || 3,
          labCredits: parseInt(sub.labCredits) || 0,
          type: sub.type || "PC",
          outcomes: Array.isArray(sub.outcomes) ? sub.outcomes : ["Acquire base domain competencies"],
          units: Array.isArray(sub.units) ? sub.units : [
            { title: "UNIT I", content: "Topics overview" },
            { title: "UNIT II", content: "" },
            { title: "UNIT III", content: "" },
            { title: "UNIT IV", content: "" },
            { title: "UNIT V", content: "" }
          ],
          linked_departments: [aiSelectedDept],
          semester_mapping: {
            [aiSelectedDept]: aiSelectedSem
          },
          semester: aiSelectedSem,
          updatedAt: serverTimestamp()
        };

        // setDoc with merge: true guarantees we preserve links or other branches!
        batch.set(subRef, updatedDoc, { merge: true });
      }

      setAiSaveProgress("Writing batches to Firestore...");
      await batch.commit();

      // Invalidate cache references and force reactive redraw across layout views
      subjectsCacheRef.current = {};
      setSubjectVersion(prev => prev + 1);

      showToast(`Successfully saved ${aiSubjects.length} subjects to Firestore!`, "success");
      setAiSubjects(null);
    } catch (err: any) {
      console.error("AI Extractor save error:", err);
      setAiError(err.message || "Underlying firestore database validation refused this batch write transaction.");
    } finally {
      setAiIsSaving(false);
      setAiSaveProgress("");
    }
  };

  const runDatabaseNormalization = async () => {
    if (!isAdmin) {
      alert("Unauthorized operation.");
      return;
    }
    
    setNormStatus("running");
    setNormLogs(["Initiating database normalization process...", "Acquiring collection lock..."]);
    
    try {
      // Step 1: Backup & scan current collections
      setNormLogs(prev => [...prev, "Step 1: Scanning existing resources collection in Firestore..."]);
      
      const resourcesRef = collection(db, "resources");
      const { getDocs, doc, setDoc } = await import("firebase/firestore");
      const resourcesSnap = await getDocs(resourcesRef);
      const resourcesList = resourcesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      
      setNormLogs(prev => [...prev, `Found ${resourcesList.length} total resources in legacy collection.`]);
      
      // Step 2: Establish base subjects map from historical/static SYLLABUS_MAP
      setNormLogs(prev => [...prev, "Step 2: Harvesting subject code signatures from static syllabus mappings..."]);
      
      const uniqueSubjectCodes = new Set<string>();
      const subjectToDepts = new Map<string, Set<string>>();
      const subjectToSemMap = new Map<string, Record<string, number>>();
      const subjectToSem = new Map<string, number>();
      const subjectToName = new Map<string, string>();
      const subjectToCredits = new Map<string, number>();
      const subjectToType = new Map<string, string>();
      
      // Fill from static maps
      Object.entries(SYLLABUS_MAP).forEach(([deptName, semMap]) => {
        Object.entries(semMap).forEach(([semStr, subList]) => {
          const semNum = parseInt(semStr);
          subList.forEach(s => {
            uniqueSubjectCodes.add(s.code);
            if (!subjectToDepts.has(s.code)) {
              subjectToDepts.set(s.code, new Set<string>());
            }
            subjectToDepts.get(s.code)!.add(deptName);
            
            // Build dynamic semester mapping
            if (!subjectToSemMap.has(s.code)) {
              subjectToSemMap.set(s.code, {});
            }
            subjectToSemMap.get(s.code)![deptName] = semNum;

            subjectToSem.set(s.code, semNum);
            subjectToName.set(s.code, s.title);
            subjectToCredits.set(s.code, s.credits);
            subjectToType.set(s.code, s.type);
          });
        });
      });
      
      setNormLogs(prev => [...prev, `Harvested ${uniqueSubjectCodes.size} master courses from local registry.`]);
      
      // Step 3: Scan existing resources to find any other unique/custom subject codes
      setNormLogs(prev => [...prev, "Step 3: Harvesting dynamic subject codes from active user uploads..."]);
      let dynamicCount = 0;
      resourcesList.forEach(res => {
        if (res.subjectCode) {
          const upperCode = res.subjectCode.trim().toUpperCase();
          if (!uniqueSubjectCodes.has(upperCode)) {
            uniqueSubjectCodes.add(upperCode);
            dynamicCount++;
          }
          if (res.branch) {
            if (!subjectToDepts.has(upperCode)) {
              subjectToDepts.set(upperCode, new Set<string>());
            }
            subjectToDepts.get(upperCode)!.add(res.branch);

            if (res.sem) {
              if (!subjectToSemMap.has(upperCode)) {
                subjectToSemMap.set(upperCode, {});
              }
              subjectToSemMap.get(upperCode)![res.branch] = res.sem;
            }
          }
          if (res.sem && !subjectToSem.has(upperCode)) {
            subjectToSem.set(upperCode, res.sem);
          }
          if (res.title && !subjectToName.has(upperCode)) {
            const cleanedTitle = res.title.split(" - ")[0] || res.title;
            subjectToName.set(upperCode, cleanedTitle);
          }
        }
      });
      
      setNormLogs(prev => [...prev, `Found ${dynamicCount} custom or non-static dynamic codes registered in resources.`]);
      
      // Step 4: Write/Sync normalized master SUBJECTS to Firestore Subjects collection
      setNormLogs(prev => [...prev, "Step 4: Writing normalized centralized Subjects list to subjects/ collection..."]);
      
      let subjectsSynced = 0;
      
      for (const code of uniqueSubjectCodes) {
        const linkedDepts = Array.from(subjectToDepts.get(code) || []);
        const sem = subjectToSem.get(code) || 1;
        const name = subjectToName.get(code) || code;
        const credits = subjectToCredits.get(code) || 4;
        const type = subjectToType.get(code) || "PC";
        const semesterMapping = subjectToSemMap.get(code) || {};

        const staticDetails = SUBJECT_DETAILS[code];
        const outcomes = staticDetails?.outcomes || [
          "Gain comprehensive theoretical and practical insights of the course curriculum.",
          "Apply subject guidelines to solve technical problems."
        ];
        const units = staticDetails?.units || [
          { title: "UNIT I: Introduction & Core Concepts", content: "Fundamental principles and overview of the course syllabus." }
        ];
        const ltp = SUBJECT_LTP[code] || { L: 3, T: 0, P: 0 };
        const lecture = ltp.L;
        const tutorial = ltp.T;
        const practical = ltp.P;
        
        let labCredits = 0;
        if (practical === 6) {
          labCredits = 3;
        } else if (practical === 2) {
          labCredits = 1;
        } else if (practical > 0) {
          labCredits = Math.ceil(practical / 2);
        }
        const theoryCredits = Math.max(0, credits - labCredits);
        
        try {
          const subRef = doc(db, "subjects", code);
          await setDoc(subRef, {
            subjectCode: code,
            subjectName: name,
            semester: sem,
            semester_mapping: semesterMapping,
            linked_departments: linkedDepts,
            credits,
            theoryCredits,
            labCredits,
            type,
            lecture,
            tutorial,
            practical,
            outcomes,
            units,
            updatedAt: serverTimestamp()
          }, { merge: true });
          
          subjectsSynced++;
        } catch (err: any) {
          setNormLogs(prev => [...prev, `⚠️ Failed syncing subject code ${code}: ${err.message}`]);
        }
      }
      
      setNormLogs(prev => [...prev, `Successfully synchronized ${subjectsSynced} subjects into centralized table.`]);
      
      // Step 5: Update old resource entities to follow standard key references
      setNormLogs(prev => [...prev, "Step 5: Transitioning resource references to relational architecture..."]);
      
      let resourcesMigrated = 0;
      for (const res of resourcesList) {
        if (res.id) {
          const upperCode = (res.subjectCode || "").trim().toUpperCase();
          if (upperCode) {
            try {
              const resRef = doc(db, "resources", res.id);
              const linkedDepts = Array.from(subjectToDepts.get(upperCode) || [res.branch || ""]);
              await updateDoc(resRef, {
                subjectCode: upperCode,
                semester: res.sem || res.semester || 1,
                department_visibility: linkedDepts,
                updatedAt: serverTimestamp()
              });
              resourcesMigrated++;
            } catch (err: any) {
              // Ignore or log error
            }
          }
        }
      }
      
      setNormLogs(prev => [...prev, `Successfully updated relational links for ${resourcesMigrated} resources.`]);
      setNormLogs(prev => [...prev, "🎉 Database Normalization complete! Subject-centric framework successfully activated."]);
      setNormStatus("success");
      subjectsCacheRef.current = {};
      resourcesCacheRef.current = {};
      setSubjectVersion(prev => prev + 1);
      setResourceVersion(prev => prev + 1);
    } catch (error: any) {
      console.error(error);
      setNormLogs(prev => [...prev, `❌ Error during normalization: ${error.message || error}`]);
      setNormStatus("error");
    }
  };

  const handleSaveSubject = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !subjectFormCode.trim() || !subjectFormName.trim()) {
      setSubjectFormError("Required fields are missing.");
      return;
    }
    
    if (subjectFormDepts.length === 0) {
      setSubjectFormError("Please select at least one linked department.");
      return;
    }
    
    setSubjectFormSaving(true);
    setSubjectFormError("");
    
    const upperCode = subjectFormCode.trim().toUpperCase();
    
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      const subRef = doc(db, "subjects", upperCode);
      
      const semMapping: Record<string, number> = {};
      subjectFormDepts.forEach(dept => {
        semMapping[dept] = subjectFormSemMapping[dept] || subjectFormSem || 1;
      });

      const finalCredits = Number(subjectFormTheoryCredits) + Number(subjectFormLabCredits);
      const defaultGlobalSem = semMapping[selectedDept || subjectFormDepts[0]] || subjectFormSem || 1;

      await setDoc(subRef, {
        subjectCode: upperCode,
        subjectName: subjectFormName.trim(),
        semester: defaultGlobalSem,
        semester_mapping: semMapping,
        linked_departments: subjectFormDepts,
        credits: finalCredits,
        theoryCredits: Number(subjectFormTheoryCredits),
        labCredits: Number(subjectFormLabCredits),
        type: subjectFormType,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      alert(`Subject ${upperCode} saved successfully!`);
      subjectsCacheRef.current = {};
      setSubjectVersion(prev => prev + 1);
      setIsSubjectModalOpen(false);
      setSubjectFormCode("");
      setSubjectFormName("");
      setSubjectFormSem(1);
      setSubjectFormDepts([]);
      setEditingSubject(null);
    } catch (err: any) {
      console.error(err);
      setSubjectFormError(err.message || "Failed to save subject.");
    } finally {
      setSubjectFormSaving(false);
    }
  };

  const getAcademicModeLabel = () => {
    if (!userProfile) return "";
    const type = userProfile.selectedUserType;
    if (type === "regular") return "Regular Study";
    if (type === "rejoinee" || type === "rejoined") return "Rejoinee Study";
    if (type === "supply") return "Supply Prep";
    return "Regular Study";
  };

  const getAcademicModeDesc = () => {
    if (!userProfile) return "";
    const type = userProfile.selectedUserType;
    if (type === "regular") return "Continue with your regular academic flow.";
    if (type === "rejoinee" || type === "rejoined") return "Access syllabus guidelines for prior academic years.";
    if (type === "supply") return "Access resources for clearing backlog papers.";
    return "Continue with your regular academic flow.";
  };

  const handleResourcesQuickAction = () => {
    if (userProfile) {
      const yr = userProfile.effectiveAcademicYear || 1;
      const dept = userProfile.departmentName;
      navigate(`/year/${yr}/department/${encodeURIComponent(dept)}`);
    } else {
      navigate("/");
    }
  };

  const parseLastOpenedDetails = () => {
    const route = userProfile?.lastOpenedRoute;
    if (!route) return null;

    // Matches `/subject/:subjectCode/resources`
    const subResMatch = route.match(/\/subject\/([^/]+)\/resources/i);
    // Matches `/subject/:subjectCode`
    const subMatch = route.match(/\/subject\/([^/]+)/i);
    // Matches `/semester/:dept/:sem`
    const semMatch = route.match(/\/semester\/([^/]+)\/([^/]+)/i);

    if (subResMatch || subMatch) {
      const code = (subResMatch ? subResMatch[1] : subMatch![1]).toUpperCase();
      const subject = findSubjectByCode(code);
      return {
        title: subject?.title || code,
        subtitle: `Code: ${code}`,
        type: route.includes("/pyqs") ? "Previous Year Papers" : "Syllabus & Notes",
        route
      };
    } else if (semMatch) {
      const deptName = decodeURIComponent(semMatch[1]);
      const semNum = semMatch[2];
      return {
        title: `${deptName} - Semester ${semNum}`,
        subtitle: "Semester Curriculum",
        type: "Resources",
        route
      };
    }

    return {
      title: "Active Coursework",
      subtitle: "Resume your progress",
      type: "Resources",
      route
    };
  };

  const defaultRecentResources = [
    { title: "Digital Logic Design Notes", desc: "Unit 1 to 4", type: "notes", code: "DLD" },
    { title: "Data Structures PYQs", desc: "2020 - 2024", type: "pyqs", code: "DS" },
    { title: "Discrete Mathematics Syllabus", desc: "Full Syllabus", type: "syllabus", code: "DM" }
  ];

  const renderNotificationsDrawer = () => (
    <AnimatePresence>
      {showNotificationsDrawer && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-[#121212] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl text-white font-sans flex flex-col max-h-[80vh]"
          >
            <div className="p-5 border-b border-neutral-800 flex justify-between items-center bg-[#151515]">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-orange-500" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-neutral-105">Inbox Notifications</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowNotificationsDrawer(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer border-none"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto space-y-3 divide-y divide-neutral-850">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-neutral-500 space-y-2">
                  <Bell size={32} className="mx-auto opacity-20 text-neutral-600" />
                  <p className="text-xs font-bold uppercase tracking-wider">Empty updates inbox</p>
                  <p className="text-[11px] text-neutral-600 max-w-[200px] mx-auto">You're fully up to date! Future announcements will display here.</p>
                </div>
              ) : (
                notifications.map((notif, index) => (
                  <div key={notif.id || index} className="pt-3 sm:pt-4 first:pt-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${notif.priority === 'high' ? 'bg-red-500' : notif.priority === 'medium' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                        <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">{notif.priority || 'medium'} priority</span>
                      </div>
                      <span className="text-[9px] font-mono text-neutral-600">
                        {notif.createdAt && (notif.createdAt.toDate ? notif.createdAt.toDate().toLocaleDateString() : new Date(notif.createdAt).toLocaleDateString())}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-neutral-100 leading-tight">{notif.title}</h4>
                    <p className="text-xs text-neutral-400 font-light leading-relaxed">{notif.description}</p>
                    {notif.buttonUrl && (
                      <a 
                        href={notif.buttonUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 transition-colors text-[10px] font-bold uppercase tracking-wider text-white"
                      >
                        {notif.buttonText || "Open link"} <ArrowUpRight size={10} />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
            
            <div className="p-4 bg-[#141414] border-t border-neutral-800 flex justify-end">
              <button 
                type="button"
                onClick={() => setShowNotificationsDrawer(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-200 transition-colors text-xs font-bold uppercase tracking-wider cursor-pointer border-none"
              >
                Close updates
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  const renderDashboard = () => {
    if (!userProfile) return null;

    const detectedDept = userProfile.departmentCode || userProfile.departmentName;
    const detectedYear = userProfile.effectiveAcademicYear || 1;
    const studentName = userProfile.email.split("@")[0].toUpperCase();
    const formalName = user?.displayName || studentName;
    const rawName = formalName.trim();
    const capitalizedName = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();

    // Format first name nicely
    const firstName = capitalizedName.split(" ")[0];

    return (
      <div className="w-full h-screen bg-[#070707] text-white font-sans flex overflow-hidden select-none">
        {/* Desktop Sidebar Layout */}
        <aside className="hidden md:flex flex-col w-64 bg-neutral-950 border-r border-neutral-900 justify-between p-6 shrink-0 h-screen sticky top-0">
          <div className="space-y-8">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <img 
                src="https://raw.githubusercontent.com/jampanapadmaja/ZERO2ONE/main/logo.png" 
                alt="ZERO2ONE" 
                className="w-8 h-8 rounded-lg object-contain" 
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://img.icons8.com/color/96/graduation-cap.png"; }} 
              />
              <span className="font-black text-lg tracking-wider text-white">ZERO<span className="text-orange-500">2</span>ONE</span>
            </div>

            {/* Sidebar Navigation */}
            <nav className="flex flex-col gap-2.5">
              <button 
                type="button"
                onClick={() => { setViewState("dashboard"); navigate("/dashboard"); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl justify-start text-xs font-bold uppercase tracking-wider transition-all duration-200 text-left cursor-pointer border-none ${viewState === 'dashboard' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-lg' : 'text-neutral-400 hover:text-white hover:bg-neutral-900/50'}`}
              >
                <Layers size={16} /> Home
              </button>
              <button 
                type="button"
                onClick={handleResourcesQuickAction}
                className="flex items-center gap-3 px-4 py-3 rounded-xl justify-start text-xs font-bold uppercase tracking-wider transition-all duration-200 text-neutral-400 hover:text-white hover:bg-neutral-900/50 text-left border-none cursor-pointer"
              >
                <BookOpen size={16} /> Resources
              </button>
              <button 
                type="button"
                onClick={() => { setViewState("tools-page"); setToolsSubView("menu"); navigate("/tools"); }}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 text-left border-none cursor-pointer ${viewState === 'tools-page' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-lg' : 'text-neutral-400 hover:text-white hover:bg-neutral-900/50'}`}
              >
                <span className="flex items-center gap-3"><Calculator size={16} /> Tools</span>
              </button>
              <button 
                type="button"
                onClick={() => showToast("Progress tracker is Coming Soon! ✨")}
                className="flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 text-neutral-400 hover:text-neutral-300 hover:bg-neutral-900/50 text-left border-none cursor-pointer"
              >
                <span className="flex items-center gap-3"><TrendingUp size={16} /> Progress</span>
                <span className="text-[8px] bg-neutral-900 text-neutral-500 border border-neutral-800 px-1.5 py-0.5 rounded-md font-mono">SOON</span>
              </button>
              <button 
                type="button"
                onClick={() => { setViewState("profile-page"); navigate("/profile"); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl justify-start text-xs font-bold uppercase tracking-wider transition-all duration-200 text-left border-none cursor-pointer ${viewState === 'profile-page' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-900/50'}`}
              >
                <UserIcon size={16} /> Profile
              </button>
            </nav>
          </div>

          <div className="bg-[#0f0f0f] border border-neutral-900 p-4 rounded-2xl flex flex-col items-center gap-3 text-center col-span-1">
            <Award size={24} className="text-orange-500 animate-pulse" />
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase text-neutral-300 tracking-wider">Empowering Excellence</p>
              <p className="text-[9px] text-neutral-500 font-light leading-relaxed">One step closer to your goals every day.</p>
            </div>
            <a href="mailto:zero2onestudypartner@gmail.com" className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-850 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#a3a3a3] hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer">
              <HelpCircle size={10} /> Need Help?
            </a>
          </div>
        </aside>

        {/* Content Area - Height constrained, no excessive layout scroll on small viewports */}
        <div className="flex-1 flex flex-col h-full bg-[#070707] overflow-hidden">
          {/* Header */}
          <header className="bg-[#070707]/90 backdrop-blur-md z-50 p-4 border-b border-neutral-900/60 flex justify-between items-center select-none shrink-0">
            {/* Mobile Title with Hamburger Menu */}
            <div className="flex items-center gap-3 md:hidden">
              <Menu size={20} className="text-neutral-400 cursor-pointer hover:text-white transition-colors font-bold" onClick={() => { setViewState("profile-page"); navigate("/profile"); }} />
              <div className="flex items-center gap-2">
                <img 
                  src="https://raw.githubusercontent.com/jampanapadmaja/ZERO2ONE/main/logo.png" 
                  alt="ZERO2ONE" 
                  className="w-6 h-6 object-contain" 
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://img.icons8.com/color/96/graduation-cap.png"; }} 
                />
                <span className="font-extrabold text-sm tracking-wider uppercase text-white">ZERO<span className="text-orange-500">2</span>ONE</span>
              </div>
            </div>

            {/* Desktop Header Title */}
            <div className="hidden md:flex flex-col">
              <h2 className="text-base font-black text-white uppercase tracking-tight leading-none">Dashboard</h2>
              <span className="text-[10px] text-neutral-500 font-sans mt-0.5 uppercase tracking-wider font-bold animate-pulse">STK Active</span>
            </div>

            {/* Notification Badge */}
            <div className="flex items-center gap-4">
              <button 
                type="button" 
                onClick={() => setShowNotificationsDrawer(true)} 
                className="relative w-9 h-9 items-center justify-center bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 rounded-xl flex transition-all duration-200 cursor-pointer text-white"
              >
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-orange-600 text-[8px] font-black font-sans leading-none text-white border border-[#070707]">
                    {notifications.length}
                  </span>
                )}
              </button>

              <div className="hidden md:flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center font-black text-xs text-white uppercase shadow-lg shadow-orange-500/20">
                  {formalName.charAt(0)}
                </div>
                <div className="flex flex-col text-left leading-none">
                  <span className="text-xs font-bold text-neutral-200">{firstName}</span>
                  <span className="text-[9px] text-neutral-500 font-mono mt-0.5">{userProfile.departmentCode} · Yr {userProfile.effectiveAcademicYear}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Main Dashboard body, optimized to fit within viewport on modern devices */}
          <div className="flex-1 flex flex-col justify-start p-4 md:p-6 gap-3.5 sm:gap-4 overflow-y-auto max-w-lg mx-auto w-full pb-28 md:pb-6 font-sans">
            
            {/* Welcome Section */}
            <div className="flex justify-between items-center bg-transparent mt-1">
              <div className="space-y-0.5">
                <span className="text-xs text-neutral-400 font-medium tracking-wide">Welcome Back,</span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-orange-500 flex items-center gap-1 leading-none tracking-tight">
                  {firstName}! <span className="animate-pulse">👋</span>
                </h2>
                <p className="text-[11px] sm:text-xs text-neutral-450 leading-normal font-medium tracking-tight">
                  {userProfile.departmentName} <span className="text-orange-500/60 font-black mx-1">•</span> Year {detectedYear}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => { setViewState("profile-page"); navigate("/profile"); }}
                className="px-3 py-2 rounded-xl border border-neutral-800 bg-[#0c0c0c] hover:bg-neutral-850 hover:border-orange-500/20 text-[11px] font-bold text-neutral-200 transition-all flex items-center gap-1.5 cursor-pointer leading-none"
              >
                <UserIcon size={12} className="text-neutral-400" /> View Profile <ChevronRight size={12} className="text-neutral-400" />
              </button>
            </div>

            {/* Academic Mode Card */}
            <div className="flex justify-between items-center bg-[#0d0d0d] border border-neutral-900 rounded-[18px] p-3 pl-4">
              <div className="flex items-center gap-2.5 text-neutral-200">
                <BookOpen size={16} className="text-orange-500 animate-[pulse_3s_infinite]" />
                <span className="text-xs font-semibold text-neutral-400">
                  Academic Mode: <span className="font-bold text-white">{getAcademicModeLabel()}</span>
                </span>
              </div>
              <button 
                type="button"
                onClick={() => { setAcademicMode(null); setSubStep("mode"); }}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-orange-500/25 text-[10px] font-black uppercase tracking-wider text-orange-400 hover:text-white flex items-center gap-1 leading-none transition-all hover:bg-neutral-850 cursor-pointer"
              >
                Change Mode <ChevronRight size={10} className="text-orange-400 font-bold" />
              </button>
            </div>

            {/* Semester Progress Card */}
            <div className="bg-[#0c0c0c] border border-neutral-900 rounded-[20px] p-4 space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-300">
                <TrendingUp size={15} className="text-orange-500" />
                <span>Semester Progress</span>
              </div>
              <div className="grid grid-cols-3 gap-2 items-center py-0.5">
                {/* Donut Chart */}
                <div className="flex justify-center">
                  <div className="relative w-18 h-18 sm:w-20 sm:h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="36"
                        cy="36"
                        r="28"
                        stroke="#141414"
                        strokeWidth="4"
                        fill="transparent"
                      />
                      <circle
                        cx="36"
                        cy="36"
                        r="28"
                        stroke="#f97316"
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray="175.92"
                        strokeDashoffset="175.92"
                        strokeLinecap="round"
                        strokeDashoffset-0=""
                      />
                    </svg>
                    <div className="absolute text-center flex flex-col justify-center leading-none">
                      <span className="text-sm font-black text-white">0%</span>
                      <span className="text-[7.5px] text-neutral-500 font-extrabold uppercase tracking-wide">Complete</span>
                    </div>
                  </div>
                </div>

                {/* Subjects Completed */}
                <div className="flex flex-col items-center justify-center border-l border-neutral-900/80 h-11">
                  <BookOpen size={16} className="text-neutral-400 mb-1" />
                  <span className="text-base font-black text-white leading-none">0</span>
                  <span className="text-[10px] text-neutral-500 font-bold tracking-tight mt-0.5">Subjects</span>
                </div>

                {/* Topics Completed */}
                <div className="flex flex-col items-center justify-center border-l border-neutral-900/80 h-11">
                  <FileText size={16} className="text-neutral-400 mb-1" />
                  <span className="text-base font-black text-white leading-none">0</span>
                  <span className="text-[10px] text-neutral-500 font-bold tracking-tight mt-0.5">Topics</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-300">
                <Sparkles size={15} className="text-orange-500" />
                <span>Quick Actions</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Resources */}
                <button 
                  type="button"
                  onClick={handleResourcesQuickAction}
                  className="group p-3 sm:p-4 rounded-xl bg-[#0d0d0d] border border-orange-500/10 hover:border-orange-500/30 text-left transition-all duration-200 cursor-pointer flex justify-between items-center w-full"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/5 border border-orange-500/15 flex items-center justify-center text-orange-500 shrink-0">
                      <BookOpen size={15} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white uppercase tracking-tight">Resources</h4>
                      <p className="text-[9px] text-neutral-500 tracking-tight leading-tight truncate">Browse notes and materials</p>
                    </div>
                  </div>
                  <ChevronRight size={12} className="text-neutral-500 group-hover:text-white transition-colors shrink-0" />
                </button>

                {/* Tools */}
                <button 
                  type="button"
                  onClick={() => { setViewState("tools-page"); setToolsSubView("menu"); navigate("/tools"); }}
                  className="group p-3 sm:p-4 rounded-xl bg-[#0d0d0d] border border-neutral-900 hover:border-orange-500/10 text-left transition-all duration-200 cursor-pointer flex justify-between items-center w-full"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/5 border border-orange-500/15 flex items-center justify-center text-orange-500 shrink-0">
                      <Calculator size={15} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white uppercase tracking-tight">Tools</h4>
                      <p className="text-[9px] text-neutral-500 tracking-tight leading-tight truncate">Calculators and utilities</p>
                    </div>
                  </div>
                  <ChevronRight size={12} className="text-neutral-500 group-hover:text-white transition-colors shrink-0" />
                </button>

                {/* Progress */}
                <button 
                  type="button"
                  onClick={() => {
                    showToast("Progress tracker is Coming Soon! 📈");
                  }}
                  className="group p-3 sm:p-4 rounded-xl bg-[#0d0d0d] border border-neutral-900 hover:border-orange-500/10 text-left transition-all duration-200 cursor-pointer flex justify-between items-center w-full"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/5 border border-emerald-500/15 flex items-center justify-center text-emerald-500 shrink-0">
                      <TrendingUp size={15} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white uppercase tracking-tight">Progress</h4>
                      <p className="text-[9px] text-neutral-500 tracking-tight leading-tight truncate">Track your academic journey</p>
                    </div>
                  </div>
                  <ChevronRight size={12} className="text-neutral-500 group-hover:text-white transition-colors shrink-0" />
                </button>

                {/* AI Hub */}
                <button 
                  type="button"
                  onClick={() => showToast("AI Hub assistant is Coming Soon! 🤖")}
                  className="group p-3 sm:p-4 rounded-xl bg-[#0d0d0d] border border-neutral-900 hover:border-orange-500/10 text-left transition-all duration-200 cursor-pointer flex justify-between items-center w-full"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/5 border border-blue-500/15 flex items-center justify-center text-blue-500 shrink-0">
                      <Bot size={15} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white uppercase tracking-tight">AI Hub</h4>
                      <p className="text-[9px] text-neutral-500 tracking-tight leading-tight truncate">Smart assistant and AI tools</p>
                    </div>
                  </div>
                  <ChevronRight size={12} className="text-neutral-500 group-hover:text-white transition-colors shrink-0" />
                </button>
              </div>
            </div>

            {/* Upcoming Exams Row */}
            <div className="bg-[#0c0c0c] border border-neutral-900 rounded-[20px] p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-300">
                  <Calendar size={15} className="text-orange-500" />
                  <span>Upcoming Exams</span>
                </div>
                <span 
                  onClick={() => showToast("Exam calendar has not been set yet! 👋")}
                  className="text-orange-500 font-extrabold tracking-white text-[10px] flex items-center gap-0.5 hover:underline cursor-pointer uppercase"
                >
                  View Calendar <ChevronRight size={10} className="text-orange-500 font-bold" />
                </span>
              </div>
              
              <div className="flex items-center gap-3 py-3 px-4 bg-[#080808]/40 border border-neutral-900/60 rounded-xl">
                <Calendar size={15} className="text-neutral-500 shrink-0" />
                <span className="text-xs text-neutral-400 font-medium">No exams announced yet.</span>
              </div>
            </div>

            {/* Mini Brand Footnote - Small text block */}
            <div className="text-center pt-2 select-none shrink-0 border-t border-neutral-900/30 flex justify-center items-center gap-1.5 text-[10px] text-neutral-600 font-medium leading-none">
              <span className="font-extrabold tracking-wider uppercase text-neutral-500 text-[9px]">ZERO2ONE STUDY</span>
              <span>·</span>
              <span>© 2026</span>
            </div>

          </div>
        </div>
      </div>
    );
  };

  const renderProfilePage = () => {
    if (!userProfile) return null;

    const detectedDept = userProfile.departmentCode || userProfile.departmentName;
    const detectedYear = userProfile.effectiveAcademicYear || 1;
    const studentName = userProfile.email.split("@")[0].toUpperCase();
    const formalName = user?.displayName || studentName;
    const typeLabel = userProfile.selectedUserType === "regular" ? "Regular Study" : userProfile.selectedUserType === "supply" ? "Supply Prep" : "Rejoinee Study";

    return (
      <div className="min-h-screen bg-[#070707] text-white font-sans flex flex-col md:flex-row pb-24 md:pb-0 select-none">
        
        {/* Reuse the Same Sidebar Option on Desktop */}
        <aside className="hidden md:flex flex-col w-64 bg-neutral-950 border-r border-neutral-900 justify-between p-6 select-none shrink-0 h-screen sticky top-0">
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <img 
                src="https://raw.githubusercontent.com/jampanapadmaja/ZERO2ONE/main/logo.png" 
                alt="ZERO2ONE" 
                className="w-8 h-8 object-contain" 
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://img.icons8.com/color/96/graduation-cap.png"; }} 
              />
              <span className="font-black text-lg tracking-wider text-white">ZERO<span className="text-orange-500">2</span>ONE</span>
            </div>

            <nav className="flex flex-col gap-2.5">
              <button 
                type="button"
                onClick={() => { setViewState("dashboard"); navigate("/dashboard"); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl justify-start text-xs font-bold uppercase tracking-wider transition-all duration-200 text-neutral-400 hover:text-white hover:bg-neutral-900/50 text-left border-none cursor-pointer"
              >
                <Layers size={16} /> Home
              </button>
              <button 
                type="button"
                onClick={handleResourcesQuickAction}
                className="flex items-center gap-3 px-4 py-3 rounded-xl justify-start text-xs font-bold uppercase tracking-wider transition-all duration-200 text-neutral-400 hover:text-white hover:bg-neutral-900/50 text-left border-none cursor-pointer"
              >
                <BookOpen size={16} /> Resources
              </button>
              <button 
                type="button"
                onClick={() => { setViewState("tools-page"); setToolsSubView("menu"); navigate("/tools"); }}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 text-left border-none cursor-pointer ${viewState === 'tools-page' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-lg' : 'text-neutral-400 hover:text-white hover:bg-neutral-900/50'}`}
              >
                <span className="flex items-center gap-3"><Calculator size={16} /> Tools</span>
              </button>
              <button 
                type="button"
                onClick={() => showToast("Progress tracker is Coming Soon! ✨")}
                className="flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 text-neutral-400 hover:text-neutral-350 hover:bg-neutral-900/50 text-left border-none cursor-pointer"
              >
                <span className="flex items-center gap-3"><TrendingUp size={16} /> Progress</span>
                <span className="text-[8px] bg-neutral-900 text-neutral-505 border border-neutral-800 px-1.5 py-0.5 rounded-md font-mono">SOON</span>
              </button>
              <button 
                type="button"
                onClick={() => { setViewState("profile-page"); navigate("/profile"); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl justify-start text-xs font-bold uppercase tracking-wider transition-all duration-200 text-orange-500 bg-orange-500/5 border border-orange-500/20 text-left border-none cursor-pointer"
              >
                <UserIcon size={16} /> Profile
              </button>
            </nav>
          </div>
        </aside>

        {/* Content Container area */}
        <div className="flex-1 overflow-y-auto max-h-screen">
          <header className="sticky top-0 bg-[#070707]/90 backdrop-blur-md z-50 p-4 border-b border-neutral-900/60 px-4 md:px-8 flex justify-between items-center select-none">
            <div className="flex items-center gap-2 md:hidden">
              <ArrowLeft size={16} className="text-neutral-400 cursor-pointer" onClick={() => { setViewState("dashboard"); navigate("/dashboard"); }} />
              <span className="font-extrabold text-sm tracking-wider uppercase text-white">Profile Detail</span>
            </div>

            <div className="hidden md:flex flex-col">
              <h2 className="text-lg font-black text-white tracking-tight uppercase leading-none">Profile Page</h2>
              <span className="text-[10px] text-neutral-500 font-sans mt-0.5">Manage your student credentials of STK</span>
            </div>

            <button 
              type="button"
              onClick={() => { setViewState("dashboard"); navigate("/dashboard"); }}
              className="px-3.5 py-1.5 rounded-xl border border-neutral-800 hover:border-orange-500/25 bg-neutral-900 hover:bg-neutral-850 text-[10px] font-black uppercase tracking-wider text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 border-none cursor-pointer leading-none"
            >
              <Layers size={12} /> Dashboard
            </button>
          </header>

          <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
            
            {/* Header Avatar card */}
            <div className="bg-neutral-950/80 border border-neutral-900 p-6 md:p-8 rounded-[32px] flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center font-black text-3xl text-white uppercase shadow-xl shadow-orange-500/25">
                {formalName.charAt(0)}
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-extrabold text-neutral-105 uppercase tracking-wide">{formalName}</h3>
                <p className="text-xs text-neutral-400 font-mono">{userProfile.email}</p>
              </div>
            </div>

            {/* Credential specifications list */}
            <div className="bg-neutral-950 border border-neutral-900 p-6 rounded-[32px] overflow-hidden divide-y divide-neutral-900">
              
              <div className="py-2.5 sm:py-3.5 flex justify-between items-center text-stone-100 first:pt-0 border-b border-neutral-900">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 shrink-0">Student Name</span>
                <span className="text-xs font-bold truncate tracking-normal pl-4">{formalName}</span>
              </div>

              <div className="py-2.5 sm:py-3.5 flex justify-between items-center text-stone-100 border-b border-neutral-900">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 shrink-0">Official Email</span>
                <span className="text-xs font-bold truncate pl-4 tracking-normal font-mono text-neutral-300">{userProfile.email}</span>
              </div>

              <div className="py-2.5 sm:py-3.5 flex justify-between items-center text-stone-100 border-b border-neutral-900">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 shrink-0">Branch Department</span>
                <span className="text-xs font-bold pl-4 text-neutral-300 truncate max-w-[200px] sm:max-w-xs text-right uppercase tracking-wider">{detectedDept}</span>
              </div>

              <div className="py-2.5 sm:py-3.5 flex justify-between items-center text-stone-100 border-b border-neutral-900">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 shrink-0">Academic Year</span>
                <span className="text-xs font-bold pl-4 uppercase tracking-wider font-sans text-neutral-300">Year {detectedYear}</span>
              </div>

              <div className="py-2.5 sm:py-3.5 flex justify-between items-center text-stone-100 border-b border-neutral-900">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 shrink-0">Academic Mode</span>
                <span className="text-xs font-bold pl-4 uppercase tracking-widest text-orange-500 font-black">{typeLabel}</span>
              </div>

              <div className="py-2.5 sm:py-3.5 flex justify-between items-center text-stone-100 last:pb-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 shrink-0">Section Details</span>
                <span className="text-xs font-bold pl-4 font-mono text-neutral-300">Section {userProfile.section || "A"} / Roll {userProfile.rollNumber || "112"}</span>
              </div>

            </div>

            {/* Logout button */}
            <div className="pt-2">
              <button 
                type="button"
                onClick={handleLogout}
                className="w-full py-4 bg-red-600/10 hover:bg-red-600 border border-red-500/10 hover:border-red-600 text-neutral-300 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-200 text-center flex items-center justify-center gap-2 cursor-pointer shadow-md leading-none"
              >
                <LogOut size={14} /> Log Out Account
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  };

  const renderMobileBottomNav = () => {
    if (!user || !userProfile) return null;

    return (
      <div className="fixed bottom-0 left-0 right-0 z-[40] bg-neutral-950/90 backdrop-blur-md border-t border-neutral-900/85 p-2 py-3 px-4 flex justify-around items-center md:hidden select-none">
        
        {/* Home */}
        <button 
          type="button"
          onClick={() => { setViewState("dashboard"); navigate("/dashboard"); }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors border-none bg-transparent ${viewState === 'dashboard' ? 'text-orange-500' : 'text-neutral-500 hover:text-neutral-350'}`}
        >
          <Layers size={18} />
          <span className="text-[8px] font-black uppercase tracking-widest leading-none mt-0.5">Home</span>
        </button>

        {/* Resources */}
        <button 
          type="button"
          onClick={handleResourcesQuickAction}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors border-none bg-transparent ${viewState !== 'dashboard' && viewState !== 'profile-page' && viewState !== 'tools-page' ? 'text-orange-500' : 'text-neutral-500 hover:text-neutral-350'}`}
        >
          <BookOpen size={18} />
          <span className="text-[8px] font-black uppercase tracking-widest leading-none mt-0.5">Resources</span>
        </button>

        {/* Tools */}
        <button 
          type="button"
          onClick={() => { setViewState("tools-page"); setToolsSubView("menu"); navigate("/tools"); }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors border-none bg-transparent ${viewState === 'tools-page' ? 'text-orange-500' : 'text-neutral-500 hover:text-neutral-350'}`}
        >
          <Calculator size={18} />
          <span className="text-[8px] font-black uppercase tracking-widest leading-none mt-0.5 font-sans">Tools</span>
        </button>

        {/* Progress */}
        <button 
          type="button"
          onClick={() => showToast("Progress tracker is Coming Soon! 📈")}
          className="flex flex-col items-center gap-1 cursor-pointer text-neutral-500 hover:text-neutral-355 border-none bg-transparent"
        >
          <TrendingUp size={18} />
          <span className="text-[8px] font-black uppercase tracking-widest leading-none mt-0.5">Progress</span>
        </button>

        {/* Profile */}
        <button 
          type="button"
          onClick={() => { setViewState("profile-page"); navigate("/profile"); }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors border-none bg-transparent ${viewState === 'profile-page' ? 'text-orange-500' : 'text-neutral-500 hover:text-neutral-350'}`}
        >
          <UserIcon size={18} />
          <span className="text-[8px] font-black uppercase tracking-widest leading-none mt-0.5">Profile</span>
        </button>

      </div>
    );
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
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
    navigate(`/year/${id}`);
  };

  const handleContinue = () => {
    if (selectedYear) {
      navigate(`/year/${selectedYear}/department/select`);
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
          onClick={() => navigate("/")} 
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
              onClick={() => navigate(`/year/${selectedYear || 1}/department/${encodeURIComponent(dept)}`)}
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

  const renderAcademicModeSelection = () => {
    if (!userProfile) return null;

    const detectedDept = userProfile.departmentCode || userProfile.departmentName;
    const detectedYear = userProfile.effectiveAcademicYear || 1;

    // Available options for Rejoinee Study options (Year 1 up to detectedYear)
    const availableYearsForRejoinee = Array.from({ length: detectedYear }, (_, i) => i + 1);

    // Available semesters for Supply preparation (Semester 1 up to 2 * detectedYear)
    const availableSemsForSupply = Array.from({ length: 2 * detectedYear }, (_, i) => i + 1);

    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col justify-between p-4 md:p-12 lg:p-20 select-none overflow-hidden font-sans">
        
        {/* Top/Back navigation inside select steps */}
        <div className="w-full max-w-xl md:max-w-4xl mx-auto flex justify-start mb-2 md:mb-6">
          {subStep !== "mode" && (
            <motion.button 
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSubStep("mode");
                setAcademicMode(null);
              }}
              className="flex items-center gap-2 text-neutral-400 hover:text-white transition-all font-bold uppercase tracking-wider text-[10px] md:text-xs cursor-pointer"
            >
              <ArrowLeft size={14} className="md:w-4 md:h-4" /> Back to modes
            </motion.button>
          )}
        </div>

        <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col justify-center items-center my-auto space-y-6 md:space-y-10">
          
          {/* Header Section */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-400 text-[10px] md:text-xs font-black uppercase tracking-widest leading-none">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              {detectedDept} • Year {detectedYear}
            </div>

            <div className="space-y-1 md:space-y-2">
              <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
                {subStep === "mode" && `Welcome Back${user?.displayName ? `, ${user.displayName.split(" ")[0]}!` : "!"}`}
                {subStep === "year" && "Rejoinee Study Select"}
                {subStep === "sem" && "Supply Prep Select"}
              </h2>
              <p className="text-neutral-400 text-xs md:text-base font-light leading-relaxed max-w-lg mx-auto">
                {subStep === "mode" && "What would you like to do today?"}
                {subStep === "year" && "Which year do you want to study?"}
                {subStep === "sem" && "Which semester are you preparing for?"}
              </p>
            </div>
          </div>

          {/* Core Selection Screens */}
          {subStep === "mode" && (
            <div className={`grid grid-cols-1 ${detectedYear === 1 ? "md:grid-cols-2 max-w-2xl" : "md:grid-cols-2 lg:grid-cols-3 max-w-4xl"} gap-3 md:gap-5 w-full items-stretch`}>
              
              {/* Option 1: Regular Study */}
              <motion.button
                whileHover={{ scale: 1.015, y: -2 }}
                whileTap={{ scale: 0.985 }}
                onClick={async () => {
                  try {
                    const userDocRef = doc(db, "users", user!.uid);
                    await updateDoc(userDocRef, {
                      selectedUserType: "regular"
                    });
                    setUserProfile(prev => prev ? { ...prev, selectedUserType: "regular" } : null);
                    setAcademicMode("regular");
                    navigate("/dashboard");
                  } catch (e) {
                    console.error("Error setting regular mode: ", e);
                    setAcademicMode("regular");
                    navigate("/dashboard");
                  }
                }}
                className="group relative flex flex-col items-center justify-between text-center p-4 md:p-6 lg:p-8 rounded-[24px] bg-neutral-900/60 border border-neutral-850 hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.12)] transition-all duration-300 w-full cursor-pointer overflow-hidden min-h-[140px] md:min-h-[180px] lg:min-h-[220px]"
              >
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 group-hover:text-orange-500 group-hover:scale-110 transition-all duration-300 mb-3 shrink-0">
                    <BookOpen size={18} />
                  </div>
                  <h3 className="text-sm md:text-base lg:text-lg font-bold text-neutral-100 tracking-tight group-hover:text-white transition-colors">Regular Study</h3>
                  <p className="text-[10px] md:text-xs text-neutral-400 leading-normal font-light mt-1.5 max-w-[200px] md:max-w-xs group-hover:text-neutral-350 transition-colors">
                    Continue with your current syllabus and resources.
                  </p>
                </div>
                <div className="text-[9px] font-bold uppercase text-orange-500/80 tracking-widest mt-2 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Enter Dashboard <ChevronRight size={10} />
                </div>
              </motion.button>

              {/* Option 2: Rejoinee (Only shown if detectedYear > 1) */}
              {detectedYear > 1 && (
                <motion.button
                  whileHover={{ scale: 1.015, y: -2 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => {
                    setSubStep("year");
                  }}
                  className="group relative flex flex-col items-center justify-between text-center p-4 md:p-6 lg:p-8 rounded-[24px] bg-neutral-900/60 border border-neutral-850 hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.12)] transition-all duration-300 w-full cursor-pointer overflow-hidden min-h-[140px] md:min-h-[180px] lg:min-h-[220px]"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 group-hover:text-orange-500 group-hover:scale-110 transition-all duration-300 mb-3 shrink-0">
                      <Layers size={18} />
                    </div>
                    <h3 className="text-sm md:text-base lg:text-lg font-bold text-neutral-100 tracking-tight group-hover:text-white transition-colors">Rejoinee Study</h3>
                    <p className="text-[10px] md:text-xs text-neutral-400 leading-normal font-light mt-1.5 max-w-[200px] md:max-w-xs group-hover:text-neutral-350 transition-colors">
                      Access syllabus guidelines for prior academic years.
                    </p>
                  </div>
                  <div className="text-[9px] font-bold uppercase text-orange-500/80 tracking-widest mt-2 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Select Year <ChevronRight size={10} />
                  </div>
                </motion.button>
              )}

              {/* Option 3: Supply Preparation */}
              <motion.button
                whileHover={{ scale: 1.015, y: -2 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => {
                  setSubStep("sem");
                }}
                className="group relative flex flex-col items-center justify-between text-center p-4 md:p-6 lg:p-8 rounded-[24px] bg-neutral-900/60 border border-neutral-850 hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.12)] transition-all duration-300 w-full cursor-pointer overflow-hidden min-h-[140px] md:min-h-[180px] lg:min-h-[220px]"
              >
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 group-hover:text-orange-500 group-hover:scale-110 transition-all duration-300 mb-3 shrink-0">
                    <Award size={18} />
                  </div>
                  <h3 className="text-sm md:text-base lg:text-lg font-bold text-neutral-100 tracking-tight group-hover:text-white transition-colors">Supply Prep</h3>
                  <p className="text-[10px] md:text-xs text-neutral-400 leading-normal font-light mt-1.5 max-w-[200px] md:max-w-xs group-hover:text-neutral-350 transition-colors">
                    Access resources for clearing backlog papers.
                  </p>
                </div>
                <div className="text-[9px] font-bold uppercase text-orange-500/80 tracking-widest mt-2 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Pick Semester <ChevronRight size={10} />
                </div>
              </motion.button>

            </div>
          )}

          {/* Sub-Step 2: Rejoinee Year Selection */}
          {subStep === "year" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-xl w-full">
              {availableYearsForRejoinee.map((year) => (
                <motion.button
                  key={year}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    try {
                      const userDocRef = doc(db, "users", user!.uid);
                      await updateDoc(userDocRef, {
                        selectedUserType: "rejoinee",
                        effectiveAcademicYear: year
                      });
                      setUserProfile(prev => prev ? { ...prev, selectedUserType: "rejoinee", effectiveAcademicYear: year } : null);
                      setAcademicMode("rejoinee");
                      setSelectedYear(year);
                      navigate("/dashboard");
                    } catch (e) {
                      console.error("Error setting rejoinee year: ", e);
                      setAcademicMode("rejoinee");
                      setSelectedYear(year);
                      navigate("/dashboard");
                    }
                  }}
                  className="px-4 py-3 md:py-4 rounded-xl md:rounded-2xl bg-neutral-900 border border-neutral-855 text-neutral-200 hover:border-orange-500/60 hover:text-white hover:bg-neutral-850 text-xs md:text-sm font-bold shadow-md text-center transition-all cursor-pointer"
                >
                  Year {year}
                </motion.button>
              ))}
            </div>
          )}

          {/* Sub-Step 3: Supply Prep Semester Selection */}
          {subStep === "sem" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-2xl w-full">
              {availableSemsForSupply.map((sem) => (
                <motion.button
                  key={sem}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    try {
                      const calculatedYear = Math.ceil(sem / 2);
                      const userDocRef = doc(db, "users", user!.uid);
                      await updateDoc(userDocRef, {
                        selectedUserType: "supply",
                        effectiveAcademicYear: calculatedYear
                      });
                      setUserProfile(prev => prev ? { ...prev, selectedUserType: "supply", effectiveAcademicYear: calculatedYear } : null);
                      setAcademicMode("supply");
                      setSelectedSem(sem);
                      setSelectedYear(calculatedYear);
                      navigate("/dashboard");
                    } catch (e) {
                      console.error("Error setting supply sem: ", e);
                      setAcademicMode("supply");
                      setSelectedSem(sem);
                      setSelectedYear(Math.ceil(sem / 2));
                      navigate("/dashboard");
                    }
                  }}
                  className="px-4 py-3 md:py-4 rounded-xl md:rounded-2xl bg-neutral-900 border border-neutral-855 text-neutral-200 hover:border-orange-500/60 hover:text-white hover:bg-neutral-850 text-[11px] md:text-sm font-bold shadow-md text-center transition-all cursor-pointer"
                >
                  Semester {sem < 10 ? `0${sem}` : sem}
                </motion.button>
              ))}
            </div>
          )}

        </div>

        {/* Custom Dark Footer */}
        <div className="pt-4 md:pt-8 flex flex-col items-center gap-2 text-center text-xs text-neutral-600 mt-auto">
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-tighter text-white">ZERO2ONE</span>
            <span className="text-[10px] text-neutral-500 font-sans font-medium">· Empowering Student Excellence</span>
          </div>
        </div>

      </div>
    );
  };

  const renderSemSelection = () => {
    const currentYear = selectedYear || 1;
    const semList = [2 * currentYear - 1, 2 * currentYear];
    const yearLabels = ["FIRST YEAR", "SECOND YEAR", "THIRD YEAR", "FOURTH YEAR"];
    const yearLabel = yearLabels[currentYear - 1] || "ACADEMIC YEAR";

    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col justify-between p-5 md:p-12 lg:p-20 overflow-y-auto">
        <div className="max-w-xl w-full mx-auto space-y-10 md:space-y-12 my-auto">
          
          {/* Top Section */}
          <div className="space-y-6">
            {userProfile ? (
              <motion.button 
                whileHover={{ x: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setAcademicMode(null);
                  setSubStep("mode");
                }} 
                className="flex items-center gap-2 text-neutral-400 hover:text-white transition-all font-bold uppercase tracking-wider text-[10px] md:text-xs"
              >
                <ArrowLeft size={14} className="md:w-4 md:h-4" /> Back to Academic Modes
              </motion.button>
            ) : (
              <motion.button 
                whileHover={{ x: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/year/${selectedYear || 1}/department/select`)} 
                className="flex items-center gap-2 text-neutral-400 hover:text-white transition-all font-bold uppercase tracking-wider text-[10px] md:text-xs"
              >
                <ArrowLeft size={14} className="md:w-4 md:h-4" /> Back to Departments
              </motion.button>
            )}

            <div className="space-y-3">
              <div className="inline-block px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest leading-none">
                {selectedDept}
              </div>
              
              <div className="space-y-1 md:space-y-2">
                <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">Select Semester</h2>
                <p className="text-neutral-400 text-xs md:text-sm font-light leading-relaxed">
                  Access semester-wise academic resources for {yearLabel.toLowerCase()}
                </p>
              </div>
            </div>
          </div>

          {/* Semester Cards */}
          <div className="flex flex-col gap-4 md:gap-5">
            {semList.map((sem) => (
              <motion.button
                key={sem}
                onClick={() => navigate(`/semester/${encodeURIComponent(selectedDept || "")}/${sem}`)}
                whileHover={{ scale: 1.015, y: -2 }}
                whileTap={{ scale: 0.985 }}
                className="group relative flex flex-col justify-between p-5 md:p-8 rounded-[28px] bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm shadow-xl hover:border-orange-500/50 hover:shadow-[0_0_25px_rgba(249,115,22,0.12)] transition-all duration-300 text-left w-full cursor-pointer overflow-hidden min-h-[140px] md:min-h-[160px]"
              >
                {/* Subtle hover glow strip */}
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/[0.015] to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="flex justify-between items-start w-full relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 group-hover:text-orange-500 group-hover:scale-110 transition-all duration-300 shadow-inner">
                      {sem % 2 === 1 ? <Clock size={18} className="md:w-5 md:h-5" /> : <BookOpen size={18} className="md:w-5 md:h-5" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] md:text-[10px] uppercase tracking-widest font-extrabold text-neutral-500 group-hover:text-neutral-400 transition-colors">{yearLabel}</span>
                      <h3 className="text-xl md:text-2xl font-black text-neutral-100 tracking-tight mt-0.5">Semester {sem < 10 ? `0${sem}` : sem}</h3>
                    </div>
                  </div>

                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700/60 flex items-center justify-center shadow-md group-hover:bg-orange-500 group-hover:text-white group-hover:border-orange-400 group-hover:scale-105 transition-all duration-300 shrink-0">
                    <ChevronRight size={14} className="md:w-5 md:h-5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-neutral-800/40 text-[11px] md:text-xs font-sans text-neutral-400 leading-relaxed font-light relative z-10">
                  {sem % 2 === 1 
                    ? "Build structural foundations with core theoretical concepts, fundamentals, and laboratory experimentation." 
                    : "Enhance subject expertise with applied structures, advanced algorithms, analytical exercises, and project labs."
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
                  {isAdmin ? (
                    <span className="text-[8px] font-black uppercase text-orange-500 tracking-widest mt-1 leading-none">Admin</span>
                  ) : (
                    <span className="text-[8px] font-black uppercase text-neutral-400 tracking-widest mt-1 leading-none">Student</span>
                  )}
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
};

  const renderChoiceSelection = () => (
    <div className="min-h-screen bg-white flex flex-col justify-between p-5 md:p-12 lg:p-20 overflow-y-auto">
      <div className="max-w-xl w-full mx-auto flex-1 flex flex-col justify-center space-y-8 md:space-y-12">
        
        {/* Header Section */}
        <div className="space-y-6">
          <motion.button 
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (userProfile && academicMode === "supply") {
                setSubStep("sem");
                navigate(`/year/${userProfile.effectiveAcademicYear}/department/${encodeURIComponent(userProfile.departmentName)}`);
              } else {
                navigate(`/year/${selectedYear || 1}/department/${encodeURIComponent(selectedDept || "")}`);
              }
            }} 
            className="flex items-center gap-2 text-neutral-400 hover:text-black transition-all font-bold uppercase tracking-wider text-[10px] md:text-xs text-left"
          >
            <ArrowLeft size={14} className="md:w-4 md:h-4" /> {userProfile && academicMode === "supply" ? "Back to Supply Semesters" : "Back to Semesters"}
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
            onClick={() => {
              if (selectedDept && selectedSem) {
                navigate(`/semester/${encodeURIComponent(selectedDept)}/${selectedSem}/syllabus-copy`);
              }
            }}
            className="group relative flex flex-col justify-between p-6 md:p-8 rounded-[28px] bg-white border border-neutral-100 hover:border-orange-500/50 hover:shadow-[0_0_25px_rgba(249,115,22,0.06)] transition-all duration-300 text-left w-full cursor-pointer shadow-sm overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/[0.01]/70 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="flex items-start gap-4 z-10 relative">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white group-hover:scale-105 transition-all duration-300 shadow-sm shrink-0">
                <FileText size={20} className="md:w-6 md:h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg md:text-xl font-extrabold text-[#0a0a0a] tracking-tight leading-snug">Syllabus Copy</h3>
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
            onClick={() => navigate("/subject/all/resources")}
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
                  {isAdmin ? (
                    <span className="text-[8px] font-black uppercase text-orange-500 tracking-widest mt-1 leading-none">Admin</span>
                  ) : (
                    <span className="text-[8px] font-black uppercase text-neutral-400 tracking-widest mt-1 leading-none">Student</span>
                  )}
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
    const subjects = getMergedSubjects();
    const activeSubjectData = getActiveSubjectData();

    return (
      <div className="min-h-screen bg-white flex flex-col justify-between overflow-y-auto font-sans selection:bg-orange-100/60 pb-16">
        
        {/* Sticky Compact Top Navigation Header */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-100/80 px-4 py-4 md:px-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-6">
            <motion.button 
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/semester/${encodeURIComponent(selectedDept || "")}/${selectedSem || 1}`)} 
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
                    onClick={() => navigate(`/subject/${subject.code}/resources`)}
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
          {activeSubject && !activeSubjectData && (
            <div className="h-[350px] rounded-[28px] border-[3px] border-dashed border-red-200 flex flex-col items-center justify-center p-10 text-center space-y-4 bg-white animate-fadeIn">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 shadow-sm"><X size={26} /></div>
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-red-500 uppercase tracking-widest">Subject Not Found</p>
                <p className="text-xs text-neutral-400 max-w-sm">The subject code <span className="font-mono text-red-600 font-semibold bg-red-50 px-1.5 py-0.5 rounded border border-red-100">{activeSubject}</span> was not found in our database.</p>
              </div>
              <button 
                onClick={() => navigate("/subject/all/resources")}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 transition-colors text-xs font-bold text-neutral-800 rounded-xl border border-neutral-200 cursor-pointer shadow-sm"
              >
                Go Back to All Subjects
              </button>
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
                      onClick={() => navigate("/subject/all/resources")}
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
                    onClick={() => navigate(`/subject/${activeSubject}/resources`)}
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
                    onClick={() => navigate(`/subject/${activeSubject}/pyqs`)}
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
                      <div className="bg-white rounded-[24px] border border-neutral-100 shadow-md overflow-hidden flex flex-col sticky top-28 h-auto w-full">
                        {/* Preview Topbar Header */}
                        <div className="p-4 md:p-5 border-b border-neutral-100 bg-neutral-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 select-none">
                          <h4 className="text-xs md:text-sm font-extrabold text-neutral-900">
                            Unit 0{expandedUnit + 1} Notes Resource
                          </h4>
                          
                          <div className="hidden sm:flex items-center gap-2 sm:w-auto">
                            {(() => {
                              const activeNote = uploadedResources.find(r => r.subjectCode === activeSubject && r.type === "notes" && r.unit === expandedUnit + 1);
                              if (activeNote) {
                                if (activeNote.driveLink) {
                                  // Under Temporary Exam-Season Fallback Mode: prioritize direct external actions
                                  return (
                                    <>
                                      {activeNote.fileUrl && (
                                        <a 
                                          href={activeNote.fileUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-750 text-xs font-bold transition-all border border-neutral-250 cursor-pointer shadow-sm active:scale-[0.98]"
                                        >
                                          <Download size={12} /> Download PDF
                                        </a>
                                      )}
                                      <a 
                                        href={activeNote.driveLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-all shadow-sm w-full sm:w-auto active:scale-[0.98]"
                                      >
                                        <ExternalLink size={12} /> Open Drive
                                      </a>
                                    </>
                                  );
                                }
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

                        {/* Preview Body Area - Optimized for Fallback Exam-Season Mode (No internal scrolling, adapts to content height) */}
                        <div className="p-5 md:p-8 space-y-6 w-full h-auto overflow-visible">
                          {(() => {
                            const activeNote = uploadedResources.find(r => r.subjectCode === activeSubject && r.type === "notes" && r.unit === expandedUnit + 1);
                            if (activeNote) {
                              return (
                                <div className="flex flex-col animate-fadeIn w-full h-auto">
                                  {/* Metadata Banner with Edit/Delete for Admin */}
                                  <div className="px-5 py-4 bg-orange-50/50 border border-orange-500/20 rounded-2xl mb-4 relative group/info flex items-center justify-between gap-4 select-none shrink-0">
                                    <div className="space-y-0.5 min-w-0">
                                      <h5 className="font-extrabold text-orange-950 text-xs md:text-sm pr-6 leading-normal truncate">
                                        {activeNote.title}
                                      </h5>
                                      <p className="text-[10px] text-orange-700/80 font-semibold">
                                        {activeNote.driveLink ? "Dual delivery enabled: Google Drive + CDN Backup." : "Academic resource ready for immediate exam preparation."}
                                      </p>
                                    </div>
                                    
                                    {isAdmin && (
                                      <div className="flex items-center gap-1.5 shrink-0 self-center">
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
                                              try {
                                                await deleteDoc(doc(db, "resources", activeNote.id));
                                                resourcesCacheRef.current = {};
                                                setResourceVersion(prev => prev + 1);
                                              } catch (err: any) {
                                                alert("Delete error: " + err.message);
                                              }
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
                                  
                                  {/* Beautiful, High-Performance Google Drive / direct link Resource Card in ZERO2ONE style */}
                                  <div className="w-full h-auto flex flex-col items-center justify-center p-6 md:p-8 text-center bg-white border border-orange-100 rounded-2xl shadow-sm hover:shadow-orange-400/5 transition-all duration-300 animate-fadeIn">
                                    {/* Google Drive icon representation */}
                                    <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 mb-5 relative shrink-0">
                                      <Layers size={30} />
                                      <div className="absolute -bottom-1 -right-1 bg-white border border-neutral-100 text-neutral-800 rounded-full p-1 shadow-sm">
                                        <ExternalLink size={10} />
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-2 max-w-md mb-6 shrink-0 select-none">
                                      <h4 className="font-extrabold text-neutral-900 text-base md:text-lg leading-tight tracking-tight">
                                        {activeNote.title || `Unit ${expandedUnit + 1} Study Notes`}
                                      </h4>
                                      <p className="text-xs text-neutral-500 font-medium leading-relaxed">
                                        Active Direct Access Mode is enabled. View the study material instantly without preview errors, delays, or blank pages.
                                      </p>
                                      <div className="pt-1.5">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black bg-orange-100 text-orange-950 uppercase tracking-widest border border-orange-200">
                                          {activeNote.driveLink ? "Open in Google Drive" : "Document Active"}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Actions: Stacks vertically as nice big targets on mobile, maps inline on desktop */}
                                    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs justify-center shrink-0">
                                      {/* primary large orange action driver */}
                                      <a 
                                        href={activeNote.driveLink || activeNote.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-center gap-2 px-6 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl text-xs sm:text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer w-full"
                                      >
                                        Open Notes <ArrowUpRight size={14} />
                                      </a>

                                      {/* secondary download action trigger if uploaded */}
                                      {activeNote.fileUrl && (
                                        <a 
                                          href={activeNote.fileUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="flex items-center justify-center gap-2 px-5 py-3.5 bg-neutral-50 border border-neutral-250 hover:bg-neutral-100 text-neutral-750 font-bold rounded-xl text-xs sm:text-sm shadow-sm transition-all active:scale-[0.98] cursor-pointer w-full"
                                        >
                                          <Download size={13} /> Download PDF
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            } else if (isAdmin) {
                              return (
                                /* Beautiful drop box for Administrator upload */
                                <div className="flex flex-col items-center justify-center h-auto text-center space-y-5 border-2 border-dashed border-neutral-200 bg-neutral-50/50 rounded-2xl p-6 py-8 md:py-12 select-none w-full">
                                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shadow-inner shrink-0">
                                    <Plus size={24} />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="font-extrabold text-neutral-800 text-sm">Upload Unit {expandedUnit + 1} Study Notes</p>
                                    <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">Configure a PDF record and/or Google Drive alternative link.</p>
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
                                <div className="flex flex-col items-center justify-center h-auto text-center space-y-4 py-8 md:py-12 select-none w-full">
                                  <div className="w-14 h-14 rounded-2xl bg-neutral-50 flex items-center justify-center text-neutral-300 shadow-inner shrink-0">
                                    <FileText size={28} />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="font-extrabold text-neutral-800 text-sm">No Notes Uploaded</p>
                                    <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">This academic resource has not been uploaded by the course coordinator yet.</p>
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
                                    try {
                                      await deleteDoc(doc(db, "resources", res.id));
                                      resourcesCacheRef.current = {};
                                      setResourceVersion(prev => prev + 1);
                                    } catch (err: any) {
                                      alert("Delete error: " + err.message);
                                    }
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
                    {isAdmin ? (
                      <span className="text-[8px] font-black uppercase text-orange-500 tracking-widest mt-1 leading-none">Admin</span>
                    ) : (
                      <span className="text-[8px] font-black uppercase text-neutral-400 tracking-widest mt-1 leading-none">Student</span>
                    )}
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

  const renderNotificationsList = () => {
    return (
      <AnimatePresence>
        {activeNotifications.length > 0 && (() => {
          const currentNotif = activeNotifications[0];
          return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 font-sans animate-fadeIn" id="notifications-overlay-container">
              {/* Backdrop overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => handleDismissNotification(currentNotif.id)}
                className="absolute inset-0 bg-neutral-950/60 backdrop-blur-[2px] cursor-pointer"
              />

              {/* Centered Modal Content Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 15 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="relative w-full max-w-lg bg-white rounded-[28px] border border-neutral-100 shadow-2xl p-6 md:p-8 overflow-y-auto max-h-[80vh] flex flex-col text-left z-10"
              >
                {/* Top Close Button icon */}
                <button
                  onClick={() => handleDismissNotification(currentNotif.id)}
                  className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-50 text-neutral-400 border border-neutral-100 hover:bg-neutral-100 hover:text-neutral-900 transition-colors shadow-sm cursor-pointer z-10"
                  title="Dismiss"
                >
                  <X size={13} />
                </button>

                <div className="flex flex-col gap-4 mt-2">
                  {/* Header badges */}
                  <div className="flex flex-wrap items-center gap-2 select-none">
                    <span className="flex h-5 items-center rounded-full bg-orange-500/10 border border-orange-500/20 px-2.5 text-[9px] font-black uppercase tracking-widest text-orange-600">
                      📢 Announcement
                    </span>
                    {currentNotif.priority === "high" && (
                      <span className="flex h-5 items-center rounded-full bg-red-500/10 border border-red-500/20 px-2.5 text-[9px] font-black uppercase tracking-widest text-red-500 animate-pulse">
                        🔥 HIGH PRIORITY
                      </span>
                    )}
                    {currentNotif.priority === "medium" && (
                      <span className="flex h-5 items-center rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 text-[9px] font-black uppercase tracking-widest text-[#d97706]">
                        ⚡ Update
                      </span>
                    )}
                  </div>

                  {/* Image display banner */}
                  {currentNotif.type === "image" && currentNotif.imageUrl && (
                    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-neutral-50 border border-neutral-100 shadow-sm">
                      <img
                        src={currentNotif.imageUrl}
                        alt={currentNotif.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  {/* Title & Description */}
                  <div className="space-y-1.5 select-text">
                    <h3 className="text-base md:text-xl font-black text-neutral-900 tracking-tight leading-snug animate-fadeIn">
                      {currentNotif.title}
                    </h3>
                    <p className="text-neutral-500 text-xs md:text-sm font-light leading-relaxed whitespace-pre-line break-words pt-1 select-text">
                      {currentNotif.description}
                    </p>
                  </div>

                  {/* Button links and close actions */}
                  <div className="flex flex-col gap-2.5 pt-2">
                    {currentNotif.buttonUrl && (
                      <a
                        href={currentNotif.buttonUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-orange-600 hover:scale-[1.005] active:scale-[0.995] shadow-md hover:shadow-orange-500/10 cursor-pointer border border-orange-500"
                      >
                        {currentNotif.buttonText || "Open Update"}
                        <ExternalLink size={12} />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDismissNotification(currentNotif.id)}
                      className="inline-flex w-full items-center justify-center rounded-xl bg-neutral-50 hover:bg-neutral-100 py-3 text-xs font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-800 transition-all cursor-pointer border border-neutral-200"
                    >
                      Dismiss & Close
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
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
              {userProfile && (
                <div className="flex flex-col items-end text-right border-r border-neutral-200 pr-3 mr-1">
                  <span className="text-[9px] md:text-[10px] uppercase font-black tracking-widest text-orange-500 leading-none">
                    🎓 Student
                  </span>
                  <span className="text-[9px] md:text-[10px] text-neutral-400 font-bold font-mono mt-1">
                    {userProfile.departmentCode} · Sec {userProfile.section} · Yr {userProfile.effectiveAcademicYear}
                  </span>
                </div>
              )}
              <div className="flex flex-col items-end text-right">
                <span className="text-[11px] md:text-xs font-bold text-neutral-900">{user.displayName}</span>
                {isAdmin ? (
                  <span className="text-[8px] md:text-[9px] font-black uppercase text-orange-500 tracking-widest mt-0.5 leading-none">Admin</span>
                ) : (
                  <span className="text-[8px] md:text-[9px] font-black uppercase text-neutral-400 tracking-widest mt-0.5 leading-none">Student</span>
                )}
              </div>
              {isAdmin && (
                <div className="flex gap-2 items-center flex-wrap">
                  <button 
                    onClick={() => {
                      setActiveAdminTab("norm");
                      setIsNormPanelOpen(true);
                    }}
                    className="px-3 py-1.5 md:px-4 md:py-2 rounded-xl bg-neutral-900 hover:bg-black text-white text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 shadow-sm font-sans cursor-pointer"
                    title="Database Normalization Suite"
                    id="admin-db-control-btn"
                  >
                    <Shield size={12} /> Database Hub
                  </button>
                  <button 
                    onClick={() => {
                      setActiveAdminTab("notifications");
                      setIsNormPanelOpen(true);
                    }}
                    className="px-3 py-1.5 md:px-4 md:py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 shadow-sm font-sans cursor-pointer"
                    title="Announcements & Notification Hub"
                    id="admin-notif-control-btn"
                  >
                    <Plus size={12} /> Notification Hub
                  </button>
                  <button 
                    onClick={() => {
                      setActiveAdminTab("events");
                      setIsNormPanelOpen(true);
                    }}
                    className="px-3 py-1.5 md:px-4 md:py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 shadow-sm font-sans cursor-pointer"
                    title="ZERO2ONE Events Engine"
                    id="admin-events-control-btn"
                  >
                    <Calendar size={12} /> ZERO2ONE Events
                  </button>
                </div>
              )}
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
              onClick={() => {
                setAuthError(null);
                setShowLoginModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-orange-500 text-white text-[10px] md:text-xs font-bold hover:bg-orange-600 transition-all hover:scale-105 active:scale-95 font-sans border border-orange-500 shadow-md shadow-orange-500/10 cursor-pointer"
            >
              <LogIn size={12} /> Sign In / Student Portal
            </button>
          )}
        </div>
      </div>
    </footer>
  );

  const renderSyllabusCopyView = () => {
    const subjects = getMergedSubjects();
    const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0);

    const getSubjectCreditBreakdown = (sub: any) => {
      if (sub.theoryCredits !== undefined && sub.labCredits !== undefined) {
        return {
          theory: Number(sub.theoryCredits),
          lab: Number(sub.labCredits),
          total: Number(sub.credits)
        };
      }
      
      const code = sub.code;
      const ltp = SUBJECT_LTP[code] || { L: 3, T: 0, P: 0 };
      const credits = Number(sub.credits || 4);
      
      let lab = 0;
      if (ltp.P === 6) {
        lab = 3;
      } else if (ltp.P === 2) {
        lab = 1;
      } else if (ltp.P > 0) {
        lab = Math.ceil(ltp.P / 2);
      }
      
      const theory = Math.max(0, credits - lab);
      return {
        theory,
        lab,
        total: credits
      };
    };

    const getSubjectLTP = (sub: any) => {
      if (typeof sub.lecture === "number") {
        return {
          L: sub.lecture,
          T: sub.tutorial ?? 0,
          P: sub.practical ?? 0
        };
      }
      const staticLtp = SUBJECT_LTP[sub.code];
      if (staticLtp) {
        return staticLtp;
      }
      const credits = sub.credits || 4;
      if (credits === 4) {
        if (sub.type === "BS" || sub.type === "PC") {
          return { L: 3, T: 1, P: 0 };
        }
        return { L: 3, T: 0, P: 2 };
      } else if (credits === 3) {
        return { L: 2, T: 0, P: 2 };
      } else if (credits === 2) {
        return { L: 1, T: 0, P: 2 };
      } else if (credits === 1) {
        return { L: 0, T: 0, P: 2 };
      }
      return { L: 3, T: 0, P: 0 };
    };

    const getSubjectDetailsForCode = (code: string) => {
      const upperCode = code.toUpperCase();
      if (SUBJECT_DETAILS[upperCode]) {
        return SUBJECT_DETAILS[upperCode];
      }
      const dynSub = dynamicSubjects.find(s => s.subjectCode === upperCode || s.code === upperCode || s.id === upperCode);
      if (dynSub) {
        return {
          title: dynSub.subjectName || dynSub.title || "Custom Subject",
          outcomes: dynSub.outcomes || [
            "Gain comprehensive theoretical and practical insights of the course curriculum.",
            "Apply subject guidelines to solve technical problems.",
            "Excel in examinations and secure higher academic grades."
          ],
          units: dynSub.units && dynSub.units.length > 0 ? dynSub.units : [
            { title: "UNIT I: Course Fundamentals", content: "Comprehensive overview of foundational modules, key definitions, and introduction to core subject systems." },
            { title: "UNIT II: Core Structural Methods", content: "Investigation of design models, operational paradigms, and mathematical or procedural algorithms." },
            { title: "UNIT III: Intermediate Applications", content: "Technical details of workflow execution, system parameters, and hands-on laboratory exercises." },
            { title: "UNIT IV: Advanced Integrations", content: "Complex architectures, performance analytics, mitigation techniques, and contemporary paradigms." },
            { title: "UNIT V: Practical Projects & Case Studies", content: "Review of typical autonomous exams, industrial application studies, and final project deliverables." }
          ]
        };
      }
      return {
        title: code,
        outcomes: ["Understand core concepts of " + code],
        units: [
          { title: "UNIT I: Introduction & Core Concepts", content: "Fundamental principles and overview of the course syllabus." },
          { title: "UNIT II: Intermediate Methods", content: "Core structural methodologies, calculations, and analytical components." },
          { title: "UNIT III: Advanced Frameworks", content: "In-depth case studies, problem solving matrices, and modeling." },
          { title: "UNIT IV: Contemporary Applications", content: "Real-world implementations, current trends, and system integration." },
          { title: "UNIT V: Practical Research", content: "Review guidelines, practical procedures, and advanced exercises." }
        ]
      };
    };

    return (
      <div className="min-h-screen bg-neutral-50/50 pb-24 font-sans selection:bg-orange-100/60">
        {/* Sticky Compact Top Navigation Header */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-100 px-4 py-4 min-h-[72px] flex items-center">
          <div className="max-w-6xl mx-auto w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <motion.button 
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/semester/${encodeURIComponent(selectedDept || "")}/${selectedSem || 1}`)} 
              className="flex items-center gap-2 text-neutral-400 hover:text-black transition-all font-bold uppercase tracking-wider text-[10px] md:text-xs"
            >
              <ArrowLeft size={14} className="md:w-4 md:h-4" /> Back to Choice
            </motion.button>
            
            <div className="flex flex-col text-left sm:text-right">
              <span className="text-[9px] md:text-[10px] font-extrabold uppercase tracking-widest text-orange-500 line-clamp-1">{selectedDept}</span>
              <span className="text-xs md:text-sm font-bold text-neutral-900 mt-0.5">Year 0{selectedYear || 1} // Semester 0{selectedSem}</span>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 md:p-8 lg:p-12 space-y-8 md:space-y-12">
          {/* Bento Header Cards */}
          <div className="space-y-4 md:space-y-6">
            <div className="space-y-1 md:space-y-2 text-center md:text-left">
              <span className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-extrabold text-orange-500">SCHEME OF INSTRUCTION</span>
              <h2 className="text-2xl md:text-4xl font-black text-neutral-950 tracking-tight">Syllabus Copy & Credits Table</h2>
              <p className="text-neutral-500 text-xs md:text-sm font-light w-full max-w-2xl leading-relaxed">
                Official course structure outline for computer programs and autonomous engineering studies. Click any course tile below to read unit breakdown and expected curriculum outcomes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-6">
              <div className="p-6 rounded-3xl bg-white border border-neutral-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
                  <Layers size={20} />
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Branch</span>
                  <p className="font-extrabold text-neutral-950 text-sm md:text-base leading-snug">{selectedDept}</p>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-white border border-neutral-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Year / Sem</span>
                  <p className="font-extrabold text-neutral-950 text-sm md:text-base leading-snug">Year 0{selectedYear || 1} - Sem 0{selectedSem}</p>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-white border border-neutral-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
                  <Award size={20} />
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Academic Weight</span>
                  <p className="font-extrabold text-neutral-950 text-sm md:text-base leading-snug">Total Credits: {totalCredits}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Scheme Table Card */}
          <div className="bg-white rounded-[32px] border border-neutral-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-neutral-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h3 className="font-extrabold text-neutral-900 tracking-tight">Structured Course Sequence</h3>
                <p className="text-xs text-neutral-400 font-light mt-0.5">Syllabus copies synchronized dynamically from safe Firestore databases</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-50 border border-neutral-100 text-neutral-500 text-[10px] font-semibold">
                <Sparkles size={11} className="text-orange-500" /> Database-Driven
              </span>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] md:text-[11px] uppercase tracking-widest font-extrabold text-neutral-400 border-b border-neutral-100 bg-neutral-50/50">
                    <th className="px-6 py-4 w-12 text-center">S.No</th>
                    <th className="px-4 py-4 w-32">Course Code</th>
                    <th className="px-4 py-4 w-24">Category</th>
                    <th className="px-4 py-4 text-center w-28">Theory Credits</th>
                    <th className="px-4 py-4 text-center w-28">Lab Credits</th>
                    <th className="px-4 py-4 text-center w-28">Total Credits</th>
                    <th className="px-6 py-4">Course Title</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {subjects.map((subject, index) => {
                    const creditBreakdown = getSubjectCreditBreakdown(subject);
                    const isExpanded = expandedSyllabusSubject === subject.code;
                    const details = getSubjectDetailsForCode(subject.code);
                    return (
                      <Fragment key={subject.code}>
                        <tr 
                          onClick={() => {
                            setExpandedSyllabusSubject(isExpanded ? null : subject.code);
                          }} 
                          className={`group hover:bg-neutral-50/50 transition-colors duration-200 cursor-pointer text-xs md:text-sm ${isExpanded ? "bg-orange-50/30 hover:bg-orange-50/40" : ""}`}
                        >
                          <td className="px-6 py-4.5 font-bold text-neutral-400 text-center">{index + 1}</td>
                          <td className="px-4 py-4.5">
                            <span className="px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-700 font-mono text-[11px] font-bold uppercase border border-neutral-200/50">
                              {subject.code}
                            </span>
                          </td>
                          <td className="px-4 py-4.5 font-bold text-neutral-500 uppercase">{subject.type}</td>
                          <td className="px-4 py-4.5 text-center font-mono text-neutral-600">{creditBreakdown.theory}</td>
                          <td className="px-4 py-4.5 text-center font-mono text-neutral-600">{creditBreakdown.lab}</td>
                          <td className="px-4 py-4.5 text-center font-extrabold text-[#0a0a0a]">{creditBreakdown.total}</td>
                          <td className="px-6 py-4.5">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-neutral-900 group-hover:text-orange-500 transition-colors">
                                {subject.title || subject.subjectName}
                              </span>
                              <ChevronDown size={14} className={`text-neutral-400 transition-transform duration-300 ${isExpanded ? "rotate-180 text-orange-500" : "group-hover:translate-y-0.5"}`} />
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-neutral-50/70 border-b border-neutral-100">
                            <td colSpan={7} className="p-4 md:p-8 text-left bg-neutral-50/20">
                              <motion.div 
                                initial={{ opacity: 0, y: -8 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                transition={{ duration: 0.25 }}
                                className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8"
                              >
                                {/* Left Side Details Panel */}
                                <div className="space-y-6 bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm h-fit">
                                  <div>
                                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-orange-500">Course Metadata</span>
                                    <h4 className="text-base font-black text-neutral-900 tracking-tight mt-0.5">{details.title}</h4>
                                    <p className="text-[11px] text-neutral-400 font-mono mt-1">Code: {subject.code} | {subject.type} Course</p>
                                  </div>
 
                                  <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                                    <div>
                                      <div className="text-[10px] text-neutral-400 font-medium uppercase">Theory Credits</div>
                                      <div className="font-mono text-sm font-extrabold text-neutral-800">{creditBreakdown.theory}</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-neutral-405 font-medium uppercase">Lab Credits</div>
                                      <div className="font-mono text-sm font-extrabold text-neutral-800">{creditBreakdown.lab}</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-orange-500 font-extrabold uppercase font-sans">Total Credits</div>
                                      <div className="font-mono text-sm font-black text-orange-600">{creditBreakdown.total}</div>
                                    </div>
                                  </div>
 
                                  <div className="space-y-3">
                                    <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-900 flex items-center gap-1.5 border-b border-neutral-100 pb-2">
                                      <Award size={13} className="text-orange-500" /> Learning Outcomes
                                    </h5>
                                    <ul className="space-y-2 text-xs text-neutral-600 leading-relaxed font-light pl-4 list-decimal">
                                      {details.outcomes.map((out, idx) => (
                                        <li key={idx}>{out}</li>
                                      ))}
                                    </ul>
                                  </div>
 
                                  {isAdmin && (
                                    <div className="pt-2 flex flex-col gap-2 border-t border-neutral-100 pt-4">
                                      <div className="text-[9px] font-extrabold uppercase text-orange-650 tracking-wider">Administrative Master Node Actions:</div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSubjectFormCode(subject.code);
                                            setSubjectFormName(subject.title || subject.subjectName);
                                            setSubjectFormSem(selectedSem || 1);
                                            setSubjectFormType(subject.type || "PC");
                                            setSubjectFormDepts(subject.linked_departments || [selectedDept]);
                                            setSubjectFormSemMapping(subject.semester_mapping || {});
                                            
                                            // Populate correct credit breakdown
                                            setSubjectFormTheoryCredits(creditBreakdown.theory);
                                            setSubjectFormLabCredits(creditBreakdown.lab);
                                            setSubjectFormCredits(creditBreakdown.total);
                                            
                                            setEditingSubject(subject);
                                            setIsSubjectModalOpen(true);
                                          }}
                                          className="flex-1 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-sans font-bold transition-all border border-neutral-200 cursor-pointer flex items-center justify-center gap-1"
                                        >
                                          <Layers size={11} /> Edit Subject
                                        </button>
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            if (window.confirm(`Are you absolutely sure you want to delete ${subject.code}: ${subject.title || subject.subjectName}? This will remove it from the database.`)) {
                                              try {
                                                const { doc, deleteDoc } = await import("firebase/firestore");
                                                await deleteDoc(doc(db, "subjects", subject.code));
                                                setSubjectVersion(prev => prev + 1);
                                                alert("Subject deleted successfully.");
                                              } catch (err: any) {
                                                alert("Error deleting subject: " + err.message);
                                              }
                                            }
                                          }}
                                          className="py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-650 text-[11px] font-sans font-bold transition-all border border-red-200 cursor-pointer flex items-center justify-center gap-1 animate-fadeIn"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </div>
                                  )}
 
                                  <div className="pt-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/subject/${subject.code}/resources`);
                                      }}
                                      className="w-full py-2.5 rounded-xl bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.98] transition-all text-xs font-bold shadow-sm shadow-orange-500/10 hover:shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-2"
                                    >
                                      <Sparkles size={13} /> View Notes & PYQs Board
                                    </button>
                                  </div>
                                </div>
 
                                {/* Right Side Units breakdown */}
                                <div className="lg:col-span-2 space-y-4">
                                  <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                                    <Layers size={13} className="text-orange-500" /> Unit-Wise Detailed Syllabus
                                  </h5>
                                  <div className="space-y-3">
                                    {details.units.map((unit: any, uIdx: number) => (
                                      <div key={uIdx} className="bg-white rounded-xl border border-neutral-100 p-4 shadow-sm hover:border-neutral-200 transition-all">
                                        <h6 className="text-xs font-extrabold text-neutral-900 flex items-center gap-2">
                                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> {unit.title}
                                        </h6>
                                        <p className="text-xs text-neutral-500 font-light leading-relaxed mt-2 pl-3.5">
                                          {unit.content}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  
                  {/* Totals Row */}
                  <tr className="bg-neutral-50/40 font-bold border-t border-neutral-100 text-xs md:text-sm">
                    <td className="px-6 py-4 text-neutral-400 text-center">-</td>
                    <td className="px-4 py-4 text-neutral-400 uppercase">Total</td>
                    <td className="px-4 py-4 text-neutral-400 uppercase">-</td>
                    <td className="px-4 py-4 text-center font-mono text-neutral-600">
                      {subjects.reduce((sum, s) => sum + getSubjectCreditBreakdown(s).theory, 0)}
                    </td>
                    <td className="px-4 py-4 text-center font-mono text-neutral-600">
                      {subjects.reduce((sum, s) => sum + getSubjectCreditBreakdown(s).lab, 0)}
                    </td>
                    <td className="px-4 py-4 text-center font-black text-orange-600 text-sm md:text-base">
                      {totalCredits}
                    </td>
                    <td className="px-6 py-4 text-neutral-400 font-light">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Quick Notice Card */}
          <div className="p-6 md:p-8 rounded-[32px] bg-gradient-to-br from-neutral-900 to-neutral-800 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_50%)]" />
            <div className="space-y-1.5 relative z-10 text-left">
              <h4 className="font-bold text-base md:text-lg tracking-tight">Need Detailed Topic Breakdowns?</h4>
              <p className="text-neutral-400 text-xs font-light max-w-xl leading-relaxed">
                Click on any course row in the scheme table above to enter the immersive syllabus viewer, explaining course outcomes, textbook suggestions, and topic-wise unit content.
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (subjects.length > 0) navigate(`/subject/${subjects[0].code}`);
              }}
              className="px-6 py-3 rounded-full bg-white text-neutral-950 font-bold hover:bg-neutral-50 transition-all text-xs shrink-0 relative z-10 border border-neutral-100 shadow-sm cursor-pointer"
            >
              Start Exploring Details
            </motion.button>
          </div>
        </main>
      </div>
    );
  };

  const renderSyllabusView = () => {
    const subjects = getMergedSubjects();
    const currentActiveSubject = activeSubject || (subjects.length > 0 ? subjects[0].code : null);
    const activeSubjectData = getActiveSubjectData();
    const selectedSubjectObj = subjects.find(s => s.code === currentActiveSubject);

    return (
      <div className="min-h-screen bg-white overflow-y-auto pb-24 font-sans selection:bg-orange-100/60">
        
        {/* Sticky Compact Top Navigation Header */}
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-neutral-100/80 px-4 py-4 transition-all">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-6">
            <motion.button 
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/semester/${encodeURIComponent(selectedDept || "")}/${selectedSem || 1}`)} 
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
                      onClick={() => navigate(`/subject/${subject.code}`)}
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
                            onClick={() => navigate(`/subject/${subject.code}`)} 
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
                ) : activeSubject ? (
                  <div className="h-[350px] rounded-[28px] border-[3px] border-dashed border-red-200 flex flex-col items-center justify-center p-10 text-center space-y-4 bg-white animate-fadeIn">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 shadow-sm"><X size={26} /></div>
                    <div className="space-y-1">
                      <p className="text-sm font-extrabold text-red-500 uppercase tracking-widest">Subject Not Found</p>
                      <p className="text-xs text-neutral-400 max-w-sm">The subject code <span className="font-mono text-red-600 font-semibold bg-red-50 px-1.5 py-0.5 rounded border border-red-100">{activeSubject}</span> was not found in our database.</p>
                    </div>
                    <button 
                      onClick={() => navigate(`/semester/${encodeURIComponent(selectedDept || "")}/${selectedSem || 1}`)}
                      className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 transition-colors text-xs font-bold text-neutral-800 rounded-xl border border-neutral-200 cursor-pointer shadow-sm"
                    >
                      Return to Choice Selection
                    </button>
                  </div>
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

  const render404Page = () => {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col justify-center items-center p-5 md:p-12 text-center overflow-hidden relative">
        {/* Decorative elements */}
        <div className="absolute inset-0 z-0 select-none pointer-events-none">
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-orange-500/10 blur-[120px] rounded-full" />
          <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] bg-orange-500/10 blur-[130px] rounded-full" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full space-y-8 z-10"
        >
          <div className="space-y-4">
            <span className="text-[10px] md:text-xs font-mono font-bold tracking-[0.3em] text-orange-500 uppercase">ERROR 404</span>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white">LOST IN <span className="text-orange-500">SPACE</span></h1>
            <p className="text-neutral-400 text-xs md:text-sm font-light leading-relaxed max-w-sm mx-auto">
              The page you are looking for doesn't exist, was renamed, or has departed to another orbit.
            </p>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/")}
              className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all cursor-pointer border-none"
            >
              <ArrowLeft size={16} /> Return to Home Orbit
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => window.history.back()}
              className="w-full bg-white/5 border border-white/10 text-neutral-300 hover:text-white font-semibold py-4 rounded-2xl shadow-inner hover:bg-white/10 transition-all cursor-pointer"
            >
              Go Back One Step
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  };

  const renderLoginScreen = () => {
    return (
      <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center p-6 font-sans relative overflow-hidden">
        {/* Decorative Grid and Ambient Lights */}
        <div className="absolute inset-0 z-0 opacity-40">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #e5e5e0 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-orange-200/40 blur-[100px] rounded-full" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-100/40 blur-[120px] rounded-full" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="relative z-10 w-full max-w-md bg-white border border-neutral-200/80 rounded-[32px] p-8 md:p-10 shadow-2xl shadow-neutral-100/70"
        >
          {/* Logo */}
          <div className="flex flex-col items-center text-center space-y-4 mb-8">
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 2 }}
              className="w-16 h-16 bg-neutral-900 rounded-3xl flex items-center justify-center shadow-xl shadow-neutral-950/20 cursor-pointer"
            >
              <img 
                src="https://raw.githubusercontent.com/jampanapadmaja/ZERO2ONE/main/logo.png" 
                alt="ZERO2ONE" 
                className="w-11 h-11 object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://img.icons8.com/color/96/graduation-cap.png"; }}
              />
            </motion.div>
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tighter text-neutral-900 uppercase">ZERO<span className="text-orange-500">2</span>ONE</h1>
              <p className="text-xs text-neutral-400 font-medium tracking-wide">Official Anurag University Student Platform</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-bold text-neutral-900">Student Portal Access</h2>
              <p className="text-xs text-neutral-500 mt-1">Please sign in with your Anurag University college-issued email account <strong className="text-neutral-700">@anurag.edu.in</strong> to browse and download materials.</p>
            </div>

            {authError && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-xs font-semibold leading-relaxed flex items-start gap-2.5"
              >
                <Shield size={16} className="text-red-500 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-[#0a0a0a] text-white font-bold text-sm hover:bg-neutral-800 transition-all shadow-xl shadow-neutral-950/10 hover:shadow-xl hover:shadow-orange-500/10 active:scale-95 cursor-pointer"
            >
              <LogIn size={18} />
              Sign in with Google
            </motion.button>
          </div>

          <div className="mt-8 pt-6 border-t border-neutral-100 flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-[#a3a3a3]">
            <span>STK // 2026</span>
            <a href="mailto:zero2onestudypartner@gmail.com" className="hover:text-neutral-600 underline">Get Help</a>
          </div>
        </motion.div>
      </div>
    );
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#fafaf9] flex flex-col items-center justify-center font-sans">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-neutral-500 text-sm font-semibold tracking-wider animate-pulse uppercase">Syncing ZERO2ONE Session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] text-[#0a0a0a] font-sans selection:bg-orange-100">
      {renderNotificationsList()}
      <AnimatePresence mode="wait">
        {isRoute404 ? (
          <motion.div key="404" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {render404Page()}
          </motion.div>
        ) : (
          <div key="content" className="w-full">
            {!location.pathname.startsWith("/events") && (
              <>
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
                    {userProfile && academicMode === null ? renderAcademicModeSelection() : renderSemSelection()}
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
                {viewState === "syllabus-copy-view" && (
                  <motion.div key="syllabus-copy" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                    {renderSyllabusCopyView()}
                  </motion.div>
                )}
                {viewState === "dashboard" && (
                  <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {userProfile && academicMode === null ? renderAcademicModeSelection() : renderDashboard()}
                  </motion.div>
                )}
                {viewState === "profile-page" && (
                  <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {renderProfilePage()}
                  </motion.div>
                )}
                {viewState === "tools-page" && (
                  <motion.div key="tools" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <ToolsModule 
                      userProfile={userProfile}
                      navigate={navigate}
                      showToast={showToast}
                      activeSubView={toolsSubView}
                      setActiveSubView={setToolsSubView}
                      setViewState={setViewState}
                      getFallbackSyllabusList={getFallbackSyllabusList}
                    />
                  </motion.div>
                )}
              </>
            )}
            {location.pathname.startsWith("/events") && (
              <Routes>
                <Route path="/events" element={<EventsListingPage currentUserEmail={user?.email} currentUserId={user?.uid} isAdmin={isAdmin} />} />
                <Route path="/events/:eventId" element={<PublicEventPage onNavigateHome={() => navigate("/events")} />} />
                <Route path="/events/:eventId/join" element={<ParticipantJoinPage />} />
                <Route path="/events/:eventId/onboarding" element={<ParticipantOnboardingPage />} />
                <Route path="/events/:eventId/room" element={<EventRoomPage currentUserEmail={user?.email} currentUserId={user?.uid} isAdmin={isAdmin} />} />
                <Route path="/events/:eventId/participant/:participantId" element={<ParticipantProfilePage />} />

                {/* Protect Admin Event Routes */}
                <Route path="/events/create" element={isAdmin ? <EventsModule currentUserEmail={user?.email} currentUserId={user?.uid} isAdmin={isAdmin} /> : <UnauthorizedAdminPage />} />
                <Route path="/events/manage" element={isAdmin ? <EventsModule currentUserEmail={user?.email} currentUserId={user?.uid} isAdmin={isAdmin} /> : <UnauthorizedAdminPage />} />
                <Route path="/events/edit/:eventId" element={isAdmin ? <EventsModule currentUserEmail={user?.email} currentUserId={user?.uid} isAdmin={isAdmin} /> : <UnauthorizedAdminPage />} />
                <Route path="/events/delete/:eventId" element={isAdmin ? <EventsModule currentUserEmail={user?.email} currentUserId={user?.uid} isAdmin={isAdmin} /> : <UnauthorizedAdminPage />} />
              </Routes>
            )}
          </div>
        )}
      </AnimatePresence>
      {!isRoute404 && !location.pathname.startsWith("/events") && viewState !== "sem-selection" && viewState !== "choice-selection" && viewState !== "resources-view" && viewState !== "syllabus-copy-view" && viewState !== "dashboard" && viewState !== "profile-page" && viewState !== "tools-page" && renderFooter()}

      {renderMobileBottomNav()}
      {renderNotificationsDrawer()}

      {toast && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-[99999] bg-[#141414] border border-orange-500/20 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-sans text-xs font-bold leading-none select-none max-w-sm">
          <Sparkles size={14} className="text-orange-500 animate-pulse" />
          <span>{toast.message}</span>
        </div>
      )}

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

      {/* Database Normalization Panel Suite Modal */}
      <AnimatePresence>
        {isNormPanelOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (normStatus !== "running") {
                  setIsNormPanelOpen(false);
                }
              }}
              className="absolute inset-0 bg-neutral-950/60 backdrop-blur-md"
            />

            <motion.div 
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.35 }}
              className={`relative w-full ${activeAdminTab === "notifications" || activeAdminTab === "ai_syllabus" || activeAdminTab === "events" ? "max-w-4xl" : "max-w-xl"} ${activeAdminTab === "events" ? "bg-[#0a0a0a] text-white border-neutral-800" : "bg-white text-neutral-900 border-neutral-100"} rounded-[28px] border shadow-2xl p-6 md:p-8 overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full filter blur-xl translate-x-12 -translate-y-12" />
              
              {/* Header and Tab Control */}
              <div className="relative flex flex-col gap-4 pb-4 border-b border-neutral-800 select-none mb-5">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest block mb-0.5">Academic Master Control</span>
                    <h3 className={`text-base md:text-lg font-black font-sans tracking-tight leading-none ${activeAdminTab === "events" ? "text-white" : "text-neutral-900"}`}>ZERO2ONE Admin Console</h3>
                  </div>
                  {normStatus !== "running" && !notifSaving && (
                    <button 
                      onClick={() => setIsNormPanelOpen(false)}
                      className={`p-1.5 rounded-full transition-colors cursor-pointer ${activeAdminTab === "events" ? "hover:bg-neutral-800 text-neutral-400 hover:text-white" : "hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900"}`}
                    >
                      <Minimize2 size={16} />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 md:gap-4">
                  <button
                    type="button"
                    onClick={() => setActiveAdminTab("norm")}
                    className={`pb-1 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${activeAdminTab === "norm" ? "border-orange-500 text-orange-600" : "border-transparent text-neutral-400 hover:text-neutral-600"}`}
                  >
                    Academic Resources
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveAdminTab("notifications")}
                    className={`pb-1 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${activeAdminTab === "notifications" ? "border-orange-500 text-orange-600" : "border-transparent text-neutral-400 hover:text-neutral-600"}`}
                  >
                    Notification Hub
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveAdminTab("events")}
                    className={`pb-1 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${activeAdminTab === "events" ? "border-orange-500 text-orange-500 font-extrabold" : "border-transparent text-neutral-400 hover:text-neutral-300"}`}
                  >
                    <Calendar size={12} /> ZERO2ONE Events
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveAdminTab("ai_syllabus")}
                    className={`pb-1 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${activeAdminTab === "ai_syllabus" ? "border-orange-500 text-orange-600" : "border-transparent text-neutral-400 hover:text-neutral-600"}`}
                  >
                    AI Syllabus Sync
                  </button>
                </div>
              </div>

              {activeAdminTab === "events" ? (
                <div className="flex-1 overflow-y-auto pr-1">
                  <EventsModule currentUserEmail={user?.email} currentUserId={user?.uid} isAdmin={isAdmin} />
                </div>
              ) : activeAdminTab === "norm" ? (
                <>
                  <div className="space-y-4 overflow-y-auto flex-1 pr-1.5 scrollbar-thin">
                    <p className="text-xs text-neutral-500 leading-relaxed">
                      Analyze, deduplicate and transition your course syllabus subjects and uploaded resource files into a centralized data model. Duplicate subject code nodes will be cataloged and mapped under a singular core document.
                    </p>

                    {/* Log Output Console board */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block font-sans">Execution Output Log</span>
                      <div className="bg-neutral-950 font-mono text-emerald-400 text-[10px] md:text-xs p-4 rounded-2xl max-h-48 overflow-y-auto mb-1 border border-neutral-800 space-y-1 shadow-inner">
                        {normLogs.length === 0 ? (
                          <span className="text-neutral-500 italic">// Console Idle. State mapping loaded. Ready to run...</span>
                        ) : (
                          normLogs.map((log, index) => (
                            <div key={index} className="leading-relaxed animate-fadeIn">
                              <span className="text-neutral-600 mr-2 font-bold select-none">&gt;&gt;</span>
                              {log}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {normStatus === "success" && (
                      <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded-xl text-xs font-bold leading-normal">
                        ✓ Success: Master database normalization complete! Over 100 duplicate relationships resolved correctly offline.
                      </div>
                    )}

                    {normStatus === "error" && (
                      <div className="p-3 bg-red-50 text-red-600 border border-red-150 rounded-xl text-xs font-bold leading-normal">
                        ⚠️ Error encountered. Check the log statements in the console panel above.
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-neutral-100 flex flex-wrap gap-2.5 justify-end items-center">
                    <button 
                      type="button"
                      disabled={normStatus === "running"}
                      onClick={() => {
                        setSubjectFormCode("");
                        setSubjectFormName("");
                        setSubjectFormSem(selectedSem || 1);
                        setSubjectFormDepts(selectedDept ? [selectedDept] : []);
                        setSubjectFormSemMapping(selectedDept ? { [selectedDept]: selectedSem || 1 } : {});
                        setSubjectFormTheoryCredits(3);
                        setSubjectFormLabCredits(0);
                        setSubjectFormCredits(3);
                        setEditingSubject(null);
                        setSubjectFormError("");
                        setIsSubjectModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Layers size={12} /> + Custom Subject
                    </button>

                    {normStatus !== "running" ? (
                      <button 
                        type="button"
                        onClick={runDatabaseNormalization}
                        className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                      >
                        <Sparkles size={13} />
                        Run Normalization Suite
                      </button>
                    ) : (
                      <button 
                        type="button"
                        disabled
                        className="px-5 py-2.5 rounded-xl bg-neutral-200 text-neutral-400 font-bold text-xs transition-all flex items-center gap-1.5"
                      >
                        <Sparkles size={13} className="animate-spin" />
                        Running Migration...
                      </button>
                    )}
                  </div>
                </>
              ) : activeAdminTab === "notifications" ? (
                <div className="space-y-6 flex-1 overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    
                    {/* Left Column: Form to create notification */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-600">🚀 Publish Announcement</h4>
                      
                      {notifError && (
                        <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold leading-normal">
                          ⚠️ {notifError}
                        </div>
                      )}

                      <form onSubmit={handlePublishNotification} className="space-y-3 font-sans">
                        {/* Title */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-neutral-400 select-none">Title *</label>
                          <input
                            type="text"
                            value={notifTitle}
                            onChange={(e) => setNotifTitle(e.target.value)}
                            placeholder="e.g. 📚 PYQs (2019-2025) Uploaded"
                            required
                            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-900 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                          />
                        </div>

                        {/* Description */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-neutral-400 select-none">Description *</label>
                          <textarea
                            value={notifDescription}
                            onChange={(e) => setNotifDescription(e.target.value)}
                            placeholder="Engineering Physics PYQs are now available in Drive backup..."
                            required
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-900 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none resize-none"
                          />
                        </div>

                        {/* Type selection */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-neutral-400 select-none">Type</label>
                          <select
                            value={notifType}
                            onChange={(e) => setNotifType(e.target.value as any)}
                            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-900 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                          >
                            <option value="text">Plain Text Notification</option>
                            <option value="image">Image Banner Notification</option>
                            <option value="link">Anchor Link Notification</option>
                          </select>
                        </div>

                        {/* Image file selector */}
                        {notifType === "image" && (
                          <div className="space-y-2 animate-fadeIn text-left">
                            <div className="flex justify-between items-center">
                              <label className="text-[9px] font-black uppercase text-neutral-400 select-none">Image Source</label>
                              <div className="flex gap-1.5 bg-neutral-100/80 p-0.5 rounded-lg border border-neutral-200/50">
                                <button
                                  type="button"
                                  onClick={() => setNotifImageSource("upload")}
                                  className={`px-2 py-0.5 rounded-md text-[9px] font-bold cursor-pointer transition-all ${notifImageSource === "upload" ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
                                >
                                  Upload File
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNotifImageSource("url")}
                                  className={`px-2 py-0.5 rounded-md text-[9px] font-bold cursor-pointer transition-all ${notifImageSource === "url" ? "bg-white text-orange-600 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
                                >
                                  Direct URL
                                </button>
                              </div>
                            </div>

                            {notifImageSource === "upload" ? (
                              <div className="relative border border-solid border-neutral-200 rounded-xl p-3 text-center bg-neutral-50/50 hover:bg-neutral-50 hover:border-orange-500/60 transition-colors cursor-pointer select-none">
                                <input
                                  type="file"
                                  accept="image/*"
                                  required={notifImageSource === "upload" && !notifFile}
                                  onChange={(e) => setNotifFile(e.target.files ? e.target.files[0] : null)}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                                <div className="text-neutral-400 text-[10px]">
                                  {notifFile ? (
                                    <span className="text-orange-600 font-bold">✓ {notifFile.name} (Ready)</span>
                                  ) : (
                                    <span>Drag & Drop or Click to Select File</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <input
                                type="url"
                                value={notifImageUrl}
                                onChange={(e) => setNotifImageUrl(e.target.value)}
                                placeholder="Paste direct image link (e.g. https://imgur.com/...png)"
                                required={notifImageSource === "url"}
                                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-900 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                              />
                            )}
                          </div>
                        )}

                        {/* Button Link settings */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-neutral-400 select-none">Button Text</label>
                            <input
                              type="text"
                              value={notifButtonText}
                              onChange={(e) => setNotifButtonText(e.target.value)}
                              placeholder="e.g. Open Notes"
                              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-neutral-900 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-neutral-400 select-none">Button URL</label>
                            <input
                              type="url"
                              value={notifButtonUrl}
                              onChange={(e) => setNotifButtonUrl(e.target.value)}
                              placeholder="https://drive.google.com/..."
                              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-neutral-900 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                            />
                          </div>
                        </div>

                        {/* Priority and Expiry settings */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-neutral-400 select-none">Priority</label>
                            <select
                              value={notifPriority}
                              onChange={(e) => setNotifPriority(e.target.value as any)}
                              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-neutral-900 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                            >
                              <option value="low">Low Priority</option>
                              <option value="medium">Medium Priority</option>
                              <option value="high">High Priority</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-neutral-400 select-none">Expiry Date</label>
                            <input
                              type="date"
                              value={notifExpiresAt}
                              onChange={(e) => setNotifExpiresAt(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-neutral-900 text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                            />
                          </div>
                        </div>

                        {notifSaving && uploadProgress !== null && (
                          <div className="space-y-1.5 pt-2">
                            <div className="flex justify-between items-center text-[10px] text-neutral-500 font-bold">
                              <span>Image Upload Progress</span>
                              <span>{uploadProgress}%</span>
                            </div>
                            <div className="w-full h-2 bg-neutral-150 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-orange-500 transition-all duration-300" 
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="pt-3">
                          <button
                            type="submit"
                            disabled={notifSaving}
                            className="w-full px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 font-extrabold text-xs uppercase tracking-wider text-white transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            {notifSaving ? (
                              <>
                                <Sparkles size={12} className="animate-spin" /> {uploadProgress !== null && uploadProgress > 0 ? `Uploading ${uploadProgress}%...` : "Publishing..."}
                              </>
                            ) : "Publish Announcement"}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Right Column: Existing Announcements list */}
                    <div className="space-y-4 font-sans text-left">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-900">📊 Published Alerts ({notifications.length})</h4>
                      
                      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                        {notifications.length === 0 ? (
                          <div className="text-center p-6 border border-dashed border-neutral-250 rounded-2xl text-[10px] md:text-xs text-neutral-400 select-none">
                            No announcements active in database.
                          </div>
                        ) : (
                          notifications
                            .sort((a, b) => {
                              const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                              const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                              return tB - tA;
                            })
                            .map((notif) => (
                              <div key={notif.id} className="p-3 border border-neutral-100 rounded-2xl bg-neutral-50/70 hover:bg-neutral-50 transition-colors flex flex-col gap-1.5 relative select-none">
                                <div className="flex justify-between items-start">
                                  <div className="space-y-0.5">
                                    <h5 className="font-extrabold text-neutral-900 text-xs leading-none line-clamp-1">{notif.title}</h5>
                                    <div className="flex gap-2 items-center">
                                      <span className="text-[8px] font-mono text-neutral-400">ID: {notif.id.substring(0, 6)}</span>
                                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${notif.active ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-neutral-100 text-neutral-500 border border-neutral-200"}`}>
                                        {notif.active ? "ACTIVE" : "MUTED"}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleActiveNotification(notif.id, notif.active)}
                                      className={`px-1.5 py-0.5 rounded font-black text-[8px] cursor-pointer border ${notif.active ? "bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100"}`}
                                    >
                                      {notif.active ? "Mute" : "Unmute"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteNotification(notif.id)}
                                      className="p-0.5 rounded bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 cursor-pointer"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                // This is our brand new dynamic AI extraction tab!
                <div className="space-y-5 flex-1 overflow-y-auto pr-1 select-none">
                  <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex gap-3 items-center">
                      <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600">
                        <Bot size={20} />
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs font-black text-neutral-900 leading-none">PDF Content Extraction Engine</h4>
                        <p className="text-[10px] text-neutral-500 mt-1">
                          Uses <span className="font-bold text-orange-600">Gemini 3.5 Flash</span> to scan B Tech Curriculum_copy.pdf.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
                      {/* Dept dropdown */}
                      <div className="flex flex-col gap-1 w-full sm:w-auto text-left">
                        <span className="text-[8px] font-black uppercase text-neutral-400">Department</span>
                        <select
                          value={aiSelectedDept}
                          onChange={(e) => setAiSelectedDept(e.target.value)}
                          className="px-3 py-1.5 rounded-lg border border-neutral-200 text-[11px] font-sans text-neutral-800 outline-none focus:border-orange-500 bg-white"
                        >
                          {DEPARTMENTS.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>

                      {/* Sem selection */}
                      <div className="flex flex-col gap-1 w-full sm:w-auto text-left">
                        <span className="text-[8px] font-black uppercase text-neutral-400">Semester</span>
                        <select
                          value={aiSelectedSem}
                          onChange={(e) => setAiSelectedSem(parseInt(e.target.value))}
                          className="px-3 py-1.5 rounded-lg border border-neutral-200 text-[11px] font-sans text-neutral-800 outline-none focus:border-orange-500 bg-white"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                            <option key={sem} value={sem}>Semester {sem}</option>
                          ))}
                        </select>
                      </div>

                      <div className="pt-3 w-full sm:w-auto sm:self-end">
                        <button
                          type="button"
                          disabled={aiIsParsing || aiIsSaving}
                          onClick={handleAiParseSyllabus}
                          className="w-full sm:w-auto px-4 py-1.5 bg-neutral-900 hover:bg-black text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-neutral-200 disabled:text-neutral-400"
                        >
                          {aiIsParsing ? (
                            <>
                              <RotateCw size={11} className="animate-spin" /> Mining...
                            </>
                          ) : (
                            <>
                              <Sparkles size={11} /> Scan PDF
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {aiError && (
                    <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold leading-normal text-left">
                      ⚠️ {aiError}
                    </div>
                  )}

                  {aiIsParsing && (
                    <div className="py-12 flex flex-col items-center justify-center gap-4 text-center animate-pulse">
                      <div className="p-4 rounded-full bg-orange-50 text-orange-600 animate-spin border border-orange-100">
                        <RotateCw size={24} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-black text-neutral-800">Gemini-3.5-Flash is processing the curriculum PDF...</p>
                        <p className="text-[10px] text-neutral-400 max-w-xs mx-auto">
                          Analyzing course syllabi, credits distribution, unit descriptions, and student outcomes. This typically takes 15-30 seconds.
                        </p>
                      </div>
                    </div>
                  )}

                  {aiIsSaving && (
                    <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                      <div className="p-3 rounded-full bg-emerald-50 text-emerald-600 animate-bounce">
                        <Sparkles size={24} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-black text-neutral-800 font-sans">Saving syllabus cards to Firestore...</p>
                        <p className="text-[10px] text-neutral-400 font-mono italic">
                          {aiSaveProgress}
                        </p>
                      </div>
                    </div>
                  )}

                  {!aiIsParsing && !aiIsSaving && aiSubjects && (
                    <div className="space-y-4 animate-fadeIn text-left font-sans">
                      <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                        <div>
                          <p className="text-xs font-black text-emerald-800">
                            ✓ Found {aiSubjects.length} subjects in the B.Tech Curriculum!
                          </p>
                          <p className="text-[10px] text-emerald-600">
                            Please review below. These can be merged into dynamic subjects with a single click.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleSaveAiParsedSubjects}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5 font-sans"
                        >
                          <CheckCircle size={12} /> Sync with Firestore
                        </button>
                      </div>

                      <div className="border border-neutral-105 rounded-2xl overflow-hidden shadow-sm max-h-[320px] overflow-y-auto bg-white">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-neutral-50/80 border-b border-neutral-100 text-[9px] font-black tracking-wider text-neutral-400 uppercase select-none font-sans">
                              <th className="px-4 py-2.5">Code</th>
                              <th className="px-4 py-2.5">Course Name</th>
                              <th className="px-4 py-2.5">Credits (L-T-P)</th>
                              <th className="px-4 py-2.5">Type</th>
                              <th className="px-4 py-2.5 text-right">Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 text-xs text-neutral-700 font-sans">
                            {aiSubjects.map((sub, idx) => (
                              <Fragment key={idx}>
                                <tr className="hover:bg-neutral-50/50">
                                  <td className="px-4 py-3 font-mono font-bold text-orange-600 text-[10px]">{sub.subjectCode}</td>
                                  <td className="px-4 py-3 font-bold text-neutral-800">{sub.subjectName}</td>
                                  <td className="px-4 py-3 text-[10px] font-mono">
                                    {sub.credits} credits ({sub.theoryCredits || 3}T-{sub.labCredits || 0}P)
                                  </td>
                                  <td className="px-4 py-3 text-[10px]">
                                    <span className="px-1.5 py-0.5 rounded-md font-bold bg-neutral-100 text-neutral-600 text-[9px]">
                                      {sub.type || "PC"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setAiCurrentExpandedIdx(aiCurrentExpandedIdx === idx ? null : idx)}
                                      className="text-[10px] font-bold text-orange-600 hover:text-orange-700 underline cursor-pointer font-sans"
                                    >
                                      {aiCurrentExpandedIdx === idx ? "Hide" : "Show Units & COs"}
                                    </button>
                                  </td>
                                </tr>
                                {aiCurrentExpandedIdx === idx && (
                                  <tr className="bg-neutral-50/30">
                                    <td colSpan={5} className="px-6 py-4 space-y-4 border-t border-b border-neutral-100">
                                      {/* Outcomes */}
                                      <div className="space-y-1.5">
                                        <span className="text-[9px] font-black uppercase text-neutral-400 tracking-widest block font-sans">Course Outcomes (COs)</span>
                                        <ul className="list-disc list-inside space-y-1 text-[11px] text-neutral-600 pl-1 leading-normal font-sans">
                                          {Array.isArray(sub.outcomes) ? sub.outcomes.map((co, cidx) => (
                                            <li key={cidx}>{co}</li>
                                          )) : (
                                            <li>Standard learning outcomes apply.</li>
                                          )}
                                        </ul>
                                      </div>

                                      {/* Units */}
                                      <div className="space-y-2">
                                        <span className="text-[9px] font-black uppercase text-neutral-400 tracking-widest block font-sans">Academic Unit Silos</span>
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                                          {(Array.isArray(sub.units) ? sub.units : []).map((unit, uidx) => (
                                            <div key={uidx} className="p-2.5 bg-white border border-neutral-150/70 rounded-xl space-y-1.5 shadow-sm text-left">
                                              <span className="text-[9px] font-extrabold text-orange-600 leading-none block font-sans">
                                                {unit.title || `Unit ${uidx + 1}`}
                                              </span>
                                              <p className="text-[10px] text-neutral-500 leading-snug line-clamp-4 font-sans mt-1" title={unit.content}>
                                                {unit.content || "Units spec detail to be synchronised."}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {!aiIsParsing && !aiIsSaving && !aiSubjects && (
                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-center border border-dashed border-neutral-200/80 bg-neutral-50/30 rounded-2xl select-none">
                      <div className="p-3 bg-neutral-100 text-neutral-400 rounded-full">
                        <Bot size={22} />
                      </div>
                      <div className="space-y-1 select-none">
                        <p className="text-xs font-black text-neutral-700">No scanned curriculum loaded</p>
                        <p className="text-[10px] text-neutral-400 px-6 max-w-xs leading-normal mx-auto font-sans leading-relaxed">
                          Select a department and semester inside the header panel above, then click <span className="font-bold text-neutral-600">Scan PDF</span> to execute the neural extractor.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Subject Mapping Creator/Editor Modal */}
      <AnimatePresence>
        {isSubjectModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!subjectFormSaving) {
                  setIsSubjectModalOpen(false);
                }
              }}
              className="absolute inset-0 bg-neutral-950/70 backdrop-blur-md"
            />

            <motion.div 
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.35 }}
              className="relative w-full max-w-md bg-white rounded-[28px] border border-neutral-100 shadow-2xl p-6 md:p-8 overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="absolute top-0 left-0 w-32 h-32 bg-orange-500/5 rounded-full filter blur-xl -translate-x-12 -translate-y-12" />
              
              <div className="relative flex justify-between items-start pb-4 border-b border-neutral-100 select-none mb-5">
                <div>
                  <span className="text-[9px] font-black uppercase text-orange-600 tracking-widest block mb-0.5">Subject Manager</span>
                  <h3 className="text-base md:text-lg font-black text-neutral-900 font-sans tracking-tight leading-none">
                    {editingSubject ? "Edit Central Subject" : "Create Central Subject"}
                  </h3>
                </div>
                {!subjectFormSaving && (
                  <button 
                    onClick={() => setIsSubjectModalOpen(false)}
                    className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
                  >
                    <Minimize2 size={16} />
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveSubject} className="space-y-4 overflow-y-auto flex-1 pr-1.5 scrollbar-thin">
                {subjectFormError && (
                  <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold leading-normal">
                    {subjectFormError}
                  </div>
                )}

                {/* Subject Code (Input) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-sans">
                    Subject Code
                  </label>
                  <input 
                    type="text"
                    required
                    disabled={!!editingSubject}
                    value={subjectFormCode}
                    onChange={(e) => setSubjectFormCode(e.target.value.toUpperCase())}
                    placeholder="EMA1101"
                    className="w-full px-4 py-3 text-xs md:text-sm border border-neutral-200 hover:border-neutral-300 focus:border-orange-500 rounded-xl outline-none transition-all placeholder:text-neutral-400 text-neutral-900 font-bold uppercase disabled:bg-neutral-50 disabled:text-neutral-400"
                  />
                </div>

                {/* Subject Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-sans">
                    Subject Title
                  </label>
                  <input 
                    type="text"
                    required
                    value={subjectFormName}
                    onChange={(e) => setSubjectFormName(e.target.value)}
                    placeholder="Engineering Physics"
                    className="w-full px-4 py-3 text-xs md:text-sm border border-neutral-200 hover:border-neutral-300 focus:border-orange-500 rounded-xl outline-none transition-all placeholder:text-neutral-400 text-neutral-900 font-bold"
                  />
                </div>

                {/* Grid 2 Column (Semester and Type) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-sans">
                      Semester (1-8)
                    </label>
                    <select
                      value={subjectFormSem}
                      onChange={(e) => setSubjectFormSem(parseInt(e.target.value))}
                      className="w-full px-4 py-3 text-xs border border-neutral-200 hover:border-neutral-300 focus:border-orange-500 rounded-xl outline-none transition-all font-bold text-neutral-800"
                    >
                      {[1,2,3,4,5,6,7,8].map(s => (
                        <option key={s} value={s}>Semester {s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-sans">
                      Type (e.g. BS, PC)
                    </label>
                    <input 
                      type="text"
                      required
                      value={subjectFormType}
                      onChange={(e) => setSubjectFormType(e.target.value.toUpperCase())}
                      placeholder="BS"
                      className="w-full px-4 py-3 text-xs border border-neutral-200 hover:border-neutral-300 focus:border-orange-500 rounded-xl outline-none transition-all placeholder:text-neutral-400 text-neutral-900 font-bold"
                    />
                  </div>
                </div>

                {/* Credit Breakdown Setup */}
                <div className="grid grid-cols-3 gap-2 bg-neutral-50/50 p-3 rounded-2xl border border-neutral-150/50">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400 block font-sans">
                      Theory Credits
                    </label>
                    <input 
                      type="number"
                      min={0}
                      max={10}
                      required
                      value={subjectFormTheoryCredits}
                      onChange={(e) => setSubjectFormTheoryCredits(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 text-xs border border-neutral-200 hover:border-neutral-300 focus:border-orange-500 rounded-xl outline-none transition-all text-neutral-900 font-bold font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400 block font-sans">
                      Lab Credits
                    </label>
                    <input 
                      type="number"
                      min={0}
                      max={10}
                      required
                      value={subjectFormLabCredits}
                      onChange={(e) => setSubjectFormLabCredits(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 text-xs border border-neutral-200 hover:border-neutral-300 focus:border-orange-500 rounded-xl outline-none transition-all text-neutral-900 font-bold font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-orange-500 block font-sans font-extrabold">
                      Total Credits
                    </label>
                    <div className="w-full px-3 py-2 text-xs bg-orange-50/50 border border-orange-100 rounded-xl font-black text-orange-600 font-mono text-center flex items-center justify-center min-h-[34px]">
                      {Number(subjectFormTheoryCredits) + Number(subjectFormLabCredits)}
                    </div>
                  </div>
                </div>

                 {/* Department checklist with per-department semester selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-sans">
                    Linked Departments Mapping <span className="text-[9px] font-bold text-neutral-400 italic">(Check departments & set specific semester)</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-bold leading-normal text-neutral-800 max-h-48 overflow-y-auto border border-neutral-100 p-2.5 rounded-2xl bg-neutral-50/20">
                    {DEPARTMENTS.map(dept => {
                      const isChecked = subjectFormDepts.includes(dept);
                      return (
                        <div key={dept} className="flex items-center justify-between gap-2 hover:bg-neutral-100/50 p-1.5 rounded-xl transition-colors border border-transparent hover:border-neutral-150/40">
                          <label className="flex items-center gap-2 cursor-pointer truncate flex-1 min-w-0 select-none">
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSubjectFormDepts(prev => [...prev, dept]);
                                  setSubjectFormSemMapping(prev => ({
                                    ...prev,
                                    [dept]: subjectFormSem || 1
                                  }));
                                } else {
                                  setSubjectFormDepts(prev => prev.filter(d => d !== dept));
                                  setSubjectFormSemMapping(prev => {
                                    const copy = { ...prev };
                                    delete copy[dept];
                                    return copy;
                                  });
                                }
                              }}
                              className="accent-orange-500 shrink-0"
                            />
                            <span className="truncate text-[11px] text-neutral-800 font-extrabold">{dept}</span>
                          </label>
                          
                          {isChecked && (
                            <div className="flex items-center gap-1 shrink-0 bg-white/90 shadow-sm border border-neutral-150/60 rounded-lg px-2 py-0.5">
                              <span className="text-[8px] text-neutral-400 font-black uppercase tracking-wider">Sem</span>
                              <select
                                value={subjectFormSemMapping[dept] || 1}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1;
                                  setSubjectFormSemMapping(prev => ({
                                    ...prev,
                                    [dept]: val
                                  }));
                                }}
                                className="px-1 py-0 border-0 outline-none text-[10px] font-black font-sans text-neutral-800 bg-transparent cursor-pointer"
                              >
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(sNum => (
                                  <option key={sNum} value={sNum}>{sNum}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-100 flex gap-2.5 justify-end items-center font-sans">
                  {!subjectFormSaving && (
                    <button 
                      type="button"
                      onClick={() => setIsSubjectModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                      Cancel
                    </button>
                  )}
                  <button 
                    type="submit"
                    disabled={subjectFormSaving}
                    className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5"
                  >
                    {subjectFormSaving ? "Saving subject..." : "Save Subject Mapping"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Student Portal Login Overlay Pop-up */}
      <AnimatePresence>
        {!isLoadingAuth && !user && showLoginModal && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-neutral-950/70 backdrop-blur-md"
              onClick={() => setShowLoginModal(false)}
            />

            <motion.div 
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-md bg-white border border-neutral-200/85 rounded-[32px] p-8 md:p-10 shadow-2xl flex flex-col space-y-6"
            >
              {/* Logo block */}
              <div className="flex flex-col items-center text-center space-y-4">
                <motion.div 
                  whileHover={{ scale: 1.05, rotate: 2 }}
                  className="w-16 h-16 bg-neutral-900 rounded-3xl flex items-center justify-center shadow-xl shadow-neutral-950/20 cursor-pointer"
                >
                  <img 
                    src="https://raw.githubusercontent.com/jampanapadmaja/ZERO2ONE/main/logo.png" 
                    alt="ZERO2ONE" 
                    className="w-11 h-11 object-contain"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://img.icons8.com/color/96/graduation-cap.png"; }}
                  />
                </motion.div>
                <div className="space-y-1">
                  <h1 className="text-3xl font-black tracking-tighter text-neutral-900 uppercase leading-none">ZERO<span className="text-orange-500">2</span>ONE</h1>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Official Student Portal</p>
                </div>
              </div>

              <div className="space-y-3 text-center">
                <h2 className="text-lg font-black text-neutral-900 leading-tight">College Workspace</h2>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Sign in with your Anurag University student account <strong className="text-neutral-700">@anurag.edu.in</strong> to automatically bypass year and department screens and sync your academic route.
                </p>
              </div>

              {authError && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-xs font-semibold leading-relaxed flex items-start gap-2.5"
                >
                  <Shield size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </motion.div>
              )}

              <div className="space-y-3 pt-2">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleLogin}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-[#0a0a0a] text-white font-bold text-sm hover:bg-neutral-800 transition-all shadow-xl shadow-neutral-950/10 hover:shadow-orange-500/10 active:scale-95 cursor-pointer border-none"
                >
                  <LogIn size={18} />
                  Sign in with Google
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setShowLoginModal(false)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-sm transition-all active:scale-95 cursor-pointer border-none"
                >
                  Continue without logging in
                </motion.button>
              </div>

              <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-[#a3a3a3]">
                <span>ZERO2ONE STUDY // 2026</span>
                <a href="mailto:zero2onestudypartner@gmail.com" className="hover:text-neutral-600 underline">Get Help</a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


