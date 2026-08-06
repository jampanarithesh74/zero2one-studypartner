import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  CheckCircle, 
  Linkedin, 
  ArrowLeft, 
  Building, 
  GraduationCap, 
  Sparkles, 
  Users, 
  X,
  AlertCircle,
  ShieldCheck,
  Tag,
  Loader2,
  UserCheck,
  ExternalLink
} from "lucide-react";
import { 
  collection, 
  addDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  limit, 
  updateDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../lib/firebase";

export interface Participant {
  id?: string;
  name: string;
  photo?: string;
  linkedinUsername?: string;
  linkedinUrl?: string;
  linkedinSub?: string;
  email?: string;
  college?: string;
  department?: string;
  year?: string;
  interests?: string;
  roomType?: "linkedin" | "normal";
  joinedAt?: any;
  lastSeen?: any;
  online: boolean;
}

interface ParticipantOnboardingProps {
  eventId: string;
  eventTitle: string;
  onlineCount: number;
  initialImportedProfile?: { 
    name: string; 
    photo: string; 
    linkedinUsername?: string;
    linkedinUrl?: string; 
    linkedinSub?: string; 
    email?: string 
  } | null;
  onClose: () => void;
  onComplete: (participant: Participant & { id: string }) => void;
}

export function extractLinkedinUsername(input: string): string {
  if (!input || typeof input !== "string") return "";
  let cleaned = input.trim();
  // Strip protocol and domain prefixes if present
  cleaned = cleaned.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "");
  cleaned = cleaned.replace(/^linkedin\.com\/in\//i, "");
  cleaned = cleaned.replace(/^\/?in\//i, "");
  // Remove trailing slashes and query parameters / hashes
  cleaned = cleaned.split("?")[0].split("#")[0];
  cleaned = cleaned.replace(/\/+$|^\/+/g, "");
  return cleaned.trim();
}

export function validateLinkedinUsername(usernameInput: string): { valid: boolean; username: string; error?: string } {
  const clean = extractLinkedinUsername(usernameInput);
  if (!clean) {
    return { valid: false, username: "", error: "LinkedIn username cannot be empty." };
  }
  // Allowed characters: letters, numbers, hyphen (-), underscore (_)
  const regex = /^[a-zA-Z0-9_\-]+$/;
  if (!regex.test(clean)) {
    return {
      valid: false,
      username: clean,
      error: "Username can only contain letters, numbers, hyphens (-), and underscores (_)."
    };
  }
  return { valid: true, username: clean };
}

export function getLinkedinProfileUrl(participant?: { linkedinUsername?: string; linkedinUrl?: string } | string): string {
  if (!participant) return "https://www.linkedin.com";
  
  if (typeof participant === "string") {
    const slug = extractLinkedinUsername(participant);
    if (slug) return `https://www.linkedin.com/in/${slug}`;
    if (participant.startsWith("http://") || participant.startsWith("https://")) return participant;
    return "https://www.linkedin.com";
  }

  if (participant.linkedinUsername) {
    const slug = extractLinkedinUsername(participant.linkedinUsername);
    if (slug) return `https://www.linkedin.com/in/${slug}`;
  }

  if (participant.linkedinUrl) {
    const slug = extractLinkedinUsername(participant.linkedinUrl);
    if (slug) return `https://www.linkedin.com/in/${slug}`;
    let url = participant.linkedinUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    return url;
  }

  return "https://www.linkedin.com";
}

export function ParticipantOnboarding({
  eventId,
  eventTitle,
  onlineCount,
  initialImportedProfile,
  onClose,
  onComplete,
}: ParticipantOnboardingProps) {
  // Steps:
  // "identity-verification" -> "importing-profile" -> "profile-confirmation" -> "linkedin-username-verification" -> "event-details" -> "welcome"
  const [step, setStep] = useState<
    | "identity-verification"
    | "importing-profile"
    | "profile-confirmation"
    | "linkedin-username-verification"
    | "event-details"
    | "welcome"
  >(initialImportedProfile ? "profile-confirmation" : "identity-verification");

  // Server OAuth Status Check
  const [oauthStatus, setOauthStatus] = useState<{
    configured: boolean;
    redirectUri: string;
  } | null>(null);

  // Imported from LinkedIn
  const [importedName, setImportedName] = useState<string>(initialImportedProfile?.name || "");
  const [importedPhoto, setImportedPhoto] = useState<string>(initialImportedProfile?.photo || "");
  const [importedEmail, setImportedEmail] = useState<string>(initialImportedProfile?.email || "");
  const [importedLinkedinSub, setImportedLinkedinSub] = useState<string>(initialImportedProfile?.linkedinSub || "");

  // LinkedIn Username state & verification
  const initialUsernameSlug = extractLinkedinUsername(
    initialImportedProfile?.linkedinUsername || initialImportedProfile?.linkedinUrl || ""
  );
  const [linkedinUsername, setLinkedinUsername] = useState<string>(initialUsernameSlug);
  const [isProfileConfirmed, setIsProfileConfirmed] = useState<boolean>(Boolean(initialUsernameSlug));
  const [hasSavedUsername, setHasSavedUsername] = useState<boolean>(Boolean(initialUsernameSlug));

  // Academic & Event details
  const [college, setCollege] = useState<string>("Anurag University");
  const [department, setDepartment] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [interests, setInterests] = useState<string>("");

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [createdParticipant, setCreatedParticipant] = useState<(Participant & { id: string }) | null>(null);

  // Fetch LinkedIn OAuth status from server
  useEffect(() => {
    fetch("/api/auth/linkedin/status")
      .then((res) => res.json())
      .then((data) => {
        setOauthStatus({
          configured: Boolean(data.configured),
          redirectUri: data.redirectUri || `${window.location.origin}/api/auth/linkedin/callback`,
        });
      })
      .catch((err) => {
        console.warn("Could not check LinkedIn OAuth status:", err);
        setOauthStatus({
          configured: false,
          redirectUri: `${window.location.origin}/api/auth/linkedin/callback`,
        });
      });
  }, []);

  // Auto-check for existing participant in Firestore to pre-fill saved profile info
  useEffect(() => {
    if (!eventId || (!importedLinkedinSub && !importedEmail)) return;

    let isCancelled = false;

    async function checkExistingParticipant() {
      try {
        const participantsRef = collection(db, "events", eventId, "participants");
        let q;
        if (importedLinkedinSub) {
          q = query(participantsRef, where("linkedinSub", "==", importedLinkedinSub), limit(1));
        } else if (importedEmail) {
          q = query(participantsRef, where("email", "==", importedEmail), limit(1));
        }

        if (q) {
          const snap = await getDocs(q);
          if (!snap.empty && !isCancelled) {
            const existing = snap.docs[0].data() as Participant;
            console.log("[Duplicate Detection] Found existing participant in Firestore:", snap.docs[0].id, existing);
            
            const savedSlug = extractLinkedinUsername(
              existing.linkedinUsername || existing.linkedinUrl || ""
            );
            if (savedSlug) {
              setLinkedinUsername(savedSlug);
              setIsProfileConfirmed(true);
              setHasSavedUsername(true);
            }
            if (existing.college) setCollege(existing.college);
            if (existing.department) setDepartment(existing.department);
            if (existing.year) setYear(existing.year);
            if (existing.interests) setInterests(existing.interests);
          }
        }
      } catch (err) {
        console.warn("[Duplicate Detection] Error checking existing participant:", err);
      }
    }

    checkExistingParticipant();

    return () => {
      isCancelled = true;
    };
  }, [eventId, importedLinkedinSub, importedEmail]);

  // Listen for OAuth message from pop-up window
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      const allowedOrigins = [
        window.location.origin,
        "http://localhost:3000",
        "http://localhost:5173",
      ];

      if (!allowedOrigins.includes(event.origin)) {
        return;
      }

      if (event.data?.type === "LINKEDIN_OAUTH_SUCCESS" && event.data?.profile) {
        console.log("LinkedIn OAuth Success received.");
        const p = event.data.profile;
        setImportedName(p.name || "LinkedIn User");
        setImportedPhoto(p.photo || "");
        setImportedEmail(p.email || "");
        setImportedLinkedinSub(p.linkedinSub || "");
        
        const extractedSlug = extractLinkedinUsername(p.linkedinUsername || p.linkedinUrl || "");
        if (extractedSlug) {
          setLinkedinUsername(extractedSlug);
          setIsProfileConfirmed(true);
          setHasSavedUsername(true);
        }

        setStep("importing-profile");
        setTimeout(() => {
          setStep("profile-confirmation");
        }, 800);
      } else if (event.data?.type === "LINKEDIN_OAUTH_ERROR") {
        console.log("LinkedIn OAuth Error received.");
        setErrorMsg(event.data?.error || "LinkedIn authorization was cancelled or failed.");
        setStep("identity-verification");
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, []);

  // Handle "Continue with LinkedIn" OAuth button click
  const handleStartOAuth = () => {
    setErrorMsg("");
    setStep("importing-profile");

    const authUrl = `/api/auth/linkedin/start?eventId=${eventId}&origin=${encodeURIComponent(window.location.origin)}`;
    
    // Open OAuth popup window
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      "linkedin_oauth",
      `width=${width},height=${height},left=${left},top=${top},status=0,toolbar=0`
    );

    if (!popup) {
      // Fallback: If pop-up is blocked, redirect window directly
      window.location.href = authUrl;
    }
  };

  // Handle transition from Profile Confirmation
  const handleProfileConfirmNext = () => {
    setErrorMsg("");
    const cleanSlug = extractLinkedinUsername(linkedinUsername);
    if (hasSavedUsername && cleanSlug && validateLinkedinUsername(cleanSlug).valid) {
      // Returning user already has saved valid username -> skip username verification step
      console.log(`[Onboarding] Returning user with saved username "${cleanSlug}". Skipping verification step.`);
      setStep("event-details");
    } else {
      setStep("linkedin-username-verification");
    }
  };

  // Final Submit & Save Participant Document with Duplicate Check
  const handleConfirmProfile = async () => {
    setErrorMsg("");

    const validation = validateLinkedinUsername(linkedinUsername);
    if (!validation.valid) {
      setErrorMsg(validation.error || "Please enter a valid LinkedIn username.");
      setStep("linkedin-username-verification");
      return;
    }

    if (!college.trim()) {
      setErrorMsg("Please enter your College or University.");
      setStep("event-details");
      return;
    }

    setSaving(true);
    const cleanSlug = validation.username;
    const fullLinkedinUrl = `https://www.linkedin.com/in/${cleanSlug}`;

    try {
      const participantsRef = collection(db, "events", eventId, "participants");

      let existingDocId: string | null = null;
      let existingDocData: any = null;

      // 1. Search for existing participant by linkedinSub
      if (importedLinkedinSub) {
        console.log(`[Duplicate Prevention] Searching for existing participant with linkedinSub="${importedLinkedinSub}"`);
        const qSub = query(participantsRef, where("linkedinSub", "==", importedLinkedinSub), limit(1));
        const snapSub = await getDocs(qSub);
        if (!snapSub.empty) {
          existingDocId = snapSub.docs[0].id;
          existingDocData = snapSub.docs[0].data();
          console.log(`[Duplicate Prevention] Duplicate detected by linkedinSub! Doc ID: ${existingDocId}`);
        }
      }

      // 2. Fallback check by email if linkedinSub didn't match
      if (!existingDocId && importedEmail) {
        console.log(`[Duplicate Prevention] Searching for existing participant with email="${importedEmail}"`);
        const qEmail = query(participantsRef, where("email", "==", importedEmail), limit(1));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          existingDocId = snapEmail.docs[0].id;
          existingDocData = snapEmail.docs[0].data();
          console.log(`[Duplicate Prevention] Duplicate detected by email! Doc ID: ${existingDocId}`);
        }
      }

      let finalParticipant: Participant & { id: string };

      if (existingDocId) {
        // UPDATE existing document - DO NOT create duplicate
        const docRef = doc(db, "events", eventId, "participants", existingDocId);
        const updatePayload: Partial<Participant> = {
          name: importedName.trim() || existingDocData.name,
          photo: importedPhoto.trim() || existingDocData.photo,
          linkedinUsername: cleanSlug,
          linkedinUrl: fullLinkedinUrl,
          linkedinSub: importedLinkedinSub || existingDocData.linkedinSub || undefined,
          email: importedEmail || existingDocData.email || undefined,
          college: college.trim(),
          department: department.trim() || undefined,
          year: year.trim() || undefined,
          interests: interests.trim() || undefined,
          online: true,
          lastSeen: serverTimestamp(),
        };

        await updateDoc(docRef, updatePayload);

        finalParticipant = {
          id: existingDocId,
          ...existingDocData,
          ...updatePayload,
        };
        console.log(`[Duplicate Prevention] Existing participant updated successfully: ${existingDocId}`);
      } else {
        // CREATE new participant
        const newParticipantData: Omit<Participant, "id"> = {
          name: importedName.trim(),
          photo: importedPhoto.trim() || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(importedName)}`,
          linkedinUsername: cleanSlug,
          linkedinUrl: fullLinkedinUrl,
          linkedinSub: importedLinkedinSub || undefined,
          email: importedEmail || undefined,
          college: college.trim(),
          department: department.trim() || undefined,
          year: year.trim() || undefined,
          interests: interests.trim() || undefined,
          joinedAt: serverTimestamp(),
          lastSeen: serverTimestamp(),
          online: true,
        };

        const docRef = await addDoc(participantsRef, newParticipantData);
        finalParticipant = {
          id: docRef.id,
          ...newParticipantData,
        };
        console.log(`[Duplicate Prevention] New participant document created: ${docRef.id}`);
      }

      // Persist in localStorage
      try {
        localStorage.setItem(`z2o_participant_${eventId}`, JSON.stringify(finalParticipant));
      } catch (e) {
        console.warn("Failed saving participant session to localStorage:", e);
      }

      setCreatedParticipant(finalParticipant);
      setSaving(false);
      setStep("welcome");
    } catch (err: any) {
      console.error("Error creating or updating participant:", err);
      setErrorMsg(err.message || "Failed to complete onboarding. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => {
          if (!saving) onClose();
        }}
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
      />

      {/* Modal Card Container */}
      <motion.div
        initial={{ scale: 0.95, y: 15, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 15, opacity: 0 }}
        transition={{ type: "spring", duration: 0.35 }}
        className="relative w-full max-w-lg bg-[#121212] rounded-[28px] border border-neutral-800 p-6 md:p-8 shadow-2xl text-left text-white overflow-hidden z-10"
      >
        {/* Close Button */}
        {!saving && step !== "welcome" && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        )}

        <AnimatePresence mode="wait">
          {/* STEP 1: IDENTITY VERIFICATION */}
          {step === "identity-verification" && (
            <motion.div
              key="step-identity-verification"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-orange-500">
                  PARTICIPANT ONBOARDING
                </span>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  Verify Your Identity
                </h2>
                <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                  To create a trusted networking experience, ZERO2ONE verifies every participant using LinkedIn.
                </p>
              </div>

              {/* Error Alert */}
              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Benefits Checklist */}
              <div className="space-y-2.5 p-4 rounded-2xl bg-neutral-950 border border-neutral-800/80">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Why verify with LinkedIn?
                </span>
                <div className="flex items-center gap-2.5 text-xs text-neutral-200 font-medium">
                  <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                  <span>Verified Professional Identity</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-neutral-200 font-medium">
                  <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                  <span>Authentic Networking</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-neutral-200 font-medium">
                  <Linkedin size={16} className="text-[#0A66C2] shrink-0" />
                  <span>Secure OAuth Authentication</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleStartOAuth}
                  className="w-full py-4 px-6 rounded-2xl bg-[#0A66C2] hover:bg-[#084e96] active:scale-[0.99] text-white font-black text-xs md:text-sm uppercase tracking-wider transition-all shadow-xl shadow-[#0A66C2]/20 cursor-pointer flex items-center justify-center gap-3 border border-blue-400/30"
                >
                  <Linkedin size={20} />
                  <span>Continue with LinkedIn</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg("");
                    setImportedName(importedName || "");
                    setStep("profile-confirmation");
                  }}
                  className="w-full py-3.5 px-5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 active:scale-[0.99] text-neutral-200 font-bold text-xs transition-all border border-neutral-800 cursor-pointer flex items-center justify-center gap-2.5"
                >
                  <UserCheck size={16} className="text-orange-500" />
                  <span>Continue with Direct Registration</span>
                </button>
              </div>

              {/* OAuth Setup Info (Subtle) */}
              {oauthStatus && !oauthStatus.configured && (
                <div className="p-3 bg-neutral-900/60 border border-neutral-800/80 rounded-xl text-left space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-medium text-neutral-400">
                    <span className="flex items-center gap-1.5 text-neutral-300">
                      <Linkedin size={13} className="text-[#0A66C2]" /> LinkedIn OAuth 2.0 Integration
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono">Requires Env Setup</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 leading-normal">
                    To enable live LinkedIn OAuth popup, set <code className="text-orange-400">LINKEDIN_CLIENT_ID</code> and <code className="text-orange-400">LINKEDIN_CLIENT_SECRET</code> on Vercel. Direct Registration works out of the box.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 2: IMPORTING PROFILE (LOADING SCREEN) */}
          {step === "importing-profile" && (
            <motion.div
              key="step-importing-profile"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-12 space-y-6 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#0A66C2]/15 border border-[#0A66C2]/30 text-[#0A66C2] flex items-center justify-center mx-auto shadow-xl">
                <Loader2 size={36} className="animate-spin" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-black text-white tracking-tight">
                  Importing Your Profile
                </h2>
                <p className="text-xs text-neutral-400 font-medium">
                  Fetching your LinkedIn profile information securely...
                </p>
              </div>

              <div className="max-w-xs mx-auto p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-400 font-mono">
                Authenticating with LinkedIn OAuth 2.0...
              </div>
            </motion.div>
          )}

          {/* STEP 3: PROFILE CONFIRMATION */}
          {step === "profile-confirmation" && (
            <motion.div
              key="step-profile-confirmation"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <CheckCircle size={12} /> LinkedIn Verified ✓
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  Confirm Your Profile
                </h2>
                <p className="text-xs text-neutral-400 font-medium">
                  Review imported details from your LinkedIn account.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Imported Read-Only LinkedIn Card */}
              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-neutral-800">
                  <img
                    src={importedPhoto || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(importedName)}`}
                    alt={importedName}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-[#0A66C2] shadow-md shrink-0"
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <span className="text-[9px] font-mono font-black text-[#0A66C2] uppercase tracking-widest block">
                      IMPORTED FROM LINKEDIN
                    </span>
                    <h3 className="text-base font-black text-white truncate">{importedName}</h3>
                    {importedEmail ? (
                      <p className="text-[11px] text-neutral-400 font-mono truncate">{importedEmail}</p>
                    ) : (
                      <p className="text-[11px] text-neutral-400 font-mono truncate">Verified Account</p>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 text-left space-y-1">
                  <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                    IMPORTED FIELDS
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs text-neutral-300 font-medium pt-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                      <span className="truncate">Name: {importedName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                      <span className="truncate">Profile Photo</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("identity-verification")}
                  className="px-4 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back
                </button>

                <button
                  type="button"
                  onClick={handleProfileConfirmNext}
                  className="flex-1 py-3.5 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-2 border border-orange-400/40"
                >
                  <span>Confirm &amp; Next</span>
                  <CheckCircle size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: LINKEDIN USERNAME VERIFICATION (NEW STEP) */}
          {step === "linkedin-username-verification" && (
            <motion.div
              key="step-linkedin-username-verification"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono tracking-wider bg-[#0A66C2]/15 border border-[#0A66C2]/30 text-[#0A66C2]">
                  <Linkedin size={12} /> Step 2 of 3
                </span>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  Verify Your LinkedIn Profile
                </h2>
                <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                  We only need your LinkedIn username once. Other participants will use this to connect with you directly.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
                {/* Username Input Box with static prefix */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                    <Linkedin size={12} className="text-[#0A66C2]" /> LinkedIn Username *
                  </label>
                  <div className="flex items-center rounded-xl bg-neutral-950 border border-neutral-800 focus-within:border-[#0A66C2] transition-all overflow-hidden">
                    <span className="px-3 py-2.5 bg-neutral-900/80 text-neutral-400 text-xs font-mono border-r border-neutral-800 shrink-0 select-none">
                      linkedin.com/in/
                    </span>
                    <input
                      type="text"
                      required
                      value={linkedinUsername}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const slug = extractLinkedinUsername(raw);
                        setLinkedinUsername(slug);
                        setIsProfileConfirmed(false);
                        if (slug) {
                          const res = validateLinkedinUsername(slug);
                          if (!res.valid) {
                            setErrorMsg(res.error || "Invalid username format.");
                          } else {
                            setErrorMsg("");
                          }
                        } else {
                          setErrorMsg("");
                        }
                      }}
                      placeholder="rithesh-jampana"
                      className="w-full px-3 py-2.5 text-xs bg-transparent text-white font-mono outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-neutral-500">
                    Type or paste your profile username slug (e.g. <code className="text-blue-400 font-mono">rithesh-jampana</code>).
                  </p>
                </div>

                {/* Live Realtime URL Preview Box */}
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1 text-left">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-neutral-500 block">
                    PREVIEW PROFILE URL
                  </span>
                  <code className="text-xs text-blue-400 font-mono break-all block">
                    {`https://www.linkedin.com/in/${extractLinkedinUsername(linkedinUsername) || "username"}/`}
                  </code>
                </div>

                {/* Preview Button */}
                <button
                  type="button"
                  onClick={() => {
                    const slug = extractLinkedinUsername(linkedinUsername);
                    if (slug) {
                      window.open(`https://www.linkedin.com/in/${slug}`, "_blank", "noopener,noreferrer");
                    } else {
                      setErrorMsg("Please enter a LinkedIn username first to preview.");
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-xs font-bold text-blue-400 border border-neutral-800 hover:border-blue-500/40 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <ExternalLink size={14} />
                  <span>🔗 Preview My LinkedIn Profile</span>
                </button>

                {/* Confirmation Checkbox */}
                <label className="flex items-center gap-3 p-3 rounded-xl bg-neutral-950 border border-neutral-800 cursor-pointer text-xs text-neutral-200 font-medium select-none text-left hover:border-neutral-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={isProfileConfirmed}
                    onChange={(e) => setIsProfileConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-orange-500 focus:ring-0 cursor-pointer accent-orange-500"
                  />
                  <span>This opens my correct LinkedIn profile.</span>
                </label>
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("profile-confirmation")}
                  className="px-4 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back
                </button>

                <button
                  type="button"
                  disabled={!validateLinkedinUsername(linkedinUsername).valid || !isProfileConfirmed}
                  onClick={() => {
                    setErrorMsg("");
                    setStep("event-details");
                  }}
                  className="flex-1 py-3.5 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-2 border border-orange-400/40 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Continue</span>
                  <CheckCircle size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 5: ACADEMIC & EVENT DETAILS */}
          {step === "event-details" && (
            <motion.div
              key="step-event-details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono tracking-wider bg-orange-500/15 border border-orange-500/30 text-orange-400">
                  <Building size={12} /> Final Step
                </span>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  Academic &amp; Event Details
                </h2>
                <p className="text-xs text-neutral-400 font-medium">
                  Provide your institution details to complete your registration.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3 text-left">
                {/* College / University * */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                    <Building size={12} className="text-orange-500" /> College / University *
                  </label>
                  <input
                    type="text"
                    required
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    placeholder="e.g. Anurag University"
                    className="w-full px-3.5 py-2.5 text-xs bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl outline-none text-white font-bold transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Department (Optional) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                      <GraduationCap size={12} className="text-orange-500" /> Department (Optional)
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. CSE / ECE"
                      className="w-full px-3.5 py-2.5 text-xs bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl outline-none text-white font-medium transition-all"
                    />
                  </div>

                  {/* Year of Study (Optional) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                      <Tag size={12} className="text-orange-500" /> Year (Optional)
                    </label>
                    <input
                      type="text"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      placeholder="e.g. 3rd Year"
                      className="w-full px-3.5 py-2.5 text-xs bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl outline-none text-white font-medium transition-all"
                    />
                  </div>
                </div>

                {/* Interests / Skills (Optional) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                    <Sparkles size={12} className="text-orange-500" /> Interests (Optional)
                  </label>
                  <input
                    type="text"
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                    placeholder="e.g. AI, Full-Stack, Robotics"
                    className="w-full px-3.5 py-2.5 text-xs bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl outline-none text-white font-medium transition-all"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setStep("linkedin-username-verification")}
                  className="px-4 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ArrowLeft size={14} /> Back
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleConfirmProfile}
                  className="flex-1 py-3.5 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-2 border border-orange-400/40 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Joining Event...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      <span>Confirm &amp; Join Event</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 6: WELCOME */}
          {step === "welcome" && createdParticipant && (
            <motion.div
              key="step-welcome"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6 text-center py-2"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-xl">
                <CheckCircle size={36} />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-emerald-400 block">
                  AUTHENTICATION COMPLETE
                </span>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Welcome, {createdParticipant.name}!
                </h2>
                <p className="text-xs text-neutral-400 font-medium">
                  You're joining <strong className="text-orange-400">{eventTitle}</strong>
                </p>
              </div>

              {/* Online Participants Badge */}
              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
                <div className="flex items-center justify-center gap-2 text-emerald-400 font-black text-lg font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <Users size={20} />
                  <span>{Math.max(onlineCount, 1)}</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest block">
                  Participants Online
                </span>
              </div>

              {/* Enter Event Button */}
              <button
                type="button"
                onClick={() => onComplete(createdParticipant)}
                className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-2 border border-orange-400/40"
              >
                <Sparkles size={18} />
                <span>Enter Event</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

