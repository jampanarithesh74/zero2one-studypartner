import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

async function run() {
  const pdfPath = path.join(process.cwd(), "B Tech Curriculum_copy.pdf");
  if (!fs.existsSync(pdfPath)) {
    console.error("PDF not found!");
    return;
  }

  console.log("Loading PDF and extracting basic info...");
  const dataBuffer = fs.readFileSync(pdfPath);
  
  try {
    console.log("pdf-parse exports:", pdf);
    console.log("Keys of pdf:", Object.keys(pdf));
    // Let's find the correct function
    const parseFn = typeof pdf === "function" ? pdf : (pdf.default || pdf.parse || pdf);
    const options = {
      max: 10
    };
    const data = await parseFn(dataBuffer, options);
    console.log("PDF Pages Count (Total):", data.numpages);
    console.log("First 10 pages text sample:\n", data.text.substring(0, 1500));
  } catch (err: any) {
    console.error("Error reading PDF:", err);
  }
}

run();
