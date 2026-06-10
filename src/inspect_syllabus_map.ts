import fs from "fs";
import { SYLLABUS_MAP, SUBJECT_DETAILS } from "./data/syllabus";

const allCodes = new Set<string>();
Object.entries(SYLLABUS_MAP).forEach(([dept, sems]) => {
  Object.entries(sems).forEach(([sem, subjects]) => {
    (subjects as any[]).forEach(sub => {
      if (sub.code) {
        allCodes.add(sub.code.toUpperCase().trim());
      }
    });
  });
});

console.log(`Total unique subject codes in SYLLABUS_MAP: ${allCodes.size}`);

const missingCodes: string[] = [];
allCodes.forEach(code => {
  if (!SUBJECT_DETAILS[code]) {
    missingCodes.push(code);
  }
});

console.log(`Of these, unique codes MISSING detailed entries in SUBJECT_DETAILS: ${missingCodes.length}`);
console.log("Missing codes sample:", missingCodes.slice(0, 20));
