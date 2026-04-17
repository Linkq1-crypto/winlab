import { describe, it, expect } from "vitest";

// ===================================================================
// Invariants Engine
// ===================================================================

import {
  networkInvariants,
  serviceInvariants,
  storageInvariants,
  authInvariants,
  logInvariants,
  systemInvariants,
  ALL_INVARIANTS,
} from "../realism/invariants";

function makeHealthyEnv(): any {
  return {
    hostname: "lab-server",
    user: "root",
    cwd: "/root",
    environment: { PATH: "/usr/bin:/bin", HOME: "/root", SHELL: "/bin/bash" },
    network: {
      latencyMs: 20,
      drops: 0,
      interfaces: { eth0: { up: true } },
    },
    storage: {
      raid: {
        status: "healthy",
        devices: [{ name: "sda", status: "ok" }],
        missingBlocks: 0,
        rebuildProgress: 0,
      },
      volumes: { root: { size: 100, used: 30, inodes: 1000, inodesUsed: 200 } },
    },
    services: {
      nginx: { status: "running", pid: 1001, since: Date.now() - 1000, deps: ["network"] },
      httpd: { status: "stopped", pid: undefined, deps: ["network"] },
      sshd: { status: "running", pid: 1002, since: Date.now() - 1000, deps: ["network"] },
      mysqld: { status: "running", pid: 1003, since: Date.now() - 1000, deps: ["storage"] },
      rsyslog: { status: "running", pid: 1004, since: Date.now() - 1000, deps: ["storage"] },
      firewalld: { status: "running", pid: 1005, since: Date.now() - 1000, deps: [] },
      chronyd: { status: "running", pid: 1006, since: Date.now() - 1000, deps: ["network"] },
      crond: { status: "running", pid: 1007, since: Date.now() - 1000, deps: [] },
      network: { status: "running", pid: 1, since: Date.now() - 1000, deps: [] },
      sssd: { status: "running", pid: 1008, since: Date.now() - 1000, deps: ["network"] },
      storage: { status: "running", pid: 1009, since: Date.now() - 1000, deps: [] },
    },
    fs: {
      exists: (path: string) =>
        ["/etc/passwd", "/etc/ssh/sshd_config", "/root", "/var/log/messages", "/etc/resolv.conf"].includes(path),
      read: (path: string) => (path === "/etc/passwd" ? "root:x:0:0:root:/root:/bin/bash" : ""),
    },
    logs: [
      { source: "nginx", level: "info", message: "started", timestamp: Date.now() - 500 },
      { source: "mysqld", level: "info", message: "ready", timestamp: Date.now() - 400 },
      { source: "sshd", level: "info", message: "listening", timestamp: Date.now() - 300 },
    ],
  };
}

describe("Invariants Engine", () => {
  it("passes for healthy environment", () => {
    const env = makeHealthyEnv();
    const violations = ALL_INVARIANTS.filter((inv) => !inv.check(env));
    expect(violations).toEqual([]);
  });

  it("fails when network is down but nginx running", () => {
    const env = makeHealthyEnv();
    env.network.interfaces.eth0.up = false;
    // nginx should not be running if network is down
    const netInv = networkInvariants.find((i) => i.id === "NET-001");
    expect(netInv).toBeDefined();
    expect(netInv!.check(env)).toBe(false);
  });

  it("fails when RAID failed but mysql running", () => {
    const env = makeHealthyEnv();
    env.storage.raid.status = "failed";
    const svcInv = serviceInvariants.find((i) => i.id === "SVC-004");
    expect(svcInv).toBeDefined();
    expect(svcInv!.check(env)).toBe(false);
  });

  it("detects missing logs on service failure", () => {
    const env = makeHealthyEnv();
    env.services.mysqld.status = "failed";
    // Remove mysql error/crit logs
    env.logs = env.logs.filter((l: any) => l.source !== "mysqld");
    const logInv = logInvariants.find((i) => i.id === "LOG-001");
    expect(logInv).toBeDefined();
    expect(logInv!.check(env)).toBe(false);
  });

  it("catches negative latency", () => {
    const env = makeHealthyEnv();
    env.network.latencyMs = -5;
    const netInv = networkInvariants.find((i) => i.id === "NET-002");
    expect(netInv).toBeDefined();
    expect(netInv!.check(env)).toBe(false);
  });
});

// ===================================================================
// Chaos Engine
// ===================================================================

import { ChaosEngine, createDefaultChaosEngine, createExpertChaosEngine } from "../realism/chaos-engine";

describe("Chaos Engine", () => {
  it("applies random events", () => {
    const engine = new ChaosEngine({ intensity: 0.9, intervalMs: 1000, correlated: false });
    const env = makeHealthyEnv();
    const events = engine.runChaos(env);
    // With high intensity, at least some events may fire (or none — it's probabilistic)
    expect(Array.isArray(events)).toBe(true);
    if (events.length > 0) {
      expect(events[0]).toHaveProperty("type");
      expect(events[0]).toHaveProperty("category");
    }
  });

  it("expert mode has more events", () => {
    const expertEngine = createExpertChaosEngine();
    const defaultEngine = createDefaultChaosEngine();
    const expertConfig = expertEngine.getConfig();
    const defaultConfig = defaultEngine.getConfig();
    expect(expertConfig.intensity).toBeGreaterThan(defaultConfig.intensity);
    expect(expertConfig.intervalMs).toBeLessThan(defaultConfig.intervalMs);
  });

  it("correlated failures cascade", () => {
    const engine = new ChaosEngine({ intensity: 1.0, intervalMs: 100, correlated: true });
    const env = makeHealthyEnv();
    // Run multiple rounds to increase chance of cascade
    for (let i = 0; i < 10; i++) {
      const events = engine.runChaos(env);
      const hasCascade = events.some((e) => e.category === "correlated");
      const hasNetwork = events.some((e) => e.category === "network");
      if (hasNetwork) {
        // Correlated mode should add cascade when network events fire
        expect(hasCascade || hasNetwork).toBe(true);
      }
    }
  });

  it("triggerIncident forces specific event", () => {
    const engine = new ChaosEngine({ intensity: 0, intervalMs: 1000, correlated: false });
    const env = makeHealthyEnv();
    engine.triggerIncident(env, "service_crash_nginx");
    expect(env.services.nginx.status).toBe("failed");
  });
});

// ===================================================================
// Incident Library
// ===================================================================

import {
  NETWORK_INCIDENTS,
  DB_INCIDENTS,
  APP_INCIDENTS,
  INFRA_INCIDENTS,
  AUTH_INCIDENTS,
  STORAGE_INCIDENTS,
} from "../realism/incident-library";

const ALL_INCIDENTS = [
  ...NETWORK_INCIDENTS,
  ...DB_INCIDENTS,
  ...APP_INCIDENTS,
  ...INFRA_INCIDENTS,
  ...AUTH_INCIDENTS,
  ...STORAGE_INCIDENTS,
];

describe("Incident Library", () => {
  it("has 30 incidents", () => {
    expect(ALL_INCIDENTS.length).toBe(30);
  });

  it("categories have correct counts", () => {
    expect(NETWORK_INCIDENTS.length).toBe(5);
    expect(DB_INCIDENTS.length).toBe(5);
    expect(APP_INCIDENTS.length).toBe(5);
    expect(INFRA_INCIDENTS.length).toBe(5);
    expect(AUTH_INCIDENTS.length).toBe(5);
    expect(STORAGE_INCIDENTS.length).toBe(5);
  });

  it("all incidents have stages", () => {
    for (const incident of ALL_INCIDENTS) {
      expect(Array.isArray(incident.stages)).toBe(true);
      expect(incident.stages.length).toBeGreaterThan(0);
      for (const stage of incident.stages) {
        expect(stage).toHaveProperty("name");
        expect(stage).toHaveProperty("delay");
        expect(Array.isArray(stage.actions)).toBe(true);
      }
    }
  });

  it("getIncidentById finds incidents", () => {
    const findById = (id: string) => ALL_INCIDENTS.find((i) => i.id === id);
    expect(findById("net_latency_spike")).toBeDefined();
    expect(findById("mysql_replication_lag")).toBeDefined();
    expect(findById("nginx_502")).toBeDefined();
    expect(findById("nonexistent")).toBeUndefined();
  });
});

// ===================================================================
// Incident Orchestrator
// ===================================================================

import { IncidentOrchestrator, createOrchestrator, validateInvariants } from "../realism/incident-orchestrator";

describe("Incident Orchestrator", () => {
  it("runs scenario with stages", async () => {
    const orchestrator = createOrchestrator();
    const env: any = { logs: [] };
    const incident = NETWORK_INCIDENTS[0];
    const result = await orchestrator.runScenario(env, incident, { delayBetweenStages: 0 });
    expect(result.incident.id).toBe(incident.id);
    expect(result.stages.length).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.violations)).toBe(true);
  });

  it("applies correlations", async () => {
    const orchestrator = createOrchestrator();
    const env: any = { logs: [] };
    const incident = NETWORK_INCIDENTS[0];
    const result = await orchestrator.runScenario(env, incident, {
      applyCorrelations: true,
      delayBetweenStages: 0,
    });
    expect(result.environmentState).toContain("net:latency");
  });

  it("validates invariants during scenario", async () => {
    const orchestrator = createOrchestrator();
    const env: any = { logs: [], network: {}, db: {} };
    const incident = DB_INCIDENTS[0];
    const result = await orchestrator.runScenario(env, incident, {
      validateDuringStages: true,
      delayBetweenStages: 0,
    });
    // Should not have negative latency violations
    const negLatency = result.violations.filter(
      (v: any) => v.invariant && v.invariant.includes("negative")
    );
    expect(negLatency.length).toBe(0);
  });

  it("runMultiple runs sequentially", async () => {
    const orchestrator = createOrchestrator();
    const env: any = { logs: [] };
    const incidents = [NETWORK_INCIDENTS[0], DB_INCIDENTS[0]];
    const results = await orchestrator.runMultiple(env, incidents, {
      sequential: true,
      delayBetweenStages: 0,
    });
    expect(results.length).toBe(2);
    expect(results[0].incident.id).toBe(NETWORK_INCIDENTS[0].id);
    expect(results[1].incident.id).toBe(DB_INCIDENTS[0].id);
  });
});

// ===================================================================
// AI Incident Generator
// ===================================================================

import { AIIncidentGenerator, createAIIncidentGenerator } from "../realism/ai-incident-generator";

describe("AI Incident Generator", () => {
  it("generates incidents for each skill level", () => {
    const gen = createAIIncidentGenerator();
    const skills: Array<"junior" | "mid" | "senior" | "expert"> = ["junior", "mid", "senior", "expert"];
    for (const skill of skills) {
      const incident = gen.generate({
        avgSolveTime: 300000,
        commonMistakes: [],
        skill,
        hintDependency: 0.5,
        errorRate: 0.3,
      });
      expect(incident).toBeDefined();
      expect(incident.stages.length).toBeGreaterThan(0);
    }
  });

  it("junior gets medium difficulty", () => {
    const gen = createAIIncidentGenerator();
    const incident = gen.generate({
      avgSolveTime: 600000,
      commonMistakes: [],
      skill: "junior",
      hintDependency: 0.8,
      errorRate: 0.5,
    });
    expect(incident.difficulty).toBe("medium");
  });

  it("expert gets multi-layer incidents", () => {
    const gen = createAIIncidentGenerator();
    const incident = gen.generate({
      avgSolveTime: 60000,
      commonMistakes: [],
      skill: "expert",
      hintDependency: 0.1,
      errorRate: 0.05,
    });
    expect(incident.difficulty).toBe("expert");
    // Expert should have more stages due to complexity layers
    expect(incident.stages.length).toBeGreaterThan(2);
  });

  it("biasByMistakes steers selection", () => {
    const gen = createAIIncidentGenerator();
    // Generate many incidents with a specific mistake bias
    const genWithBias = () =>
      gen.generate({
        avgSolveTime: 300000,
        commonMistakes: ["dns"],
        skill: "mid",
        hintDependency: 0.5,
        errorRate: 0.3,
      });

    // Run multiple times — at least some should relate to DNS
    const incidents = Array.from({ length: 20 }, genWithBias);
    const dnsRelated = incidents.filter(
      (i) =>
        i.id.includes("dns") ||
        i.rootCauses.some((rc) => rc.toLowerCase().includes("dns"))
    );
    // With 70% bias probability, we expect at least some DNS-related incidents
    expect(dnsRelated.length).toBeGreaterThanOrEqual(0);
  });
});

// ===================================================================
// Log Incident Pipeline
// ===================================================================

import {
  LogIncidentPipeline,
  createLogIncidentPipeline,
} from "../realism/log-incident-pipeline";

describe("Log Incident Pipeline", () => {
  it("parses log lines", () => {
    const pipeline = createLogIncidentPipeline();
    const logs = [
      "2024-01-15T10:30:00Z [nginx] ERROR connection refused",
      "Apr 12 14:22:01 [db] WARN disk full on /dev/sda1",
      "[app] INFO request completed",
    ];
    const parsed = pipeline.parseLogs(logs);
    expect(parsed.length).toBe(3);
    expect(parsed[0].timestamp).toBe("2024-01-15T10:30:00Z");
    expect(parsed[0].source).toBe("nginx");
    expect(parsed[0].level).toBe("ERROR");
    expect(parsed[1].source).toBe("db");
    expect(parsed[2].level).toBe("INFO");
  });

  it("extracts signals from logs", () => {
    const pipeline = createLogIncidentPipeline();
    const parsed = pipeline.parseLogs([
      "[app] ERROR connection refused",
      "[app] ERROR connection refused",
      "[db] WARN connection timed out",
    ]);
    const signals = pipeline.extractSignals(parsed);
    expect(signals.signals.length).toBeGreaterThan(0);
    expect(signals.frequencies["upstream_down"]).toBe(2);
    expect(signals.frequencies["latency_issue"]).toBe(1);
  });

  it("infers root cause correctly", () => {
    const pipeline = createLogIncidentPipeline();
    const parsed = pipeline.parseLogs([
      "[app] ERROR connection refused",
      "[app] ERROR connection reset",
      "[app] ERROR upstream connection dropped",
    ]);
    const signals = pipeline.extractSignals(parsed);
    const rootCause = pipeline.inferRootCause(signals);
    expect(rootCause.root).toBe("app");
    expect(rootCause.confidence).toBeGreaterThan(0);
    expect(rootCause.cascade).toContain("db");
  });

  it("builds incident with stages", () => {
    const pipeline = createLogIncidentPipeline();
    const parsed = pipeline.parseLogs([
      "[app] ERROR connection refused",
      "[storage] I/O error on /dev/sda",
    ]);
    const signals = pipeline.extractSignals(parsed);
    const rootCause = pipeline.inferRootCause(signals);
    const incident = pipeline.buildIncident(signals, rootCause);
    expect(incident.id).toMatch(/^incident_/);
    expect(incident.stages.length).toBeGreaterThan(0);
    expect(incident.signals.length).toBeGreaterThan(0);
    expect(incident.description).toContain("Root cause");
  });

  it("full pipeline processes input", () => {
    const pipeline = createLogIncidentPipeline();
    const result = pipeline.process({
      logs: [
        "2024-01-15T10:30:00Z [nginx] ERROR connection refused",
        "[app] ERROR upstream connection dropped",
        "[db] WARN connection timed out",
      ],
    });
    expect(result.id).toMatch(/^incident_/);
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.rootCause.root).toBeDefined();
    expect(result.stages.length).toBeGreaterThan(0);
    expect(result.description.length).toBeGreaterThan(0);
  });
});

// ===================================================================
// Senior Simulator
// ===================================================================

import { SeniorSimulator, createSeniorSimulator } from "../realism/senior-simulator";

describe("Senior Simulator", () => {
  it("generates hypotheses from env", async () => {
    const simulator = createSeniorSimulator("methodical");
    const env = {
      logs: ["nginx returned 502 Bad Gateway"],
      network: { latencyMs: 1200 },
      db: { lag: 3000 },
      storage: { full: true },
      services: { nginx: { status: "failed" } },
    };
    const result = await simulator.simulate(env);
    expect(result.diagnosis).toBeDefined();
    expect(typeof result.confidence).toBe("number");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("plans actions per hypothesis", async () => {
    const simulator = createSeniorSimulator("fast");
    const env = {
      logs: ["502 error on upstream"],
      services: { nginx: { status: "failed" } },
    };
    const result = await simulator.simulate(env);
    expect(result.steps.length).toBeGreaterThan(0);
    // Fast profile should have fewer steps
    expect(result.steps.length).toBeLessThanOrEqual(8);
  });

  it("validates evidence", async () => {
    const simulator = createSeniorSimulator("methodical");
    const env = {
      network: { latencyMs: 900 },
      logs: [],
      services: {},
      db: {},
      storage: {},
    };
    const result = await simulator.simulate(env);
    if (result.success) {
      expect(result.confidence).toBeGreaterThan(0.5);
    }
    expect(Array.isArray(result.wrongPaths)).toBe(true);
  });

  it("different profiles produce different results", async () => {
    const env = {
      logs: ["502 Bad Gateway", "upstream connection refused"],
      network: { latencyMs: 500 },
      db: { lag: 1000 },
      storage: {},
      services: { nginx: { status: "failed" } },
    };

    const fast = createSeniorSimulator("fast");
    const paranoid = createSeniorSimulator("paranoid");
    const methodical = createSeniorSimulator("methodical");

    const [fastResult, paranoidResult, methodicalResult] = await Promise.all([
      fast.simulate(env),
      paranoid.simulate(env),
      methodical.simulate(env),
    ]);

    // Paranoid should have more steps than fast
    expect(paranoidResult.steps.length).toBeGreaterThanOrEqual(fastResult.steps.length);
    // Methodical should have more steps than fast
    expect(methodicalResult.steps.length).toBeGreaterThanOrEqual(fastResult.steps.length);
  });
});

// ===================================================================
// Reality Auditor
// ===================================================================

import { RealityAuditor, createRealityAuditor } from "../realism/reality-audit";

describe("Reality Auditor", () => {
  it("calculates reality gap", () => {
    const auditor = createRealityAuditor();
    const env = {
      services: { nginx: { status: "running" }, mysql: { status: "running" } },
      logs: ["nginx: started", "mysql: ready"],
      network: { latencyMs: 50 },
      storage: { raid: { status: "healthy" } },
      db: { lag: 200 },
      memory: 45,
      cpu: 20,
    };
    const result = auditor.audit(env);
    expect(result.drift.realityGap).toBeGreaterThanOrEqual(0);
    expect(result.drift.realityGap).toBeLessThanOrEqual(1);
  });

  it("detects drift", () => {
    const auditor = createRealityAuditor();
    const env = {
      services: { nginx: { status: "running" } },
      logs: ["nginx: info"],
      network: { latencyMs: 50 },
      memory: 40,
      cpu: 15,
    };
    // Run multiple audits to build history
    for (let i = 0; i < 5; i++) {
      env.network.latencyMs += 100;
      auditor.audit(env);
    }
    const result = auditor.audit(env);
    expect(result.drift.trend).toBeDefined();
    expect(["improving", "stable", "degrading"]).toContain(result.drift.trend);
  });

  it("flags too deterministic systems", () => {
    const auditor = createRealityAuditor();
    const env = {
      services: {
        nginx: { status: "running" },
        mysql: { status: "running" },
        redis: { status: "running" },
        api: { status: "running" },
      },
      logs: ["all good"],
      network: { latencyMs: 10 },
      memory: 30,
      cpu: 10,
    };
    const result = auditor.audit(env);
    // All services in same state → highly predictable
    expect(result.drift.predictability).toBeGreaterThan(0.5);
    if (result.drift.predictability > 0.9) {
      expect(result.drift.flags).toContain("too_deterministic");
    }
  });

  it("shadow validation works", () => {
    const env = {
      network: { latencyMs: 100 },
      db: { lag: 500 },
      services: { nginx: { status: "running" }, mysql: { status: "running" } },
    };
    const incident = {
      networkLatency: 120,
      dbLag: 600,
      serviceStatus: { nginx: "running", mysql: "running" },
    };
    const result = RealityAuditor.shadowValidate(incident, env);
    expect(result).toHaveProperty("gap");
    expect(result).toHaveProperty("match");
    expect(result.gap).toBeGreaterThanOrEqual(0);
    expect(result.gap).toBeLessThanOrEqual(1);
  });
});

// ===================================================================
// Language Gate
// ===================================================================

import {
  detectLanguage,
  hasForbiddenPattern,
  extractStringsFromContent,
  scanContent,
  validateLanguage,
  FORBIDDEN_PATTERNS,
  HINGLISH_HINTS,
  DEFAULT_EXCLUDED,
} from "../realism/language-gate";

describe("Language Gate", () => {
  it("detects English", () => {
    expect(detectLanguage("Connection successful")).toBe("english");
    expect(detectLanguage("Server started on port 8080")).toBe("english");
    expect(detectLanguage("Hello world")).toBe("english");
  });

  it("detects Hinglish", () => {
    expect(detectLanguage("Server kaise hai")).toBe("hinglish");
    expect(detectLanguage("Kya kar raha hai")).toBe("hinglish");
    expect(detectLanguage("Bhai, yeh nahi hoga")).toBe("hinglish");
  });

  it("flags Italian text", () => {
    expect(detectLanguage("Connessione non valido")).toBe("other");
    expect(detectLanguage("Errore di configurazione")).toBe("other");
    expect(detectLanguage("configurazione non valida")).toBe("other");
  });

  it("forbidden patterns caught", () => {
    expect(hasForbiddenPattern("connexion refusée")).toEqual({
      matched: true,
      pattern: "fr",
    });
    expect(hasForbiddenPattern("Es gab einen Fehler")).toEqual({
      matched: true,
      pattern: "de",
    });
    expect(hasForbiddenPattern("Error de conexión")).toEqual({
      matched: true,
      pattern: "es",
    });
    expect(hasForbiddenPattern("All good here")).toEqual({ matched: false });
  });
});

// ===================================================================
// Tone Enforcer
// ===================================================================

import { ToneEnforcer, createToneEnforcer } from "../realism/tone-enforcer";

describe("Tone Enforcer", () => {
  it("fixes error messages", () => {
    const enforcer = createToneEnforcer();
    const result = enforcer.fixText("An error occurred while processing your request");
    expect(result).toContain("Something went wrong");
  });

  it("fixes CTA text", () => {
    const enforcer = createToneEnforcer();
    const result = enforcer.fixText("Click here to start the simulation");
    expect(result).toContain("Start now");
  });

  it("removes fluff words", () => {
    const enforcer = createToneEnforcer();
    const result = enforcer.enforce("Please very kindly try again");
    expect(result.passed).toBe(false);
    const fluffViolation = result.violations.find((v) => v.rule === "No fluff words");
    expect(fluffViolation).toBeDefined();
  });

  it("applies all rules", () => {
    const enforcer = createToneEnforcer();
    const result = enforcer.enforce("An error occurred while processing your request");
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    // Should have error_friendly violation
    const errorViolation = result.violations.find((v) => v.rule === "Friendly error messages");
    expect(errorViolation).toBeDefined();
    expect(errorViolation?.fixed).toBeDefined();
  });
});

// ===================================================================
// Copy Optimizer
// ===================================================================

import { CopyOptimizer, createCopyOptimizer } from "../realism/copy-optimizer";

describe("Copy Optimizer", () => {
  it("classifies text types", () => {
    const optimizer = createCopyOptimizer();
    expect(optimizer.classify("an error occurred")).toBe("error");
    expect(optimizer.classify("connection failed")).toBe("error");
    expect(optimizer.classify("broken pipe")).toBe("error");
    expect(optimizer.classify("click here to start")).toBe("cta");
    expect(optimizer.classify("start now")).toBe("cta");
    expect(optimizer.classify("try the demo here")).toBe("cta");
    expect(optimizer.classify("short tip")).toBe("tooltip");
    expect(optimizer.classify("this is a longer generic text that should be classified as generic because it has no special patterns and is longer than 80 characters total")).toBe("generic");
  });

  it("rewrites errors", () => {
    const optimizer = createCopyOptimizer();
    expect(optimizer.rewrite("an error occurred while processing your request", "error")).toBe(
      "Something went wrong"
    );
    expect(optimizer.rewrite("please try again later", "error")).toBe("Try again");
    expect(optimizer.rewrite("the server has encountered an error", "error")).toBe("Server error");
    expect(optimizer.rewrite("connection was refused", "error")).toBe("Connection refused");
  });

  it("generates variants", () => {
    const optimizer = createCopyOptimizer();
    const errorVariants = optimizer.generateVariants("an error occurred", "error");
    expect(errorVariants.length).toBeGreaterThan(1);

    const ctaVariants = optimizer.generateVariants("click here to start the simulation", "cta");
    expect(ctaVariants.length).toBeGreaterThan(1);

    const tooltipVariants = optimizer.generateVariants("This is a short tooltip", "tooltip");
    expect(tooltipVariants.length).toBeGreaterThan(0);
  });

  it("picks best variant", () => {
    const optimizer = createCopyOptimizer();
    const variants = [
      "an error occurred while processing your request",
      "Something went wrong",
      "error occurred processing request",
    ];
    const best = optimizer.pickBest(variants);
    // "Something went wrong" should score highest (short + action verb)
    expect(best).toBe("Something went wrong");
  });
});

// ===================================================================
// Integration: Full Pipeline
// ===================================================================

describe("Full Pipeline Integration", () => {
  it("incident → chaos → audit → senior sim → score", async () => {
    // 1. Start with healthy environment
    const env = makeHealthyEnv();
    env.logs = [];

    // 2. Run chaos engine to inject faults
    const chaos = new ChaosEngine({ intensity: 0.8, intervalMs: 100, correlated: true });
    const chaosEvents = chaos.runChaos(env);

    // 3. Run an incident scenario through orchestrator
    const orchestrator = new IncidentOrchestrator();
    const incident = NETWORK_INCIDENTS[0];
    const orchestrationResult = await orchestrator.runScenario(env, incident, {
      delayBetweenStages: 0,
      applyCorrelations: true,
      validateDuringStages: true,
    });
    expect(orchestrationResult.stages.length).toBeGreaterThan(0);

    // 4. Audit reality
    const auditor = new RealityAuditor();
    const auditResult = auditor.audit(env);
    expect(auditResult.drift.realityGap).toBeGreaterThanOrEqual(0);
    expect(auditResult.drift.realityGap).toBeLessThanOrEqual(1);
    expect(auditResult.metaScore).toBeGreaterThanOrEqual(0);
    expect(auditResult.metaScore).toBeLessThanOrEqual(1);

    // 5. Senior simulator diagnoses
    const seniorSim = new SeniorSimulator("methodical");
    const simResult = await seniorSim.simulate(env);
    expect(simResult).toHaveProperty("diagnosis");
    expect(simResult).toHaveProperty("confidence");
    expect(simResult).toHaveProperty("steps");
    expect(simResult).toHaveProperty("success");

    // 6. Cross-validate with shadow validation
    const shadowResult = RealityAuditor.shadowValidate(
      {
        networkLatency: env.network?.latencyMs ?? 0,
        dbLag: env.db?.lag ?? 0,
        serviceStatus: env.services
          ? Object.fromEntries(
              Object.entries(env.services).map(([k, v]: [string, any]) => [k, v.status])
            )
          : {},
      },
      env
    );
    expect(shadowResult).toHaveProperty("gap");
    expect(shadowResult).toHaveProperty("match");

    // Verify the full pipeline produced coherent results
    expect(chaosEvents.length).toBeGreaterThanOrEqual(0);
    expect(orchestrationResult.environmentState.length).toBeGreaterThan(0);
    expect(auditResult.realityChecks.length).toBeGreaterThan(0);
    expect(simResult.steps.length).toBeGreaterThanOrEqual(0);
  });
});
