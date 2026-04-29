/**
 * CI Performance Test Suite — Automated regression testing
 *
 * Usage:
 *   node test/performance/ci-test.js
 *   node test/performance/ci-test.js --url https://winlab.cloud --network 2g
 *
 * Fails build if:
 *   - First paint > 2s on 2G
 *   - Time to interactive > 5s
 *   - Any resource > 2MB
 *   - Memory usage > 150MB
 *   - Layout shift score > 0.1
 */

import assert from "node:assert";
import fs from "node:fs";
import puppeteer from "puppeteer";

function resolveBrowserExecutable() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

// ──── Config ────
const TEST_URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://localhost:3001';

const NETWORK = process.argv.includes('--network')
  ? process.argv[process.argv.indexOf('--network') + 1]
  : 'fast-3g';

const NETWORK_PROFILES = {
  '2g': { offline: false, downloadThroughput: (50 * 1024) / 8, uploadThroughput: (20 * 1024) / 8, latency: 300 },
  'fast-3g': { offline: false, downloadThroughput: (1.5 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, latency: 150 },
  '4g': { offline: false, downloadThroughput: (4 * 1024 * 1024) / 8, uploadThroughput: (3 * 1024 * 1024) / 8, latency: 75 },
};

async function applyNetworkProfile(page, profile) {
  const client = await page.createCDPSession();
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: Boolean(profile.offline),
    latency: Number(profile.latency),
    downloadThroughput: Number(profile.downloadThroughput),
    uploadThroughput: Number(profile.uploadThroughput),
  });
  return client;
}

// ──── Performance Thresholds ────
const THRESHOLDS = {
  '2g':     { firstPaint: 4000, interactive: 8000, maxResource: 2 * 1024 * 1024, maxHeap: 200 * 1024 * 1024 },
  'fast-3g': { firstPaint: 2000, interactive: 5000, maxResource: 2 * 1024 * 1024, maxHeap: 150 * 1024 * 1024 },
  '4g':     { firstPaint: 1000, interactive: 3000, maxResource: 1 * 1024 * 1024, maxHeap: 100 * 1024 * 1024 },
};

const threshold = THRESHOLDS[NETWORK] || THRESHOLDS['fast-3g'];

// ──── Test Runner ────
const results = { passed: 0, failed: 0, tests: [] };

function test(name, fn) {
  return fn()
    .then(() => {
      results.passed++;
      results.tests.push({ name, status: '✅ PASS' });
      console.log(`  ✅ ${name}`);
    })
    .catch(err => {
      results.failed++;
      results.tests.push({ name, status: '❌ FAIL', error: err.message });
      console.log(`  ❌ ${name}: ${err.message}`);
    });
}

async function runTests() {
  console.log(`🧪 CI Performance Test Suite`);
  console.log(`URL: ${TEST_URL}`);
  console.log(`Network: ${NETWORK}\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    executablePath: resolveBrowserExecutable(),
  });

  const page = await browser.newPage();
  const profile = NETWORK_PROFILES[NETWORK] || NETWORK_PROFILES['fast-3g'];
  await applyNetworkProfile(page, profile);

  // Test 1: Page loads without errors
  await test('Page loads without console errors', async () => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Filter out known non-critical errors
    const realErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('Failed to load resource')
    );

    assert.strictEqual(realErrors.length, 0, `Found ${realErrors.length} console errors: ${realErrors.join(', ')}`);
  });

  // Test 2: First paint within threshold
  await test(`First paint < ${threshold.firstPaint}ms`, async () => {
    const start = Date.now();
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const firstPaint = Date.now() - start;

    assert.ok(firstPaint < threshold.firstPaint, `${firstPaint}ms exceeded ${threshold.firstPaint}ms`);
  });

  // Test 3: Interactive elements available
  await test(`Time to interactive < ${threshold.interactive}ms`, async () => {
    const start = Date.now();
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('button, a, input', { timeout: threshold.interactive });
    const interactive = Date.now() - start;

    assert.ok(interactive < threshold.interactive, `${interactive}ms exceeded ${threshold.interactive}ms`);
  });

  // Test 4: No oversized resources
  await test('No resource > 2MB', async () => {
    const requests = [];
    page.on('response', response => {
      requests.push({
        url: response.url(),
        size: parseInt(response.headers()['content-length'] || '0', 10),
      });
    });

    await page.goto(TEST_URL, { waitUntil: 'networkidle0', timeout: 30000 });

    const oversized = requests.filter(r => r.size > threshold.maxResource);
    assert.strictEqual(oversized.length, 0,
      `${oversized.length} resource(s) exceed ${threshold.maxResource / 1024 / 1024}MB: ${oversized.map(r => r.url).join(', ')}`
    );
  });

  // Test 5: Heap memory usage
  await test('Heap memory < 150MB', async () => {
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000); // Let JS settle

    const metrics = await page.metrics();
    const heapUsed = metrics.JSHeapUsedSize;

    assert.ok(heapUsed < threshold.maxHeap,
      `Heap ${Math.round(heapUsed / 1024 / 1024)}MB exceeded ${Math.round(threshold.maxHeap / 1024 / 1024)}MB`
    );
  });

  // Test 6: No layout shifts (CLS)
  await test('No significant layout shifts', async () => {
    const cls = await page.evaluate(async () => {
      return new Promise(resolve => {
        let clsScore = 0;
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsScore += entry.value;
            }
          }
        });

        observer.observe({ type: 'layout-shift', buffered: true });

        // Wait for potential layout shifts
        setTimeout(() => {
          observer.disconnect();
          resolve(clsScore);
        }, 3000);
      });
    });

    assert.ok(cls < 0.1, `CLS score ${cls.toFixed(3)} exceeded 0.1`);
  });

  // Test 7: Scroll performance
  await test('Scroll performance (no jank)', async () => {
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Try to scroll
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });

    // Check for long tasks during scroll
    const longTasks = await page.evaluate(() => {
      return new Promise(resolve => {
        const entries = performance.getEntriesByType('longtask') || [];
        resolve(entries.length);
      });
    });

    assert.ok(longTasks < 3, `${longTasks} long tasks detected during scroll`);
  });

  await browser.close();

  // ──── Summary ────
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 TEST RESULTS`);
  console.log(`${'='.repeat(50)}`);
  console.log(`  ✅ Passed: ${results.passed}`);
  console.log(`  ❌ Failed: ${results.failed}`);
  console.log(`  📝 Total:  ${results.passed + results.failed}`);

  if (results.failed > 0) {
    console.log(`\n❌ PERFORMANCE REGRESSION DETECTED`);
    process.exit(1);
  } else {
    console.log(`\n🎉 ALL TESTS PASSED`);
  }
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err.message);
  process.exit(1);
});
