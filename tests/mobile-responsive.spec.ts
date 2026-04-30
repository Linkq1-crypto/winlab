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

  await page.route('**/api/user/ai-consent', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
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

  await page.route('**/api/ai/help', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hint: 'Check the nginx service status first.' }),
    });
  });

  await page.route('**/api/ai/mentor-feedback', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, id: 'feedback-mobile-smoke' }),
    });
  });

  await page.route('**/api/health*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
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

  test('install prompt stays non-blocking on mobile and pricing remains usable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockApp(page);
    await page.goto('/');

    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt');
      Object.defineProperty(event, 'prompt', {
        value: () => Promise.resolve(),
      });
      Object.defineProperty(event, 'userChoice', {
        value: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
      });
      window.dispatchEvent(event);
    });

    const prompt = page.getByTestId('pwa-install-prompt');
    await expect(prompt).toBeVisible();

    const cta = page.getByRole('button', { name: /Launch Free Labs/i });
    const promptBox = await prompt.boundingBox();
    const ctaBox = await cta.boundingBox();
    expect(promptBox && ctaBox).toBeTruthy();
    expect(ctaBox!.y + ctaBox!.height).toBeLessThanOrEqual(promptBox!.y + 1);

    await page.getByRole('button', { name: /Dismiss install prompt/i }).click();
    await expect(prompt).toBeHidden();

    await page.getByRole('button', { name: /Launch Free Labs/i }).click();
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: /Get Early Access/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Go Pro/i })).toBeVisible();
  });

  test('mobile lab keeps terminal and AI Mentor usable while service worker leaves api health uncached', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockApp(page);

    await page.goto('/');
    const serviceWorkerReady = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;

      return await Promise.race([
        navigator.serviceWorker.ready.then(() => true).catch(() => false),
        new Promise((resolve) => setTimeout(() => resolve(false), 3000)),
      ]);
    });
    expect(typeof serviceWorkerReady).toBe('boolean');

    const healthCacheStatus = await page.evaluate(async () => {
      const urls = ['/api/health', '/api/health?probe=2'];
      const statuses = [];

      for (const url of urls) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 2000);

        try {
          const response = await fetch(url, {
            credentials: 'include',
            signal: controller.signal,
          });
          statuses.push(response.status);
        } catch {
          statuses.push(null);
        } finally {
          window.clearTimeout(timeoutId);
        }
      }

      const cacheKeys = await caches.keys();
      let cachedMatches = 0;

      for (const cacheKey of cacheKeys) {
        const cache = await caches.open(cacheKey);
        for (const url of urls) {
          if (await cache.match(url)) {
            cachedMatches += 1;
          }
        }
      }

      return { statuses, cacheKeys, cachedMatches };
    });

    expect(healthCacheStatus.statuses.length).toBe(2);
    expect(healthCacheStatus.cachedMatches).toBe(0);

    await page.getByRole('button', { name: /Launch Free Labs/i }).click();
    await page.getByRole('button', { name: /Nginx Port Conflict/i }).first().click();
    await page.getByRole('button', { name: /Launch Session/i }).click();

    await expect(page.getByText('Live Incident Terminal')).toBeVisible();

    const helperFocused = await page.locator('.xterm-helper-textarea').evaluate((node) => {
      node.focus();
      return document.activeElement === node;
    });
    expect(helperFocused).toBe(true);

    await page.locator('button[title="AI Mentor"]').click();
    const enableMentorButton = page.getByRole('button', { name: /Enable AI Mentor/i });
    if (await enableMentorButton.isVisible().catch(() => false)) {
      await enableMentorButton.click();
    }
    await expect(page.getByPlaceholder('Ask a question...')).toBeVisible();
    await page.getByPlaceholder('Ask a question...').fill('what should I check first?');
    await page.getByRole('button', { name: /Send/i }).click();
    await expect(page.getByText(/Check the nginx service status first\./i)).toBeVisible();

    await page.locator('button[title="Close AI Mentor"]').click();
    await expect(page.getByPlaceholder('Ask a question...')).toBeHidden();
    const helperRefocused = await page.locator('.xterm-helper-textarea').evaluate((node) => {
      node.focus();
      return document.activeElement === node;
    });
    expect(helperRefocused).toBe(true);
  });
});
