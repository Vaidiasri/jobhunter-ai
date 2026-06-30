import { Browser } from "playwright";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEARCHES = [
  { keyword: "full-stack-developer",  city: "noida" },
  { keyword: "react-developer",       city: "noida" },
  { keyword: "software-engineer",     city: "noida" },
  { keyword: "full-stack-developer",  city: "gurgaon" },
  { keyword: "software-engineer",     city: "gurgaon" },
  { keyword: "full-stack-developer",  city: "bangalore" },
  { keyword: "react-developer",       city: "bangalore" },
  { keyword: "software-engineer",     city: "bangalore" },
  { keyword: "mern-stack-developer",  city: "delhi" },
  { keyword: "software-engineer",     city: "hyderabad" },
];

interface NaukriJobDetail {
  jobId:        string;
  title:        string;
  companyName:  string;
  placeholders?: { label: string; type: string }[];
  jobAge?:      string;
  jdURL?:       string;
  staticUrl?:   string;
  remote?:      string;
}

function parseNaukriAge(ageText: string | undefined): Date | null {
  if (!ageText) return null;
  const now = Date.now();
  const t = ageText.toLowerCase();
  if (t.includes("just now") || t.includes("few")) return new Date(now);
  const h = t.match(/(\d+)\s*hour/);  if (h) return new Date(now - +h[1] * 3_600_000);
  const d = t.match(/(\d+)\s*day/);   if (d) return new Date(now - +d[1] * 86_400_000);
  const w = t.match(/(\d+)\s*week/);  if (w) return new Date(now - +w[1] * 604_800_000);
  return new Date(now);
}

function jobUrl(job: NaukriJobDetail): string {
  if (job.jdURL)    return job.jdURL.startsWith("http") ? job.jdURL : `https://www.naukri.com${job.jdURL}`;
  if (job.staticUrl) return `https://www.naukri.com${job.staticUrl}`;
  return `https://www.naukri.com/job-listings-${job.jobId}`;
}

function jobLocation(job: NaukriJobDetail): string {
  return job.placeholders?.find(p => p.type === "location")?.label ?? "";
}

async function loginNaukri(browser: Browser): Promise<import("playwright").BrowserContext> {
  const email    = process.env.NAUKRI_EMAIL;
  const password = process.env.NAUKRI_PASSWORD;
  if (!email || !password) throw new Error("NAUKRI_EMAIL / NAUKRI_PASSWORD not set in .env");

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  await page.goto("https://www.naukri.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Open login modal
  const loginLink = page.locator('a[href*="login"], a:has-text("Login"), a:has-text("Sign In")').first();
  if (await loginLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await loginLink.click();
    await page.waitForTimeout(1500);
  }

  await page.fill('input[type="text"][placeholder*="Email"], input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.locator('button[type="submit"], button:has-text("Login")').first().click();
  await page.waitForTimeout(4000);

  console.log("[naukri] Logged in successfully");
  await page.close();
  return context;
}

async function scrapeSearch(
  context: import("playwright").BrowserContext,
  keyword: string,
  city: string
): Promise<NaukriJobDetail[]> {
  const page = await context.newPage();
  const captured: NaukriJobDetail[] = [];

  // Intercept Naukri's own API response — runs with valid session cookies
  page.on("response", async (response) => {
    if (response.url().includes("/jobapi/v3/search") || response.url().includes("/jobapi/v4/search")) {
      try {
        const data = await response.json();
        if (Array.isArray(data.jobDetails)) captured.push(...data.jobDetails);
      } catch { /* non-JSON response, skip */ }
    }
  });

  const url = `https://www.naukri.com/${keyword}-jobs-in-${city}?jobAge=1`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.close();

  return captured;
}

export async function scrapeNaukriJobs(browser: Browser): Promise<number> {
  let context: import("playwright").BrowserContext | null = null;
  let totalSaved = 0;

  try {
    context = await loginNaukri(browser);
  } catch (err) {
    console.error("[naukri] Login failed:", err instanceof Error ? err.message : err);
    return 0;
  }

  for (const { keyword, city } of SEARCHES) {
    try {
      const jobs = await scrapeSearch(context, keyword, city);

      for (const job of jobs) {
        await prisma.job.upsert({
          where:  { externalId: `naukri-${job.jobId}` },
          create: {
            externalId:   `naukri-${job.jobId}`,
            title:         job.title,
            company:       job.companyName,
            location:      jobLocation(job) || city,
            platform:      "NAUKRI",
            url:           jobUrl(job),
            isQuickApply:  true,
            isRemote:      (job.remote ?? "").toLowerCase().includes("remote"),
            postedAt:      parseNaukriAge(job.jobAge),
            salaryCurrency: "INR",
          },
          update: { fetchedAt: new Date() },
        });
        totalSaved++;
      }

      console.log(`[naukri] ${keyword} in ${city}: ${jobs.length} jobs`);
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[naukri] Failed ${keyword}/${city}:`, err instanceof Error ? err.message : err);
    }
  }

  await context.close();
  return totalSaved;
}
