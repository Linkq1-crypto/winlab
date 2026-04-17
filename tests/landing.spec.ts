import { test, expect } from '@playwright/test';

test('landing page loads with hero section', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});

test('CTA button is visible', async ({ page }) => {
  await page.goto('/');
  // Use first() to avoid strict mode violation (there are 2 CTA buttons)
  await expect(page.getByRole('button', { name: /Launch Free Lab/i }).first()).toBeVisible();
});

test('scenario section is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Scenario 1')).toBeVisible();
});

test('terminal preview renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('systemctl status nginx')).toBeVisible();
});
