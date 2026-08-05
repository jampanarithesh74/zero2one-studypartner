import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { 
  Linkedin, 
  ExternalLink, 
  ArrowLeft, 
  Building, 
  GraduationCap, 
  Sparkles, 
  Tag, 
  Loader2, 
  AlertCircle, 
  CheckCircle 
} from "lucide-react";
import { db } from "../../lib/firebase";
import { Participant, getLinkedinProfileUrl } from "../ParticipantOnboarding";
import { EventItem } from "../PublicEventPage";

export function ParticipantProfilePage() {
  const { eventId, participantId } = useParams<{ eventId: string; participantId: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [participant, setParticipant] = useState<(Participant & { id: string }) | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!eventId || !participantId) return;

    let isMounted = true;

    async function fetchParticipantProfile() {
      setLoading(true);
      setErrorMsg("");

      try {
        const [eventSnap, participantSnap] = await Promise.all([
          getDoc(doc(db, "events", eventId)),
          getDoc(doc(db, "events", eventId, "participants", participantId)),
        ]);

        if (!eventSnap.exists()) {
          if (isMounted) setErrorMsg("Event not found.");
          setLoading(false);
          return;
        }

        if (!participantSnap.exists()) {
          if (isMounted) setErrorMsg("Participant profile not found.");
          setLoading(false);
          return;
        }

        if (isMounted) {
          setEvent({ id: eventSnap.id, ...eventSnap.data() } as EventItem);
          setParticipant({ id: participantSnap.id, ...participantSnap.data() } as Participant & { id: string });
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Error fetching participant profile:", err);
        if (isMounted) {
          setErrorMsg("Could not load participant details.");
          setLoading(false);
        }
      }
    }

    fetchParticipantProfile();

    return () => {
      isMounted = false;
    };
  }, [eventId, participantId]);

  const handleConnectClick = () => {
    if (!participant) return;
    const url = getLinkedinProfileUrl(participant);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 space-y-4">
        <Loader2 size={36} className="text-orange-500 animate-spin" />
        <p className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
          Loading Participant Profile...
        </p>
      </div>
    );
  }

  if (errorMsg || !participant) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 space-y-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
          <AlertCircle size={28} />
        </div>
        <h2 className="text-lg font-black text-white">{errorMsg || "Profile Not Found"}</h2>
        <button
          type="button"
          onClick={() => navigate(`/events/${eventId}/room`)}
          className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg"
        >
          <ArrowLeft size={14} /> Back to Networking Room
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500 selection:text-white pb-20 pt-6 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        
        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate(`/events/${eventId}/room`)}
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} className="text-orange-500" />
          <span>Back to Networking Room</span>
        </button>

        {/* Profile Card */}
        <div className="p-6 md:p-8 rounded-3xl bg-[#121212] border border-neutral-800 shadow-2xl text-left space-y-6 relative overflow-hidden">
          
          {/* Avatar & Basic Info */}
          <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b border-neutral-800">
            <div className="relative">
              <img
                src={participant.photo || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(participant.name)}`}
                alt={participant.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-neutral-800 shadow-xl"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(participant.name)}`;
                }}
              />
              <span
                className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#121212]"
                title="Active"
              />
            </div>

            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <CheckCircle size={10} /> Verified Attendee
              </span>
              <h1 className="text-2xl font-black text-white tracking-tight">{participant.name}</h1>
              <p className="text-xs text-neutral-400 font-medium flex items-center justify-center gap-1.5">
                <Building size={13} className="text-orange-500 shrink-0" />
                <span>{participant.college}</span>
              </p>
            </div>
          </div>

          {/* Academic Meta Details */}
          <div className="space-y-3 text-xs text-neutral-200">
            {participant.department && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                <GraduationCap size={16} className="text-orange-500 shrink-0" />
                <div>
                  <span className="text-[9px] font-mono font-bold uppercase text-neutral-500 block">Department</span>
                  <span className="font-bold">{participant.department}</span>
                </div>
              </div>
            )}

            {participant.year && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                <Tag size={16} className="text-orange-500 shrink-0" />
                <div>
                  <span className="text-[9px] font-mono font-bold uppercase text-neutral-500 block">Year of Study</span>
                  <span className="font-bold">{participant.year}</span>
                </div>
              </div>
            )}

            {participant.interests && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                <Sparkles size={16} className="text-orange-500 shrink-0" />
                <div>
                  <span className="text-[9px] font-mono font-bold uppercase text-neutral-500 block">Interests &amp; Skills</span>
                  <span className="font-bold">{participant.interests}</span>
                </div>
              </div>
            )}
          </div>

          {/* Connect Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleConnectClick}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#0A66C2] hover:bg-[#084e96] active:scale-[0.99] text-white font-black text-xs uppercase tracking-wider transition-all shadow-xl shadow-[#0A66C2]/20 cursor-pointer flex items-center justify-center gap-2 border border-blue-400/30"
            >
              <Linkedin size={18} />
              <span>Connect on LinkedIn</span>
              <ExternalLink size={14} className="opacity-80" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
