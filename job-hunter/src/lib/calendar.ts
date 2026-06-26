import { google } from "googleapis";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function getOAuthClient() {
  if (!process.env.GOOGLE_CLIENT_ID) throw new Error("GOOGLE_CLIENT_ID env var is required");
  if (!process.env.GOOGLE_CLIENT_SECRET) throw new Error("GOOGLE_CLIENT_SECRET env var is required");
  if (!process.env.GOOGLE_REDIRECT_URI) throw new Error("GOOGLE_REDIRECT_URI env var is required");
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function generateAuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

export async function exchangeCodeForTokens(code: string): Promise<{ refresh_token: string; access_token: string }> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token || !tokens.access_token) {
    throw new Error("No refresh_token returned — make sure prompt=consent was set");
  }
  return { refresh_token: tokens.refresh_token, access_token: tokens.access_token };
}

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  if (!process.env.ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY env var is required");
  return Buffer.from(process.env.ENCRYPTION_KEY, "hex");
}

export function encryptToken(token: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(encrypted: string): string {
  const key = getKey();
  const buf = Buffer.from(encrypted, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

export async function getAccessToken(encryptedRefreshToken: string): Promise<string> {
  const refreshToken = decryptToken(encryptedRefreshToken);
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) throw new Error("TOKEN_EXPIRED");
  return credentials.access_token;
}

export async function createCalendarEvent(
  encryptedToken: string,
  title: string,
  description: string,
  scheduledAt: Date
): Promise<{ googleEventId: string; htmlLink: string }> {
  const accessToken = await getAccessToken(encryptedToken);
  const client = getOAuthClient();
  client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: "v3", auth: client });
  const endTime = new Date(scheduledAt.getTime() + 60 * 60 * 1000); // +1 hour

  const event = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: title,
      description,
      start: { dateTime: scheduledAt.toISOString() },
      end: { dateTime: endTime.toISOString() },
    },
  });

  if (!event.data.id || !event.data.htmlLink) {
    throw new Error("Google Calendar did not return event ID");
  }

  return { googleEventId: event.data.id, htmlLink: event.data.htmlLink };
}
