# Realism Engine — WINLAB Simulation Core

> A modular, deterministic, side-effect-aware command execution engine for realistic sysadmin training simulations.

---

## 📐 Architecture

```
realism/
├── engine.ts          ← Main entry point: exec(), execBatch(), execAndCompare()
├── parsers.ts         ← Robust CLI tokenizer (handles quotes, flags, pipes, redirects)
├── state.ts           ← Environment model (fs, services, network, storage, logs)
├── effects.ts         ← Command handlers → state mutations + side-effects
├── timing.ts          ← Realistic delays, async state transitions
├── noise.ts           ← Latency, jitter, drop simulation, retry logic
├── deps.ts            ← Dependency graph for cascade failures
├── logs.ts            ← Dynamic log generator using corpus
├── log-corpus.ts      ← Realistic log templates (systemd, nginx, mysql, kernel, etc.)
├── snapshots.ts       ← State snapshots, diff, baseline comparison
└── fixtures/
    └── baselines/     ← Golden output files for REAL vs SIM comparison

tests/
├── realism.spec.ts    ← Core realism test suite (40+ tests)
└── score.spec.ts      ← Realism score CI gate (>= 0.75 required)
```

---

## 🚀 Quick Start

```bash
# Run realism tests
npm run test:realism

# Watch mode for development
npm run test:realism:watch

# Run all unit tests
npm run test:unit
```

---

## 🔧 Core API

### `exec(cmd, env) → ExecutionOutput`

Main entry point. Executes a command against the environment.

```typescript
import { exec, createDefaultEnv } from "./realism/engine";

const env = createDefaultEnv();
const result = await exec("systemctl restart nginx", env);

console.log(result.stdout);    // Command output
console.log(result.stderr);    // Error output (if any)
console.log(result.code);      // Exit code (0 = success)
console.log(result.diff);      // State changes
console.log(result.timing);    // Timing info
```

### `execBatch(commands, env) → ExecutionOutput[]`

Execute multiple commands in sequence.

```typescript
const commands = [
  "systemctl stop nginx",
  "cat /etc/nginx/nginx.conf",
  "systemctl start nginx",
];

const results = await execBatch(commands, env);
```

### `execAndCompare(cmd, env, baselineName) → { output, matches, diff }`

Execute and compare output against a baseline file.

```typescript
const { output, matches, diff } = await execAndCompare(
  "mdadm --detail /dev/md0",
  env,
  "mdadm_detail_degraded.txt"
);

if (!matches) {
  console.log(diff); // Detailed diff report
}
```

---

## 🧠 Key Features

### 1. Robust Command Parser

Handles:
- Multiple spaces, tabs
- Single/double quotes
- Escaped characters
- Short flags (`-x`) and long flags (`--flag=value`)
- Pipes (`|`)
- Redirects (`>`, `>>`, `2>`)

```typescript
// All these work correctly:
await exec("systemctl  status   nginx", env);
await exec("systemctl status nginx.service", env);
await exec('echo "hello world"', env);
```

### 2. Realistic State Machine

Services have proper state transitions:
```
stopped → starting → running → stopping → stopped
                                ↓
                              failed
```

Commands are **not instant** — they have timing profiles:
- `systemctl start`: 800-1200ms
- `systemctl status`: 50-80ms
- `df/du/find`: 1500-2300ms
- `ps/top`: 100-150ms

### 3. Dependency Graph & Cascade Failures

When a service fails, all dependent services degrade:

```
network fails
  ↓
sshd → degraded
httpd → degraded
nginx → degraded
chronyd → degraded
```

```typescript
import { createDefaultDependencyGraph } from "./realism/deps";

const graph = createDefaultDependencyGraph();
graph.propagateFailure(env, "network");

// Now sshd, httpd, nginx, chronyd are all degraded
```

### 4. Dynamic Log Generation

Logs are generated based on:
- Command execution
- Service state
- Environment conditions

```typescript
import { emitLog, queryLogs } from "./realism/logs";

// Emit realistic log
emitLog(env, "nginx", "error", { client: "10.0.2.50" });

// Query logs
const errorLogs = queryLogs(env, { level: "error" });
const nginxLogs = queryLogs(env, { source: "nginx" });
```

### 5. Baseline Comparison (REAL vs SIM)

Compare simulator output against real system outputs:

```typescript
import { loadBaseline, normalize, compareOutputs } from "./realism/snapshots";

const simOutput = (await exec("mdadm --detail /dev/md0", env)).stdout;
const realOutput = loadBaseline("mdadm_detail_degraded.txt");

const matches = compareOutputs(simOutput, realOutput);
```

### 6. Noise & Retry Simulation

Simulate real network conditions:

```typescript
import { Noise } from "./realism/noise";

const noise = new Noise({
  baseLatencyMs: 50,
  jitterMs: 100,
  dropRate: 0.01,    // 1% drop rate
  errorRate: 0.02,   // 2% soft errors
  retryPolicy: { retries: 3, backoffMs: 100, factor: 2 },
});

const result = await noise.withRetry(async () => {
  return someOperation();
});
```

---

## 🧪 Testing

### Realism Score

The engine calculates a realism score based on:

| Metric | Weight | Description |
|--------|--------|-------------|
| Command Coverage | 25% | % of commands that execute successfully |
| State Accuracy | 25% | % of state transitions that are correct |
| Side Effects | 25% | % of expected side-effects that occur |
| Timing Realism | 25% | % of commands with realistic (non-instant) timing |

**CI Gate:** Overall score must be >= 0.75

### Test Structure

```typescript
// Command fidelity
it("systemctl status output matches format", async () => {
  const r = await exec("systemctl status nginx", env);
  expect(r.stdout).toMatch(/Active: (active \(running\)|failed|inactive)/);
});

// Side-effects
it("rm -rf mysql breaks mysql", async () => {
  await exec("rm -rf /var/lib/mysql", env);
  expect(env.services.mysqld.status).toBe("failed");
});

// Cascade failures
it("network failure cascades to dependents", async () => {
  graph.propagateFailure(env, "network");
  expect(env.services.sshd.status).toBe("degraded");
});

// Timing
it("restart is not instant", async () => {
  const r = await exec("systemctl restart nginx", env);
  expect(r.timing.delayMs).toBeGreaterThan(0);
});
```

---

## 📊 Realism Checklist

| Feature | Status |
|---------|--------|
| Real command syntax | ✅ |
| State transitions | ✅ |
| Side-effects | ✅ |
| Cascade failures | ✅ |
| Dynamic logs | ✅ |
| Timing realism | ✅ |
| Noise/jitter | ✅ |
| Baseline comparison | ✅ |
| Parser robustness | ✅ |
| Deterministic tests | ✅ |

---

## 🔮 Future Enhancements

- [ ] Full filesystem simulation (ext4, xfs)
- [ ] Network simulation (latency, packet loss, routing)
- [ ] Multi-user sessions
- [ ] SELinux policy enforcement
- [ ] Real Docker/container integration
- [ ] AI-powered scenario generation
- [ ] Replay engine (record/playback)
- [ ] Scoring engine (time, errors, efficiency)

---

## 📝 License

Proprietary — WINLAB Platform
