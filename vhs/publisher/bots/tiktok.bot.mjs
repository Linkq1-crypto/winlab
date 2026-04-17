// TikTok publisher — mobile viewport + human delays (TikTok is strict)
import { chromium } from "playwright";
import { existsSync } from "fs";
import { resolve } from "path";
import { humanDelay, humanType, MOBILE_CONTEXT } from "../utils/humanize.mjs";
import { log } from "../utils/logger.mjs";

const BASE = resolve(import.meta.dirname ?? ".", "..");

export async function loginTikTok(accountId = "main") {
  log.info(`[TT] Opening browser for manual login — account: ${accountId}`);
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  // TikTok upload works better on desktop
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport:  { width: 1280, height: 800 },
    locale: "en-US",
  });
  const page = await context.newPage();

  await page.goto("https://www.tiktok.com/login", { waitUntil: "networkidle" });
  log.info("[TT] Log in manually. Press ENTER when on the TikTok feed.");
  await new Promise(r => process.stdin.once("data", r));

  const sessionFile = resolve(BASE, `sessions/tiktok/${accountId}.json`);
  await context.storageState({ path: sessionFile });
  log.ok(`[TT] Session saved → ${sessionFile}`);
  await browser.close();
}

export async function publishTikTok({ caption, mediaPath, accountId = "main" }) {
  const sessionFile = resolve(BASE, `sessions/tiktok/${accountId}.json`);
  if (!existsSync(sessionFile)) throw new Error(`No TikTok session for ${accountId}. Run: node login.mjs --platform tiktok`);

  const absMedia = resolve(BASE, "../output", mediaPath);
  if (!existsSync(absMedia)) throw new Error(`Media not found: ${absMedia}`);

  log.info(`[TT] Publishing to TikTok`, { accountId, media: mediaPath });

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport:  { width: 1280, height: 800 },
    storageState: sessionFile,
  });
  const page = await context.newPage();

  try {
    await page.goto("https://www.tiktok.com/upload", { waitUntil: "networkidle" });
    await humanDelay(2000, 4000);

    // Upload the video
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.click('[class*="upload"], input[type="file"], [aria-label*="Upload"]').catch(() => {}),
    ]);
    await chooser.setFiles(absMedia);
    await humanDelay(5000, 10000);  // TikTok processing is slow

    // Caption
    const captionBox = page.locator('[data-text="true"], .public-DraftEditor-content, [contenteditable="true"]').first();
    await captionBox.click();
    await humanDelay(500, 1200);
    // Clear existing text and type caption (max 2200 chars, TikTok is ~150)
    await page.keyboard.selectAll();
    await page.keyboard.type(caption.slice(0, 150));
    await humanDelay(1000, 2000);

    // Post
    await page.click('button:has-text("Post"), button:has-text("Publish")');
    await humanDelay(5000, 10000);

    await context.storageState({ path: sessionFile });
    log.ok("[TT] Published successfully");
  } catch (err) {
    const shot = resolve(BASE, `screenshots/tt_error_${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    log.error(`[TT] Error: ${err.message}`, { screenshot: shot });
    throw err;
  } finally {
    await browser.close();
  }
}
