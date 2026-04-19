import React, { useMemo, useState } from "react";
import { opsLabScenarios, troubleshootingMatrix } from "./opsPlaybookScenarios";

const col = {
  ok:   "#4caf84",
  err:  "#e06060",
  warn: "#ffaa00",
  dim:  "#6b7280",
  out:  "#c5d8c5",
};

function evaluateCommand(expected, input) {
  return input.trim().toLowerCase() === expected.trim().toLowerCase();
}

export default function OpsPlaybookLab() {
  const [scenarioId, setScenarioId] = useState(opsLabScenarios[0].id);
  const [step, setStep]             = useState(0);
  const [command, setCommand]       = useState("");
  const [logs, setLogs]             = useState([{ text: "Lab ready. Select a scenario and execute the runbook commands.", type: "dim" }]);
  const [errors, setErrors]         = useState(0);
  const [completed, setCompleted]   = useState(false);
  // Track which steps have been confirmed completed (for guard checks)
  const [doneSteps, setDoneSteps]   = useState(new Set());
  // A penalty step can block progress until the user fixes something
  const [penaltyMode, setPenaltyMode] = useState(null); // null | { fix: string, message: string }

  const scenario = useMemo(
    () => opsLabScenarios.find(s => s.id === scenarioId) || opsLabScenarios[0],
    [scenarioId]
  );

  const switchScenario = (id) => {
    setScenarioId(id);
    setStep(0);
    setCommand("");
    setErrors(0);
    setCompleted(false);
    setDoneSteps(new Set());
    setPenaltyMode(null);
    const next = opsLabScenarios.find(s => s.id === id);
    const header = next?.incident
      ? [{ text: next.incident, type: "warn" }, { text: `Scenario: ${next.title}`, type: "dim" }]
      : [{ text: `Scenario loaded: ${next?.title || id}`, type: "dim" }];
    setLogs(header);
  };

  const run = () => {
    if (completed || !command.trim()) return;
    const cmd = command.trim();

    // ── Penalty mode: user must type the fix command ────────────────────────
    if (penaltyMode) {
      if (evaluateCommand(penaltyMode.fix, cmd)) {
        setLogs(prev => [
          { text: `✅ ${cmd}`, type: "ok" },
          { text: "Issue resolved. Continue the runbook.", type: "dim" },
          ...prev,
        ]);
        setDoneSteps(prev => new Set([...prev, penaltyMode.fix]));
        setPenaltyMode(null);
        setCommand("");
      } else {
        setErrors(n => n + 1);
        setLogs(prev => [
          { text: `❌ ${cmd}`, type: "err" },
          { text: `Required: ${penaltyMode.fix}`, type: "warn" },
          ...prev,
        ]);
        setCommand("");
      }
      return;
    }

    const expected = scenario.runbook[step];

    // ── Check custom output first (even if command doesn't match runbook) ──
    const customOutputs = scenario.commandOutputs || {};
    const customKey = Object.keys(customOutputs).find(k => evaluateCommand(k, cmd));
    if (customKey && !evaluateCommand(expected, cmd)) {
      const lines = customOutputs[customKey];
      setLogs(prev => [
        { text: `$ ${cmd}`, type: "out" },
        ...lines.map(t => ({ text: t, type: t.startsWith("#") ? "dim" : "out" })),
        ...prev,
      ]);
      setCommand("");
      return;
    }

    if (!evaluateCommand(expected, cmd)) {
      setErrors(n => n + 1);
      setLogs(prev => [
        { text: `❌ ${cmd}`, type: "err" },
        { text: `Expected: ${expected}`, type: "warn" },
        ...prev,
      ]);
      setCommand("");
      return;
    }

    // ── Guard check: did user skip a required prerequisite? ─────────────────
    const guards = scenario.guards || {};
    const requiredPrev = guards[expected];
    if (requiredPrev && !doneSteps.has(requiredPrev)) {
      const failMsg = (scenario.failureMessages || {})[requiredPrev]
        || `⚠ You skipped a required step. Run: ${requiredPrev}`;
      setErrors(n => n + 1);
      setLogs(prev => [
        { text: `❌ ${cmd}`, type: "err" },
        { text: failMsg, type: "err" },
        { text: `Fix required before continuing.`, type: "warn" },
        ...prev,
      ]);
      setPenaltyMode({ fix: requiredPrev, message: failMsg });
      setCommand("");
      return;
    }

    // ── Custom output on correct step ───────────────────────────────────────
    const stepOutputs = customOutputs[expected];
    const newDone = new Set([...doneSteps, expected]);
    setDoneSteps(newDone);

    const nextStep = step + 1;
    const isLast = nextStep >= scenario.runbook.length;

    if (stepOutputs) {
      setLogs(prev => [
        { text: `✅ ${cmd}`, type: "ok" },
        ...stepOutputs.map(t => ({ text: t, type: t.startsWith("#") ? "dim" : "out" })),
        ...prev,
      ]);
    } else {
      setLogs(prev => [{ text: `✅ ${cmd}`, type: "ok" }, ...prev]);
    }

    if (isLast) {
      const solvedMsg = scenario.solvedMessage || "✅ Scenario completed. All steps executed correctly.";
      setLogs(prev => [{ text: solvedMsg, type: "ok" }, ...prev]);
      setCompleted(true);
    }

    setStep(nextStep);
    setCommand("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter") run();
  };

  const currentExpected = penaltyMode
    ? penaltyMode.fix
    : (completed ? null : scenario.runbook[step]);

  return (
    <section style={{ display:"grid", gap:14, fontFamily:"'JetBrains Mono','Fira Code',monospace" }}>
      <header>
        <h2 style={{ color:"#c8d8c8" }}>Deploy, Troubleshooting &amp; Maintenance Lab</h2>
        <p style={{ color:"#6b7280", fontSize:12 }}>Stack: Vite/React + Express + Nginx + PM2 + Cloudflare</p>
      </header>

      {/* Scenario selector */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {opsLabScenarios.map(s => (
          <button key={s.id} type="button" onClick={() => switchScenario(s.id)}
            style={{ background: s.id===scenarioId ? "#1a3020" : "#0d1117", border:`1px solid ${s.id===scenarioId?"#4caf84":"#1c2030"}`, borderRadius:5, padding:"5px 10px", color: s.id===scenarioId ? "#4caf84" : "#6b7280", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>
            {s.title}
          </button>
        ))}
      </div>

      {/* Scenario info */}
      <div style={{ background:"#0d1117", border:"1px solid #1c2030", borderRadius:8, padding:14 }}>
        <div style={{ color:"#c8d8c8", fontWeight:700, marginBottom:6 }}>{scenario.title}</div>
        <div style={{ color:"#6b7280", fontSize:12, marginBottom:10 }}>{scenario.objective}</div>
        <div style={{ color:"#557", fontSize:11, marginBottom:8 }}>
          Step {Math.min(step + (penaltyMode?0:1), scenario.runbook.length)}/{scenario.runbook.length} &nbsp;·&nbsp; Errors: {errors}
          {penaltyMode && <span style={{ color:col.err }}> &nbsp;·&nbsp; ⚠ PENALTY MODE</span>}
        </div>
        <div style={{ fontSize:11, color:"#3a5a3a", marginBottom:4 }}>Checklist</div>
        <ul style={{ margin:0, paddingLeft:18, fontSize:11 }}>
          {scenario.checklist.map((item, i) => (
            <li key={item} style={{ color: i < step ? col.ok : "#445566", marginBottom:2 }}>
              {i < step ? "✅" : "○"} {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Terminal */}
      <div style={{ background:"#060809", border:"1px solid #1c2030", borderRadius:8, overflow:"hidden" }}>
        <div style={{ background:"#0d1117", borderBottom:"1px solid #1c2030", padding:"6px 14px", display:"flex", gap:5 }}>
          {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width:8,height:8,borderRadius:"50%",background:c }}/>)}
          <span style={{ color:"#3a6a3a", fontSize:11, marginLeft:8 }}>deploy@app.example.com</span>
        </div>

        {/* Log output */}
        <div style={{ padding:"10px 14px", minHeight:120, maxHeight:260, overflowY:"auto", display:"flex", flexDirection:"column-reverse" }}>
          {logs.slice(0, 20).map((entry, i) => (
            <div key={i} style={{ color: col[entry.type] || col.out, fontSize:12, whiteSpace:"pre-wrap", marginBottom:1 }}>
              {entry.text}
            </div>
          ))}
        </div>

        {/* Input */}
        <div style={{ borderTop:"1px solid #1c2030", padding:"8px 14px", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ color:"#3a6a3a", fontSize:12 }}>$</span>
          <input value={command} onChange={e => setCommand(e.target.value)} onKeyDown={handleKey}
            disabled={completed}
            placeholder={completed ? "Scenario complete" : currentExpected ? `hint: ${currentExpected.slice(0,30)}…` : ""}
            autoFocus spellCheck={false} autoComplete="off"
            style={{ flex:1, background:"none", border:"none", outline:"none", color:"#c8d8c8", fontFamily:"inherit", fontSize:12, caretColor:"#4caf84" }}/>
          <button type="button" onClick={run} disabled={completed || !command.trim()}
            style={{ background:"#1a3020", border:"1px solid #2c4030", borderRadius:4, color:"#4caf84", cursor:"pointer", padding:"3px 10px", fontSize:11, fontFamily:"inherit" }}>
            RUN
          </button>
        </div>
      </div>

      {completed && (
        <div style={{ background:"#0a1f10", border:"1px solid #4caf84", borderRadius:8, padding:14, color:"#4caf84", fontSize:12, whiteSpace:"pre-wrap" }}>
          {scenario.solvedMessage || "✅ Scenario completed. Move to the next."}
        </div>
      )}

      {/* Troubleshooting Matrix */}
      <div style={{ background:"#0d1117", border:"1px solid #1c2030", borderRadius:8, padding:14 }}>
        <div style={{ color:"#3a5a3a", fontSize:11, letterSpacing:2, marginBottom:10 }}>TROUBLESHOOTING MATRIX</div>
        <table style={{ width:"100%", fontSize:11, borderCollapse:"collapse" }}>
          <thead>
            <tr>
              {["Symptom","Likely Cause","Fix"].map(h => (
                <th key={h} style={{ textAlign:"left", color:"#445566", paddingBottom:6, paddingRight:12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {troubleshootingMatrix.map(row => (
              <tr key={row.symptom}>
                <td style={{ color:"#e06060", paddingRight:12, paddingBottom:4, verticalAlign:"top" }}>{row.symptom}</td>
                <td style={{ color:"#ffaa00", paddingRight:12, paddingBottom:4, verticalAlign:"top" }}>{row.cause}</td>
                <td style={{ color:"#c5d8c5", paddingBottom:4, verticalAlign:"top" }}>{row.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
