import React, { useMemo, useState } from "react";
import { opsLabScenarios, troubleshootingMatrix } from "./opsPlaybookScenarios";

function evaluateCommand(expected, input) {
  const normalizedInput = input.trim().toLowerCase();
  const normalizedExpected = expected.trim().toLowerCase();
  return normalizedInput === normalizedExpected;
}

export default function OpsPlaybookLab() {
  const [scenarioId, setScenarioId] = useState(opsLabScenarios[0].id);
  const [step, setStep] = useState(0);
  const [command, setCommand] = useState("");
  const [logs, setLogs] = useState(["Lab ready. Select a scenario and execute the runbook commands."]);
  const [errors, setErrors] = useState(0);

  const scenario = useMemo(
    () => opsLabScenarios.find((item) => item.id === scenarioId) || opsLabScenarios[0],
    [scenarioId]
  );
  const completed = step >= scenario.runbook.length;

  const switchScenario = (id) => {
    setScenarioId(id);
    setStep(0);
    setCommand("");
    setErrors(0);
    const next = opsLabScenarios.find((s) => s.id === id);
    setLogs([`Scenario loaded: ${next ? next.title : id}`]);
  };

  const run = () => {
    if (completed || !command.trim()) return;
    const expected = scenario.runbook[step];
    const ok = evaluateCommand(expected, command);

    if (!ok) {
      setErrors((n) => n + 1);
      setLogs((prev) => [`❌ ${command}`, `Expected: ${expected}`, ...prev]);
      setCommand("");
      return;
    }

    setLogs((prev) => [`✅ ${command}`, "Command accepted. Proceed to next step.", ...prev]);
    setStep((s) => s + 1);
    setCommand("");
  };

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <header>
        <h2>Deploy, Troubleshooting & Maintenance Lab</h2>
        <p>Stack: Vite/React + Express + Nginx + PM2 + Cloudflare</p>
        <p>All content uses generic paths and domains for safe training environments.</p>
      </header>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {opsLabScenarios.map((item) => (
          <button key={item.id} type="button" onClick={() => switchScenario(item.id)}>
            {item.title}
          </button>
        ))}
      </div>

      <article style={{ border: "1px solid #334155", borderRadius: 8, padding: 12 }}>
        <h3>{scenario.title}</h3>
        <p>{scenario.objective}</p>
        <p>
          Step {Math.min(step + 1, scenario.runbook.length)}/{scenario.runbook.length} · Errors: {errors}
        </p>
        <h4>Checklist</h4>
        <ul>
          {scenario.checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <article style={{ border: "1px solid #0f172a", background: "#020617", color: "#e2e8f0", borderRadius: 8, padding: 12 }}>
        <h4>Command Simulator</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={completed ? "Scenario complete" : "Type exact command"}
            disabled={completed}
          />
          <button type="button" onClick={run} disabled={completed || !command.trim()}>
            RUN
          </button>
        </div>
        {completed && <strong>Scenario completed. Move to the next scenario.</strong>}
        <ul>
          {logs.slice(0, 10).map((entry, idx) => (
            <li key={`${entry}-${idx}`}>{entry}</li>
          ))}
        </ul>
      </article>

      <article style={{ border: "1px solid #64748b", borderRadius: 8, padding: 12 }}>
        <h4>Troubleshooting Matrix</h4>
        <table>
          <thead>
            <tr>
              <th>Symptom</th>
              <th>Likely Cause</th>
              <th>Recommended Fix</th>
            </tr>
          </thead>
          <tbody>
            {troubleshootingMatrix.map((row) => (
              <tr key={row.symptom}>
                <td>{row.symptom}</td>
                <td>{row.cause}</td>
                <td>{row.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}
