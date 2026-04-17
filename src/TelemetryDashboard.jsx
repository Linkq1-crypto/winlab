// TelemetryDashboard.jsx — Analytical dashboard con sidebar
// Route: /myrooting/telemetry

import { useState, useEffect } from "react";
import { loadTelemetry, getStats, getCommandsForScenario, getSessionsForScenario } from "./telemetry-storage";

// ── Helpers ───────────────────────────────────────────────────────────────────

function KPI({ label, value, sub, color = "#4caf84" }) {
  return (
    <div style={{ background: "#0d1117", border: "1px solid #1c2030", borderRadius: 10, padding: "16px 18px", minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "#556", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 10, color: "#445", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function HBar({ label, value, max, color = "#3b82f6" }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
      <span style={{ width: 90, fontSize: 10, color: "#667", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, background: "#151e2a", borderRadius: 3, height: 7 }}>
        <div style={{ width: `${pct}%`, height: 7, borderRadius: 3, background: color, transition: "width .4s" }} />
      </div>
      <span style={{ width: 28, textAlign: "right", fontSize: 10, color: "#aac", fontFamily: "monospace", flexShrink: 0 }}>{value}</span>
    </div>
  );
}

function Section({ title, children, style = {} }) {
  return (
    <div style={{ background: "#0d1117", border: "1px solid #1c2030", borderRadius: 10, padding: "16px 18px", ...style }}>
      <div style={{ fontSize: 10, color: "#4caf84", textTransform: "uppercase", letterSpacing: 3, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

// ── Launch data hook ──────────────────────────────────────────────────────────

function useLaunch() {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  const load = async () => {
    setErr(null);
    try {
      const r = await fetch("/api/analytics/launch");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);
  return { data, err, reload: load };
}

// ── VIEWS ─────────────────────────────────────────────────────────────────────

// OVERVIEW — tutto a colpo d'occhio
function ViewOverview({ launch, labStats }) {
  if (!launch.data && !launch.err) return <Spinner />;
  if (launch.err) return <Err msg={launch.err} />;
  const { summary, dailyStats, sources, devices, regions, scrollDepth, sections } = launch.data;
  const maxDay = dailyStats.reduce((m, d) => Math.max(m, d.uniqueVisitors), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        <KPI label="Visitatori" value={summary.totalUniqueVisitors} />
        <KPI label="Page views"  value={summary.totalPageViews} color="#60a5fa" />
        <KPI label="CTA click"   value={summary.ctaClicks} color="#f59e0b" />
        <KPI label="Form aperti" value={summary.signupStarts} color="#a78bfa" />
        <KPI label="Signup"      value={summary.signupDone} color="#34d399" />
        <KPI label="Conversion"  value={summary.conversionRate} color="#f87171" sub="visitor → signup" />
      </div>

      {/* Middle row: daily chart + device + regions */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }}>
        <Section title="Visitatori per giorno">
          {dailyStats.length === 0
            ? <Empty />
            : dailyStats.map(d => (
                <div key={d.date} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ width: 76, fontSize: 10, color: "#667", fontFamily: "monospace" }}>{d.date}</span>
                  <div style={{ flex: 1, background: "#151e2a", borderRadius: 3, height: 8 }}>
                    <div style={{ width: `${Math.round((d.uniqueVisitors / maxDay) * 100)}%`, height: 8, borderRadius: 3, background: "#3b82f6" }} />
                  </div>
                  <span style={{ width: 24, textAlign: "right", fontSize: 10, color: "#aac" }}>{d.uniqueVisitors}</span>
                  <span style={{ fontSize: 9, color: "#334" }}>{d.pageViews}pv</span>
                </div>
              ))
          }
        </Section>

        <Section title="Device">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            {devices.map(d => (
              <div key={d.device} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#889", textTransform: "capitalize" }}>
                  {d.device === "mobile" ? "📱" : d.device === "tablet" ? "📟" : "🖥️"} {d.device}
                </span>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#cde" }}>{d.count}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Regioni top">
          {regions.slice(0, 5).map(r => (
            <HBar key={r.region} label={r.region} value={r.count} max={regions[0]?.count || 1} color="#22c55e" />
          ))}
        </Section>
      </div>

      {/* Bottom row: sources + scroll + sections */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Section title="Sorgenti traffico">
          {sources.length === 0 ? <Empty /> : sources.slice(0, 6).map(s => (
            <HBar key={s.source} label={s.source || "direct"} value={s.count} max={sources[0].count} color="#a855f7" />
          ))}
        </Section>

        <Section title="Scroll depth">
          {[25, 50, 75, 100].map(pct => (
            <HBar key={pct} label={`${pct}%`} value={scrollDepth[pct] || 0} max={scrollDepth[25] || 1}
              color={pct <= 25 ? "#facc15" : pct <= 50 ? "#fb923c" : pct <= 75 ? "#f87171" : "#ef4444"} />
          ))}
          <div style={{ marginTop: 10, fontSize: 10, color: "#445" }}>
            Raggiunto fondo: {scrollDepth[100] || 0} utenti ({
              summary.totalUniqueVisitors > 0
                ? Math.round(((scrollDepth[100] || 0) / summary.totalUniqueVisitors) * 100)
                : 0
            }%)
          </div>
        </Section>

        <Section title="Sezioni viste">
          {sections.length === 0 ? <Empty /> : sections.map(s => (
            <HBar key={s.section} label={s.section} value={s.count} max={sections[0].count} color="#06b6d4" />
          ))}
        </Section>
      </div>

      {/* Lab stats strip */}
      {labStats && labStats.totalSessions > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          <KPI label="Lab sessions"  value={labStats.totalSessions} color="#60a5fa" />
          <KPI label="Commands"      value={labStats.totalCommands} color="#60a5fa" />
          <KPI label="Solve rate"    value={`${(labStats.solveRate * 100).toFixed(1)}%`} color="#34d399" />
          <KPI label="Error rate"    value={`${(labStats.errorRate * 100).toFixed(1)}%`} color="#f87171" />
          <KPI label="Avg timing"    value={`${labStats.avgTiming.toFixed(0)}ms`} color="#a78bfa" />
        </div>
      )}

      <div style={{ textAlign: "right" }}>
        <button onClick={launch.reload} style={btnStyle}>🔄 Aggiorna</button>
      </div>
    </div>
  );
}

// VISITATORI — daily detail
function ViewVisitors({ launch }) {
  if (!launch.data && !launch.err) return <Spinner />;
  if (launch.err) return <Err msg={launch.err} />;
  const { dailyStats, summary } = launch.data;
  const maxDay = dailyStats.reduce((m, d) => Math.max(m, d.uniqueVisitors), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        <KPI label="Totale unici" value={summary.totalUniqueVisitors} />
        <KPI label="Totale page views" value={summary.totalPageViews} color="#60a5fa" />
        <KPI label="Media/giorno" value={dailyStats.length ? Math.round(summary.totalUniqueVisitors / dailyStats.length) : "—"} color="#f59e0b" />
      </div>
      <Section title="Andamento giornaliero">
        {dailyStats.length === 0 ? <Empty /> : dailyStats.map(d => (
          <div key={d.date} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ width: 86, fontSize: 11, color: "#778", fontFamily: "monospace" }}>{d.date}</span>
            <div style={{ flex: 1, background: "#151e2a", borderRadius: 4, height: 14 }}>
              <div style={{ width: `${Math.round((d.uniqueVisitors / maxDay) * 100)}%`, height: 14, borderRadius: 4, background: "#3b82f6", display: "flex", alignItems: "center", paddingLeft: 6 }}>
                {d.uniqueVisitors > 2 && <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>{d.uniqueVisitors}</span>}
              </div>
            </div>
            <span style={{ fontSize: 11, color: "#aac", width: 28, textAlign: "right" }}>{d.uniqueVisitors}</span>
            <span style={{ fontSize: 10, color: "#446", width: 40 }}>{d.pageViews} pv</span>
          </div>
        ))}
      </Section>
    </div>
  );
}

// SORGENTI
function ViewSources({ launch }) {
  if (!launch.data && !launch.err) return <Spinner />;
  if (launch.err) return <Err msg={launch.err} />;
  const { sources, regions, devices, summary } = launch.data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Section title="Sorgenti traffico">
          {sources.length === 0 ? <Empty /> : sources.map(s => (
            <div key={s.source} style={{ marginBottom: 8 }}>
              <HBar label={s.source || "direct"} value={s.count} max={sources[0].count} color="#a855f7" />
              <div style={{ fontSize: 9, color: "#445", marginLeft: 98, marginTop: 1 }}>
                {summary.totalPageViews > 0 ? Math.round((s.count / summary.totalPageViews) * 100) : 0}% del traffico
              </div>
            </div>
          ))}
        </Section>
        <Section title="Regioni">
          {regions.map(r => (
            <HBar key={r.region} label={r.region} value={r.count} max={regions[0]?.count || 1} color="#22c55e" />
          ))}
        </Section>
      </div>
      <Section title="Device breakdown">
        <div style={{ display: "flex", gap: 40 }}>
          {devices.map(d => (
            <div key={d.device} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 4 }}>
                {d.device === "mobile" ? "📱" : d.device === "tablet" ? "📟" : "🖥️"}
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#cde" }}>{d.count}</div>
              <div style={{ fontSize: 10, color: "#556", textTransform: "capitalize" }}>{d.device}</div>
              <div style={{ fontSize: 9, color: "#445" }}>
                {summary.totalPageViews > 0 ? Math.round((d.count / summary.totalPageViews) * 100) : 0}%
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// CONVERSIONI — funnel
function ViewConversion({ launch }) {
  if (!launch.data && !launch.err) return <Spinner />;
  if (launch.err) return <Err msg={launch.err} />;
  const { summary } = launch.data;
  const steps = [
    { label: "Visitatori unici", value: summary.totalUniqueVisitors, color: "#3b82f6" },
    { label: "CTA cliccato", value: summary.ctaClicks, color: "#a855f7" },
    { label: "Form aperto", value: summary.signupStarts, color: "#f59e0b" },
    { label: "Signup completato", value: summary.signupDone, color: "#22c55e" },
  ];
  const top = steps[0].value || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Section title="Funnel di conversione">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {steps.map((s, i) => {
            const drop = i > 0 && steps[i - 1].value > 0
              ? Math.round((1 - s.value / steps[i - 1].value) * 100)
              : null;
            return (
              <div key={s.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#aac" }}>{i + 1}. {s.label}</span>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    {drop !== null && (
                      <span style={{ fontSize: 10, color: "#e06060" }}>-{drop}% rispetto al passo prima</span>
                    )}
                    <span style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</span>
                  </div>
                </div>
                <div style={{ background: "#151e2a", borderRadius: 5, height: 18 }}>
                  <div style={{ width: `${Math.round((s.value / top) * 100)}%`, height: 18, borderRadius: 5, background: s.color, opacity: 0.85 }} />
                </div>
              </div>
            );
          })}
        </div>
      </Section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
        <Section title="Tasso di conversione">
          <div style={{ fontSize: 52, fontWeight: 900, color: "#22c55e", lineHeight: 1 }}>{summary.conversionRate}</div>
          <div style={{ fontSize: 11, color: "#556", marginTop: 6 }}>visitatori → signup</div>
        </Section>
        <Section title="Drop-off principale">
          {steps.map((s, i) => {
            if (i === 0) return null;
            const lost = steps[i - 1].value - s.value;
            return (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "#778" }}>{steps[i - 1].label} → {s.label}</span>
                <span style={{ fontSize: 11, color: "#e06060" }}>-{lost}</span>
              </div>
            );
          })}
        </Section>
      </div>
    </div>
  );
}

// SCROLL & SEZIONI
function ViewScroll({ launch }) {
  if (!launch.data && !launch.err) return <Spinner />;
  if (launch.err) return <Err msg={launch.err} />;
  const { scrollDepth, sections, summary } = launch.data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Section title="Scroll depth">
          {[25, 50, 75, 100].map(pct => (
            <div key={pct} style={{ marginBottom: 10 }}>
              <HBar label={`Fino al ${pct}%`} value={scrollDepth[pct] || 0} max={scrollDepth[25] || 1}
                color={pct <= 25 ? "#facc15" : pct <= 50 ? "#fb923c" : pct <= 75 ? "#f87171" : "#ef4444"} />
              <div style={{ fontSize: 9, color: "#445", marginLeft: 98 }}>
                {summary.totalUniqueVisitors > 0
                  ? Math.round(((scrollDepth[pct] || 0) / summary.totalUniqueVisitors) * 100) : 0}% dei visitatori
              </div>
            </div>
          ))}
          <div style={{ marginTop: 12, padding: "10px 12px", background: "#0a0f16", borderRadius: 6, fontSize: 11, color: "#778" }}>
            Su {summary.totalUniqueVisitors} visitatori, solo{" "}
            <span style={{ color: "#ef4444", fontWeight: 700 }}>{scrollDepth[100] || 0}</span> hanno visto la pagina intera
          </div>
        </Section>
        <Section title="Sezioni viste">
          {sections.length === 0 ? <Empty /> : sections.map(s => (
            <div key={s.section} style={{ marginBottom: 8 }}>
              <HBar label={`#${s.section}`} value={s.count} max={sections[0].count} color="#06b6d4" />
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}

// LAB USAGE
function ViewLabs({ telemetry, stats, selectedScenario, setSelectedScenario, scenarioCmds, scenarioSessions }) {
  const SCENARIO_LABELS = {
    webdown:"Apache down",diskfull:"Disco pieno",selinux:"SELinux denial",highcpu:"CPU 100%",
    sshfail:"SSH rifiutato",mysql:"MySQL down",swap:"RAM/Swap",cron:"Cron",network:"No route",
    zombie:"Processi zombie",journal:"Journald pieno",nfs:"NFS hang",lvm:"LVM pieno",
    dnsfail:"DNS",sshbrute:"Brute force SSH",kernpanic:"Kernel panic",ssl:"SSL scaduto",
    inode:"Inode esauriti",port:"Porta occupata",sudoers:"Sudoers corrotto",raid:"RAID degradato",
    logrotate:"Logrotate",free:"Free shell",iowait:"I/O Wait",apachewrk:"Apache workers",
    mysqlslow:"MySQL slow",netflap:"NIC flap",timewait:"TIME_WAIT",tcpdump:"Traffico anomalo",
    strace:"Processo hung",coredump:"Core dump",syslogflood:"Syslog flood",fsck:"Filesystem corrotto",
    oomkiller:"OOM killer",infoblox:"Infoblox DNS",
  };

  if (!stats || stats.totalSessions === 0) {
    return <div style={{ color: "#557", padding: 40, textAlign: "center" }}>Nessun dato di lab ancora.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
        <KPI label="Sessions" value={stats.totalSessions} />
        <KPI label="Commands" value={stats.totalCommands} color="#60a5fa" />
        <KPI label="Solve rate" value={`${(stats.solveRate*100).toFixed(1)}%`} color="#34d399" />
        <KPI label="Error rate" value={`${(stats.errorRate*100).toFixed(1)}%`} color="#f87171" />
        <KPI label="Avg timing" value={`${stats.avgTiming.toFixed(0)}ms`} color="#a78bfa" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Section title="Top commands">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", color: "#446", fontSize: 9, paddingBottom: 6 }}>Comando</th>
                <th style={{ textAlign: "right", color: "#446", fontSize: 9, paddingBottom: 6 }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {stats.topCommands.map(tc => (
                <tr key={tc.cmd}>
                  <td style={{ padding: "4px 0", fontSize: 11 }}>
                    <code style={{ background: "#151e2a", padding: "1px 5px", borderRadius: 3, color: "#aac" }}>{tc.cmd}</code>
                  </td>
                  <td style={{ textAlign: "right", fontSize: 11, color: "#4caf84" }}>{tc.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Scenario breakdown — clicca per dettaglio">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, maxHeight: 260, overflowY: "auto" }}>
            {Object.entries(stats.scenarioStats)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([id, s]) => (
                <button key={id} onClick={() => setSelectedScenario(id === selectedScenario ? null : id)}
                  style={{ background: selectedScenario === id ? "#1a3520" : "#0a0f16",
                    border: `1px solid ${selectedScenario === id ? "#4caf84" : "#1c2030"}`,
                    borderRadius: 6, padding: "8px 10px", cursor: "pointer", textAlign: "left", fontFamily: "monospace" }}>
                  <div style={{ color: "#cde", fontSize: 10, fontWeight: 700, marginBottom: 2 }}>{SCENARIO_LABELS[id] || id}</div>
                  <div style={{ color: "#446", fontSize: 9 }}>{s.total} sess · {(s.solveRate*100).toFixed(0)}%</div>
                </button>
              ))}
          </div>
        </Section>
      </div>

      {selectedScenario && (
        <Section title={`${SCENARIO_LABELS[selectedScenario] || selectedScenario} — dettaglio`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: "#446", marginBottom: 6 }}>Ultime sessioni</div>
              {scenarioSessions.slice(-8).reverse().map(s => (
                <div key={s.sessionId} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #111820" }}>
                  <span style={{ fontSize: 10, color: "#557" }}>{new Date(s.startedAt).toLocaleString()}</span>
                  <span style={{ fontSize: 10 }}>
                    {s.solved ? <span style={{ color: "#4caf84" }}>✅</span> : <span style={{ color: "#e06060" }}>❌</span>}
                    <span style={{ color: "#446", marginLeft: 6 }}>{s.hintsUsed || 0} hints</span>
                  </span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#446", marginBottom: 6 }}>Comandi recenti</div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {scenarioCmds.slice(-15).reverse().map(c => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #111820" }}>
                    <code style={{ fontSize: 10, color: c.exitCode !== 0 ? "#e06060" : "#8ab" }}>{c.raw}</code>
                    <span style={{ fontSize: 9, color: "#446" }}>{c.durationMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>
      )}

      <div>
        <button onClick={() => {
          const blob = new Blob([JSON.stringify(telemetry, null, 2)], { type: "application/json" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
          a.download = `winlab-telemetry-${new Date().toISOString().slice(0, 10)}.json`; a.click();
        }} style={btnStyle}>📥 Export JSON</button>
      </div>
    </div>
  );
}

// ── Tiny utils ────────────────────────────────────────────────────────────────

const btnStyle   = { padding: "7px 14px", background: "#151e2a", border: "1px solid #243040", borderRadius: 6, color: "#668", cursor: "pointer", fontSize: 11, fontFamily: "monospace" };
const inputStyle = { background: "#0d1117", border: "1px solid #1c2030", borderRadius: 6, padding: "8px 12px", color: "#cde", fontSize: 11, fontFamily: "monospace", outline: "none", width: "100%", boxSizing: "border-box" };
function Spinner() { return <div style={{ color: "#446", padding: 32 }}>Caricamento…</div>; }
function Err({ msg }) { return <div style={{ color: "#e06060", padding: 32 }}>Errore: {msg}</div>; }
function Empty() { return <div style={{ color: "#446", fontSize: 11 }}>Nessun dato ancora.</div>; }

// ── Blog view ─────────────────────────────────────────────────────────────────

const EMPTY_POST = { id: null, title: "", slug: "", excerpt: "", content: "", tags: "", status: "draft" };
const VHS_PLATFORMS = ["facebook", "instagram", "linkedin", "tiktok"];

function ViewBlog({ token }) {
  const [posts, setPosts]       = useState([]);
  const [selected, setSelected] = useState(null); // post in editing
  const [form, setForm]         = useState(EMPTY_POST);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState(null);

  // VHS social publisher state
  const [videos, setVideos]       = useState([]);
  const [vhsVideo, setVhsVideo]   = useState("");
  const [vhsPlatforms, setVhsPlatforms] = useState({ facebook: false, instagram: false, linkedin: false, tiktok: false });
  const [vhsAt, setVhsAt]         = useState(""); // ISO datetime-local
  const [vhsMsg, setVhsMsg]       = useState(null);
  const [vhsBusy, setVhsBusy]     = useState(false);

  const loadVideos = async () => {
    try {
      const r = await fetch("/api/vhs/videos", { credentials: "include" });
      if (r.ok) setVideos(await r.json());
    } catch (_) {}
  };

  const load = async () => {
    try {
      const r = await fetch("/api/blog/all", { credentials: "include" });
      setPosts(await r.json());
    } catch (e) { setMsg("Errore caricamento: " + e.message); }
  };

  useEffect(() => { load(); loadVideos(); }, []);

  const openNew = () => { setSelected(null); setForm(EMPTY_POST); setMsg(null); };

  const openEdit = (p) => {
    setSelected(p.id);
    setForm({ ...p, tags: p.tags ? JSON.parse(p.tags).join(", ") : "" });
    setMsg(null);
  };

  const save = async (publish = false) => {
    setSaving(true); setMsg(null);
    try {
      const payload = {
        title:   form.title,
        content: form.content,
        excerpt: form.excerpt || null,
        tags:    form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        status:  publish ? "published" : "draft",
        slug:    form.slug || undefined,
      };
      const url    = selected ? `/api/blog/${selected}` : "/api/blog";
      const method = selected ? "PUT" : "POST";
      const r = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      const saved = await r.json();
      setSelected(saved.id);
      setForm({ ...saved, tags: saved.tags ? JSON.parse(saved.tags).join(", ") : "" });
      setMsg(publish ? "✅ Pubblicato!" : "✅ Salvato come bozza");
      load();
    } catch (e) { setMsg("❌ " + e.message); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm("Eliminare questo post?")) return;
    await fetch(`/api/blog/${id}`, { method: "DELETE", credentials: "include" });
    if (selected === id) { setSelected(null); setForm(EMPTY_POST); }
    load();
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const togglePlatform = (p) => setVhsPlatforms(prev => ({ ...prev, [p]: !prev[p] }));

  const scheduleVhs = async () => {
    const platforms = VHS_PLATFORMS.filter(p => vhsPlatforms[p]);
    if (!vhsVideo) return setVhsMsg("⚠️ Scegli un video");
    if (platforms.length === 0) return setVhsMsg("⚠️ Scegli almeno una piattaforma");
    const caption = form.title
      ? `${form.title}\n\n${form.excerpt || ""}\n\nwinlab.cloud`
      : "winlab.cloud";
    setVhsBusy(true); setVhsMsg(null);
    const results = [];
    for (const platform of platforms) {
      try {
        const r = await fetch("/api/vhs/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({
            platform,
            videoFile: vhsVideo,
            caption,
            scheduledAt: vhsAt || undefined,
          }),
        });
        const d = await r.json();
        results.push(r.ok ? `✅ ${platform}` : `❌ ${platform}: ${d.error}`);
      } catch (e) { results.push(`❌ ${platform}: ${e.message}`); }
    }
    setVhsMsg(results.join(" · "));
    setVhsBusy(false);
  };

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 110px)" }}>
      {/* Post list */}
      <div style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={openNew} style={{ ...btnStyle, background: "#4caf84", color: "#000", borderColor: "#4caf84", fontWeight: 700, marginBottom: 4 }}>
          + Nuovo post
        </button>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {posts.length === 0 && <div style={{ color: "#446", fontSize: 11, padding: 8 }}>Nessun post ancora.</div>}
          {posts.map(p => (
            <div key={p.id}
              onClick={() => openEdit(p)}
              style={{
                padding: "10px 12px", borderRadius: 7, marginBottom: 5, cursor: "pointer",
                background: selected === p.id ? "#0d1a14" : "#0a0f16",
                border: `1px solid ${selected === p.id ? "#4caf84" : "#1c2030"}`,
              }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#cde", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.title || "(senza titolo)"}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{
                  fontSize: 9, padding: "1px 6px", borderRadius: 4, fontWeight: 700,
                  background: p.status === "published" ? "#14532d" : "#1c1a06",
                  color: p.status === "published" ? "#4caf84" : "#ca8a04",
                }}>
                  {p.status === "published" ? "LIVE" : "BOZZA"}
                </span>
                <button onClick={e => { e.stopPropagation(); del(p.id); }}
                  style={{ background: "none", border: "none", color: "#e06060", cursor: "pointer", fontSize: 12, padding: 0 }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
        {/* Row 1: title + slug */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <input value={form.title} onChange={f("title")} placeholder="Titolo del post"
            style={inputStyle} />
          <input value={form.slug} onChange={f("slug")} placeholder="slug (auto)"
            style={{ ...inputStyle, color: "#4caf84" }} />
        </div>
        {/* Row 2: excerpt */}
        <input value={form.excerpt} onChange={f("excerpt")} placeholder="Descrizione breve (SEO excerpt)"
          style={inputStyle} />
        {/* Row 3: content */}
        <textarea value={form.content} onChange={f("content")} placeholder="Contenuto (Markdown supportato)"
          style={{ ...inputStyle, height: 280, resize: "vertical", lineHeight: 1.6, fontSize: 12 }} />
        {/* Row 4: tags + actions */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input value={form.tags} onChange={f("tags")} placeholder="Tag: linux, devops, sysadmin"
            style={{ ...inputStyle, flex: 1 }} />
          {msg && <span style={{ fontSize: 11, color: msg.startsWith("✅") ? "#4caf84" : "#e06060" }}>{msg}</span>}
          <button onClick={() => save(false)} disabled={saving} style={{ ...btnStyle, opacity: saving ? .5 : 1 }}>
            💾 Salva bozza
          </button>
          <button onClick={() => save(true)} disabled={saving}
            style={{ ...btnStyle, background: "#4caf84", color: "#000", borderColor: "#4caf84", fontWeight: 700, opacity: saving ? .5 : 1 }}>
            🚀 Pubblica
          </button>
          <button onClick={async () => {
            setMsg("🔄 Purging...");
            try {
              const r = await fetch("/api/admin/purge-cache", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ paths: form.slug ? ["/blog", `/blog/${form.slug}`] : null }),
              });
              const d = await r.json();
              setMsg(d.ok ? "☁️ Cache purged" : "❌ " + d.error);
            } catch (e) { setMsg("❌ " + e.message); }
          }} style={{ ...btnStyle, borderColor: "#f97316", color: "#f97316" }}>
            ☁️ Purge CF
          </button>
        </div>

        {/* ── VHS Social Publisher ── */}
        <div style={{ background: "#08111a", border: "1px solid #1c2a3a", borderRadius: 8, padding: "12px 14px", flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: "#3b82f6", textTransform: "uppercase", letterSpacing: 3, marginBottom: 10 }}>📹 Pubblica sui social — vhs pipeline</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            {/* Video picker */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 200 }}>
              <span style={{ fontSize: 9, color: "#556", textTransform: "uppercase" }}>Video</span>
              <select value={vhsVideo} onChange={e => setVhsVideo(e.target.value)}
                style={{ ...inputStyle, width: "auto", minWidth: 200 }}>
                <option value="">— scegli video —</option>
                {videos.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            {/* Platforms */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 9, color: "#556", textTransform: "uppercase" }}>Piattaforme</span>
              <div style={{ display: "flex", gap: 8 }}>
                {VHS_PLATFORMS.map(p => (
                  <label key={p} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input type="checkbox" checked={vhsPlatforms[p]} onChange={() => togglePlatform(p)}
                      style={{ accentColor: "#3b82f6", cursor: "pointer" }} />
                    <span style={{ fontSize: 10, color: vhsPlatforms[p] ? "#93c5fd" : "#446", textTransform: "capitalize" }}>{p}</span>
                  </label>
                ))}
              </div>
            </div>
            {/* Schedule datetime */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 9, color: "#556", textTransform: "uppercase" }}>Schedula (opzionale)</span>
              <input type="datetime-local" value={vhsAt} onChange={e => setVhsAt(e.target.value)}
                style={{ ...inputStyle, width: 190, colorScheme: "dark" }} />
            </div>
            {/* Send button */}
            <button onClick={scheduleVhs} disabled={vhsBusy}
              style={{ ...btnStyle, background: "#1e3a5f", borderColor: "#3b82f6", color: "#93c5fd", fontWeight: 700, opacity: vhsBusy ? .5 : 1, alignSelf: "flex-end" }}>
              {vhsBusy ? "⏳ Invio…" : "📤 Schedula post"}
            </button>
          </div>
          {vhsMsg && (
            <div style={{ marginTop: 8, fontSize: 10, color: vhsMsg.startsWith("✅") || vhsMsg.includes("✅") ? "#4caf84" : "#e06060" }}>
              {vhsMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sidebar config ────────────────────────────────────────────────────────────

const NAV = [
  { id: "overview",    icon: "◈", label: "Overview" },
  { id: "visitors",    icon: "👤", label: "Visitatori" },
  { id: "sources",     icon: "🌐", label: "Sorgenti" },
  { id: "conversion",  icon: "🎯", label: "Conversioni" },
  { id: "scroll",      icon: "📜", label: "Scroll & Sezioni" },
  { id: "labs",        icon: "⌨️", label: "Lab Usage" },
  { id: "blog",        icon: "✍️", label: "Blog" },
];

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TelemetryDashboard() {
  const [view, setView] = useState("overview");
  const launch = useLaunch();
  const [token] = useState(() => localStorage.getItem("winlab_token") || "");

  const [telemetry, setTelemetry] = useState(null);
  const [stats, setStats]         = useState(null);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [scenarioCmds, setScenarioCmds]         = useState([]);
  const [scenarioSessions, setScenarioSessions] = useState([]);

  useEffect(() => {
    const d = loadTelemetry();
    setTelemetry(d);
    setStats(getStats(d));
  }, []);

  const handleSelectScenario = (id) => {
    setSelectedScenario(id);
    if (id && telemetry) {
      setScenarioCmds(getCommandsForScenario(telemetry, id));
      setScenarioSessions(getSessionsForScenario(telemetry, id));
    }
  };

  const TITLES = {
    overview:   "Overview — tutto a colpo d'occhio",
    visitors:   "Visitatori",
    sources:    "Sorgenti & Device",
    conversion: "Funnel di conversione",
    scroll:     "Scroll depth & Sezioni",
    labs:       "Lab Usage",
    blog:       "Blog — pubblica post",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#060a0f", color: "#cde", fontFamily: "monospace" }}>

      {/* Sidebar */}
      <div style={{ width: 200, flexShrink: 0, background: "#080d12", borderRight: "1px solid #151e2a", display: "flex", flexDirection: "column" }}>
        {/* Logo */}
        <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid #151e2a" }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#4caf84" }}>⚡ WinLab</div>
          <div style={{ fontSize: 9, color: "#446", marginTop: 2, letterSpacing: 2 }}>ANALYTICS</div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: "12px 0" }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setView(n.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "10px 18px",
                background: view === n.id ? "#0d1a14" : "transparent",
                borderLeft: `3px solid ${view === n.id ? "#4caf84" : "transparent"}`,
                border: "none", borderLeft: `3px solid ${view === n.id ? "#4caf84" : "transparent"}`,
                color: view === n.id ? "#4caf84" : "#556",
                cursor: "pointer", textAlign: "left", fontFamily: "monospace", fontSize: 11,
                transition: "all .15s",
              }}>
              <span style={{ fontSize: 14 }}>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: "14px 18px", borderTop: "1px solid #151e2a" }}>
          <a href="/myrooting" style={{ fontSize: 10, color: "#334", textDecoration: "none" }}>← Hub</a>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #151e2a", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#cde" }}>{TITLES[view]}</div>
            <div style={{ fontSize: 10, color: "#446", marginTop: 2 }}>Launch week — dal 17 aprile 2026</div>
          </div>
          <div style={{ fontSize: 10, color: "#334" }}>{new Date().toLocaleString("it-IT")}</div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {view === "overview"   && <ViewOverview launch={launch} labStats={stats} />}
          {view === "visitors"   && <ViewVisitors launch={launch} />}
          {view === "sources"    && <ViewSources launch={launch} />}
          {view === "conversion" && <ViewConversion launch={launch} />}
          {view === "scroll"     && <ViewScroll launch={launch} />}
          {view === "blog"       && <ViewBlog token={token} />}
          {view === "labs"       && (
            <ViewLabs
              telemetry={telemetry} stats={stats}
              selectedScenario={selectedScenario} setSelectedScenario={handleSelectScenario}
              scenarioCmds={scenarioCmds} scenarioSessions={scenarioSessions}
            />
          )}
        </div>
      </div>
    </div>
  );
}
