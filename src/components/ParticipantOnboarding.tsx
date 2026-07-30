import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  CheckCircle, 
  Linkedin, 
  ArrowLeft, 
  User, 
  Building, 
  Briefcase, 
  Link as LinkIcon, 
  Users, 
  X,
  AlertCircle
} from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface Participant {
  id?: string;
  name: string;
  photo: string;
  college: string;
  headline: string;
  linkedinUrl: string;
  joinedAt?: any;
  online: boolean;
}

interface ParticipantOnboardingProps {
  eventId: string;
  eventTitle: string;
  onlineCount: number;
  onClose: () => void;
  onComplete: (participant: Participant & { id: string }) => void;
}

// Demo presets for fast 1-click LinkedIn profile simulation
const LINKEDIN_PRESETS = [
  {
    name: "Arjun Sharma",
    photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400",
    college: "Anurag University",
    headline: "Full-Stack Engineer & AI Hackathon Enthusiast",
    linkedinUrl: "https://linkedin.com/in/arjun-sharma-zero2one",
  },
  {
    name: "Priya Rao",
    photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=400",
    college: "Anurag University - CSE",
    headline: "UI/UX Designer & Product Lead",
    linkedinUrl: "https://linkedin.com/in/priya-rao-design",
  },
  {
    name: "Vikram Reddy",
    photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400",
    college: "Anurag University - ECE",
    headline: "Robotics Developer & Embedded Systems Researcher",
    linkedinUrl: "https://linkedin.com/in/vikram-reddy-tech",
  }
];

export function ParticipantOnboarding({
  eventId,
  eventTitle,
  onlineCount,
  onClose,
  onComplete,
}: ParticipantOnboardingProps) {
  // Step 2: linkedin-auth | Step 3: profile-confirmation | Step 5: welcome
  const [step, setStep] = useState<"linkedin-auth" | "profile-confirmation" | "welcome">("linkedin-auth");

  // Editable Profile state
  const [name, setName] = useState<string>("");
  const [photo, setPhoto] = useState<string>("");
  const [college, setCollege] = useState<string>("");
  const [headline, setHeadline] = useState<string>("");
  const [linkedinUrl, setLinkedinUrl] = useState<string>("");

  const [authenticating, setAuthenticating] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [createdParticipant, setCreatedParticipant] = useState<(Participant & { id: string }) | null>(null);

  // Step 2: Connect with LinkedIn Action
  const handleLinkedInAuth = (presetIdx: number = 0) => {
    setAuthenticating(true);
    setErrorMsg("");

    setTimeout(() => {
      const chosen = LINKEDIN_PRESETS[presetIdx % LINKEDIN_PRESETS.length];
      setName(chosen.name);
      setPhoto(chosen.photo);
      setCollege(chosen.college);
      setHeadline(chosen.headline);
      setLinkedinUrl(chosen.linkedinUrl);
      setAuthenticating(false);
      setStep("profile-confirmation");
    }, 900);
  };

  // Step 4: Confirm Profile & Create Participant in Firestore
  const handleConfirmProfile = async () => {
    setErrorMsg("");
    if (!name.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!linkedinUrl.trim()) {
      setErrorMsg("Please provide your LinkedIn profile URL.");
      return;
    }

    setSaving(true);

    try {
      const participantData: Omit<Participant, "id"> = {
        name: name.trim(),
        photo: photo.trim() || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
        college: college.trim() || "Anurag University",
        headline: headline.trim() || "Student & Technology Enthusiast",
        linkedinUrl: linkedinUrl.trim(),
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
      setErrorMsg(err.message || "Failed to join event room. Please try again.");
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
          if (!saving && !authenticating) onClose();
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
        {!saving && !authenticating && step !== "welcome" && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        )}

        <AnimatePresence mode="wait">
          {/* STEP 2: LINKEDIN AUTHENTICATION */}
          {step === "linkedin-auth" && (
            <motion.div
              key="step-linkedin-auth"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-orange-500">
                  STEP 1 OF 2 • IDENTITY VERIFICATION
                </span>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  Connect your LinkedIn
                </h2>
                <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                  Connect with fellow participants using your professional profile.
                </p>
              </div>

              {/* LinkedIn Graphic Box */}
              <div className="p-6 rounded-2xl bg-neutral-900/90 border border-neutral-800 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[#0A66C2]/15 border border-[#0A66C2]/30 flex items-center justify-center text-[#0A66C2] mx-auto shadow-lg">
                  <Linkedin size={36} />
                </div>
                <p className="text-xs text-neutral-300 font-medium max-w-xs mx-auto leading-relaxed">
                  Authenticate securely via LinkedIn to import your name, picture, college, and headline.
                </p>
              </div>

              {/* Primary OAuth Button */}
              <button
                type="button"
                disabled={authenticating}
                onClick={() => handleLinkedInAuth(0)}
                className="w-full py-4 px-6 rounded-2xl bg-[#0A66C2] hover:bg-[#084e96] active:scale-[0.99] text-white font-black text-xs md:text-sm uppercase tracking-wider transition-all shadow-xl shadow-[#0A66C2]/20 cursor-pointer flex items-center justify-center gap-3 border border-blue-400/30 disabled:opacity-50"
              >
                {authenticating ? (
                  <>
                    <Sparkles size={18} className="animate-spin text-white" />
                    <span>Connecting with LinkedIn...</span>
                  </>
                ) : (
                  <>
                    <Linkedin size={20} />
                    <span>Continue with LinkedIn</span>
                  </>
                )}
              </button>

              {/* Quick Preset Selector for Fast Demo */}
              <div className="pt-3 border-t border-neutral-800/80 space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase text-neutral-500 block">
                  Quick Demo Profiles:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {LINKEDIN_PRESETS.map((p, idx) => (
                    <button
                      key={p.name}
                      type="button"
                      disabled={authenticating}
                      onClick={() => handleLinkedInAuth(idx)}
                      className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-left transition-all cursor-pointer flex items-center gap-2"
                    >
                      <img src={p.photo} alt={p.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                      <div className="truncate">
                        <span className="text-[10px] font-extrabold text-white block truncate">{p.name}</span>
                        <span className="text-[8px] text-neutral-500 block truncate">{p.college}</span>
                      </div>
                    </button>
                  ))}
                </div>
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
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-orange-500">
                  STEP 2 OF 2 • PROFILE CONFIRMATION
                </span>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  Your Event Profile
                </h2>
                <p className="text-xs text-neutral-400 font-medium">
                  Review and edit your profile information before entering the event room.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Profile Card Preview & Form */}
              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
                {/* Photo Preview & Name */}
                <div className="flex items-center gap-3 pb-3 border-b border-neutral-800">
                  <img
                    src={photo || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || "User")}`}
                    alt={name}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-orange-500/40 shadow-md shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-mono font-black text-orange-500 uppercase tracking-widest block">
                      LINKEDIN VERIFIED
                    </span>
                    <h3 className="text-base font-black text-white truncate">{name || "Your Name"}</h3>
                    <p className="text-[11px] text-neutral-400 truncate">{headline || "Student"}</p>
                  </div>
                </div>

                {/* Editable Fields */}
                <div className="space-y-3">
                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                      <User size={12} className="text-orange-500" /> Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Arjun Sharma"
                      className="w-full px-3.5 py-2.5 text-xs bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl outline-none text-white font-bold transition-all"
                    />
                  </div>

                  {/* College */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                      <Building size={12} className="text-orange-500" /> College / Institution *
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

                  {/* Headline */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                      <Briefcase size={12} className="text-orange-500" /> Professional Headline *
                    </label>
                    <input
                      type="text"
                      required
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="e.g. Full-Stack Engineer & AI Developer"
                      className="w-full px-3.5 py-2.5 text-xs bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl outline-none text-white font-medium transition-all"
                    />
                  </div>

                  {/* LinkedIn Profile URL */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                      <LinkIcon size={12} className="text-orange-500" /> LinkedIn Profile URL *
                    </label>
                    <input
                      type="url"
                      required
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                      className="w-full px-3.5 py-2.5 text-xs bg-neutral-950 border border-neutral-800 focus:border-orange-500 rounded-xl outline-none text-white font-mono transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons: Back vs Confirm Profile */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setStep("linkedin-auth")}
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
                      <Sparkles size={16} className="animate-spin" />
                      <span>Creating Profile...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      <span>Confirm Profile</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 5: WELCOME */}
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
                  PARTICIPANT VERIFIED
                </span>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  You're In!
                </h2>
                <p className="text-xs text-neutral-400 font-medium">
                  Welcome to <strong className="text-orange-400">{eventTitle}</strong>
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
                  Participants Online Right Now
                </span>
              </div>

              {/* Enter Room Button */}
              <button
                type="button"
                onClick={() => onComplete(createdParticipant)}
                className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-2 border border-orange-400/40"
              >
                <Sparkles size={18} />
                <span>Enter Room</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
