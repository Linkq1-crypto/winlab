import React, { useMemo, useState } from "react";

const scenarios = {
  ansible: {
    title: "Automation Lab — Ansible Incident",
    objective: "Restore 20 hosts after a critical CVE using an idempotent playbook.",
    accepted: ["inventory list", "ansible-playbook patch.yml --limit web --check", "ansible-playbook patch.yml --limit web"],
  },
  terraform: {
    title: "Automation Lab — Terraform Drift",
    objective: "Detect infrastructure drift and apply the fix only after plan approval.",
    accepted: ["terraform init", "terraform plan -out fix.plan", "terraform apply fix.plan"],
  },
};

const commandRules = [
  { pattern: /^inventory list$/, output: "Inventory loaded: web-01..web-20 (20 hosts)." },
  { pattern: /^ansible-playbook patch\.yml --limit web --check$/, output: "Dry-run OK: 20 changed, 0 failed." },
  { pattern: /^ansible-playbook patch\.yml --limit web$/, output: "Deploy complete: 20/20 success, restart rolling done." },
  { pattern: /^terraform init$/, output: "Terraform initialized with remote backend." },
  { pattern: /^terraform plan -out fix\.plan$/, output: "Plan: 2 to change, 0 to destroy." },
  { pattern: /^terraform apply fix\.plan$/, output: "Apply complete! Resources: 2 changed." },
];

export default function AutomationLab() {
  const [scenarioKey, setScenarioKey] = useState("ansible");
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [log, setLog] = useState(["Terminal ready. Select a scenario and type real commands."]);
  const [metrics, setMetrics] = useState({ cpu: 71, latency: 280, errorRate: 7.3, mistakes: 0 });

  const current = scenarios[scenarioKey];
  const done = useMemo(() => step >= current.accepted.length, [step, current.accepted.length]);

  const switchScenario = (key) => {
    setScenarioKey(key);
    setStep(0);
    setInput("");
    setMetrics({ cpu: 74, latency: 300, errorRate: 8.4, mistakes: 0 });
    setLog([`Scenario loaded: ${scenarios[key].title}`]);
  };

  const runCommand = () => {
    if (!input.trim() || done) return;
    const expected = current.accepted[step];
    const cmd = input.trim();
    const rule = commandRules.find((r) => r.pattern.test(cmd));
    if (cmd !== expected) {
      setMetrics((m) => ({ ...m, latency: m.latency + 30, errorRate: +(m.errorRate + 1.2).toFixed(1), mistakes: m.mistakes + 1 }));
      setLog((prev) => [`❌ ${cmd}`, `Expected step ${step + 1}: ${expected}`, ...prev]);
      setInput("");
      return;
    }

    setStep((s) => s + 1);
    setMetrics((m) => ({
      ...m,
      cpu: Math.max(30, m.cpu - 8),
      latency: Math.max(80, m.latency - 55),
      errorRate: Math.max(0.3, +(m.errorRate - 2.1).toFixed(1)),
    }));
    setLog((prev) => [`$ ${cmd}`, `${rule ? rule.output : "Command executed."}`, ...prev]);
    setInput("");
  };

  const handleKey = (e) => { if (e.key === "Enter") runCommand(); };

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <h2>{current.title}</h2>
      <p>{current.objective}</p>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => switchScenario("ansible")}>
          Ansible Incident
        </button>
        <button type="button" onClick={() => switchScenario("terraform")}>
          Terraform Drift
        </button>
      </div>

      <div style={{ border: "1px solid #1e293b", borderRadius: 8, padding: 10, background: "#020617", color: "#cbd5e1" }}>
        <p>
          Step {Math.min(step + 1, current.accepted.length)}/{current.accepted.length} · Mistakes: {metrics.mistakes}
        </p>
        <p>
          CPU {metrics.cpu}% · Latency {metrics.latency}ms · Error Rate {metrics.errorRate}%
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={done ? "Scenario complete" : "Type command..."}
            disabled={done}
          />
          <button type="button" onClick={runCommand} disabled={done}>
            RUN
          </button>
        </div>
        {done && <strong>✅ Post-scenario: drift resolved and service stabilized.</strong>}
        <ul>
          {log.slice(0, 10).map((entry, i) => (
            <li key={`${entry}-${i}`}>{entry}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
