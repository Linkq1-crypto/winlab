// FB + IG publisher — Meta Business Suite Composer (production-grade)
// Strategia dal PDF:
//   → URL diretto al composer (no navigazione fragile)
//   → getByRole (no classi CSS che cambiano)
//   → toggle IG abilitato → 1 post → FB + IG insieme
//   → popup handler IT/EN
//   → publish con retry
import { chromium } from "playwright";
import { existsSync } from "fs";
import { resolve } from "path";
import { log } from "../utils/logger.mjs";

const BASE = resolve(import.meta.dirname ?? ".", "..");

// ── Login (una volta sola) ────────────────────────────────────────────────────
export async function loginFacebook(accountId = "main") {
  log.info(`[FB] Login manuale — account: ${accountId}`);
  const browser = await chromium.launch({ headless: false, args: ["--start-maximized"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page    = await context.newPage();

  await page.goto("https://www.facebook.com/login", { waitUntil: "networkidle" });
  log.info("[FB] Fai login manualmente nel browser, poi premi ENTER qui.");
  await new Promise(r => process.stdin.once("data", r));

  const sessionFile = resolve(BASE, `sessions/fb/${accountId}.json`);
  await context.storageState({ path: sessionFile });
  log.ok(`[FB] Sessione salvata → ${sessionFile}`);
  await browser.close();
}

// ── Publish FB + IG insieme ───────────────────────────────────────────────────
export async function publishFacebook({ caption, mediaPath, accountId = "main" }) {
  const sessionFile = resolve(BASE, `sessions/fb/${accountId}.json`);
  if (!existsSync(sessionFile))
    throw new Error(`Nessuna sessione FB per ${accountId}. Esegui: node login.mjs --platform facebook`);

  const absMedia = resolve(BASE, "../output", mediaPath);
  if (!existsSync(absMedia)) throw new Error(`Media non trovato: ${absMedia}`);

  log.info(`[FB+IG] Pubblicazione via Meta Business Suite`, { accountId, media: mediaPath });

  const browser = await chromium.launch({ headless: false, args: ["--start-maximized"] });
  const context = await browser.newContext({
    storageState: sessionFile,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    // ── 1. Vai diretto al composer (URL stabile) ─────────────────────────────
    await page.goto("https://business.facebook.com/latest/posts/composer", {
      waitUntil: "domcontentloaded",
    });
    await safeWait(page);

    // ── 2. Chiudi popup se presenti ──────────────────────────────────────────
    await closePopups(page);

    // ── 3. Abilita Instagram toggle → 1 post → FB + IG ──────────────────────
    await enableInstagramIfNeeded(page);

    // ── 4. Scrivi caption ────────────────────────────────────────────────────
    await fillCaption(page, caption);

    // ── 5. Upload media ──────────────────────────────────────────────────────
    await uploadMedia(page, absMedia);

    // ── 6. Pubblica (con retry) ──────────────────────────────────────────────
    await publish(page);

    // ── 7. Salva sessione aggiornata ─────────────────────────────────────────
    await context.storageState({ path: sessionFile });
    log.ok("[FB+IG] Pubblicato con successo");
  } catch (err) {
    const shot = resolve(BASE, `screenshots/fbig_error_${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    log.error(`[FB+IG] Errore: ${err.message}`, { screenshot: shot });
    throw err;
  } finally {
    await browser.close();
  }
}

// ── Funzioni robuste (core) ───────────────────────────────────────────────────

async function safeWait(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);
}

async function closePopups(page) {
  const labels = ["Chiudi", "Close", "Not now", "Ora no", "Non ora", "Dismiss", "OK"];
  for (const name of labels) {
    try {
      const btn = page.getByRole("button", { name });
      if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    } catch {}
  }
}

async function enableInstagramIfNeeded(page) {
  // Cerca il toggle Instagram nel composer — se presente lo attiva
  // Questo fa sì che 1 publish → FB + IG insieme
  try {
    const igToggle = page.getByText(/instagram/i).first();
    if (await igToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await igToggle.click();
      log.info("[FB+IG] Toggle Instagram attivato");
      await page.waitForTimeout(800);
    }
  } catch {}
}

async function fillCaption(page, caption) {
  // Prova prima getByRole (più stabile)
  try {
    const textbox = page.getByRole("textbox").first();
    if (await textbox.isVisible({ timeout: 4000 })) {
      await textbox.click();
      await textbox.fill(caption);
      return;
    }
  } catch {}

  // Fallback: contenteditable
  const fallback = page.locator('[contenteditable="true"]').first();
  await fallback.click();
  await fallback.fill(caption);
}

async function uploadMedia(page, absMediaPath) {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(absMediaPath);
  // Aspetta processing video (può richiedere tempo)
  await page.waitForTimeout(4000);
}

async function publish(page) {
  const publishBtn = page.getByRole("button", { name: /pubblica|publish/i });

  for (let i = 0; i < 3; i++) {
    if (await publishBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await publishBtn.click();
      log.info("[FB+IG] Click su Pubblica");
      await page.waitForTimeout(4000);
      return;
    }
    await page.waitForTimeout(1000);
  }

  throw new Error("Bottone Pubblica non trovato dopo 3 tentativi");
}
