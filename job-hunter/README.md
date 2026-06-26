# JobHunter AI

> Automated job discovery, AI-powered applications, and smart tracking — built for the Indian job market.

![Next.js](https://img.shields.io/badge/Next.js_15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma)
![Railway](https://img.shields.io/badge/Worker-Railway-B048DB?style=flat-square)
![Vercel](https://img.shields.io/badge/Frontend-Vercel-black?style=flat-square&logo=vercel)

---

## What it does

JobHunter AI is a self-hosted job automation platform that runs 24/7 on your behalf:

- **Fetches** fresh job listings from LinkedIn, Indeed, and Glassdoor via JSearch API
- **Scores** every job against your resume using ATS keyword matching
- **Auto-applies** to LinkedIn Easy Apply and Naukri Quick Apply jobs via a headless Playwright worker
- **Generates** tailored cover letters, ATS-optimized resumes, cold outreach emails, and negotiation scripts using Gemini AI
- **Tracks** your pipeline from saved → applied → interview → offer in a Kanban board
- **Notifies** you with follow-up reminders and daily email digests

---

## Architecture

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  Frontend (Vercel)          │     │  Worker (Railway)            │
│  Next.js 15 + Prisma        │────▶│  Playwright auto-apply bot   │
│  /app  /api  /components    │     │  LinkedIn scraper            │
└─────────────────────────────┘     └──────────────────────────────┘
           │                                      │
           └──────────────┬───────────────────────┘
                          ▼
               PostgreSQL (Neon / Railway)
```

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Database ORM | Prisma |
| Database | PostgreSQL (Neon recommended) |
| AI | Google Gemini via Groq SDK |
| Job Data | JSearch API (RapidAPI) |
| Auto-Apply Bot | Playwright (headless Chromium) |
| Email | Resend |
| Calendar | Google Calendar OAuth 2.0 |
| Auth | JWT (password-only) |

---

## Features

### Job Feed
- Fetches 6 search queries in parallel (Full Stack, Frontend, Backend, MERN, TypeScript, AI Engineer)
- Platform detection: LinkedIn, Indeed, Glassdoor, Other
- ATS match score computed per job against your saved resume
- Filters: platform, remote-only, quick-apply-only, title/company search

### AI Tools (per job)
- **ATS Score** — keyword gap analysis between your resume and the job description
- **Cover Letter** — tailored to the role and company
- **Resume Tailor** — reworded resume bullets for the specific JD
- **Cold Outreach** — LinkedIn/email message to the hiring manager
- **Negotiation Script** — salary negotiation talking points
- **LinkedIn Audit** — profile optimization suggestions

### Application Tracker
- Kanban board: `SAVED → APPLIED → INTERVIEW → OFFER / REJECTED`
- Follow-up reminder badges with configurable day thresholds
- One-click Google Calendar event creation for interviews

### Auto-Apply Worker
- Processes `PENDING` queue items on a configurable interval (default: every 6 hours)
- LinkedIn Easy Apply: multi-step modal handler (up to 8 steps)
- Naukri Quick Apply: login + apply + confirmation check
- On success: creates `Application` record, marks queue `COMPLETED`
- On failure: marks queue `FAILED` with error message

### Analytics
- Response rate, interview rate, offer rate
- Platform breakdown (where your applications come from)
- Weekly application trend chart

---

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database (Neon free tier works)
- RapidAPI account → [JSearch API](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch)
- Groq API key → [console.groq.com](https://console.groq.com)
- Resend account → [resend.com](https://resend.com) (for email digests)

### 1. Clone and install

```bash
git clone https://github.com/Vaidiasri/jobhunter-ai
cd jobhunter-ai/job-hunter
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/job_hunter"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

JSEARCH_API_KEY="your_rapidapi_key"
GROQ_API_KEY="your_groq_key"

RESEND_API_KEY="your_resend_key"
DIGEST_EMAIL="you@example.com"

ADMIN_PASSWORD="your_login_password"
SESSION_SECRET="a_long_random_string_32_chars_min"
CRON_SECRET="another_long_random_string"

ENCRYPTION_KEY="64_char_hex_string_for_aes256"  # openssl rand -hex 32

GOOGLE_CLIENT_ID=""         # optional — for Calendar integration
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:3000/api/calendar/callback"
```

### 3. Database migration

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — log in with your `ADMIN_PASSWORD`.

---

## Worker setup (auto-apply bot)

The worker runs separately and is designed for Railway deployment.

```bash
cd worker
npm install
```

Worker environment variables (set in Railway):

```env
DATABASE_URL="..."          # same database as frontend
LINKEDIN_EMAIL="..."
LINKEDIN_PASSWORD="..."
NAUKRI_EMAIL="..."
NAUKRI_PASSWORD="..."
PHONE="+91XXXXXXXXXX"
WORKER_INTERVAL_MS="21600000"   # 6 hours
```

```bash
# Local test run
npm run dev
```

---

## Deployment

### Frontend → Vercel

1. Push to GitHub
2. Import repo in Vercel
3. Set all environment variables in Vercel dashboard
4. Deploy — runs as serverless Next.js

### Worker → Railway

1. Connect GitHub repo in Railway
2. Set root directory to `job-hunter/worker`
3. Set all worker environment variables
4. Deploy — runs as a persistent Node.js process

---

## Project structure

```
job-hunter/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── api/               # REST API routes
│   │   │   ├── ai/            # Gemini AI endpoints
│   │   │   ├── applications/  # CRUD + status updates
│   │   │   ├── auto-apply/    # Queue management
│   │   │   ├── calendar/      # Google OAuth + event creation
│   │   │   ├── jobs/          # JSearch fetch + DB upsert
│   │   │   └── settings/      # Resume, preferences
│   │   ├── (pages)/           # Dashboard, jobs, tracker, analytics, settings
│   │   └── globals.css
│   ├── components/            # JobCard, AiDrawer, Sidebar, modals
│   ├── lib/                   # ats.ts, jsearch.ts, gemini.ts, calendar.ts
│   └── middleware.ts          # JWT auth guard
└── worker/
    └── src/
        ├── index.ts           # Queue processor + scraper loop
        └── platforms/
            ├── linkedin.ts    # Easy Apply automation
            └── naukri.ts      # Quick Apply automation
```

---

## Environment variable reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JSEARCH_API_KEY` | ✅ | RapidAPI JSearch key |
| `GROQ_API_KEY` | ✅ | Groq API key (runs Gemini) |
| `ADMIN_PASSWORD` | ✅ | Login password |
| `SESSION_SECRET` | ✅ | JWT signing secret |
| `CRON_SECRET` | ✅ | Bearer token for cron routes |
| `ENCRYPTION_KEY` | ✅ | 64-char hex for AES-256-GCM |
| `RESEND_API_KEY` | ⚪ | Email digest (optional) |
| `GOOGLE_CLIENT_ID` | ⚪ | Calendar integration (optional) |
| `LINKEDIN_EMAIL` | Worker | Auto-apply credentials |
| `NAUKRI_EMAIL` | Worker | Auto-apply credentials |

---

## License

MIT — built by [Vaibhav Ghildiyal](https://github.com/Vaidiasri)
