import { Browser } from "playwright";
import type { ApplyResult } from "./linkedin";

export async function applyNaukri(
  browser: Browser,
  jobUrl: string
): Promise<ApplyResult> {
  const email = process.env.NAUKRI_EMAIL;
  const password = process.env.NAUKRI_PASSWORD;

  if (!email || !password) {
    return { success: false, error: "Naukri credentials not set" };
  }

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    // Login
    await page.goto("https://www.naukri.com/", { waitUntil: "networkidle" });

    // Click Login
    const loginLink = page.locator('a:has-text("Login"), a:has-text("Sign In")').first();
    if (await loginLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginLink.click();
    }

    await page.fill('input[placeholder*="Email"]', email);
    await page.fill('input[placeholder*="Password"], input[type="password"]', password);

    const loginBtn = page.locator('button:has-text("Login"), button:has-text("Sign in")').first();
    await loginBtn.click();
    await page.waitForTimeout(3000);

    // Navigate to job
    await page.goto(jobUrl, { waitUntil: "networkidle" });

    // Click Apply
    const applyBtn = page
      .locator('button:has-text("Apply"), a:has-text("Apply Now"), button:has-text("Apply Now")')
      .first();

    const applyVisible = await applyBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!applyVisible) {
      return { success: false, error: "Apply button not found on Naukri job page" };
    }

    await applyBtn.click();
    await page.waitForTimeout(2000);

    // Check for confirmation modal / success
    const confirmBtn = page
      .locator('button:has-text("Apply"), button:has-text("Submit")')
      .first();

    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }

    // Check success indicators
    const successText = page.locator(
      'text="Applied successfully", text="Application submitted", text="already applied"'
    ).first();

    const succeeded = await successText.isVisible({ timeout: 5000 }).catch(() => false);
    if (succeeded) return { success: true };

    return { success: false, error: "No success confirmation found after apply" };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  } finally {
    await context.close();
  }
}
