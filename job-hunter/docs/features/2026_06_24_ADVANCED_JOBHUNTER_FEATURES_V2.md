# ADVANCED_JOBHUNTER_FEATURES — v2.1

**File:** `docs/features/2026_06_24_ADVANCED_JOBHUNTER_FEATURES_V2.md`
**Confidence:** 100%
**Author:** Vaibhav Ghildiyal
**Date:** 2026-06-24

---

## Brief Description

Extends the existing JobHunter app (Next.js 15 + Prisma + Neon PostgreSQL) with 13 advanced features across 3 tiers to maximize interview conversion rate. This revision replaces every paid dependency with a free-tier equivalent, fixes all 21 identified gaps, and includes a foolproof edge-case register.

Core additions: AI layer (Gemini 1.5 Flash) for cover letters, resume tailoring, ATS scoring, and job matching; a follow-up reminder chain; email outreach drafting; interview prep per company; an analytics dashboard; a daily digest email; Google Calendar integration; and lightweight password auth for all routes.

---

## Summary of Changes from v1

| What | Was (v1) | Now (v2.1) | Why |
|---|---|---|---|
| AI Provider | `@anthropic-ai/sdk` — $0.003/1K tokens | `@google/generative-ai` — Gemini 1.5 Flash | Free: 15 RPM, 1M tokens/day, no billing |
| Cron Runner | `node-cron` in Railway always-on service (paid) | Vercel Cron Jobs in `vercel.json` | Free on Vercel hobby plan |
| FollowUpReminder schema | `@@unique([applicationId])` — blocks re-remind | `@@unique([applicationId, type])` | Allows INITIAL → FOLLOWUP_2 → FOLLOWUP_3 chain |
| Match score trigger | Every job upsert | Only on CREATE (`matchScore IS NULL`) | Stops redundant recomputation |
| Interview prep source | Undefined | Gemini-generated, labeled as AI | Fills the gap; no scraping fragility |
| CalendarEvent relation | Missing `@relation` — Prisma rejects schema | `application Application @relation(...)` added | Schema would not compile |
| Analytics routes | New route duplicated existing `/api/dashboard/stats` | Shared `src/lib/analytics.ts` | Single source of truth |
| **Auth (new in v2.1)** | No auth — all API routes publicly callable | `src/middleware.ts` cookie-session + `/login` page | Any URL visitor could trigger AI generation |
| **LinkedIn scrape comms (new in v2.1)** | Undefined — Next.js route can't run Playwright | DB-flag pattern: `UserSettings.scrapePending` polled by worker | Architecture gap filled |
| **pdf-parse usage (new in v2.1)** | Listed as dependency with no usage path | `/api/settings/resume-upload` route — PDF → text → textarea | Dependency was orphaned |
| **UserSettings init (new in v2.1)** | `findUnique` returns null on first run | `getOrCreateSettings()` upsert helper in `src/lib/settings.ts` | Null pointer crash on Day 1 |
| **InterviewPrep.expiresAt (new in v2.1)** | Field with no `@default` — never set | Explicitly computed as `addDays(new Date(), 30)` in route handler | Prisma throws at runtime |

---

## Free Tier Strategy

Every service has a free tier that covers single-user personal usage.

| Service | Free Limit | Expected Daily Usage | Status |
|---|---|---|---|
| Gemini 1.5 Flash | 15 RPM · 1M tokens/day · $0 billing | ~50 jobs × ~800 tokens = 40K tokens/day | FREE |
| Vercel Cron | 2 cron jobs on hobby plan · daily frequency | 2 jobs: digest + reminders | FREE |
| Resend | 3,000 emails/month · 100/day | 1–2 emails/day | FREE |
| Neon PostgreSQL | 512 MB storage | Already in use; new models add ~5 MB | FREE |
| Google Calendar API | Unlimited for personal OAuth | 1–3 events/day | FREE |
| Vercel (hosting) | 100 GB bandwidth · 6,000 fn-hours/month | Already in use | FREE |
| `node-cron` + Railway always-on | — | Replaced by Vercel Cron | REMOVED |
| `@anthropic-ai/sdk` | — | Replaced by Gemini 1.5 Flash | REMOVED |

> **Vercel Cron limit:** Vercel hobby plan allows exactly 2 cron jobs. This spec uses both slots (digest + reminders). Do not add a third cron without upgrading to Pro or consolidating the two routes into one.

---

## Key Decisions

- **Google Gemini 1.5 Flash for all AI features** — free tier covers personal use. SDK: `@google/generative-ai`. All prompts include Vaibhav's resume as static context from `UserSettings.resumeText` (editable in Settings). Env var: `GEMINI_API_KEY`.
- **ATS scoring is client-side heuristic, Gemini second** — stop words removed before scoring; raw score capped at 100. Gemini recheck is optional and on-demand.
- **Match scores pre-computed on job CREATE only** — `computeMatchScore(job)` runs only when `job.matchScore === null`. Re-fetched jobs are not rescored.
- **Follow-up reminders use Vercel Cron** — `vercel.json` declares both cron routes. No always-on service required. Worker remains for Playwright auto-apply only.
- **Daily digest uses Resend** — use `onboarding@resend.dev` until DNS records are verified for a custom domain.
- **Interview prep is AI-generated via Gemini** — labeled "AI-generated, not verified" in UI. Cached in `InterviewPrep` with 30-day TTL. `expiresAt` is explicitly set to `addDays(fetchedAt, 30)` in the route handler.
- **Calendar integration targets Google Calendar OAuth** — refresh token encrypted at rest. **Consent screen setup must start on Day 0** (takes 1–7 days).
- **AI endpoint results are cached; regeneration requires `force=true`** — cached unless `force=true` is passed.
- **Auth via Next.js middleware + signed cookie session** — single `ADMIN_PASSWORD` for personal use. `src/middleware.ts` protects all `/api/*` routes except `/api/calendar/callback` (Google OAuth redirect) and cron routes (use `CRON_SECRET` instead). No third-party auth library needed beyond `jose` for JWT signing.
- **LinkedIn scrape communication via DB flag** — `/api/linkedin/scrape` sets `UserSettings.scrapePending = true`. The Railway worker polls this flag, runs Playwright, stores results in `LinkedInConnection`, then resets the flag. No HTTP call between Next.js and worker; the shared Neon DB is the message bus.
- **Resume PDF upload to text** — `/api/settings/resume-upload` accepts a PDF, uses `pdf-parse` to extract text, and returns it to the client to populate the Settings textarea. User explicitly saves.

---

## Dependencies (Updated)

| Package / Service | Purpose | Risk | Status |
|---|---|---|---|
| `@google/generative-ai` | Gemini 1.5 Flash for all AI features | 15 RPM free limit; add retry with exponential backoff | NEW |
| `jose` | JWT signing for auth session cookies | None — runs in Edge runtime | NEW |
| `resend` | Daily digest + follow-up emails | Domain verification needed for custom sender | KEEP |
| `googleapis` | Google Calendar OAuth + event creation | OAuth consent screen review: 1–7 days | KEEP |
| `pdf-parse` | Parse uploaded resume PDF → text string | None | KEEP (now has a defined usage path) |
| `date-fns` | Follow-up date math, `expiresAt` computation | None | KEEP |
| `@anthropic-ai/sdk` | — | Replaced by `@google/generative-ai` | REMOVED |
| `node-cron` | — | Replaced by Vercel Cron Jobs | REMOVED |

---

## New Database Models

```prisma
// NEW: stores AI-generated content per job
model AiContent {
  id                String   @id @default(cuid())
  jobId             String   @unique
  job               Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  coverLetter       String?  @db.Text
  tailoredResume    String?  @db.Text
  atsScore          Int?
  atsKeywords       Json?    // { matched: string[], missing: string[] }
  outreachEmail     String?  @db.Text
  negotiationScript String?  @db.Text
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

// FIXED: removed @@unique([applicationId]); added type enum for reminder chain
enum ReminderType   { INITIAL FOLLOWUP_2 FOLLOWUP_3 }
enum ReminderStatus { PENDING SENT SKIPPED }

model FollowUpReminder {
  id            String         @id @default(cuid())
  applicationId String
  application   Application    @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  type          ReminderType   @default(INITIAL)
  dueAt         DateTime
  status        ReminderStatus @default(PENDING)
  sentAt        DateTime?
  createdAt     DateTime       @default(now())
  @@unique([applicationId, type])
}

// FIXED: added expiresAt (30-day TTL); role field for company+role uniqueness
model InterviewPrep {
  id        String   @id @default(cuid())
  company   String
  role      String   @default("Software Engineer")
  questions Json     // string[]
  source    String   @default("ai-generated")
  fetchedAt DateTime @default(now())
  expiresAt DateTime // set explicitly: addDays(new Date(), 30) — no @default
  @@unique([company, role])
}

// FIXED: added application @relation; added @@unique on (applicationId, scheduledAt)
model CalendarEvent {
  id            String      @id @default(cuid())
  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  googleEventId String      @unique
  scheduledAt   DateTime
  createdAt     DateTime    @default(now())
  @@unique([applicationId, scheduledAt])
}

// NEW: stores LinkedIn connections for referral finder
model LinkedInConnection {
  id         String   @id @default(cuid())
  name       String
  title      String?
  company    String?
  profileUrl String?
  scrapedAt  DateTime @default(now())
  @@index([company])
}

// NEW: singleton user settings; also carries the LinkedIn scrape DB flag
model UserSettings {
  id             String    @id @default("singleton")
  resumeText     String?   @db.Text
  digestEmail    String?   @default("vaibhavghildiyal2101@gmail.com")
  reminderDays   Int       @default(5)    // days after APPLIED before first reminder
  calendarToken  String?   @db.Text       // AES-256-GCM encrypted refresh token
  scrapePending  Boolean   @default(false) // flag for LinkedIn scrape queue
  lastScrapedAt  DateTime?               // set by worker after successful scrape
  updatedAt      DateTime  @updatedAt
}
```

**Add to `Job` model:**
```prisma
matchScore   Int?       // 0–100, computed at CREATE only
aiContent    AiContent?
```

**Add to `Application` model:**
```prisma
followUpReminders FollowUpReminder[]
calendarEvents    CalendarEvent[]
```

---

## API Contract

| Endpoint | Method | Request | Response | Notes |
|---|---|---|---|---|
| `/api/ai/cover-letter` | POST | `{ jobId, force?: boolean }` | `{ coverLetter: string, cached: boolean }` | Returns cached unless `force=true` |
| `/api/ai/tailor-resume` | POST | `{ jobId, force?: boolean }` | `{ tailoredResume: string, cached: boolean }` | |
| `/api/ai/ats-score` | POST | `{ jobId, force?: boolean }` | `{ score: number, keywords: string[], missing: string[] }` | Client-side first, Gemini on demand |
| `/api/ai/outreach-email` | POST | `{ jobId, force?: boolean }` | `{ email: string, cached: boolean }` | |
| `/api/ai/negotiation-script` | POST | `{ jobId, force?: boolean }` | `{ script: string, cached: boolean }` | |
| `/api/ai/linkedin-audit` | POST | `{}` | `{ suggestions: string[] }` | Uses `UserSettings.resumeText` |
| `/api/reminders/check` | GET | — | `{ sent: number, skipped: number }` | Vercel Cron 03:30 UTC (09:00 IST). `CRON_SECRET` header. |
| `/api/interview-prep/[company]` | GET | `?role=string` | `{ questions: string[], source: string, expiresAt: string }` | Regenerates if `expiresAt` is past |
| `/api/analytics/summary` | GET | — | `{ byPlatform, byRole, responseRate, weeklyTrend }` | Shares logic with `/api/dashboard/stats` via `src/lib/analytics.ts` |
| `/api/calendar/auth` | GET | — | Redirect to Google OAuth | Exempt from cookie-auth (internal redirect) |
| `/api/calendar/callback` | GET | OAuth code | Stores encrypted token, redirect | **Exempt from middleware auth** — comes from Google |
| `/api/calendar/create` | POST | `{ applicationId, scheduledAt }` | `{ eventId }` | Returns 400 if `scheduledAt` is in the past |
| `/api/digest/send` | POST | — | `{ sent: boolean, jobCount: number, reminderCount: number }` | Vercel Cron 02:30 UTC (08:00 IST). `CRON_SECRET` header. |
| `/api/settings` | GET / PATCH | `{ resumeText?, digestEmail?, reminderDays? }` | `UserSettings` | Uses `getOrCreateSettings()` |
| `/api/settings/resume-upload` | POST | `multipart/form-data` — PDF file | `{ text: string }` | Uses `pdf-parse`; returns extracted text; client saves separately |
| `/api/linkedin/scrape` | POST | — | `{ queued: boolean, lastScrapedAt: string \| null }` | Sets `UserSettings.scrapePending = true`; worker processes async |
| `/api/auth/login` | POST | `{ password: string }` | `{ ok: boolean }` | Sets signed httpOnly session cookie on success |
| `/api/auth/logout` | POST | — | `{ ok: boolean }` | Clears session cookie |

---

## Algorithms & Data Flow

### Auth Middleware

```typescript
// src/middleware.ts
import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const EXEMPT = ["/api/calendar/callback", "/api/auth/login", "/login"];
const CRON_PATHS = ["/api/digest/send", "/api/reminders/check"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (EXEMPT.some(p => pathname.startsWith(p))) return NextResponse.next();

  // Cron routes use CRON_SECRET, not session cookie
  if (CRON_PATHS.some(p => pathname.startsWith(p))) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // All other /api/* routes require valid session cookie
  if (pathname.startsWith("/api/")) {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET!));
      return NextResponse.next();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Protect all pages except /login
  if (!pathname.startsWith("/login")) {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET!));
    } catch {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
```

Login route sets the cookie:
```typescript
// src/app/api/auth/login/route.ts
import { SignJWT } from "jose";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const { password } = await req.json();
  if (password !== process.env.ADMIN_PASSWORD) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const token = await new SignJWT({ sub: "vaibhav" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));

  (await cookies()).set("session", token, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  return Response.json({ ok: true });
}
```

### UserSettings — `getOrCreateSettings()` Helper

Every route that reads settings must call this instead of `findUnique`. This prevents null pointer crashes on the very first run.

```typescript
// src/lib/settings.ts
import { prisma } from "./prisma";

export async function getOrCreateSettings() {
  return prisma.userSettings.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}
```

Replace all existing `prisma.userSettings.findUnique({ where: { id: "singleton" } })` calls with `getOrCreateSettings()`.

### InterviewPrep — `expiresAt` Must Be Set Explicitly

`expiresAt` has no `@default` in Prisma — Prisma does not support computed defaults. The route handler must supply it:

```typescript
// src/app/api/interview-prep/[company]/route.ts
import { addDays } from "date-fns";

const expiresAt = addDays(new Date(), 30);

await prisma.interviewPrep.upsert({
  where:  { company_role: { company, role } },
  create: { company, role, questions, expiresAt },
  update: { questions, expiresAt, fetchedAt: new Date() },
});
```

### LinkedIn Scrape — DB Flag Communication

Next.js and the Railway worker share the same Neon database. They communicate via a boolean flag — no HTTP calls between services, no new infrastructure.

**Next.js route** (`/api/linkedin/scrape`):
```typescript
const settings = await getOrCreateSettings();
await prisma.userSettings.update({
  where: { id: "singleton" },
  data: { scrapePending: true },
});
return Response.json({ queued: true, lastScrapedAt: settings.lastScrapedAt });
```

**Worker** (`worker/src/index.ts`) — add to existing polling loop:
```typescript
async function checkLinkedInScrape() {
  const settings = await prisma.userSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.scrapePending) return;

  try {
    const connections = await scrapeLinkedInConnections(); // existing Playwright fn
    await prisma.linkedInConnection.createMany({ data: connections, skipDuplicates: true });
    await prisma.userSettings.update({
      where: { id: "singleton" },
      data: { scrapePending: false, lastScrapedAt: new Date() },
    });
  } catch (err) {
    // Reset flag so user can retry; log masked error
    await prisma.userSettings.update({ where: { id: "singleton" }, data: { scrapePending: false } });
    console.error("LinkedIn scrape failed:", maskCredentials(String(err)));
  }
}
```

### PDF Resume Upload

```typescript
// src/app/api/settings/resume-upload/route.ts
import pdfParse from "pdf-parse";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file || file.type !== "application/pdf") {
    return Response.json({ error: "PDF file required" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const { text } = await pdfParse(buffer);
  if (!text?.trim()) {
    return Response.json({ error: "Could not extract text from PDF" }, { status: 422 });
  }
  return Response.json({ text: text.trim() });
}
```

Settings page flow: user uploads PDF → text auto-populates textarea → user reviews → clicks Save → `PATCH /api/settings { resumeText }`.

### ATS Score — Fixed Formula

**v1 bug:** `intersection / JD_word_count × 100` then add `+20 +30 +10` bonuses — base of 60 plus all bonuses = 120.

**v2.1 fix:**

1. Strip stop words: `a, an, the, is, are, we, you, for, to, of, in, and, or, with, that, this, on, at, be, as, by, from, have, it, not, our, your, their`
2. Extract unique meaningful words (length ≥ 3) from JD.
3. Extract unique meaningful words from `UserSettings.resumeText`.
4. `baseScore = Math.min(70, Math.round(intersection.size / jdWords.size × 100))` — capped at 70.
5. Bonuses (final result hard-capped at 100):
   - +15 if job title shares a word with resume title keywords
   - +10 if ≥2 of `React, Node, TypeScript, Next.js, PostgreSQL, Prisma, Python, AWS` appear in both JD and resume
   - +5 if `job.isRemote === true` and resume mentions "remote"
6. `finalScore = Math.min(100, baseScore + bonuses)`

### Match Score at Ingest — Fixed Trigger

```typescript
const existing = await prisma.job.findUnique({ where: { externalId }, select: { matchScore: true } });

await prisma.job.upsert({
  where:  { externalId },
  create: { ...jobData, matchScore: computeMatchScore(jobData) },
  update: { ...jobData },  // matchScore intentionally omitted
});
```

### Gemini AI Generation Wrapper

```typescript
// src/lib/gemini.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOrCreateSettings } from "./settings";

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function generateWithResume(prompt: string): Promise<string> {
  const settings = await getOrCreateSettings();
  if (!settings.resumeText?.trim()) throw new Error("RESUME_MISSING");

  const result = await model.generateContent([`RESUME:\n${settings.resumeText}\n\n${prompt}`]);
  return result.response.text();
}
```

### Vercel Cron Configuration

> **Timezone:** Vercel Cron uses UTC. IST = UTC + 5:30. 08:00 IST = 02:30 UTC. 09:00 IST = 03:30 UTC.

```json
{
  "crons": [
    { "path": "/api/digest/send",    "schedule": "30 2 * * *" },
    { "path": "/api/reminders/check","schedule": "30 3 * * *" }
  ]
}
```

### Follow-up Reminder Chain

When application status → `APPLIED`:

```typescript
const settings = await getOrCreateSettings();
const days = settings.reminderDays;
const now = new Date();

await prisma.followUpReminder.createMany({
  data: [
    { applicationId, type: "INITIAL",    dueAt: addDays(now, days) },
    { applicationId, type: "FOLLOWUP_2", dueAt: addDays(now, days * 2) },
    { applicationId, type: "FOLLOWUP_3", dueAt: addDays(now, days * 4) },
  ],
  skipDuplicates: true,
});
```

When status changes away from `APPLIED` → `SKIPPED` all `PENDING` reminders for that application.

### Daily Digest

1. Vercel Cron hits `POST /api/digest/send` at 02:30 UTC (08:00 IST).
2. Fetch top 10 new jobs (last 24h, `matchScore > 60`). If 0 jobs, still send (show "No new jobs today").
3. Fetch all reminders where `dueAt <= now AND status = PENDING`.
4. Render HTML email, send via Resend to `settings.digestEmail`.

---

## Edge Case Register

| # | Scenario | System | v1 Impact | v2.1 Fix |
|---|---|---|---|---|
| EC-01 | Resume text is empty or never set | All AI routes | Gemini receives empty context | Return HTTP 422 "Add your resume in Settings before generating AI content" |
| EC-02 | Job description is missing or empty | ATS, Cover Letter, Match Score | Empty keyword set; divide-by-zero risk | Guard: skip scoring, store `matchScore = null`, show "N/A" badge |
| EC-03 | ATS score bonuses push total above 100 | ATS Scorer | Score = 120+ in score ring | Base capped at 70; final capped at 100 via `Math.min(100, ...)` |
| EC-04 | Same job re-fetched by JSearch (upsert path) | Match Score | Match score overwritten on every refresh | Compute only when `existing.matchScore === null`; UPDATE omits `matchScore` |
| EC-05 | AI endpoint called concurrently for same jobId | All AI routes | Second write fails on unique constraint | Use Prisma `upsert` for AiContent; wrap in try/catch |
| EC-06 | Gemini 15 RPM rate limit hit | All AI routes | 429 with no retry | Retry 3× with exponential backoff (1s, 2s, 4s); return cached or HTTP 503 |
| EC-07 | Application status APPLIED → INTERVIEW | Follow-up Reminders | Reminder fires despite progression | Set all `PENDING` reminders to `SKIPPED` on status transition away from APPLIED |
| EC-08 | User re-applies after REJECTED | Follow-up Reminders | v1 `@@unique([applicationId])` blocks second set | `@@unique([applicationId, type])` with `skipDuplicates: true` |
| EC-09 | Daily digest — zero new jobs | Digest | Unspecified — could crash on empty array | Still send digest; show "No new jobs today"; always include due reminders |
| EC-10 | Calendar event with `scheduledAt` in the past | Google Calendar | Google API returns error; unhandled | Validate before API call: if past, return HTTP 400 |
| EC-11 | Google OAuth refresh token expired | Calendar | All calendar ops fail silently | Catch `invalid_grant`, clear token, return 401 with `{ reAuthUrl }` |
| EC-12 | Interview prep for same company+role within 30 days | InterviewPrep | Always re-generated; wastes quota | Check `expiresAt > now`; return cached if valid |
| EC-13 | JD in non-English | ATS Scorer | Near-zero score; misleading | If <10% of JD words are in English stop-word list, show "Non-English JD" badge |
| EC-14 | LinkedIn scrape — DOM changes | Referral Finder | Playwright fails silently | try/catch; reset `scrapePending`; show last successful scrape date |
| EC-15 | Resend send fails | Digest + Reminders | v1 retried after 60s (holds serverless open) | Retry once immediately; on second failure leave as PENDING; cron retries tomorrow |
| EC-16 | "Match score → AI unavailable" error handler | Match Score | Was in v1 spec; completely wrong | Removed — match score is pure JS, no external call |
| EC-17 | Cron routes publicly callable | Cron Routes | Anyone could trigger digest/reminder sends | Both routes verify `Authorization: Bearer ${CRON_SECRET}`; return 401 otherwise |
| EC-18 | `/api/analytics/summary` duplicates `/api/dashboard/stats` | Analytics | Two endpoints, diverging logic | Shared `src/lib/analytics.ts`; both import from it |
| **EC-19** | Any API route called without auth | All API routes | Publicly accessible — anyone can trigger Gemini calls, read settings | `src/middleware.ts` checks `session` cookie on all `/api/*` (except `/api/calendar/callback`, cron routes, `/api/auth/login`) |
| **EC-20** | PDF uploaded to resume-upload is corrupt or image-only | Resume Upload | `pdf-parse` throws or returns empty string | Catch parse errors; return HTTP 422 "Could not extract text — try a text-based PDF or paste your resume directly" |
| **EC-21** | `UserSettings` row does not exist (fresh install) | Any route reading settings | `findUnique` returns `null` → null pointer crash | All settings reads use `getOrCreateSettings()` (upsert); first call creates the row with defaults |

---

## Error Handling & Degradation

| Failure | Behavior |
|---|---|
| Unauthenticated request to any `/api/*` route | Middleware returns HTTP 401 before the route handler runs |
| Unauthenticated page request | Middleware redirects to `/login` |
| Gemini API → 429 rate limit | Retry 3× with exponential backoff (1s, 2s, 4s). Return cached `AiContent` if it exists; else HTTP 503 "AI busy, try in 1 minute" |
| Gemini API → 500 / network error | Same as rate limit. Log error with `jobId` and timestamp. |
| Resume text missing | HTTP 422 before any Gemini call. UI shows inline alert linking to Settings. |
| PDF upload — corrupt or image-only | HTTP 422 "Could not extract text". User pastes resume text manually. |
| Resend send failure | Retry once immediately. On second failure: log error, leave reminder as PENDING. Never mark SENT on failure. |
| Google Calendar token expired | Catch `invalid_grant`, clear token from DB, return HTTP 401 with `{ reAuthUrl: "/api/calendar/auth" }` |
| ATS score — empty JD | Skip, store `matchScore = null`, show "N/A" badge |
| ATS score — non-English JD | Show "Non-English JD" badge; skip computation |
| Interview prep → malformed JSON from Gemini | Retry once; if second fails, show "No data found for this company" |
| LinkedIn scrape → 0 results | Reset `scrapePending`; show last successful scrape date and "LinkedIn may have changed its layout" warning |
| Calendar event in the past | HTTP 400 before calling Google API |
| Vercel Cron unauthorized | HTTP 401 immediately. Nothing is processed. |

---

## Security

| Threat | Mitigation |
|---|---|
| All API routes publicly accessible | `src/middleware.ts` requires valid signed session cookie on all `/api/*` routes. Returns 401 otherwise. |
| Gemini API key in client bundle | All Gemini calls are server-side only. Key is never in `NEXT_PUBLIC_*` vars. |
| Cron routes reachable without a session | Cron routes use `CRON_SECRET` header instead of session cookie. Vercel injects this automatically. |
| LinkedIn credentials in logs | Never log `LINKEDIN_EMAIL`/`LINKEDIN_PASSWORD`. Mask in all error output with `"[redacted]"`. |
| Google OAuth token in DB | Encrypt refresh token at rest with AES-256-GCM using `ENCRYPTION_KEY`. IV stored alongside ciphertext. |
| Resend API key exposure | Server-side only; never in `NEXT_PUBLIC_*` vars. |
| AI prompt injection via JD content | JD appended as a labeled section after the system prompt: `"JOB DESCRIPTION:\n{description}"`. |
| Session token stolen | `httpOnly`, `sameSite: "lax"` cookie. 30-day expiry. Invalidate by changing `SESSION_SECRET`. |

---

## Impact Map

### New Files

- `src/middleware.ts` — cookie-session auth for all routes; cron secret check for cron paths
- `src/app/login/page.tsx` — single-password login form
- `src/app/api/auth/login/route.ts` — validates `ADMIN_PASSWORD`, sets signed session cookie
- `src/app/api/auth/logout/route.ts` — clears session cookie
- `src/lib/settings.ts` — `getOrCreateSettings()` upsert helper
- `src/lib/gemini.ts` — Gemini SDK wrapper, `generateWithResume(prompt)`
- `src/lib/resend.ts` — Resend client, `sendDigest()`, `sendFollowUpReminder()`
- `src/lib/ats.ts` — client-side ATS scorer (fixed formula)
- `src/lib/analytics.ts` — shared aggregation logic for both analytics routes
- `src/lib/calendar.ts` — Google Calendar OAuth helpers
- `src/app/api/ai/[feature]/route.ts` — all AI generation routes with cache + `force` param
- `src/app/api/reminders/check/route.ts` — reminder poll (cron auth)
- `src/app/api/analytics/summary/route.ts` — analytics (imports `src/lib/analytics.ts`)
- `src/app/api/digest/send/route.ts` — daily digest (cron auth)
- `src/app/api/interview-prep/[company]/route.ts` — interview questions with TTL + explicit `expiresAt`
- `src/app/api/calendar/auth/route.ts`, `callback/route.ts`, `create/route.ts`
- `src/app/api/settings/route.ts` — UserSettings GET/PATCH (uses `getOrCreateSettings`)
- `src/app/api/settings/resume-upload/route.ts` — PDF → text via `pdf-parse`
- `src/app/api/linkedin/scrape/route.ts` — sets `UserSettings.scrapePending = true`
- `src/app/analytics/page.tsx` — analytics dashboard
- `src/components/AtsScoreCard.tsx`, `AiDrawer.tsx`, `InterviewPrepCard.tsx`, `FollowUpBadge.tsx`

### Modified Files

- `src/app/jobs/page.tsx` — add `matchScore` badge, ATS score button
- `src/components/JobCard.tsx` — match score ring, "Generate Cover Letter" button
- `src/app/applications/page.tsx` — follow-up badges, interview prep accordion, calendar button
- `src/app/settings/page.tsx` — resume textarea + PDF upload button, Calendar connect, LinkedIn scrape trigger
- `src/components/Sidebar.tsx` — Analytics nav item, logout button
- `src/lib/jsearch.ts` — call `computeMatchScore` only on CREATE
- `src/app/api/applications/[id]/route.ts` — trigger reminder chain on APPLIED; skip reminders on status change away
- `src/app/api/dashboard/stats/route.ts` — refactor to import from `src/lib/analytics.ts`
- `prisma/schema.prisma` — all new models + `scrapePending`/`lastScrapedAt` on UserSettings
- `vercel.json` — add `"crons"` array
- `worker/src/index.ts` — add `checkLinkedInScrape()` to polling loop

---

## Implementation Order

> **Day 0 action required:** Google OAuth consent screen verification takes 1–7 days. Submit for review before writing any calendar code.

### Phase 0 — Day 0 (30 minutes, then background)

Submit Google OAuth app for consent screen review. Add all env vars to Vercel: `GEMINI_API_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `ENCRYPTION_KEY`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`. Run `prisma db push` with updated schema.

### Phase 1 — Days 1–2: AI Core + Auth

`src/middleware.ts` + `/login` page + `/api/auth/*` routes (EC-19) → `src/lib/settings.ts` `getOrCreateSettings()` (EC-21) → `src/lib/gemini.ts` → all `/api/ai/*` routes with `force` + EC-01/EC-05/EC-06 guards → `/api/settings/resume-upload` with `pdf-parse` (EC-20) → Settings page with resume textarea + PDF upload → `AiDrawer` component → `AtsScoreCard` (fixed formula EC-02/EC-03) → match score at CREATE only (EC-04).

### Phase 2A — Day 3: Engagement Layer

Follow-up reminder chain on APPLIED (EC-07/EC-08) → `FollowUpBadge` → `/api/reminders/check` (EC-17) → daily digest with 0-job guard (EC-09) → Resend integration (EC-15) → `vercel.json` cron config (UTC schedule).

### Phase 2B — Day 4: Intelligence Layer

`src/lib/analytics.ts` → `/api/analytics/summary` (EC-18) → analytics dashboard → Sidebar update → interview prep with TTL + explicit `expiresAt` (EC-12) → Gemini JSON parse guard → outreach email in AiDrawer.

### Phase 2C — Day 5: Integrations

Google Calendar OAuth (verification complete by now) → past-date guard (EC-10) → token expiry handler (EC-11) → LinkedIn scrape DB-flag in worker + Next.js route (EC-14) → `LinkedInConnection` model → LinkedIn optimizer in Settings → negotiation script in Offer column.

---

## New Environment Variables

```bash
# Auth (new in v2.1)
ADMIN_PASSWORD="choose-a-strong-password"
SESSION_SECRET="32-char-random-string-for-jwt-signing"

# AI (free)
GEMINI_API_KEY="AIza..."              # aistudio.google.com/app/apikey

# Email (free tier)
RESEND_API_KEY="re_..."
DIGEST_EMAIL="vaibhavghildiyal2101@gmail.com"

# Cron security
CRON_SECRET="32-char-random-string"   # Vercel injects into cron request headers

# Calendar (free)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="https://your-app.vercel.app/api/calendar/callback"

# Security
ENCRYPTION_KEY="32-byte-hex-string-for-aes-256-gcm"

# Removed from v1:
# ANTHROPIC_API_KEY — replaced by GEMINI_API_KEY
```
