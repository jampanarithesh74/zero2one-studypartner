export interface DownloadNoteOptions {
  fileUrl?: string;
  driveLink?: string;
  title?: string;
}

export interface DownloadNoteResult {
  ok: boolean;
  message?: string;
  fallbackOpened?: boolean;
}

export function sanitizeDownloadFilename(title?: string, fallbackExt = "pdf"): string {
  const cleaned = (title || "study-notes")
    .replace(/[\r\n"\\/:*?<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  const base = cleaned || "study-notes";
  if (/\.(pdf|docx?|pptx?|xlsx?|txt|zip)$/i.test(base)) {
    return base;
  }
  return `${base}.${fallbackExt}`;
}

export function isGoogleDriveFolderOrSearch(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes("drive.google.com") &&
      (parsed.pathname.includes("/drive/folders/") || parsed.pathname.includes("/drive/search"))
    );
  } catch {
    return false;
  }
}

export function getGoogleDriveDirectDownloadUrl(driveLink?: string): string | null {
  if (!driveLink) return null;
  try {
    const parsed = new URL(driveLink);
    if (parsed.hostname === "drive.google.com") {
      if (isGoogleDriveFolderOrSearch(driveLink)) return null;
      const fileMatch = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      const id = fileMatch?.[1] || parsed.searchParams.get("id");
      if (id) {
        return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
      }
    }
    if (parsed.hostname === "docs.google.com") {
      const docMatch = parsed.pathname.match(/\/(document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/);
      if (docMatch) {
        const [, docType, docId] = docMatch;
        if (docType === "presentation") {
          return `https://docs.google.com/presentation/d/${docId}/export/pdf`;
        }
        return `https://docs.google.com/${docType}/d/${docId}/export?format=pdf`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function triggerBlobOrDataDownload(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function openExternalFallback(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function fetchAndSaveViaProxy(targetUrl: string, filename: string): Promise<{ ok: boolean; error?: string }> {
  const proxyUrl = `/api/download?url=${encodeURIComponent(targetUrl)}&filename=${encodeURIComponent(filename)}`;
  const response = await fetch(proxyUrl);

  if (!response.ok) {
    let errorMsg = `Download failed (${response.status})`;
    try {
      const json = await response.json();
      if (json?.error) errorMsg = json.error;
    } catch {
      // Ignore non-JSON error
    }
    return { ok: false, error: errorMsg };
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  try {
    triggerBlobOrDataDownload(blobUrl, filename);
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  }
  return { ok: true };
}

export async function downloadNoteToDevice({
  fileUrl,
  driveLink,
  title,
}: DownloadNoteOptions): Promise<DownloadNoteResult> {
  const filename = sanitizeDownloadFilename(title, "pdf");

  // 1. Data URL (embedded base64 PDF): direct client download
  if (fileUrl && fileUrl.startsWith("data:")) {
    triggerBlobOrDataDownload(fileUrl, filename);
    return { ok: true, message: `Downloading ${filename}...` };
  }

  // 2. Uploaded fileUrl (Supabase / Firebase Storage / direct HTTPS URL)
  if (fileUrl) {
    try {
      const proxyResult = await fetchAndSaveViaProxy(fileUrl, filename);
      if (proxyResult.ok) {
        return { ok: true, message: `Downloading ${filename}...` };
      }
    } catch {
      // Fall through to direct CORS fetch fallback
    }

    try {
      const directRes = await fetch(fileUrl);
      if (directRes.ok) {
        const blob = await directRes.blob();
        const blobUrl = URL.createObjectURL(blob);
        try {
          triggerBlobOrDataDownload(blobUrl, filename);
        } finally {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        }
        return { ok: true, message: `Downloading ${filename}...` };
      }
    } catch {
      // Fall through to Drive or anchor fallback
    }
  }

  // 3. Google Drive link fallback or primary source
  if (driveLink) {
    if (isGoogleDriveFolderOrSearch(driveLink)) {
      openExternalFallback(driveLink);
      return {
        ok: false,
        fallbackOpened: true,
        message: "This link points to a Google Drive folder. Opened in Drive so you can download files.",
      };
    }

    try {
      const proxyResult = await fetchAndSaveViaProxy(driveLink, filename);
      if (proxyResult.ok) {
        return { ok: true, message: `Downloading ${filename}...` };
      }
    } catch {
      // Fall through to direct Drive export/download tab fallback
    }

    const directDriveUrl = getGoogleDriveDirectDownloadUrl(driveLink) || driveLink;
    openExternalFallback(directDriveUrl);
    return {
      ok: false,
      fallbackOpened: true,
      message: "Opened Google Drive download link in a new tab.",
    };
  }

  // 4. Last-resort fallback if fileUrl failed CORS and proxy
  if (fileUrl) {
    openExternalFallback(fileUrl);
    return {
      ok: false,
      fallbackOpened: true,
      message: "Opened notes file in a new tab.",
    };
  }

  return {
    ok: false,
    message: "No downloadable file or link is attached to these notes.",
  };
}
