import "dotenv/config";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { applyLinkedIn } from "./platforms/linkedin";
import { applyNaukri } from "./platforms/naukri";
import { scrapeNaukriJobs } from "./platforms/naukriScraper";

const prisma = new PrismaClient();

async function checkLinkedInScrape() {
  const settings = await prisma.userSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.scrapePending) return;

  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    await page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle" });
    await page.fill("#username", email!);
    await page.fill("#password", password!);
    await page.click('[type="submit"]');
    await page.waitForURL("**/feed/**", { timeout: 10000 });

    await page.goto("https://www.linkedin.com/mynetwork/invite-connect/connections/", { waitUntil: "networkidle" });
    await page.waitForSelector("li.mn-connection-card", { timeout: 10000 });

    const connections = await page.$$eval("li.mn-connection-card", (cards) =>
      cards.map((card) => {
        const occupation = card.querySelector(".mn-connection-card__occupation")?.textContent?.trim() ?? null;
        const atIdx = occupation ? occupation.lastIndexOf(" at ") : -1;
        return {
          name: card.querySelector(".mn-connection-card__name")?.textContent?.trim() ?? "",
          title: atIdx > -1 ? occupation!.substring(0, atIdx) : occupation,
          company: atIdx > -1 ? occupation!.substring(atIdx + 4) : null,
          profileUrl: (card.querySelector("a.mn-connection-card__link") as HTMLAnchorElement)?.href ?? "",
        };
      }).filter((c) => c.name && c.profileUrl)
    );

    if (connections.length > 0) {
      await prisma.linkedInConnection.createMany({ data: connections, skipDuplicates: true });
    }

    console.log(`[worker] LinkedIn scrape: ${connections.length} connections synced`);
    await prisma.userSettings.update({
      where: { id: "singleton" },
      data: { scrapePending: false, lastScrapedAt: new Date() },
    });

    await context.close();
  } catch (err) {
    const masked = String(err)
      .replace(email ?? "", "[redacted]")
      .replace(password ?? "", "[redacted]");
    console.error("[worker] LinkedIn scrape failed:", masked);
    await prisma.userSettings.update({
      where: { id: "singleton" },
      data: { scrapePending: false },
    });
  } finally {
    await browser.close();
  }
}

const INTERVAL_MS = parseInt(process.env.WORKER_INTERVAL_MS ?? "21600000", 10);

async function processQueue() {
  console.log(`[worker] Starting auto-apply run at ${new Date().toISOString()}`);

  const pending = await prisma.autoApplyQueue.findMany({
    where: { status: "PENDING" },
    include: { job: true },
    orderBy: { scheduledAt: "asc" },
    take: 20,
  });

  if (pending.length === 0) {
    console.log("[worker] Queue empty — nothing to do");
    return;
  }

  console.log(`[worker] ${pending.length} jobs in queue`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  for (const item of pending) {
    console.log(`[worker] Processing: ${item.job.title} @ ${item.job.company} (${item.job.platform})`);

    await prisma.autoApplyQueue.update({
      where: { id: item.id },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    let result: { success: boolean; error?: string };

    try {
      if (item.job.platform === "LINKEDIN") {
        result = await applyLinkedIn(browser, item.job.url);
      } else if (item.job.platform === "NAUKRI") {
        result = await applyNaukri(browser, item.job.url);
      } else {
        result = { success: false, error: `Platform ${item.job.platform} not supported for auto-apply` };
      }
    } catch (err) {
      result = {
        success: false,
        error: err instanceof Error ? err.message : "Unexpected error",
      };
    }

    if (result.success) {
      await prisma.autoApplyQueue.update({
        where: { id: item.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      await prisma.application.upsert({
        where: { jobId: item.jobId },
        create: { jobId: item.jobId, status: "APPLIED", appliedAt: new Date() },
        update: { status: "APPLIED", appliedAt: new Date() },
      });

      console.log(`[worker] ✓ Applied to ${item.job.title} @ ${item.job.company}`);
    } else {
      await prisma.autoApplyQueue.update({
        where: { id: item.id },
        data: { status: "FAILED", completedAt: new Date(), error: result.error },
      });

      console.log(`[worker] ✗ Failed: ${result.error}`);
    }

    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
  }

  await browser.close();
  console.log(`[worker] Run complete — processed ${pending.length} jobs`);
}

async function checkNaukriScrape() {
  const settings = await prisma.userSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.naukriScrapePending) return;

  console.log("[worker] Starting Naukri job scrape...");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
  });

  try {
    const count = await scrapeNaukriJobs(browser);
    console.log(`[worker] Naukri scrape complete: ${count} jobs saved`);
  } catch (err) {
    console.error("[worker] Naukri scrape failed:", err);
  } finally {
    await browser.close();
    await prisma.userSettings.update({
      where: { id: "singleton" },
      data: { naukriScrapePending: false },
    });
  }
}

async function main() {
  console.log(`[worker] JobHunter auto-apply worker started`);
  console.log(`[worker] Interval: ${INTERVAL_MS / 1000 / 60}min`);

  await processQueue();
  await checkLinkedInScrape();
  await checkNaukriScrape();

  setInterval(async () => {
    try {
      await processQueue();
      await checkLinkedInScrape();
      await checkNaukriScrape();
    } catch (err) {
      console.error("[worker] Run failed:", err);
    }
  }, INTERVAL_MS);
}

main().catch(console.error);
