import type { VercelRequest, VercelResponse } from "@vercel/node";
import fs from "fs";
import path from "path";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let firebaseProjectId = "";
  try {
    const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(firebaseConfigPath)) {
      const config = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
      firebaseProjectId = config.projectId || "";
    }
  } catch (e) {
    // Ignore error
  }

  return res.status(200).json({
    status: "ok",
    supabaseInitialized: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    firebaseProjectId,
  });
}
