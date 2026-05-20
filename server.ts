import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { initializeApp, getApps } from "firebase-admin/app";
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = 3000;

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
