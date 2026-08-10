import { 
  collection, 
  getDocs, 
  writeBatch, 
  doc 
} from "firebase/firestore";
import { getLoadTestFirebase, parseAndValidateEnv } from "./config.js";

async function runCleanup() {
  const envConfig = parseAndValidateEnv();
  const { db } = getLoadTestFirebase();

  console.log("\n==================================================");
  console.log("🧹 ZERO2ONE LOAD TEST DATA CLEANUP");
  console.log(`Target Event ID: ${envConfig.eventId}`);
  console.log("Target Prefix:   LOADTEST-");
  console.log("==================================================\n");

  let totalDeleted = 0;

  // Collection 1: Participants
  const participantsRef = collection(db, "events", envConfig.eventId, "participants");
  const pSnap = await getDocs(participantsRef);
  const participantDocsToDelete: string[] = [];
  pSnap.forEach((docSnap) => {
    if (docSnap.id.startsWith("LOADTEST") || docSnap.data()?.name?.startsWith("LOADTEST")) {
      participantDocsToDelete.push(docSnap.id);
    }
  });

  console.log(`Found ${participantDocsToDelete.length} test participant documents to clean.`);
  totalDeleted += await batchDeleteDocs(db, `events/${envConfig.eventId}/participants`, participantDocsToDelete);

  // Collection 2: Quiz Responses
  const responsesRef = collection(db, "events", envConfig.eventId, "activities", "quiz", "responses");
  const rSnap = await getDocs(responsesRef);
  const responseDocsToDelete: string[] = [];
  rSnap.forEach((docSnap) => {
    if (docSnap.id.startsWith("LOADTEST") || docSnap.data()?.participantName?.startsWith("LOADTEST")) {
      responseDocsToDelete.push(docSnap.id);
    }
  });

  console.log(`Found ${responseDocsToDelete.length} test response documents to clean.`);
  totalDeleted += await batchDeleteDocs(db, `events/${envConfig.eventId}/activities/quiz/responses`, responseDocsToDelete);

  // Collection 3: Quiz Leaderboard
  const leaderboardRef = collection(db, "events", envConfig.eventId, "activities", "quiz", "leaderboard");
  const lSnap = await getDocs(leaderboardRef);
  const lbDocsToDelete: string[] = [];
  lSnap.forEach((docSnap) => {
    if (docSnap.id.startsWith("LOADTEST") || docSnap.data()?.participantName?.startsWith("LOADTEST")) {
      lbDocsToDelete.push(docSnap.id);
    }
  });

  console.log(`Found ${lbDocsToDelete.length} test leaderboard documents to clean.`);
  totalDeleted += await batchDeleteDocs(db, `events/${envConfig.eventId}/activities/quiz/leaderboard`, lbDocsToDelete);

  console.log(`\n✅ Cleanup complete. Total test documents deleted: ${totalDeleted}\n`);
  process.exit(0);
}

async function batchDeleteDocs(db: any, basePath: string, docIds: string[]): Promise<number> {
  if (docIds.length === 0) return 0;
  const BATCH_SIZE = 400;
  let deletedCount = 0;

  for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
    const chunk = docIds.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((id) => {
      const ref = doc(db, `${basePath}/${id}`);
      batch.delete(ref);
    });

    await batch.commit();
    deletedCount += chunk.length;
    console.log(`  Deleted batch of ${chunk.length} docs from ${basePath}`);
  }

  return deletedCount;
}

runCleanup().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
