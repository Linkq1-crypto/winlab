/**
 * Mobile tests — Verify responsive layout on smartphone viewports
 */

import { test, expect, devices } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('mobile layout', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent: devices['iPhone 13']?.userAgent,
  });

  test('landing page renders on mobile', async ({ page }) => {
    await page.goto(BASE);

    // Verify no layout breakage
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check no horizontal scroll (common mobile bug)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // 5px tolerance
  });

  test('intune page works on mobile', async ({ page }) => {
    await page.goto(`${BASE}/intune`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('buttons are tappable on mobile', async ({ page }) => {
    await page.goto(BASE);

    // Usa il CTA principale — stabile, non naviga via dal dominio
    const cta = page.locator('button:has-text("Launch Free Lab"), button:has-text("Free Lab Start Karo"), button:has-text("Start First Lab")');
    const ctaCount = await cta.count();

    if (ctaCount > 0) {
      await cta.first().click();
      // Dopo il tap la pagina deve continuare a rispondere
      await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    } else {
      // Fallback: almeno un elemento interattivo esiste
      const buttons = page.locator('button, [role="button"]');
      expect(await buttons.count()).toBeGreaterThan(0);
    }
  });

  test('text is readable on mobile', async ({ page }) => {
    await page.goto(BASE);

    // Check that text elements are visible and not clipped
    const headings = page.locator('h1, h2, h3');
    const count = await headings.count();

    if (count > 0) {
      await expect(headings.first()).toBeVisible();
      const fontSize = await headings.first().evaluate((el) =>
        parseInt(window.getComputedStyle(el).fontSize)
      );
      expect(fontSize).toBeGreaterThan(12); // Minimum readable size
    }
  });
});

test.describe('android layout', () => {
  test.use({
    viewport: { width: 412, height: 915 },
    userAgent: devices['Pixel 5']?.userAgent,
  });

  test('landing page renders on Android', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('body')).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });
});

test.describe('slow 3G simulation (mobile)', () => {
  test.use({
    viewport: { width: 390, height: 844 },
  });

  test('app loads on slow network', async ({ page, context }) => {
    // Simulate slow 3G
    await context.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    });

    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('body')).toBeVisible();
  });
});
