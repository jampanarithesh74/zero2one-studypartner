import {
  doc,
  collection,
  setDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export type ActivityType = "quiz" | "crossword" | "riddle";
export type ActivityStatus = "draft" | "ready" | "active" | "completed";

export interface EventActivity {
  id: string;
  activityId: string;
  eventId: string;
  type: ActivityType;
  title: string;
  description?: string;
  order: number;
  status: ActivityStatus;
  config?: Record<string, any>;
  createdAt?: any;
  updatedAt?: any;
}

export const ACTIVITY_METADATA: Record<
  ActivityType,
  { label: string; icon: string; defaultTitle: string; description: string }
> = {
  quiz: {
    label: "Quiz",
    icon: "🧠",
    defaultTitle: "Interactive Quiz",
    description: "Timed multiple-choice questions with speed bonuses and live scoring.",
  },
  crossword: {
    label: "Crossword",
    icon: "🧩",
    defaultTitle: "Interactive Crossword",
    description: "Word grid puzzle with synchronized clues and live cell validation.",
  },
  riddle: {
    label: "Riddles",
    icon: "❓",
    defaultTitle: "Engineering Riddles",
    description: "Engaging word puzzles with letter-by-letter clues and hints.",
  },
};

/**
 * Fetch all configured activities for an event.
 * Performs a single point query on `events/{eventId}/activities`.
 * Ignores non-activity documents (such as legacy `activeBroadcast`).
 */
export async function getEventActivities(eventId: string): Promise<EventActivity[]> {
  if (!eventId) return [];

  const activitiesCol = collection(db, "events", eventId, "activities");
  const snapshot = await getDocs(activitiesCol);

  const activities: EventActivity[] = [];

  snapshot.forEach((docSnap) => {
    // Ignore legacy or diagnostic documents like activeBroadcast or diagnostic_probe
    if (docSnap.id === "activeBroadcast" || docSnap.id === "diagnostic_probe") return;

    const data = docSnap.data();
    if (
      data &&
      (data.type === "quiz" || data.type === "crossword" || data.type === "riddle")
    ) {
      activities.push({
        id: docSnap.id,
        activityId: data.activityId || docSnap.id,
        eventId: data.eventId || eventId,
        type: data.type as ActivityType,
        title: data.title || ACTIVITY_METADATA[data.type as ActivityType]?.defaultTitle || "Activity",
        description: data.description || "",
        order: typeof data.order === "number" ? data.order : 1,
        status: (data.status as ActivityStatus) || "draft",
        config: data.config || {},
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    }
  });

  // Sort strictly by order ASC
  return activities.sort((a, b) => a.order - b.order);
}

/**
 * Create a new activity in draft status for an event.
 * Assigns next available order number (max + 1).
 */
export async function createEventActivity(
  eventId: string,
  type: ActivityType,
  customTitle?: string
): Promise<EventActivity> {
  if (!eventId) throw new Error("Event ID is required");

  // Read current activities to determine next order
  const existing = await getEventActivities(eventId);
  const maxOrder = existing.length > 0 ? Math.max(...existing.map((a) => a.order)) : 0;
  const nextOrder = maxOrder + 1;

  const meta = ACTIVITY_METADATA[type];
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const activityId = `act_${type}_${uniqueSuffix}`;

  const activityDocRef = doc(db, "events", eventId, "activities", activityId);

  const newActivity: EventActivity = {
    id: activityId,
    activityId,
    eventId,
    type,
    title: customTitle?.trim() || meta.defaultTitle,
    description: meta.description,
    order: nextOrder,
    status: "draft",
    config: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(activityDocRef, newActivity);
  return newActivity;
}

/**
 * Reorder activities for an event with dirty detection.
 * Compares current order against initial order and only writes changed documents
 * in an atomic batch.
 */
export async function saveActivitySequence(
  eventId: string,
  currentActivities: EventActivity[],
  initialActivities: EventActivity[]
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  if (!eventId) {
    return { success: false, updatedCount: 0, error: "Event ID is required" };
  }

  // Normalize order numbers 1..N based on current array positions
  const normalizedCurrent = currentActivities.map((act, index) => ({
    ...act,
    order: index + 1,
  }));

  // Create lookup map for initial orders
  const initialOrderMap = new Map<string, number>();
  initialActivities.forEach((act) => {
    initialOrderMap.set(act.id, act.order);
  });

  // Find activities whose order actually changed
  const changedActivities = normalizedCurrent.filter((act) => {
    const prevOrder = initialOrderMap.get(act.id);
    return prevOrder !== act.order;
  });

  if (changedActivities.length === 0) {
    return { success: true, updatedCount: 0 };
  }

  try {
    const batch = writeBatch(db);

    changedActivities.forEach((act) => {
      const docRef = doc(db, "events", eventId, "activities", act.id);
      batch.update(docRef, {
        order: act.order,
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    return { success: true, updatedCount: changedActivities.length };
  } catch (err: any) {
    console.error("Error saving activity sequence:", err);
    return {
      success: false,
      updatedCount: 0,
      error: err.message || "Failed to commit sequence order changes to database.",
    };
  }
}

/**
 * Legacy immediate reorder helper (kept for backward compatibility).
 * Applies a batch update to update `order` fields atomically.
 */
export async function updateActivityOrder(
  eventId: string,
  reorderedActivities: EventActivity[]
): Promise<void> {
  if (!eventId || reorderedActivities.length === 0) return;

  const batch = writeBatch(db);

  reorderedActivities.forEach((activity, index) => {
    const newOrder = index + 1;
    const docRef = doc(db, "events", eventId, "activities", activity.id);
    batch.update(docRef, {
      order: newOrder,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

/**
 * Delete a draft activity and re-normalize remaining order numbers.
 */
export async function deleteEventActivity(
  eventId: string,
  activityIdToDelete: string,
  currentActivities: EventActivity[]
): Promise<void> {
  if (!eventId || !activityIdToDelete) return;

  const batch = writeBatch(db);

  // 1. Delete target activity doc
  const targetDocRef = doc(db, "events", eventId, "activities", activityIdToDelete);
  batch.delete(targetDocRef);

  // 2. Re-sequence remaining activities
  const remaining = currentActivities.filter((a) => a.id !== activityIdToDelete);
  remaining.forEach((activity, index) => {
    const newOrder = index + 1;
    if (activity.order !== newOrder) {
      const docRef = doc(db, "events", eventId, "activities", activity.id);
      batch.update(docRef, {
        order: newOrder,
        updatedAt: serverTimestamp(),
      });
    }
  });

  await batch.commit();
}
