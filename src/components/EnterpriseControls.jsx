import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";

const FALLBACK_LEADERBOARD = [
  { teamName: "Alpha Squad",  region: "EU-West",    leaderboardScore: 412 },
  { teamName: "Blue Team",    region: "US-East",    leaderboardScore: 387 },
  { teamName: "Red Ops",      region: "APAC",       leaderboardScore: 351 },
  { teamName: "DevSec Guild", region: "EU-Central", leaderboardScore: 298 },
];

export default function EnterpriseControls({ currentTeamScore, scenarioName, scenarioId, engine }) {
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [provider, setProvider]     = useState("Azure AD");
  const [tenantId, setTenantId]     = useState("");
  const [leaderboard, setLeaderboard] = useState(FALLBACK_LEADERBOARD);
  const [saving, setSaving]          = useState(false);
  const [saved, setSaved]            = useState(false);

  // Fetch leaderboard for current scenario
  useEffect(() => {
    if (!scenarioId) return;
    fetch(`/api/leaderboard?scenarioId=${encodeURIComponent(scenarioId)}&limit=10`)
      .then((r) => r.ok ? r.json() : null)
      .then((rows) => { if (rows?.length) setLeaderboard(rows); })
      .catch(() => {});
  }, [scenarioId]);

  // Merge live score and sort
  const ranked = [
    ...leaderboard.filter((r) => r.teamName !== "Your Team"),
    { teamName: "Your Team", region: "Live", leaderboardScore: Math.round(currentTeamScore) },
  ].sort((a, b) => b.leaderboardScore - a.leaderboardScore);

  const submitScore = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: "Your Team",
          region: "EU",
          scenarioId,
          scenarioName,
          leaderboardScore: Math.round(currentTeamScore),
          riskScore:        engine?.score?.risk        ?? 0,
          businessImpact:   engine?.score?.businessImpact ?? 0,
          elapsedMin:       engine?.elapsedMin         ?? 1,
          actionCount:      engine?.actionCount        ?? 0,
        }),
      });
      setSaved(true);
      // Refresh leaderboard
      const rows = await fetch(`/api/leaderboard?scenarioId=${encodeURIComponent(scenarioId)}&limit=10`).then((r) => r.json());
      if (rows?.length) setLeaderboard(rows);
    } catch (_) {
    } finally {
      setSaving(false);
    }
  };

  const exportPdfReport = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const ts = new Date().toLocaleString();
    const score = engine?.score ?? {};
    const lbScore = Math.round(currentTeamScore);

    // ── Header ──────────────────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("WinLab — Enterprise Scenario Report", 14, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${ts}`, 14, 22);

    // ── Scenario info ────────────────────────────────────────────────────────
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Scenario", 14, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(scenarioName || "—", 14, 48);

    // ── KPI table ────────────────────────────────────────────────────────────
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("KPI Summary", 14, 62);

    const kpiRows = [
      ["Metric", "Score"],
      ["Time",              String(score.tempo         ?? "—")],
      ["Cost",              String(score.costo         ?? "—")],
      ["Security",          String(score.sicurezza     ?? "—")],
      ["Stability",         String(score.stabilita     ?? "—")],
      ["Risk Score",        String(score.risk          ?? "—")],
      ["Business Impact",   `€${score.businessImpact  ?? 0}`],
      ["Leaderboard Score", String(lbScore)],
      ["Elapsed",           `${engine?.elapsedMin ?? 1} min`],
      ["Actions taken",     String(engine?.actionCount ?? 0)],
    ];

    let y = 70;
    kpiRows.forEach(([label, value], i) => {
      if (i === 0) {
        doc.setFillColor(30, 58, 95);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFillColor(i % 2 === 0 ? 245 : 255, i % 2 === 0 ? 247 : 255, i % 2 === 0 ? 250 : 255);
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "normal");
      }
      doc.rect(14, y - 5, 90, 8, "F");
      doc.text(label, 16, y);
      doc.text(value,  80, y);
      y += 9;
    });

    // ── Leaderboard ──────────────────────────────────────────────────────────
    y += 6;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Team Leaderboard", 14, y);
    y += 8;

    const lbHeader = ["#", "Team", "Region", "Score"];
    const colX     = [14, 24, 90, 155];

    doc.setFillColor(30, 58, 95);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.rect(14, y - 5, 180, 8, "F");
    lbHeader.forEach((h, i) => doc.text(h, colX[i], y));
    y += 9;

    ranked.forEach((row, idx) => {
      const isYou = row.teamName === "Your Team";
      doc.setFillColor(isYou ? 30 : (idx % 2 === 0 ? 245 : 255), isYou ? 58 : (idx % 2 === 0 ? 247 : 255), isYou ? 95 : (idx % 2 === 0 ? 250 : 255));
      doc.setTextColor(isYou ? 255 : 30, isYou ? 255 : 30, isYou ? 255 : 30);
      doc.setFont("helvetica", isYou ? "bold" : "normal");
      doc.rect(14, y - 5, 180, 8, "F");
      doc.text(String(idx + 1),                    colX[0], y);
      doc.text(row.teamName,                        colX[1], y);
      doc.text(row.region,                          colX[2], y);
      doc.text(String(row.leaderboardScore ?? row.score ?? 0), colX[3], y);
      y += 9;
    });

    // ── SSO Config ───────────────────────────────────────────────────────────
    y += 6;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Enterprise Controls", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`SSO: ${ssoEnabled ? `Enabled via ${provider} (Tenant: ${tenantId || "N/A"})` : "Disabled"}`, 14, y);

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("WinLab Enterprise — winlab.cloud", 14, 285);
    doc.text(`Page 1`, 190, 285, { align: "right" });

    doc.save(`winlab-report-${scenarioId || "scenario"}-${Date.now()}.pdf`);
  };

  return (
    <section style={{ border: "1px solid #1e3a5f", borderRadius: 10, padding: 14, display: "grid", gap: 14 }}>
      <h3>Enterprise Controls</h3>

      {/* SSO config */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={ssoEnabled}
            onChange={(e) => setSsoEnabled(e.target.checked)}
          />
          Enable SSO/SAML
        </label>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={!ssoEnabled}>
          <option>Azure AD</option>
          <option>Okta</option>
          <option>Google Workspace</option>
        </select>
        <input
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          placeholder="Tenant ID"
          disabled={!ssoEnabled}
          style={{ flex: 1, minWidth: 140 }}
        />
      </div>
      <p>SSO Status: <strong>{ssoEnabled ? `Enabled via ${provider}` : "Disabled"}</strong></p>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={exportPdfReport}>
          Export PDF report
        </button>
        <button type="button" onClick={submitScore} disabled={saving || saved}>
          {saved ? "✅ Score saved" : saving ? "Saving…" : "Submit score to leaderboard"}
        </button>
      </div>

      {/* Leaderboard */}
      <div>
        <h4>Leaderboard — {scenarioName || "Scenario"}</h4>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left",  padding: "4px 8px" }}>#</th>
              <th style={{ textAlign: "left",  padding: "4px 8px" }}>Team</th>
              <th style={{ textAlign: "left",  padding: "4px 8px" }}>Region</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row, index) => (
              <tr
                key={`${row.teamName}-${index}`}
                style={{
                  background:  row.teamName === "Your Team" ? "#1e3a5f" : "transparent",
                  fontWeight:  row.teamName === "Your Team" ? "bold"    : "normal",
                }}
              >
                <td style={{ padding: "4px 8px" }}>{index + 1}</td>
                <td style={{ padding: "4px 8px" }}>{row.teamName}</td>
                <td style={{ padding: "4px 8px" }}>{row.region}</td>
                <td style={{ padding: "4px 8px", textAlign: "right" }}>
                  {row.leaderboardScore ?? row.score ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
