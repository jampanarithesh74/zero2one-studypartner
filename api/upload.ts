import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { path: storagePath, fileBase64, contentType } = req.body || {};

  if (!fileBase64) {
    return res.status(400).json({ error: "Missing file payload (fileBase64 required)" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // If Supabase is configured, upload to Supabase Storage
  if (supabaseUrl && supabaseServiceKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const buffer = Buffer.from(fileBase64, "base64");
      const bucketName = "resources";
      const cleanPath = storagePath?.startsWith("resources/")
        ? storagePath.replace("resources/", "")
        : storagePath || `file-${Date.now()}`;

      const { error } = await supabase.storage.from(bucketName).upload(cleanPath, buffer, {
        contentType: contentType || "application/octet-stream",
        upsert: true,
      });

      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(cleanPath);
        return res.status(200).json({ url: publicUrl });
      }
      console.warn("Supabase upload error, falling back to data URL:", error.message);
    } catch (err: any) {
      console.warn("Supabase upload exception, falling back to data URL:", err.message);
    }
  }

  // Fallback: Return Base64 Data URL directly so file upload works without Supabase
  const mime = contentType || "application/pdf";
  const dataUrl = `data:${mime};base64,${fileBase64}`;
  return res.status(200).json({ url: dataUrl });
}

