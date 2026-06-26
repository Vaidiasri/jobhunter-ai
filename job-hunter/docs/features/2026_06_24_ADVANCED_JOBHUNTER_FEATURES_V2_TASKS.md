# ADVANCED_JOBHUNTER_FEATURES_V2 — Implementation Tasks

**Source plan:** `docs/features/2026_06_24_ADVANCED_JOBHUNTER_FEATURES_V2.md`
**Date:** 2026-06-24
**Total tasks:** 34
**Total estimated LOC:** ~1,560

---

## How to use this file

Work through phases in order. Within a phase, tasks marked **parallel** can be done simultaneously. Mark each checkbox when the "Done when" condition is met.

```
[ ] not started   [~] in progress   [x] done
```

---

## Phase 0 — Pre-flight (Day 0, ~30 min)

---

### T-01: `install-deps`
**Files:** `package.json`, `worker/package.json`

**What to do:**
- Remove `@anthropic-ai/sdk` from root `package.json` dependencies
- Remove `node-cron` from `worker/package.json` dependencies
- Add `@google/generative-ai@^0.21.0` to root `package.json`
- Add `jose@^5.0.0` to root `package.json`
- Run `npm install` in project root
- Run `npm install` in `worker/`

**Error handling:** n/a
**Estimate:** ~10 diff lines
**Done when:** `npm ls @google/generative-ai jose` shows both; `@anthropic-ai/sdk` and `node-cron` are absent from both lockfiles.

- [ ] done

---

### T-02: `schema-migration`
**Files:** `prisma/schema.prisma`

**What to do:**
- Add `AiContent` model (fields: id, jobId unique, coverLetter, tailoredResume, atsScore, atsKeywords Json, outreachEmail, negotiationScript, createdAt, updatedAt)
- Add `ReminderType` enum: `INITIAL FOLLOWUP_2 FOLLOWUP_3`
- Add `ReminderStatus` enum: `PENDING SENT SKIPPED`
- Add `FollowUpReminder` model with `@@unique([applicationId, type])` — **not** `@@unique([applicationId])`
- Add `InterviewPrep` model with `expiresAt DateTime` (no `@default`) and `@@unique([company, role])`
- Add `CalendarEvent` model with `application Application @relation(...)` and `@@unique([applicationId, scheduledAt])`
- Add `LinkedInConnection` model with `@@index([company])`
- Add `UserSettings` model (`id @default("singleton")`, `scrapePending Boolean @default(false)`, `lastScrapedAt DateTime?`, `calendarToken String? @db.Text`)
- On `Job` model: add `matchScore Int?` and `aiContent AiContent?`
- On `Application` model: add `followUpReminders FollowUpReminder[]` and `calendarEvents CalendarEvent[]`
- Run: `npx prisma db push`
- Add all new env vars to `.env.example`: `GEMINI_API_KEY`, `RESEND_API_KEY`, `DIGEST_EMAIL`, `CRON_SECRET`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `ENCRYPTION_KEY`

**Error handling:** If `prisma db push` fails on an existing column conflict, use `--accept-data-loss` only after confirming no production data is at risk.
**Estimate:** ~80 diff lines
**Done when:** `npx prisma studio` opens with all new tables visible; `npx prisma validate` exits 0.

- [ ] done

---

### T-03: `google-oauth-submit`
**Files:** Google Cloud Console (browser action, no code)

**What to do:**
- Go to Google Cloud Console → APIs & Services → OAuth consent screen
- Set app name, support email, authorized domain (your Vercel URL)
- Add scope: `https://www.googleapis.com/auth/calendar.events`
- Submit for verification
- Note: review takes **1–7 days** — this is why it must happen on Day 0

**Error handling:** n/a (manual step)
**Estimate:** 0 diff lines
**Done when:** Google sends confirmation email that app is under review.

- [ ] done

---

## Phase 1 — Auth + AI Core (Days 1–2)

---

### T-04: `auth-setup`
**Files:** `src/middleware.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/login/page.tsx`

**What to do:**
- Create `src/middleware.ts`:
  - Define `EXEMPT = ["/api/calendar/callback", "/api/auth/login", "/login"]`
  - Define `CRON_PATHS = ["/api/digest/send", "/api/reminders/check"]`
  - For cron paths: verify `Authorization: Bearer ${CRON_SECRET}`; return 401 if wrong
  - For all other paths: check `session` cookie; verify JWT with `jose jwtVerify` + `SESSION_SECRET`
  - API routes: return JSON 401 on failure; pages: redirect to `/login`
  - Export `config = { matcher: ["/((?!_next|favicon.ico).*)"] }`
- Create `/api/auth/login/route.ts`:
  - Compare `password` body field against `process.env.ADMIN_PASSWORD`
  - On match: sign JWT (`sub: "vaibhav"`, `exp: 30d`) with `SESSION_SECRET` using `jose SignJWT`
  - Set `session` cookie: `httpOnly: true`, `sameSite: "lax"`, `maxAge: 60*60*24*30`
  - Return `{ ok: true }` or 401
- Create `/api/auth/logout/route.ts`: clear `session` cookie, return `{ ok: true }`
- Create `src/app/login/page.tsx`: password input form, calls `POST /api/auth/login`, redirects to `/` on success

**Error handling:** Wrong password → 401 JSON; expired JWT → redirect/401; missing `ADMIN_PASSWORD` env var → throw at startup (fail fast).
**Estimate:** ~70 diff lines
**Done when:** Visiting `/jobs` without a cookie redirects to `/login`; correct password sets cookie and redirects to `/`; wrong password shows error.

- [ ] done

---

### T-05: `settings-singleton` — *can run parallel with T-04*
**Files:** `src/lib/settings.ts`, `src/app/api/settings/route.ts`

**What to do:**
- Create `src/lib/settings.ts`:
  - Export `getOrCreateSettings()`: `prisma.userSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} })`
  - This is the **only** way to read UserSettings — never use `findUnique` directly
- Create `src/app/api/settings/route.ts`:
  - `GET`: call `getOrCreateSettings()`, return full `UserSettings` object (omit `calendarToken`)
  - `PATCH`: accept `{ resumeText?, digestEmail?, reminderDays? }`, update via `prisma.userSettings.update`
  - Validate `reminderDays` is a positive integer if provided

**Error handling:** `PATCH` with invalid `reminderDays` → 400 with message.
**Estimate:** ~40 diff lines
**Done when:** `GET /api/settings` returns a UserSettings object (not null) on a fresh DB; `PATCH /api/settings { reminderDays: 7 }` persists correctly.

- [ ] done

---

### T-06: `resume-pdf-upload` — *can run parallel with T-04*
**Files:** `src/app/api/settings/resume-upload/route.ts`

**What to do:**
- Create route accepting `POST multipart/form-data`
- Read file via `req.formData()`
- Guard: if `!file || file.type !== "application/pdf"` → return 400 "PDF file required"
- Parse with `pdfParse(Buffer.from(await file.arrayBuffer()))`
- Guard: if `!text?.trim()` → return 422 "Could not extract text — try a text-based PDF or paste your resume directly"
- Return `{ text: text.trim() }`
- Note: this route only **returns** text; the client must save it via `PATCH /api/settings`

**Error handling:** `pdf-parse` throws → catch and return 422; file over 10MB → return 400.
**Estimate:** ~35 diff lines
**Done when:** Uploading a real PDF returns extracted text; uploading a scanned image PDF returns 422.

- [ ] done

---

### T-07: `settings-page-update`
**Files:** `src/app/settings/page.tsx`, `src/components/Sidebar.tsx`

**What to do:**
- Fetch `GET /api/settings` on page load to pre-populate fields
- Add `<textarea>` for resume text bound to `UserSettings.resumeText`
- Add "Upload PDF" button: `POST /api/settings/resume-upload`, populate textarea with returned text
- Add "Save Resume" button: `PATCH /api/settings { resumeText }`
- Add "Connect Google Calendar" button linking to `/api/calendar/auth`
- Add "Trigger LinkedIn Scrape" button calling `POST /api/linkedin/scrape`
- Show `lastScrapedAt` date next to scrape button
- Add "Logout" button to Sidebar calling `POST /api/auth/logout` then `router.push("/login")`

**Error handling:** PDF upload 422 → show inline error below textarea; save 500 → show toast "Save failed, try again".
**Estimate:** ~60 diff lines
**Done when:** Resume text persists across page reloads; PDF upload populates textarea; logout clears session.

- [ ] done

---

### T-08: `gemini-lib`
**Files:** `src/lib/gemini.ts`

**What to do:**
- Import `GoogleGenerativeAI` from `@google/generative-ai`
- Init with `process.env.GEMINI_API_KEY!`; throw at import if missing
- Get model: `genai.getGenerativeModel({ model: "gemini-1.5-flash" })`
- Export `generateWithResume(prompt: string): Promise<string>`:
  - Call `getOrCreateSettings()`
  - If `!settings.resumeText?.trim()` → throw `new Error("RESUME_MISSING")`
  - Build content: `RESUME:\n${resumeText}\n\n${prompt}`
  - Implement retry: attempt up to 3 times with delays of 1000ms, 2000ms, 4000ms on error codes 429/500
  - On all retries exhausted → rethrow last error

**Error handling:** RESUME_MISSING → callers catch and return 422; 429 after 3 retries → callers catch and return 503; missing `GEMINI_API_KEY` → module throws on load.
**Estimate:** ~50 diff lines
**Done when:** `generateWithResume("Say hello")` returns a string; calling with empty resumeText throws "RESUME_MISSING"; a mocked 429 triggers the retry sequence.

- [ ] done

---

### T-09: `ats-scorer-lib`
**Files:** `src/lib/ats.ts`

**What to do:**
- Define `STOP_WORDS` Set with 30+ common English words
- Export `extractKeywords(text: string): Set<string>`:
  - Lowercase, split on non-word chars
  - Filter: length ≥ 3, not in STOP_WORDS
  - Return deduped Set
- Export `detectNonEnglish(text: string): boolean`:
  - If fewer than 10% of words match STOP_WORDS list → return true
- Export `computeAtsScore(jdText: string, resumeText: string)`:
  - Guard: empty jdText → return `null`
  - Guard: detectNonEnglish(jdText) → return `{ score: null, nonEnglish: true, matched: [], missing: [] }`
  - jdWords = extractKeywords(jdText); resumeWords = extractKeywords(resumeText)
  - intersection = words in both sets
  - `baseScore = Math.min(70, Math.round(intersection.size / jdWords.size * 100))`
  - Bonuses (only if applicable): +15 title match, +10 tech stack (≥2 of React/Node/TS/etc), +5 remote match
  - `finalScore = Math.min(100, baseScore + bonuses)`
  - Return `{ score: finalScore, matched: [...intersection], missing: [...jdWords - resumeWords] }`

**Error handling:** Empty resumeText → treat as empty set (all JD words are "missing").
**Estimate:** ~60 diff lines
**Done when:** Score for empty JD returns null; score never exceeds 100 even with all bonuses; non-English JD returns `{ nonEnglish: true }`.

- [ ] done

---

### T-10: `match-score-ingest`
**Files:** `src/lib/jsearch.ts`

**What to do:**
- Before each `job.upsert`, call: `const existing = await prisma.job.findUnique({ where: { externalId }, select: { matchScore: true } })`
- In the `create` branch: add `matchScore: computeMatchScore(jobData)` using the ATS scorer
- In the `update` branch: **omit** `matchScore` entirely
- Import `computeAtsScore` from `src/lib/ats.ts`
- `computeMatchScore(job)`: calls `computeAtsScore(job.description ?? "", resumeTextFallback)` — use a hardcoded fallback string if `UserSettings` isn't loaded at ingest time (worker context)

**Error handling:** ATS score returns null (empty JD) → store `matchScore: null`, not 0.
**Estimate:** ~20 diff lines
**Done when:** Re-fetching an existing job does not change its `matchScore` in DB; new jobs get a score on first insert.

- [ ] done

---

### T-11: `ai-cover-letter-route`
**Files:** `src/app/api/ai/cover-letter/route.ts`

**What to do:**
- Accept `POST { jobId: string, force?: boolean }`
- Fetch `job` from DB (title, company, description)
- If `!force`: check `AiContent.coverLetter` for this job → return `{ coverLetter, cached: true }` if found
- Call `generateWithResume("Write a 3-paragraph cover letter for this role: ...")` with job details
- `prisma.aiContent.upsert({ where: { jobId }, create: { jobId, coverLetter }, update: { coverLetter } })`
- Return `{ coverLetter, cached: false }`

**Error handling:** `RESUME_MISSING` → 422; Gemini 503 (all retries failed) → return cached if exists, else 503; concurrent upsert conflict → catch P2002, return existing.
**Estimate:** ~45 diff lines
**Done when:** First call generates and caches; second call returns cached; `force=true` regenerates; missing resume returns 422.

- [ ] done

---

### T-12: `ai-tailor-resume-route` — *can run parallel with T-11*
**Files:** `src/app/api/ai/tailor-resume/route.ts`

**What to do:**
- Same pattern as T-11 (cache check → generate → upsert → return)
- Prompt: "Rewrite the following resume to emphasize the skills and keywords most relevant to this job..."
- Field: `AiContent.tailoredResume`

**Error handling:** Same as T-11.
**Estimate:** ~35 diff lines
**Done when:** Returns tailored resume text; caches correctly.

- [ ] done

---

### T-13: `ai-ats-outreach-routes` — *can run parallel with T-11*
**Files:** `src/app/api/ai/ats-score/route.ts`, `src/app/api/ai/outreach-email/route.ts`

**What to do:**
- `ats-score` route:
  - Run client-side `computeAtsScore(job.description, settings.resumeText)` first
  - If `force=true` or score is null: call Gemini for deeper keyword analysis
  - Cache result in `AiContent.atsScore` and `AiContent.atsKeywords`
- `outreach-email` route:
  - Same cache pattern
  - Prompt: "Write a short cold outreach email to the hiring manager at {company}..."
  - Field: `AiContent.outreachEmail`

**Error handling:** Non-English JD → skip Gemini, return `{ score: null, nonEnglish: true }`; outreach route follows T-11 error pattern.
**Estimate:** ~60 diff lines
**Done when:** ATS score route returns heuristic score without Gemini; `force=true` returns Gemini-enhanced result; outreach email caches.

- [ ] done

---

### T-14: `ai-negotiation-linkedin-routes` — *can run parallel with T-11*
**Files:** `src/app/api/ai/negotiation-script/route.ts`, `src/app/api/ai/linkedin-audit/route.ts`

**What to do:**
- `negotiation-script` route:
  - Requires `jobId`; same cache pattern
  - Prompt: "Write a salary negotiation script for this offer. Company: {company}, role: {title}..."
  - Field: `AiContent.negotiationScript`
- `linkedin-audit` route:
  - No `jobId` — operates on full resume
  - No caching (call Gemini every time — audit quality improves with fresh analysis)
  - Prompt: "Review this resume for LinkedIn profile optimization. List 5–8 specific, actionable suggestions..."
  - Return `{ suggestions: string[] }` — parse Gemini response as newline-separated list

**Error handling:** LinkedIn audit parse failure → return `{ suggestions: ["Could not parse suggestions — try again"] }`; negotiation script follows T-11 pattern.
**Estimate:** ~50 diff lines
**Done when:** Negotiation script caches per job; LinkedIn audit always calls Gemini and returns an array.

- [ ] done

---

### T-15: `ai-drawer-component`
**Files:** `src/components/AiDrawer.tsx`

**What to do:**
- Slide-out drawer (right side) with tabs: Cover Letter | Tailored Resume | Outreach Email
- Each tab: displays cached content or placeholder; "Generate" button (calls route); "Regenerate" button (calls with `force=true`)
- Loading spinner during generation; error message on failure with retry button
- Copy-to-clipboard button per tab
- Accepts `jobId` prop; fetches tab content lazily on first open

**Error handling:** 422 (missing resume) → show "Add your resume in Settings first" with link; 503 → show "AI is busy, try in 1 minute".
**Estimate:** ~70 diff lines
**Done when:** Drawer opens, generates content on first click, shows cached on second click, regenerates on force button.

- [ ] done

---

### T-16: `ats-score-card-component`
**Files:** `src/components/AtsScoreCard.tsx`

**What to do:**
- SVG score ring (0–100, colored green/amber/red by score range)
- "Matched keywords" section: green chips
- "Missing keywords" section: red chips
- "N/A" state: shown when `score === null`
- "Non-English JD" badge: shown when `nonEnglish === true`
- Compact mode (just the ring number) and expanded mode (full keyword lists)

**Error handling:** `null` score → show "N/A" badge, not 0 or empty ring.
**Estimate:** ~50 diff lines
**Done when:** Ring renders at correct angle for any score 0–100; N/A state displays correctly.

- [ ] done

---

### T-17: `job-card-wire-ai`
**Files:** `src/components/JobCard.tsx`, `src/app/jobs/page.tsx`

**What to do:**
- Add `matchScore` prop to `JobCard`; render as colored badge (green ≥70, amber 40–69, gray <40, N/A if null)
- Add "Cover Letter" button on card → opens `AiDrawer` for that jobId
- Add "ATS Score" button on card → opens `AtsScoreCard` popover
- Pass `matchScore` from jobs page data to each `JobCard`
- Sort jobs by `matchScore DESC` by default on the jobs page

**Error handling:** `matchScore` null → show "N/A" badge, not 0.
**Estimate:** ~40 diff lines
**Done when:** Jobs page shows score badges; clicking "Cover Letter" opens drawer with correct jobId; sort works.

- [ ] done

---

## Phase 2A — Engagement Layer (Day 3)

---

### T-18: `follow-up-reminder-creation`
**Files:** `src/app/api/applications/[id]/route.ts`

**What to do:**
- On `PATCH` when new `status === "APPLIED"`:
  - Call `getOrCreateSettings()` to get `reminderDays`
  - `prisma.followUpReminder.createMany({ data: [...3 reminders], skipDuplicates: true })`
  - Reminder due dates: `addDays(now, days)`, `addDays(now, days * 2)`, `addDays(now, days * 4)`
- On `PATCH` when old status was `"APPLIED"` and new status is anything else:
  - `prisma.followUpReminder.updateMany({ where: { applicationId, status: "PENDING" }, data: { status: "SKIPPED" } })`
- Import `addDays` from `date-fns`

**Error handling:** `createMany` with `skipDuplicates` handles re-application case silently.
**Estimate:** ~45 diff lines
**Done when:** Setting status to APPLIED creates 3 reminders; changing to INTERVIEW marks them SKIPPED; re-applying after REJECTED creates a new set without error.

- [ ] done

---

### T-19: `follow-up-badge-component` — *can run parallel with T-18*
**Files:** `src/components/FollowUpBadge.tsx`, `src/app/applications/page.tsx`

**What to do:**
- Accept `reminders: FollowUpReminder[]` prop
- Find earliest PENDING reminder
- Display: days remaining until `dueAt` (e.g., "Follow up in 3 days")
- Color: green if >3 days, amber if 1–3 days, red if overdue (dueAt < now)
- No badge shown if no PENDING reminders
- Wire into each application card on the applications page (pass reminders from page data)

**Error handling:** No reminders → render nothing.
**Estimate:** ~35 diff lines
**Done when:** Badge shows correct days remaining; turns red when overdue; disappears when no PENDING reminders remain.

- [ ] done

---

### T-20: `resend-lib`
**Files:** `src/lib/resend.ts`

**What to do:**
- Import and init `Resend` client with `process.env.RESEND_API_KEY`
- Export `sendFollowUpReminder(application, job, reminderType)`:
  - Subject: "JobHunter: Follow up on {job.title} at {job.company}"
  - Body: job title, company, URL, days since applied, reminder type
  - From: `onboarding@resend.dev` (use until custom domain is verified)
  - Returns `boolean` (success/fail) — does **not** throw
- Export `sendDigest(jobs, dueReminders, toEmail)`:
  - HTML email template with sections: "New Matches" (job cards) and "Follow-up Today" (reminder list)
  - If `jobs.length === 0`: show "No new jobs matched today" section
  - Returns `boolean`

**Error handling:** Resend API call fails → catch, log error, return `false`. Never throw from these functions — callers check the return value.
**Estimate:** ~55 diff lines
**Done when:** `sendFollowUpReminder` returns true and email arrives; returns false (not throws) on API error.

- [ ] done

---

### T-21: `reminders-check-route`
**Files:** `src/app/api/reminders/check/route.ts`

**What to do:**
- `GET` handler (Vercel Cron calls GET)
- Verify `Authorization: Bearer ${CRON_SECRET}` → 401 if wrong
- Query: `prisma.followUpReminder.findMany({ where: { dueAt: { lte: new Date() }, status: "PENDING" }, include: { application: { include: { job: true } } } })`
- For each reminder:
  - Call `sendFollowUpReminder(application, job, reminderType)` from resend lib
  - On `true`: `prisma.followUpReminder.update({ data: { status: "SENT", sentAt: new Date() } })`
  - On `false`: leave as PENDING (cron retries tomorrow)
- Return `{ sent: count, skipped: failCount }`

**Error handling:** Send failure → do not mark SENT; log reminder id and failure reason.
**Estimate:** ~40 diff lines
**Done when:** Curl with correct `CRON_SECRET` processes due reminders; curl without header returns 401; failed sends remain PENDING.

- [ ] done

---

### T-22: `digest-send-route`
**Files:** `src/app/api/digest/send/route.ts`

**What to do:**
- `POST` handler
- Verify `Authorization: Bearer ${CRON_SECRET}` → 401 if wrong
- Fetch jobs: `createdAt > 24h ago AND matchScore > 60`, limit 10, order by matchScore DESC
- Fetch due reminders: same query as T-21
- Call `sendDigest(jobs, dueReminders, settings.digestEmail)`
- Return `{ sent: boolean, jobCount: jobs.length, reminderCount: dueReminders.length }`
- If `jobs.length === 0`: still call `sendDigest` (email shows "No new jobs today")

**Error handling:** Digest send returns false → log, return `{ sent: false }`; `getOrCreateSettings()` ensures email is never null.
**Estimate:** ~45 diff lines
**Done when:** Cron call with 0 new jobs still sends email; Curl without CRON_SECRET returns 401; `jobCount` in response is accurate.

- [ ] done

---

### T-23: `vercel-cron-config`
**Files:** `vercel.json`

**What to do:**
- Add `"crons"` array to existing `vercel.json`:
  ```json
  "crons": [
    { "path": "/api/digest/send",    "schedule": "30 2 * * *" },
    { "path": "/api/reminders/check","schedule": "30 3 * * *" }
  ]
  ```
- `30 2 * * *` = 08:00 IST; `30 3 * * *` = 09:00 IST
- Do not add a third cron — Vercel hobby plan limit is exactly 2

**Error handling:** n/a
**Estimate:** ~5 diff lines
**Done when:** `vercel.json` is valid JSON; deploy to Vercel shows both crons in dashboard under "Cron Jobs".

- [ ] done

---

## Phase 2B — Intelligence Layer (Day 4)

---

### T-24: `analytics-lib`
**Files:** `src/lib/analytics.ts`

**What to do:**
- Export `aggregateByPlatform(applications)`: count per `job.platform`, return `{ platform: string, count: number }[]`
- Export `aggregateByRole(applications)`: group by first word of `job.title` (rough role bucket), return counts
- Export `computeResponseRate(applications)`: `(INTERVIEW + OFFER + REJECTED) / APPLIED * 100` — returns number 0–100
- Export `computeWeeklyTrend(applications, weeks = 8)`: for each of last N weeks, count applications filed — returns `{ week: string, count: number }[]`
- Export `buildSummary(applications)`: calls all four, returns full summary object

**Error handling:** Empty applications array → return zeroes/empty arrays, not null.
**Estimate:** ~55 diff lines
**Done when:** `buildSummary([])` returns valid empty structure; trend array has exactly 8 entries when `weeks=8`.

- [ ] done

---

### T-25: `analytics-routes`
**Files:** `src/app/api/analytics/summary/route.ts`, `src/app/api/dashboard/stats/route.ts`

**What to do:**
- Create `/api/analytics/summary/route.ts`:
  - Fetch all applications with job relation
  - Call `buildSummary(applications)` from analytics lib
  - Return full summary
- Refactor `/api/dashboard/stats/route.ts`:
  - Remove duplicated aggregation logic
  - Import and call `buildSummary()` instead
  - Keep existing response shape (no breaking change)

**Error handling:** DB query failure → 500 with message.
**Estimate:** ~40 diff lines
**Done when:** Both routes return identical `byPlatform` and `responseRate` for the same dataset; no duplicated aggregation code exists.

- [ ] done

---

### T-26: `analytics-page`
**Files:** `src/app/analytics/page.tsx`, `src/components/Sidebar.tsx`

**What to do:**
- Create analytics page fetching `GET /api/analytics/summary`
- Render four sections:
  - Platform breakdown: bar chart (CSS-only, no chart lib)
  - Response rate: large number + label
  - Role breakdown: sorted list with percentages
  - Weekly trend: sparkline (SVG, 8 bars)
- Add "Analytics" nav item to Sidebar (between Applications and Settings)
- Show loading skeleton while data fetches

**Error handling:** Fetch error → show "Could not load analytics" with retry button.
**Estimate:** ~70 diff lines
**Done when:** Analytics page loads and displays all four sections with real data; Sidebar link routes correctly.

- [ ] done

---

### T-27: `interview-prep-route`
**Files:** `src/app/api/interview-prep/[company]/route.ts`

**What to do:**
- `GET /api/interview-prep/[company]?role=string`
- Check `InterviewPrep` cache: `where: { company, role }` — if `expiresAt > now`, return cached `{ questions, source, expiresAt }`
- If expired or missing: call `generateWithResume("List 10 likely interview questions for a {role} at {company}...")`
- Parse response: split on numbered list pattern or newlines; extract `string[]`
- Upsert: `create: { company, role, questions, expiresAt: addDays(new Date(), 30) }`, `update: { questions, expiresAt, fetchedAt: new Date() }`
- Wrap JSON parse in try/catch; retry generateWithResume once on parse failure; return "No data found" on second failure

**Error handling:** Gemini returns non-parseable text → retry once; second failure → return `{ questions: [], error: "No data found for this company" }`.
**Estimate:** ~50 diff lines
**Done when:** First call generates and caches; second call within 30 days returns cached without Gemini call; expired cache regenerates.

- [ ] done

---

### T-28: `interview-prep-card-component`
**Files:** `src/components/InterviewPrepCard.tsx`, `src/app/applications/page.tsx`

**What to do:**
- Create `InterviewPrepCard` accordion component
  - Shows company name + role as header
  - Expands to show numbered question list
  - "AI-generated, not verified" badge below header
  - "Refresh questions" link (calls route with `force=true` equivalent: `?fresh=1`)
  - Loading state while fetching
- Wire into applications page: show card for each application with a company name

**Error handling:** Fetch returns `error` field → show "No data found for this company" in expanded state.
**Estimate:** ~45 diff lines
**Done when:** Card expands showing questions; refresh fetches new ones; "AI-generated" badge is visible.

- [ ] done

---

## Phase 2C — Integrations (Day 5)

*(Requires Google OAuth verification to be complete from Day 0)*

---

### T-29: `calendar-lib`
**Files:** `src/lib/calendar.ts`

**What to do:**
- Export `generateAuthUrl()`: builds Google OAuth URL with `calendar.events` scope + `access_type=offline` + `prompt=consent`
- Export `exchangeCodeForTokens(code)`: calls Google token endpoint, returns `{ refresh_token, access_token }`
- Export `encryptToken(token)`: AES-256-GCM with `ENCRYPTION_KEY`; returns `{ iv, ciphertext }` as single base64 string
- Export `decryptToken(encrypted)`: reverse of above
- Export `getAccessToken(encryptedRefreshToken)`: decrypts, uses googleapis to get fresh access token
- Export `createCalendarEvent(encryptedToken, title, description, scheduledAt)`: creates event via Google Calendar API; returns `{ googleEventId, htmlLink }`

**Error handling:** `invalid_grant` → throw `new Error("TOKEN_EXPIRED")`; missing `ENCRYPTION_KEY` → throw at module load.
**Estimate:** ~70 diff lines
**Done when:** `encryptToken(decryptToken(x)) === x`; `createCalendarEvent` returns an event ID when given a valid token.

- [ ] done

---

### T-30: `calendar-oauth-routes`
**Files:** `src/app/api/calendar/auth/route.ts`, `src/app/api/calendar/callback/route.ts`

**What to do:**
- `/api/calendar/auth`:
  - `GET`: redirect to `generateAuthUrl()` — **this route is exempt from cookie-auth** (it's an internal link trigger, not from Google)
- `/api/calendar/callback`:
  - `GET`: extract `code` from query params
  - Call `exchangeCodeForTokens(code)`
  - Encrypt refresh token with `encryptToken()`
  - `prisma.userSettings.update({ data: { calendarToken: encryptedToken } })`
  - Redirect to `/settings?calendar=connected`
  - **This route must be in `EXEMPT` list in middleware** (Google redirects here, no session cookie)

**Error handling:** Missing `code` param → redirect to `/settings?calendar=error`; `exchangeCodeForTokens` throws → same redirect.
**Estimate:** ~45 diff lines
**Done when:** Clicking "Connect Google Calendar" in settings opens Google consent screen; after consent, redirects back to settings with "connected" state.

- [ ] done

---

### T-31: `calendar-create-route`
**Files:** `src/app/api/calendar/create/route.ts`

**What to do:**
- Accept `POST { applicationId: string, scheduledAt: string }`
- Guard: `if (new Date(scheduledAt) <= new Date())` → return 400 "Interview time must be in the future"
- Fetch `encryptedToken` from `getOrCreateSettings().calendarToken`
- Guard: if no token → return 401 `{ error: "Calendar not connected", reAuthUrl: "/api/calendar/auth" }`
- Call `createCalendarEvent(encryptedToken, title, description, scheduledAt)`
- On `TOKEN_EXPIRED` error: clear `UserSettings.calendarToken`, return 401 with `reAuthUrl`
- Upsert `CalendarEvent` in DB
- Return `{ eventId, htmlLink }`

**Error handling:** Past date → 400; no token → 401; token expired → clear + 401; Google API fail → 502.
**Estimate:** ~45 diff lines
**Done when:** Creating event with past date returns 400; valid future date creates Google Calendar event and DB record.

- [ ] done

---

### T-32: `calendar-ui`
**Files:** `src/app/applications/page.tsx`

**What to do:**
- Add "Add to Calendar" button on INTERVIEW and OFFER status cards
- On click: open a date/time input modal
- On submit: call `POST /api/calendar/create`
- On 401 `reAuthUrl`: show "Reconnect Calendar" link
- On success: show "✓ Added to Google Calendar" with link to event
- Show existing calendar events on each card if `CalendarEvent` records exist

**Error handling:** 400 (past date) → inline error "Please choose a future date/time"; 401 → prompt re-auth.
**Estimate:** ~40 diff lines
**Done when:** Interview card shows "Add to Calendar"; picking a future time creates a Google Calendar event; event link appears on card.

- [ ] done

---

### T-33: `linkedin-scrape-worker`
**Files:** `worker/src/index.ts`

**What to do:**
- Create `checkLinkedInScrape()` function:
  - Read `UserSettings` from DB using raw Prisma (worker already has Prisma set up)
  - If `!settings?.scrapePending` → return immediately
  - Run existing LinkedIn Playwright flow (already exists in `worker/src/platforms/linkedin.ts`)
  - Extract connections: name, title, company, profileUrl from connections page
  - `prisma.linkedInConnection.createMany({ data: connections, skipDuplicates: true })`
  - `prisma.userSettings.update({ data: { scrapePending: false, lastScrapedAt: new Date() } })`
- On error: catch all, reset `scrapePending = false`, mask credentials in log: replace email/password values with `[redacted]`
- Add `checkLinkedInScrape()` call to existing worker polling loop (alongside existing auto-apply check)

**Error handling:** Playwright crash → catch, reset flag, masked log; 0 connections extracted → reset flag, log count, do not throw.
**Estimate:** ~50 diff lines
**Done when:** Setting `scrapePending = true` in DB and running worker causes connections to appear in `LinkedInConnection` table; flag resets to false.

- [ ] done

---

### T-34: `linkedin-scrape-route-and-ui`
**Files:** `src/app/api/linkedin/scrape/route.ts`

**What to do:**
- `POST`: call `getOrCreateSettings()`
- Set `UserSettings.scrapePending = true`
- Return `{ queued: true, lastScrapedAt: settings.lastScrapedAt }`
- Note: settings page "Trigger LinkedIn Scrape" button was already wired in T-07

**Error handling:** DB update fails → 500; if `scrapePending` is already true → return `{ queued: true, alreadyPending: true }` (don't double-queue).
**Estimate:** ~25 diff lines
**Done when:** POST to route sets `scrapePending = true` in DB; returns `alreadyPending: true` when called twice before worker runs.

- [ ] done

---

## Summary Table

| # | Task Name | Files | Est. LOC | Phase |
|---|---|---|---|---|
| T-01 | `install-deps` | package.json, worker/package.json | 10 | 0 |
| T-02 | `schema-migration` | prisma/schema.prisma | 80 | 0 |
| T-03 | `google-oauth-submit` | (browser) | 0 | 0 |
| T-04 | `auth-setup` | middleware.ts, 3 auth files | 70 | 1 |
| T-05 | `settings-singleton` | settings.ts, api/settings | 40 | 1 |
| T-06 | `resume-pdf-upload` | api/settings/resume-upload | 35 | 1 |
| T-07 | `settings-page-update` | settings/page.tsx, Sidebar.tsx | 60 | 1 |
| T-08 | `gemini-lib` | lib/gemini.ts | 50 | 1 |
| T-09 | `ats-scorer-lib` | lib/ats.ts | 60 | 1 |
| T-10 | `match-score-ingest` | lib/jsearch.ts | 20 | 1 |
| T-11 | `ai-cover-letter-route` | api/ai/cover-letter | 45 | 1 |
| T-12 | `ai-tailor-resume-route` | api/ai/tailor-resume | 35 | 1 |
| T-13 | `ai-ats-outreach-routes` | api/ai/ats-score, outreach-email | 60 | 1 |
| T-14 | `ai-negotiation-linkedin-routes` | api/ai/negotiation-script, linkedin-audit | 50 | 1 |
| T-15 | `ai-drawer-component` | AiDrawer.tsx | 70 | 1 |
| T-16 | `ats-score-card-component` | AtsScoreCard.tsx | 50 | 1 |
| T-17 | `job-card-wire-ai` | JobCard.tsx, jobs/page.tsx | 40 | 1 |
| T-18 | `follow-up-reminder-creation` | api/applications/[id] | 45 | 2A |
| T-19 | `follow-up-badge-component` | FollowUpBadge.tsx, applications/page.tsx | 35 | 2A |
| T-20 | `resend-lib` | lib/resend.ts | 55 | 2A |
| T-21 | `reminders-check-route` | api/reminders/check | 40 | 2A |
| T-22 | `digest-send-route` | api/digest/send | 45 | 2A |
| T-23 | `vercel-cron-config` | vercel.json | 5 | 2A |
| T-24 | `analytics-lib` | lib/analytics.ts | 55 | 2B |
| T-25 | `analytics-routes` | api/analytics/summary, api/dashboard/stats | 40 | 2B |
| T-26 | `analytics-page` | app/analytics/page.tsx, Sidebar.tsx | 70 | 2B |
| T-27 | `interview-prep-route` | api/interview-prep/[company] | 50 | 2B |
| T-28 | `interview-prep-card-component` | InterviewPrepCard.tsx, applications/page.tsx | 45 | 2B |
| T-29 | `calendar-lib` | lib/calendar.ts | 70 | 2C |
| T-30 | `calendar-oauth-routes` | api/calendar/auth, callback | 45 | 2C |
| T-31 | `calendar-create-route` | api/calendar/create | 45 | 2C |
| T-32 | `calendar-ui` | app/applications/page.tsx | 40 | 2C |
| T-33 | `linkedin-scrape-worker` | worker/src/index.ts | 50 | 2C |
| T-34 | `linkedin-scrape-route-and-ui` | api/linkedin/scrape | 25 | 2C |
| | **Total** | | **~1,560** | |

---

## Dependency Chain

```
Phase 0 (all parallel):
  T-01 ─┐
  T-02 ─┤─── all must complete before Phase 1
  T-03 ─┘

Phase 1 (sequential start, then parallel branches):
  T-01, T-02 done
       │
       ▼
  T-04 (auth) ──────────────────────── must complete first; all routes need middleware
       │
       ├── T-05 (settings singleton)
       │       │
       │       ├── T-06 (pdf upload) ──────────────── T-07 (settings page)
       │       │
       │       └── T-08 (gemini lib)
       │               │
       │               ├── T-09 (ats scorer)
       │               │       │
       │               │       ├── T-10 (match score ingest)  ← parallel with T-11+
       │               │       └── T-16 (AtsScoreCard)        ← parallel with T-11+
       │               │
       │               ├── T-11 (cover letter) ─┐
       │               ├── T-12 (tailor resume) ─┤── T-15 (AiDrawer) ── T-17 (JobCard wire)
       │               ├── T-13 (ats+outreach)  ─┤
       │               └── T-14 (neg+linkedin)  ─┘

Phase 2A (sequential after Phase 1):
  T-05 (settings) done
       │
       ├── T-18 (reminder creation) ── T-20 (resend lib) ── T-21 (reminders route) ── T-23 (cron config)
       │                                                  └── T-22 (digest route)   ─┘
       │
       └── T-19 (follow-up badge) ← parallel with T-18

Phase 2B (sequential after Phase 2A):
  T-24 (analytics lib) ─── T-25 (analytics routes) ─── T-26 (analytics page)
  T-08 (gemini lib) done
       └── T-27 (interview prep route) ─── T-28 (interview prep card)

Phase 2C (sequential after Phase 2B; T-03 Google review must also be done):
  T-29 (calendar lib) ─── T-30 (oauth routes) ─── T-31 (create route) ─── T-32 (calendar UI)
  T-05 (settings) done
       └── T-33 (worker scrape) ─── T-34 (scrape route)  ← parallel with T-29+
```

### Critical path (longest sequential chain):

```
T-01 → T-02 → T-04 → T-05 → T-08 → T-11 → T-15 → T-17
                                  → T-18 → T-20 → T-21 → T-23
                                                → T-24 → T-25 → T-26
                                  → T-27 → T-28
             → T-29 → T-30 → T-31 → T-32
```

### Parallelizable groups (can be done simultaneously):

- **T-01, T-02, T-03** — all pre-flight tasks
- **T-05, T-04** — settings lib and auth can develop in parallel (auth doesn't call settings)
- **T-06, T-07, T-08** — after T-05 is done
- **T-09, T-10** — after T-08; independent of each other
- **T-11, T-12, T-13, T-14** — all AI routes follow same pattern; all parallel after T-08
- **T-15, T-16** — UI components; parallel after T-08 types are established
- **T-19** — parallel with T-18 (both need Application data but don't depend on each other)
- **T-21, T-22** — both need T-20 (resend lib) but not each other
- **T-27, T-28** — prep route and card are independent
- **T-33, T-34** — scrape worker and route are independent; both parallel with T-29+
