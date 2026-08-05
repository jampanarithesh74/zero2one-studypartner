import { useState, useEffect, MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { QRCodeCanvas } from "qrcode.react";
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Sparkles, 
  Globe, 
  ArrowLeft, 
  Search, 
  CheckCircle, 
  Download, 
  Copy, 
  Check, 
  QrCode, 
  X, 
  Plus, 
  ExternalLink 
} from "lucide-react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { EventItem } from "../PublicEventPage";
import { EventsModule } from "../EventsModule";

interface EventsListingPageProps {
  currentUserEmail?: string | null;
  currentUserId?: string | null;
}

export function EventsListingPage({ currentUserEmail, currentUserId }: EventsListingPageProps) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewingQrEvent, setViewingQrEvent] = useState<EventItem | null>(null);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);

  // Subscribe to public events collection from Firestore
  useEffect(() => {
    setLoading(true);
    const eventsRef = collection(db, "events");
    const q = query(eventsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: EventItem[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as EventItem);
        });
        setEvents(list);
        setLoading(false);
      },
      (error) => {
        console.warn("Ordered events fetch fallback:", error);
        const fallbackUnsub = onSnapshot(
          collection(db, "events"),
          (snapshot) => {
            const list: EventItem[] = [];
            snapshot.forEach((doc) => {
              list.push({ id: doc.id, ...doc.data() } as EventItem);
            });
            setEvents(list);
            setLoading(false);
          }
        );
        return () => fallbackUnsub();
      }
    );

    return () => unsubscribe();
  }, []);

  const formatDateTime = (isoStr: string) => {
    if (!isoStr) return "TBD";
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return isoStr;
      return date.toLocaleString("en-US", {
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

  const handleCopyLink = (eventId: string, e: MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/events/${eventId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(eventId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadQR = (elementId: string, eventTitle: string) => {
    const canvas = document.getElementById(elementId) as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      const cleanTitle = (eventTitle || "event").toLowerCase().replace(/[^a-z0-9]/gi, "_");
      downloadLink.download = `${cleanTitle}_qr.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      ev.title?.toLowerCase().includes(q) ||
      ev.venue?.toLowerCase().includes(q) ||
      ev.description?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (statusVal: string) => {
    switch (statusVal) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active Now
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-neutral-800 border border-neutral-700 text-neutral-400">
            <CheckCircle size={10} />
            Completed
          </span>
        );
      case "upcoming":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/15 border border-orange-500/30 text-orange-400">
            <Clock size={10} />
            Published
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500 selection:text-white pb-20 pt-4 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Bar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-neutral-900/90 border border-neutral-800 backdrop-blur-md shadow-xl">
          <div className="space-y-1 text-left">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-white transition-colors mb-1 cursor-pointer"
            >
              <ArrowLeft size={14} className="text-orange-500" />
              <span>Return Home</span>
            </button>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Sparkles className="text-orange-500 shrink-0" size={22} />
              <span>Campus Events Directory</span>
            </h1>
            <p className="text-xs text-neutral-400 font-medium leading-relaxed">
              Discover and join live hackathons, workshops, guest lectures, and networking events.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setShowAdminModal(true)}
              className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-orange-500/20 active:scale-95 cursor-pointer flex items-center gap-1.5 border border-orange-400/40"
            >
              <Plus size={14} />
              <span>Manage Events</span>
            </button>
          </div>
        </header>

        {/* Search Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-3.5 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events by title, location, or track..."
            className="w-full pl-11 pr-10 py-3 text-xs md:text-sm bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700 focus:border-orange-500 rounded-2xl outline-none text-white font-medium transition-all placeholder:text-neutral-500 shadow-md"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-3.5 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-20 text-center space-y-3 text-neutral-400 animate-pulse">
            <Sparkles size={32} className="text-orange-500 animate-spin mx-auto" />
            <p className="text-xs font-mono font-bold uppercase tracking-wider">Loading Events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          /* Empty State */
          <div className="p-12 rounded-3xl border-2 border-dashed border-neutral-800 bg-neutral-900/40 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center mx-auto">
              <Calendar size={28} />
            </div>
            <h3 className="text-base font-black text-white">No events found</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              {searchQuery ? "No events matched your search query." : "There are no campus events scheduled currently."}
            </p>
          </div>
        ) : (
          /* Event Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
            {filteredEvents.map((event) => (
              <motion.div
                key={event.id}
                whileHover={{ y: -3 }}
                onClick={() => navigate(`/events/${event.id}`)}
                className="rounded-3xl bg-neutral-900 border border-neutral-800 overflow-hidden hover:border-neutral-700 transition-all duration-300 flex flex-col justify-between shadow-xl cursor-pointer group"
              >
                {/* Banner */}
                <div className="relative aspect-[16/9] bg-neutral-950 overflow-hidden border-b border-neutral-800">
                  {event.banner ? (
                    <img
                      src={event.banner}
                      alt={event.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-neutral-900 to-black text-neutral-600">
                      <Calendar size={36} className="text-orange-500/40" />
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-500">
                        ZERO2ONE EVENT
                      </span>
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex justify-between items-center gap-2 pointer-events-none">
                    {getStatusBadge(event.status)}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/80 backdrop-blur-md border border-white/10 text-white shadow-sm">
                      <Globe size={10} className="text-orange-400" /> Public
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h3 className="text-base font-black text-white tracking-tight leading-snug group-hover:text-orange-400 transition-colors line-clamp-2">
                      {event.title}
                    </h3>
                    <p className="text-xs text-neutral-400 font-normal leading-relaxed line-clamp-2">
                      {event.description}
                    </p>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-neutral-800/80 text-xs text-neutral-300">
                    <div className="flex items-center gap-2 text-neutral-300">
                      <Clock size={13} className="text-orange-500 shrink-0" />
                      <span className="truncate text-[11px] font-medium">
                        {formatDateTime(event.startDate)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-neutral-300">
                      <MapPin size={13} className="text-orange-500 shrink-0" />
                      <span className="truncate text-[11px] font-semibold text-neutral-200">
                        {event.venue}
                      </span>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingQrEvent(event);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-all border border-neutral-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <QrCode size={12} className="text-orange-400" />
                      <span>QR Code</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleCopyLink(event.id, e)}
                        className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-all border border-neutral-700 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === event.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>{copiedId === event.id ? "Copied" : "Share"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(`/events/${event.id}`)}
                        className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-black text-xs transition-all flex items-center gap-1 shadow-md cursor-pointer"
                      >
                        <span>View Event</span>
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {viewingQrEvent && (
          <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingQrEvent(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-[#121212] rounded-3xl border border-neutral-800 p-6 shadow-2xl text-center space-y-4 text-white z-10"
            >
              <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 font-mono">
                  EVENT QR CODE
                </span>
                <button
                  type="button"
                  onClick={() => setViewingQrEvent(null)}
                  className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-1 text-left">
                <h4 className="text-sm font-black text-white">{viewingQrEvent.title}</h4>
                <p className="text-[11px] text-neutral-400">{viewingQrEvent.venue}</p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-neutral-200 flex flex-col items-center justify-center gap-2 shadow-xl mx-auto w-fit">
                <QRCodeCanvas
                  id={`listing-event-qr-${viewingQrEvent.id}`}
                  value={`${window.location.origin}/events/${viewingQrEvent.id}`}
                  size={180}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleDownloadQR(`listing-event-qr-${viewingQrEvent.id}`, viewingQrEvent.title)}
                  className="py-2.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Download size={13} /> Download
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigate(`/events/${viewingQrEvent.id}`);
                    setViewingQrEvent(null);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 border border-neutral-700 cursor-pointer"
                >
                  <ExternalLink size={13} />
                  <span>Open Page</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Events Management Modal */}
      <AnimatePresence>
        {showAdminModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdminModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-4xl bg-[#121212] rounded-[28px] border border-neutral-800 p-6 md:p-8 shadow-2xl text-white max-h-[90vh] overflow-y-auto z-10"
            >
              <div className="flex justify-between items-center pb-4 border-b border-neutral-800 mb-4">
                <h2 className="text-lg font-black text-white">Manage Events Panel</h2>
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <EventsModule currentUserEmail={currentUserEmail} currentUserId={currentUserId} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
