import { getLoadTestFirebase } from "../load-tests/config.js";
import { VirtualParticipant } from "./virtual-participant.js";
import { 
  WorkerInitPayload, 
  WorkerToParentMessage, 
  ParentToWorkerMessage 
} from "./types.js";

let virtualParticipants: VirtualParticipant[] = [];
let workerId = 0;

function sendMessage(msg: WorkerToParentMessage) {
  if (process.send) {
    process.send(msg);
  }
}

process.on("message", async (msg: ParentToWorkerMessage) => {
  if (msg.type === "START") {
    await handleStart(msg.payload);
  } else if (msg.type === "GET_STATS" || msg.type === "STOP") {
    handleStop();
  }
});

async function handleStart(payload: WorkerInitPayload) {
  workerId = payload.workerId;
  const { db } = getLoadTestFirebase();
  const { startUserIndex, userCount, eventId, baseUrl, burstWindowMs, rampUpMs, httpTimeoutMs } = payload;

  const stepIntervalMs = userCount > 1 ? Math.floor(rampUpMs / userCount) : 0;

  let joinedCount = 0;
  let pageSuccessCount = 0;
  let pageFailCount = 0;

  for (let i = 0; i < userCount; i++) {
    const userIndex = startUserIndex + i;
    const userId = String(userIndex).padStart(4, "0");

    const vParticipant = new VirtualParticipant(db, {
      userId,
      index: userIndex,
      eventId,
      baseUrl,
      burstWindowMs,
      httpTimeoutMs
    });

    virtualParticipants.push(vParticipant);

    // Phase 1: Vercel Page Delivery
    const pageRes = await vParticipant.fetchEventPage();
    if (pageRes.success) pageSuccessCount++;
    else pageFailCount++;

    // Phase 2: Firestore Participant Join
    const joined = await vParticipant.joinFirestoreRoom();
    if (joined) {
      vParticipant.startListeners(); // Phase 3
      joinedCount++;
    }

    if (stepIntervalMs > 0 && i < userCount - 1) {
      await new Promise((r) => setTimeout(r, stepIntervalMs));
    }
  }

  sendMessage({
    type: "READY",
    workerId,
    joinedCount,
    pageSuccessCount,
    pageFailCount
  });

  // Start periodic progress reporting
  const progressInterval = setInterval(() => {
    const activeCount = virtualParticipants.filter((p) => p.stats.joined).length;
    const answersSuccessful = virtualParticipants.reduce((sum, p) => sum + p.stats.answersSuccessful, 0);
    const answersFailed = virtualParticipants.reduce((sum, p) => sum + p.stats.answersFailed, 0);

    sendMessage({
      type: "PROGRESS",
      workerId,
      joinedCount: activeCount,
      answersSuccessful,
      answersFailed
    });
  }, 2000);

  (process as any)._progressInterval = progressInterval;
}

function handleStop() {
  if ((process as any)._progressInterval) {
    clearInterval((process as any)._progressInterval);
  }

  const allStats = virtualParticipants.map((p) => {
    const stats = { ...p.stats };
    p.stop();
    return stats;
  });

  sendMessage({
    type: "STATS",
    workerId,
    stats: allStats
  });

  setTimeout(() => {
    process.exit(0);
  }, 200);
}
