import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

async function test() {
  console.log("Checking PDF size and Gemini API Key...");
  const pdfPath = path.join(process.cwd(), "B Tech Curriculum_copy.pdf");
  if (!fs.existsSync(pdfPath)) {
    console.error("PDF file NOT found!");
    return;
  }
  const stats = fs.statSync(pdfPath);
  console.log(`PDF size: ${stats.size} bytes`);

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error("GEMINI_API_KEY is not defined in environment variables!");
    return;
  }
  console.log("Gemini API Key is present. Initializing SDK...");

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Hello, reply with 'Gemini OK' if you hear me."
    });
    console.log("Response:", response.text);
  } catch (err: any) {
    console.error("Gemini Error:", err);
  }
}

test();
