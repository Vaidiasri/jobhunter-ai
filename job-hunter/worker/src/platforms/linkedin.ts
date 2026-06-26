import { Browser } from "playwright";

export interface ApplyResult {
  success: boolean;
  error?: string;
}

export async function applyLinkedIn(
  browser: Browser,
  jobUrl: string
): Promise<ApplyResult> {
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    return { success: false, error: "LinkedIn credentials not set" };
  }

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    // Login
    await page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle" });
    await page.fill("#username", email);
    await page.fill("#password", password);
    await page.click('[type="submit"]');
    await page.waitForURL(/linkedin\.com\/(feed|jobs)/, { timeout: 15000 });

    // Navigate to job
    await page.goto(jobUrl, { waitUntil: "networkidle" });

    // Click Easy Apply
    const easyApplyBtn = page.locator('button:has-text("Easy Apply")').first();
    const exists = await easyApplyBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!exists) {
      return { success: false, error: "Easy Apply button not found — may not be supported for this job" };
    }

    await easyApplyBtn.click();

    // Handle multi-step Easy Apply modal
    let step = 0;
    const maxSteps = 8;

    while (step < maxSteps) {
      await page.waitForTimeout(1200);

      // Fill phone if empty
      const phoneInput = page.locator('input[name*="phone"], input[id*="phone"]').first();
      if (await phoneInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        const val = await phoneInput.inputValue();
        if (!val) await phoneInput.fill(process.env.PHONE ?? "+919368209983");
      }

      // Check for Submit button
      const submitBtn = page.locator('button:has-text("Submit application")').first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
        return { success: true };
      }

      // Click Next or Review
      const nextBtn = page
        .locator('button:has-text("Next"), button:has-text("Review"), button:has-text("Continue")')
        .first();

      if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextBtn.click();
        step++;
      } else {
        return { success: false, error: "Unexpected modal state — could not proceed" };
      }
    }

    return { success: false, error: "Exceeded max steps in Easy Apply flow" };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  } finally {
    await context.close();
  }
}
