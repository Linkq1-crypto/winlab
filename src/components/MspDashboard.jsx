import React, { useMemo, useState } from "react";

const initialTenants = [
  { id: "acme", name: "Acme Health", sla: "Gold", incidents: 3, critical: 2, status: "Ransomware containment" },
  { id: "cyberdyne", name: "Cyberdyne Labs", sla: "Silver", incidents: 4, critical: 1, status: "Phishing campaign" },
  { id: "globex", name: "Globex Retail", sla: "Platinum", incidents: 5, critical: 2, status: "Lateral movement detected" },
];

const roles = ["DevOps", "Security", "IT Manager"];
const actions = [
  { id: "isolate", label: "Isolate endpoint", impact: { critical: -1, incidents: -1 } },
  { id: "revoke", label: "Revoke tokens / force MFA", impact: { critical: -1, incidents: 0 } },
  { id: "rollback", label: "Rollback deployment", impact: { critical: 0, incidents: -1 } },
];

export default function MspDashboard() {
  const [tenants, setTenants] = useState(initialTenants);
  const [selected, setSelected] = useState("acme");
  const [role, setRole] = useState("Security");
  const [chatInput, setChatInput] = useState("");
  const [timeline, setTimeline] = useState(["SOC shift started: multi-tenant war-room alignment."]);
  const [chat, setChat] = useState(["[IT Manager] SLA Platinum priority assigned to Globex."]);

  const selectedTenant = tenants.find((t) => t.id === selected);
  const openCritical = useMemo(() => tenants.reduce((acc, t) => acc + t.critical, 0), [tenants]);

  const applyAction = (action) => {
    if (!selectedTenant) return;
    setTenants((prev) =>
      prev.map((t) => {
        if (t.id !== selectedTenant.id) return t;
        return {
          ...t,
          critical: Math.max(0, t.critical + action.impact.critical),
          incidents: Math.max(0, t.incidents + action.impact.incidents),
        };
      })
    );
    setTimeline((log) => [`[${role}] ${action.label} on ${selectedTenant.name}`, ...log]);
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    setChat((log) => [`[${role}] ${chatInput.trim()}`, ...log]);
    setChatInput("");
  };

  const handleKey = (e) => { if (e.key === "Enter") sendChat(); };

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <h2>SOC Incident Response (Advanced Multi-tenant)</h2>
      <p>
        Active role:
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ marginLeft: 8 }}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </p>
      <p>Global open criticals: {openCritical}</p>

      <table>
        <thead>
          <tr>
            <th>Tenant</th>
            <th>SLA</th>
            <th>Incidents</th>
            <th>Critical</th>
            <th>Current status</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr
              key={tenant.id}
              onClick={() => setSelected(tenant.id)}
              style={{ background: selected === tenant.id ? "#dbeafe" : "transparent", cursor: "pointer" }}
            >
              <td>{tenant.name}</td>
              <td>{tenant.sla}</td>
              <td>{tenant.incidents}</td>
              <td>{tenant.critical}</td>
              <td>{tenant.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {actions.map((a) => (
          <button key={a.id} type="button" onClick={() => applyAction(a)}>
            {a.label}
          </button>
        ))}
      </div>

      <div style={{ border: "1px solid #94a3b8", borderRadius: 8, padding: 10 }}>
        <h4>Scenario Internal Chat</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Scrivi decisione condivisa..."
          />
          <button type="button" onClick={sendChat}>
            Send
          </button>
        </div>
        <ul>
          {chat.slice(0, 8).map((entry, i) => (
            <li key={`${entry}-${i}`}>{entry}</li>
          ))}
        </ul>
      </div>

      <aside>
        <h4>Audit Trail</h4>
        <ul>
          {timeline.slice(0, 8).map((line, i) => (
            <li key={`${line}-${i}`}>{line}</li>
          ))}
        </ul>
        {openCritical === 0 && <strong>✅ All multi-tenant criticals resolved.</strong>}
      </aside>
    </section>
  );
}
