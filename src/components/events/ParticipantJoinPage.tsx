import { useState, useEffect, MouseEvent, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { 
  Linkedin, 
  ArrowLeft, 
  ShieldCheck, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  UserCheck, 
  Calendar, 
  MapPin, 
  Clock, 
  Globe 
} from "lucide-react";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { EventItem } from "../PublicEventPage";
import { extractLinkedinUsername } from "../ParticipantOnboarding";

export function ParticipantJoinPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Normal Room state
  const [normalName, setNormalName] = useState<string>("");
  const [submittingNormal, setSubmittingNormal] = useState<boolean>(false);

  // 1. Check existing participant session & OAuth URL params
  useEffect(() => {
    if (!eventId) return;

    let isMounted = true;

    async function checkExistingParticipantSession() {
      setCheckingAuth(true);

      // A. Check if participant already authenticated for this event
      try {
        const stored = localStorage.getItem(`z2o_participant_${eventId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.id) {
            // Verify against Firestore
            const pDoc = await getDoc(doc(db, "events", eventId, "participants", parsed.id));
            if (pDoc.exists()) {
              console.log("[ParticipantJoinPage] Session valid in Firestore. Redirecting to room.");
              if (isMounted) {
                navigate(`/events/${eventId}/room`, { replace: true });
                return;
              }
            } else {
              console.warn("[ParticipantJoinPage] Stored participant invalid in Firestore. Clearing.");
              localStorage.removeItem(`z2o_participant_${eventId}`);
            }
          }
        }
      } catch (err) {
        console.warn("[ParticipantJoinPage] Error checking participant session:", err);
      }

      // B. Check for OAuth redirect URL params (?linkedin_auth=success&profile=...)
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("linkedin_auth") === "success" && params.get("profile")) {
          const rawProfile = params.get("profile");
          if (rawProfile) {
            const parsed = JSON.parse(rawProfile);
            if (parsed && parsed.name) {
              console.log("[ParticipantJoinPage] Found OAuth redirect profile params:", parsed);
              const onboardingData = {
                importedProfile: parsed,
                linkedinUsername: extractLinkedinUsername(parsed.linkedinUsername || parsed.linkedinUrl || ""),
                currentStep: "profile-confirmation",
              };
              localStorage.setItem(`z2o_onboarding_${eventId}`, JSON.stringify(onboardingData));
              window.history.replaceState({}, document.title, window.location.pathname);
              if (isMounted) {
                navigate(`/events/${eventId}/onboarding`, { replace: true });
                return;
              }
            }
          }
        }
      } catch (err) {
        console.warn("[ParticipantJoinPage] Error parsing OAuth redirect params:", err);
      }

      if (isMounted) {
        setCheckingAuth(false);
      }
    }

    checkExistingParticipantSession();

    return () => {
      isMounted = false;
    };
  }, [eventId, navigate]);

  // 2. Fetch event metadata
  useEffect(() => {
    if (!eventId) return;

    let isMounted = true;

    async function fetchEvent() {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "events", eventId));
        if (snap.exists()) {
          if (isMounted) {
            setEvent({ id: snap.id, ...snap.data() } as EventItem);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setErrorMsg("Event not found. Please check the URL.");
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Failed loading event metadata:", err);
        if (isMounted) {
          setErrorMsg("Could not load event details.");
          setLoading(false);
        }
      }
    }

    fetchEvent();

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  // 3. Listen for OAuth window postMessage
  useEffect(() => {
    if (!eventId) return;

    const handleOAuthMessage = (evt: MessageEvent) => {
      const allowedOrigins = [
        window.location.origin,
        "http://localhost:3000",
        "http://localhost:5173",
      ];

      if (!allowedOrigins.includes(evt.origin)) return;

      if (evt.data?.type === "LINKEDIN_OAUTH_SUCCESS" && evt.data?.profile) {
        console.log("[ParticipantJoinPage] OAuth message received:", evt.data.profile);
        const p = evt.data.profile;
        const onboardingData = {
          importedProfile: {
            name: p.name || "LinkedIn User",
            photo: p.photo || "",
            email: p.email || "",
            linkedinSub: p.linkedinSub || "",
            linkedinUsername: p.linkedinUsername || p.linkedinUrl || "",
          },
          linkedinUsername: extractLinkedinUsername(p.linkedinUsername || p.linkedinUrl || ""),
          currentStep: "profile-confirmation",
        };

        localStorage.setItem(`z2o_onboarding_${eventId}`, JSON.stringify(onboardingData));
        setIsImporting(true);

        setTimeout(() => {
          navigate(`/events/${eventId}/onboarding`);
        }, 500);
      } else if (evt.data?.type === "LINKEDIN_OAUTH_ERROR") {
        setErrorMsg(evt.data?.error || "LinkedIn authorization failed or was cancelled.");
        setIsImporting(false);
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [eventId, navigate]);

  // Handle "Continue with LinkedIn" OAuth button click
  const handleStartOAuth = () => {
    if (!eventId) return;
    setErrorMsg("");
    setIsImporting(true);

    const authUrl = `/api/auth/linkedin/start?eventId=${eventId}&origin=${encodeURIComponent(window.location.origin)}`;

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
      // Fallback if popup is blocked: redirect window directly
      window.location.href = authUrl;
    }
  };

  // Handle "Continue with Direct Registration"
  const handleDirectRegistration = () => {
    if (!eventId) return;

    const onboardingData = {
      importedProfile: {
        name: "",
        photo: "",
        email: "",
        linkedinSub: "",
      },
      linkedinUsername: "",
      currentStep: "profile-confirmation",
    };

    localStorage.setItem(`z2o_onboarding_${eventId}`, JSON.stringify(onboardingData));
    navigate(`/events/${eventId}/onboarding`);
  };

  const handleNormalJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!eventId) return;

    const trimmed = normalName.trim();
    if (!trimmed) {
      setErrorMsg("Please enter your name.");
      return;
    }
    if (trimmed.length < 2) {
      setErrorMsg("Name must be at least 2 characters long.");
      return;
    }
    if (trimmed.length > 40) {
      setErrorMsg("Name must not exceed 40 characters.");
      return;
    }

    setErrorMsg("");
    setSubmittingNormal(true);

    try {
      const docRef = await addDoc(collection(db, "events", eventId, "participants"), {
        name: trimmed,
        roomType: "normal",
        online: true,
        joinedAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
      });

      const participantData = {
        id: docRef.id,
        name: trimmed,
        roomType: "normal",
        online: true,
      };

      localStorage.setItem(`z2o_participant_${eventId}`, JSON.stringify(participantData));
      navigate(`/events/${eventId}/room`, { replace: true });
    } catch (err: any) {
      console.error("Error creating normal participant:", err);
      setErrorMsg("Failed to join event room. Please try again.");
      setSubmittingNormal(false);
    }
  };

  const formatDateTime = (isoStr: string) => {
    if (!isoStr) return "TBD";
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return isoStr;
      return date.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoStr;
    }
  };

  if (checkingAuth || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 space-y-4">
        <Loader2 size={36} className="text-orange-500 animate-spin" />
        <p className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
          Checking event authentication...
        </p>
      </div>
    );
  }

  const isNormalRoom = event?.roomType === "normal";

  if (isNormalRoom) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500 selection:text-white pb-20 pt-6 px-4 sm:px-6 flex items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          
          {/* Back Button */}
          <button
            type="button"
            onClick={() => navigate(`/events/${eventId}`)}
            className="inline-flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} className="text-orange-500" />
            <span>Back to Event Overview</span>
          </button>

          {/* Event Header Summary Card */}
          {event && (
            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3 text-left">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-orange-500/15 border border-orange-500/30 text-orange-400">
                  NORMAL ROOM JOIN
                </span>
              </div>

              <h2 className="text-lg font-black text-white tracking-tight">
                {event.title}
              </h2>

              <div className="space-y-1.5 text-xs text-neutral-300 font-medium pt-1 border-t border-neutral-800/80">
                <div className="flex items-center gap-2">
                  <MapPin size={13} className="text-orange-500 shrink-0" />
                  <span className="truncate">{event.venue}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-orange-500 shrink-0" />
                  <span>{formatDateTime(event.startDate)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Normal Room Join Card */}
          <div className="p-6 md:p-8 rounded-3xl bg-[#121212] border border-neutral-800 shadow-2xl space-y-6 text-left">
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Enter Your Name
              </h1>
              <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                Please enter your name to enter the event room.
              </p>
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleNormalJoin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-black uppercase tracking-wider text-neutral-400 block">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={40}
                  value={normalName}
                  onChange={(e) => setNormalName(e.target.value)}
                  placeholder="Enter Your Name"
                  className="w-full px-4 py-3 text-sm bg-neutral-900 border border-neutral-800 hover:border-neutral-700 focus:border-orange-500 rounded-xl outline-none text-white font-bold transition-all placeholder:text-neutral-600"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={submittingNormal}
                className="w-full py-3.5 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-black text-xs md:text-sm uppercase tracking-wider transition-all shadow-xl shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-2 border border-orange-400/40 disabled:opacity-50"
              >
                {submittingNormal ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Joining Room...</span>
                  </>
                ) : (
                  <span>Continue</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500 selection:text-white pb-20 pt-6 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        
        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate(`/events/${eventId}`)}
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} className="text-orange-500" />
          <span>Back to Event Overview</span>
        </button>

        {/* Event Header Summary Card */}
        {event && (
          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3 text-left">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-orange-500/15 border border-orange-500/30 text-orange-400">
                EVENT REGISTRATION
              </span>
            </div>

            <h2 className="text-lg font-black text-white tracking-tight">
              {event.title}
            </h2>

            <div className="space-y-1.5 text-xs text-neutral-300 font-medium pt-1 border-t border-neutral-800/80">
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-orange-500 shrink-0" />
                <span className="truncate">{event.venue}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-orange-500 shrink-0" />
                <span>{formatDateTime(event.startDate)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Verification Card */}
        <div className="p-6 md:p-8 rounded-3xl bg-[#121212] border border-neutral-800 shadow-2xl space-y-6 text-left">
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-orange-500">
              IDENTITY VERIFICATION
            </span>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              Verify Your Account
            </h1>
            <p className="text-xs text-neutral-400 font-medium leading-relaxed">
              To build a trusted student directory, ZERO2ONE verifies all event participants using LinkedIn.
            </p>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Importing State Spinner */}
          {isImporting ? (
            <div className="py-8 text-center space-y-3">
              <Loader2 size={32} className="text-[#0A66C2] animate-spin mx-auto" />
              <p className="text-xs font-mono font-bold text-white">
                Importing Profile from LinkedIn...
              </p>
            </div>
          ) : (
            <>
              {/* Benefits Checklist */}
              <div className="space-y-2.5 p-4 rounded-2xl bg-neutral-950 border border-neutral-800/80">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Why verify with LinkedIn?
                </span>
                <div className="flex items-center gap-2.5 text-xs text-neutral-200 font-medium">
                  <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                  <span>Verified Identity &amp; Profile</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-neutral-200 font-medium">
                  <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                  <span>Authentic Peer Connections</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-neutral-200 font-medium">
                  <Linkedin size={16} className="text-[#0A66C2] shrink-0" />
                  <span>One-Click OAuth 2.0 Auth</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
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
                  onClick={handleDirectRegistration}
                  className="w-full py-3.5 px-5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 active:scale-[0.99] text-neutral-200 font-bold text-xs transition-all border border-neutral-800 cursor-pointer flex items-center justify-center gap-2.5"
                >
                  <UserCheck size={16} className="text-orange-500" />
                  <span>Continue with Direct Registration</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
