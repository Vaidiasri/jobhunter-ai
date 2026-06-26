# JobHunter — Setup Guide

Personal job hunt automation for Vaibhav Ghildiyal.

## 1. Get a JSearch API key (free tier: 200 req/month)

1. Go to https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
2. Subscribe to the free plan
3. Copy your `X-RapidAPI-Key`

## 2. Set up database (Neon — free PostgreSQL)

1. Go to https://neon.tech and create a free project
2. Copy the connection string (looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)

## 3. Run locally

```bash
cd job-hunter
npm install
cp .env.example .env.local
# Fill in DATABASE_URL and JSEARCH_API_KEY in .env.local

npx prisma db push          # Creates tables
npx prisma generate         # Generates client
npm run dev                 # Start at localhost:3000
```

## 4. Deploy to Vercel (frontend + API)

```bash
npx vercel
# Add env vars in Vercel dashboard:
#   DATABASE_URL
#   JSEARCH_API_KEY
#   NEXT_PUBLIC_APP_URL (your vercel URL)
```

## 5. Deploy worker to Railway (auto-apply bot)

```bash
cd worker
npm install
npx playwright install chromium  # Install browser

# Create new Railway project at railway.app
# Connect this /worker folder as the service
# Add env vars in Railway dashboard:
#   DATABASE_URL (same Neon connection string)
#   LINKEDIN_EMAIL / LINKEDIN_PASSWORD
#   NAUKRI_EMAIL / NAUKRI_PASSWORD
#   PHONE=+919368209983
#   WORKER_INTERVAL_MS=21600000
```

## 6. How to use

1. **Fetch jobs**: Go to /jobs → click "Fetch New Jobs"
2. **Filter**: Use platform/remote/quick-apply filters
3. **Save a job**: Click the bookmark icon
4. **Auto-apply**: Click "Auto-Apply" on any Quick Apply job (adds to queue)
5. **Track**: Go to /applications to see your Kanban board
6. **Worker**: Railway worker picks up the queue every 6 hours and applies automatically

## Architecture

```
Vercel (Next.js 15)
  ├── /                    Dashboard + stats
  ├── /jobs                Job feed (JSearch API aggregated)
  ├── /applications        Kanban tracker
  ├── /settings            Credentials + schedule
  └── /api/*               REST API → Neon PostgreSQL

Railway (Node.js worker)
  └── Playwright bot       Reads queue → LinkedIn Easy Apply + Naukri Quick Apply
```
