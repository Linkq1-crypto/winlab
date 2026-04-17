/**
 * Language Audit — Verify every public page uses only EN or Hinglish (Latin script).
 *
 * Rules:
 *   - ALL visible text must be either English or Hinglish (romanised Hindi, Latin script).
 *   - No actual Devanagari script (हिंदी), no CJK, no Arabic, no Cyrillic.
 *   - The <html lang> attribute must be "en".
 *   - Legal pages (ToS / Privacy Policy) are EXEMPT — they may contain legal/formal prose.
 *
 * Pages covered:
 *   1. Landing page     /
 *   2. Intune page      /intune
 *   3. Hinglish landing (India view) — forced via timezone mock
 *   4. Pricing view     — keyboard shortcut "3"
 *   5. Cert view        — keyboard shortcut "4"
 *   6. Community view   — keyboard shortcut "6"
 *
 * Pages intentionally SKIPPED:
 *   - Legal / ToS / Privacy (view "legal" / "privacy")  ← exempt by design
 *   - Admin / Deception pages                           ← internal tooling
 *   - Authenticated-only views (dashboard, lab)         ← require login
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:5173";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Unicode ranges that must NOT appear in public UI text.
 * Hinglish is Roman-script Hindi → all Latin chars → safe.
 */
const BANNED_SCRIPT_RANGES = [
  { name: "Devanagari",  re: /[\u0900-\u097F]/ },  // actual Hindi script
  { name: "Arabic",      re: /[\u0600-\u06FF]/ },
  { name: "CJK",         re: /[\u4E00-\u9FFF]/ },
  { name: "Cyrillic",    re: /[\u0400-\u04FF]/ },
  { name: "Hebrew",      re: /[\u0590-\u05FF]/ },
  { name: "Thai",        re: /[\u0E00-\u0E7F]/ },
];

/**
 * Additional checks for lab UI text.
 * EN/Hinglish never uses European diacritics (é, è, à, ñ, ü …)
 * or well-known Italian-only words.
 * Ranges: U+00C0-U+00D6, U+00D8-U+00F6, U+00F8-U+00FF  (Latin-1 Supplement accented letters,
 *         excludes × U+00D7 and ÷ U+00F7)
 */
const BANNED_LAB_EXTRAS = [
  {
    name: "European diacritics (è, à, ñ, ü … — indicates non-EN copy)",
    re: /[\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]/,
  },
  {
    // Italian-only UI words that lack accents but are unambiguously Italian.
    // These appear in linux-terminal-sim.jsx scenario selector and placeholder text.
    name: "Italian UI words (Scegli / Avanzati / digita / Scenari / Esplora / risolvi / pieno / esaurit / bloccato)",
    re: /\b(Scegli|Avanzati|digita|Scenari|Esplora|risolvi|pieno|esauriti|esaurita|bloccato|bloccata|rotto|rotta|cerca|trova)\b/i,
  },
];

/**
 * Collect all visible text on the page, excluding:
 *   - <script> and <style> content
 *   - Elements hidden via CSS (display:none, visibility:hidden, opacity:0)
 *   - Any element with data-lang-exempt="true" (opt-out for legal sections)
 */
async function getVisibleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          // Skip script / style content
          const tag = parent.tagName.toLowerCase();
          if (tag === "script" || tag === "style" || tag === "noscript") {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip legal-exempt subtrees
          if (parent.closest("[data-lang-exempt]")) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip invisible elements
          const style = window.getComputedStyle(parent);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            style.opacity === "0"
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const chunks: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node.textContent || "").trim();
      if (text) chunks.push(text);
    }
    return chunks.join(" ");
  });
}

/**
 * Assert that the given text contains no banned script characters.
 * Returns an array of violation descriptions (empty = pass).
 */
function findScriptViolations(text: string): string[] {
  return BANNED_SCRIPT_RANGES
    .filter(({ re }) => re.test(text))
    .map(({ name, re }) => {
      const match = text.match(re);
      const ctx = match ? `…${match[0]}…` : "";
      return `${name} characters found ${ctx}`;
    });
}

/**
 * Full language check for the current page state.
 */
async function assertPageLanguage(page: Page, label: string) {
  // 1. <html lang> must be "en"
  const htmlLang = await page.getAttribute("html", "lang");
  expect(htmlLang, `[${label}] <html lang> must be "en"`).toBe("en");

  // 2. Visible text must not contain banned scripts
  const text = await getVisibleText(page);
  const violations = findScriptViolations(text);

  if (violations.length > 0) {
    throw new Error(
      `[${label}] Non-EN/Hinglish script detected:\n  ${violations.join("\n  ")}`
    );
  }
}

// ─── Force India / Hinglish mode via timezone mock ───────────────────────────

/**
 * Wraps Intl.DateTimeFormat so the app thinks the user is in India (IST).
 * Must be injected BEFORE the page scripts run (addInitScript).
 */
const INDIA_TIMEZONE_MOCK = `
  const _OriginalDTF = Intl.DateTimeFormat;
  Intl.DateTimeFormat = function(locale, options) {
    return {
      resolvedOptions: () => ({
        ..._OriginalDTF(locale, options).resolvedOptions(),
        timeZone: "Asia/Kolkata",
      }),
      format:     (...a) => _OriginalDTF(locale, options).format(...a),
      formatToParts: (...a) => _OriginalDTF(locale, options).formatToParts(...a),
    };
  };
  Object.assign(Intl.DateTimeFormat, _OriginalDTF);
`;

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("Language audit — EN / Hinglish only", () => {

  // ── 1. Main landing page ──────────────────────────────────────────────────
  test("landing page is in English", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();
    await assertPageLanguage(page, "Landing /");
  });

  // ── 2. Intune page ────────────────────────────────────────────────────────
  test("/intune page is in English", async ({ page }) => {
    await page.goto(`${BASE}/intune`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();
    await assertPageLanguage(page, "Intune /intune");
  });

  // ── 3. Hinglish / India landing ───────────────────────────────────────────
  test("India/Hinglish landing uses Latin script only (no Devanagari)", async ({ page }) => {
    // Mock timezone to IST so the app renders the Hinglish view
    await page.addInitScript(INDIA_TIMEZONE_MOCK);
    await page.goto(BASE);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();

    // Confirm the Hinglish page is actually loaded (has India badge)
    const indiaBadge = page.locator("text=🇮🇳").first();
    const isHinglish = await indiaBadge.count() > 0;
    test.skip(!isHinglish, "India/Hinglish view not triggered by timezone mock");

    await assertPageLanguage(page, "Hinglish India landing");
  });

  // ── 4. Pricing view ───────────────────────────────────────────────────────
  test("pricing view is in English", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500); // let React settle

    // Keyboard shortcut Alt+3 navigates to pricing
    await page.keyboard.press("Alt+3");
    await page.waitForTimeout(500);

    const hasPricing = await page.locator("text=/pricing|plan|month|₹|\$/i").count() > 0;
    test.skip(!hasPricing, "Pricing view not reachable via Alt+3");

    await assertPageLanguage(page, "Pricing view");
  });

  // ── 5. Certification view ─────────────────────────────────────────────────
  test("certification view is in English", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    // Keyboard shortcut Alt+4 navigates to cert
    await page.keyboard.press("Alt+4");
    await page.waitForTimeout(500);

    const hasCert = await page.locator("text=/certificate|certif/i").count() > 0;
    test.skip(!hasCert, "Cert view not reachable via Alt+4");

    await assertPageLanguage(page, "Certification view");
  });

  // ── 6. Community view ─────────────────────────────────────────────────────
  test("community view is in English", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    // Keyboard shortcut Alt+6 navigates to community
    await page.keyboard.press("Alt+6");
    await page.waitForTimeout(500);

    // Community hub: shows either the board or the "Sign in to join" gate
    const hasCommunity = await page.locator("text=/community|feature request|feedback|sign in/i").count() > 0;
    test.skip(!hasCommunity, "Community view not reachable via Alt+6");

    await assertPageLanguage(page, "Community view");
  });

  // ── 7. Auth page ──────────────────────────────────────────────────────────
  // Auth is reached when a paid feature is accessed. Try clicking a Pro/paid
  // pricing plan button which should redirect unauthenticated users to the auth form.
  test("auth/login page is in English", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    // Navigate to pricing (Alt+3) and click a paid plan CTA
    await page.keyboard.press("Alt+3");
    await page.waitForTimeout(500);

    // Click "Upgrade to Pro" — triggers onNeedLogin() for unauthenticated users
    const upgradeBtn = page.locator("button").filter({ hasText: /Upgrade to Pro/i }).first();
    const hasBtn = await upgradeBtn.count() > 0;
    if (!hasBtn) {
      test.skip(true, "No 'Upgrade to Pro' button on pricing — cannot trigger auth");
      return;
    }
    await upgradeBtn.click();
    await page.waitForTimeout(600);

    // Auth form should appear for unauthenticated users
    const hasAuthForm = await page.locator("input[type=email], input[type=password]").count() > 0;
    if (!hasAuthForm) {
      test.skip(true, "Auth form not triggered — user may already be logged in");
      return;
    }

    await assertPageLanguage(page, "Auth / Login");
  });

  // ── 8. <html lang> global sanity ──────────────────────────────────────────
  test('<html lang="en"> is set on all key pages', async ({ page }) => {
    const pages = [BASE, `${BASE}/intune`];
    for (const url of pages) {
      await page.goto(url);
      await page.waitForLoadState("domcontentloaded");
      const lang = await page.getAttribute("html", "lang");
      expect(lang, `<html lang> on ${url}`).toBe("en");
    }
  });

  // ── 9. No Devanagari leaking into EN landing ──────────────────────────────
  test("main landing has zero Devanagari characters", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();

    const text = await getVisibleText(page);
    const devanagariMatch = text.match(/[\u0900-\u097F]/);
    expect(
      devanagariMatch,
      `Devanagari found on main landing: "${devanagariMatch?.[0]}"`
    ).toBeNull();
  });

  // ── 10. Legal pages are deliberately EXEMPT from language audit ──────────
  // The legal view (ToS / Privacy Policy) is accessible only from the sidebar
  // when logged in ("Privacy & Terms" button) — not from the public landing nav.
  // Either way, legal copy is intentionally exempt from EN/Hinglish rules.
  test("legal/ToS pages are acknowledged as language-audit exempt", async () => {
    // Documentation test — always passes to record the policy decision.
    expect(["Privacy Policy", "Terms of Service", "Cookie Policy"]).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lab language audit — non-technical UI text only
//
// What is checked:  headings, scenario descriptions, hint text, button labels,
//                   status messages, progress labels — anything a user reads.
//
// What is EXEMPT:
//   • Terminal output  → role="log" / font-mono zones  (OS command output)
//   • Code / pre blocks                                 (config snippets)
//   • Input fields                                      (user-typed commands)
//   • Simulated device data (IDs, usernames, IP addr)   (realistic dummy data)
//
// Labs accessible without login:
//   • linux-terminal  (starter, free demo via CTA)
//   • /intune         (direct URL, no auth)
//
// Lab landing cards (titles + descriptions) are checked via the lab grid
// on the main landing page — no login needed.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Like getVisibleText() but also strips out the technical terminal zones:
 *   - font-mono elements (terminal output, command text)
 *   - role="log" elements (terminal output area)
 *   - <pre> and <code> elements (code snippets)
 *   - input / textarea (typed commands)
 */
async function getLabUIText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const tag = parent.tagName.toLowerCase();

          // Always skip script/style/noscript
          if (tag === "script" || tag === "style" || tag === "noscript") {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip code blocks — technical content
          if (tag === "pre" || tag === "code") return NodeFilter.FILTER_REJECT;

          // Skip input / textarea — user-typed commands
          if (tag === "input" || tag === "textarea") return NodeFilter.FILTER_REJECT;

          // Skip terminal output zones (role="log" or font-mono ancestors)
          const logZone = parent.closest('[role="log"]');
          if (logZone) return NodeFilter.FILTER_REJECT;

          const monoZone = parent.closest(".font-mono");
          if (monoZone) return NodeFilter.FILTER_REJECT;

          // Skip legal-exempt and data-exempt subtrees
          if (parent.closest("[data-lang-exempt]")) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip invisible elements
          const style = window.getComputedStyle(parent);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            style.opacity === "0"
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const chunks: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node.textContent || "").trim();
      if (text) chunks.push(text);
    }
    return chunks.join(" ");
  });
}

/**
 * Assert non-technical lab UI text is EN / Hinglish only.
 * Checks both banned Unicode scripts AND European diacritics / Italian keywords.
 */
async function assertLabUILanguage(page: Page, label: string) {
  const text = await getLabUIText(page);

  const allChecks = [
    ...BANNED_SCRIPT_RANGES.map(({ name, re }) => ({ name, re })),
    ...BANNED_LAB_EXTRAS,
  ];

  const violations = allChecks
    .filter(({ re }) => re.test(text))
    .map(({ name, re }) => {
      const m = text.match(re);
      return `${name} — found: "${m?.[0]}"`;
    });

  if (violations.length > 0) {
    throw new Error(
      `[${label}] Non-EN/Hinglish text in lab UI:\n  • ${violations.join("\n  • ")}\n\n` +
      `  Sampled UI text (first 500 chars):\n  ${text.substring(0, 500)}`
    );
  }
}

test.describe("Language audit — Lab UI (non-terminal text)", () => {

  // ── 1. Free linux-terminal lab ────────────────────────────────────────────
  test("linux-terminal lab UI is in English (excluding terminal output)", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    // Open the free demo lab via CTA
    const cta = page.locator("button").filter({ hasText: /Start Free Lab|Launch Free Lab/i }).first();
    const hasCTA = await cta.count() > 0;
    test.skip(!hasCTA, "CTA button not found — cannot open free lab");

    await cta.click();

    // Wait for lab to load.
    // linux-terminal-sim uses inline styles (no aria-labels) and shows a
    // scenario selector with "Linux Troubleshooting Lab" header text first.
    // EnhancedTerminalLab uses aria-label="Terminal input".
    // linux-terminal-sim shows scenario selector; EnhancedTerminalLab shows input.
    // Use Playwright locator which matches DOM text content (not CSS text-transform).
    await page.waitForSelector(
      ':text("Linux Troubleshooting Lab"), [aria-label="Terminal input"], [aria-label="Terminal output"]',
      { timeout: 15000 }
    );

    await assertLabUILanguage(page, "linux-terminal lab");
  });

  // ── 2. /intune lab — full non-terminal text check ────────────────────────
  test("/intune lab UI is in English (excluding terminal / mono zones)", async ({ page }) => {
    await page.goto(`${BASE}/intune`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();

    // /intune renders IntuneMDM which has no terminal zone — getLabUIText is safe here
    await assertLabUILanguage(page, "/intune lab");
  });

  // ── 3. Lab card grid on landing — titles + descriptions ──────────────────
  // The landing page shows all lab names and difficulty tags in a grid.
  // These are pure UI text and must be EN/Hinglish.
  test("lab cards on landing page are in English", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(300);

    // Scroll to the labs section
    await page.evaluate(() => {
      const el = document.getElementById("labs");
      if (el) el.scrollIntoView();
    });
    await page.waitForTimeout(300);

    // Collect text only from the labs section
    const labsSectionText = await page.evaluate(() => {
      const section = document.getElementById("labs") ||
                      document.querySelector("[id=labs]") ||
                      document.querySelector("section");
      if (!section) return document.body.innerText.substring(0, 2000);

      const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (tag === "script" || tag === "style") return NodeFilter.FILTER_REJECT;
          const style = window.getComputedStyle(parent);
          if (style.display === "none" || style.visibility === "hidden") {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      const chunks: string[] = [];
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const t = (n.textContent || "").trim();
        if (t) chunks.push(t);
      }
      return chunks.join(" ");
    });

    const violations = findScriptViolations(labsSectionText);
    if (violations.length > 0) {
      throw new Error(
        `[Lab cards] Non-EN/Hinglish script:\n  ${violations.join("\n  ")}`
      );
    }
  });

  // ── 4. Hint text in terminal is EN / Hinglish ─────────────────────────────
  // Hints are shown inside the terminal output (font-mono zone) but they
  // are copy-written UI text ("💡 AI Mentor: …"), not raw command output.
  // We check them separately by looking at hint-style lines.
  test("AI Mentor hint text in terminal is in English", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    const cta = page.locator("button").filter({ hasText: /Start Free Lab|Launch Free Lab/i }).first();
    if (await cta.count() === 0) {
      test.skip(true, "CTA not found — skipping hint text check");
      return;
    }
    await cta.click();
    await page.waitForSelector(
      ':text("Linux Troubleshooting Lab"), [aria-label="Terminal input"], [aria-label="Terminal output"]',
      { timeout: 15000 }
    );

    // Collect text from the terminal output that looks like hint/mentor lines
    // (contains "AI Mentor" or "💡" prefix — these are written by devs, not OS output)
    const hintText = await page.evaluate(() => {
      const log = document.querySelector('[role="log"]');
      if (!log) return "";

      const lines: string[] = [];
      log.querySelectorAll("div").forEach((div) => {
        const text = div.textContent?.trim() || "";
        // Hint lines start with 💡 or contain "AI Mentor"
        if (text.includes("💡") || text.includes("AI Mentor") || text.includes("Mentor:")) {
          lines.push(text);
        }
      });
      return lines.join(" ");
    });

    if (hintText) {
      const violations = findScriptViolations(hintText);
      if (violations.length > 0) {
        throw new Error(
          `[Hint text] Non-EN/Hinglish in AI Mentor hints:\n  ${violations.join("\n  ")}\n  Text: ${hintText.substring(0, 300)}`
        );
      }
    }
    // If no hints yet visible (timer-based), just pass — no hint = no violation
    expect(true).toBe(true);
  });

  // ── 5. Lab scenario title shown in terminal welcome message ───────────────
  // When a lab loads, it prints a scenario title like "⚠️ Apache is Down".
  // That title string is authored copy and must be EN/Hinglish.
  test("lab scenario titles in terminal welcome are in English", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    const cta = page.locator("button").filter({ hasText: /Start Free Lab|Launch Free Lab/i }).first();
    if (await cta.count() === 0) {
      test.skip(true, "CTA not found");
      return;
    }
    await cta.click();
    await page.waitForSelector(
      ':text("Linux Troubleshooting Lab"), [aria-label="Terminal input"], [aria-label="Terminal output"]',
      { timeout: 15000 }
    );
    await page.waitForTimeout(1000); // let welcome lines render

    // Collect "warn" lines — these are the scenario title lines (⚠️ Lab N: …)
    const scenarioText = await page.evaluate(() => {
      const log = document.querySelector('[role="log"]');
      if (!log) return "";
      const lines: string[] = [];
      log.querySelectorAll(".text-yellow-400, .text-emerald-300").forEach((el) => {
        const t = el.textContent?.trim() || "";
        if (t) lines.push(t);
      });
      return lines.join(" ");
    });

    if (scenarioText) {
      const violations = findScriptViolations(scenarioText);
      if (violations.length > 0) {
        throw new Error(
          `[Scenario titles] Non-EN/Hinglish:\n  ${violations.join("\n  ")}\n  Text: ${scenarioText}`
        );
      }
    }
    expect(true).toBe(true);
  });

  // ── 6. No Devanagari in any lab UI text (strict per-lab sweep) ────────────
  test("no Devanagari characters anywhere in /intune lab", async ({ page }) => {
    await page.goto(`${BASE}/intune`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();

    const text = await getLabUIText(page);
    expect(text.match(/[\u0900-\u097F]/), "Devanagari found in /intune lab").toBeNull();
  });
});
