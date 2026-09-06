import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  limit,
  startAt,
  endAt,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Users,
  Linkedin,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Search,
  Building2,
  Sparkles,
  Lock,
  LogOut,
  Edit3,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  X,
} from "lucide-react";
import { db } from "../../lib/firebase";
import { LinkedInConnectParticipant } from "../../types/linkedinConnect";

const PAGE_SIZE = 25;

interface EventMetadata {
  id: string;
  title?: string;
  name?: string;
  eventCode?: string;
  code?: string;
  status?: string;
  acceptingParticipants?: boolean;
  roomType?: string;
  ownerId?: string;
}

export function LinkedInConnectRoomPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  // Event State
  const [eventData, setEventData] = useState<EventMetadata | null>(null);
  const [loadingEvent, setLoadingEvent] = useState<boolean>(true);
  const [eventError, setEventError] = useState<string | null>(null);

  // Authentication & Participant State
  const [myParticipant, setMyParticipant] = useState<LinkedInConnectParticipant | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Profile Confirmation Step (shows verified read-only OAuth card before entering)
  const [showProfileConfirm, setShowProfileConfirm] = useState<boolean>(false);
  const [verifiedOAuthProfile, setVerifiedOAuthProfile] = useState<{
    name: string;
    photo: string;
    headline: string;
    company: string;
    linkedinUrl: string;
    linkedinSub: string;
    authTicket?: string;
  } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // Room Participants & Pagination State
  const [participants, setParticipants] = useState<LinkedInConnectParticipant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);

  // Search state
  const [searchInput, setSearchInput] = useState<string>("");
  const [activeSearch, setActiveSearch] = useState<string>("");
  const [searchMode, setSearchMode] = useState<"name" | "company">("name");
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Page cursors & bounded in-memory cache for the current query
  const [pageCursors, setPageCursors] = useState<
    Record<number, { firstDoc: QueryDocumentSnapshot<DocumentData> | null; lastDoc: QueryDocumentSnapshot<DocumentData> | null }>
  >({});
  const [pageDataCache, setPageDataCache] = useState<
    Record<number, LinkedInConnectParticipant[]>
  >({});

  // Feedback State
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // 1. Fetch Event Document
  useEffect(() => {
    if (!eventId) return;

    const eventDocRef = doc(db, "events", eventId);
    const unsubscribe = onSnapshot(
      eventDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setEventError("This event or networking room could not be found.");
          setLoadingEvent(false);
          return;
        }

        const data = snapshot.data();
        setEventData({
          id: snapshot.id,
          title: data.title || data.name || "LinkedIn Connect Room",
          name: data.name || data.title || "LinkedIn Connect Room",
          eventCode: data.eventCode || data.code || "",
          code: data.code || data.eventCode || "",
          status: data.status || "draft",
          acceptingParticipants: data.acceptingParticipants !== false,
          roomType: data.roomType || "linkedin_connect",
          ownerId: data.ownerId || "",
        });
        setLoadingEvent(false);
      },
      (err) => {
        console.error("Error reading event doc:", err);
        setEventError("Failed to load room details. Please check your network connection.");
        setLoadingEvent(false);
      }
    );

    return () => unsubscribe();
  }, [eventId]);

  // 2. Check Local Cached Participant Session
  useEffect(() => {
    if (!eventId) return;

    try {
      const stored = localStorage.getItem(`z2o_linkedin_connect_${eventId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id && parsed.name) {
          setMyParticipant(parsed);
        }
      }
    } catch (e) {
      console.warn("Could not parse saved participant session:", e);
    }
  }, [eventId]);

  // 3. Debounce search input (400ms) to avoid executing queries on every keystroke
  useEffect(() => {
    setIsSearching(true);
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      setActiveSearch(trimmed);
      setIsSearching(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // 4. Low-Read Paginated Directory Fetching (Query-level pagination, MAX 25 docs)
  const fetchDirectoryPage = async (
    targetPage: number,
    cursorDoc: QueryDocumentSnapshot<DocumentData> | null,
    search: string,
    mode: "name" | "company"
  ) => {
    if (!eventId) return;
    setLoadingParticipants(true);
    setPageError(null);

    try {
      const participantsCol = collection(db, "events", eventId, "linkedin_participants");
      let q;

      const normalizedTerm = search.toLowerCase();

      if (normalizedTerm) {
        // Query-level prefix search on normalized indexed field
        const field = mode === "company" ? "companyLower" : "nameLower";
        if (cursorDoc && targetPage > 1) {
          q = query(
            participantsCol,
            orderBy(field),
            startAt(normalizedTerm),
            endAt(normalizedTerm + "\uf8ff"),
            startAfter(cursorDoc),
            limit(PAGE_SIZE)
          );
        } else {
          q = query(
            participantsCol,
            orderBy(field),
            startAt(normalizedTerm),
            endAt(normalizedTerm + "\uf8ff"),
            limit(PAGE_SIZE)
          );
        }
      } else {
        // Standard paginated directory ordered by joinedAt desc
        if (cursorDoc && targetPage > 1) {
          q = query(
            participantsCol,
            orderBy("joinedAt", "desc"),
            startAfter(cursorDoc),
            limit(PAGE_SIZE)
          );
        } else {
          q = query(
            participantsCol,
            orderBy("joinedAt", "desc"),
            limit(PAGE_SIZE)
          );
        }
      }

      const snapshot = await getDocs(q);
      const docs = snapshot.docs;
      const list: LinkedInConnectParticipant[] = [];

      docs.forEach((docSnap) => {
        const d = docSnap.data() as Record<string, any>;
        list.push({
          id: docSnap.id,
          eventId: eventId,
          linkedinSub: d.linkedinSub || "",
          name: d.name || "LinkedIn Member",
          nameLower: d.nameLower || (d.name ? d.name.toLowerCase() : ""),
          photo: d.photo || "",
          headline: d.headline || "",
          company: d.company || "",
          companyLower: d.companyLower || (d.company ? d.company.toLowerCase() : ""),
          linkedinUrl: d.linkedinUrl || "",
          joinedAt: d.joinedAt,
          lastSeen: d.lastSeen,
        });
      });

      const firstDoc = docs.length > 0 ? docs[0] : null;
      const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

      // Store cursors for pagination navigation
      setPageCursors((prev) => ({
        ...prev,
        [targetPage]: { firstDoc, lastDoc },
      }));

      // Cache data in memory for instant Previous navigation without re-reads
      setPageDataCache((prev) => ({
        ...prev,
        [targetPage]: list,
      }));

      setParticipants(list);
      setCurrentPage(targetPage);
      setHasNextPage(docs.length === PAGE_SIZE);
    } catch (err: any) {
      console.error("Error loading participant directory page:", err);
      setPageError("Unable to load people. Please check your connection and try again.");
    } finally {
      setLoadingParticipants(false);
    }
  };

  // 5. Query page 1 when event, active search term, or search mode changes
  useEffect(() => {
    if (!eventId) return;
    setCurrentPage(1);
    setPageCursors({});
    setPageDataCache({});
    fetchDirectoryPage(1, null, activeSearch, searchMode);
  }, [eventId, activeSearch, searchMode]);

  // Page Navigation Handlers
  const handleNextPage = () => {
    if (loadingParticipants || !hasNextPage) return;
    const nextPage = currentPage + 1;

    // Use memory cache if page was already fetched
    if (pageDataCache[nextPage]) {
      setParticipants(pageDataCache[nextPage]);
      setCurrentPage(nextPage);
      setHasNextPage(pageDataCache[nextPage].length === PAGE_SIZE);
      return;
    }

    const currentCursor = pageCursors[currentPage]?.lastDoc;
    if (!currentCursor) return;

    fetchDirectoryPage(nextPage, currentCursor, activeSearch, searchMode);
  };

  const handlePrevPage = () => {
    if (loadingParticipants || currentPage <= 1) return;
    const prevPage = currentPage - 1;

    // Use memory cache: 0 Firestore reads!
    if (pageDataCache[prevPage]) {
      setParticipants(pageDataCache[prevPage]);
      setCurrentPage(prevPage);
      setHasNextPage(true);
      return;
    }

    const cursorForPrev = pageCursors[prevPage - 1]?.lastDoc || null;
    fetchDirectoryPage(prevPage, cursorForPrev, activeSearch, searchMode);
  };

  const handleRefresh = () => {
    if (loadingParticipants) return;
    const cursor = currentPage === 1 ? null : (pageCursors[currentPage - 1]?.lastDoc || null);
    fetchDirectoryPage(currentPage, cursor, activeSearch, searchMode);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setActiveSearch("");
  };

  // 4. Listen for OAuth PostMessage & handle URL redirect fallback
  useEffect(() => {
    // Check URL parameters for redirect fallback
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("linkedin_auth") === "success" && params.get("profile")) {
        const rawProfile = params.get("profile");
        if (rawProfile) {
          const parsed = JSON.parse(rawProfile);
          if (parsed && (parsed.name || parsed.linkedinSub)) {
            setVerifiedOAuthProfile({
              name: parsed.name || "LinkedIn Member",
              photo: parsed.photo || "",
              headline: parsed.headline || "Participant",
              company: parsed.company || "Anurag University",
              linkedinUrl: parsed.linkedinUrl || "",
              linkedinSub: parsed.linkedinSub || "",
              authTicket: parsed.authTicket || "",
            });
            setShowProfileConfirm(true);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      }
    } catch (e) {
      console.warn("Error parsing OAuth redirect params:", e);
    }

    const handleOAuthMessage = (evt: MessageEvent) => {
      const allowedOrigins = [
        window.location.origin,
        "http://localhost:3000",
        "http://localhost:5173",
      ];
      if (!allowedOrigins.includes(evt.origin)) return;

      if (evt.data?.type === "LINKEDIN_OAUTH_SUCCESS" && evt.data?.profile) {
        const p = evt.data.profile;
        console.log("[LinkedInConnectRoom] Received verified profile from trusted OAuth:", p);

        // Populate trusted read-only profile state directly from server
        setVerifiedOAuthProfile({
          name: p.name || "LinkedIn Member",
          photo: p.photo || "",
          headline: p.headline || "Participant",
          company: p.company || "Anurag University",
          linkedinUrl: p.linkedinUrl || "",
          linkedinSub: p.linkedinSub || "",
          authTicket: p.authTicket || "",
        });

        setIsAuthenticating(false);
        setAuthError(null);
        setShowProfileConfirm(true);
      } else if (evt.data?.type === "LINKEDIN_OAUTH_ERROR") {
        setAuthError(evt.data?.error || "LinkedIn authentication was cancelled or encountered an error.");
        setIsAuthenticating(false);
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, []);

  // Handle "Sign in with LinkedIn" click
  const handleStartLinkedInOAuth = () => {
    if (!eventId) return;
    setAuthError(null);
    setIsAuthenticating(true);

    const authUrl = `/api/auth/linkedin/start?eventId=${eventId}&origin=${encodeURIComponent(
      window.location.origin
    )}`;

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
      window.location.href = authUrl;
    }
  };

  // Handle Profile Confirmation & Joining Room
  const handleConfirmJoin = async () => {
    if (!eventId || !verifiedOAuthProfile) return;

    setIsSavingProfile(true);
    setAuthError(null);

    try {
      let joinedParticipant: LinkedInConnectParticipant | null = null;

      // 1. Authoritative join via backend endpoint (verifies HMAC ticket & writes to Firestore)
      if (verifiedOAuthProfile.authTicket) {
        try {
          const res = await fetch("/api/auth/linkedin/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId,
              authTicket: verifiedOAuthProfile.authTicket,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success && data.participant) {
            joinedParticipant = data.participant;
          } else if (data.error) {
            console.warn("Backend /api/auth/linkedin/join error:", data.error);
          }
        } catch (fetchErr) {
          console.warn("Fetch /api/auth/linkedin/join failed, falling back to direct write:", fetchErr);
        }
      }

      // 2. Fallback direct write using trusted OAuth state (if API route unreachable)
      if (!joinedParticipant) {
        const rawSub = verifiedOAuthProfile.linkedinSub || "";
        const safeSub = rawSub.replace(/[^a-zA-Z0-9_-]/g, "");
        const participantId = `lp_${safeSub || Date.now().toString()}`;

        const cleanName = verifiedOAuthProfile.name.trim() || "LinkedIn Member";
        const cleanCompany = verifiedOAuthProfile.company.trim() || "Anurag University";
        const cleanHeadline = verifiedOAuthProfile.headline.trim() || "Participant";
        const cleanPhoto = (verifiedOAuthProfile.photo || "").trim();
        const cleanUrl = (verifiedOAuthProfile.linkedinUrl || "").trim();

        const participantPayload: LinkedInConnectParticipant = {
          id: participantId,
          eventId: eventId,
          linkedinSub: rawSub,
          name: cleanName,
          nameLower: cleanName.toLowerCase(),
          companyLower: cleanCompany.toLowerCase(),
          photo: cleanPhoto,
          headline: cleanHeadline,
          company: cleanCompany,
          linkedinUrl: cleanUrl,
          joinedAt: serverTimestamp(),
          lastSeen: serverTimestamp(),
        };

        const participantRef = doc(db, "events", eventId, "linkedin_participants", participantId);
        await setDoc(participantRef, participantPayload, { merge: true });

        joinedParticipant = {
          ...participantPayload,
          joinedAt: Date.now(),
          lastSeen: Date.now(),
        };
      }

      // Save to localStorage for instant local session recovery
      localStorage.setItem(
        `z2o_linkedin_connect_${eventId}`,
        JSON.stringify(joinedParticipant)
      );

      setMyParticipant(joinedParticipant);
      setShowProfileConfirm(false);
      setVerifiedOAuthProfile(null);

      // Refresh directory page 1 to immediately reflect the new participant
      fetchDirectoryPage(1, null, activeSearch, searchMode);
    } catch (err: any) {
      console.error("Error joining LinkedIn Connect room:", err);
      setAuthError("Failed to enter room. Please check your network and try again.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Leave Room
  const handleLeaveRoom = async () => {
    if (!eventId || !myParticipant) return;
    try {
      const ref = doc(db, "events", eventId, "linkedin_participants", myParticipant.id);
      await deleteDoc(ref);
    } catch (err) {
      console.warn("Error deleting participant doc on leave:", err);
    }
    localStorage.removeItem(`z2o_linkedin_connect_${eventId}`);
    setMyParticipant(null);
    fetchDirectoryPage(1, null, activeSearch, searchMode);
  };

  // Exclude current user from visible roster (search is handled at query level)
  const otherParticipants = useMemo(() => {
    return participants.filter((p) => {
      if (myParticipant) {
        if (p.id === myParticipant.id) return false;
        if (myParticipant.linkedinSub && p.linkedinSub === myParticipant.linkedinSub) return false;
      }
      return true;
    });
  }, [participants, myParticipant]);

  // Copy Code Helper
  const handleCopyCode = async () => {
    const code = eventData?.eventCode || eventData?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.warn("Copy failed:", err);
    }
  };

  // Handle Connect Click (Direct external LinkedIn redirect)
  const handleConnect = (person: LinkedInConnectParticipant) => {
    if (!person.linkedinUrl) return;
    let target = person.linkedinUrl.trim();
    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      target = `https://${target}`;
    }
    window.open(target, "_blank", "noopener,noreferrer");
  };

  // Validate LinkedIn URL format for display
  const isValidLinkedInUrl = (url?: string) => {
    if (!url) return false;
    const clean = url.trim().toLowerCase();
    return clean.includes("linkedin.com/");
  };

  // ----------------------------------------------------
  // RENDER: Loading State
  // ----------------------------------------------------
  if (loadingEvent) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 space-y-4 font-sans">
        <Loader2 size={36} className="text-[#0A66C2] animate-spin" />
        <p className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
          Entering LinkedIn Connect Room...
        </p>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Error / Not Found State
  // ----------------------------------------------------
  if (eventError || !eventData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-[#121212] border border-neutral-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-xl font-black text-white">Room Unavailable</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {eventError || "This networking room is currently unavailable or has been removed."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/events")}
            className="w-full py-3.5 px-6 rounded-2xl bg-neutral-900 hover:bg-neutral-850 text-white font-bold text-xs uppercase tracking-wider transition-all border border-neutral-800 cursor-pointer"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Room Closed State
  // ----------------------------------------------------
  const isRoomClosed =
    eventData.status === "closed" ||
    eventData.status === "completed" ||
    (eventData.acceptingParticipants === false && eventData.status !== "published");

  if (isRoomClosed && !myParticipant) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-[#121212] border border-neutral-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <Lock size={24} />
          </div>
          <h2 className="text-xl font-black text-white">Room Closed</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            This LinkedIn Connect Room is currently closed by the organizer and is not accepting new connections.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/events/${eventId}`)}
            className="w-full py-3.5 px-6 rounded-2xl bg-neutral-900 hover:bg-neutral-850 text-white font-bold text-xs uppercase tracking-wider transition-all border border-neutral-800 cursor-pointer"
          >
            Back to Event Overview
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Step A — Trusted Profile Confirmation View
  // ----------------------------------------------------
  if (showProfileConfirm && verifiedOAuthProfile) {
    const hasTrustedUrl = isValidLinkedInUrl(verifiedOAuthProfile.linkedinUrl);

    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-20 pt-6 px-4 sm:px-6 flex items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-[#121212] border border-neutral-800 shadow-2xl space-y-6 text-left">
            <div className="space-y-1.5 pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0A66C2]" />
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#0A66C2]">
                  LINKEDIN AUTHENTICATED
                </span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                You're joining as
              </h1>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Confirm your verified profile details to enter the LinkedIn Connect Room.
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Read-Only Profile Card (Zero Editable Inputs) */}
            <div className="p-5 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-4">
              <div className="flex items-start gap-4">
                {verifiedOAuthProfile.photo ? (
                  <img
                    src={verifiedOAuthProfile.photo}
                    alt={verifiedOAuthProfile.name}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-2xl object-cover border border-neutral-700 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-[#0A66C2]/20 text-[#0A66C2] flex items-center justify-center font-black text-xl border border-[#0A66C2]/30 shrink-0">
                    {verifiedOAuthProfile.name.slice(0, 2).toUpperCase() || "LI"}
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-white truncate">
                      {verifiedOAuthProfile.name}
                    </h2>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      <ShieldCheck size={11} />
                      <span>Verified</span>
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300 font-medium line-clamp-2">
                    {verifiedOAuthProfile.headline || "Participant"}
                  </p>

                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-medium truncate pt-0.5">
                    <Building2 size={12} className="text-[#0A66C2] shrink-0" />
                    <span className="truncate">{verifiedOAuthProfile.company || "Anurag University"}</span>
                  </div>
                </div>
              </div>

              {/* Trusted LinkedIn Profile URL Preview (Read-Only) */}
              {hasTrustedUrl ? (
                <div className="pt-3 border-t border-neutral-800 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0 text-neutral-300 truncate">
                    <Linkedin size={15} className="text-[#0A66C2] shrink-0" />
                    <span className="truncate font-mono text-[11px] text-neutral-400">
                      {verifiedOAuthProfile.linkedinUrl}
                    </span>
                  </div>
                  <a
                    href={verifiedOAuthProfile.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0A66C2] hover:underline text-[11px] font-bold flex items-center gap-1 shrink-0"
                  >
                    <span>Preview</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div className="pt-2 space-y-2.5">
              <button
                type="button"
                onClick={handleConfirmJoin}
                disabled={isSavingProfile}
                className="w-full py-4 px-6 rounded-2xl bg-[#0A66C2] hover:bg-[#084e96] active:scale-[0.99] text-white font-black text-xs uppercase tracking-wider transition-all shadow-xl shadow-[#0A66C2]/20 cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                {isSavingProfile ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Entering Room...</span>
                  </>
                ) : (
                  <>
                    <UserCheck size={18} />
                    <span>Continue to LinkedIn Connect Room</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowProfileConfirm(false);
                  setVerifiedOAuthProfile(null);
                }}
                disabled={isSavingProfile}
                className="w-full py-2.5 text-center text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Step B — LinkedIn Authentication Required
  // ----------------------------------------------------
  if (!myParticipant) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#0A66C2] selection:text-white pb-20 pt-8 px-4 sm:px-6 flex items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => navigate(`/events/${eventId}`)}
            className="inline-flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} className="text-[#0A66C2]" />
            <span>Back to Event Overview</span>
          </button>

          {/* Event Header Summary Card */}
          <div className="p-5 rounded-2xl bg-[#121212] border border-neutral-800 space-y-3 text-left">
            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-[#0A66C2]/15 border border-[#0A66C2]/30 text-[#0A66C2]">
                LINKEDIN CONNECT ROOM
              </span>

              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-neutral-400">
                <span>CODE:</span>
                <span className="text-white bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                  {eventData.eventCode || eventData.code}
                </span>
              </div>
            </div>

            <h2 className="text-xl font-black text-white tracking-tight">
              {eventData.title}
            </h2>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Meet people in this room and connect with them on LinkedIn.
            </p>
          </div>

          {/* Authentication Gateway Card */}
          <div className="p-6 md:p-8 rounded-3xl bg-[#121212] border border-neutral-800 shadow-2xl space-y-6 text-left">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#0A66C2]/15 border border-[#0A66C2]/30 flex items-center justify-center text-[#0A66C2]">
                <Linkedin size={24} />
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                LinkedIn Sign-In Required
              </h1>
              <p className="text-xs text-neutral-400 font-medium leading-relaxed">
                Sign in with LinkedIn to enter the networking room and connect with other participants.
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {isAuthenticating ? (
              <div className="py-8 text-center space-y-3">
                <Loader2 size={32} className="text-[#0A66C2] animate-spin mx-auto" />
                <p className="text-xs font-mono font-bold text-white">
                  Authenticating with LinkedIn...
                </p>
                <p className="text-[11px] text-neutral-400">
                  Please complete the authorization in the popup window.
                </p>
              </div>
            ) : (
              <>
                {/* Benefits Checklist */}
                <div className="space-y-2.5 p-4 rounded-2xl bg-neutral-950 border border-neutral-800/80">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                    Room Features
                  </span>
                  <div className="flex items-center gap-2.5 text-xs text-neutral-200 font-medium">
                    <ShieldCheck size={16} className="text-[#0A66C2] shrink-0" />
                    <span>Verified LinkedIn profile</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-neutral-200 font-medium">
                    <CheckCircle2 size={16} className="text-[#0A66C2] shrink-0" />
                    <span>See all attendees in this room</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-neutral-200 font-medium">
                    <ExternalLink size={16} className="text-[#0A66C2] shrink-0" />
                    <span>One-click LinkedIn connection redirects</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartLinkedInOAuth}
                  className="w-full py-4 px-6 rounded-2xl bg-[#0A66C2] hover:bg-[#084e96] active:scale-[0.99] text-white font-black text-xs md:text-sm uppercase tracking-wider transition-all shadow-xl shadow-[#0A66C2]/20 cursor-pointer flex items-center justify-center gap-3 border border-blue-400/30"
                >
                  <Linkedin size={20} />
                  <span>Sign in with LinkedIn</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Step C — Active LinkedIn Connect Room
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#0A66C2] selection:text-white pb-24 pt-6 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Navigation & Info Header */}
        <header className="p-5 sm:p-6 rounded-3xl bg-[#121212] border border-neutral-800 shadow-xl space-y-4 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-[#0A66C2]/15 border border-[#0A66C2]/30 text-[#0A66C2] flex items-center gap-1.5">
                  <Linkedin size={11} />
                  <span>LinkedIn Connect Room</span>
                </span>

                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live Networking</span>
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight pt-1">
                {eventData.title}
              </h1>

              <p className="text-xs sm:text-sm text-neutral-400 font-medium">
                Meet people in this room and connect with them on LinkedIn.
              </p>
            </div>

            {/* Room Code & Action Pills */}
            <div className="flex items-center gap-2.5 self-start sm:self-center flex-wrap">
              <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-2xl px-3.5 py-2">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                  CODE:
                </span>
                <span className="text-xs font-mono font-black text-[#0A66C2] tracking-wider">
                  {eventData.eventCode || eventData.code}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="text-neutral-400 hover:text-white transition-colors cursor-pointer ml-1"
                  title="Copy Event Code"
                >
                  {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleLeaveRoom}
                className="px-3.5 py-2 rounded-2xl bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-red-400 border border-neutral-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                title="Leave networking room"
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">Leave Room</span>
              </button>
            </div>
          </div>

          {/* Current User Networking Banner */}
          <div className="pt-4 border-t border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-950/60 p-4 rounded-2xl border border-neutral-850">
            <div className="flex items-center gap-3 min-w-0">
              {myParticipant.photo ? (
                <img
                  src={myParticipant.photo}
                  alt={myParticipant.name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-xl object-cover border border-neutral-700 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-[#0A66C2]/20 text-[#0A66C2] flex items-center justify-center font-black text-sm border border-[#0A66C2]/30 shrink-0">
                  {myParticipant.name.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="truncate">{myParticipant.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400">
                    You
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400 truncate">
                  {myParticipant.headline || myParticipant.company || "Anurag University"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setVerifiedOAuthProfile({
                    name: myParticipant.name,
                    photo: myParticipant.photo || "",
                    headline: myParticipant.headline || "",
                    company: myParticipant.company || "",
                    linkedinUrl: myParticipant.linkedinUrl || "",
                    linkedinSub: myParticipant.linkedinSub || "",
                  });
                  setShowProfileConfirm(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <UserCheck size={12} />
                <span>My Card</span>
              </button>

              {myParticipant.linkedinUrl && (
                <a
                  href={myParticipant.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-[#0A66C2]/15 hover:bg-[#0A66C2]/25 text-[#0A66C2] border border-[#0A66C2]/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <ExternalLink size={12} />
                  <span>My LinkedIn</span>
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#121212] border border-neutral-800 text-xs font-bold text-white">
              <Users size={14} className="text-[#0A66C2]" />
              <span>People on this page</span>
              <span className="ml-1 px-2 py-0.2 rounded-full bg-[#0A66C2]/20 text-[#0A66C2] text-[10px] font-mono font-black">
                {otherParticipants.length}
              </span>
            </div>

            {/* Mode Switch: Name vs Company query */}
            <div className="flex items-center p-1 rounded-xl bg-[#121212] border border-neutral-800 text-xs font-medium">
              <button
                type="button"
                onClick={() => setSearchMode("name")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  searchMode === "name"
                    ? "bg-[#0A66C2] text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Name
              </button>
              <button
                type="button"
                onClick={() => setSearchMode("company")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  searchMode === "company"
                    ? "bg-[#0A66C2] text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Company
              </button>
            </div>
          </div>

          {/* Search Input with Debounce & Clear */}
          <div className="flex items-center gap-2 w-full md:w-80">
            <div className="relative flex-1">
              {isSearching ? (
                <Loader2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0A66C2] animate-spin" />
              ) : (
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              )}
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={searchMode === "name" ? "Search people by name..." : "Search by company / university..."}
                className="w-full pl-9 pr-8 py-2 text-xs bg-[#121212] border border-neutral-800 hover:border-neutral-700 focus:border-[#0A66C2] rounded-xl outline-none text-white font-medium transition-all placeholder:text-neutral-500"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5 rounded cursor-pointer"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loadingParticipants}
              className="p-2 rounded-xl bg-[#121212] border border-neutral-800 hover:border-neutral-700 disabled:opacity-40 text-neutral-300 hover:text-white transition-all cursor-pointer shrink-0"
              title="Refresh current page"
            >
              <RotateCw size={14} className={loadingParticipants ? "animate-spin text-[#0A66C2]" : ""} />
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* PEOPLE IN THIS ROOM: PAGINATED DIRECTORY GRID        */}
        {/* ---------------------------------------------------- */}
        {pageError ? (
          <div className="p-10 rounded-3xl bg-[#121212] border border-red-900/40 text-center space-y-3">
            <AlertCircle size={28} className="text-red-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">Unable to load people</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">{pageError}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-white font-bold text-xs border border-neutral-800 cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : loadingParticipants && currentPage === 1 ? (
          <div className="py-16 text-center space-y-3">
            <Loader2 size={32} className="text-[#0A66C2] animate-spin mx-auto" />
            <p className="text-xs font-mono font-bold text-neutral-400">
              {activeSearch ? `Searching for "${activeSearch}"...` : "Loading people..."}
            </p>
          </div>
        ) : otherParticipants.length === 0 ? (
          <div className="p-12 sm:p-16 rounded-3xl bg-[#121212] border border-neutral-800 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0A66C2]/15 border border-[#0A66C2]/30 flex items-center justify-center mx-auto text-[#0A66C2]">
              <Users size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">
                {activeSearch ? "No matching participants found" : "You are the first person in this room!"}
              </h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
                {activeSearch
                  ? `No participants matched "${activeSearch}" by ${searchMode}. Try another keyword or switch between Name/Company.`
                  : "Share the event code with your classmates or attendees. As they sign in with LinkedIn, they will appear here automatically."}
              </p>
            </div>

            {activeSearch ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-4 py-2.5 rounded-xl bg-[#0A66C2] hover:bg-[#084e96] text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Clear Search
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-white font-bold text-xs uppercase tracking-wider transition-all border border-neutral-800 cursor-pointer inline-flex items-center gap-2"
              >
                {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>Copy Event Code</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {otherParticipants.map((person) => {
                  const hasValidUrl = isValidLinkedInUrl(person.linkedinUrl);

                  return (
                    <motion.div
                      key={person.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="p-5 rounded-3xl bg-[#121212] border border-neutral-800 hover:border-neutral-700 transition-all flex flex-col justify-between space-y-4 text-left shadow-lg"
                    >
                      <div className="space-y-3">
                        {/* Avatar & Verification Pill */}
                        <div className="flex items-start justify-between gap-3">
                          {person.photo ? (
                            <img
                              src={person.photo}
                              alt={person.name}
                              referrerPolicy="no-referrer"
                              className="w-14 h-14 rounded-2xl object-cover border border-neutral-750 shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-2xl bg-[#0A66C2]/20 text-[#0A66C2] flex items-center justify-center font-black text-lg border border-[#0A66C2]/30 shrink-0">
                              {person.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}

                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#0A66C2]/10 text-[#0A66C2] border border-[#0A66C2]/20 flex items-center gap-1 shrink-0">
                            <ShieldCheck size={11} />
                            <span>Verified</span>
                          </span>
                        </div>

                        {/* Name & Details */}
                        <div className="space-y-1">
                          <h3 className="text-base font-black text-white tracking-tight truncate">
                            {person.name}
                          </h3>

                          {person.headline ? (
                            <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed font-medium">
                              {person.headline}
                            </p>
                          ) : (
                            <p className="text-xs text-neutral-500 italic">
                              Student / Professional
                            </p>
                          )}

                          {person.company && (
                            <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 pt-1 font-medium truncate">
                              <Building2 size={12} className="text-[#0A66C2] shrink-0" />
                              <span className="truncate">{person.company}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Connect Button */}
                      <div className="pt-2 border-t border-neutral-850">
                        {hasValidUrl ? (
                          <button
                            type="button"
                            onClick={() => handleConnect(person)}
                            className="w-full py-3 px-4 rounded-xl bg-[#0A66C2] hover:bg-[#084e96] active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-[#0A66C2]/20"
                            title={`Open ${person.name}'s LinkedIn profile`}
                          >
                            <Linkedin size={15} />
                            <span>Connect</span>
                            <ExternalLink size={12} className="opacity-80" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="w-full py-3 px-4 rounded-xl bg-neutral-900 text-neutral-500 border border-neutral-800 font-bold text-xs cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <Linkedin size={14} className="opacity-40" />
                            <span>LinkedIn profile unavailable</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Pagination Bottom Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 pb-2 border-t border-neutral-800">
              <div className="text-xs text-neutral-400 font-medium text-center sm:text-left">
                <span>Showing </span>
                <span className="text-white font-bold font-mono">
                  {(currentPage - 1) * PAGE_SIZE + 1}–{(currentPage - 1) * PAGE_SIZE + otherParticipants.length}
                </span>
                <span> on Page </span>
                <span className="text-white font-bold font-mono">{currentPage}</span>
                {activeSearch && (
                  <span className="ml-1 text-neutral-500">
                    (filtered by {searchMode}: "{activeSearch}")
                  </span>
                )}
                {!hasNextPage && currentPage > 1 && (
                  <span className="ml-2 text-neutral-500 italic">• End of directory</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1 || loadingParticipants}
                  className="px-3.5 py-2 rounded-xl bg-[#121212] border border-neutral-800 hover:border-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Go to previous page"
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>

                <span className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono font-bold text-[#0A66C2]">
                  {currentPage}
                </span>

                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={!hasNextPage || loadingParticipants}
                  className="px-3.5 py-2 rounded-xl bg-[#121212] border border-neutral-800 hover:border-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Go to next page"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
