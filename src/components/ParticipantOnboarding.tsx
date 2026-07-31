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
  Lock
} from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface Participant {
  id?: string;
  name: string;
  photo: string;
  linkedinUrl: string;
  college: string;
  department?: string;
  year?: string;
  interests?: string;
  joinedAt?: any;
  online: boolean;
}

interface ParticipantOnboardingProps {
  eventId: string;
  eventTitle: string;
  onlineCount: number;
  initialImportedProfile?: { name: string; photo: string; linkedinUrl: string } | null;
  onClose: () => void;
  onComplete: (participant: Participant & { id: string }) => void;
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
  // "identity-verification" -> "importing-profile" -> "profile-confirmation" -> "welcome"
  const [step, setStep] = useState<
    "identity-verification" | "importing-profile" | "profile-confirmation" | "welcome"
  >(initialImportedProfile ? "profile-confirmation" : "identity-verification");

  // Server OAuth Status Check
  const [oauthStatus, setOauthStatus] = useState<{
    configured: boolean;
    redirectUri: string;
  } | null>(null);

  // Imported from LinkedIn (Read-Only)
  const [importedName, setImportedName] = useState<string>(initialImportedProfile?.name || "");
  const [importedPhoto, setImportedPhoto] = useState<string>(initialImportedProfile?.photo || "");
  const [importedLinkedinUrl, setImportedLinkedinUrl] = useState<string>(initialImportedProfile?.linkedinUrl || "");

  // Missing fields collected from user
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

  // Listen for OAuth message from pop-up window
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith(".run.app") && !origin.includes("localhost")) {
        return;
      }

      if (event.data?.type === "LINKEDIN_OAUTH_SUCCESS" && event.data?.profile) {
        const p = event.data.profile;
        setImportedName(p.name || "LinkedIn User");
        setImportedPhoto(p.photo || "");
        setImportedLinkedinUrl(p.linkedinUrl || "https://www.linkedin.com");

        setStep("importing-profile");
        setTimeout(() => {
          setStep("profile-confirmation");
        }, 800);
      } else if (event.data?.type === "LINKEDIN_OAUTH_ERROR") {
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

  // Step 5: Confirm Profile & Create Participant Document
  const handleConfirmProfile = async () => {
    setErrorMsg("");

    if (!college.trim()) {
      setErrorMsg("Please enter your College or University.");
      return;
    }

    setSaving(true);

    try {
      const participantData: Omit<Participant, "id"> = {
        name: importedName.trim(),
        photo: importedPhoto.trim() || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(importedName)}`,
        linkedinUrl: importedLinkedinUrl.trim(),
        college: college.trim(),
        department: department.trim() || undefined,
        year: year.trim() || undefined,
        interests: interests.trim() || undefined,
        joinedAt: serverTimestamp(),
        online: true,
      };

      const participantsRef = collection(db, "events", eventId, "participants");
      const docRef = await addDoc(participantsRef, participantData);

      const finalParticipant: Participant & { id: string } = {
        id: docRef.id,
        ...participantData,
      };

      setCreatedParticipant(finalParticipant);
      setSaving(false);
      setStep("welcome");
    } catch (err: any) {
      console.error("Error creating participant:", err);
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

              {/* Server OAuth Credentials Notice (if missing) */}
              {oauthStatus && !oauthStatus.configured && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-left space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                    <AlertCircle size={15} />
                    <span>LinkedIn OAuth Credentials Required</span>
                  </div>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    To connect to LinkedIn OAuth 2.0, configure <code className="text-orange-400 font-mono">LINKEDIN_CLIENT_ID</code> and <code className="text-orange-400 font-mono">LINKEDIN_CLIENT_SECRET</code> in environment settings.
                  </p>
                  <div className="pt-1">
                    <span className="text-[10px] text-neutral-400 font-mono block">Registered Callback URL:</span>
                    <span className="text-[10px] text-emerald-400 font-mono break-all select-all block bg-black/50 p-1.5 rounded border border-neutral-800 mt-0.5">
                      {oauthStatus.redirectUri}
                    </span>
                  </div>
                </div>
              )}

              {/* Security Banner */}
              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-300">
                  <Lock size={15} className="text-orange-500 shrink-0" />
                  <span>Authentication is securely handled by LinkedIn.</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed font-normal pl-6">
                  ZERO2ONE never stores your LinkedIn password or sensitive credentials.
                </p>
              </div>

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

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={handleStartOAuth}
                className="w-full py-4 px-6 rounded-2xl bg-[#0A66C2] hover:bg-[#084e96] active:scale-[0.99] text-white font-black text-xs md:text-sm uppercase tracking-wider transition-all shadow-xl shadow-[#0A66C2]/20 cursor-pointer flex items-center justify-center gap-3 border border-blue-400/30"
              >
                <Linkedin size={20} />
                <span>Continue with LinkedIn</span>
              </button>
            </motion.div>
          )}

          {/* STEP 2/3: IMPORTING PROFILE (LOADING SCREEN) */}
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

          {/* STEP 4: PROFILE CONFIRMATION */}
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
                  Review imported details and complete any missing information.
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
                    <p className="text-[11px] text-neutral-400 font-mono truncate">{importedLinkedinUrl}</p>
                  </div>
                </div>

                {/* Form for missing fields only */}
                <div className="space-y-3 text-left">
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
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setStep("identity-verification")}
                  className="px-4 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ArrowLeft size={14} /> Back
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleConfirmProfile}
                  className="flex-1 py-3 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-2 border border-orange-400/40 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Creating Participant...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      <span>Confirm &amp; Continue</span>
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
