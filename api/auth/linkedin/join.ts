import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "fs";
import path from "path";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { verifyOAuthTicket } from "./token";

// Lazy-initialize client SDK for server-side trusted writes
let dbInstance: any = null;
function getFirestoreInstance() {
  if (dbInstance) return dbInstance;

  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  let config: any = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch (e) {
      console.error("Failed to read firebase-applet-config.json:", e);
    }
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  dbInstance = getFirestore(app);
  return dbInstance;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { eventId, authTicket } = req.body || {};

  if (!eventId || typeof eventId !== "string") {
    return res.status(400).json({ error: "Missing or invalid eventId" });
  }

  if (!authTicket || typeof authTicket !== "string") {
    return res.status(400).json({ error: "Missing or invalid authTicket" });
  }

  // Cryptographically verify ticket issued by our server-side OAuth callback
  const verifiedPayload = verifyOAuthTicket(authTicket);
  if (!verifiedPayload) {
    return res.status(401).json({
      error: "Invalid or expired LinkedIn authentication ticket. Please sign in again.",
    });
  }

  if (verifiedPayload.eventId !== eventId) {
    return res.status(400).json({
      error: "Authentication ticket does not match this event room.",
    });
  }

  try {
    const rawSub = verifiedPayload.sub || "";
    const safeSub = rawSub.replace(/[^a-zA-Z0-9_-]/g, "");
    const participantId = `lp_${safeSub || Date.now().toString()}`;

    const cleanName = verifiedPayload.name.trim() || "LinkedIn Member";
    const cleanCompany = verifiedPayload.company.trim() || "Anurag University";
    const cleanHeadline = verifiedPayload.headline.trim() || "Participant";
    const cleanPhoto = (verifiedPayload.photo || "").trim();
    const cleanUrl = (verifiedPayload.linkedinUrl || "").trim();

    const participantDoc = {
      id: participantId,
      eventId: eventId,
      linkedinSub: rawSub,
      name: cleanName,
      nameLower: cleanName.toLowerCase(),
      photo: cleanPhoto,
      headline: cleanHeadline,
      company: cleanCompany,
      companyLower: cleanCompany.toLowerCase(),
      linkedinUrl: cleanUrl,
      joinedAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    };

    // Write directly to Firestore
    const db = getFirestoreInstance();
    const participantRef = doc(db, "events", eventId, "linkedin_participants", participantId);
    await setDoc(participantRef, participantDoc, { merge: true });

    return res.status(200).json({
      success: true,
      participant: {
        ...participantDoc,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      },
    });
  } catch (err: any) {
    console.error("Error creating participant document in Firestore:", err);
    return res.status(500).json({
      error: "Failed to join LinkedIn Connect Room. " + (err.message || ""),
    });
  }
}
