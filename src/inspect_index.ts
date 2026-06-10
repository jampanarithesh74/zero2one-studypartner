import fs from "fs";

function run() {
  const index = JSON.parse(fs.readFileSync("pdf_index.json", "utf-8"));
  console.log(`Loaded index with ${index.length} matched pages.`);
  
  // Show first 30 matches with their pages and samples
  console.log("--- SAMPLE INDEX MATCHES (FIRST 30) ---");
  for (let i = 0; i < Math.min(30, index.length); i++) {
    const entry = index[i];
    console.log(`Page ${entry.page} [${entry.matches.join(", ")}]: ${entry.sample}`);
  }
}

run();
