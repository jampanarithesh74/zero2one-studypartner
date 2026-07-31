import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBaseAppUrl } from "../../../lib/linkedin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = (req.query?.code as string) || "";
  const oauthError = (req.query?.error as string) || "";
  const oauthErrorDesc = (req.query?.error_description as string) || "";
  const rawState = (req.query?.state as string) || "";

  let eventId = "";
  let clientOrigin = getBaseAppUrl(req);

  try {
    if (rawState) {
      const parsed = JSON.parse(rawState);
      eventId = parsed.eventId || "";
      clientOrigin = parsed.clientOrigin || clientOrigin;
    }
  } catch (e) {
    eventId = rawState || "";
  }

  if (oauthError) {
    const errorMsg = oauthErrorDesc || oauthError || "LinkedIn authorization was cancelled or denied.";
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Authentication Cancelled</title></head>
        <body style="background:#0a0a0a; color:#fff; font-family:sans-serif; text-align:center; padding:40px;">
          <h3 style="color:#ef4444;">LinkedIn Authorization Error</h3>
          <p>${errorMsg}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: "LINKEDIN_OAUTH_ERROR",
                error: ${JSON.stringify(errorMsg)}
              }, "*");
              setTimeout(() => { window.close(); }, 2000);
            } else {
              setTimeout(() => { window.location.href = "${clientOrigin}/events/${eventId}"; }, 3000);
            }
          </script>
        </body>
      </html>
    `);
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${clientOrigin}/api/auth/linkedin/callback`;

  if (!code || !clientId || !clientSecret) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Authentication Failed</title></head>
        <body style="background:#0a0a0a; color:#fff; font-family:sans-serif; text-align:center; padding:40px;">
          <h3 style="color:#ef4444;">OAuth Configuration Missing</h3>
          <p>Authorization code or LinkedIn client credentials are invalid.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: "LINKEDIN_OAUTH_ERROR",
                error: "LinkedIn Client ID or Client Secret missing on server."
              }, "*");
              setTimeout(() => { window.close(); }, 2500);
            }
          </script>
        </body>
      </html>
    `);
  }

  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error("LinkedIn Access Token exchange failed:", tokenJson);
      const errMsg = tokenJson.error_description || tokenJson.error || "Failed to exchange authorization code for access token.";
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Authentication Failed</title></head>
          <body style="background:#0a0a0a; color:#fff; font-family:sans-serif; text-align:center; padding:40px;">
            <h3 style="color:#ef4444;">LinkedIn Access Token Error</h3>
            <p>${errMsg}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: "LINKEDIN_OAUTH_ERROR",
                  error: ${JSON.stringify(errMsg)}
                }, "*");
                setTimeout(() => { window.close(); }, 2500);
              }
            </script>
          </body>
        </html>
      `);
    }

    const userinfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });

    if (!userinfoRes.ok) {
      const errText = await userinfoRes.text();
      console.error("LinkedIn Userinfo request failed:", errText);
      throw new Error("Failed to fetch profile information from LinkedIn userinfo endpoint.");
    }

    const userinfo = await userinfoRes.json();

    const realProfile = {
      name: userinfo.name || `${userinfo.given_name || ""} ${userinfo.family_name || ""}`.trim() || "LinkedIn User",
      photo: userinfo.picture || "",
      linkedinUrl: userinfo.sub ? `https://www.linkedin.com/in/${userinfo.sub}` : "https://www.linkedin.com",
      email: userinfo.email || "",
    };

    const payloadJson = JSON.stringify(realProfile);

    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>LinkedIn Authentication Complete</title></head>
        <body style="background:#0a0a0a; color:#fff; font-family:sans-serif; text-align:center; padding:40px;">
          <h3 style="color:#10b981;">LinkedIn Authentication Successful!</h3>
          <p>Redirecting back to ZERO2ONE Events...</p>
          <script>
            const profile = ${payloadJson};
            if (window.opener) {
              window.opener.postMessage({
                type: "LINKEDIN_OAUTH_SUCCESS",
                profile: profile,
                eventId: "${eventId}"
              }, "*");
              setTimeout(() => { window.close(); }, 500);
            } else {
              const redirectTarget = "${clientOrigin}/events/${eventId}?linkedin_auth=success&profile=" + encodeURIComponent(JSON.stringify(profile));
              window.location.href = redirectTarget;
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("LinkedIn OAuth handler error:", err);
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Authentication Error</title></head>
        <body style="background:#0a0a0a; color:#fff; font-family:sans-serif; text-align:center; padding:40px;">
          <h3 style="color:#ef4444;">Authentication Error</h3>
          <p>${err.message || "An error occurred during LinkedIn authentication."}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: "LINKEDIN_OAUTH_ERROR",
                error: ${JSON.stringify(err.message || "Authentication error.")}
              }, "*");
              setTimeout(() => { window.close(); }, 2500);
            }
          </script>
        </body>
      </html>
    `);
  }
}
