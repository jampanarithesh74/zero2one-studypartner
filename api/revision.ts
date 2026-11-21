import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "fs";
import path from "path";
import { initializeApp as initializeAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { GoogleGenAI, Type } from "@google/genai";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB limit for AI document analysis
const MAX_REDIRECTS = 6;
const FETCH_TIMEOUT_MS = 25000;

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

function ensureFirebaseAdmin() {
  if (getAdminApps().length > 0) return;

  let projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    "";

  if (!projectId) {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (cfg?.projectId) projectId = cfg.projectId;
      } catch {
        // Ignore parse failures
      }
    }
  }

  if (projectId) {
    initializeAdminApp({ projectId });
  } else {
    initializeAdminApp();
  }
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
        error: "This note points to a Google Drive folder or search link rather than a direct PDF file, so Revision Mode cannot read it automatically.",
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
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("Too many redirects while fetching study notes.");
}

async function fetchNoteContent(rawFileUrl: string): Promise<
  | { kind: "pdf"; base64: string }
  | { kind: "text"; text: string }
  | { kind: "error"; status: number; message: string; code: string }
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
        status: 422,
        code: "EMPTY_FILE",
        message: "The attached note file appears to be empty.",
      };
    }

    if (buffer.byteLength > MAX_FILE_BYTES) {
      return {
        kind: "error",
        status: 413,
        code: "FILE_TOO_LARGE",
        message: "This note file exceeds the 25 MB limit for Revision Mode analysis.",
      };
    }

    if (mimeType.includes("pdf") || buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
      return { kind: "pdf", base64: buffer.toString("base64") };
    }

    if (mimeType.startsWith("text/")) {
      return { kind: "text", text: buffer.toString("utf-8").slice(0, 200000) };
    }

    return {
      kind: "error",
      status: 422,
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
      status: 403,
      code: "HOST_NOT_ALLOWED",
      message: "This note URL host is not permitted for server-side Revision Mode fetching.",
    };
  }

  const transformed = transformGoogleUrl(rawFileUrl);
  if (transformed.error) {
    return {
      kind: "error",
      status: 422,
      code: transformed.code || "NOT_DIRECT_FILE",
      message: transformed.error,
    };
  }

  let upstream = await fetchWithSafeRedirects(transformed.targetUrl);

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
    return {
      kind: "error",
      status: 422,
      code: "UPSTREAM_FETCH_FAILED",
      message: `Unable to fetch these notes from storage (HTTP ${upstream.status}). You can still open or download the notes directly.`,
    };
  }

  const contentType = (upstream.headers.get("content-type") || "application/octet-stream").toLowerCase();
  if (contentType.includes("text/html")) {
    return {
      kind: "error",
      status: 422,
      code: "DRIVE_HTML_RESPONSE",
      message:
        "This Google Drive link returned a web/sign-in page instead of a PDF file. Make sure sharing is set to 'Anyone with the link' or upload a direct PDF.",
    };
  }

  const contentLengthHeader = upstream.headers.get("content-length");
  if (contentLengthHeader && Number(contentLengthHeader) > MAX_FILE_BYTES) {
    return {
      kind: "error",
      status: 413,
      code: "FILE_TOO_LARGE",
      message: "This note file exceeds the 25 MB limit for Revision Mode analysis.",
    };
  }

  const arrayBuffer = await upstream.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    return {
      kind: "error",
      status: 422,
      code: "EMPTY_FILE",
      message: "The fetched note file was empty.",
    };
  }

  if (arrayBuffer.byteLength > MAX_FILE_BYTES) {
    return {
      kind: "error",
      status: 413,
      code: "FILE_TOO_LARGE",
      message: "This note file exceeds the 25 MB limit for Revision Mode analysis.",
    };
  }

  const buffer = Buffer.from(arrayBuffer);
  const isPdfMagic = buffer.subarray(0, 5).toString("ascii") === "%PDF-";

  if (contentType.includes("pdf") || isPdfMagic || rawFileUrl.toLowerCase().split("?")[0].endsWith(".pdf")) {
    return { kind: "pdf", base64: buffer.toString("base64") };
  }

  if (contentType.startsWith("text/") || contentType.includes("json")) {
    return { kind: "text", text: buffer.toString("utf-8").slice(0, 200000) };
  }

  return {
    kind: "error",
    status: 422,
    code: "UNSUPPORTED_FILE_TYPE",
    message: `Unsupported note format (${contentType.split(";")[0]}). Revision Mode works with PDF and text lecture notes.`,
  };
}

function normalizeRevisionPack(raw: any): RevisionPack {
  const importantTopics: RevisionTopic[] = Array.isArray(raw?.importantTopics)
    ? raw.importantTopics
        .filter((t: any) => t && typeof t.topic === "string" && t.topic.trim())
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
        .map((q: any) => {
          const numMarks = Number(q.marks);
          const marks: 2 | 5 | 10 = numMarks === 2 ? 2 : numMarks === 10 ? 10 : 5;
          const keyPoints = Array.isArray(q.keyPoints)
            ? q.keyPoints.map((kp: any) => String(kp).trim()).filter(Boolean)
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
        .map((c: any, idx: number) => ({
          id: String(c.id || `chk_${idx + 1}`).trim(),
          text: String(c.text).trim(),
        }))
    : [];

  const mcqs: RevisionMcq[] = Array.isArray(raw?.mcqs)
    ? raw.mcqs
        .filter((m: any) => m && typeof m.question === "string" && Array.isArray(m.options) && m.options.length >= 4)
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

async function generateWithRetry(ai: GoogleGenAI, params: Parameters<GoogleGenAI["models"]["generateContent"]>[0]) {
  const delays = [800, 1800];
  let lastErr: any;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || "");
      const status = err?.status || err?.code;
      const isTransient =
        status === 429 ||
        status === 503 ||
        status === 500 ||
        msg.includes("503") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("fetch failed");

      if (!isTransient || attempt === delays.length) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }

  throw lastErr;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Strictly gate Revision Mode to logged-in users via Firebase ID Token
  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!idToken) {
    return res.status(401).json({
      error: "Authentication required. Please sign in to use Revision Mode.",
      code: "UNAUTHENTICATED",
    });
  }

  try {
    ensureFirebaseAdmin();
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (!decoded?.uid) {
      return res.status(401).json({ error: "Invalid user session.", code: "UNAUTHENTICATED" });
    }
  } catch (authErr: any) {
    return res.status(401).json({
      error: "Your session has expired or is invalid. Please sign in again to use Revision Mode.",
      code: "INVALID_AUTH_TOKEN",
    });
  }

  const { year, dept, sem, subject, unitTitle, fileUrl } = (req.body || {}) as Record<string, any>;

  const cleanFileUrl = typeof fileUrl === "string" ? fileUrl.trim() : "";
  const cleanSubject = typeof subject === "string" ? subject.trim() : "Engineering Subject";
  const cleanUnitTitle = typeof unitTitle === "string" ? unitTitle.trim() : "Unit Notes";
  const cleanDept = typeof dept === "string" ? dept.trim() : "B.Tech";
  const cleanYear = year !== undefined && year !== null ? String(year).trim() : "";
  const cleanSem = sem !== undefined && sem !== null ? String(sem).trim() : "";

  if (!cleanFileUrl) {
    return res.status(400).json({
      error: "No note file URL is attached to this unit.",
      code: "MISSING_FILE_URL",
    });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(500).json({
      error: "Revision Mode service is not configured yet (missing server API key).",
      code: "MISSING_GEMINI_KEY",
    });
  }

  try {
    const noteContent = await fetchNoteContent(cleanFileUrl);
    if (noteContent.kind === "error") {
      return res.status(noteContent.status).json({
        error: noteContent.message,
        code: noteContent.code,
      });
    }

    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const systemInstruction = `You are an expert B.Tech university exam coach and academic editor for Anurag University students (ZERO2ONE study platform).
Your job is to transform the provided lecture notes document into a high-yield, exam-focused Revision Pack strictly grounded in the uploaded notes.

CRITICAL RULES:
1. Ground EVERY topic, question, key point, checklist item, and MCQ strictly in the contents of the attached study notes document. Do NOT invent formulas, theorems, or syllabus topics that are absent from the document.
2. For every item's "noteRef", cite the specific section heading, subtopic title, slide/page number, or diagram/definition name directly visible in the notes (e.g. "Sec 2.3: Deadlock Prevention (p. 6)" or "Page 4 - B+ Tree Insertion").
3. Generate balanced exam coverage:
   - importantTopics: 5 to 8 key concepts from these notes, prioritizing high-weightage exam topics ("High" or "Medium").
   - importantQuestions: 6 to 9 exam questions spanning 2-mark (short definition/concept), 5-mark (medium derivation/comparison/example), and 10-mark (long essay/algorithm/design) questions, each with 3 to 5 crisp exam-ready keyPoints.
   - quickChecklist: 6 to 10 concrete last-minute revision checks ("Can I explain...", "Do I know the time complexity/formula for...") with unique short IDs like "chk_1".
   - mcqs: 5 to 8 conceptual multiple-choice questions with exactly 4 distinct options, accurate zero-based correctIndex (0..3), a concise explanation grounded in the notes, and noteRef.
4. Keep wording sharp, clear, and concise so a student can revise the unit quickly before exams.`;

    const contextPrompt = `Student Academic Context:
- Year: ${cleanYear || "N/A"}
- Department: ${cleanDept}
- Semester: ${cleanSem || "N/A"}
- Subject: ${cleanSubject}
- Unit: ${cleanUnitTitle}

Analyze the attached study notes carefully and return valid JSON strictly matching the schema.`;

    const contentParts =
      noteContent.kind === "pdf"
        ? [
            { inlineData: { mimeType: "application/pdf", data: noteContent.base64 } },
            { text: contextPrompt },
          ]
        : [
            { text: `--- STUDY NOTES CONTENT ---\n${noteContent.text}\n--- END NOTES ---\n\n${contextPrompt}` },
          ];

    const response = await generateWithRetry(ai, {
      model: "gemini-4-hydrogen",
      contents: { parts: contentParts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
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
        },
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      return res.status(502).json({
        error: "Revision generator returned an empty response. Please try regenerating.",
        code: "EMPTY_MODEL_RESPONSE",
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

    const parsed = JSON.parse(cleanJson);
    const revisionPack = normalizeRevisionPack(parsed);

    if (
      revisionPack.importantTopics.length === 0 &&
      revisionPack.importantQuestions.length === 0 &&
      revisionPack.quickChecklist.length === 0 &&
      revisionPack.mcqs.length === 0
    ) {
      return res.status(422).json({
        error: "Could not extract readable study content from this file. It may be an image-only scan or encrypted PDF.",
        code: "NO_EXTRACTABLE_CONTENT",
      });
    }

    return res.status(200).json({ revisionPack });
  } catch (err: any) {
    console.error("Revision Mode API error:", err?.message || err);
    const msg = String(err?.message || "Failed to generate Revision Mode pack.");
    const isQuota = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
    return res.status(isQuota ? 429 : 500).json({
      error: isQuota
        ? "Revision Mode is temporarily busy due to rate limits. Please try again in a moment."
        : msg,
      code: isQuota ? "RATE_LIMITED" : "REVISION_GENERATION_FAILED",
    });
  }
}
