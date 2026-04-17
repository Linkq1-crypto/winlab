# Enterprise Simulation System — PR Summary

## Overview
Full implementation of an **autonomous infrastructure simulation system** with dependency graphs, cascading failures, AI-style remediation, and self-healing — all integrated into the WinLab platform.

## What Was Built

### 🔗 Dependency Graph (`src/core/dependencyGraph.js`)
- Service topology with relationships (UP / DEGRADED / DOWN / RECOVERING)
- Pre-configured cloud-like topology: `Frontend → API/Auth → DB`
- Cycle detection, transitive dependency resolution, criticality tiers

### 🔥 Impact Engine (`src/core/impactEngine.js`)
- Cascading failure propagation: one service down → all dependents degrade
- Impact scoring (0–100) based on criticality weight
- Service recovery API

### 📋 Timeline Store (`src/core/timelineStore.js`)
- Rolling incident log (last 200 events) with severity (INFO / WARN / CRITICAL)
- Metadata tracking for root cause analysis

### ⚡ Event Bus (`src/core/eventBus.js`)
- Central pub/sub for all simulation events
- Exposes `window.emit()` for test automation and demo mode

### 🤖 Remediation Advisor (`src/core/remediationAdvisor.js`) *(NEW)*
- Rule-based AI-style engine that analyzes incidents and proposes remediation
- Actions: FAILOVER, RESTART, SCALE_UP, CLEAR_CACHE, INVESTIGATE
- Root cause analysis with causal chain detection

### 🔄 Self-Healing Engine (`src/core/selfHealingEngine.js`) *(NEW)*
- Automatic remediation loop (configurable interval)
- Executes remediation actions and tracks recovery
- Exposes `window.startSelfHealing()` / `window.stopSelfHealing()` / `window.remediate(id)`

### 📊 Monitoring Store (`src/core/monitoringStore.js`)
- Real-time metrics: errors, API calls, latency, event throughput
- Time-series history for charting

### 🧪 Mobile Tests (`tests/mobile.spec.ts`) *(NEW)*
- iPhone 13 + Pixel 5 viewport tests
- Slow 3G simulation
- Touch/tap interaction validation
- Layout overflow detection

### 🧪 Unit Tests (`tests/selfHealing.test.js`) *(NEW)*
- **12/12 tests passing** ✅
- Covers: dependency graph, cascade, remediation advisor, root cause analyzer, self-healing engine

## New Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| vitest | ^4.1.4 | Unit testing framework |

## New Scripts
| Script | Command | Purpose |
|--------|---------|---------|
| `test:unit` | `vitest run` | Run all unit tests |
| `test:unit:watch` | `vitest` | Watch mode for TDD |

## Test Results

### Unit Tests (Vitest) — ✅ 12/12 PASS
```
 ✓ dependency graph + cascading failures (5)
   ✓ initializes with all services UP
   ✓ propagates DB failure to dependents
   ✓ computes impact score > 0 after failure
   ✓ recovers a service successfully
   ✓ detects cascade from API failure
 ✓ remediation advisor (3)
   ✓ proposes FAILOVER for DB failure
   ✓ proposes RESTART for non-DB DOWN service
   ✓ proposes FAILOVER for services impacted by DB failure
 ✓ root cause analyzer (2)
   ✓ returns "no critical incidents" when clean
   ✓ detects DB-related root cause
 ✓ self-healing engine (2)
   ✓ starts and stops without error
   ✓ automatically recovers services
```

### E2E Tests (Playwright)
- Require dev server running (`npm run dev:frontend`)
- Use `npm run qa:full` to run full-stack tests

## How to Use

### Demo Mode
```js
// 1. Open browser console
window.emit('SERVICE_DOWN', { serviceId: 'DB' });

// 2. Watch cascade: DB→DOWN, Auth→DEGRADED, API→DOWN, Frontend→DEGRADED

// 3. Start auto-healing
window.startSelfHealing();

// 4. Watch services recover: DB→UP, Auth→UP, API→UP, Frontend→UP

// 5. Stop
window.stopSelfHealing();
```

### Manual Remediation
```js
window.remediate('API');
```

### Run Tests
```bash
# Unit tests
npm run test:unit

# Unit tests (watch mode)
npm run test:unit:watch

# Full E2E (needs dev server)
npm run qa:full
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    WinLab UI                        │
├─────────────────────────────────────────────────────┤
│  Event Bus  ←→  Monitoring Store  ←→  Timeline      │
├─────────────────────────────────────────────────────┤
│  Dependency Graph  ←→  Impact Engine                │
│       ↓                                              │
│  Remediation Advisor  →  Self-Healing Engine        │
├─────────────────────────────────────────────────────┤
│  Chaos Engine (optional)  →  Random failures        │
└─────────────────────────────────────────────────────┘
```

## Files Changed
| File | Status |
|------|--------|
| `src/core/remediationAdvisor.js` | ✅ New |
| `src/core/selfHealingEngine.js` | ✅ New |
| `tests/selfHealing.test.js` | ✅ New |
| `tests/mobile.spec.ts` | ✅ New |
| `package.json` | ✅ Updated (vitest + scripts) |

## Pre-existing Files (unchanged)
- `src/core/dependencyGraph.js`
- `src/core/eventBus.js`
- `src/core/impactEngine.js`
- `src/core/timelineStore.js`
- `src/core/monitoringStore.js`
