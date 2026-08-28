import { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import { 
  X, 
  Camera, 
  AlertCircle, 
  RefreshCw, 
  FlipHorizontal, 
  Flashlight, 
  KeyRound,
  Loader2,
  ScanLine
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface EventQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCodeDetected: (code: string) => void;
  onManualEntryClick: () => void;
}

export function EventQRScannerModal({
  isOpen,
  onClose,
  onCodeDetected,
  onManualEntryClick,
}: EventQRScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<"initializing" | "scanning" | "denied" | "unsupported" | "error">("initializing");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [scanFeedback, setScanFeedback] = useState<string>("");

  // Helper function to stop all active video tracks and cancel animation frame
  const stopCamera = () => {
    if (animationFrameId.current !== null) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn("Error stopping video track:", e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Helper to extract canonical event code from scanned text / URL
  const parseQRContent = (decodedText: string): { isValid: boolean; code?: string; error?: string } => {
    if (!decodedText || typeof decodedText !== "string") {
      return { isValid: false, error: "Empty QR code detected." };
    }

    const trimmed = decodedText.trim();

    // 1. Try parsing as a URL
    try {
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
        // Construct standard URL object
        const parsedUrl = new URL(trimmed, window.location.origin);
        
        // Check for query parameters (?code=... or ?eventCode=...)
        const codeParam = parsedUrl.searchParams.get("code") || parsedUrl.searchParams.get("eventCode");
        if (codeParam && codeParam.trim()) {
          return { isValid: true, code: codeParam.trim() };
        }

        // Check if path contains /events/:eventId
        const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
        const eventsIdx = pathSegments.indexOf("events");
        if (eventsIdx !== -1 && pathSegments.length > eventsIdx + 1) {
          const nextSegment = pathSegments[eventsIdx + 1];
          // Ensure it's not a generic subroute like 'join', 'host', 'list'
          if (!["join", "host", "list"].includes(nextSegment.toLowerCase())) {
            return { isValid: true, code: nextSegment.trim() };
          }
        }

        // It is a URL but not a recognized ZERO2ONE event URL
        return { 
          isValid: false, 
          error: "This QR code isn't a valid ZERO2ONE event." 
        };
      }
    } catch {
      // Not a valid URL, proceed to check as raw code
    }

    // 2. Check if the content is a raw alphanumeric event code (e.g. "Z2O-101", "EVENT2026", "A1B2C3")
    // Rejects very long sentences, binary payloads, or strings containing invalid symbols
    const cleanRaw = trimmed.replace(/\s+/g, "");
    const isAlphanumericCode = /^[a-zA-Z0-9_-]{3,32}$/.test(cleanRaw);

    if (isAlphanumericCode) {
      return { isValid: true, code: cleanRaw };
    }

    return { 
      isValid: false, 
      error: "This QR code isn't a valid ZERO2ONE event." 
    };
  };

  // Start Camera Stream
  const startCamera = async () => {
    stopCamera();
    setCameraState("initializing");
    setErrorMessage("");
    setScanFeedback("");

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraState("unsupported");
      setErrorMessage("Camera scanning isn't available on this browser/device.");
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Check if torch/flashlight is supported
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities?.() || {}) as any;
        setHasTorch(Boolean(capabilities.torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true"); // Critical for iOS Safari
        videoRef.current.muted = true;
        await videoRef.current.play();
        setCameraState("scanning");
        startScanningLoop();
      }
    } catch (err: any) {
      console.warn("Camera access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraState("denied");
        setErrorMessage("Camera access was denied. You can enter the event code manually instead.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraState("unsupported");
        setErrorMessage("No camera was found on your device.");
      } else {
        setCameraState("error");
        setErrorMessage("Unable to open camera stream. Please enter the code manually.");
      }
    }
  };

  // Scanning frame analysis loop using jsQR
  const startScanningLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const tick = () => {
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animationFrameId.current = requestAnimationFrame(tick);
        return;
      }

      // Match canvas dimensions to current video frame
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Analyze frame for QR code using jsQR
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (qrCode && qrCode.data) {
        const parsed = parseQRContent(qrCode.data);

        if (parsed.isValid && parsed.code) {
          // Success: Stop camera immediately and pass code to parent
          stopCamera();
          onCodeDetected(parsed.code);
          return;
        } else {
          // Scanned an unrelated QR: show inline notice without querying database
          setScanFeedback(parsed.error || "This QR code isn't a valid ZERO2ONE event.");
          // Clear feedback after 3.5s so user can re-align
          setTimeout(() => setScanFeedback(""), 3500);
        }
      }

      animationFrameId.current = requestAnimationFrame(tick);
    };

    animationFrameId.current = requestAnimationFrame(tick);
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextTorch = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextTorch }],
        });
        setTorchOn(nextTorch);
      } catch (e) {
        console.warn("Failed to toggle torch:", e);
      }
    }
  };

  // Toggle Facing Mode (Front / Back Camera)
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Trigger camera start / cleanup on open & facingMode change
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-label="Scan Event QR Code"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md bg-[#0e0e12] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-850 bg-[#09090c]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
                <Camera size={14} />
              </div>
              <span className="text-sm font-black uppercase tracking-tight text-white">
                Scan Event QR Code
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              aria-label="Close QR Scanner"
            >
              <X size={18} />
            </button>
          </div>

          {/* Camera Viewport Area */}
          <div className="relative w-full aspect-square bg-black overflow-hidden flex items-center justify-center">
            {/* Hidden canvas used for reading raw pixel buffer */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Video element streaming camera feed */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${cameraState !== "scanning" ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
              autoPlay
              playsInline
              muted
            />

            {/* Scanning Target Overlay */}
            {cameraState === "scanning" && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                {/* Viewport Frame */}
                <div className="relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-orange-500/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                  {/* Corner Accents */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-orange-500 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-orange-500 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-orange-500 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-orange-500 rounded-br-lg" />

                  {/* Animated Laser Scanning Line */}
                  <motion.div
                    animate={{ y: [0, 210, 0] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                    className="w-full h-0.5 bg-gradient-to-r from-transparent via-orange-400 to-transparent shadow-[0_0_8px_#f97316]"
                  />
                </div>
              </div>
            )}

            {/* State Overlay: Initializing */}
            {cameraState === "initializing" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-[#0e0e12] text-center space-y-3">
                <Loader2 size={32} className="text-orange-500 animate-spin" />
                <p className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  Requesting Camera Access...
                </p>
                <p className="text-[11px] text-neutral-500 max-w-xs">
                  Allow camera permission when prompted to scan the event code.
                </p>
              </div>
            )}

            {/* State Overlay: Permission Denied / Error / Unsupported */}
            {(cameraState === "denied" || cameraState === "error" || cameraState === "unsupported") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-[#0e0e12] text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
                  <AlertCircle size={24} />
                </div>
                <div className="space-y-1 max-w-xs">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">
                    {cameraState === "denied" ? "Camera Permission Denied" : "Camera Unavailable"}
                  </h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {errorMessage || "Camera access was denied. You can enter the event code manually instead."}
                  </p>
                </div>

                <div className="flex flex-col w-full max-w-xs gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      onClose();
                      onManualEntryClick();
                    }}
                    className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-orange-500/20"
                  >
                    <KeyRound size={14} />
                    <span>Enter Code Instead</span>
                  </button>

                  {cameraState !== "unsupported" && (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={13} />
                      <span>Retry Camera</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Transient QR validation feedback banner */}
            {scanFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-red-500/90 text-white text-xs font-semibold text-center shadow-lg backdrop-blur-sm flex items-center justify-center gap-2"
              >
                <AlertCircle size={14} className="shrink-0" />
                <span>{scanFeedback}</span>
              </motion.div>
            )}
          </div>

          {/* Controls Footer */}
          <div className="p-4 bg-[#09090c] border-t border-neutral-850 flex items-center justify-between gap-3">
            {/* Camera Switch & Flashlight Toggle (if scanning) */}
            <div className="flex items-center gap-2">
              {cameraState === "scanning" && (
                <>
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                    title="Switch camera"
                    aria-label="Switch camera"
                  >
                    <FlipHorizontal size={16} />
                  </button>

                  {hasTorch && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                        torchOn 
                          ? "bg-orange-500/20 border-orange-500/40 text-orange-400" 
                          : "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300 hover:text-white"
                      }`}
                      title={torchOn ? "Turn off light" : "Turn on light"}
                      aria-label="Toggle flashlight"
                    >
                      <Flashlight size={16} />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Fallback to Manual Code Entry */}
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
                onManualEntryClick();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-all cursor-pointer"
            >
              <KeyRound size={13} />
              <span>Enter Code Manually</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
