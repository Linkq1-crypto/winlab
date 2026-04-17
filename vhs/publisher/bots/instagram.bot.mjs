// Instagram publisher — mobile viewport, session persistence, anti-ban
import { chromium } from "playwright";
import { existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import { humanDelay, humanType, MOBILE_CONTEXT } from "../utils/humanize.mjs";
import { log } from "../utils/logger.mjs";

const BASE = resolve(import.meta.dirname ?? ".", "..");

export async function loginInstagram(accountId = "main") {
  log.info(`[IG] Opening browser for manual login — account: ${accountId}`);
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext(MOBILE_CONTEXT);
  const page    = await context.newPage();

  await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "networkidle" });
  log.info("[IG] Log in manually in the browser window. Press ENTER here when done.");
  await new Promise(r => process.stdin.once("data", r));

  const sessionFile = resolve(BASE, `sessions/ig/${accountId}.json`);
  await context.storageState({ path: sessionFile });
  log.ok(`[IG] Session saved → ${sessionFile}`);
  await browser.close();
}

export async function publishInstagram({ caption, mediaPath, accountId = "main" }) {
  const sessionFile = resolve(BASE, `sessions/ig/${accountId}.json`);
  if (!existsSync(sessionFile)) throw new Error(`No IG session for ${accountId}. Run: node login.mjs --platform instagram`);

  const absMedia = resolve(BASE, "../output", mediaPath);
  if (!existsSync(absMedia)) throw new Error(`Media not found: ${absMedia}`);

  log.info(`[IG] Publishing to Instagram`, { accountId, media: mediaPath });

  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const context = await browser.newContext({ ...MOBILE_CONTEXT, storageState: sessionFile });
  const page    = await context.newPage();

  try {
    await page.goto("https://www.instagram.com/", { waitUntil: "networkidle" });
    await humanDelay();

    // Dismiss any dialog/cookie popup
    try { await page.click('[aria-label="Close"]', { timeout: 3000 }); await humanDelay(500, 1200); } catch {}
    try { await page.click('button:has-text("Allow")', { timeout: 2000 }); } catch {}

    // Click the + (new post) button
    await page.click('[aria-label="New post"]');
    await humanDelay(1500, 3000);

    // Upload file
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.click('[aria-label="New post"]').catch(() => {}),
    ]);
    await fileChooser.setFiles(absMedia);
    await humanDelay(2000, 4000);

    // Next → Next → caption → Share
    await page.click('button:has-text("Next")');
    await humanDelay();
    await page.click('button:has-text("Next")');
    await humanDelay();

    // Write caption
    const captionBox = page.locator("textarea, [role='textbox']").first();
    await captionBox.click();
    await humanDelay(600, 1200);
    await humanType(page, "textarea, [role='textbox']", caption);
    await humanDelay(1000, 2500);

    // Share
    await page.click('button:has-text("Share")');
    await humanDelay(3000, 6000);

    // Save updated session
    await context.storageState({ path: sessionFile });
    log.ok("[IG] Published successfully");
  } catch (err) {
    // Screenshot on error for debugging
    const shot = resolve(BASE, `screenshots/ig_error_${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    log.error(`[IG] Error: ${err.message}`, { screenshot: shot });
    throw err;
  } finally {
    await browser.close();
  }
}
