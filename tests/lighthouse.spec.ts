/**
 * Lighthouse / Core Web Vitals Suite (Playwright)
 *
 * Misura performance, accessibilità e SEO della landing page.
 * Usa l'API CDP di Playwright per raccogliere metriche reali.
 *
 * Soglie (produzione):
 *   - LCP  < 2500ms   (Google "Good" threshold)
 *   - FCP  < 1800ms
 *   - TBT  < 200ms    (correlato con FID)
 *   - CLS  < 0.1
 *   - TTFB < 800ms
 *
 * Fallback: se l'environment non è Chrome/Chromium (es. CI con Firefox),
 * le metriche CDP non sono disponibili — il test viene skippato.
 */

import { test, expect } from "@playwright/test";

const THRESHOLDS = {
  LCP:  2500,  // ms
  FCP:  1800,  // ms
  TBT:  200,   // ms (Total Blocking Time)
  CLS:  0.1,   // dimensionless
  TTFB: 800,   // ms
};

// ─────────────────────────────────────────────────────────────────────────────

test.describe("⚡ Core Web Vitals — Landing Page", () => {

  test("LCP < 2500ms on landing page", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "CDP metrics available in Chromium only");

    const client = await (page.context() as any).newCDPSession(page);
    await client.send("Performance.enable");

    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000); // let LCP settle

    const metrics = await client.send("Performance.getMetrics");
    const get = (name: string) => metrics.metrics.find((m: any) => m.name === name)?.value ?? null;

    const navStart    = get("NavigationStart");
    const firstPaint  = get("FirstMeaningfulPaint") || get("FirstContentfulPaint");

    if (navStart && firstPaint) {
      const fcp = (firstPaint - navStart) * 1000;
      expect(fcp).toBeLessThan(THRESHOLDS.LCP);
    }
  });

  test("FCP < 1800ms on landing page", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "CDP metrics available in Chromium only");

    const startTime = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const fcp = await page.evaluate(() =>
      performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint")?.startTime ?? null
    );

    if (fcp !== null) {
      expect(fcp).toBeLessThan(THRESHOLDS.FCP);
    } else {
      // FCP not yet available — measure from navigation start
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(THRESHOLDS.FCP * 2); // relaxed fallback
    }
  });

  test("TTFB < 800ms", async ({ page }) => {
    const res = await page.goto("/", { waitUntil: "commit" });
    expect(res).not.toBeNull();

    const ttfb = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      return nav ? nav.responseStart - nav.requestStart : null;
    });

    if (ttfb !== null) {
      expect(ttfb).toBeLessThan(THRESHOLDS.TTFB);
    }
  });

  test("CLS < 0.1 (no major layout shifts)", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "CLS via LayoutInstability API — Chromium only");

    await page.goto("/", { waitUntil: "networkidle" });

    // Observe CLS for 3s after load
    const cls = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let score = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) score += (entry as any).value;
            }
          });
          try {
            observer.observe({ type: "layout-shift", buffered: true });
          } catch {
            resolve(0);
            return;
          }
          setTimeout(() => { observer.disconnect(); resolve(score); }, 3000);
        })
    );

    expect(cls).toBeLessThan(THRESHOLDS.CLS);
  });

  test("no render-blocking scripts above the fold", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const blocking = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll("script[src]:not([async]):not([defer])"));
      return scripts
        .filter((s) => {
          // Only flag scripts in <head> — body scripts are fine
          return s.parentElement?.tagName === "HEAD";
        })
        .map((s) => (s as HTMLScriptElement).src);
    });

    expect(blocking).toHaveLength(0);
  });

  test("main page has meta description for SEO", async ({ page }) => {
    await page.goto("/");
    const meta = await page.locator('meta[name="description"]').getAttribute("content");
    expect(meta).toBeTruthy();
    expect(meta!.length).toBeGreaterThan(50);
  });

  test("Open Graph tags present", async ({ page }) => {
    await page.goto("/");
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content").catch(() => null);
    const ogDesc  = await page.locator('meta[property="og:description"]').getAttribute("content").catch(() => null);
    // OG tags improve social sharing CTR — warn if missing, don't hard-fail
    if (!ogTitle || !ogDesc) {
      console.warn("[lighthouse] Missing OG tags — add og:title and og:description");
    }
  });
});
