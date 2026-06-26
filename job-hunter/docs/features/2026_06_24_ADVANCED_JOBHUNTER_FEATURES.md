# ADVANCED_JOBHUNTER_FEATURES

**File:** `docs/features/2026_06_24_ADVANCED_JOBHUNTER_FEATURES.md`

---

## Brief Description

Extends the existing JobHunter app (Next.js 15 + Prisma + Neon PostgreSQL) with 13 advanced features across 3 tiers to maximize Vaibhav's interview conversion rate. The core additions are: an AI layer (Claude API) for cover letters, resume tailoring, ATS scoring, and job matching; a follow-up reminder engine; email outreach drafting; interview prep per company; an analytics dashboard; a daily digest email; and calendar integration. Each feature integrates into the existing job feed, Kanban tracker, and settings pages.

---

## Key Decisions

- **Claude API (`claude-sonnet-4-6`) for all AI features** — single provider, consistent quality, cheapest per-token for this use case. All prompts include Vaibhav's resume as static context (hardcoded, not user-uploaded per session).
- **ATS scoring is client-side heuristic first, AI second** — keyword overlap runs instantly in the browser; Claude recheck is optional and costs tokens only on demand.
- **Match scores are pre-computed on job fetch** — `Job.matchScore` is written at ingest time by calling Claude once per new job, not on every page load.
- **Follow-up reminders use a DB-polled cron job** — no external scheduler; a `/api/reminders/check` route is hit by a Railway cron every morning at 9 AM IST.
- **Daily digest uses Resend** — already referenced in Vaibhav's resume (DentWise project); free tier covers 100 emails/day.
- **Referral Finder is read-only LinkedIn scrape** — no LinkedIn API; Playwright reads the user's own LinkedIn connections page. Stores results in DB, not re-fetched unless user triggers it.
- **Calendar integration targets Google Calendar OAuth** — stores refresh token in DB; no third-party calendar SaaS needed.

---

## Dependencies (new)

| Package / Service | Purpose | Risk |
|---|---|---|
| `@anthropic-ai/sdk` | Claude API for all AI features | Rate limits on free tier; add retry logic |
| `resend` | Daily digest + follow-up emails | Domain verification needed for custom sender |
| `node-cron` | Cron jobs inside Railway worker | Must run in always-on Railway service, not Vercel |
| `googleapis` | Google Calendar OAuth + event creation | OAuth consent screen setup required |
| `pdf-parse` | Extract text from resume PDF for AI prompts | None |
| `date-fns` | Follow-up date math | None |

---

## New Database Models

```prisma
model AiContent {
  id           String   @id @default(cuid())
  jobId        String
  job          Job      @relation(fields: [jobId], references: [id])
  coverLetter  String?  @db.Text
  tailoredResume String? @db.Text
  atsScore     Int?
  matchScore   Int?
  outreachEmail String? @db.Text
  negotiationScript String? @db.Text
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@unique([jobId])
}

model FollowUpReminder {
  id          String   @id @default(cuid())
  applicationId String
  application Application @relation(fields: [applicationId], references: [id])
  dueAt       DateTime
  sent        Boolean  @default(false)
  sentAt      DateTime?
  createdAt   DateTime @default(now())
  @@unique([applicationId])
}

model InterviewPrep {
  id        String   @id @default(cuid())
  company   String   @unique
  questions Json     // string[]
  fetchedAt DateTime @default(now())
}

model CalendarEvent {
  id            String   @id @default(cuid())
  applicationId String
  googleEventId String
  scheduledAt   DateTime
  createdAt     DateTime @default(now())
}
```

Add to `Job` model:
```prisma
matchScore   Int?      // 0–100, computed at fetch time
aiContent    AiContent?
```

Add to `Application` model:
```prisma
followUp     FollowUpReminder?
calendarEvents CalendarEvent[]
```

---

## API Contract

| Endpoint | Method | Request | Response |
|---|---|---|---|
| `/api/ai/cover-letter` | POST | `{ jobId }` | `{ coverLetter: string }` |
| `/api/ai/tailor-resume` | POST | `{ jobId }` | `{ tailoredResume: string }` |
| `/api/ai/ats-score` | POST | `{ jobId }` | `{ score: number, keywords: string[], missing: string[] }` |
| `/api/ai/outreach-email` | POST | `{ jobId }` | `{ email: string }` |
| `/api/ai/negotiation-script` | POST | `{ jobId }` | `{ script: string }` |
| `/api/ai/linkedin-audit` | POST | `{}` | `{ suggestions: string[] }` |
| `/api/reminders/check` | GET | — | `{ sent: number }` |
| `/api/interview-prep/[company]` | GET | — | `{ questions: string[] }` |
| `/api/analytics/summary` | GET | — | `{ byPlatform, byRole, responseRate, weeklyTrend }` |
| `/api/calendar/auth` | GET | — | redirect to Google OAuth |
| `/api/calendar/callback` | GET | OAuth code | stores token, redirect |
| `/api/calendar/create` | POST | `{ applicationId, scheduledAt }` | `{ eventId }` |
| `/api/digest/send` | POST | — | `{ sent: boolean }` |

---

## Impact Map

**New files:**
- `src/lib/claude.ts` — Claude SDK wrapper, `generateWithResume(prompt)` helper
- `src/lib/resend.ts` — Resend email client, `sendDigest()`, `sendFollowUpReminder()`
- `src/lib/ats.ts` — Client-side ATS keyword scorer
- `src/lib/calendar.ts` — Google Calendar OAuth helpers
- `src/app/api/ai/[feature]/route.ts` — All AI generation endpoints (one file per feature)
- `src/app/api/reminders/check/route.ts` — Reminder poll endpoint
- `src/app/api/analytics/summary/route.ts` — Analytics aggregation
- `src/app/api/digest/send/route.ts` — Daily digest sender
- `src/app/api/interview-prep/[company]/route.ts` — Interview questions fetch
- `src/app/api/calendar/` — OAuth + create endpoints
- `src/app/analytics/page.tsx` — New analytics dashboard page
- `src/components/AtsScoreCard.tsx` — Score ring + missing keywords UI
- `src/components/AiDrawer.tsx` — Slide-out panel for cover letter / tailored resume / outreach
- `src/components/InterviewPrepCard.tsx` — Accordion of company interview questions
- `src/components/FollowUpBadge.tsx` — Due-date badge shown on Kanban cards

**Modified files:**
- `src/app/jobs/page.tsx` — Add `matchScore` badge on each `JobCard`; add ATS score button
- `src/components/JobCard.tsx` — Add match score ring, "Generate Cover Letter" button, ATS score
- `src/app/applications/page.tsx` — Add follow-up due badge, interview prep accordion, calendar button
- `src/app/settings/page.tsx` — Add Google Calendar connect button, Resend email field, LinkedIn optimizer trigger
- `src/components/Sidebar.tsx` — Add Analytics nav item
- `src/lib/jsearch.ts` — Call `computeMatchScore(job)` after each job upsert
- `prisma/schema.prisma` — New models above
- `worker/src/index.ts` — Add `node-cron` schedule for digest + reminder check

---

## Algorithms & Data Flow

### ATS Score (client-side)
1. Extract all words from JD description (lowercase, dedupe).
2. Extract all words from Vaibhav's resume text (hardcoded string in `src/lib/resume-text.ts`).
3. Compute intersection / JD word count × 100 = raw score.
4. Weight: title match +20, tech stack keywords +30, location match +10.
5. Return `{ score, matched: string[], missing: string[] }`.

### AI Cover Letter Generation
1. `POST /api/ai/cover-letter` receives `jobId`.
2. Fetch `job.description` + `job.title` + `job.company` from DB.
3. Build prompt: `RESUME_TEXT + JD + "Write a 3-paragraph cover letter..."`.
4. Stream response from Claude, save to `AiContent.coverLetter`.
5. Return full text; UI renders in `AiDrawer`.

### Match Score at Ingest
1. On every `job.upsert` in `/api/jobs/route.ts`, call `computeMatchScore(job)`.
2. `computeMatchScore` runs the ATS algorithm synchronously (no Claude call).
3. Write result to `Job.matchScore`.
4. Jobs page sorts by `matchScore DESC` by default.

### Follow-up Reminder Flow
1. When application status → `APPLIED`, create `FollowUpReminder { dueAt: now + 5 days }`.
2. Railway cron hits `GET /api/reminders/check` daily at 9 AM IST.
3. Query `FollowUpReminder` where `dueAt <= now AND sent = false`.
4. For each, send email via Resend, mark `sent = true`.

### Daily Digest
1. Railway cron hits `POST /api/digest/send` daily at 8 AM IST.
2. Fetch top 10 new jobs (last 24h, matchScore > 60).
3. Fetch all reminders due today.
4. Render HTML email template, send via Resend to `vaibhavghildiyal2101@gmail.com`.

---

## Error Handling & Degradation

- `Claude API → timeout/rate-limit` → return cached `AiContent` if exists; else show "Generate" button as disabled with tooltip "AI unavailable, try later"
- `Resend send failure` → log error, retry once after 60s; do not mark reminder as sent
- `Google Calendar OAuth token expired` → redirect user to re-auth on next calendar action; do not break application tracker
- `ATS score compute → JD missing` → skip scoring, show "N/A" badge
- `Interview prep fetch → no results` → show "No data found for this company" in accordion
- `Match score at ingest → Claude unavailable` → fall back to keyword-only score, still write to DB

---

## Security

| Threat | Mitigation |
|---|---|
| Claude API key exposed in client | All Claude calls in server-side API routes only; key in env vars |
| LinkedIn credentials logged | Never log `LINKEDIN_EMAIL`/`LINKEDIN_PASSWORD`; mask in all error output |
| Google OAuth token stored in DB | Encrypt refresh token at rest using `crypto.createCipheriv` with `ENCRYPTION_KEY` env var |
| Resend API key | Server-side only, never in `NEXT_PUBLIC_*` vars |

---

## Implementation Order

1. **Schema migration** — Add `AiContent`, `FollowUpReminder`, `InterviewPrep`, `CalendarEvent` models → `prisma db push`
2. **AI layer** — `src/lib/claude.ts` + all `/api/ai/*` routes + `AiDrawer` component + wire into `JobCard`
3. **ATS + Match Score** — `src/lib/ats.ts` + match score at ingest + `AtsScoreCard` component
4. **Follow-up + Digest** — `FollowUpReminder` creation on apply + reminder check route + digest route + Resend integration + cron in worker
5. **Analytics page** — `/api/analytics/summary` + `src/app/analytics/page.tsx` + Sidebar nav item
6. **Interview Prep** — `/api/interview-prep/[company]` + `InterviewPrepCard` in applications page
7. **Calendar** — Google OAuth setup + `/api/calendar/*` + calendar button in applications Kanban
8. **Tier 3** — LinkedIn optimizer (Settings page), negotiation script (Offer column in Kanban), referral finder (JobCard)

---

## Phases

### Phase 1 — AI Core (Days 1–2)
Schema + Claude lib + cover letter + resume tailoring + ATS score + match score + AiDrawer UI

### Phase 2A — Engagement Layer (Day 3)
Follow-up reminders + daily digest email + Resend integration + worker cron

### Phase 2B — Intelligence Layer (Day 4)
Analytics dashboard + interview prep per company + outreach email draft

### Phase 2C — Integrations (Day 5)
Google Calendar OAuth + calendar event creation + LinkedIn optimizer + negotiation script

---

## Risks & Edge Cases

- **Claude cost at scale** — generating cover letters for 100 jobs/day = ~$0.50/day at Sonnet pricing; cache `AiContent` aggressively, never re-generate if already exists
- **LinkedIn scrape breaks** — Playwright-based referral finder will break when LinkedIn changes DOM; wrap in try/catch, mark feature as "best-effort"
- **Google OAuth requires verified app** — takes 1–7 days for Google review; build Calendar last
- **Neon free tier connection limits** — pooler connection string already used; `connection_limit=1` needed in worker
- **Resume text hardcoded** — if resume changes, `src/lib/resume-text.ts` must be manually updated; add a Settings page field for this
- **Resend domain verification** — sending from `vaibhavghildiyal2101@gmail.com` requires DNS records; use Resend's default `onboarding@resend.dev` for testing
- **ATS score false positives** — simple keyword match will score "React" even if JD says "no React experience needed"; Claude re-check on demand is the quality gate

---

## New Environment Variables Needed

```bash
# AI
ANTHROPIC_API_KEY="sk-ant-..."

# Email
RESEND_API_KEY="re_..."
DIGEST_EMAIL="vaibhavghildiyal2101@gmail.com"

# Calendar
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="https://your-app.vercel.app/api/calendar/callback"

# Security
ENCRYPTION_KEY="32-char-random-string-for-token-encryption"
```
