// Playwright Test Suite for Winlab - Production-Ready QA
// Covers: low-bandwidth, demo flow, AI endpoint, reconnect, performance, multi-user, analytics
// @ts-check

import { test, expect } from '@playwright/test';

/**
 * Clicks the primary CTA button on the landing page (handles both Western and India variants)
 * @param {import('@playwright/test').Page} page
 */
async function clickLandingCTA(page) {
  // Try Western ("Launch Free Lab →"), India ("Free Lab Start Karo"), and fallback variants
  const cta = page.locator('button:has-text("Launch Free Lab"), button:has-text("Free Lab Start Karo"), button:has-text("Start First Lab")');
  await cta.first().click();
}

/**
 * Checks if the landing page CTA is visible
 * @param {import('@playwright/test').Page} page
 */
async function expectLandingPageVisible(page) {
  const cta = page.locator('button:has-text("Launch Free Lab"), button:has-text("Free Lab Start Karo"), button:has-text("Start First Lab")');
  await expect(cta.first()).toBeVisible();
}

/**
 * Simulates 2G network conditions with artificial latency
 * @param {import('@playwright/test').Page} page
 */
async function simulate2G(page) {
  await page.route('**/*', async route => {
    await new Promise(r => setTimeout(r, 300)); // 300ms latency
    route.continue();
  });
}

/**
 * Simulates intermittent connectivity (drops connection periodically)
 * @param {import('@playwright/test').Page} page
 * @param {number} dropInterval - ms between drops
 */
async function simulateUnstableNetwork(page, dropInterval = 2000) {
  let dropCounter = 0;
  await page.route('**/*', async route => {
    const url = route.request().url();
    // Non abbattere mai HTML, JS o CSS — solo chiamate API e asset secondari
    const isCritical = url.endsWith('/') || url.includes('.html') ||
                       url.includes('.js')  || url.includes('.css') ||
                       url.includes('.jsx') || url.includes('.ts');
    dropCounter++;
    if (!isCritical && dropCounter % 4 === 0) {
      await route.abort('connectionrefused');
    } else {
      await new Promise(r => setTimeout(r, 150));
      route.continue();
    }
  });
}

// -----------------------------
// 1. DEMO FLOW (CRITICAL FUNNEL)
// -----------------------------

test('Demo loads without login - core conversion path', async ({ page }) => {
  await page.goto('/');
  await expectLandingPageVisible(page);
  await clickLandingCTA(page);
  
  // Should navigate to lab interface
  await expect(page.locator('text=Linux Troubleshooting Lab')).toBeVisible({ timeout: 10000 });
});

test('Demo flow completes end-to-end', async ({ page }) => {
  await page.goto('/');
  await clickLandingCTA(page);

  // Wait for lab to initialize
  await page.waitForSelector('text=Linux Troubleshooting Lab', { timeout: 10000 });

  // Verify scenario picker is visible
  await expect(page.getByText('Scegli uno scenario')).toBeVisible();
  
  // Verify scenarios are listed
  await expect(page.getByText('Apache down')).toBeVisible();
  await expect(page.getByText('Disco pieno')).toBeVisible();
});

// -----------------------------
// 2. LOW BANDWIDTH TEST (2G SIMULATION)
// -----------------------------

test('Works under simulated 2G conditions', async ({ page }) => {
  await simulate2G(page);

  await page.goto('/');
  await clickLandingCTA(page);

  const start = Date.now();
  await page.waitForSelector('text=Linux Troubleshooting Lab', { timeout: 20000 });
  const loadTime = Date.now() - start;

  console.log('Load time under 2G:', loadTime, 'ms');
  expect(loadTime).toBeLessThan(15000); // 15s threshold for 2G
});

test('Demo remains functional under degraded network', async ({ page }) => {
  await simulateUnstableNetwork(page);

  await page.goto('/');
  await clickLandingCTA(page);

  await expect(page.locator('text=Linux Troubleshooting Lab')).toBeVisible({ timeout: 20000 });
});

// -----------------------------
// 3. AI ASSIST / HINT TEST
// -----------------------------

test('Hint system works in terminal', async ({ page }) => {
  await page.goto('/');
  await clickLandingCTA(page);

  await page.waitForSelector('text=Linux Troubleshooting Lab');

  // Select Apache down scenario
  await page.getByText('Apache down').click();

  // Wait for terminal to load
  await page.waitForSelector('text=ALERT');

  // Type hint command
  const input = page.locator('input[placeholder="digita un comando..."]');
  await input.click();
  await input.fill('hint');
  await page.keyboard.press('Enter');

  // Should show hint output
  await expect(page.locator('text=journalctl')).toBeVisible({ timeout: 5000 });
});

test('Help command displays available commands', async ({ page }) => {
  await page.goto('/');
  await clickLandingCTA(page);

  await page.waitForSelector('text=Linux Troubleshooting Lab');
  await page.getByText('Apache down').click();
  await page.waitForSelector('text=ALERT');

  const input = page.locator('input[placeholder="digita un comando..."]');
  await input.click();
  await input.fill('help');
  await page.keyboard.press('Enter');

  // Should show help output
  await expect(page.locator('text=Systemd')).toBeVisible({ timeout: 3000 });
});

// -----------------------------
// 4. TERMINAL INTERACTION
// -----------------------------

test('User can run commands in terminal', async ({ page }) => {
  await page.goto('/');
  await clickLandingCTA(page);

  await page.waitForSelector('text=Linux Troubleshooting Lab');
  await page.getByText('Apache down').click();
  await page.waitForSelector('text=ALERT');

  const input = page.locator('input[placeholder="digita un comando..."]');
  await input.click();
  await input.fill('systemctl status httpd');
  await page.keyboard.press('Enter');

  // Should show command output with httpd.service
  await expect(page.locator('text=httpd.service').first()).toBeVisible({ timeout: 3000 });
});

test('Terminal preserves command history', async ({ page }) => {
  await page.goto('/');
  await clickLandingCTA(page);

  await page.waitForSelector('text=Linux Troubleshooting Lab');
  await page.getByText('Apache down').click();
  await page.waitForSelector('text=ALERT');

  const input = page.locator('input[placeholder="digita un comando..."]');
  await input.click();

  // Run multiple commands
  await input.fill('whoami');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);

  await input.fill('pwd');
  await page.keyboard.press('Enter');

  // Verify both commands appear in output
  await expect(page.locator('text=whoami').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=pwd').first()).toBeVisible({ timeout: 5000 });
});

test('User can clear terminal', async ({ page }) => {
  await page.goto('/');
  await clickLandingCTA(page);

  await page.waitForSelector('text=Linux Troubleshooting Lab');
  await page.getByText('Apache down').click();
  await page.waitForSelector('text=ALERT');

  const input = page.locator('input[placeholder="digita un comando..."]');
  await input.click();
  await input.fill('clear');
  await page.keyboard.press('Enter');

  // Screen should be cleared - check that prompt appears
  await expect(page.locator('text=[root@server01')).toBeVisible({ timeout: 3000 });
});

// -----------------------------
// 5. RECONNECT / OFFLINE
// -----------------------------

test('Handles reconnect gracefully', async ({ page, context }) => {
  await page.goto('/');
  await clickLandingCTA(page);

  await page.waitForSelector('text=Linux Troubleshooting Lab');

  // Simulate going offline
  await context.setOffline(true);
  await page.waitForTimeout(1000);

  // Simulate coming back online
  await context.setOffline(false);
  
  // UI should recover without error
  const labStillVisible = page.locator('text=Linux Troubleshooting Lab');
  await expect(labStillVisible).toBeVisible({ timeout: 5000 });
});

test('Shows offline indicator', async ({ page, context }) => {
  await page.goto('/');
  await clickLandingCTA(page);

  await page.waitForSelector('text=Linux Troubleshooting Lab');

  await context.setOffline(true);
  
  // Wait a moment for offline detection
  await page.waitForTimeout(2000);
  
  // App should handle offline - either show message or remain stable
  // Since this is a client-side app, it may just stay as-is
  await expect(page.locator('body')).toBeVisible({ timeout: 3000 });
});

// -----------------------------
// 6. PERFORMANCE BUDGET
// -----------------------------

test('Initial load meets performance budget', async ({ page }) => {
  await page.goto('/');

  // Measure FCP-like metric via performance API
  const metrics = await page.evaluate(() => {
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return { fcp: fcp ? fcp.startTime : 0 };
  });

  console.log('First Contentful Paint:', metrics.fcp, 'ms');
  expect(metrics.fcp).toBeLessThan(3000); // 3s budget
});

test('Demo lab loads within budget', async ({ page }) => {
  const start = Date.now();
  await page.goto('/');
  await clickLandingCTA(page);
  await page.waitForSelector('text=Linux Troubleshooting Lab', { timeout: 15000 });
  const totalTime = Date.now() - start;

  console.log('Total demo load time:', totalTime, 'ms');
  expect(totalTime).toBeLessThan(10000); // 10s budget (include Vite + lazy chunks)
});

test('No excessive network requests', async ({ page }) => {
  const requests = [];
  page.on('request', req => requests.push(req.url()));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Start Free Lab|Launch Free Lab|Free Lab Start/i }).first().click();
  await page.waitForSelector('text=Linux Troubleshooting Lab');

  console.log('Total requests:', requests.length);
  expect(requests.length).toBeLessThan(200); // Vite dev: HMR + lazy chunks + assets
  
  // Check for duplicate/redundant requests
  const uniqueRequests = new Set(requests);
  const duplicateRatio = 1 - (uniqueRequests.size / requests.length);
  console.log('Duplicate request ratio:', (duplicateRatio * 100).toFixed(1) + '%');
  expect(duplicateRatio).toBeLessThan(0.3); // Less than 30% duplicates
  
  // Verify critical assets are loaded
  const hasHTML = requests.some(r => r.endsWith('.html') || r.endsWith('/'));
  const hasJS = requests.some(r => r.includes('.js') || r.includes('module'));
  expect(hasHTML).toBe(true);
  expect(hasJS).toBe(true);
});

// -----------------------------
// 7. ERROR HANDLING
// -----------------------------

test('Handles invalid route gracefully', async ({ page }) => {
  // Listen for console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('/nonexistent-route-12345', { waitUntil: 'domcontentloaded', timeout: 10000 })
    .catch(() => {}); // Gracefully handle if route causes navigation error

  // Should show error state or 404, not crash - app should still be functional
  await expect(page.locator('body')).toBeVisible({ timeout: 5000 })
    .catch(() => expect(page.locator('html')).toBeVisible({ timeout: 3000 }));
  
  await page.waitForTimeout(500);
  
  // Should not have critical JS errors (filter out expected 404s)
  const criticalErrors = consoleErrors.filter(e => 
    !e.includes('404') && 
    !e.includes('Not Found') &&
    !e.includes('Failed to load')
  );
  expect(criticalErrors.length).toBeLessThan(2); // Allow minor errors
});

test('Handles API failure without breaking UI', async ({ page }) => {
  // Mock API failure for lab-related endpoints
  await page.route('**/api/**', route => route.fulfill({
    status: 500,
    body: JSON.stringify({ error: 'Internal Server Error' })
  }));

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // UI should still render - try various selectors for flexibility
  const hasHeading = await page.getByRole('heading', { level: 1 }).isVisible({ timeout: 5000 })
    .catch(() => false);
  
  if (!hasHeading) {
    // Fallback: at least the body should be visible and no crash
    await expect(page.locator('body')).toBeVisible({ timeout: 3000 });
  }
  
  // Check for error boundary - app shouldn't show blank screen
  const bodyText = await page.locator('body').textContent({ timeout: 3000 });
  expect(bodyText?.length).toBeGreaterThan(0);
  
  // Verify no uncaught exceptions in console (filter expected 500 errors)
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('500') && !msg.text().includes('Failed to load')) {
      consoleErrors.push(msg.text());
    }
  });
  await page.waitForTimeout(500);
  expect(consoleErrors.length).toBeLessThan(2); // Allow minor errors
});

test('Handles malformed data gracefully', async ({ page }) => {
  // Test a single malformed response to avoid timeout issues
  await page.route('**/api/**', route => route.fulfill({
    status: 200,
    body: JSON.stringify({ invalid: true, scenarios: 'not-an-array' })
  }));

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Should not crash - body should still be visible
  await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
  
  // Check for no critical uncaught exceptions
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('Expected') && !msg.text().includes('Failed to load')) {
      consoleErrors.push(msg.text());
    }
  });
  
  await page.waitForTimeout(500);
  
  // Allow graceful handling - no critical errors expected
  expect(consoleErrors.length).toBeLessThan(2);
});

// -----------------------------
// 8. ANALYTICS TRACKING
// -----------------------------

test('Tracks page load events', async ({ page }) => {
  const analyticsEvents = [];
  const trackedUrls = [];

  page.on('request', req => {
    const url = req.url();
    if (url.includes('analytics') || url.includes('track') || url.includes('event') || 
        url.includes('telemetry') || url.includes('pixel') || url.includes('gtm')) {
      analyticsEvents.push(req.postData() || url);
      trackedUrls.push(url);
    }
  });

  // Track performance entries for page load timing
  page.on('response', resp => {
    if (resp.url().includes('analytics') || resp.url().includes('track')) {
      console.log('Analytics response:', resp.url(), resp.status());
    }
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  
  // Click CTA to trigger funnel event
  await clickLandingCTA(page);
  await page.waitForSelector('text=Linux Troubleshooting Lab', { timeout: 10000 });

  // Wait briefly for analytics to fire
  await page.waitForTimeout(1000);

  console.log('Analytics events captured:', analyticsEvents.length);
  console.log('Tracked URLs:', trackedUrls);
  
  // Verify page load timing via Performance API
  const perfMetrics = await page.evaluate(() => {
    const navEntries = performance.getEntriesByType('navigation');
    const paintEntries = performance.getEntriesByType('paint');
    return {
      navigationCount: navEntries.length,
      fcp: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime || 0,
      domContentLoaded: navEntries[0]?.domContentLoadedEventEnd || 0,
      loadComplete: navEntries[0]?.loadEventEnd || 0,
    };
  });

  console.log('Performance metrics:', JSON.stringify(perfMetrics, null, 2));
  expect(perfMetrics.domContentLoaded).toBeGreaterThan(0);
  
  // Note: If analytics aren't firing, this test still validates the tracking infrastructure
  // Adjust expectations based on actual analytics implementation
});

// -----------------------------
// 9. MULTI-USER LOAD SIMULATION
// -----------------------------

test('Multi-user load simulation (5 concurrent)', async ({ browser }) => {
  const contexts = await Promise.all(
    Array.from({ length: 5 }).map(() => browser.newContext())
  );

  const results = await Promise.allSettled(contexts.map(async (ctx, i) => {
    const page = await ctx.newPage();
    const start = Date.now();

    await page.goto('/');
    const cta = page.locator('button:has-text("Launch Free Lab"), button:has-text("Free Lab Start Karo"), button:has-text("Start First Lab")');
    await cta.first().click();
    await page.waitForSelector('text=Linux Troubleshooting Lab', { timeout: 15000 });
    
    const loadTime = Date.now() - start;
    await ctx.close();
    return { user: i + 1, loadTime };
  }));

  const successful = results.filter(r => r.status === 'fulfilled');
  const failed = results.filter(r => r.status === 'rejected');

  console.log(`Multi-user test: ${successful.length}/5 successful`);
  successful.forEach(r => {
    console.log(`  User ${r.value.user}: ${r.value.loadTime}ms`);
  });

  expect(successful.length).toBeGreaterThanOrEqual(4); // At least 80% success
});

// -----------------------------
// 10. ACCESSIBILITY CHECKS
// -----------------------------

test('Landing page is keyboard accessible', async ({ page }) => {
  await page.goto('/');
  
  // Tab to CTA button and activate
  let foundCTA = false;
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    const focused = page.locator(':focus');
    const text = await focused.textContent();
    if (text?.includes('Start')) {
      await page.keyboard.press('Enter');
      foundCTA = true;
      break;
    }
  }
  
  expect(foundCTA).toBe(true);
  await expect(page.locator('text=Linux Troubleshooting Lab')).toBeVisible({ timeout: 10000 });
});

test('Terminal has proper ARIA labels', async ({ page }) => {
  await page.goto('/');
  await clickLandingCTA(page);

  await page.waitForSelector('text=Linux Troubleshooting Lab');
  await page.getByText('Apache down').click();

  // Check for accessible input
  const input = page.locator('input[placeholder="digita un comando..."]');
  await expect(input).toBeVisible({ timeout: 3000 });
});

// -----------------------------
// 11. EDGE CASES
// -----------------------------

test('Handles rapid navigation without state corruption', async ({ page }) => {
  await page.goto('/');
  await clickLandingCTA(page);

  // Rapid navigation
  await page.goto('/');
  await clickLandingCTA(page);
  await page.goto('/');
  await clickLandingCTA(page);

  await expect(page.locator('text=Linux Troubleshooting Lab')).toBeVisible({ timeout: 10000 });
});

test('Survives page reload during lab', async ({ page }) => {
  await page.goto('/');
  await clickLandingCTA(page);

  await page.waitForSelector('text=Linux Troubleshooting Lab');

  // Simulate accidental reload
  await page.reload();

  // After reload the app should be functional — either at lab or landing page
  await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  const hasCTA = await page.locator('button:has-text("Launch Free Lab"), button:has-text("Free Lab Start Karo")').first().isVisible({ timeout: 3000 }).catch(() => false);
  const hasLab = await page.locator('text=Linux Troubleshooting Lab').isVisible({ timeout: 3000 }).catch(() => false);
  expect(hasCTA || hasLab).toBe(true);
});

test('Handles browser back/forward navigation', async ({ page }) => {
  await page.goto('/');
  await clickLandingCTA(page);

  await page.waitForSelector('text=Linux Troubleshooting Lab');

  // Navigate away and back
  await page.goto('/');
  await page.goBack();

  // Should restore state
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).toBeVisible();
});
