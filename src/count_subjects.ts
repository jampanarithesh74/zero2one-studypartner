import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

async function run() {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log("Fetching subjects from Firestore...");
  const subjectsSnap = await getDocs(collection(db, "subjects"));
  console.log("Total dynamic subjects in Firestore:", subjectsSnap.size);

  const sampleDocs = subjectsSnap.docs.slice(0, 10);
  console.log("--- SAMPLE SUBJECTS IN FIRESTORE ---");
  sampleDocs.forEach(d => {
    const data = d.data();
    console.log(`- Code: ${data.subjectCode}, Name: ${data.subjectName}, Sem: ${data.semester}, Depts: ${data.linked_departments}`);
  });

  const resourcesSnap = await getDocs(collection(db, "resources"));
  console.log("\nTotal dynamic resources in Firestore:", resourcesSnap.size);
  const sampleRes = resourcesSnap.docs.slice(0, 15);
  console.log("--- SAMPLE RESOURCES IN FIRESTORE ---");
  sampleRes.forEach(d => {
    const data = d.data();
    console.log(`- Type: ${data.type}, Title: ${data.title}, Subject: ${data.subjectCode}`);
  });
}

run();
