import { useState, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { QRCodeCanvas } from "qrcode.react";
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Plus, 
  Edit2, 
  Trash2, 
  Sparkles, 
  X, 
  Image as ImageIcon, 
  Globe, 
  Lock, 
  AlertCircle,
  ExternalLink,
  CheckCircle,
  CalendarCheck,
  Download,
  Copy,
  Check,
  QrCode
} from "lucide-react";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query, 
  orderBy 
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../lib/firebase";

export interface EventItem {
  id: string;
  title: string;
  description: string;
  venue: string;
  banner: string;
  adminNote?: string;
  startDate: string;
  endDate: string;
  status: "active" | "upcoming" | "completed";
  eventType: "public" | "internal";
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
}

interface EventsModuleProps {
  currentUserEmail?: string | null;
  currentUserId?: string | null;
  isAdmin?: boolean;
}

export function EventsModule({ currentUserEmail, currentUserId, isAdmin = false }: EventsModuleProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

  // Success screen state after creation
  const [createdSuccessEvent, setCreatedSuccessEvent] = useState<{
    id: string;
    title: string;
    venue: string;
    startDate: string;
    endDate: string;
    status: string;
  } | null>(null);

  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [viewingQrEvent, setViewingQrEvent] = useState<EventItem | null>(null);
  
  // Form state
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [venue, setVenue] = useState<string>("");
  const [eventType, setEventType] = useState<"public" | "internal">("public");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [bannerUrl, setBannerUrl] = useState<string>("");
  const [bannerSource, setBannerSource] = useState<"url" | "upload">("url");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [adminNote, setAdminNote] = useState<string>("");
  const [status, setStatus] = useState<"active" | "upcoming" | "completed">("upcoming");

  // Status & Progress state
  const [saving, setSaving] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Subscribe to real-time events collection from Firestore
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
        console.error("Error fetching events:", error);
        // Fallback without query order if index missing
        const fallbackUnsub = onSnapshot(
          collection(db, "events"),
          (snapshot) => {
            const list: EventItem[] = [];
            snapshot.forEach((doc) => {
              list.push({ id: doc.id, ...doc.data() } as EventItem);
            });
            setEvents(list);
            setLoading(false);
          },
          (err) => {
            console.error("Fallback events fetch error:", err);
            setLoading(false);
          }
        );
        return () => fallbackUnsub();
      }
    );

    return () => unsubscribe();
  }, []);

  const openCreateModal = () => {
    setEditingEvent(null);
    setCreatedSuccessEvent(null);
    setTitle("");
    setDescription("");
    setVenue("");
    setEventType("public");
    
    // Set default start/end dates
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowEnd = new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000);

    const toLocalISO = (d: Date) => {
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    };

    setStartDate(toLocalISO(tomorrow));
    setEndDate(toLocalISO(tomorrowEnd));
    setBannerUrl("");
    setBannerFile(null);
    setBannerSource("url");
    setAdminNote("");
    setStatus("upcoming");
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (event: EventItem) => {
    setEditingEvent(event);
    setCreatedSuccessEvent(null);
    setTitle(event.title || "");
    setDescription(event.description || "");
    setVenue(event.venue || "");
    setEventType(event.eventType || "public");
    setStartDate(event.startDate || "");
    setEndDate(event.endDate || "");
    setBannerUrl(event.banner || "");
    setBannerFile(null);
    setBannerSource("url");
    setAdminNote(event.adminNote || "");
    setStatus(event.status || "upcoming");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!isAdmin) {
      setFormError("Unauthorized: Only administrators are permitted to create, edit, or publish events.");
      return;
    }

    if (!title.trim()) {
      setFormError("Event Title is required.");
      return;
    }
    if (!description.trim()) {
      setFormError("Description is required.");
      return;
    }
    if (!venue.trim()) {
      setFormError("Venue is required.");
      return;
    }
    if (!startDate) {
      setFormError("Start Date & Time is required.");
      return;
    }
    if (!endDate) {
      setFormError("End Date & Time is required.");
      return;
    }

    setSaving(true);
    setUploadProgress(null);

    try {
      let finalBannerUrl = bannerUrl.trim();

      // If user uploaded a banner file to Firebase Storage
      if (bannerSource === "upload" && bannerFile) {
        const fileRef = ref(storage, `events/banners/${Date.now()}_${bannerFile.name}`);
        const uploadTask = uploadBytesResumable(fileRef, bannerFile);

        finalBannerUrl = await new Promise<string>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setUploadProgress(progress);
            },
            (error) => {
              console.error("Banner upload failed:", error);
              reject(error);
            },
            async () => {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadUrl);
            }
          );
        });
      }

      // Automatically infer or validate status if not manually overridden
      let computedStatus = status;
      if (startDate && endDate) {
        const startMs = new Date(startDate).getTime();
        const endMs = new Date(endDate).getTime();
        const nowMs = Date.now();
        if (nowMs >= startMs && nowMs <= endMs) {
          computedStatus = "active";
        } else if (nowMs > endMs) {
          computedStatus = "completed";
        } else {
          computedStatus = "upcoming";
        }
      }

      const eventPayload = {
        title: title.trim(),
        description: description.trim(),
        venue: venue.trim(),
        banner: finalBannerUrl,
        adminNote: adminNote.trim(),
        startDate,
        endDate,
        status: computedStatus,
        eventType,
        createdBy: currentUserEmail || currentUserId || "Admin",
        updatedAt: serverTimestamp(),
      };

      let finalId = editingEvent?.id;

      if (editingEvent) {
        // Update existing document
        const docRef = doc(db, "events", editingEvent.id);
        await updateDoc(docRef, eventPayload);
      } else {
        // Create new document
        const newDocRef = await addDoc(collection(db, "events"), {
          ...eventPayload,
          createdAt: serverTimestamp(),
        });
        finalId = newDocRef.id;
      }

      setSaving(false);

      // Trigger Success Screen with QR Code
      setCreatedSuccessEvent({
        id: finalId!,
        title: title.trim(),
        venue: venue.trim(),
        startDate,
        endDate,
        status: computedStatus
      });

    } catch (err: any) {
      console.error("Error saving event:", err);
      setFormError(err.message || "Failed to save event. Please check permissions and try again.");
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    if (!isAdmin) {
      alert("Unauthorized: Only administrators are permitted to delete events.");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the event "${eventTitle}"? This cannot be undone.`)) {
      return;
    }

    setDeletingId(eventId);
    try {
      await deleteDoc(doc(db, "events", eventId));
      setDeletingId(null);
    } catch (err: any) {
      console.error("Error deleting event:", err);
      alert("Failed to delete event: " + err.message);
      setDeletingId(null);
    }
  };

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

  const handleCopyEventLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getStatusBadge = (statusVal: string) => {
    switch (statusVal) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active Now
          </span>
        );
      case "upcoming":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/15 border border-orange-500/30 text-orange-400">
            <Clock size={10} />
            Published
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-neutral-800 border border-neutral-700 text-neutral-400">
            <CheckCircle size={10} />
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/15 border border-orange-500/30 text-orange-400">
            Published
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 text-left font-sans text-white">
      {/* Top Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-black uppercase tracking-widest">
              ZERO2ONE EVENTS ENGINE
            </span>
            <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-400 text-[9px] font-bold font-mono">
              v1.0 Ready
            </span>
          </div>
          <h3 className="text-lg md:text-xl font-black text-white tracking-tight mt-1">
            Event Management Panel
          </h3>
          <p className="text-xs text-neutral-400 font-medium leading-relaxed">
            Create and schedule public campus events, hackathons, workshops, and guest lectures with instant QR codes.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-orange-500/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2 border border-orange-400/40 shrink-0"
        >
          <Plus size={16} /> + Create Event
        </button>
      </div>

      {/* Events List / Grid */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-neutral-400 animate-pulse">
          <Sparkles size={28} className="text-orange-500 animate-spin" />
          <p className="text-xs font-bold uppercase tracking-wider">Syncing ZERO2ONE Events...</p>
        </div>
      ) : events.length === 0 ? (
        /* Empty State Card */
        <div className="p-8 md:p-12 rounded-3xl border-2 border-dashed border-neutral-800 bg-neutral-900/40 text-center flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
            <CalendarCheck size={32} />
          </div>
          <div className="space-y-1 max-w-sm">
            <h4 className="text-base font-black text-white">No events created yet</h4>
            <p className="text-xs text-neutral-400 font-medium leading-relaxed">
              Click <strong className="text-orange-400">'+ Create Event'</strong> above to launch a new academic event or student contest.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-orange-400 hover:text-white border border-neutral-700 text-xs font-black transition-all cursor-pointer flex items-center gap-2"
          >
            <Plus size={14} /> Create First Event
          </button>
        </div>
      ) : (
        /* Grid of Event Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((event) => {
            const publicUrl = `${window.location.origin}/events/${event.id}`;
            return (
              <div
                key={event.id}
                className="rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden hover:border-neutral-700 transition-all duration-300 flex flex-col justify-between shadow-lg group relative"
              >
                {/* Event Card Header / Banner */}
                <div className="relative aspect-[16/9] bg-neutral-950 overflow-hidden border-b border-neutral-800/80">
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
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-neutral-900 to-neutral-950 text-neutral-600">
                      <Calendar size={36} className="text-orange-500/40" />
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500">
                        ZERO2ONE EVENT
                      </span>
                    </div>
                  )}

                  {/* Status and Type Badges */}
                  <div className="absolute top-3 left-3 right-3 flex justify-between items-center gap-2 pointer-events-none">
                    {getStatusBadge(event.status)}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/70 backdrop-blur-md border border-white/10 text-white shadow-sm">
                      <Globe size={10} className="text-orange-400" /> Public Event
                    </span>
                  </div>
                </div>

                {/* Event Body */}
                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h4 className="text-base font-black text-white tracking-tight leading-snug line-clamp-2">
                      {event.title}
                    </h4>

                    <p className="text-xs text-neutral-400 font-normal leading-relaxed line-clamp-3 whitespace-pre-line">
                      {event.description}
                    </p>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-neutral-800/80 text-xs text-neutral-300 font-medium">
                    {/* Date and Time */}
                    <div className="flex items-center gap-2 text-neutral-300">
                      <Clock size={13} className="text-orange-500 shrink-0" />
                      <span className="truncate text-[11px]">
                        {formatDateTime(event.startDate)}
                      </span>
                    </div>

                    {/* Venue */}
                    <div className="flex items-center gap-2 text-neutral-300">
                      <MapPin size={13} className="text-orange-500 shrink-0" />
                      <span className="truncate text-[11px] font-semibold text-neutral-200">
                        {event.venue}
                      </span>
                    </div>

                    {/* Internal Admin Note if present */}
                    {event.adminNote && (
                      <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[10px] text-orange-300 font-mono space-y-0.5">
                        <span className="font-extrabold uppercase tracking-wider block text-orange-400">
                          📌 Admin Note:
                        </span>
                        <p className="line-clamp-2 leading-relaxed">{event.adminNote}</p>
                      </div>
                    )}
                  </div>

                  {/* Admin Actions Footer */}
                  <div className="pt-3 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[9px] font-mono text-neutral-500">
                      Created by: {event.createdBy ? event.createdBy.split("@")[0] : "Admin"}
                    </span>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setViewingQrEvent(event)}
                        className="px-2.5 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 hover:text-orange-300 text-xs font-bold transition-all border border-orange-500/30 flex items-center gap-1 cursor-pointer"
                        title="View / Download QR Code"
                      >
                        <QrCode size={12} /> QR Code
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(event)}
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-bold transition-all border border-neutral-700/80 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === event.id}
                        onClick={() => handleDeleteEvent(event.id, event.title)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-bold transition-all border border-red-500/20 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick QR Viewer Modal for existing events */}
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

              {/* QR Code Container */}
              <div className="p-4 rounded-2xl bg-white border border-neutral-200 flex flex-col items-center justify-center gap-2 shadow-xl mx-auto w-fit">
                <QRCodeCanvas
                  id={`grid-event-qr-${viewingQrEvent.id}`}
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
                  onClick={() => handleDownloadQR(`grid-event-qr-${viewingQrEvent.id}`, viewingQrEvent.title)}
                  className="py-2.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Download size={13} /> Download
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyEventLink(`${window.location.origin}/events/${viewingQrEvent.id}`)}
                  className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 border border-neutral-700 cursor-pointer"
                >
                  {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create / Edit Event Modal with SUCCESS SCREEN */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            {/* Modal Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!saving) setIsModalOpen(false);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Drawer Card */}
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ type: "spring", duration: 0.35 }}
              className="relative w-full max-w-xl bg-[#121212] rounded-[28px] border border-neutral-800 shadow-2xl p-6 md:p-8 overflow-hidden flex flex-col max-h-[90vh] text-left text-white"
            >
              {/* Header */}
              <div className="relative flex justify-between items-start pb-4 border-b border-neutral-800 select-none mb-5 shrink-0">
                <div>
                  <span className="text-[9px] font-black uppercase text-orange-500 tracking-widest block mb-0.5">
                    ZERO2ONE EVENTS ENGINE
                  </span>
                  <h3 className="text-lg md:text-xl font-black text-white tracking-tight">
                    {createdSuccessEvent
                      ? "Publication Confirmation"
                      : editingEvent
                      ? "Edit Event Configurations"
                      : "Create Public Event"}
                  </h3>
                </div>
                {!saving && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setCreatedSuccessEvent(null);
                    }}
                    className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Modal Body Switch: Success Screen vs Form */}
              {createdSuccessEvent ? (
                /* SUCCESS SCREEN */
                <div className="space-y-6 text-center py-2 flex flex-col items-center overflow-y-auto pr-1">
                  {/* Success Icon */}
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg">
                    <CheckCircle size={32} />
                  </div>

                  {/* Title */}
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-white tracking-tight flex items-center justify-center gap-2">
                      <span>✓ Event Published Successfully</span>
                    </h3>
                    <p className="text-xs text-neutral-400 font-medium">
                      Your event is now live! Anyone scanning the QR code or visiting the URL can view event details.
                    </p>
                  </div>

                  {/* Event Info Summary Box */}
                  <div className="w-full p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-left space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-extrabold text-white text-sm">
                        {createdSuccessEvent.title}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                        Published
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-neutral-300 font-medium">
                      <MapPin size={13} className="text-orange-500 shrink-0" />
                      <span className="truncate">{createdSuccessEvent.venue}</span>
                    </div>

                    <div className="flex items-center gap-2 text-neutral-300 font-medium">
                      <Clock size={13} className="text-orange-500 shrink-0" />
                      <span>{formatDateTime(createdSuccessEvent.startDate)}</span>
                    </div>
                  </div>

                  {/* Generated QR Code */}
                  <div className="p-4 rounded-2xl bg-white border border-neutral-200 flex flex-col items-center justify-center gap-2 shadow-xl mx-auto">
                    <QRCodeCanvas
                      id={`success-qr-canvas-${createdSuccessEvent.id}`}
                      value={`${window.location.origin}/events/${createdSuccessEvent.id}`}
                      size={180}
                      bgColor="#ffffff"
                      fgColor="#000000"
                      level="H"
                      includeMargin={true}
                    />
                    <span className="text-[10px] font-mono text-neutral-600 font-bold tracking-wider">
                      SCAN TO OPEN PUBLIC EVENT
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadQR(
                          `success-qr-canvas-${createdSuccessEvent.id}`,
                          createdSuccessEvent.title
                        )
                      }
                      className="w-full py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-orange-500/20 active:scale-95"
                    >
                      <Download size={15} /> Download QR
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopyEventLink(
                          `${window.location.origin}/events/${createdSuccessEvent.id}`
                        )
                      }
                      className="w-full py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-2 border border-neutral-700 cursor-pointer"
                    >
                      {copiedLink ? (
                        <Check size={15} className="text-emerald-400" />
                      ) : (
                        <Copy size={15} />
                      )}
                      <span>{copiedLink ? "Copied Link!" : "Copy Event Link"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setCreatedSuccessEvent(null);
                        window.location.href = `/events/${createdSuccessEvent.id}`;
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-2 border border-neutral-700 cursor-pointer"
                    >
                      <ExternalLink size={15} className="text-orange-400" /> View Event
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setCreatedSuccessEvent(null);
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-2 border border-neutral-800 cursor-pointer"
                    >
                      Back to Dashboard
                    </button>
                  </div>
                </div>
              ) : (
                /* FORM CONTENT */
                <form onSubmit={handleSaveEvent} className="space-y-4 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                  {formError && (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold leading-relaxed flex items-center gap-2">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* 1. Event Name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">
                      Event Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. ZERO2ONE National Hackathon 2026"
                      className="w-full px-4 py-3 text-xs md:text-sm bg-neutral-900 border border-neutral-800 hover:border-neutral-700 focus:border-orange-500 rounded-xl outline-none transition-all placeholder:text-neutral-600 text-white font-bold"
                    />
                  </div>

                  {/* 2. Description */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">
                      Description *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief outline, target engineering years, tracks, and prize breakdown..."
                      className="w-full px-4 py-3 text-xs md:text-sm bg-neutral-900 border border-neutral-800 hover:border-neutral-700 focus:border-orange-500 rounded-xl outline-none transition-all placeholder:text-neutral-600 text-white font-medium resize-none"
                    />
                  </div>

                  {/* 3. Event Type Selection */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">
                      Event Type Selection *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Public Event (Selected) */}
                      <button
                        type="button"
                        onClick={() => setEventType("public")}
                        className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          eventType === "public"
                            ? "bg-orange-500/15 border-orange-500 text-white shadow-md"
                            : "bg-neutral-900 border-neutral-800 text-neutral-400"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="text-xs font-black block flex items-center gap-1.5">
                            <Globe size={13} className="text-orange-500" />
                            Public Event
                          </span>
                          <span className="text-[9px] text-neutral-400 block">Open for all students</span>
                        </div>
                        {eventType === "public" && (
                          <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                        )}
                      </button>

                      {/* Campus Internal (Disabled / Coming Soon) */}
                      <div className="p-3.5 rounded-xl border border-neutral-800/60 bg-neutral-950/60 text-neutral-500 opacity-60 cursor-not-allowed select-none flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold block flex items-center gap-1.5">
                            <Lock size={13} className="text-neutral-500" />
                            Campus Internal
                          </span>
                          <span className="text-[9px] text-neutral-600 block">Restricted department rooms</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[8px] font-black bg-neutral-800 text-neutral-400 uppercase tracking-widest">
                          Coming Soon
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Venue */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">
                      Venue Location *
                    </label>
                    <input
                      type="text"
                      required
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      placeholder="e.g. Anurag Auditorium / Block-B Seminar Hall"
                      className="w-full px-4 py-3 text-xs md:text-sm bg-neutral-900 border border-neutral-800 hover:border-neutral-700 focus:border-orange-500 rounded-xl outline-none transition-all placeholder:text-neutral-600 text-white font-bold"
                    />
                  </div>

                  {/* 5 & 6. Start & End Date/Time */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">
                        Start Date &amp; Time *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs bg-neutral-900 border border-neutral-800 hover:border-neutral-700 focus:border-orange-500 rounded-xl outline-none transition-all text-white font-bold color-scheme-dark"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">
                        End Date &amp; Time *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs bg-neutral-900 border border-neutral-800 hover:border-neutral-700 focus:border-orange-500 rounded-xl outline-none transition-all text-white font-bold color-scheme-dark"
                      />
                    </div>
                  </div>

                  {/* 7. Banner URL or Image Upload */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">
                        Event Banner Image
                      </label>
                      <div className="flex gap-1.5 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
                        <button
                          type="button"
                          onClick={() => setBannerSource("url")}
                          className={`px-2.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${
                            bannerSource === "url"
                              ? "bg-orange-500 text-white shadow-sm"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          Image Link URL
                        </button>
                        <button
                          type="button"
                          onClick={() => setBannerSource("upload")}
                          className={`px-2.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${
                            bannerSource === "upload"
                              ? "bg-orange-500 text-white shadow-sm"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          Upload Image
                        </button>
                      </div>
                    </div>

                    {bannerSource === "url" ? (
                      <input
                        type="url"
                        value={bannerUrl}
                        onChange={(e) => setBannerUrl(e.target.value)}
                        placeholder="e.g. https://images.unsplash.com/photo-..."
                        className="w-full px-4 py-3 text-xs bg-neutral-900 border border-neutral-800 hover:border-neutral-700 focus:border-orange-500 rounded-xl outline-none transition-all placeholder:text-neutral-600 text-white font-mono"
                      />
                    ) : (
                      <div className="relative border border-dashed border-neutral-800 bg-neutral-900/60 rounded-xl p-4 text-center hover:border-orange-500/60 transition-colors cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center justify-center gap-1.5 text-neutral-400">
                          <ImageIcon size={20} className="text-orange-500" />
                          <span className="text-xs font-bold text-neutral-200">
                            {bannerFile ? bannerFile.name : "Choose Banner Image File"}
                          </span>
                          <span className="text-[9px] text-neutral-500">
                            PNG, JPG, or WEBP formats up to 5MB
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 8. Admin Note (Optional internal note for admins) */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">
                      Admin Note <span className="text-neutral-500 font-normal">(Optional internal note)</span>
                    </label>
                    <input
                      type="text"
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="e.g. Principal approval granted. Stage setup required at 9:00 AM."
                      className="w-full px-4 py-3 text-xs bg-neutral-900 border border-neutral-800 hover:border-neutral-700 focus:border-orange-500 rounded-xl outline-none transition-all placeholder:text-neutral-600 text-white font-medium"
                    />
                  </div>

                  {/* Status selector override */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">
                      Initial Display Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-4 py-2.5 text-xs bg-neutral-900 border border-neutral-800 focus:border-orange-500 rounded-xl outline-none text-white font-bold cursor-pointer"
                    >
                      <option value="upcoming">Upcoming (Scheduled)</option>
                      <option value="active">Active Now (Live)</option>
                      <option value="completed">Completed (Ended)</option>
                    </select>
                  </div>

                  {/* Upload Progress Bar */}
                  {saving && uploadProgress !== null && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between items-center text-[10px] text-neutral-400 font-bold">
                        <span>Uploading Banner Image...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Submit Buttons */}
                  <div className="pt-4 border-t border-neutral-800 flex gap-3 justify-end items-center shrink-0">
                    {!saving && (
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-5 py-2.5 rounded-xl border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2 border border-orange-400/40"
                    >
                      {saving ? (
                        <>
                          <Sparkles size={14} className="animate-spin" />
                          Saving Event...
                        </>
                      ) : (
                        <>
                          <CalendarCheck size={14} />
                          {editingEvent ? "Update Event" : "Publish Event"}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
