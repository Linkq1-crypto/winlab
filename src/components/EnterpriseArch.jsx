import React, { useMemo, useState } from "react";
import { useScenarioEngine } from "./useScenarioEngine";
import EnterpriseControls from "./EnterpriseControls";

const scenarioMap = {
  multisite: {
    id: "multisite",
    title: "Active Directory Multi-Site Failure",
    objective: "Restore branch authentication + AD replication without exceeding €20k business impact.",
  },
  fsmo: {
    id: "fsmo",
    title: "FSMO Seizure Scenario",
    objective: "Recover FSMO roles while minimizing security risk and downtime.",
  },
  trust: {
    id: "trust",
    title: "Trust Relationship Break",
    objective: "Restore forest trust without locking out VIP users.",
  },
  rodc: {
    id: "rodc",
    title: "RODC Authentication Failure",
    objective: "Unblock branch logon using secure credential cache.",
  },
  forest: {
    id: "forest",
    title: "Forest Migration Scenario",
    objective: "Complete forest migration with stability score > 80.",
  },
};

const initialState = {
  scenario: "multisite",
  sites: [
    { id: "hq",     name: "HQ",     dc: "DC-PRIMARY",   status: "degraded" },
    { id: "dr",     name: "DR",     dc: "DC-SECONDARY", status: "healthy"  },
    { id: "branch", name: "Branch", dc: "RODC-01",      status: "down"     },
  ],
  done: [],
  penalties: { tempo: 0, costo: 0, sicurezza: 0, stabilita: 0 },
  businessImpact: 3200,
};

const decisions = [
  {
    id: "force-replication",
    label: "Force replication HQ→Branch",
    log: "Forced replication completed, Kerberos backlog reduced.",
    reducer: (prev) => ({
      ...prev,
      done: prev.done.includes("replica") ? prev.done : [...prev.done, "replica"],
      sites: prev.sites.map((s) => (s.id === "branch" ? { ...s, status: "degraded" } : s)),
      penalties: { ...prev.penalties, tempo: prev.penalties.tempo + 4, costo: prev.penalties.costo + 3 },
    }),
  },
  {
    id: "restore-rodc",
    label: "Restore RODC credentials cache",
    log: "RODC cache rebuild OK, branch logon recovering.",
    reducer: (prev) => ({
      ...prev,
      done: prev.done.includes("cache") ? prev.done : [...prev.done, "cache"],
      sites: prev.sites.map((s) => (s.id === "branch" ? { ...s, status: "healthy" } : s)),
      penalties: { ...prev.penalties, tempo: prev.penalties.tempo + 2 },
    }),
  },
  {
    id: "seize-fsmo",
    label: "Emergency FSMO seizure",
    log: "FSMO seizure executed: service restored but audit opened.",
    reducer: (prev) => ({
      ...prev,
      done: prev.done.includes("fsmo") ? prev.done : [...prev.done, "fsmo"],
      penalties: {
        ...prev.penalties,
        sicurezza: prev.penalties.sicurezza + 12,
        costo: prev.penalties.costo + 15,
      },
      businessImpact: prev.businessImpact + 9000,
    }),
  },
  {
    id: "repair-trust",
    label: "Repair forest trust + SID filtering",
    log: "Trust relationship validated on both forests.",
    reducer: (prev) => ({
      ...prev,
      done: prev.done.includes("trust") ? prev.done : [...prev.done, "trust"],
      penalties: { ...prev.penalties, tempo: prev.penalties.tempo + 5, stabilita: prev.penalties.stabilita + 2 },
    }),
  },
];

const randomEvents = [
  { message: "VIP ticket: finance user lockout detected", penalty: { tempo: 4, costo: 3 }, businessImpact: 1200 },
  { message: "WAN latency > 250ms to DR site",            penalty: { stabilita: 5 },        businessImpact: 500  },
  { message: "Lateral movement attempt blocked",           penalty: { sicurezza: 6 },        businessImpact: 1800 },
];

export default function EnterpriseArch() {
  const engine = useScenarioEngine("enterprise-arch-v2", {
    initialState,
    initialTimeline: [
      "INC-9402 opened: AD authentication failures on European branches.",
      "Use progressive decisions + chaos events to close the incident.",
    ],
    randomEvents,
  });
  const [mentorMode, setMentorMode] = useState("balanced");

  const currentScenario = scenarioMap[engine.state.scenario];

  const resolved = useMemo(
    () => engine.state.done.length >= 3 && engine.score.risk < 35 && engine.score.businessImpact < 20000,
    [engine.score.businessImpact, engine.score.risk, engine.state.done.length]
  );

  const setScenario = (scenarioId) => {
    engine.setState((prev) => ({ ...prev, scenario: scenarioId, done: [] }));
    engine.setTimeline((log) => [`Scenario switched: ${scenarioMap[scenarioId].title}`, ...log]);
  };

  const mentorMessage =
    mentorMode === "strict"
      ? "AI Mentor: avoid FSMO Seizure unless you have already tried replication/restore."
      : "AI Mentor: prioritize user restoration first, then minimize risk and cost.";

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <header>
        <h2>Enterprise Architecture Crisis Lab</h2>
        <p>{currentScenario.title}</p>
        <p>{currentScenario.objective}</p>
      </header>

      {/* Scenario selector */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Object.values(scenarioMap).map((s) => (
          <button key={s.id} onClick={() => setScenario(s.id)} type="button">
            {s.title}
          </button>
        ))}
      </div>

      {/* Site status cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {engine.state.sites.map((site) => (
          <article key={site.id} style={{ border: "1px solid #2d3748", borderRadius: 8, padding: 10 }}>
            <strong>{site.name} · {site.dc}</strong>
            <p>Status: {site.status}</p>
          </article>
        ))}
      </div>

      {/* Decision buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {decisions.map((d) => (
          <button key={d.id} type="button" onClick={() => engine.applyDecision(d)}>
            {d.label}
          </button>
        ))}
        <button type="button" onClick={engine.injectEvent}>
          Inject Chaos Event
        </button>
      </div>

      {/* Scoring engine */}
      <div style={{ border: "1px solid #475569", borderRadius: 8, padding: 10 }}>
        <h4>Scoring Engine</h4>
        <p>
          Time {engine.score.tempo} · Cost {engine.score.costo} · Security {engine.score.sicurezza} · Stability{" "}
          {engine.score.stabilita}
        </p>
        <p>Risk Score: {engine.score.risk} · Business Impact: €{engine.score.businessImpact}</p>
        <p>
          Actions taken: {engine.actionCount} · Elapsed: {engine.elapsedMin}m ·{" "}
          <strong>Leaderboard score: {Math.round(engine.leaderboardScore)}</strong>
        </p>
      </div>

      {/* Adaptive difficulty + skill gap */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {/* Adaptive Difficulty + Skill Gap Detection */}
        <div style={{ border: "1px solid #374151", borderRadius: 8, padding: 10 }}>
          <h4>Adaptive Difficulty</h4>
          <p style={{ fontSize: "1.1em" }}>{engine.adaptiveDifficulty.label}</p>
          <p style={{ color: "#94a3b8" }}>{engine.adaptiveDifficulty.hint}</p>
        </div>
        <div style={{ border: "1px solid #374151", borderRadius: 8, padding: 10 }}>
          <h4>Skill Gap Detection</h4>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {engine.skillGapDetection.map((item) => (
              <li key={item.skill}>
                <strong>{item.skill}</strong>: {item.level}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* AI Mentor */}
      <div style={{ border: "1px solid #64748b", borderRadius: 8, padding: 10 }}>
        <h4>AI Mentor</h4>
        <select value={mentorMode} onChange={(e) => setMentorMode(e.target.value)}>
          <option value="balanced">Balanced</option>
          <option value="strict">Strict</option>
        </select>
        <p>{mentorMessage}</p>
        {resolved ? (
          <strong>✅ Scenario closed: all KPIs within enterprise threshold.</strong>
        ) : (
          <p>Post-analysis active: close 3 decisions with risk and impact below threshold.</p>
        )}
      </div>

      {/* Timeline / audit trail */}
      <aside style={{ border: "1px solid #334155", borderRadius: 8, padding: 10 }}>
        <h4>Timeline / Audit Trail</h4>
        <ul>
          {engine.timeline.slice(0, 8).map((line, i) => (
            <li key={`${line}-${i}`}>{line}</li>
          ))}
        </ul>
      </aside>

      {/* Enterprise controls: SSO, leaderboard, export */}
      <EnterpriseControls
        currentTeamScore={engine.leaderboardScore}
        scenarioName={currentScenario.title}
        scenarioId={engine.state.scenario}
        engine={engine}
      />
    </section>
  );
}
