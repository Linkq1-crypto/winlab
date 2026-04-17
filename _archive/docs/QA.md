# WINLAB QA System

## Quick Start

```bash
# Run full QA suite (starts server → runs tests → generates report)
npm run qa:full

# Open the HTML report after tests
npm run qa:open
```

## What It Does

1. **Starts Vite dev server** (waits for localhost:5173)
2. **Runs all Playwright tests** in `tests/` directory
3. **Generates HTML report** in `qa-report/`
4. **Captures screenshots + videos** on test failures

## Test Files

| File | What It Tests |
|---|---|
| `tests/health.spec.ts` | App loads, no runtime errors, routes respond |
| `tests/landing.spec.ts` | Landing page renders, CTA visible, pricing visible |

## Configuration

See `playwright.config.ts` for:
- `timeout: 30000` per test
- `retries: 1` (2 in CI)
- `trace: 'on-first-retry'`
- `video: 'retain-on-failure'`
- `screenshot: 'only-on-failure'`

## QA Health Monitor

The app includes a runtime health monitor (`src/qaMonitor.js`) that captures:
- JavaScript errors
- Unhandled promise rejections
- Fetch events

Accessible in tests via `window.__QA_HEALTH__`.

## Adding Tests

Create new files in `tests/` with `.spec.ts` extension:

```typescript
import { test, expect } from '@playwright/test';

test('my feature works', async ({ page }) => {
  await page.goto('/');
  // Your test code here
});
```
