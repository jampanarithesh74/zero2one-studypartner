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
  console.log("STEP 1: Callback received");

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
    console.error("LinkedIn OAuth authorization error received:", oauthError, oauthErrorDesc);
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
              }, "${clientOrigin}");
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
    console.error("Missing OAuth parameters or server configuration:", {
      hasCode: !!code,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret
    });
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
              }, "${clientOrigin}");
              setTimeout(() => { window.close(); }, 2500);
            }
          </script>
        </body>
      </html>
    `);
  }

  try {
    console.log("STEP 2: Exchanging authorization code");
    let tokenRes: Response;
    try {
      tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
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
    } catch (fetchErr: any) {
      console.error("Failed fetch call to LinkedIn access token endpoint:", fetchErr);
      throw new Error("Network error connecting to LinkedIn access token endpoint: " + (fetchErr.message || String(fetchErr)));
    }

    let tokenJson: any;
    try {
      tokenJson = await tokenRes.json();
    } catch (jsonErr: any) {
      console.error("Failed parsing access token response JSON:", jsonErr);
      throw new Error("Failed to parse JSON response from LinkedIn access token endpoint.");
    }

    console.log("TOKEN STATUS:", tokenRes.status);
    console.log("TOKEN RESPONSE:", tokenJson);

    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error("LinkedIn Access Token exchange failed. Full response body:", tokenJson);
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
                }, "${clientOrigin}");
                setTimeout(() => { window.close(); }, 2500);
              }
            </script>
          </body>
        </html>
      `);
    }

    console.log("STEP 3: Access token received");

    console.log("STEP 4: Fetching LinkedIn user profile");
    let userinfoRes: Response;
    try {
      userinfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
    } catch (fetchErr: any) {
      console.error("Failed fetch call to LinkedIn userinfo endpoint:", fetchErr);
      throw new Error("Network error connecting to LinkedIn userinfo endpoint: " + (fetchErr.message || String(fetchErr)));
    }

    const rawBody = await userinfoRes.text();
    console.log("USERINFO STATUS:", userinfoRes.status);
    console.log("USERINFO HEADERS:", Object.fromEntries(userinfoRes.headers.entries()));
    console.log("USERINFO BODY:", rawBody);

    if (!userinfoRes.ok) {
      console.error("LinkedIn Userinfo request failed. Complete raw response:", rawBody);
      const errMsg = `LinkedIn userinfo failed (Status ${userinfoRes.status}): ${rawBody}`;
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Authentication Failed</title></head>
          <body style="background:#0a0a0a; color:#fff; font-family:sans-serif; text-align:center; padding:40px;">
            <h3 style="color:#ef4444;">LinkedIn Userinfo Request Failed</h3>
            <p>${errMsg}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: "LINKEDIN_OAUTH_ERROR",
                  error: ${JSON.stringify(errMsg)}
                }, "${clientOrigin}");
                setTimeout(() => { window.close(); }, 2500);
              }
            </script>
          </body>
        </html>
      `);
    }

    let userinfo: any;
    try {
      userinfo = JSON.parse(rawBody);
    } catch (err) {
      throw new Error("LinkedIn returned invalid JSON: " + rawBody);
    }

    console.log("STEP 5: User profile received");

    const realProfile = {
      name: userinfo.name || `${userinfo.given_name || ""} ${userinfo.family_name || ""}`.trim() || "LinkedIn User",
      photo: userinfo.picture || "",
      linkedinUrl: userinfo.sub ? `https://www.linkedin.com/in/${userinfo.sub}` : "https://www.linkedin.com",
      email: userinfo.email || "",
    };

    const payloadJson = JSON.stringify(realProfile);

    console.log("STEP 6: Sending profile back to frontend");

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
              }, "${clientOrigin}");
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
              }, "${clientOrigin}");
              setTimeout(() => { window.close(); }, 2500);
            }
          </script>
        </body>
      </html>
    `);
  }
}
