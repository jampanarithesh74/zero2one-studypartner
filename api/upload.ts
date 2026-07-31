import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || `https://itunfoomufsovryiizht.supabase.co`;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    return res.status(500).json({ error: "Supabase Service Role Key missing" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { path: storagePath, fileBase64, contentType } = req.body || {};

    if (fileBase64 && storagePath) {
      const buffer = Buffer.from(fileBase64, "base64");
      const bucketName = "resources";
      const cleanPath = storagePath.startsWith("resources/")
        ? storagePath.replace("resources/", "")
        : storagePath;

      const { error } = await supabase.storage.from(bucketName).upload(cleanPath, buffer, {
        contentType: contentType || "application/octet-stream",
        upsert: true,
      });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(cleanPath);
      return res.status(200).json({ url: publicUrl });
    }

    return res.status(400).json({ error: "Missing file payload (fileBase64 and path required)" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Upload failed" });
  }
}
