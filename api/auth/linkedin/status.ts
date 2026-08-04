import type { VercelRequest, VercelResponse } from "@vercel/node";

function getBaseAppUrl(req: any) {
  const host =
    req.headers?.["x-forwarded-host"] ||
    req.headers?.host ||
    (req.get && req.get("host")) ||
    "localhost:3000";

  const proto =
    req.headers?.["x-forwarded-proto"] ||
    (req.secure ? "https" : "http");

  return `${proto}://${host}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const clientOrigin = getBaseAppUrl(req);
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${clientOrigin}/api/auth/linkedin/callback`;

  return res.status(200).json({
    configured: Boolean(clientId && clientSecret),
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
    redirectUri: redirectUri,
    environmentExample: {
      LINKEDIN_CLIENT_ID: clientId ? "Configured" : "Missing",
      LINKEDIN_CLIENT_SECRET: clientSecret ? "Configured" : "Missing",
      LINKEDIN_REDIRECT_URI: redirectUri,
    },
  });
}
