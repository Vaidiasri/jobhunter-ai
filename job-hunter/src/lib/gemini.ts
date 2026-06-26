import Groq from "groq-sdk";
import { getOrCreateSettings } from "./settings";

function getClient() {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY env var is required");
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

const RETRYABLE = new Set([429, 500]);
const DELAYS = [1000, 2000, 4000];

export async function generateWithResume(prompt: string): Promise<string> {
  const settings = await getOrCreateSettings();

  if (!settings.resumeText?.trim()) {
    throw new Error("RESUME_MISSING");
  }

  const content = `RESUME:\n${settings.resumeText}\n\n${prompt}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const completion = await getClient().chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content }],
        temperature: 0.7,
        max_tokens: 4096,
      });
      return completion.choices[0]?.message?.content ?? "";
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      if (attempt < 2 && status && RETRYABLE.has(status)) {
        await new Promise((r) => setTimeout(r, DELAYS[attempt]));
        continue;
      }
      break;
    }
  }

  throw lastError;
}
