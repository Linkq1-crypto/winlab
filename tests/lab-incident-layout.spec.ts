import { expect, test } from '@playwright/test';

const LAUNCH_FREE_LAB_LABEL = /Launch Free Lab(s)?/i;

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
];

const catalogPayload = {
  ok: true,
  starterIds: ['nginx-port-conflict'],
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
  ],
};

async function mockLabScreen(page) {
  await page.routeWebSocket(/\/ws\/lab(\?|$)/, async (ws) => {
    ws.onMessage(() => {});
    ws.send(JSON.stringify({ type: 'ready' }));
    ws.send(JSON.stringify({ type: 'output', data: '\r\n[WINLAB] mock incident shell ready\r\n' }));
  });

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

  await page.route('**/api/lab/events**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        events: [
          { id: 'event-1', ts: new Date('2026-05-09T10:00:00Z').toISOString(), cmd: '__context_loaded__', output: 'Nginx binding collision detected on :80' },
          {
            id: 'event-2',
            ts: new Date('2026-05-09T10:00:05Z').toISOString(),
            cmd: '__signal__',
            output: JSON.stringify({ type: 'service_health', status: 'degraded', services: ['nginx', 'api-gateway'] }),
          },
        ],
      }),
    });
  });

  await page.route('**/api/lab/start', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: 'incident-layout-session',
        containerName: 'winlab-terminal-with-a-very-long-container-name-for-layout-checks',
        level: 'JUNIOR',
        hintEnabled: true,
        bootSequence: [],
        incidentType: 'Nginx binding collision on prod ingress gateway',
        incidentBrief: {
          labId: 'nginx-port-conflict',
          labTitle: 'Edge ingress saturation with concurrent port binding conflict',
          incidentType: 'Nginx binding collision on prod ingress gateway',
          symptoms: 'External traffic is failing while an unbounded diagnostic line should stay wrapped within the incident panel instead of widening the page shell.',
          objective: 'Restore ingress availability without restarting unrelated services.',
          successCondition: 'The port conflict is removed and health checks return green.',
          suggestedCommands: [
            'sudo ss -ltnp | grep :80',
            'sudo systemctl status nginx --no-pager',
            'sudo lsof -iTCP:80 -sTCP:LISTEN',
          ],
          hints: ['The collision is on the listener, not in DNS.'],
        },
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
      body: JSON.stringify({ hint: 'Inspect which process already owns port 80.' }),
    });
  });
}

async function expectInsideViewport(locator, viewport) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(Math.ceil(box!.x + box!.width)).toBeLessThanOrEqual(viewport.width + 1);
  expect(Math.ceil(box!.y + box!.height)).toBeLessThanOrEqual(viewport.height + 1);
}

async function dismissCookieBanner(page) {
  const essentialOnly = page.getByRole('button', { name: /Essential only/i });
  if (await essentialOnly.isVisible().catch(() => false)) {
    await essentialOnly.click();
  }
}

async function openHub(page, viewport) {
  await dismissCookieBanner(page);
  const cta = page.getByRole('button', { name: LAUNCH_FREE_LAB_LABEL });
  await expect(cta).toBeVisible();
  await cta.click();
  await expect(page.getByRole('heading', { name: viewport.width <= 640 ? /WinLab Hub/i : /Operational Hub/i })).toBeVisible();
}

test.describe('lab incident layout containment', () => {
  for (const viewport of VIEWPORTS) {
    test(`incident screen stays contained at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockLabScreen(page);
      await page.goto('/');

      await openHub(page, viewport);
      await page.getByRole('button', { name: /Nginx Port Conflict/i }).first().click();
      await page.getByRole('button', { name: /Launch Session/i }).click();

      await expect(page.getByTestId('lab-incident-shell')).toBeVisible();
      await expect(page.getByTestId('lab-terminal-panel')).toBeVisible();
      await expect(page.getByTestId('lab-intelligence-panel')).toBeVisible();
      await expect(page.getByTestId('ai-mentor-button')).toBeVisible({ timeout: 10000 });

      const metrics = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        doc: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));

      expect(metrics.body).toBeLessThanOrEqual(metrics.inner + 1);
      expect(metrics.doc).toBeLessThanOrEqual(metrics.inner + 1);

      await expectInsideViewport(page.getByTestId('lab-terminal-panel'), viewport);
      await expectInsideViewport(page.getByTestId('lab-intelligence-panel'), viewport);
      await expectInsideViewport(page.getByTestId('ai-mentor-button'), viewport);
    });
  }
});
