// LinkedIn publisher — desktop, most stable platform for Playwright
import { chromium } from "playwright";
import { existsSync } from "fs";
import { resolve } from "path";
import { humanDelay, humanType, DESKTOP_CONTEXT } from "../utils/humanize.mjs";
import { log } from "../utils/logger.mjs";

const BASE = resolve(import.meta.dirname ?? ".", "..");

export async function loginLinkedIn(accountId = "main") {
  log.info(`[LI] Opening browser for manual login — account: ${accountId}`);
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext(DESKTOP_CONTEXT);
  const page    = await context.newPage();

  await page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle" });
  log.info("[LI] Log in manually. Press ENTER here when on the feed.");
  await new Promise(r => process.stdin.once("data", r));

  const sessionFile = resolve(BASE, `sessions/linkedin/${accountId}.json`);
  await context.storageState({ path: sessionFile });
  log.ok(`[LI] Session saved → ${sessionFile}`);
  await browser.close();
}

export async function publishLinkedIn({ caption, mediaPath, accountId = "main" }) {
  const sessionFile = resolve(BASE, `sessions/linkedin/${accountId}.json`);
  if (!existsSync(sessionFile)) throw new Error(`No LinkedIn session for ${accountId}. Run: node login.mjs --platform linkedin`);

  const absMedia = resolve(BASE, "../output", mediaPath);
  if (!existsSync(absMedia)) throw new Error(`Media not found: ${absMedia}`);

  log.info(`[LI] Publishing to LinkedIn`, { accountId, media: mediaPath });

  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext({ ...DESKTOP_CONTEXT, storageState: sessionFile });
  const page    = await context.newPage();

  try {
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "networkidle" });
    await humanDelay(2000, 4000);

    // Click "Start a post"
    await page.click('[data-control-name="share.sharebox_focus"], button:has-text("Start a post"), .share-box-feed-entry__trigger');
    await humanDelay(1500, 2500);

    // Add media first
    try {
      await page.click('[aria-label="Add a photo"]');
      await humanDelay();
    } catch {
      // Try video button
      try { await page.click('[aria-label="Add a video"]'); await humanDelay(); } catch {}
    }

    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.click('input[type="file"]').catch(() => {}),
    ]);
    await chooser.setFiles(absMedia);
    await humanDelay(4000, 8000);  // Video processing

    // Close the media preview back to the post composer
    try { await page.click('button:has-text("Done"), button:has-text("Next")'); await humanDelay(); } catch {}

    // Write caption in the text area
    const textbox = page.locator('[role="textbox"], .ql-editor').first();
    await textbox.click();
    await humanDelay(500, 1200);
    await humanType(page, '[role="textbox"], .ql-editor', caption);
    await humanDelay(1000, 2500);

    // Post
    await page.click('button:has-text("Post"), button[data-control-name="share.post"]');
    await humanDelay(3000, 6000);

    await context.storageState({ path: sessionFile });
    log.ok("[LI] Published successfully");
  } catch (err) {
    const shot = resolve(BASE, `screenshots/li_error_${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    log.error(`[LI] Error: ${err.message}`, { screenshot: shot });
    throw err;
  } finally {
    await browser.close();
  }
}
