import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Linkedin, 
  ArrowLeft, 
  Building, 
  GraduationCap, 
  Sparkles, 
  AlertCircle, 
  CheckCircle, 
  Tag, 
  Loader2, 
  ExternalLink 
} from "lucide-react";
import { 
  collection, 
  addDoc, 
  doc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  limit, 
  updateDoc, 
  increment,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { 
  Participant, 
  extractLinkedinUsername, 
  validateLinkedinUsername 
} from "../ParticipantOnboarding";

export function ParticipantOnboardingPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Step state
  const [step, setStep] = useState<
    "profile-confirmation" | "linkedin-username-verification" | "event-details"
  >("profile-confirmation");

  // Imported profile fields
  const [importedName, setImportedName] = useState<string>("");
  const [importedPhoto, setImportedPhoto] = useState<string>("");
  const [importedEmail, setImportedEmail] = useState<string>("");
  const [importedLinkedinSub, setImportedLinkedinSub] = useState<string>("");

  // LinkedIn username & verification
  const [linkedinUsername, setLinkedinUsername] = useState<string>("");
  const [isProfileConfirmed, setIsProfileConfirmed] = useState<boolean>(false);

  // Academic details
  const [college, setCollege] = useState<string>("Anurag University");
  const [department, setDepartment] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [interests, setInterests] = useState<string>("");

  // 1. Mount effect: Load saved onboarding state & guard route
  useEffect(() => {
    if (!eventId) return;

    // Check if participant is ALREADY registered -> go straight to room
    try {
      const storedParticipant = localStorage.getItem(`z2o_participant_${eventId}`);
      if (storedParticipant) {
        const parsedP = JSON.parse(storedParticipant);
        if (parsedP && parsedP.id) {
          console.log("[ParticipantOnboardingPage] Already a participant. Navigating to room.");
          navigate(`/events/${eventId}/room`, { replace: true });
          return;
        }
      }
    } catch (e) {
      console.warn("Error reading stored participant session:", e);
    }

    // Read stored onboarding progress
    try {
      const storedOnboarding = localStorage.getItem(`z2o_onboarding_${eventId}`);
      if (storedOnboarding) {
        const data = JSON.parse(storedOnboarding);
        if (data.importedProfile) {
          setImportedName(data.importedProfile.name || "");
          setImportedPhoto(data.importedProfile.photo || "");
          setImportedEmail(data.importedProfile.email || "");
          setImportedLinkedinSub(data.importedProfile.linkedinSub || "");
        }

        if (data.linkedinUsername) {
          const slug = extractLinkedinUsername(data.linkedinUsername);
          setLinkedinUsername(slug);
          if (slug) setIsProfileConfirmed(true);
        }

        if (data.college) setCollege(data.college);
        if (data.department) setDepartment(data.department);
        if (data.year) setYear(data.year);
        if (data.interests) setInterests(data.interests);

        if (data.currentStep) {
          setStep(data.currentStep);
        }

        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn("Error reading stored onboarding progress:", err);
    }

    // Route Guard: If no onboarding data exists -> Redirect to join page
    console.warn("[ParticipantOnboardingPage] No onboarding session found. Redirecting to join page.");
    navigate(`/events/${eventId}/join`, { replace: true });
  }, [eventId, navigate]);

  // 2. Persist onboarding progress on change
  useEffect(() => {
    if (!eventId || loading) return;

    try {
      const payload = {
        importedProfile: {
          name: importedName,
          photo: importedPhoto,
          email: importedEmail,
          linkedinSub: importedLinkedinSub,
        },
        linkedinUsername,
        college,
        department,
        year,
        interests,
        currentStep: step,
      };

      localStorage.setItem(`z2o_onboarding_${eventId}`, JSON.stringify(payload));
    } catch (e) {
      console.warn("Failed saving onboarding progress to localStorage:", e);
    }
  }, [
    eventId,
    loading,
    step,
    importedName,
    importedPhoto,
    importedEmail,
    importedLinkedinSub,
    linkedinUsername,
    college,
    department,
    year,
    interests,
  ]);

  // Handle final submission & joining room
  const handleConfirmProfileAndJoin = async () => {
    if (!eventId) return;
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

      // 1. Check duplicate by linkedinSub
      if (importedLinkedinSub) {
        const qSub = query(participantsRef, where("linkedinSub", "==", importedLinkedinSub), limit(1));
        const snapSub = await getDocs(qSub);
        if (!snapSub.empty) {
          existingDocId = snapSub.docs[0].id;
          existingDocData = snapSub.docs[0].data();
        }
      }

      // 2. Fallback check by email
      if (!existingDocId && importedEmail) {
        const qEmail = query(participantsRef, where("email", "==", importedEmail), limit(1));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          existingDocId = snapEmail.docs[0].id;
          existingDocData = snapEmail.docs[0].data();
        }
      }

      let finalParticipant: Participant & { id: string };

      if (existingDocId) {
        // Update existing document
        const docRef = doc(db, "events", eventId, "participants", existingDocId);
        const updatePayload: Partial<Participant> = {
          name: importedName.trim() || existingDocData.name || "Participant",
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
      } else {
        // Create new document
        const newParticipantData: Omit<Participant, "id"> = {
          name: importedName.trim() || "Participant",
          photo: importedPhoto.trim() || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(importedName || "User")}`,
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

        // Atomically update participant count on event document
        try {
          await updateDoc(doc(db, "events", eventId), {
            participantCount: increment(1),
          });
        } catch (countErr) {
          console.warn("Could not update participantCount on event:", countErr);
        }
      }

      // Persist participant session in localStorage
      localStorage.setItem(`z2o_participant_${eventId}`, JSON.stringify(finalParticipant));
      // Clear temporary onboarding progress
      localStorage.removeItem(`z2o_onboarding_${eventId}`);

      setSaving(false);

      // Navigate to room
      navigate(`/events/${eventId}/room`, { replace: true });
    } catch (err: any) {
      console.error("Error finalizing onboarding:", err);
      setErrorMsg(err.message || "Failed to complete onboarding. Please try again.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 space-y-4">
        <Loader2 size={36} className="text-orange-500 animate-spin" />
        <p className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
          Restoring onboarding session...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500 selection:text-white pb-20 pt-6 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-lg space-y-6">
        
        {/* Top Header */}
        <button
          type="button"
          onClick={() => navigate(`/events/${eventId}/join`)}
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} className="text-orange-500" />
          <span>Back to Authentication</span>
        </button>

        {/* Main Step Card */}
        <div className="p-6 md:p-8 rounded-3xl bg-[#121212] border border-neutral-800 shadow-2xl text-left text-white overflow-hidden relative">
          
          <AnimatePresence mode="wait">
            {/* STEP 1: PROFILE CONFIRMATION */}
            {step === "profile-confirmation" && (
              <motion.div
                key="step-profile-confirmation"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="space-y-5"
              >
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <CheckCircle size={12} /> Step 1 of 3
                  </span>
                  <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                    Confirm Your Profile
                  </h2>
                  <p className="text-xs text-neutral-400 font-medium">
                    Review your imported profile information.
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Profile Card */}
                <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-neutral-800">
                    <img
                      src={importedPhoto || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(importedName || "User")}`}
                      alt={importedName || "User"}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-[#0A66C2] shadow-md shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(importedName || "User")}`;
                      }}
                    />
                    <div className="flex-1 min-w-0 text-left space-y-1">
                      <span className="text-[9px] font-mono font-black text-[#0A66C2] uppercase tracking-widest block">
                        PARTICIPANT PROFILE
                      </span>
                      <input
                        type="text"
                        value={importedName}
                        onChange={(e) => setImportedName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full px-3 py-1.5 text-sm bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-lg text-white font-black outline-none"
                      />
                      {importedEmail && (
                        <p className="text-[11px] text-neutral-400 font-mono truncate">{importedEmail}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep("linkedin-username-verification")}
                    className="w-full py-3.5 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-2 border border-orange-400/40"
                  >
                    <span>Confirm &amp; Next</span>
                    <CheckCircle size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: LINKEDIN USERNAME VERIFICATION */}
            {step === "linkedin-username-verification" && (
              <motion.div
                key="step-linkedin-username-verification"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
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
                    Provide your LinkedIn username so other attendees can connect with you directly.
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
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
                  </div>

                  {/* Preview Box */}
                  <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1 text-left">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-neutral-500 block">
                      PREVIEW PROFILE URL
                    </span>
                    <code className="text-xs text-blue-400 font-mono break-all block">
                      {`https://www.linkedin.com/in/${extractLinkedinUsername(linkedinUsername) || "username"}/`}
                    </code>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const slug = extractLinkedinUsername(linkedinUsername);
                      if (slug) {
                        window.open(`https://www.linkedin.com/in/${slug}`, "_blank", "noopener,noreferrer");
                      } else {
                        setErrorMsg("Please enter a LinkedIn username first.");
                      }
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-xs font-bold text-blue-400 border border-neutral-800 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <ExternalLink size={14} />
                    <span>Preview My LinkedIn Profile</span>
                  </button>

                  <label className="flex items-center gap-3 p-3 rounded-xl bg-neutral-950 border border-neutral-800 cursor-pointer text-xs text-neutral-200 font-medium select-none hover:border-neutral-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={isProfileConfirmed}
                      onChange={(e) => setIsProfileConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-orange-500 focus:ring-0 cursor-pointer accent-orange-500"
                    />
                    <span>This opens my correct LinkedIn profile.</span>
                  </label>
                </div>

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
                    onClick={() => setStep("event-details")}
                    className="flex-1 py-3.5 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-2 border border-orange-400/40 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Continue</span>
                    <CheckCircle size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: ACADEMIC & EVENT DETAILS */}
            {step === "event-details" && (
              <motion.div
                key="step-event-details"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="space-y-5"
              >
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono tracking-wider bg-orange-500/15 border border-orange-500/30 text-orange-400">
                    <Building size={12} /> Step 3 of 3
                  </span>
                  <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                    Academic Details
                  </h2>
                  <p className="text-xs text-neutral-400 font-medium">
                    Enter your college and academic information.
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3 text-left">
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
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                        <GraduationCap size={12} className="text-orange-500" /> Department
                      </label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="e.g. CSE / ECE"
                        className="w-full px-3.5 py-2.5 text-xs bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl outline-none text-white font-medium transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                        <Tag size={12} className="text-orange-500" /> Year
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

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                      <Sparkles size={12} className="text-orange-500" /> Interests (Optional)
                    </label>
                    <input
                      type="text"
                      value={interests}
                      onChange={(e) => setInterests(e.target.value)}
                      placeholder="e.g. AI, Web3, Full-Stack"
                      className="w-full px-3.5 py-2.5 text-xs bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl outline-none text-white font-medium transition-all"
                    />
                  </div>
                </div>

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
                    onClick={handleConfirmProfileAndJoin}
                    className="flex-1 py-3.5 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-2 border border-orange-400/40 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Joining Room...</span>
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
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
