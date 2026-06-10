import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

async function run() {
  const pdfPath = path.join(process.cwd(), "B Tech Curriculum_copy.pdf");
  const dataBuffer = fs.readFileSync(pdfPath);
  
  try {
    const parser = new PDFParse({ data: dataBuffer });
    console.log("Successfully created PDFParse instance.");
    
    // Get info
    const info = await parser.getInfo();
    console.log("PDF Pages count:", info.total);

    // Get page 1 text
    const textRes = await parser.getText({ partial: [1] });
    console.log("Page 1 TEXT length:", textRes.text?.length);
    console.log("Page 1 text extract:\n", textRes.text?.substring(0, 500));

    await parser.destroy();
  } catch (err: any) {
    console.error("Error running parser:", err);
  }
}

run();
