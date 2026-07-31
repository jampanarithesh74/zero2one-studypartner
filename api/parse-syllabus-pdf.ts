import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { department, semester, fileName = "B Tech Curriculum_copy.pdf" } = req.body || {};
    if (!department || !semester) {
      return res.status(400).json({ error: "Missing required parameters: 'department' and 'semester' keys are required." });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(400).json({
        error: "Missing GEMINI_API_KEY",
        message: "Gemini API key is not configured in environment variables."
      });
    }

    const pdfPath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({
        error: `File not found: ${fileName}`,
        message: `Syllabus source file '${fileName}' was not found.`
      });
    }

    const fileBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = fileBuffer.toString("base64");

    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
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
    7. outcomes: An array of exactly 3 to 5 clear student learning outcomes extracted from the PDF or generated based on standard university templates.
    8. units: An array of exactly 5 elements corresponding structure-wise to: "UNIT I", "UNIT II", "UNIT III", "UNIT IV", and "UNIT V".
       Each unit must be an object with:
       - "title": A comprehensive title starting with "UNIT I: ...", "UNIT II: ...", etc.
       - "content": A paragraph description summarizing the core topics, structures, and tools taught in that unit.

    Ensure that you return valid, parsed JSON ONLY. Ensure the response format is exactly a JSON array of objects following the exact keys specified: subjectCode, subjectName, credits, theoryCredits, labCredits, type, outcomes, units.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ inlineData: { data: pdfBase64, mimeType: "application/pdf" } }, { text: promptText }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json"
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Empty response received from the Gemini API model");
    }

    let cleanJson = textOutput.trim();
    if (cleanJson.startsWith("```json")) {
      cleanJson = cleanJson.substring(7);
    }
    if (cleanJson.endsWith("```")) {
      cleanJson = cleanJson.substring(0, cleanJson.length - 3);
    }
    cleanJson = cleanJson.trim();

    const parsedSyllabus = JSON.parse(cleanJson);
    return res.status(200).json({ success: true, subjects: parsedSyllabus });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
