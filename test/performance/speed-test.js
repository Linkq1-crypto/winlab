/**
 * Puppeteer 2G Simulation Test — Real-world perceived speed benchmark
 *
 * Usage:
 *   node test/performance/speed-test.js
 *   node test/performance/speed-test.js --url https://winlab.cloud
 *   node test/performance/speed-test.js --network fast-3g
 *
 * Tests:
 *   - 2G simulation (50kbps down, 20kbps up, 300ms latency)
 *   - Low-end device emulation
 *   - DOM content loaded time
 *   - First paint time
 *   - Time to interactive
 *   - Click response time
 */

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

const NETWORK_PROFILES = {
  '2g': {
    offline: false,
    downloadThroughput: (50 * 1024) / 8,  // ~50KB/s
    uploadThroughput: (20 * 1024) / 8,
    latency: 300,
  },
  'slow-3g': {
    offline: false,
    downloadThroughput: (500 * 1024) / 8, // ~500KB/s
    uploadThroughput: (500 * 1024) / 8,
    latency: 400,
  },
  'fast-3g': {
    offline: false,
    downloadThroughput: (1.5 * 1024 * 1024) / 8, // ~1.5Mbps
    uploadThroughput: (750 * 1024) / 8,
    latency: 150,
  },
  '4g': {
    offline: false,
    downloadThroughput: (4 * 1024 * 1024) / 8, // ~4Mbps
    uploadThroughput: (3 * 1024 * 1024) / 8,
    latency: 75,
  },
};

const TEST_URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://localhost:3001';

const NETWORK = process.argv.includes('--network')
  ? process.argv[process.argv.indexOf('--network') + 1]
  : '2g';

async function runTest() {
  console.log(`🌍 Testing on ${NETWORK} network...\n`);
  console.log(`URL: ${TEST_URL}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: resolveBrowserExecutable(),
  });

  const page = await browser.newPage();

  // Simulate low-end Android device
  await page.setUserAgent(
    'Mozilla/5.0 (Linux; Android 8.0.0; SM-G570Y) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36'
  );

  // Apply network conditions
  const profile = NETWORK_PROFILES[NETWORK] || NETWORK_PROFILES['2g'];
  await page.emulateNetworkConditions(profile);

  // Simulate low-end device CPU (4x slowdown)
  const client = await page.createCDPSession();
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  console.log(`Network: ${NETWORK} (down: ${Math.round(profile.downloadThroughput * 8 / 1024)}kbps, latency: ${profile.latency}ms)`);
  console.log('CPU: 4x slowdown\n');

  // ──── Test 1: First Load ────
  console.log('📦 Test 1: Initial Load');
  const loadStart = Date.now();

  await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const domLoaded = Date.now() - loadStart;
  console.log(`  ⚡ DOM Content Loaded: ${domLoaded}ms`);

  // Wait for first paint
  await page.waitForTimeout(500);
  const metrics = await page.metrics();
  console.log(`  📏 JS Heap Used: ${(metrics.JSHeapUsedSize / 1024 / 1024).toFixed(1)}MB`);

  // Check for blank screen
  const hasContent = await page.evaluate(() => {
    return document.body && document.body.innerText.trim().length > 0;
  });
  console.log(`  ${hasContent ? '✅' : '❌'} Content visible: ${hasContent}`);

  // ──── Test 2: Skeleton UI ────
  console.log('\n🦴 Test 2: Skeleton UI');
  const hasSkeleton = await page.evaluate(() => {
    return !!document.querySelector('.skeleton, [class*="skeleton"], [class*="loading"], .animate-pulse');
  });
  console.log(`  ${hasSkeleton ? '✅' : '⚠️'} Skeleton/loading states found: ${hasSkeleton}`);

  // ──── Test 3: Time to Interactive ────
  console.log('\n🧠 Test 3: Time to Interactive');
  await page.waitForFunction(
    () => document.querySelector('button, a, input') !== null,
    { timeout: 15000 }
  );
  const interactive = Date.now() - loadStart;
  console.log(`  ✅ Interactive elements available: ${interactive}ms`);

  // ──── Test 4: Click Response ────
  console.log('\n👆 Test 4: Click Response Time');
  const firstButton = await page.$('button');
  if (firstButton) {
    const clickStart = Date.now();
    await firstButton.click();
    await page.waitForTimeout(100);
    const clickResponse = Date.now() - clickStart;
    console.log(`  ✅ Button click response: ${clickResponse}ms`);
    console.log(`  ${clickResponse < 100 ? '✅' : '⚠️'} ${clickResponse < 100 ? 'Fast' : 'Could be faster'}`);
  } else {
    console.log('  ⚠️ No buttons found to test');
  }

  // ──── Test 5: Scroll Performance ────
  console.log('\n📜 Test 5: Scroll Check');
  const canScroll = await page.evaluate(() => {
    return document.body.scrollHeight > window.innerHeight;
  });
  if (canScroll) {
    const scrollStart = Date.now();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(200);
    const scrollTime = Date.now() - scrollStart;
    console.log(`  ✅ Scroll executed: ${scrollTime}ms`);
  } else {
    console.log('  ℹ️ Page too short to scroll');
  }

  // ──── Test 6: Network Requests ────
  console.log('\n📡 Test 6: Network Requests');
  const requests = [];
  page.on('request', req => requests.push({ url: req.url(), type: req.resourceType() }));

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  const jsBundles = requests.filter(r => r.type === 'script');
  const cssBundles = requests.filter(r => r.type === 'stylesheet');
  const imgRequests = requests.filter(r => r.type === 'image');

  console.log(`  📦 Total requests: ${requests.length}`);
  console.log(`  📜 JS bundles: ${jsBundles.length}`);
  console.log(`  🎨 CSS bundles: ${cssBundles.length}`);
  console.log(`  🖼️ Images: ${imgRequests.length}`);

  // ──── Summary ────
  console.log('\n' + '='.repeat(50));
  console.log('📊 BENCHMARK SUMMARY');
  console.log('='.repeat(50));

  const benchmarks = {
    'First UI': { value: `${domLoaded}ms`, target: '< 1000ms', pass: domLoaded < 1000 },
    'Interactive': { value: `${interactive}ms`, target: '< 3000ms', pass: interactive < 3000 },
    'Content Visible': { value: hasContent ? 'Yes' : 'No', target: 'Yes', pass: hasContent },
    'Skeleton UI': { value: hasSkeleton ? 'Yes' : 'No', target: 'Yes', pass: hasSkeleton },
  };

  let allPass = true;
  for (const [name, data] of Object.entries(benchmarks)) {
    console.log(`  ${data.pass ? '✅' : '❌'} ${name}: ${data.value} (target: ${data.target})`);
    if (!data.pass) allPass = false;
  }

  console.log('\n' + (allPass ? '🎉 ALL BENCHMARKS PASSED' : '⚠️ Some benchmarks need work'));

  await browser.close();
  return benchmarks;
}

// Run
runTest().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
