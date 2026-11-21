import type { VercelRequest, VercelResponse } from "@vercel/node";

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB safety limit
const MAX_REDIRECTS = 6;

function isPrivateOrLocalHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower === "0.0.0.0" ||
    lower === "::1" ||
    lower === "[::1]" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal")
  ) {
    return true;
  }

  // IPv4 literal checks
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return true;
    }
  }

  return false;
}

function isAllowedHost(hostname: string): boolean {
  if (isPrivateOrLocalHostname(hostname)) return false;
  const lower = hostname.toLowerCase();

  const exactHosts = new Set([
    "drive.google.com",
    "docs.google.com",
    "drive.usercontent.google.com",
    "firebasestorage.googleapis.com",
    "storage.googleapis.com",
  ]);

  if (exactHosts.has(lower)) return true;

  if (
    lower.endsWith(".googleusercontent.com") ||
    lower.endsWith(".supabase.co") ||
    lower.endsWith(".supabase.in") ||
    lower.endsWith(".firebasestorage.app")
  ) {
    return true;
  }

  // Allow configured Supabase project hostname if set
  const envSupabaseUrl = process.env.VITE_SUPABASE_URL;
  if (envSupabaseUrl) {
    try {
      const configuredHost = new URL(envSupabaseUrl).hostname.toLowerCase();
      if (lower === configuredHost) return true;
    } catch {
      // Ignore invalid env URL
    }
  }

  return false;
}

function extractGoogleDriveFileId(urlObj: URL): string | null {
  const host = urlObj.hostname.toLowerCase();
  if (host !== "drive.google.com" && host !== "docs.google.com") {
    return null;
  }

  // /file/d/<ID>/...
  const filePathMatch = urlObj.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (filePathMatch) return filePathMatch[1];

  // ?id=<ID>
  const queryId = urlObj.searchParams.get("id");
  if (queryId && /^[a-zA-Z0-9_-]+$/.test(queryId)) return queryId;

  return null;
}

function transformGoogleUrl(rawUrl: string): { targetUrl: string; error?: string; code?: string } {
  const urlObj = new URL(rawUrl);
  const host = urlObj.hostname.toLowerCase();

  if (host === "drive.google.com") {
    if (urlObj.pathname.includes("/drive/folders/") || urlObj.pathname.includes("/drive/search")) {
      return {
        targetUrl: rawUrl,
        error: "Google Drive folders and search links cannot be downloaded as a single file directly.",
        code: "DRIVE_FOLDER_NOT_SUPPORTED",
      };
    }

    const fileId = extractGoogleDriveFileId(urlObj);
    if (fileId) {
      return {
        targetUrl: `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
      };
    }
  }

  if (host === "docs.google.com") {
    const docMatch = urlObj.pathname.match(/\/(document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/);
    if (docMatch) {
      const [, docType, docId] = docMatch;
      if (docType === "presentation") {
        return { targetUrl: `https://docs.google.com/presentation/d/${docId}/export/pdf` };
      }
      return { targetUrl: `https://docs.google.com/${docType}/d/${docId}/export?format=pdf` };
    }
  }

  return { targetUrl: rawUrl };
}

function sanitizeFilename(input: string | undefined, contentType: string): string {
  const cleaned = (input || "study-notes")
    .replace(/[\r\n"\\/:*?<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  const base = cleaned || "study-notes";
  if (/\.(pdf|docx?|pptx?|xlsx?|txt|zip)$/i.test(base)) {
    return base;
  }

  if (contentType.includes("pdf")) return `${base}.pdf`;
  if (contentType.includes("wordprocessingml")) return `${base}.docx`;
  if (contentType.includes("msword")) return `${base}.doc`;
  return `${base}.pdf`;
}

function parseFilenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }
  const quotedMatch = disposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1].trim();
  const plainMatch = disposition.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) return plainMatch[1].trim();
  return null;
}

async function fetchWithSafeRedirects(initialUrl: string): Promise<Response> {
  let currentUrl = initialUrl;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const parsed = new URL(currentUrl);
    if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
      throw new Error(`Disallowed download host: ${parsed.hostname}`);
    }

    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ZERO2ONE-Downloader/1.0)",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Redirect response missing Location header");
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return response;
  }

  throw new Error("Too many redirects while downloading file");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const rawUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
  const requestedFilename = typeof req.query.filename === "string" ? req.query.filename.trim() : "";

  if (!rawUrl) {
    return res.status(400).json({ error: "Missing required url parameter" });
  }

  let parsedInitial: URL;
  try {
    parsedInitial = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: "Invalid download URL" });
  }

  if (parsedInitial.protocol !== "https:" || !isAllowedHost(parsedInitial.hostname)) {
    return res.status(403).json({ error: "URL host is not permitted for proxied download" });
  }

  const transformed = transformGoogleUrl(rawUrl);
  if (transformed.error) {
    return res.status(422).json({
      error: transformed.error,
      code: transformed.code || "NOT_DIRECT_DOWNLOADABLE",
    });
  }

  try {
    let upstream = await fetchWithSafeRedirects(transformed.targetUrl);

    // Fallback to drive.google.com/uc if drive.usercontent returned 404/403
    if (
      !upstream.ok &&
      transformed.targetUrl.includes("drive.usercontent.google.com/download")
    ) {
      const fileId = extractGoogleDriveFileId(parsedInitial);
      if (fileId) {
        upstream = await fetchWithSafeRedirects(
          `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
        );
      }
    }

    if (!upstream.ok) {
      return res.status(422).json({
        error: `Could not download file automatically (status ${upstream.status}).`,
        code: "UPSTREAM_FETCH_FAILED",
      });
    }

    const contentType = (upstream.headers.get("content-type") || "application/octet-stream").toLowerCase();

    // Prevent saving an HTML login/confirmation page as a .pdf file
    if (contentType.includes("text/html")) {
      return res.status(422).json({
        error: "This link returned a web page instead of a downloadable file (it may require Google Drive sign-in or permissions).",
        code: "DRIVE_HTML_RESPONSE",
      });
    }

    const contentLengthHeader = upstream.headers.get("content-length");
    if (contentLengthHeader && Number(contentLengthHeader) > MAX_FILE_BYTES) {
      return res.status(413).json({
        error: "File exceeds direct download proxy limit (100 MB).",
        code: "FILE_TOO_LARGE",
      });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FILE_BYTES) {
      return res.status(413).json({
        error: "File exceeds direct download proxy limit (100 MB).",
        code: "FILE_TOO_LARGE",
      });
    }

    const upstreamName = parseFilenameFromDisposition(upstream.headers.get("content-disposition"));
    const finalName = sanitizeFilename(requestedFilename || upstreamName || "study-notes", contentType);
    const asciiFallback = finalName.replace(/[^\x20-\x7E]/g, "_");

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(finalName)}`
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error("Download proxy error:", err?.message || err);
    return res.status(502).json({
      error: err?.message || "Failed to download file from storage.",
      code: "DOWNLOAD_PROXY_ERROR",
    });
  }
}
