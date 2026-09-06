import { useState, useEffect, FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, 
  KeyRound, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Building, 
  GraduationCap, 
  User, 
  BookOpen, 
  Calendar, 
  MapPin, 
  Clock,
  ArrowRight,
  RefreshCw,
  QrCode,
  Camera
} from "lucide-react";
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  serverTimestamp,
  updateDoc,
  increment
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { EventItem } from "../PublicEventPage";
import { Participant } from "../ParticipantOnboarding";
import { EventQRScannerModal } from "./EventQRScannerModal";

export function EventsJoinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Step 1 = Enter Event Code, Step 2 = Enter Participant Details
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Step 1 State: Code validation & QR scanning
  const [eventCodeInput, setEventCodeInput] = useState<string>("");
  const [validatingCode, setValidatingCode] = useState<boolean>(false);
  const [codeError, setCodeError] = useState<string>("");
  const [validatedEvent, setValidatedEvent] = useState<EventItem | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  // Step 2 State: Participant Details
  const [participantName, setParticipantName] = useState<string>("");
  const [college, setCollege] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [joining, setJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string>("");

  // Check if code was passed in URL query e.g. /events/join?code=XYZ
  useEffect(() => {
    const codeFromUrl = searchParams.get("code") || searchParams.get("eventCode");
    if (codeFromUrl && codeFromUrl.trim()) {
      setEventCodeInput(codeFromUrl.trim().toUpperCase());
      validateAndLookupCode(codeFromUrl.trim());
    }
  }, [searchParams]);

  // Normalizes code (case-insensitive & whitespace trimmed)
  const normalizeCode = (raw: string) => raw.trim();

  // Validate and retrieve event document with minimal reads
  const validateAndLookupCode = async (rawCodeToValidate?: string) => {
    const raw = rawCodeToValidate !== undefined ? rawCodeToValidate : eventCodeInput;
    const cleanCode = normalizeCode(raw);

    setCodeError("");

    if (!cleanCode) {
      setCodeError("Please enter an event code.");
      return;
    }

    setValidatingCode(true);

    try {
      const codeUpper = cleanCode.toUpperCase();
      const codeLower = cleanCode.toLowerCase();

      let targetDocSnap: any = null;

      // 1. Direct document ID lookup (exact, uppercase, lowercase)
      const directDocRef = doc(db, "events", cleanCode);
      const directDocSnap = await getDoc(directDocRef);

      if (directDocSnap.exists()) {
        targetDocSnap = directDocSnap;
      } else if (cleanCode !== codeLower) {
        const lowerDocSnap = await getDoc(doc(db, "events", codeLower));
        if (lowerDocSnap.exists()) {
          targetDocSnap = lowerDocSnap;
        }
      } else if (cleanCode !== codeUpper) {
        const upperDocSnap = await getDoc(doc(db, "events", codeUpper));
        if (upperDocSnap.exists()) {
          targetDocSnap = upperDocSnap;
        }
      }

      // 2. If direct doc ID lookup didn't find anything, query by eventCode or code field
      if (!targetDocSnap) {
        const eventsRef = collection(db, "events");

        // Try uppercase eventCode
        const qUpper = query(eventsRef, where("eventCode", "==", codeUpper), limit(1));
        let queryRes = await getDocs(qUpper);

        if (queryRes.empty) {
          // Try lowercase eventCode
          const qLower = query(eventsRef, where("eventCode", "==", codeLower), limit(1));
          queryRes = await getDocs(qLower);
        }

        if (queryRes.empty) {
          // Try "code" field
          const qCodeUpper = query(eventsRef, where("code", "==", codeUpper), limit(1));
          queryRes = await getDocs(qCodeUpper);
        }

        if (queryRes.empty) {
          // Try "code" field lowercase
          const qCodeLower = query(eventsRef, where("code", "==", codeLower), limit(1));
          queryRes = await getDocs(qCodeLower);
        }

        if (!queryRes.empty) {
          targetDocSnap = queryRes.docs[0];
        }
      }

      // 3. Evaluate lookup result
      if (!targetDocSnap || !targetDocSnap.exists()) {
        setCodeError("We couldn't find an event with that code.");
        setValidatingCode(false);
        return;
      }

      const eventData = { id: targetDocSnap.id, ...targetDocSnap.data() } as EventItem;

      // 4. Validate event status & participation acceptance
      if (eventData.status === "completed") {
        setCodeError("This event has already ended.");
        setValidatingCode(false);
        return;
      }

      const rawData = targetDocSnap.data() as any;
      if (rawData?.acceptingParticipants === false || rawData?.isArchived === true) {
        setCodeError("This event is not currently accepting participants.");
        setValidatingCode(false);
        return;
      }

      // 5. Successful validation - If LinkedIn Connect Room, direct straight to the networking room
      if (eventData.roomType === "linkedin_connect") {
        setValidatingCode(false);
        navigate(`/events/${eventData.id}/linkedin-connect`);
        return;
      }

      // Pre-fill existing local session details if present
      setValidatedEvent(eventData);

      try {
        const storedRaw = localStorage.getItem(`z2o_participant_${eventData.id}`);
        if (storedRaw) {
          const stored = JSON.parse(storedRaw);
          if (stored?.name) setParticipantName(stored.name);
          if (stored?.college) setCollege(stored.college);
          if (stored?.department) setDepartment(stored.department);
          if (stored?.year) setYear(stored.year);
        }
      } catch (e) {
        console.warn("Could not parse existing local participant session:", e);
      }

      setCurrentStep(2);
      setValidatingCode(false);
    } catch (err: any) {
      console.error("Error validating event code:", err);
      setCodeError("Something went wrong. Please try again.");
      setValidatingCode(false);
    }
  };

  // Handles participant registration & session creation
  const handleJoinEvent = async (e: FormEvent) => {
    e.preventDefault();
    setJoinError("");

    if (!validatedEvent) {
      setJoinError("Event verification lost. Please re-enter the event code.");
      setCurrentStep(1);
      return;
    }

    const trimmedName = participantName.trim();
    if (!trimmedName) {
      setJoinError("Please enter your name.");
      return;
    }

    if (trimmedName.length < 2) {
      setJoinError("Name must be at least 2 characters.");
      return;
    }

    if (trimmedName.length > 50) {
      setJoinError("Name cannot exceed 50 characters.");
      return;
    }

    setJoining(true);

    try {
      const eventId = validatedEvent.id;

      // 1. Check if participant already has a saved ID in local storage
      let participantId = "";
      try {
        const storedRaw = localStorage.getItem(`z2o_participant_${eventId}`);
        if (storedRaw) {
          const stored = JSON.parse(storedRaw);
          if (stored?.id && typeof stored.id === "string") {
            participantId = stored.id;
          }
        }
      } catch (e) {
        console.warn("Local storage check error:", e);
      }

      // If no valid existing ID, generate a collision-resistant participant ID
      if (!participantId) {
        const randomSlug = Math.random().toString(36).substring(2, 9);
        const timestamp = Date.now().toString(36);
        participantId = `p_${timestamp}_${randomSlug}`;
      }

      // 2. Prepare participant record payload
      const participantPayload: Participant & { id: string; eventId: string } = {
        id: participantId,
        eventId: eventId,
        name: trimmedName,
        college: college.trim(),
        department: department.trim(),
        year: year.trim(),
        roomType: validatedEvent.roomType || "normal",
        online: true,
        joinedAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
      };

      // 3. Write participant document to Firestore: events/{eventId}/participants/{participantId}
      const participantRef = doc(db, "events", eventId, "participants", participantId);
      await setDoc(participantRef, participantPayload, { merge: true });

      // Atomically increment participant counter on event doc if possible (ignoring failure if unauthorized)
      try {
        const eventRef = doc(db, "events", eventId);
        await updateDoc(eventRef, {
          participantCount: increment(1)
        });
      } catch {
        // Non-fatal if participant lacks update permission on root event doc
      }

      // 4. Save local session in localStorage
      try {
        localStorage.setItem(
          `z2o_participant_${eventId}`,
          JSON.stringify({
            id: participantId,
            eventId: eventId,
            name: trimmedName,
            college: college.trim(),
            department: department.trim(),
            year: year.trim(),
            roomType: validatedEvent.roomType || "normal",
            online: true,
            joinedAt: Date.now(),
          })
        );
      } catch (e) {
        console.warn("Unable to save session to localStorage:", e);
      }

      // 5. Navigate to event waiting room
      navigate(`/events/${eventId}/waiting`);
    } catch (err: any) {
      console.error("Error creating participant record:", err);
      setJoinError("Could not join event. Please check your connection and try again.");
      setJoining(false);
    }
  };

  const formatEventDate = (isoStr: string) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoStr;
    }
  };

  // Handle QR code detection from camera scanner
  const handleCodeDetected = (detectedCode: string) => {
    setIsScannerOpen(false);
    const clean = normalizeCode(detectedCode).toUpperCase();
    setEventCodeInput(clean);
    validateAndLookupCode(clean);
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-between selection:bg-orange-500/30 selection:text-orange-200 font-sans">
      {/* Top Bar */}
      <header className="w-full border-b border-neutral-900 bg-[#09090c]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (currentStep === 2) {
                setCurrentStep(1);
                setCodeError("");
              } else {
                navigate("/events");
              }
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            aria-label="Back to Events"
          >
            <ArrowLeft size={14} />
            <span>{currentStep === 2 ? "Change Event Code" : "Back to Events"}</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-tight text-white uppercase">
              ZERO<span className="text-orange-500">2</span>ONE
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
              JOIN
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="w-full max-w-lg mx-auto">
          <AnimatePresence mode="wait">
            {/* ================= STEP 1: ENTER EVENT CODE OR SCAN QR ================= */}
            {currentStep === 1 && (
              <motion.div
                key="step-code"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6"
              >
                {/* Header Badge & Title */}
                <div className="text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto shadow-sm">
                    <KeyRound size={26} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 inline-block mb-1">
                      PARTICIPANT ACCESS
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                      JOIN AN EVENT
                    </h1>
                    <p className="text-xs sm:text-sm text-neutral-400 font-normal leading-relaxed max-w-sm mx-auto">
                      Enter the event code or scan the event QR code.
                    </p>
                  </div>
                </div>

                {/* Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    validateAndLookupCode();
                  }}
                  className="space-y-4 pt-2"
                >
                  <div className="space-y-2">
                    <label
                      htmlFor="event-code-input"
                      className="block text-xs font-bold text-neutral-300 uppercase tracking-wider"
                    >
                      Event Code
                    </label>
                    <div className="relative">
                      <input
                        id="event-code-input"
                        type="text"
                        value={eventCodeInput}
                        onChange={(e) => {
                          setEventCodeInput(e.target.value.toUpperCase());
                          if (codeError) setCodeError("");
                        }}
                        placeholder="e.g. Z2O-101 or EVENT2026"
                        autoComplete="off"
                        autoFocus
                        disabled={validatingCode}
                        className="w-full bg-[#14141a] border border-neutral-700/80 focus:border-orange-500 rounded-2xl px-4 py-3.5 text-base sm:text-lg font-mono font-bold tracking-widest text-white uppercase placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all text-center"
                      />
                    </div>
                  </div>

                  {/* Validation Error Message */}
                  {codeError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-2.5"
                    >
                      <AlertCircle size={16} className="shrink-0 text-red-400" />
                      <span>{codeError}</span>
                    </motion.div>
                  )}

                  {/* Continue Button */}
                  <button
                    type="submit"
                    disabled={validatingCode}
                    className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                  >
                    {validatingCode ? (
                      <>
                        <Loader2 size={18} className="animate-spin text-white" />
                        <span>Validating Event...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative flex items-center justify-center py-0.5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-neutral-800" />
                  </div>
                  <div className="relative px-3 bg-[#0e0e12] text-[10px] font-extrabold text-neutral-500 uppercase tracking-widest">
                    OR
                  </div>
                </div>

                {/* Scan QR Code Button */}
                <button
                  type="button"
                  onClick={() => {
                    setCodeError("");
                    setIsScannerOpen(true);
                  }}
                  disabled={validatingCode}
                  className="w-full py-3.5 rounded-2xl bg-[#14141a] hover:bg-[#191922] active:scale-[0.99] border border-neutral-700/80 hover:border-orange-500/40 text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2.5 shadow-sm group"
                >
                  <div className="w-6 h-6 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
                    <Camera size={14} />
                  </div>
                  <span>Scan QR Code</span>
                </button>

                {/* Footnote */}
                <div className="pt-2 text-center">
                  <p className="text-[11px] text-neutral-500">
                    No account or college email required. Event codes are case-insensitive.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ================= STEP 2: PARTICIPANT DETAILS ================= */}
            {currentStep === 2 && validatedEvent && (
              <motion.div
                key="step-details"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="bg-[#0e0e12] border border-neutral-800/90 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6"
              >
                {/* Event Summary Card */}
                <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                      CONFIRMED EVENT
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentStep(1);
                        setCodeError("");
                      }}
                      className="text-[11px] font-semibold text-neutral-400 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
                    >
                      Change Code
                    </button>
                  </div>

                  <div>
                    <h2 className="text-base sm:text-lg font-black text-white leading-snug">
                      {validatedEvent.title}
                    </h2>
                    {validatedEvent.venue && (
                      <p className="text-xs text-neutral-400 flex items-center gap-1.5 mt-1">
                        <MapPin size={12} className="text-neutral-500 shrink-0" />
                        <span>{validatedEvent.venue}</span>
                      </p>
                    )}
                    {validatedEvent.startDate && (
                      <p className="text-xs text-neutral-400 flex items-center gap-1.5 mt-0.5">
                        <Calendar size={12} className="text-neutral-500 shrink-0" />
                        <span>{formatEventDate(validatedEvent.startDate)}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Section Header */}
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">
                    Participant Details
                  </h3>
                  <p className="text-xs text-neutral-400 font-normal">
                    Enter your profile details to join the waiting room and live activities.
                  </p>
                </div>

                {/* Details Form */}
                <form onSubmit={handleJoinEvent} className="space-y-4">
                  {/* Name (Required) */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="participant-name-input"
                      className="block text-xs font-bold text-neutral-300 uppercase tracking-wider"
                    >
                      Full Name <span className="text-orange-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                        <User size={16} />
                      </div>
                      <input
                        id="participant-name-input"
                        type="text"
                        value={participantName}
                        onChange={(e) => {
                          setParticipantName(e.target.value);
                          if (joinError) setJoinError("");
                        }}
                        placeholder="e.g. Alex Rivera"
                        required
                        autoFocus
                        disabled={joining}
                        maxLength={50}
                        className="w-full bg-[#14141a] border border-neutral-700/80 focus:border-orange-500 rounded-xl pl-10 pr-4 py-3 text-sm font-medium text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                      />
                    </div>
                  </div>

                  {/* College / Institution (Optional) */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="participant-college-input"
                      className="block text-xs font-bold text-neutral-300 uppercase tracking-wider"
                    >
                      College / Institution <span className="text-neutral-500 font-normal text-[10px]">(Optional)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                        <Building size={16} />
                      </div>
                      <input
                        id="participant-college-input"
                        type="text"
                        value={college}
                        onChange={(e) => setCollege(e.target.value)}
                        placeholder="e.g. Engineering College / University"
                        disabled={joining}
                        maxLength={80}
                        className="w-full bg-[#14141a] border border-neutral-700/80 focus:border-orange-500 rounded-xl pl-10 pr-4 py-3 text-sm font-medium text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                      />
                    </div>
                  </div>

                  {/* Department & Year (Optional) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="participant-dept-input"
                        className="block text-xs font-bold text-neutral-300 uppercase tracking-wider"
                      >
                        Department <span className="text-neutral-500 font-normal text-[10px]">(Optional)</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                          <BookOpen size={16} />
                        </div>
                        <input
                          id="participant-dept-input"
                          type="text"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          placeholder="e.g. CSE / AIML"
                          disabled={joining}
                          maxLength={40}
                          className="w-full bg-[#14141a] border border-neutral-700/80 focus:border-orange-500 rounded-xl pl-10 pr-4 py-3 text-sm font-medium text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="participant-year-input"
                        className="block text-xs font-bold text-neutral-300 uppercase tracking-wider"
                      >
                        Year / Batch <span className="text-neutral-500 font-normal text-[10px]">(Optional)</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                          <GraduationCap size={16} />
                        </div>
                        <input
                          id="participant-year-input"
                          type="text"
                          value={year}
                          onChange={(e) => setYear(e.target.value)}
                          placeholder="e.g. 3rd Year"
                          disabled={joining}
                          maxLength={30}
                          className="w-full bg-[#14141a] border border-neutral-700/80 focus:border-orange-500 rounded-xl pl-10 pr-4 py-3 text-sm font-medium text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Join Error */}
                  {joinError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-2.5"
                    >
                      <AlertCircle size={16} className="shrink-0 text-red-400" />
                      <span>{joinError}</span>
                    </motion.div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={joining}
                    className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 mt-2"
                  >
                    {joining ? (
                      <>
                        <Loader2 size={18} className="animate-spin text-white" />
                        <span>Joining Event...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>Join Event</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-900 py-6 text-center text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto px-4">
          ZERO2ONE Events &bull; Fast Participant Access
        </div>
      </footer>

      {/* QR Scanner Modal */}
      <EventQRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onCodeDetected={handleCodeDetected}
        onManualEntryClick={() => setIsScannerOpen(false)}
      />
    </div>
  );
}
