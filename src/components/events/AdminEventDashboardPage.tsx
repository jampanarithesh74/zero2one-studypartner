import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, collection, onSnapshot, getCountFromServer } from "firebase/firestore";
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
  const [totalParticipants, setTotalParticipants] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // UI Modals & Navigation
  const [isAskModalOpen, setIsAskModalOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"controls" | "chat">("controls");

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

  // Real-time Event metadata listener (single document read)
  useEffect(() => {
    if (!eventId || !isAdmin) return;

    setLoading(true);
    const eventRef = doc(db, "events", eventId);

    const unsubEvent = onSnapshot(
      eventRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as EventItem;
          setEvent({ id: docSnap.id, ...data });
          if (data.participantCount !== undefined) {
            setTotalParticipants(data.participantCount);
          }
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

  // Fetch initial aggregate count without reading individual participant documents
  useEffect(() => {
    if (!eventId || !isAdmin) return;

    let isMounted = true;

    async function fetchAggregateCount() {
      try {
        const participantsCol = collection(db, "events", eventId, "participants");
        const countSnap = await getCountFromServer(participantsCol);
        if (isMounted) {
          const count = countSnap.data().count;
          setTotalParticipants((prev) => (event?.participantCount !== undefined ? event.participantCount : count));
        }
      } catch (err) {
        console.warn("Aggregate participant count warning:", err);
      }
    }

    fetchAggregateCount();

    return () => {
      isMounted = false;
    };
  }, [eventId, isAdmin, event?.participantCount]);

  // Handle Copy Share Link
  const handleCopyLink = () => {
    if (!eventId) return;
    const link = `${window.location.origin}/events/${eventId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const participantCount = event?.participantCount ?? totalParticipants;

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
              <span className="text-orange-400 font-bold flex items-center gap-1">
                <Users size={12} className="text-orange-400" />
                {participantCount} Active {participantCount === 1 ? "Participant" : "Participants"}
              </span>
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

      {/* Main Admin Content Container - Two Panels (No Unnecessary Participant List Listener) */}
      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-hidden flex flex-col">
        {/* Desktop 2-Column Grid: Stage / Activity Controls (65%) + Live Chat (35%) */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-5 flex-1 h-[calc(100vh-120px)]">
          {/* Main Stage & Activity Controls Panel (col-span-8) */}
          <div className="lg:col-span-8 h-full">
            <AdminLiveControlsPanel
              event={event}
              onOpenAskModal={() => setIsAskModalOpen(true)}
              onNavigateLiveWall={() => navigate(`/events/${event.id}/live-wall`)}
              participantCount={participantCount}
            />
          </div>

          {/* Right Panel: Chat Panel (col-span-4) */}
          <div className="lg:col-span-4 h-full">
            <ChatPanel event={event} />
          </div>
        </div>

        {/* Mobile View with Controls / Chat Tab Switcher */}
        <div className="lg:hidden flex flex-col flex-1 h-full space-y-3">
          {/* Mobile Tab Selectors */}
          <div className="flex items-center p-1 bg-neutral-900 rounded-xl border border-neutral-800 shrink-0">
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
            {activeTab === "controls" && (
              <AdminLiveControlsPanel
                event={event}
                onOpenAskModal={() => setIsAskModalOpen(true)}
                onNavigateLiveWall={() => navigate(`/events/${event.id}/live-wall`)}
                participantCount={participantCount}
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
