import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "fs";
import path from "path";
import { initializeApp as initializeAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB limit for AI document analysis
const MAX_REDIRECTS = 6;
const FETCH_TIMEOUT_MS = 12000;

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
      step: "validation",
    });
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

  // Step 4: Call Gemini (ThinkingLevel.LOW for fast structured JSON output)
  const ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const systemInstruction = `You are an expert B.Tech university exam coach and academic editor for Anurag University students (ZERO2ONE study platform).
Transform the provided lecture notes document into a high-yield, exam-focused Revision Pack strictly grounded in the uploaded notes.

CRITICAL RULES:
1. Ground EVERY topic, question, key point, checklist item, and MCQ strictly in the contents of the attached study notes document. Do NOT invent formulas, theorems, or syllabus topics absent from the document.
2. For every item's "noteRef", cite the specific section heading, subtopic title, slide/page number, or diagram/definition name visible in the notes.
3. Generate balanced, concise exam coverage:
   - importantTopics: 5 to 7 key concepts with priority ("High" or "Medium"), whyImportant, and noteRef.
   - importantQuestions: 6 exam questions spanning 2-mark, 5-mark, and 10-mark questions, each with 3 to 4 crisp exam-ready keyPoints and noteRef.
   - quickChecklist: 6 to 8 concise last-minute revision checks with unique short IDs like "chk_1".
   - mcqs: 5 to 6 conceptual MCQs with exactly 4 distinct options, zero-based correctIndex (0..3), concise explanation, and noteRef.`;

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

  const geminiStart = Date.now();
  let textOutput: string | undefined;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: { parts: contentParts },
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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

    textOutput = response.text;
    const geminiDurationMs = Date.now() - geminiStart;
    console.log(
      `[revision] Gemini call completed in ${geminiDurationMs}ms (outputChars=${textOutput?.length || 0})`
    );
  } catch (geminiErr: any) {
    const geminiDurationMs = Date.now() - geminiStart;
    const rawMsg = String(geminiErr?.message || "Gemini API request failed.");
    console.error(`[revision] Gemini API error after ${geminiDurationMs}ms:`, rawMsg);
    const isQuota = rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED");
    return res.status(500).json({
      error: isQuota
        ? "Revision Mode AI service is temporarily rate-limited. Please wait a moment and retry."
        : `Gemini AI error while reading notes: ${rawMsg}`,
      code: isQuota ? "GEMINI_RATE_LIMITED" : "GEMINI_API_ERROR",
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

  console.log(`[revision] Total request completed in ${Date.now() - reqStart}ms`);
  return res.status(200).json({ revisionPack });
}
