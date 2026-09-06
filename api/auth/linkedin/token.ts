import crypto from "crypto";

export interface LinkedInVerifiedProfile {
  sub: string;
  linkedinSub?: string;
  name: string;
  photo: string;
  headline: string;
  company: string;
  linkedinUrl: string;
  email?: string;
}

export interface LinkedInAuthTicketPayload extends LinkedInVerifiedProfile {
  eventId: string;
  issuedAt: number;
  expiresAt: number;
}

function getSecret(): string {
  return (
    process.env.LINKEDIN_CLIENT_SECRET ||
    process.env.LINKEDIN_CLIENT_ID ||
    "zero2one_linkedin_connect_token_secret"
  );
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Creates a cryptographically signed auth ticket using HMAC-SHA256.
 * Valid for 20 minutes to allow user profile preview & confirmation.
 */
export function signOAuthTicket(
  profile: LinkedInVerifiedProfile,
  eventId: string
): string {
  const now = Date.now();
  const payload: LinkedInAuthTicketPayload = {
    ...profile,
    eventId,
    issuedAt: now,
    expiresAt: now + 20 * 60 * 1000, // 20 minutes expiry
  };

  const payloadStr = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(payloadStr);
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(encodedPayload)
    .digest("hex");

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies the cryptographically signed auth ticket.
 * Returns the trusted payload if valid and non-expired; null otherwise.
 */
export function verifyOAuthTicket(
  ticket: string
): LinkedInAuthTicketPayload | null {
  if (!ticket || typeof ticket !== "string") return null;

  const parts = ticket.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;

  try {
    const expectedSig = crypto
      .createHmac("sha256", getSecret())
      .update(encodedPayload)
      .digest("hex");

    // Use timingSafeEqual to guard against timing attacks
    const sigBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expectedSig, "hex");

    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payloadJson = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadJson) as LinkedInAuthTicketPayload;

    if (!payload || !payload.sub || !payload.eventId) return null;

    // Check expiration
    if (typeof payload.expiresAt === "number" && Date.now() > payload.expiresAt) {
      console.warn("LinkedIn OAuth ticket expired.");
      return null;
    }

    return payload;
  } catch (err) {
    console.error("Failed to verify LinkedIn OAuth ticket:", err);
    return null;
  }
}
