import { useState, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Check, Download, QrCode, ExternalLink } from "lucide-react";

export interface EventJoinQRCodeProps {
  eventCode: string;
  eventId?: string;
  eventName?: string;
  size?: number;
  showDetails?: boolean;
  className?: string;
}

/**
 * Reusable Event Join QR Code generator component.
 * Produces a standards-compliant QR code encoding the canonical /events/join?code=CODE link.
 * 100% client-side: 0 Firestore reads, 0 Firestore writes, 0 real-time listeners.
 */
export function EventJoinQRCode({
  eventCode,
  eventId,
  eventName,
  size = 200,
  showDetails = true,
  className = "",
}: EventJoinQRCodeProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const effectiveCode = (eventCode || eventId || "").trim().toUpperCase();

  // Construct canonical join URL based on runtime origin
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const joinUrl = effectiveCode ? `${origin}/events/join?code=${encodeURIComponent(effectiveCode)}` : "";

  const handleCopyLink = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
    }
  };

  const handleDownloadQR = () => {
    if (!canvasContainerRef.current) return;
    const canvas = canvasContainerRef.current.querySelector("canvas");
    if (!canvas) return;

    try {
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `ZERO2ONE-Event-${effectiveCode || "QR"}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (e) {
      console.warn("QR download failed:", e);
    }
  };

  if (!effectiveCode) {
    return (
      <div className={`p-6 rounded-2xl bg-neutral-900 border border-neutral-800 text-center text-xs text-neutral-500 ${className}`}>
        No event code available to generate QR.
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center p-5 sm:p-6 rounded-3xl bg-[#0e0e12] border border-neutral-800/90 shadow-xl space-y-4 ${className}`}>
      {/* QR Code Canvas Wrapper */}
      <div 
        ref={canvasContainerRef}
        className="p-3.5 sm:p-4 rounded-2xl bg-white flex items-center justify-center shadow-md shadow-black/40"
      >
        <QRCodeCanvas
          value={joinUrl}
          size={size}
          level="H"
          marginSize={1}
          bgColor="#FFFFFF"
          fgColor="#0a0a0c"
          imageSettings={{
            src: "https://raw.githubusercontent.com/jampanapadmaja/ZERO2ONE/main/logo.png",
            x: undefined,
            y: undefined,
            height: Math.floor(size * 0.2),
            width: Math.floor(size * 0.2),
            excavate: true,
          }}
        />
      </div>

      {showDetails && (
        <div className="w-full space-y-3 text-center">
          {eventName && (
            <h4 className="text-sm font-black text-white uppercase tracking-tight truncate max-w-xs mx-auto">
              {eventName}
            </h4>
          )}

          {/* Event Code Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#14141a] border border-neutral-700/80 text-orange-400 font-mono font-bold text-xs uppercase tracking-widest">
            <QrCode size={13} className="text-orange-500" />
            <span>CODE: {effectiveCode}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              title="Copy event join link"
            >
              {copied ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadQR}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              title="Download QR code image"
            >
              <Download size={13} />
              <span>Download</span>
            </button>
          </div>

          <p className="text-[10px] text-neutral-500 max-w-xs mx-auto">
            Scan using any phone camera to open the event join page directly.
          </p>
        </div>
      )}
    </div>
  );
}
