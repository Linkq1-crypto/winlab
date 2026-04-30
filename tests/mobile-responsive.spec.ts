import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { width: 320, height: 700 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
];

const catalogPayload = {
  ok: true,
  starterIds: ['nginx-port-conflict', 'api-timeout'],
  labs: [
    {
      id: 'nginx-port-conflict',
      title: 'Nginx Port Conflict',
      difficulty: 'Easy',
      duration: '12 min',
      category: 'Starter',
      xp: 120,
      tags: ['nginx', 'ports'],
      status: 'ready',
    },
    {
      id: 'api-timeout',
      title: 'API Timeout Recovery',
      difficulty: 'Medium',
      duration: '18 min',
      category: 'Starter',
      xp: 180,
      tags: ['api', 'latency'],
      status: 'ready',
    },
  ],
};

async function mockApp(page) {
  await page.route('**/api/labs/catalog', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(catalogPayload) });
  });

  await page.route('**/api/early-access/seats', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ remaining: 17 }) });
  });

  await page.route('**/api/user/profile', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ aiMentorConsent: true }) });
  });

  await page.route('**/api/lab/start', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: 'mobile-session',
        containerName: 'winlab-mobile-shell',
        level: 'JUNIOR',
        hintEnabled: true,
        bootSequence: [],
      }),
    });
  });

  await page.route('**/api/lab/stop', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
}

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    doc: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }));

  expect(metrics.body).toBeLessThanOrEqual(metrics.inner + 1);
  expect(metrics.doc).toBeLessThanOrEqual(metrics.inner + 1);
}

test.describe('mobile responsiveness smoke', () => {
  for (const viewport of VIEWPORTS) {
    test(`homepage stays usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockApp(page);
      await page.goto('/');

      const cta = page.getByRole('button', { name: /Launch Free Labs/i });
      await expect(cta).toBeVisible();
      await expect(page.getByText('WinLab Operational Terminal')).toBeVisible();

      const headline = page.getByRole('heading', { name: /Real labs\. Small screen safe\./i });
      await expect(headline).toBeVisible();
      const heroBox = await headline.boundingBox();
      const ctaBox = await cta.boundingBox();
      expect(heroBox && ctaBox).toBeTruthy();
      expect(ctaBox.y).toBeGreaterThanOrEqual(heroBox.y);

      await cta.click();

      await expect(page.getByRole('heading', { name: /Operational Hub/i })).toBeVisible();
      await expect(page.getByText('Start In The Free Zone')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });

    test(`lab launch flow stays within viewport at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockApp(page);
      await page.goto('/');

      await page.getByRole('button', { name: /Launch Free Labs/i }).click();
      await page.getByRole('button', { name: /Nginx Port Conflict/i }).first().click();
      await page.getByRole('button', { name: /Launch Session/i }).click();

      await expect(page.getByText('Live Incident Terminal')).toBeVisible();
      const terminalWrapper = page.locator('.winlab-xterm-shell').first();
      await expect(terminalWrapper).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const bounds = await terminalWrapper.boundingBox();
      expect(bounds).toBeTruthy();
      expect(Math.ceil(bounds.x + bounds.width)).toBeLessThanOrEqual(viewport.width + 1);
    });
  }
});
