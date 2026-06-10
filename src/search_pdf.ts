import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

async function run() {
  const pdfPath = path.join(process.cwd(), "B Tech Curriculum_copy.pdf");
  const dataBuffer = fs.readFileSync(pdfPath);
  
  const parser = new PDFParse({ data: dataBuffer });
  console.log("Successfully created PDFParse instance. Building index...");
  
  const total = 1585;
  const keywords = [
    "Artificial Intelligence",
    "Computer Science and Engineering",
    "Information Technology",
    "CSE (Data Science)",
    "CSE (Cyber Security)",
    "Electrical & Electronics Engineering",
    "Electronics & Communication Engineering",
    "Civil Engineering",
    "Mechanical Engineering"
  ];
  
  const results: { page: number; matches: string[]; sample: string }[] = [];
  
  // Read in chunks of 50 pages in parallel to be extremely fast and efficient
  const chunkSize = 50;
  for (let i = 1; i <= total; i += chunkSize) {
    const end = Math.min(i + chunkSize - 1, total);
    const pages = Array.from({ length: end - i + 1 }, (_, index) => i + index);
    
    // Fetch in parallel
    const contents = await Promise.all(
      pages.map(async (p) => {
        try {
          const res = await parser.getText({ partial: [p] });
          const text = res.text || "";
          
          const found: string[] = [];
          keywords.forEach((keyword) => {
            if (text.toLowerCase().includes(keyword.toLowerCase())) {
              found.push(keyword);
            }
          });
          
          if (found.length > 0) {
            return { page: p, matches: found, sample: text.substring(0, 150).replace(/\s+/g, " ") };
          }
        } catch (e) {
          // ignore page errors
        }
        return null;
      })
    );
    
    contents.forEach((c) => {
      if (c) results.push(c);
    });
    
    console.log(`Indexed up to page ${end}/${total}... Found matches on ${results.length} pages.`);
  }
  
  fs.writeFileSync("pdf_index.json", JSON.stringify(results, null, 2));
  console.log("Completed index serialization to 'pdf_index.json'");
  
  await parser.destroy();
}

run();
