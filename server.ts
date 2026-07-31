import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { initializeApp, getApps } from "firebase-admin/app";
import { createClient } from "@supabase/supabase-js";

// Import Vercel API Serverless Handlers
import healthHandler from "./api/health";
import linkedinStatusHandler from "./api/auth/linkedin/status";
import linkedinStartHandler from "./api/auth/linkedin/start";
import linkedinCallbackHandler from "./api/auth/linkedin/callback";
import uploadHandler from "./api/upload";
import parseSyllabusPdfHandler from "./api/parse-syllabus-pdf";

const app = express();
const PORT = 3000;

// Enable JSON body parsing
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

// Initialize Firebase Admin (for Firestore)
try {
  if (getApps().length === 0 && firebaseConfig.projectId) {
    initializeApp({
      projectId: firebaseConfig.projectId,
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

// Helper to adapt Vercel function to Express
const wrapVercelHandler = (handler: any) => async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    await handler(req, res);
  } catch (err) {
    next(err);
  }
};

// API Routes (Mounted using Vercel Serverless Handlers for 100% feature parity)
app.get("/api/health", wrapVercelHandler(healthHandler));

// LinkedIn OAuth Routes
app.get("/api/auth/linkedin/status", wrapVercelHandler(linkedinStatusHandler));
app.get("/api/auth/linkedin/start", wrapVercelHandler(linkedinStartHandler));
app.get("/api/auth/linkedin/callback", wrapVercelHandler(linkedinCallbackHandler));

// Supabase File Upload Route (Express handles multer file buffer conversion)
app.post("/api/upload", upload.single("file"), async (req, res, next) => {
  if (req.file) {
    req.body = req.body || {};
    req.body.fileBase64 = req.file.buffer.toString("base64");
    req.body.contentType = req.file.mimetype;
  }
  return wrapVercelHandler(uploadHandler)(req, res, next);
});

// Gemini AI Syllabus Extractor
app.post("/api/parse-syllabus-pdf", wrapVercelHandler(parseSyllabusPdfHandler));

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("EXPRESS ERROR:", err);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: err.message,
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
