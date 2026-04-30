import { expect, test } from '@playwright/test';

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
        sessionId: 'mentor-session',
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

async function askMentorQuestion(page, question) {
  const input = page.getByPlaceholder('Ask a question...');
  const sendButton = page.getByRole('button', { name: /^Send$/i });

  await expect(input).toBeVisible();
  await input.fill(question);
  await expect(input).toHaveValue(question);
  await expect(sendButton).toBeEnabled();
  await sendButton.click();
}

test.describe('ai mentor feedback', () => {
  for (const viewport of [
    { width: 1280, height: 900, name: 'desktop' },
    { width: 390, height: 844, name: 'mobile' },
  ]) {
    test(`confirm and deny feedback work on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockApp(page);

      let feedbackCalls = 0;
      const feedbackPayloads = [];

      await page.route('**/api/ai/help', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hint: body.cmd.includes('logs')
              ? 'Look at the error log after you confirm nginx is running.'
              : 'Check the nginx service status first.',
          }),
        });
      });

      await page.route('**/api/ai/mentor-feedback', async (route) => {
        feedbackCalls += 1;
        feedbackPayloads.push(route.request().postDataJSON());
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, id: `feedback-${feedbackCalls}` }),
        });
      });

      await page.goto('/');
      await page.getByRole('button', { name: /Launch Free Labs/i }).click();
      await page.getByRole('button', { name: /Nginx Port Conflict/i }).first().click();
      await page.getByRole('button', { name: /Launch Session/i }).click();

      await page.locator('button[title="AI Mentor"]').click();
      const enableMentorButton = page.getByRole('button', { name: /Enable AI Mentor/i });
      if (await enableMentorButton.isVisible().catch(() => false)) {
        await enableMentorButton.click();
      }
      await askMentorQuestion(page, 'what should I check?');

      await expect(page.getByText(/Check the nginx service status first\./i)).toBeVisible();
      await page.getByRole('button', { name: /Confirm mentor suggestion/i }).click();
      await expect(page.getByText(/Feedback saved: confirmed\./i)).toBeVisible();

      await askMentorQuestion(page, 'should I inspect logs next?');

      await expect(page.getByText(/Look at the error log after you confirm nginx is running\./i)).toBeVisible();
      const denyButtons = page.getByRole('button', { name: /Deny mentor suggestion/i });
      await denyButtons.nth(1).click();
      await expect(page.getByText(/Feedback saved: denied\./i)).toBeVisible();

      expect(feedbackCalls).toBe(2);
      expect(feedbackPayloads[0]).toMatchObject({
        labId: 'nginx-port-conflict',
        sessionId: 'mentor-session',
        feedback: 'confirm',
      });
      expect(feedbackPayloads[0].messageId).toBeTruthy();
      expect(feedbackPayloads[0].suggestionId).toBeTruthy();
      expect(feedbackPayloads[0].timestamp).toBeTruthy();

      expect(feedbackPayloads[1]).toMatchObject({
        labId: 'nginx-port-conflict',
        sessionId: 'mentor-session',
        feedback: 'deny',
      });

      const helperFocused = await page.locator('.xterm-helper-textarea').evaluate((node) => {
        node.focus();
        return document.activeElement === node;
      });
      expect(helperFocused).toBe(true);
    });
  }
});
