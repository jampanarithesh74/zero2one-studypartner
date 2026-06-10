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
