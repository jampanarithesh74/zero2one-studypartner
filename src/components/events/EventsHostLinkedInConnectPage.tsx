import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  doc,
  updateDoc,
  collection,
  onSnapshot,
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
  Lock,
  Unlock,
  Radio,
  Share2,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  X,
} from "lucide-react";
import { auth, db, ALLOWED_ADMIN_EMAILS } from "../../lib/firebase";
import { EventJoinQRCode } from "./EventJoinQRCode";
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
  description?: string;
}

export function EventsHostLinkedInConnectPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  // Event State
  const [eventData, setEventData] = useState<EventMetadata | null>(null);
  const [isLoadingEvent, setIsLoadingEvent] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Host Attendee Directory & Pagination State
  const [participants, setParticipants] = useState<LinkedInConnectParticipant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);

  // Search state
  const [searchInput, setSearchInput] = useState<string>("");
  const [activeSearch, setActiveSearch] = useState<string>("");
  const [searchMode, setSearchMode] = useState<"name" | "company">("name");
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Page cursors & bounded cache for host session
  const [pageCursors, setPageCursors] = useState<
    Record<number, { firstDoc: QueryDocumentSnapshot<DocumentData> | null; lastDoc: QueryDocumentSnapshot<DocumentData> | null }>
  >({});
  const [pageDataCache, setPageDataCache] = useState<
    Record<number, LinkedInConnectParticipant[]>
  >({});

  // Room Toggle Action State
  const [isTogglingStatus, setIsTogglingStatus] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Event & verify ownership
  useEffect(() => {
    if (!eventId || isLoadingAuth) return;

    const eventDocRef = doc(db, "events", eventId);
    const unsubscribe = onSnapshot(
      eventDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setLoadError("This event could not be found.");
          setIsLoadingEvent(false);
          return;
        }

        const data = snapshot.data();
        const isSuperAdmin = currentUser?.email
          ? ALLOWED_ADMIN_EMAILS.includes(currentUser.email)
          : false;

        // Security check: verify owner or super admin
        if (currentUser && data.ownerId && data.ownerId !== currentUser.uid && !isSuperAdmin) {
          setLoadError("You do not have permission to manage this event.");
          setIsLoadingEvent(false);
          return;
        }

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
          description: data.description || "",
        });
        setIsLoadingEvent(false);
      },
      (err) => {
        console.error("Error reading event doc:", err);
        setLoadError("Failed to load event. Please check your connection.");
        setIsLoadingEvent(false);
      }
    );

    return () => unsubscribe();
  }, [eventId, currentUser, isLoadingAuth]);

  // 3. Debounce search input (400ms)
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
    setIsLoadingParticipants(true);
    setPageError(null);

    try {
      const colRef = collection(db, "events", eventId, "linkedin_participants");
      let q;

      const normalizedTerm = search.toLowerCase();

      if (normalizedTerm) {
        const field = mode === "company" ? "companyLower" : "nameLower";
        if (cursorDoc && targetPage > 1) {
          q = query(
            colRef,
            orderBy(field),
            startAt(normalizedTerm),
            endAt(normalizedTerm + "\uf8ff"),
            startAfter(cursorDoc),
            limit(PAGE_SIZE)
          );
        } else {
          q = query(
            colRef,
            orderBy(field),
            startAt(normalizedTerm),
            endAt(normalizedTerm + "\uf8ff"),
            limit(PAGE_SIZE)
          );
        }
      } else {
        if (cursorDoc && targetPage > 1) {
          q = query(
            colRef,
            orderBy("joinedAt", "desc"),
            startAfter(cursorDoc),
            limit(PAGE_SIZE)
          );
        } else {
          q = query(
            colRef,
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

      setPageCursors((prev) => ({
        ...prev,
        [targetPage]: { firstDoc, lastDoc },
      }));

      setPageDataCache((prev) => ({
        ...prev,
        [targetPage]: list,
      }));

      setParticipants(list);
      setCurrentPage(targetPage);
      setHasNextPage(docs.length === PAGE_SIZE);
    } catch (err: any) {
      console.error("Error loading attendees page:", err);
      setPageError("Failed to load attendees list. Please try again.");
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  // 5. Query page 1 on event or search change
  useEffect(() => {
    if (!eventId) return;
    setCurrentPage(1);
    setPageCursors({});
    setPageDataCache({});
    fetchDirectoryPage(1, null, activeSearch, searchMode);
  }, [eventId, activeSearch, searchMode]);

  // Page Navigation Handlers
  const handleNextPage = () => {
    if (isLoadingParticipants || !hasNextPage) return;
    const nextPage = currentPage + 1;

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
    if (isLoadingParticipants || currentPage <= 1) return;
    const prevPage = currentPage - 1;

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
    if (isLoadingParticipants) return;
    const cursor = currentPage === 1 ? null : (pageCursors[currentPage - 1]?.lastDoc || null);
    fetchDirectoryPage(currentPage, cursor, activeSearch, searchMode);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setActiveSearch("");
  };

  // Toggle Room Open / Closed
  const handleToggleRoomStatus = async () => {
    if (!eventId || !eventData || isTogglingStatus) return;
    setIsTogglingStatus(true);

    try {
      const isCurrentlyOpen =
        eventData.status === "published" && eventData.acceptingParticipants !== false;
      const newStatus = isCurrentlyOpen ? "closed" : "published";
      const newAccepting = !isCurrentlyOpen;

      const eventRef = doc(db, "events", eventId);
      await updateDoc(eventRef, {
        status: newStatus,
        acceptingParticipants: newAccepting,
      });
    } catch (err) {
      console.error("Error updating room status:", err);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Copy Code
  const handleCopyCode = async () => {
    const code = eventData?.eventCode || eventData?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.warn(e);
    }
  };

  // Copy Direct Link
  const handleCopyLink = async () => {
    const url = `${window.location.origin}/events/${eventId}/linkedin-connect`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.warn(e);
    }
  };

  const isRoomOpen =
    eventData?.status === "published" && eventData?.acceptingParticipants !== false;

  if (isLoadingAuth || isLoadingEvent) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 space-y-4 font-sans">
        <Loader2 size={36} className="text-[#0A66C2] animate-spin" />
        <p className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
          Loading Host Deck...
        </p>
      </div>
    );
  }

  if (loadError || !eventData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-[#121212] border border-neutral-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-xl font-black text-white">Access Error</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {loadError || "Could not load this event host dashboard."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/events/host/dashboard")}
            className="w-full py-3.5 px-6 rounded-2xl bg-neutral-900 hover:bg-neutral-850 text-white font-bold text-xs uppercase tracking-wider transition-all border border-neutral-800 cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#0A66C2] selection:text-white pb-24 pt-6 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Breadcrumb Header */}
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate("/events/host/dashboard")}
            className="inline-flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} className="text-[#0A66C2]" />
            <span>Host Dashboard</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-400 uppercase">
              ZERO2ONE EVENTS • HOST DECK
            </span>
          </div>
        </div>

        {/* Main Host Deck Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#121212] border border-neutral-800 shadow-2xl space-y-6 text-left">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-[#0A66C2]/15 border border-[#0A66C2]/30 text-[#0A66C2] flex items-center gap-1.5">
                  <Linkedin size={12} />
                  <span>LinkedIn Connect Room</span>
                </span>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
                    isRoomOpen
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isRoomOpen ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                    }`}
                  />
                  <span>{isRoomOpen ? "Room Open & Accepting" : "Room Closed"}</span>
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
                {eventData.title}
              </h1>

              <p className="text-xs sm:text-sm text-neutral-400 font-medium">
                Networking-only room — participants connect with each other through LinkedIn. No activities or gameplay.
              </p>
            </div>

            {/* Host Primary Action Controls */}
            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              {/* Toggle Room Status */}
              <button
                type="button"
                onClick={handleToggleRoomStatus}
                disabled={isTogglingStatus}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border ${
                  isRoomOpen
                    ? "bg-neutral-900 hover:bg-neutral-850 text-amber-400 border-amber-500/30"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20"
                }`}
              >
                {isTogglingStatus ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isRoomOpen ? (
                  <Lock size={14} />
                ) : (
                  <Unlock size={14} />
                )}
                <span>{isRoomOpen ? "Close Room" : "Open Room"}</span>
              </button>

              {/* View/Open Networking Room */}
              <button
                type="button"
                onClick={() => window.open(`/events/${eventId}/linkedin-connect`, "_blank")}
                className="px-4 py-2.5 rounded-xl bg-[#0A66C2] hover:bg-[#084e96] active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-[#0A66C2]/20 cursor-pointer flex items-center gap-2"
                title="Open networking room in new tab"
              >
                <ExternalLink size={14} />
                <span>Open Networking Room</span>
              </button>
            </div>
          </div>

          {/* Grid Layout: Left Column (Access credentials & QR Code), Right Column (Live Directory) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ----------------- LEFT: ACCESS & QR CODE ----------------- */}
            <div className="space-y-6">
              {/* Event Code Card */}
              <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-850 space-y-3">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block">
                  Event Code
                </span>
                <div className="flex items-center justify-between gap-3 bg-neutral-900/90 border border-neutral-800 p-3 rounded-xl">
                  <span className="text-xl font-mono font-black text-[#0A66C2] tracking-wider">
                    {eventData.eventCode || eventData.code}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                    title="Copy code"
                  >
                    {copiedCode ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {/* QR Code Presentation Box */}
              <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-850 space-y-4 text-center">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block">
                    Participant Scan QR Code
                  </span>
                  <p className="text-[11px] text-neutral-400">
                    Project this on screen for instant auditorium join.
                  </p>
                </div>

                <div className="flex justify-center p-3 bg-white rounded-2xl">
                  <EventJoinQRCode
                    eventCode={eventData.eventCode || eventData.code || ""}
                    eventId={eventData.id}
                    eventName={eventData.title}
                    size={180}
                    showDetails={false}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-white font-bold text-xs uppercase tracking-wider transition-all border border-neutral-800 cursor-pointer flex items-center justify-center gap-2"
                >
                  {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                  <span>{copiedLink ? "Link Copied!" : "Copy Direct Room Link"}</span>
                </button>
              </div>
            </div>

            {/* ----------------- RIGHT: REALTIME ATTENDEES DIRECTORY ----------------- */}
            <div className="lg:col-span-2 space-y-4">
              {/* Directory Header & Search */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-neutral-950 p-4 rounded-2xl border border-neutral-850">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-bold text-white">
                    <Users size={14} className="text-[#0A66C2]" />
                    <span>Page Roster</span>
                    <span className="px-2 py-0.2 rounded-full bg-[#0A66C2]/20 text-[#0A66C2] text-[10px] font-mono font-black">
                      {participants.length}
                    </span>
                  </div>

                  {/* Mode switch: Name vs Company */}
                  <div className="flex items-center p-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setSearchMode("name")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        searchMode === "company"
                          ? "bg-[#0A66C2] text-white shadow-sm"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      Company
                    </button>
                  </div>
                </div>

                {/* Debounced Search Input & Refresh */}
                <div className="flex items-center gap-2 w-full md:w-72">
                  <div className="relative flex-1">
                    {isSearching ? (
                      <Loader2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0A66C2] animate-spin" />
                    ) : (
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    )}
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder={searchMode === "name" ? "Search by name..." : "Search by company..."}
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-neutral-900 border border-neutral-800 hover:border-neutral-750 focus:border-[#0A66C2] rounded-xl outline-none text-white transition-all placeholder:text-neutral-500"
                    />
                    {searchInput && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5 rounded cursor-pointer"
                        title="Clear search"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isLoadingParticipants}
                    className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-750 disabled:opacity-40 text-neutral-300 hover:text-white transition-all cursor-pointer shrink-0"
                    title="Refresh roster"
                  >
                    <RotateCw size={13} className={isLoadingParticipants ? "animate-spin text-[#0A66C2]" : ""} />
                  </button>
                </div>
              </div>

              {/* Attendees List & Pagination */}
              {pageError ? (
                <div className="p-8 rounded-2xl bg-neutral-950/60 border border-red-900/40 text-center space-y-3">
                  <AlertCircle size={24} className="text-red-400 mx-auto" />
                  <h4 className="text-sm font-bold text-white">Error loading attendees</h4>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">{pageError}</p>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-white font-bold text-xs border border-neutral-800 cursor-pointer"
                  >
                    Try again
                  </button>
                </div>
              ) : isLoadingParticipants && currentPage === 1 ? (
                <div className="py-16 text-center space-y-2">
                  <Loader2 size={28} className="text-[#0A66C2] animate-spin mx-auto" />
                  <p className="text-xs text-neutral-400 font-mono">
                    {activeSearch ? `Searching for "${activeSearch}"...` : "Loading attendees..."}
                  </p>
                </div>
              ) : participants.length === 0 ? (
                <div className="p-12 rounded-2xl bg-neutral-950/60 border border-neutral-850 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center mx-auto text-neutral-500">
                    <Users size={22} />
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    {activeSearch ? "No participants match your search" : "No attendees joined yet"}
                  </h4>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    {activeSearch
                      ? `No participants found matching "${activeSearch}" by ${searchMode}.`
                      : "When participants join and sign in with LinkedIn, they will appear here."}
                  </p>
                  {activeSearch && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="px-3 py-1.5 rounded-xl bg-[#0A66C2] hover:bg-[#084e96] text-white font-bold text-xs cursor-pointer"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                    {participants.map((person) => (
                      <div
                        key={person.id}
                        className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-850 hover:border-neutral-750 transition-all flex items-center justify-between gap-3 text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {person.photo ? (
                            <img
                              src={person.photo}
                              alt={person.name}
                              referrerPolicy="no-referrer"
                              className="w-11 h-11 rounded-xl object-cover border border-neutral-750 shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-[#0A66C2]/20 text-[#0A66C2] flex items-center justify-center font-black text-sm border border-[#0A66C2]/30 shrink-0">
                              {person.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                              <span>{person.name}</span>
                              <span className="text-[10px] font-mono text-[#0A66C2] px-1.5 py-0.2 rounded bg-[#0A66C2]/10 border border-[#0A66C2]/20">
                                Verified
                              </span>
                            </div>

                            <div className="text-[11px] text-neutral-400 truncate">
                              {person.headline || "Student / Professional"}
                            </div>

                            {person.company && (
                              <div className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5 truncate">
                                <Building2 size={11} className="text-neutral-400 shrink-0" />
                                <span className="truncate">{person.company}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          {person.linkedinUrl ? (
                            <a
                              href={person.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-xl bg-[#0A66C2]/15 hover:bg-[#0A66C2]/25 text-[#0A66C2] border border-[#0A66C2]/30 text-xs font-bold transition-all inline-flex items-center gap-1.5"
                            >
                              <Linkedin size={13} />
                              <span className="hidden sm:inline">Profile</span>
                              <ExternalLink size={11} />
                            </a>
                          ) : (
                            <span className="text-[10px] font-mono text-neutral-600 px-2 py-1 rounded bg-neutral-900">
                              No URL
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Host Directory Pagination Bottom Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-neutral-850">
                    <div className="text-[11px] text-neutral-400 font-medium">
                      <span>Showing </span>
                      <span className="text-white font-bold font-mono">
                        {(currentPage - 1) * PAGE_SIZE + 1}–{(currentPage - 1) * PAGE_SIZE + participants.length}
                      </span>
                      <span> on Page </span>
                      <span className="text-white font-bold font-mono">{currentPage}</span>
                      {activeSearch && (
                        <span className="ml-1 text-neutral-500">
                          (by {searchMode}: "{activeSearch}")
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrevPage}
                        disabled={currentPage === 1 || isLoadingParticipants}
                        className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-750 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white transition-all flex items-center gap-1 cursor-pointer"
                        title="Previous page"
                      >
                        <ChevronLeft size={13} />
                        <span>Prev</span>
                      </button>

                      <span className="px-2.5 py-1 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono font-bold text-[#0A66C2]">
                        {currentPage}
                      </span>

                      <button
                        type="button"
                        onClick={handleNextPage}
                        disabled={!hasNextPage || isLoadingParticipants}
                        className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-750 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white transition-all flex items-center gap-1 cursor-pointer"
                        title="Next page"
                      >
                        <span>Next</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
