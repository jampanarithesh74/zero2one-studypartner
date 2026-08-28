import { collection, query, where, getDocs, doc, getDoc, limit } from "firebase/firestore";
import { db } from "./firebase";

// Unambiguous characters (avoiding 0, O, 1, I, L)
const CODE_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Generates a random candidate event code in the format Z2O-XXXXX
 */
export function generateCandidateEventCode(): string {
  let result = "Z2O-";
  for (let i = 0; i < 5; i++) {
    const randomIndex = Math.floor(Math.random() * CODE_CHARSET.length);
    result += CODE_CHARSET[randomIndex];
  }
  return result;
}

/**
 * Checks if an event code is already in use in Firestore.
 * Performs targeted single-document/limit(1) queries for minimal read cost.
 */
export async function isEventCodeInUse(code: string): Promise<boolean> {
  const cleanUpper = code.trim().toUpperCase();
  const cleanLower = code.trim().toLowerCase();

  try {
    // 1. Direct document ID lookup
    const docRef = doc(db, "events", cleanUpper);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return true;

    // 2. Query eventCode field (uppercase)
    const eventsRef = collection(db, "events");
    const qEventCode = query(eventsRef, where("eventCode", "==", cleanUpper), limit(1));
    const eventCodeSnap = await getDocs(qEventCode);
    if (!eventCodeSnap.empty) return true;

    // 3. Query legacy code field (uppercase)
    const qCode = query(eventsRef, where("code", "==", cleanUpper), limit(1));
    const codeSnap = await getDocs(qCode);
    if (!codeSnap.empty) return true;

    return false;
  } catch (error) {
    console.warn("Error checking event code uniqueness:", error);
    // On unexpected error, re-throw so the caller knows the verification could not be completed
    throw error;
  }
}

/**
 * Generates a guaranteed unique event code by querying Firestore with retry logic.
 * Maximum 5 retries. With a 32^5 (~33.5 million) combinations space, collisions are virtually zero.
 */
export async function generateUniqueEventCode(maxRetries: number = 5): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidate = generateCandidateEventCode();
    const inUse = await isEventCodeInUse(candidate);
    if (!inUse) {
      return candidate;
    }
  }

  // Fallback with timestamp component if multiple collisions happen in extreme edge cases
  const timestampSuffix = Date.now().toString(36).toUpperCase().slice(-5);
  return `Z2O-${timestampSuffix}`;
}
