import { test, expect } from '@playwright/test';

test('no runtime errors on load', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000);

  const errors = await page.evaluate(() => {
    return window.__QA_HEALTH__?.errors || 0;
  });

  expect(errors).toBe(0);
});

test('app renders without crashing', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#root')).toBeVisible();
});

test('no 404 on main routes', async ({ page }) => {
  const routes = ['/', '/pricing', '/about'];
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status()).toBeLessThan(400);
  }
});
