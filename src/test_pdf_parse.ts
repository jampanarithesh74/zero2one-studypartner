import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

async function run() {
  console.log("pdf-parse constructor type:", typeof pdf.PDFParse);
  if (pdf.PDFParse) {
    try {
      console.log("PDFParse class prototype keys:", Object.getOwnPropertyNames(pdf.PDFParse.prototype));
    } catch (e) {
      console.log("Could not inspect prototype:", e);
    }
  }
}

run();
