import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY NOT found!");
    return;
  }
  
  const pdfPath = path.join(process.cwd(), "B Tech Curriculum_copy.pdf");
  if (!fs.existsSync(pdfPath)) {
    console.error("PDF not found!");
    return;
  }

  const pdfBase64 = fs.readFileSync(pdfPath).toString("base64");
  const ai = new GoogleGenAI({ apiKey });

  console.log("Analyzing PDF structure with Gemini...");
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: pdfBase64,
            mimeType: "application/pdf"
          }
        },
        {
          text: `Please examine this B.Tech curriculum PDF. Provide a high-level summary of:
          1. Which departments/branches are covered in this document?
          2. Which academic regulations (e.g. R22, R24) are referenced?
          3. How many semesters of syllabus are actually described for each major branch (e.g., Computer Science, Information Technology, AI&ML, Mechanical, etc.)?
          Keep it brief and bulleted.`
        }
      ]
    });

    console.log("=== PDF SUMMARY ===");
    console.log(response.text);
    console.log("===================");
  } catch (err: any) {
    console.error("Gemini query error:", err);
  }
}

run();
