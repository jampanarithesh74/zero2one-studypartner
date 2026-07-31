import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { initializeApp, getApps } from "firebase-admin/app";
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

// Enable JSON body parsing for the syllabus parser endpoint
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Load config safely
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = {};
if (fs.existsSync(firebaseConfigPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
  } catch (e) {
    console.error("Failed to parse firebase-applet-config.json", e);
  }
}

// Initialize Firebase Admin (still used for Firestore)
try {
  if (getApps().length === 0 && firebaseConfig.projectId) {
    initializeApp({
      projectId: firebaseConfig.projectId
    });
    console.log("Firebase Admin initialized for Firestore");
  }
} catch (e) {
  console.error("Firebase Admin initialization failed:", e);
}

// Initialize Supabase Client (for Storage)
const supabaseUrl = process.env.VITE_SUPABASE_URL || `https://itunfoomufsovryiizht.supabase.co`;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: any = null;
if (supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log("Supabase client initialized for storage");
}

const upload = multer({ storage: multer.memoryStorage() });

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// API routes
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    supabaseInitialized: !!supabase,
    firebaseProjectId: firebaseConfig.projectId
  });
});

// --- LinkedIn Real OAuth 2.0 Endpoints ---
const getBaseAppUrl = (req: express.Request) => {
  const host = req.get("host") || "localhost:3000";
  const protocol = req.get("x-forwarded-proto") || (req.secure ? "https" : "http");
  return `${protocol}://${host}`;
};

// Check if LinkedIn OAuth environment variables are configured
app.get("/api/auth/linkedin/status", (req, res) => {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const clientOrigin = getBaseAppUrl(req);
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${clientOrigin}/api/auth/linkedin/callback`;

  res.json({
    configured: Boolean(clientId && clientSecret),
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
    redirectUri: redirectUri,
    environmentExample: {
      LINKEDIN_CLIENT_ID: clientId ? "Configured" : "Missing",
      LINKEDIN_CLIENT_SECRET: clientSecret ? "Configured" : "Missing",
      LINKEDIN_REDIRECT_URI: redirectUri
    }
  });
});

// 1. Initiate Real LinkedIn OAuth 2.0 Authorization Code Flow
app.get("/api/auth/linkedin/start", (req, res) => {
  const eventId = (req.query.eventId as string) || "";
  const clientOrigin = (req.query.origin as string) || getBaseAppUrl(req);
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${clientOrigin}/api/auth/linkedin/callback`;

  if (!clientId) {
    // If LINKEDIN_CLIENT_ID is not configured, present a clear configuration guide page
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LinkedIn OAuth Configuration Required</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-[#0a0a0a] text-white font-sans antialiased min-h-screen flex items-center justify-center p-6">
        <div class="max-w-xl w-full bg-[#141414] border border-neutral-800 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div class="flex items-center gap-3 pb-4 border-b border-neutral-800">
            <div class="w-12 h-12 rounded-2xl bg-[#0A66C2]/15 border border-[#0A66C2]/30 flex items-center justify-center text-[#0A66C2]">
              <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
              </svg>
            </div>
            <div>
              <h1 class="text-xl font-bold text-white">LinkedIn Developer App Required</h1>
              <p class="text-xs text-neutral-400">Real OAuth 2.0 flow is waiting for API credentials</p>
            </div>
          </div>

          <div class="space-y-4 text-xs text-neutral-300">
            <p>To enable authentic LinkedIn Sign-In, please configure your LinkedIn Developer application credentials in environment settings:</p>

            <div class="space-y-2 bg-neutral-900 border border-neutral-800 p-4 rounded-2xl font-mono text-[11px]">
              <div class="text-neutral-500">// Environment Variables Required</div>
              <div><span class="text-orange-400">LINKEDIN_CLIENT_ID</span>=<span class="text-neutral-400">&lt;Your Client ID&gt;</span></div>
              <div><span class="text-orange-400">LINKEDIN_CLIENT_SECRET</span>=<span class="text-neutral-400">&lt;Your Client Secret&gt;</span></div>
              <div><span class="text-orange-400">LINKEDIN_REDIRECT_URI</span>=<span class="text-emerald-400">${redirectUri}</span></div>
            </div>

            <div class="space-y-2 bg-neutral-900/60 p-4 rounded-2xl border border-neutral-800">
              <span class="font-bold text-white block">Step-by-Step LinkedIn App Setup:</span>
              <ol class="list-decimal list-inside space-y-1 text-neutral-400">
                <li>Go to <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer" class="text-[#0A66C2] underline font-bold">LinkedIn Developer Portal</a></li>
                <li>Create a new app and link your LinkedIn Company Page</li>
                <li>Under <strong>Products</strong>, add <em>Sign In with LinkedIn using OpenID Connect</em></li>
                <li>Under <strong>Auth</strong>, add this exact Redirect URL:</li>
              </ol>
              <div class="bg-black p-2.5 rounded-xl font-mono text-[11px] text-emerald-400 border border-neutral-800 break-all select-all mt-2">
                ${redirectUri}
              </div>
            </div>
          </div>

          <div class="pt-2">
            <button onclick="window.close()" class="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer">
              Close Window
            </button>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  // Construct official LinkedIn Authorization URL
  const state = JSON.stringify({ eventId, clientOrigin });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state,
    scope: "openid profile email",
  });

  // REDIRECT DIRECTLY TO OFFICIAL LINKEDIN OAUTH AUTHORIZATION URL
  const linkedinAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  return res.redirect(linkedinAuthUrl);
});

// 2. Real OAuth 2.0 Callback Handler
app.get("/api/auth/linkedin/callback", async (req, res) => {
  const code = req.query.code as string;
  const oauthError = req.query.error as string;
  const oauthErrorDesc = req.query.error_description as string;
  const rawState = req.query.state as string;

  let eventId = "";
  let clientOrigin = getBaseAppUrl(req);

  try {
    if (rawState) {
      const parsed = JSON.parse(rawState);
      eventId = parsed.eventId || "";
      clientOrigin = parsed.clientOrigin || clientOrigin;
    }
  } catch (e) {
    eventId = rawState || "";
  }

  // Handle OAuth errors or user cancellation on LinkedIn
  if (oauthError) {
    const errorMsg = oauthErrorDesc || oauthError || "LinkedIn authorization was cancelled or denied.";
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Authentication Cancelled</title></head>
        <body style="background:#0a0a0a; color:#fff; font-family:sans-serif; text-align:center; padding:40px;">
          <h3 style="color:#ef4444;">LinkedIn Authorization Error</h3>
          <p>${errorMsg}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: "LINKEDIN_OAUTH_ERROR",
                error: ${JSON.stringify(errorMsg)}
              }, "*");
              setTimeout(() => { window.close(); }, 2000);
            } else {
              setTimeout(() => { window.location.href = "${clientOrigin}/events/${eventId}"; }, 3000);
            }
          </script>
        </body>
      </html>
    `);
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${clientOrigin}/api/auth/linkedin/callback`;

  if (!code || !clientId || !clientSecret) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Authentication Failed</title></head>
        <body style="background:#0a0a0a; color:#fff; font-family:sans-serif; text-align:center; padding:40px;">
          <h3 style="color:#ef4444;">OAuth Configuration Missing</h3>
          <p>Authorization code or LinkedIn client credentials are invalid.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: "LINKEDIN_OAUTH_ERROR",
                error: "LinkedIn Client ID or Client Secret missing on server."
              }, "*");
              setTimeout(() => { window.close(); }, 2500);
            }
          </script>
        </body>
      </html>
    `);
  }

  try {
    // REAL Token Exchange with LinkedIn REST API
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error("LinkedIn Access Token exchange failed:", tokenJson);
      const errMsg = tokenJson.error_description || tokenJson.error || "Failed to exchange authorization code for access token.";
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Authentication Failed</title></head>
          <body style="background:#0a0a0a; color:#fff; font-family:sans-serif; text-align:center; padding:40px;">
            <h3 style="color:#ef4444;">LinkedIn Access Token Error</h3>
            <p>${errMsg}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: "LINKEDIN_OAUTH_ERROR",
                  error: ${JSON.stringify(errMsg)}
                }, "*");
                setTimeout(() => { window.close(); }, 2500);
              }
            </script>
          </body>
        </html>
      `);
    }

    // REAL Profile Retrieval from LinkedIn OpenID UserInfo endpoint
    const userinfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });

    if (!userinfoRes.ok) {
      const errText = await userinfoRes.text();
      console.error("LinkedIn Userinfo request failed:", errText);
      throw new Error("Failed to fetch profile information from LinkedIn userinfo endpoint.");
    }

    const userinfo = await userinfoRes.json();

    // Import ONLY data actually returned by LinkedIn
    const realProfile = {
      name: userinfo.name || `${userinfo.given_name || ""} ${userinfo.family_name || ""}`.trim() || "LinkedIn User",
      photo: userinfo.picture || "",
      linkedinUrl: userinfo.sub ? `https://www.linkedin.com/in/${userinfo.sub}` : "https://www.linkedin.com",
      email: userinfo.email || "",
    };

    const payloadJson = JSON.stringify(realProfile);

    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>LinkedIn Authentication Complete</title></head>
        <body style="background:#0a0a0a; color:#fff; font-family:sans-serif; text-align:center; padding:40px;">
          <h3 style="color:#10b981;">LinkedIn Authentication Successful!</h3>
          <p>Redirecting back to ZERO2ONE Events...</p>
          <script>
            const profile = ${payloadJson};
            const targetOrigin = "${clientOrigin}";
            
            if (window.opener) {
              window.opener.postMessage({
                type: "LINKEDIN_OAUTH_SUCCESS",
                profile: profile,
                eventId: "${eventId}"
              }, "*");
              setTimeout(() => { window.close(); }, 500);
            } else {
              const redirectTarget = "${clientOrigin}/events/${eventId}?linkedin_auth=success&profile=" + encodeURIComponent(JSON.stringify(profile));
              window.location.href = redirectTarget;
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("LinkedIn OAuth handler error:", err);
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Authentication Error</title></head>
        <body style="background:#0a0a0a; color:#fff; font-family:sans-serif; text-align:center; padding:40px;">
          <h3 style="color:#ef4444;">Authentication Error</h3>
          <p>${err.message || "An error occurred during LinkedIn authentication."}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: "LINKEDIN_OAUTH_ERROR",
                error: ${JSON.stringify(err.message || "Authentication error.")}
              }, "*");
              setTimeout(() => { window.close(); }, 2500);
            }
          </script>
        </body>
      </html>
    `);
  }
});


app.post("/api/upload", upload.single("file"), async (req, res) => {
  console.log("POST /api/upload - Supabase Flow");
  
  try {
    if (!supabase) {
      throw new Error("Supabase is not configured. Please add SUPABASE_SERVICE_ROLE_KEY to environment variables.");
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { path: storagePath } = req.body;
    if (!storagePath) {
      return res.status(400).json({ error: "No storage path provided" });
    }
    
    // Supabase bucket name is 'resources'
    // storagePath expected: resources/branch/sem/...
    const bucketName = 'resources';
    const cleanPath = storagePath.startsWith('resources/') 
      ? storagePath.replace('resources/', '') 
      : storagePath;

    console.log(`Uploading to Supabase: bucket=${bucketName}, path=${cleanPath}`);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(cleanPath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (error) {
      console.error("Supabase Storage Error:", error);
      return res.status(500).json({ 
        error: "Supabase Upload Failed", 
        message: error.message,
        action: "Make sure you have created a PUBLIC bucket named 'resources' in your Supabase dashboard."
      });
    }

    // Get public URL
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(cleanPath);

    console.log("Upload successful! Public URL:", publicUrl);
    res.json({ url: publicUrl });

  } catch (error: any) {
    console.error("Comprehensive upload failure:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// AI Syllabus PDF Extractor Endpoint using Gemini 3.5 Flash
app.post("/api/parse-syllabus-pdf", async (req, res) => {
  console.log("POST /api/parse-syllabus-pdf - Gemini AI Extractions");
  try {
    const { department, semester, fileName = "B Tech Curriculum_copy.pdf" } = req.body;
    if (!department || !semester) {
      return res.status(400).json({ error: "Missing required parameters: 'department' and 'semester' keys are required." });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(400).json({ 
        error: "Missing GEMINI_API_KEY", 
        message: "Gemini API key is not configured inside the environment. Please configure it in AI Studio Secrets." 
      });
    }

    // Locate PDF file in workspace
    const pdfPath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ 
        error: `File not found: ${fileName}`, 
        message: `Syllabus source file '${fileName}' was not found in the workspace root. Please make sure the file is uploaded correctly.`
      });
    }

    console.log(`Reading syllabus file: ${pdfPath} for branch=[${department}], sem=[${semester}]`);
    
    // Read and encode the PDF to Base64
    const fileBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = fileBuffer.toString("base64");

    const pdfPart = {
      inlineData: {
        data: pdfBase64,
        mimeType: "application/pdf"
      }
    };

    // Instantiate GoogleGenAI with headers for telemetry
    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const systemPrompt = `You are an elite academic curriculum analyst helper. Your goal is to extract specific syllabus tables, course listings, course outcomes, and module-by-module descriptions for a given department and semester from the provided B.Tech PDF.`;

    const promptText = `
    Find all academic courses/subjects belonging to the department: "${department}" during Semester: ${semester}.
    Note: if this is Semester 1 or Semester 2 and you cannot find department-specific listings, please check for standard, common first-year subjects (like Engineering Physics, Chemistry, Calculus, Programming in C, Elements of CSE, etc.) that would typically belong to Semester ${semester} for engineering depts.

    For EACH course/subject belonging to this semester and department combination:
    1. subjectCode: Derive or lookup its alphanumeric code (e.g. "EMI1101", "EMA1102"). If not clear, generate a reasonable code starting with department-related prefixes.
    2. subjectName: Full official name of the subject (e.g. "Programming for Problem Solving using C", "Linear Algebra and Calculus").
    3. credits: Total credits (e.g. 4, 3, 2, 1).
    4. theoryCredits: Typically portion of credits (e.g. 3).
    5. labCredits: Lab portion (e.g. 1 if it has a lab, 0 otherwise).
    6. type: Course classification. Must be values like: "BS" (Basic Science), "ES" (Engineering Science), "HS" (Humanities/Social Science), "PC" (Professional Core), "PE" (Professional Elective), "OE" (Open Elective).
    7. outcomes: An array of exactly 3 to 5 clear student learning outcomes extracted from the PDF or generated based on standard university templates (e.g., ["Acquire programming concepts", "Formulate computational steps for math queries."]).
    8. units: An array of exactly 5 elements corresponding structure-wise to: "UNIT I", "UNIT II", "UNIT III", "UNIT IV", and "UNIT V".
       Each unit must be an object with:
       - "title": A comprehensive title starting with "UNIT I: ...", "UNIT II: ...", etc.
       - "content": A paragraph description summarizing the core topics, structures, and tools taught in that unit.

    Ensure that you return valid, parsed JSON ONLY. Ensure the response format is exactly a JSON array of objects following the exact keys specified: subjectCode, subjectName, credits, theoryCredits, labCredits, type, outcomes, units.
    `;

    console.log("Calling Gemini API...");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [pdfPart, { text: promptText }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json"
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Empty response received from the Gemini API model");
    }

    console.log("Gemini extraction complete! Parsing JSON...");
    
    // Clean any markdown formatting if present
    let cleanJson = textOutput.trim();
    if (cleanJson.startsWith("```json")) {
      cleanJson = cleanJson.substring(7);
    }
    if (cleanJson.endsWith("```")) {
      cleanJson = cleanJson.substring(0, cleanJson.length - 3);
    }
    cleanJson = cleanJson.trim();

    try {
      const parsedSyllabus = JSON.parse(cleanJson);
      console.log(`Successfully parsed ${parsedSyllabus.length} subjects from PDF!`);
      res.json({ success: true, subjects: parsedSyllabus });
    } catch (parseErr) {
      console.error("Failed to parse Gemini output as JSON. Raw output was:", textOutput);
      res.status(500).json({ 
        error: "JSON Parsing Failed", 
        message: "The AI generated the information but it could not be parsed into a structured array. Please try again.",
        rawOutput: textOutput
      });
    }

  } catch (error: any) {
    console.error("Syllabus parsing comprehensive endpoint failure:", error);
    res.status(550).json({ error: error.message || "Internal Server Error" });
  }
});

// Global error handler for JSON responses
app.use((err: any, req: any, res: any, next: any) => {
  console.error("EXPRESS ERROR:", err);
  res.status(err.status || 500).json({ 
    error: "Internal Server Error", 
    message: err.message 
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`READY - Server running on http://localhost:${PORT}`);
  });
}

startServer();
