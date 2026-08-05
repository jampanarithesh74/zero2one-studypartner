import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { db } from "../../lib/firebase";
import { EventItem } from "../PublicEventPage";
import { Participant } from "../ParticipantOnboarding";
import { EventRoom } from "../EventRoom";

interface EventRoomPageProps {
  currentUserEmail?: string | null;
  currentUserId?: string | null;
}

export function EventRoomPage({ currentUserEmail, currentUserId }: EventRoomPageProps) {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<(Participant & { id: string }) | null>(null);
  const [checkingSession, setCheckingSession] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!eventId) return;

    let isMounted = true;

    async function verifySessionAndLoadEvent() {
      setCheckingSession(true);
      setErrorMsg("");

      // 1. Read participant session from localStorage
      let storedParticipant: (Participant & { id: string }) | null = null;
      try {
        const raw = localStorage.getItem(`z2o_participant_${eventId}`);
        if (raw) {
          storedParticipant = JSON.parse(raw);
        }
      } catch (e) {
        console.warn("Failed reading stored participant session:", e);
      }

      if (!storedParticipant || !storedParticipant.id) {
        console.warn("[EventRoomPage] No participant session found in localStorage. Redirecting to join.");
        if (isMounted) {
          navigate(`/events/${eventId}/join`, { replace: true });
        }
        return;
      }

      // 2. Fetch event metadata & verify participant document in Firestore
      try {
        const [eventSnap, participantSnap] = await Promise.all([
          getDoc(doc(db, "events", eventId)),
          getDoc(doc(db, "events", eventId, "participants", storedParticipant.id)),
        ]);

        if (!eventSnap.exists()) {
          console.error("[EventRoomPage] Event metadata not found in Firestore.");
          if (isMounted) {
            setErrorMsg("Event not found.");
            setCheckingSession(false);
          }
          return;
        }

        if (!participantSnap.exists()) {
          console.warn("[EventRoomPage] Participant record no longer exists in Firestore. Redirecting to join.");
          localStorage.removeItem(`z2o_participant_${eventId}`);
          if (isMounted) {
            navigate(`/events/${eventId}/join`, { replace: true });
          }
          return;
        }

        if (isMounted) {
          setEvent({ id: eventSnap.id, ...eventSnap.data() } as EventItem);
          const freshParticipantData = {
            id: participantSnap.id,
            ...participantSnap.data(),
          } as Participant & { id: string };

          setCurrentParticipant(freshParticipantData);

          // Refresh local storage with latest Firestore data
          try {
            localStorage.setItem(`z2o_participant_${eventId}`, JSON.stringify(freshParticipantData));
          } catch (e) {
            console.warn("Could not sync updated participant to localStorage:", e);
          }

          setCheckingSession(false);
        }
      } catch (err: any) {
        console.error("Error verifying room session:", err);
        if (isMounted) {
          setErrorMsg("Failed to restore room session.");
          setCheckingSession(false);
        }
      }
    }

    verifySessionAndLoadEvent();

    return () => {
      isMounted = false;
    };
  }, [eventId, navigate]);

  // Loading Screen: Required text "Checking your event session..."
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 space-y-4 font-sans selection:bg-orange-500 selection:text-white">
        <Loader2 size={36} className="text-orange-500 animate-spin" />
        <div className="space-y-1 text-center">
          <p className="text-sm font-mono font-bold tracking-wider text-neutral-200">
            Checking your event session...
          </p>
          <p className="text-xs text-neutral-500 font-medium">
            Verifying networking room authentication with Firestore
          </p>
        </div>
      </div>
    );
  }

  // Error State
  if (errorMsg || !event || !currentParticipant) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 space-y-5 text-center font-sans">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
          <AlertCircle size={28} />
        </div>
        <div className="space-y-1 max-w-sm">
          <h2 className="text-lg font-black text-white">Session Restoration Issue</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {errorMsg || "Could not verify your room session."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/events/${eventId}/join`)}
          className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg"
        >
          <ArrowLeft size={14} />
          <span>Return to Event Join</span>
        </button>
      </div>
    );
  }

  return (
    <EventRoom
      event={event}
      currentParticipant={currentParticipant}
      onBackToEvent={() => navigate(`/events/${eventId}`)}
      onNavigateHome={() => navigate("/")}
    />
  );
}
