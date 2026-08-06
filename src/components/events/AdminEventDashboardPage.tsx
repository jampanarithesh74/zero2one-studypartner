import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, collection, onSnapshot } from "firebase/firestore";
import { 
  Loader2, 
  AlertCircle, 
  ArrowLeft, 
  Share2, 
  Check, 
  Users, 
  Radio, 
  MessageSquare, 
  ShieldCheck,
  Tv
} from "lucide-react";
import { db } from "../../lib/firebase";
import { EventItem } from "../PublicEventPage";
import { Participant } from "../ParticipantOnboarding";
import { ParticipantsPanel } from "../EventRoom/ParticipantsPanel";
import { AdminLiveControlsPanel } from "../EventRoom/AdminLiveControlsPanel";
import { ChatPanel } from "../EventRoom/ChatPanel";
import { AskQuestionModal } from "../EventRoom/AskQuestionModal";

interface AdminEventDashboardPageProps {
  currentUserEmail?: string | null;
  currentUserId?: string | null;
  isAdmin?: boolean;
}

export function AdminEventDashboardPage({
  currentUserEmail,
  currentUserId,
  isAdmin = false,
}: AdminEventDashboardPageProps) {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [participants, setParticipants] = useState<(Participant & { id: string })[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Search and filter state for Members list
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");

  // UI Modals & Navigation
  const [isAskModalOpen, setIsAskModalOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"members" | "controls" | "chat">("controls");

  // Security Check: If not an admin, redirect immediately to participant room
  useEffect(() => {
    if (!isAdmin) {
      console.warn("Non-admin user attempted to open Admin Event Dashboard. Redirecting to participant room.");
      if (eventId) {
        navigate(`/events/${eventId}/room`, { replace: true });
      } else {
        navigate("/events", { replace: true });
      }
    }
  }, [isAdmin, eventId, navigate]);

  // Real-time Event metadata listener
  useEffect(() => {
    if (!eventId || !isAdmin) return;

    setLoading(true);
    const eventRef = doc(db, "events", eventId);

    const unsubEvent = onSnapshot(
      eventRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setEvent({ id: docSnap.id, ...docSnap.data() } as EventItem);
          setErrorMsg("");
        } else {
          setErrorMsg("Event not found in Firestore.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching event for Admin Dashboard:", err);
        setErrorMsg("Failed to load event details.");
        setLoading(false);
      }
    );

    return () => unsubEvent();
  }, [eventId, isAdmin]);

  // Real-time Participants listener
  useEffect(() => {
    if (!eventId || !isAdmin) return;

    const participantsRef = collection(db, "events", eventId, "participants");

    const unsubParticipants = onSnapshot(
      participantsRef,
      (snapshot) => {
        const list: (Participant & { id: string })[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Participant & { id: string });
        });
        setParticipants(list);
      },
      (err) => {
        console.error("Error listening to event participants:", err);
      }
    );

    return () => unsubParticipants();
  }, [eventId, isAdmin]);

  // Handle Copy Share Link
  const handleCopyLink = () => {
    if (!eventId) return;
    const link = `${window.location.origin}/events/${eventId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Filtered participants list logic
  const availableDepts: string[] = [
    "ALL",
    ...Array.from(new Set<string>(participants.map((p) => p.department).filter((d): d is string => Boolean(d)))),
  ];

  const filteredParticipants = participants.filter((p) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      p.name?.toLowerCase().includes(query) ||
      p.college?.toLowerCase().includes(query) ||
      p.department?.toLowerCase().includes(query) ||
      p.year?.toLowerCase().includes(query);

    const matchesDept = selectedDept === "ALL" || p.department === selectedDept;

    return matchesSearch && matchesDept;
  });

  if (!isAdmin) {
    return null; // Redirecting in useEffect
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 font-sans">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 size={32} className="text-orange-500 animate-spin" />
          <p className="text-xs font-mono text-neutral-400">Opening Admin Event Dashboard...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !event) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-[#121212] border border-neutral-800 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <AlertCircle size={36} className="text-red-400 mx-auto" />
          <h2 className="text-base font-black text-white">{errorMsg || "Event Not Found"}</h2>
          <button
            type="button"
            onClick={() => navigate("/events/manage")}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-extrabold transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <ArrowLeft size={14} /> Back to Events Console
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Dashboard Top Header */}
      <header className="p-3.5 sm:p-4 border-b border-neutral-800 bg-[#121212] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 shadow-lg">
        {/* Left Title & Room Info */}
        <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => navigate("/events/manage")}
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all border border-neutral-800 cursor-pointer shrink-0"
            title="Back to Admin Console"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-black text-white truncate tracking-tight">
                {event.title}
              </h1>

              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/40 flex items-center gap-1">
                <ShieldCheck size={11} />
                ADMIN DASHBOARD
              </span>

              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-neutral-800 text-neutral-300 border border-neutral-700">
                {event.roomType === "normal" ? "Standard Room" : "LinkedIn Sync"}
              </span>
            </div>

            <p className="text-[11px] font-mono text-neutral-400 truncate mt-0.5 flex items-center gap-2">
              <span>{event.college || "Campus Event"}</span>
              <span>•</span>
              <span className="text-orange-400 font-bold">{participants.length} Active Members</span>
            </p>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => navigate(`/events/${event.id}/live-wall`)}
            className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            title="Open Stage Projector View"
          >
            <Tv size={14} className="text-purple-400" />
            <span className="hidden sm:inline">Projector Live Wall</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-extrabold transition-all border border-neutral-800 cursor-pointer flex items-center gap-1.5"
            title="Copy Public Event Link"
          >
            {copiedLink ? (
              <>
                <Check size={13} className="text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Share2 size={13} />
                <span>Share Link</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Admin Three-Panel Container */}
      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-hidden flex flex-col">
        {/* Desktop 3-Column Grid */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-4 flex-1 h-[calc(100vh-120px)]">
          {/* Left Panel: Real-time Members List (25% = col-span-3) */}
          <div className="lg:col-span-3 h-full">
            <ParticipantsPanel
              event={event}
              participants={participants}
              filteredParticipants={filteredParticipants}
              currentParticipant={null}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedDept={selectedDept}
              setSelectedDept={setSelectedDept}
              availableDepts={availableDepts}
              showConnect={false}
              title="Members"
            />
          </div>

          {/* Center Panel: Live Room Controls (50% = col-span-6) */}
          <div className="lg:col-span-6 h-full">
            <AdminLiveControlsPanel
              event={event}
              onOpenAskModal={() => setIsAskModalOpen(true)}
              onNavigateLiveWall={() => navigate(`/events/${event.id}/live-wall`)}
              participantCount={participants.length}
            />
          </div>

          {/* Right Panel: Chat Panel Placeholder (25% = col-span-3) */}
          <div className="lg:col-span-3 h-full">
            <ChatPanel event={event} />
          </div>
        </div>

        {/* Mobile View with Bottom/Top Tab Switcher */}
        <div className="lg:hidden flex flex-col flex-1 h-full space-y-3">
          {/* Mobile Tab Selectors */}
          <div className="flex items-center p-1 bg-neutral-900 rounded-xl border border-neutral-800 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("members")}
              className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "members"
                  ? "bg-orange-500 text-white shadow-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Users size={14} />
              <span>Members ({participants.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("controls")}
              className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "controls"
                  ? "bg-orange-500 text-white shadow-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Radio size={14} />
              <span>Controls</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "chat"
                  ? "bg-orange-500 text-white shadow-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <MessageSquare size={14} />
              <span>Chat</span>
            </button>
          </div>

          {/* Mobile Tab Active Panel */}
          <div className="flex-1 min-h-[500px]">
            {activeTab === "members" && (
              <ParticipantsPanel
                event={event}
                participants={participants}
                filteredParticipants={filteredParticipants}
                currentParticipant={null}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                selectedDept={selectedDept}
                setSelectedDept={setSelectedDept}
                availableDepts={availableDepts}
                showConnect={false}
                title="Members"
              />
            )}

            {activeTab === "controls" && (
              <AdminLiveControlsPanel
                event={event}
                onOpenAskModal={() => setIsAskModalOpen(true)}
                onNavigateLiveWall={() => navigate(`/events/${event.id}/live-wall`)}
                participantCount={participants.length}
              />
            )}

            {activeTab === "chat" && <ChatPanel event={event} />}
          </div>
        </div>
      </main>

      {/* Admin Publish Ask Question Modal */}
      <AskQuestionModal
        isOpen={isAskModalOpen}
        onClose={() => setIsAskModalOpen(false)}
        eventId={event.id}
        currentUserEmail={currentUserEmail}
      />
    </div>
  );
}
