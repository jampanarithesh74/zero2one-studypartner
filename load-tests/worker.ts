import { getLoadTestFirebase } from "./config.js";
import { VirtualUser } from "./virtual-user.js";
import { 
  WorkerInitPayload, 
  WorkerToParentMessage, 
  ParentToWorkerMessage 
} from "./types.js";

let virtualUsers: VirtualUser[] = [];
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
  const { startUserIndex, userCount, eventId, burstWindowMs, rampUpMs } = payload;

  const stepIntervalMs = userCount > 1 ? Math.floor(rampUpMs / userCount) : 0;

  let joinedCount = 0;

  for (let i = 0; i < userCount; i++) {
    const userIndex = startUserIndex + i;
    const userId = String(userIndex).padStart(4, "0");

    const vUser = new VirtualUser(db, {
      userId,
      index: userIndex,
      eventId,
      burstWindowMs
    });

    virtualUsers.push(vUser);

    const success = await vUser.join();
    if (success) {
      vUser.startListeners();
      joinedCount++;
    }

    if (stepIntervalMs > 0 && i < userCount - 1) {
      await new Promise((r) => setTimeout(r, stepIntervalMs));
    }
  }

  sendMessage({
    type: "READY",
    workerId,
    joinedCount
  });

  // Start periodic progress reporting
  const progressInterval = setInterval(() => {
    const activeCount = virtualUsers.filter((u) => u.stats.joined).length;
    const answersSuccessful = virtualUsers.reduce((sum, u) => sum + u.stats.answersSuccessful, 0);
    const answersFailed = virtualUsers.reduce((sum, u) => sum + u.stats.answersFailed, 0);

    sendMessage({
      type: "PROGRESS",
      workerId,
      joinedCount: activeCount,
      answersSuccessful,
      answersFailed
    });
  }, 2000);

  // Store interval on process so we can clear it on stop
  (process as any)._progressInterval = progressInterval;
}

function handleStop() {
  if ((process as any)._progressInterval) {
    clearInterval((process as any)._progressInterval);
  }

  const allStats = virtualUsers.map((u) => {
    const stats = { ...u.stats };
    u.stop();
    return stats;
  });

  sendMessage({
    type: "STATS",
    workerId,
    stats: allStats
  });

  // Small timeout before exiting so process.send completes
  setTimeout(() => {
    process.exit(0);
  }, 200);
}
