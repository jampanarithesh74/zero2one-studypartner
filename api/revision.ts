import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { cert, initializeApp as initializeAdminApp, getApp as getAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB limit for AI document analysis
const MAX_REDIRECTS = 6;
const FETCH_TIMEOUT_MS = 12000;
const OVERALL_GEMINI_TIMEOUT_MS = 45000;
const FIRESTORE_CACHE_TIMEOUT_MS = 2500;
const REVISION_CACHE_COLLECTION = "revision_packs";

const MODEL_FALLBACK_CHAIN: ReadonlyArray<{
  model: string;
  thinkingLevel: ThinkingLevel;
  timeoutMs: number;
}> = [
  { model: "gemini-3.8-flash", thinkingLevel: ThinkingLevel.LOW, timeoutMs: 15000 },
  { model: "gemini-3.5-flash-lite", thinkingLevel: ThinkingLevel.MINIMAL, timeoutMs: 12000 },
  { model: "gemini-4-hydrogen", thinkingLevel: ThinkingLevel.LOW, timeoutMs: 12000 },
];

interface RevisionTopic {
  topic: string;
  priority: "High" | "Medium";
  whyImportant: string;
  noteRef: string;
}

interface RevisionQuestion {
  marks: 2 | 5 | 10;
  question: string;
  keyPoints: string[];
  noteRef: string;
}

interface RevisionChecklistItem {
  id: string;
  text: string;
}

interface RevisionMcq {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  noteRef: string;
}

interface RevisionPack {
  importantTopics: RevisionTopic[];
  importantQuestions: RevisionQuestion[];
  quickChecklist: RevisionChecklistItem[];
  mcqs: RevisionMcq[];
}

function readFirebaseConfig(): { projectId: string; firestoreDatabaseId: string } {
  let projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    "";
  let firestoreDatabaseId = process.env.FIREBASE_DATABASE_ID || "";

  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (!projectId && cfg?.projectId) projectId = String(cfg.projectId);
      if (!firestoreDatabaseId && cfg?.firestoreDatabaseId) {
        firestoreDatabaseId = String(cfg.firestoreDatabaseId);
      }
    } catch {
      // Ignore parse failures
    }
  }

  return { projectId, firestoreDatabaseId };
}

function ensureFirebaseAdmin() {
  if (getAdminApps().length > 0) return getAdminApp();

  const { projectId } = readFirebaseConfig();
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountJson) {
    try {
      const parsedCred = JSON.parse(serviceAccountJson);
      return initializeAdminApp({
        credential: cert(parsedCred),
        ...(projectId ? { projectId } : {}),
      });
    } catch (e) {
      console.warn("[revision] Invalid FIREBASE_SERVICE_ACCOUNT JSON, falling back to default credentials.");
    }
  }

  if (projectId) {
    return initializeAdminApp({ projectId });
  }
  return initializeAdminApp();
}

function getRevisionFirestore() {
  const { projectId, firestoreDatabaseId } = readFirebaseConfig();
  if (!projectId) return null;

  const app = ensureFirebaseAdmin();
  if (firestoreDatabaseId && firestoreDatabaseId !== "(default)") {
    return getAdminFirestore(app, firestoreDatabaseId);
  }
  return getAdminFirestore(app);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function normalizeFileUrlForCache(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("data:")) {
    // Hash long data URIs deterministically without storing giant base64 strings as raw keys
    return `data:${crypto.createHash("sha256").update(trimmed).digest("hex")}`;
  }
  try {
    const urlObj = new URL(trimmed);
    const host = urlObj.hostname.toLowerCase();
    if (host === "drive.google.com") {
      const fileId = extractGoogleDriveFileId(urlObj);
      if (fileId) return `https://drive.google.com/file/d/${fileId}`;
    }
    if (host === "docs.google.com") {
      const docMatch = urlObj.pathname.match(/\/(document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/);
      if (docMatch) return `https://docs.google.com/${docMatch[1]}/d/${docMatch[2]}`;
    }
    urlObj.hash = "";
    return urlObj.toString();
  } catch {
    return trimmed;
  }
}

function computeRevisionCacheKey(subject: string, unitTitle: string, normalizedFileUrl: string): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        subject: subject.trim().toLowerCase(),
        unitTitle: unitTitle.trim().toLowerCase(),
        fileUrl: normalizedFileUrl,
      })
    )
    .digest("hex");
}

function isValidRevisionPack(data: any): data is RevisionPack {
  return (
    Boolean(data) &&
    Array.isArray(data.importantTopics) &&
    Array.isArray(data.importantQuestions) &&
    Array.isArray(data.quickChecklist) &&
    Array.isArray(data.mcqs) &&
    (data.importantTopics.length > 0 ||
      data.importantQuestions.length > 0 ||
      data.quickChecklist.length > 0 ||
      data.mcqs.length > 0)
  );
}

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

  const envSupabaseUrl = process.env.VITE_SUPABASE_URL;
  if (envSupabaseUrl) {
    try {
      const configuredHost = new URL(envSupabaseUrl).hostname.toLowerCase();
      if (lower === configuredHost) return true;
    } catch {
      // Ignore malformed env URL
    }
  }

  return false;
}

function extractGoogleDriveFileId(urlObj: URL): string | null {
  const host = urlObj.hostname.toLowerCase();
  if (host !== "drive.google.com" && host !== "docs.google.com") {
    return null;
  }

  const filePathMatch = urlObj.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (filePathMatch) return filePathMatch[1];

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
        error: "This note points to a Google Drive folder or search link rather than a single PDF file, so Revision Mode cannot read it automatically.",
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

async function fetchWithSafeRedirects(initialUrl: string): Promise<Response> {
  let currentUrl = initialUrl;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const parsed = new URL(currentUrl);
    if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
      throw new Error(`Disallowed note host: ${parsed.hostname}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ZERO2ONE-RevisionMode/1.0)",
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
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new Error(`Timed out after ${Math.round(FETCH_TIMEOUT_MS / 1000)}s while downloading notes from Drive/CDN.`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("Too many redirects while fetching study notes.");
}

async function fetchNoteContent(rawFileUrl: string): Promise<
  | { kind: "pdf"; base64: string; bytes: number }
  | { kind: "text"; text: string; bytes: number }
  | { kind: "error"; status: 400 | 500; message: string; code: string }
> {
  // Handle embedded base64 data URIs
  if (rawFileUrl.startsWith("data:")) {
    const match = rawFileUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!match) {
      return {
        kind: "error",
        status: 400,
        code: "INVALID_DATA_URL",
        message: "The attached note data URL is malformed and could not be read.",
      };
    }

    const mimeType = (match[1] || "application/pdf").toLowerCase();
    const isBase64 = Boolean(match[2]);
    const payload = match[3] || "";

    const buffer = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf-8");

    if (buffer.byteLength === 0) {
      return {
        kind: "error",
        status: 400,
        code: "EMPTY_FILE",
        message: "The attached note file appears to be empty.",
      };
    }

    if (buffer.byteLength > MAX_FILE_BYTES) {
      return {
        kind: "error",
        status: 400,
        code: "FILE_TOO_LARGE",
        message: "This note file exceeds the 25 MB limit for Revision Mode analysis.",
      };
    }

    if (mimeType.includes("pdf") || buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
      return { kind: "pdf", base64: buffer.toString("base64"), bytes: buffer.byteLength };
    }

    if (mimeType.startsWith("text/")) {
      return { kind: "text", text: buffer.toString("utf-8").slice(0, 200000), bytes: buffer.byteLength };
    }

    return {
      kind: "error",
      status: 400,
      code: "UNSUPPORTED_FILE_TYPE",
      message: "Revision Mode currently supports PDF and plain text study notes.",
    };
  }

  let parsedInitial: URL;
  try {
    parsedInitial = new URL(rawFileUrl);
  } catch {
    return {
      kind: "error",
      status: 400,
      code: "INVALID_URL",
      message: "The note file URL is invalid.",
    };
  }

  if (parsedInitial.protocol !== "https:" || !isAllowedHost(parsedInitial.hostname)) {
    return {
      kind: "error",
      status: 400,
      code: "HOST_NOT_ALLOWED",
      message: "This note URL host is not permitted for server-side Revision Mode fetching.",
    };
  }

  const transformed = transformGoogleUrl(rawFileUrl);
  if (transformed.error) {
    return {
      kind: "error",
      status: 400,
      code: transformed.code || "NOT_DIRECT_FILE",
      message: transformed.error,
    };
  }

  let upstream: Response;
  try {
    upstream = await fetchWithSafeRedirects(transformed.targetUrl);

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
  } catch (fetchErr: any) {
    return {
      kind: "error",
      status: 500,
      code: "DRIVE_CDN_FETCH_FAILED",
      message: fetchErr?.message || "Failed to connect to Google Drive or CDN storage to fetch the notes.",
    };
  }

  if (!upstream.ok) {
    return {
      kind: "error",
      status: 500,
      code: "DRIVE_CDN_FETCH_FAILED",
      message: `Could not fetch these notes from Drive/CDN (HTTP ${upstream.status}). You can open the notes directly instead.`,
    };
  }

  const contentType = (upstream.headers.get("content-type") || "application/octet-stream").toLowerCase();
  if (contentType.includes("text/html")) {
    return {
      kind: "error",
      status: 400,
      code: "NON_PDF_HTML_RESPONSE",
      message:
        "This Google Drive link returned an HTML web/sign-in page instead of a PDF file. Make sure sharing is set to 'Anyone with the link' or open it directly in Drive.",
    };
  }

  const contentLengthHeader = upstream.headers.get("content-length");
  if (contentLengthHeader && Number(contentLengthHeader) > MAX_FILE_BYTES) {
    return {
      kind: "error",
      status: 400,
      code: "FILE_TOO_LARGE",
      message: "This note file exceeds the 25 MB limit for Revision Mode analysis.",
    };
  }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await upstream.arrayBuffer();
  } catch (readErr: any) {
    return {
      kind: "error",
      status: 500,
      code: "DRIVE_CDN_STREAM_FAILED",
      message: readErr?.message || "Failed while reading the note file bytes from storage.",
    };
  }

  if (arrayBuffer.byteLength === 0) {
    return {
      kind: "error",
      status: 400,
      code: "EMPTY_FILE",
      message: "The fetched note file was empty.",
    };
  }

  if (arrayBuffer.byteLength > MAX_FILE_BYTES) {
    return {
      kind: "error",
      status: 400,
      code: "FILE_TOO_LARGE",
      message: "This note file exceeds the 25 MB limit for Revision Mode analysis.",
    };
  }

  const buffer = Buffer.from(arrayBuffer);
  const isPdfMagic = buffer.subarray(0, 5).toString("ascii") === "%PDF-";

  if (contentType.includes("pdf") || isPdfMagic || rawFileUrl.toLowerCase().split("?")[0].endsWith(".pdf")) {
    return { kind: "pdf", base64: buffer.toString("base64"), bytes: buffer.byteLength };
  }

  if (contentType.startsWith("text/") || contentType.includes("json")) {
    return { kind: "text", text: buffer.toString("utf-8").slice(0, 200000), bytes: buffer.byteLength };
  }

  return {
    kind: "error",
    status: 400,
    code: "NON_PDF_UNSUPPORTED_TYPE",
    message: `Unsupported file type (${contentType.split(";")[0]}). Revision Mode requires a PDF or plain text notes file.`,
  };
}

function normalizeRevisionPack(raw: any): RevisionPack {
  const importantTopics: RevisionTopic[] = Array.isArray(raw?.importantTopics)
    ? raw.importantTopics
        .filter((t: any) => t && typeof t.topic === "string" && t.topic.trim())
        .slice(0, 6)
        .map((t: any) => ({
          topic: String(t.topic).trim(),
          priority: t.priority === "High" ? "High" : "Medium",
          whyImportant: String(t.whyImportant || "Frequently tested core unit concept.").trim(),
          noteRef: String(t.noteRef || "Unit Notes").trim(),
        }))
    : [];

  const importantQuestions: RevisionQuestion[] = Array.isArray(raw?.importantQuestions)
    ? raw.importantQuestions
        .filter((q: any) => q && typeof q.question === "string" && q.question.trim())
        .slice(0, 6)
        .map((q: any) => {
          const numMarks = Number(q.marks);
          const marks: 2 | 5 | 10 = numMarks === 2 ? 2 : numMarks === 10 ? 10 : 5;
          const keyPoints = Array.isArray(q.keyPoints)
            ? q.keyPoints.map((kp: any) => String(kp).trim()).filter(Boolean).slice(0, 4)
            : [];
          return {
            marks,
            question: String(q.question).trim(),
            keyPoints: keyPoints.length > 0 ? keyPoints : ["Refer to the corresponding section in your unit notes."],
            noteRef: String(q.noteRef || "Unit Notes").trim(),
          };
        })
    : [];

  const quickChecklist: RevisionChecklistItem[] = Array.isArray(raw?.quickChecklist)
    ? raw.quickChecklist
        .filter((c: any) => c && typeof c.text === "string" && c.text.trim())
        .slice(0, 6)
        .map((c: any, idx: number) => ({
          id: String(c.id || `chk_${idx + 1}`).trim(),
          text: String(c.text).trim(),
        }))
    : [];

  const mcqs: RevisionMcq[] = Array.isArray(raw?.mcqs)
    ? raw.mcqs
        .filter((m: any) => m && typeof m.question === "string" && Array.isArray(m.options) && m.options.length >= 4)
        .slice(0, 6)
        .map((m: any, idx: number) => {
          const opts: [string, string, string, string] = [
            String(m.options[0] ?? "").trim(),
            String(m.options[1] ?? "").trim(),
            String(m.options[2] ?? "").trim(),
            String(m.options[3] ?? "").trim(),
          ];
          const rawIndex = Number(m.correctIndex);
          const correctIndex = Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex <= 3 ? rawIndex : 0;
          return {
            id: String(m.id || `mcq_${idx + 1}`).trim(),
            question: String(m.question).trim(),
            options: opts,
            correctIndex,
            explanation: String(m.explanation || "Verified directly from the uploaded unit notes.").trim(),
            noteRef: String(m.noteRef || "Unit Notes").trim(),
          };
        })
    : [];

  return { importantTopics, importantQuestions, quickChecklist, mcqs };
}

function isRetryableModelOverloadError(err: any): boolean {
  const status = Number(err?.status ?? err?.code ?? 0);
  if (status === 503 || status === 429 || status === 504) return true;
  const name = String(err?.name || "").toUpperCase();
  const msg = String(err?.message || "").toUpperCase();
  return (
    name === "TIMEOUTERROR" ||
    name === "ABORTERROR" ||
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("504") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("DEADLINE_EXCEEDED") ||
    msg.includes("HIGH DEMAND") ||
    msg.includes("OVERLOADED") ||
    msg.includes("TIMEOUT") ||
    msg.includes("TIMED OUT") ||
    msg.includes("ABORT") ||
    msg.includes("ETIMEDOUT")
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const reqStart = Date.now();

  if (req.method !== "POST") {
    return res.status(400).json({ error: "Method Not Allowed. Use POST.", code: "METHOD_NOT_ALLOWED" });
  }

  // Step 1: Strictly gate Revision Mode to logged-in users via Firebase ID Token
  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!idToken) {
    return res.status(401).json({
      error: "Authentication required. Please sign in to use Revision Mode.",
      code: "UNAUTHENTICATED",
      step: "auth",
    });
  }

  try {
    ensureFirebaseAdmin();
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (!decoded?.uid) {
      return res.status(401).json({ error: "Invalid user session.", code: "UNAUTHENTICATED", step: "auth" });
    }
  } catch {
    return res.status(401).json({
      error: "Your session has expired or is invalid. Please sign in again to use Revision Mode.",
      code: "INVALID_AUTH_TOKEN",
      step: "auth",
    });
  }

  // Step 2: Validate request payload & server key
  const { year, dept, sem, subject, unitTitle, fileUrl, forceRegenerate } = (req.body || {}) as Record<string, any>;

  const cleanFileUrl = typeof fileUrl === "string" ? fileUrl.trim() : "";
  const cleanSubject = typeof subject === "string" ? subject.trim() : "Engineering Subject";
  const cleanUnitTitle = typeof unitTitle === "string" ? unitTitle.trim() : "Unit Notes";
  const cleanDept = typeof dept === "string" ? dept.trim() : "B.Tech";
  const cleanYear = year !== undefined && year !== null ? String(year).trim() : "";
  const cleanSem = sem !== undefined && sem !== null ? String(sem).trim() : "";
  const bypassServerCache = forceRegenerate === true;

  if (!cleanFileUrl) {
    return res.status(400).json({
      error: "No note file URL is attached to this unit.",
      code: "MISSING_FILE_URL",
      step: "validation",
    });
  }

  const normalizedFileUrl = normalizeFileUrlForCache(cleanFileUrl);
  const cacheKey = computeRevisionCacheKey(cleanSubject, cleanUnitTitle, normalizedFileUrl);

  // Step 2b: Check shared Firestore cache first (unless forceRegenerate: true)
  let firestoreDb: ReturnType<typeof getRevisionFirestore> = null;
  try {
    firestoreDb = getRevisionFirestore();
  } catch (initErr: any) {
    console.warn("[revision] Firestore Admin not available:", initErr?.message || initErr);
  }

  if (firestoreDb && !bypassServerCache) {
    const cacheStart = Date.now();
    try {
      const snap = await withTimeout(
        firestoreDb.collection(REVISION_CACHE_COLLECTION).doc(cacheKey).get(),
        FIRESTORE_CACHE_TIMEOUT_MS,
        "Firestore cache lookup"
      );
      if (snap.exists) {
        const cachedData = snap.data();
        if (isValidRevisionPack(cachedData?.revisionPack)) {
          const cachedModel = typeof cachedData?.modelUsed === "string" ? cachedData.modelUsed : "cache";
          console.log(
            `[revision] Shared Firestore cache HIT in ${Date.now() - cacheStart}ms (key=${cacheKey.slice(0, 12)}, modelUsed=${cachedModel})`
          );
          return res.status(200).json({
            revisionPack: cachedData.revisionPack,
            modelUsed: cachedModel,
            cached: true,
          });
        }
      }
      console.log(`[revision] Shared Firestore cache MISS in ${Date.now() - cacheStart}ms (key=${cacheKey.slice(0, 12)})`);
    } catch (cacheErr: any) {
      console.warn(
        `[revision] Shared Firestore cache lookup skipped (${Date.now() - cacheStart}ms):`,
        cacheErr?.message || cacheErr
      );
    }
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(500).json({
      error: "Revision Mode service is not configured yet (missing server API key).",
      code: "MISSING_GEMINI_KEY",
      step: "config",
    });
  }

  // Step 3: Fetch note bytes from Drive / CDN
  const fetchStart = Date.now();
  const noteContent = await fetchNoteContent(cleanFileUrl);
  const fetchDurationMs = Date.now() - fetchStart;

  if (noteContent.kind === "error") {
    console.log(
      `[revision] Drive/CDN fetch failed in ${fetchDurationMs}ms (status=${noteContent.status}, code=${noteContent.code}): ${noteContent.message}`
    );
    return res.status(noteContent.status).json({
      error: noteContent.message,
      code: noteContent.code,
      step: "fetch_notes",
    });
  }

  console.log(
    `[revision] Drive/CDN fetch succeeded in ${fetchDurationMs}ms (kind=${noteContent.kind}, bytes=${noteContent.bytes}, subject="${cleanSubject}", unit="${cleanUnitTitle}")`
  );

  // Step 4: Call Gemini with clean >=12s-15s per-model deadlines (Gemini minimum is 10s),
  // no slow multi-retry backoff, and a 45s overall request guard.
  const ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      retryOptions: { attempts: 1 },
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const systemInstruction = `You are a concise B.Tech university exam coach for Anurag University students (ZERO2ONE).
Extract a crisp, high-yield Revision Pack strictly grounded in the provided study notes document.

CRITICAL RULES:
1. Ground EVERY item strictly in the attached study notes. Do NOT invent formulas, theorems, or concepts absent from the document.
2. For each item's "noteRef", cite the short section/heading or page/slide number visible in the notes.
3. Keep all output CRISP and concise (1 brief sentence max per field) and strictly cap item counts for fast revision:
   - importantTopics: 5 to 6 key concepts with priority ("High" or "Medium"), concise 1-sentence whyImportant, and noteRef.
   - importantQuestions: exactly 6 exam questions (two 2M, two 5M, two 10M), each with 3 crisp keyPoints and noteRef.
   - quickChecklist: exactly 6 short, actionable revision checks with unique IDs ("chk_1" to "chk_6").
   - mcqs: exactly 6 conceptual MCQs with 4 brief options, zero-based correctIndex (0..3), 1-sentence explanation, and noteRef.`;

  const contextPrompt = `Student Academic Context:
- Year: ${cleanYear || "N/A"}
- Department: ${cleanDept}
- Semester: ${cleanSem || "N/A"}
- Subject: ${cleanSubject}
- Unit: ${cleanUnitTitle}

Analyze the attached study notes and return valid JSON matching the schema.`;

  const contentParts =
    noteContent.kind === "pdf"
      ? [
          { inlineData: { mimeType: "application/pdf", data: noteContent.base64 } },
          { text: contextPrompt },
        ]
      : [
          { text: `--- STUDY NOTES CONTENT ---\n${noteContent.text}\n--- END NOTES ---\n\n${contextPrompt}` },
        ];

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      importantTopics: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ["High", "Medium"] },
            whyImportant: { type: Type.STRING },
            noteRef: { type: Type.STRING },
          },
          required: ["topic", "priority", "whyImportant", "noteRef"],
        },
      },
      importantQuestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            marks: { type: Type.INTEGER },
            question: { type: Type.STRING },
            keyPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            noteRef: { type: Type.STRING },
          },
          required: ["marks", "question", "keyPoints", "noteRef"],
        },
      },
      quickChecklist: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
          },
          required: ["id", "text"],
        },
      },
      mcqs: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            question: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            correctIndex: { type: Type.INTEGER },
            explanation: { type: Type.STRING },
            noteRef: { type: Type.STRING },
          },
          required: ["id", "question", "options", "correctIndex", "explanation", "noteRef"],
        },
      },
    },
    required: ["importantTopics", "importantQuestions", "quickChecklist", "mcqs"],
  };

  const geminiStart = Date.now();
  let textOutput: string | undefined;
  let modelUsed = MODEL_FALLBACK_CHAIN[0].model;
  let lastGeminiErr: any = null;

  for (let i = 0; i < MODEL_FALLBACK_CHAIN.length; i++) {
    const candidate = MODEL_FALLBACK_CHAIN[i];
    const elapsedGeminiMs = Date.now() - geminiStart;
    const remainingBudgetMs = OVERALL_GEMINI_TIMEOUT_MS - elapsedGeminiMs;
    if (i > 0 && remainingBudgetMs < candidate.timeoutMs) {
      console.warn(
        `[revision] Skipping fallback ${candidate.model}: remaining 45s budget (${remainingBudgetMs}ms) is below safe ${candidate.timeoutMs}ms deadline.`
      );
      break;
    }

    const attemptStart = Date.now();
    const attemptTimeoutMs = candidate.timeoutMs;

    try {
      const response = await ai.models.generateContent({
        model: candidate.model,
        contents: { parts: contentParts },
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
          responseMimeType: "application/json",
          responseSchema,
          httpOptions: { timeout: attemptTimeoutMs },
          abortSignal: AbortSignal.timeout(attemptTimeoutMs),
        },
      });

      textOutput = response.text;
      modelUsed = candidate.model;
      console.log(
        `[revision] Gemini call succeeded with model=${modelUsed} (thinking=${candidate.thinkingLevel}, timeout=${attemptTimeoutMs}ms) in ${Date.now() - attemptStart}ms (outputChars=${textOutput?.length || 0})`
      );
      lastGeminiErr = null;
      break;
    } catch (geminiErr: any) {
      lastGeminiErr = geminiErr;
      const attemptMs = Date.now() - attemptStart;
      const rawMsg = String(geminiErr?.message || "Gemini API request failed.");
      const canFallback = i < MODEL_FALLBACK_CHAIN.length - 1 && isRetryableModelOverloadError(geminiErr);

      if (canFallback) {
        const nextModel = MODEL_FALLBACK_CHAIN[i + 1].model;
        console.warn(
          `[revision] Model ${candidate.model} failed/timed out after ${attemptMs}ms (${rawMsg}). Failing over to ${nextModel}...`
        );
        continue;
      }

      console.error(
        `[revision] Gemini API error on model=${candidate.model} after ${attemptMs}ms (totalGeminiMs=${Date.now() - geminiStart}):`,
        rawMsg
      );
      break;
    }
  }

  if (lastGeminiErr) {
    const rawMsg = String(lastGeminiErr?.message || "Gemini API request failed.");
    const isQuotaOrDemand = isRetryableModelOverloadError(lastGeminiErr);
    return res.status(500).json({
      error: isQuotaOrDemand
        ? "All AI revision models are currently experiencing high demand. Please retry in a few seconds."
        : `Gemini AI error while reading notes: ${rawMsg}`,
      code: isQuotaOrDemand ? "GEMINI_HIGH_DEMAND" : "GEMINI_API_ERROR",
      step: "gemini",
    });
  }

  // Step 5: Parse & validate structured JSON response
  if (!textOutput || !textOutput.trim()) {
    return res.status(500).json({
      error: "Gemini returned an empty response for these notes. Please try regenerating.",
      code: "INVALID_JSON_EMPTY",
      step: "parse_json",
    });
  }

  let cleanJson = textOutput.trim();
  if (cleanJson.startsWith("```json")) {
    cleanJson = cleanJson.slice(7);
  } else if (cleanJson.startsWith("```")) {
    cleanJson = cleanJson.slice(3);
  }
  if (cleanJson.endsWith("```")) {
    cleanJson = cleanJson.slice(0, -3);
  }
  cleanJson = cleanJson.trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (parseErr: any) {
    console.error("[revision] Invalid JSON output from Gemini:", parseErr?.message || parseErr);
    return res.status(500).json({
      error: "Gemini returned malformed JSON while building your Revision Pack. Please retry.",
      code: "INVALID_JSON_OUTPUT",
      step: "parse_json",
    });
  }

  const revisionPack = normalizeRevisionPack(parsed);

  if (
    revisionPack.importantTopics.length === 0 &&
    revisionPack.importantQuestions.length === 0 &&
    revisionPack.quickChecklist.length === 0 &&
    revisionPack.mcqs.length === 0
  ) {
    return res.status(400).json({
      error: "Could not extract readable study content from this file. It may be an image-only scan or protected PDF.",
      code: "NO_EXTRACTABLE_CONTENT",
      step: "parse_json",
    });
  }

  // Step 6: Save to shared Firestore cache (best-effort, non-blocking failure)
  if (firestoreDb) {
    try {
      await withTimeout(
        firestoreDb
          .collection(REVISION_CACHE_COLLECTION)
          .doc(cacheKey)
          .set({
            cacheKey,
            subject: cleanSubject,
            unitTitle: cleanUnitTitle,
            normalizedFileUrl,
            year: cleanYear,
            dept: cleanDept,
            sem: cleanSem,
            modelUsed,
            revisionPack,
            updatedAt: Date.now(),
          }),
        FIRESTORE_CACHE_TIMEOUT_MS,
        "Firestore cache write"
      );
      console.log(`[revision] Saved pack to Firestore cache (key=${cacheKey.slice(0, 12)}, modelUsed=${modelUsed})`);
    } catch (saveErr: any) {
      console.warn("[revision] Shared Firestore cache write skipped:", saveErr?.message || saveErr);
    }
  }

  console.log(`[revision] Total request completed in ${Date.now() - reqStart}ms (modelUsed=${modelUsed})`);
  return res.status(200).json({ revisionPack, modelUsed, cached: false });
}
