import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, RefreshCw, Layers, ArrowUpRight, Download, ExternalLink } from "lucide-react";

interface PDFViewerProps {
  fileUrl: string;
  rotation: number; // 0, 90, 180, 270
  isFullscreen?: boolean;
  title?: string;
  driveLink?: string;
}

// Fixed stable CDN URLs for pdf.js v3.11.174
const PDFJS_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

export function PDFViewer({ fileUrl, rotation, isFullscreen = false, title, driveLink }: PDFViewerProps) {
  const [isPdfJsReady, setIsPdfJsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF.js from CDN dynamically
  useEffect(() => {
    let active = true;
    
    async function initPdfJs() {
      try {
        if ((window as any).pdfjsLib) {
          if (active) setIsPdfJsReady(true);
          return;
        }

        // Check if script is already injected
        let script = document.querySelector(`script[src="${PDFJS_SRC}"]`) as HTMLScriptElement;
        if (!script) {
          script = document.createElement("script");
          script.src = PDFJS_SRC;
          script.async = true;
          document.head.appendChild(script);
        }

        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load PDF.js script"));
        });

        if ((window as any).pdfjsLib) {
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
          if (active) setIsPdfJsReady(true);
        } else {
          throw new Error("PDF.js library could not be resolved from window object");
        }
      } catch (err: any) {
        console.error("PDF.js init error:", err);
        if (active) setFallbackMode(true);
      }
    }

    initPdfJs();
    return () => {
      active = false;
    };
  }, []);

  // Fetch and Load the PDF Document
  useEffect(() => {
    if (!isPdfJsReady || !fileUrl || fallbackMode) return;

    let active = true;
    setLoading(true);
    setLoadError(null);

    const loadingTask = (window as any).pdfjsLib.getDocument({
      url: fileUrl,
      withCredentials: false
    });

    loadingTask.promise
      .then((pdf: any) => {
        if (!active) return;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setLoading(false);
      })
      .catch((err: any) => {
        console.error("Error loading PDF document dynamically:", err);
        // Supabase storage has open CORS, but if some networks/browsers block fetch, failover to Iframe
        if (active) {
          setFallbackMode(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fileUrl, isPdfJsReady, fallbackMode]);

  // Translate vertical wheel scroll movements directly to horizontal scrolling if rotated
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (rotation % 180 !== 0 && containerRef.current) {
      // Prevent standard browser body scrolling
      e.preventDefault();
      containerRef.current.scrollLeft += e.deltaY;
    }
  };

  if (fallbackMode) {
    // Beautiful, high-performance direct-access card fallback in ZERO2ONE styling
    return (
      <div className="w-full h-full min-h-[300px] bg-white border border-orange-100 rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center text-center space-y-5 animate-fadeIn select-none">
        {/* Resource Icon Badge */}
        <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 relative shrink-0">
          <Layers size={30} />
          {driveLink && (
            <div className="absolute -bottom-1 -right-1 bg-white border border-neutral-100 text-neutral-800 rounded-full p-1 shadow-sm">
              <ExternalLink size={10} />
            </div>
          )}
        </div>

        <div className="space-y-2 max-w-sm shrink-0">
          <h4 className="font-extrabold text-neutral-900 text-base md:text-lg leading-tight tracking-tight">
            {title || "Study Notes Document"}
          </h4>
          <p className="text-xs text-neutral-550 font-medium leading-relaxed">
            {driveLink 
              ? "Dual delivery enabled: Google Drive alternative link is ready for immediate study."
              : "Connection fallback: Download study notes immediately or open in external browser tab."}
          </p>
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black bg-orange-100 text-orange-900 uppercase tracking-widest border border-orange-200">
              {driveLink ? "Google Drive Ready" : "Document Ready"}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs justify-center shrink-0">
          {driveLink ? (
            <a 
              href={driveLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl text-xs md:text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              Open Notes <ArrowUpRight size={14} />
            </a>
          ) : (
            <a 
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl text-xs md:text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              Open Notes <ArrowUpRight size={14} />
            </a>
          )}

          {fileUrl && (
            <a 
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 px-4 py-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-750 font-bold rounded-xl text-xs sm:text-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              <Download size={13} /> Download PDF
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-neutral-900 select-none overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/90 z-20">
          <div className="flex flex-col items-center space-y-3">
            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-xs font-black tracking-widest text-white uppercase animate-pulse">
              Buffering Premium Document...
            </p>
          </div>
        </div>
      )}

      {/* Pages Scroll Container */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className={`w-full h-full p-4 flex ${
          rotation % 180 !== 0
            ? "flex-row items-center gap-6 overflow-x-auto overflow-y-hidden select-none"
            : "flex-col items-center gap-6 overflow-y-auto overflow-x-hidden select-none"
        } scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent`}
      >
        {pdfDoc &&
          Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <PDFPage
              key={`${fileUrl}_page_${pageNum}`}
              pdfDoc={pdfDoc}
              pageNum={pageNum}
              rotation={rotation}
              isFullscreen={isFullscreen}
            />
          ))}
      </div>
    </div>
  );
}

interface PDFPageProps {
  key?: string;
  pdfDoc: any;
  pageNum: number;
  rotation: number;
  isFullscreen: boolean;
}

function PDFPage({ pdfDoc, pageNum, rotation, isFullscreen }: PDFPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let active = true;
    setRendering(true);

    pdfDoc.getPage(pageNum).then((page: any) => {
      if (!active || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      // Cancel previous rendering task if running
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      // Base safe scale factor (higher on fullscreen or higher-pixel devices)
      const dpr = window.devicePixelRatio || 1;
      const baseScale = isFullscreen ? 1.6 : 1.25;
      
      // Calculate dynamic viewports
      const viewport = page.getViewport({ scale: baseScale });
      
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      context.scale(dpr, dpr);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      renderTask.promise
        .then(() => {
          if (active) setRendering(false);
        })
        .catch((err: any) => {
          if (err.name !== "RenderingCancelledException") {
            console.error("Rendering error:", err);
          }
        });
    });

    return () => {
      active = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageNum, isFullscreen]);

  // Support direct page transformations for instant rotations
  const getPageStyle = () => {
    const baseTransition = "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
    return {
      transform: `rotate(${rotation}deg)`,
      transition: baseTransition,
      transformOrigin: "center center",
    };
  };

  return (
    <div 
      className="shrink-0 flex items-center justify-center p-2 bg-neutral-950/40 rounded-2xl shadow-xl border border-neutral-800/40 transition-all overflow-hidden"
      style={rotation % 180 !== 0 ? { minWidth: "320px", maxHeight: "100%" } : { maxWidth: "100%" }}
    >
      <canvas
        ref={canvasRef}
        style={getPageStyle()}
        className="rounded-xl max-w-full max-h-full shadow-2xl bg-white"
      />
    </div>
  );
}
