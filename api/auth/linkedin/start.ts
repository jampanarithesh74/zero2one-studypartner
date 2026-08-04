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
  const eventId = (req.query?.eventId as string) || "";
  const clientOrigin = (req.query?.origin as string) || getBaseAppUrl(req);
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${clientOrigin}/api/auth/linkedin/callback`;

  if (!clientId) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LinkedIn OAuth Configuration Required</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-[#0a0a0a] text-white font-sans antialiased min-h-screen flex items-center justify-center p-6">
        <div class="max-w-xl w-full bg-[#141414] border border-neutral-800 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div class="flex items-center gap-3 pb-4 border-b border-neutral-800">
            <div class="w-12 h-12 rounded-2xl bg-[#0A66C2]/15 border border-[#0A66C2]/30 flex items-center justify-center text-[#0A66C2]">
              <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
              </svg>
            </div>
            <div>
              <h1 class="text-xl font-bold text-white">LinkedIn Developer App Required</h1>
              <p class="text-xs text-neutral-400">Real OAuth 2.0 flow is waiting for API credentials</p>
            </div>
          </div>

          <div class="space-y-4 text-xs text-neutral-300">
            <p>To enable authentic LinkedIn Sign-In, please configure your LinkedIn Developer application credentials in environment settings:</p>

            <div class="space-y-2 bg-neutral-900 border border-neutral-800 p-4 rounded-2xl font-mono text-[11px]">
              <div class="text-neutral-500">// Environment Variables Required</div>
              <div><span class="text-orange-400">LINKEDIN_CLIENT_ID</span>=<span class="text-neutral-400">&lt;Your Client ID&gt;</span></div>
              <div><span class="text-orange-400">LINKEDIN_CLIENT_SECRET</span>=<span class="text-neutral-400">&lt;Your Client Secret&gt;</span></div>
              <div><span class="text-orange-400">LINKEDIN_REDIRECT_URI</span>=<span class="text-emerald-400">${redirectUri}</span></div>
            </div>

            <div class="space-y-2 bg-neutral-900/60 p-4 rounded-2xl border border-neutral-800">
              <span class="font-bold text-white block">Step-by-Step LinkedIn App Setup:</span>
              <ol class="list-decimal list-inside space-y-1 text-neutral-400">
                <li>Go to <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer" class="text-[#0A66C2] underline font-bold">LinkedIn Developer Portal</a></li>
                <li>Create a new app and link your LinkedIn Company Page</li>
                <li>Under <strong>Products</strong>, add <em>Sign In with LinkedIn using OpenID Connect</em></li>
                <li>Under <strong>Auth</strong>, add this exact Redirect URL:</li>
              </ol>
              <div class="bg-black p-2.5 rounded-xl font-mono text-[11px] text-emerald-400 border border-neutral-800 break-all select-all mt-2">
                ${redirectUri}
              </div>
            </div>
          </div>

          <div class="pt-2">
            <button onclick="window.close()" class="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer">
              Close Window
            </button>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  const state = JSON.stringify({ eventId, clientOrigin });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state,
    scope: "openid profile email",
  });

  const linkedinAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  return res.redirect(linkedinAuthUrl);
}
