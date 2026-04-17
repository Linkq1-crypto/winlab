import { useState, useEffect, useRef } from "react";

const INITIAL_STATE = {
  hosts: [
    { id: "esxi-01", name: "esxi-01.lab.local", cpu: 34, ram: 58, status: "connected", vms: ["vm-web01","vm-db01","vm-app01"] },
    { id: "esxi-02", name: "esxi-02.lab.local", cpu: 12, ram: 22, status: "connected", vms: ["vm-web02","vm-backup"] },
  ],
  vms: {
    "vm-web01":    { name: "web-server-01",   os: "Oracle Linux 9", cpu: 2, ram: 4,  status: "running",  host: "esxi-01", snapshot: null },
    "vm-db01":     { name: "db-server-01",    os: "Oracle Linux 9", cpu: 4, ram: 16, status: "running",  host: "esxi-01", snapshot: null },
    "vm-app01":    { name: "app-server-01",   os: "Ubuntu 22.04",   cpu: 2, ram: 8,  status: "running",  host: "esxi-01", snapshot: null },
    "vm-web02":    { name: "web-server-02",   os: "Ubuntu 22.04",   cpu: 2, ram: 4,  status: "running",  host: "esxi-02", snapshot: null },
    "vm-backup":   { name: "backup-server",   os: "Oracle Linux 8", cpu: 1, ram: 2,  status: "stopped",  host: "esxi-02", snapshot: null },
  },
  vswitches: [
    { id: "vSwitch0", portgroups: ["VM Network", "Management Network"], uplinks: ["vmnic0","vmnic1"] },
    { id: "vSwitch1", portgroups: ["VLAN-100 (DB)", "VLAN-200 (App)"],  uplinks: ["vmnic2"] },
  ],
  datastores: [
    { id: "ds-local-01", name: "datastore-esxi01", type: "VMFS Local", size: 500, used: 312, host: "esxi-01" },
    { id: "ds-local-02", name: "datastore-esxi02", type: "VMFS Local", size: 500, used: 98,  host: "esxi-02" },
    { id: "ds-san-01",   name: "SAN-NetApp-LUN01", type: "VMFS SAN",   size: 2000, used: 876, host: "shared" },
  ],
  ha: { enabled: false, admissionControl: "25%", restartPriority: "Medium" },
  drs: { enabled: false, mode: "Fully Automated", threshold: 3 },
  log: [],
};

const TABS = ["Hosts & VMs", "vMotion", "HA / DRS", "Snapshot", "Networking", "Storage"];

function Log({ entries }) {
  const ref = useRef();
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [entries]);
  return (
    <div ref={ref} style={{
      background: "#05080d", borderTop: "1px solid #1a2535",
      height: 90, overflowY: "auto", padding: "8px 16px",
      fontFamily: "monospace", fontSize: 11,
    }}>
      {entries.length === 0 && <span style={{ color: "#334" }}>— nessuna attività —</span>}
      {entries.map((e, i) => (
        <div key={i} style={{ color: e.type === "ok" ? "#4caf84" : e.type === "warn" ? "#ffaa00" : "#e06060", lineHeight: 1.8 }}>
          <span style={{ color: "#445", marginRight: 10 }}>{e.time}</span>{e.msg}
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ value, max, color = "#1a7acc" }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ background: "#0d1520", borderRadius: 3, height: 6, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: pct > 80 ? "#e06060" : pct > 60 ? "#ffaa00" : color, transition: "width 0.5s" }} />
    </div>
  );
}

function Badge({ label, color }) {
  const colors = { running: "#4caf84", stopped: "#666", connected: "#1a7acc", disconnected: "#e06060", migrating: "#ffaa00" };
  const c = colors[color] || color;
  return (
    <span style={{
      padding: "1px 7px", borderRadius: 3, fontSize: 10, fontWeight: 700,
      background: `${c}22`, color: c, border: `1px solid ${c}44`, letterSpacing: 0.5,
    }}>{label.toUpperCase()}</span>
  );
}

export default function App() {
  const [state, setState] = useState(INITIAL_STATE);
  const [tab, setTab] = useState("Hosts & VMs");
  const [selectedVM, setSelectedVM] = useState(null);
  const [motionTarget, setMotionTarget] = useState(null);
  const [animating, setAnimating] = useState(false);

  function addLog(msg, type = "ok") {
    const now = new Date().toLocaleTimeString("it-IT");
    setState(s => ({ ...s, log: [...s.log.slice(-30), { msg, type, time: now }] }));
  }

  function doVMotion(vmId, targetHostId) {
    const vm = state.vms[vmId];
    if (vm.host === targetHostId) { addLog(`${vm.name} è già su ${targetHostId}`, "warn"); return; }
    setAnimating(vmId);
    addLog(`vMotion: migrazione ${vm.name} → ${targetHostId} in corso...`, "warn");
    setTimeout(() => {
      setState(s => {
        const vms = { ...s.vms, [vmId]: { ...s.vms[vmId], host: targetHostId, status: "running" } };
        const hosts = s.hosts.map(h => {
          if (h.id === vm.host) return { ...h, vms: h.vms.filter(v => v !== vmId) };
          if (h.id === targetHostId) return { ...h, vms: [...h.vms, vmId] };
          return h;
        });
        return { ...s, vms, hosts };
      });
      addLog(`vMotion completato: ${vm.name} ora su ${targetHostId} ✓`);
      setAnimating(null);
      setMotionTarget(null);
    }, 2200);
  }

  function takeSnapshot(vmId) {
    const ts = new Date().toLocaleString("it-IT");
    setState(s => ({ ...s, vms: { ...s.vms, [vmId]: { ...s.vms[vmId], snapshot: { name: "snap-" + Date.now(), created: ts } } } }));
    addLog(`Snapshot creato per ${state.vms[vmId].name}`);
  }

  function deleteSnapshot(vmId) {
    setState(s => ({ ...s, vms: { ...s.vms, [vmId]: { ...s.vms[vmId], snapshot: null } } }));
    addLog(`Snapshot eliminato per ${state.vms[vmId].name}`, "warn");
  }

  function revertSnapshot(vmId) {
    addLog(`Revert snapshot: ${state.vms[vmId].name} ripristinata ✓`);
  }

  function toggleHA() {
    setState(s => ({ ...s, ha: { ...s.ha, enabled: !s.ha.enabled } }));
    addLog(state.ha.enabled ? "HA disabilitato" : "HA abilitato — protezione host attiva ✓");
  }

  function toggleDRS() {
    setState(s => ({ ...s, drs: { ...s.drs, enabled: !s.drs.enabled } }));
    addLog(state.drs.enabled ? "DRS disabilitato" : "DRS abilitato — bilanciamento automatico attivo ✓");
  }

  function simulateHostFail() {
    if (!state.ha.enabled) { addLog("HA non abilitato — VM non vengono riavviate!", "warn"); return; }
    addLog("⚠ HOST esxi-01 NON RISPONDE — HA in azione...", "warn");
    setTimeout(() => {
      setState(s => {
        const hosts = s.hosts.map(h => h.id === "esxi-01" ? { ...h, status: "disconnected", vms: [] } : { ...h, vms: [...h.vms, ...s.hosts.find(x=>x.id==="esxi-01").vms] });
        const vms = { ...s.vms };
        s.hosts.find(h=>h.id==="esxi-01").vms.forEach(id => { vms[id] = { ...vms[id], host: "esxi-02", status: "running" }; });
        return { ...s, hosts, vms };
      });
      addLog("HA: tutte le VM di esxi-01 riavviate su esxi-02 ✓");
    }, 2000);
  }

  function resetHosts() {
    setState(INITIAL_STATE);
    addLog("Ambiente ripristinato ✓");
  }

  const vmList = Object.entries(state.vms);

  return (
    <div style={{ minHeight: "100vh", background: "#070b12", color: "#b8c8d8", fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 13, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "#0a1018", borderBottom: "1px solid #1a2535", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <div style={{ width: 28, height: 28, background: "#1a7acc", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#fff" }}>V</div>
          <span style={{ fontWeight: 700, color: "#dde", letterSpacing: 0.5 }}>vSphere Client</span>
          <span style={{ color: "#334", fontSize: 11 }}>— datacenter-lab</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Badge label={`HA: ${state.ha.enabled ? "ON" : "OFF"}`} color={state.ha.enabled ? "running" : "#555"} />
          <Badge label={`DRS: ${state.drs.enabled ? "ON" : "OFF"}`} color={state.drs.enabled ? "running" : "#555"} />
          <button onClick={resetHosts} style={{ padding: "3px 12px", background: "#1a2535", border: "1px solid #2a3545", borderRadius: 4, color: "#778", cursor: "pointer", fontSize: 11 }}>Reset</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #1a2535", background: "#080d14" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "9px 18px", background: "none", border: "none",
            borderBottom: tab === t ? "2px solid #1a7acc" : "2px solid transparent",
            color: tab === t ? "#6ab0f5" : "#557", cursor: "pointer", fontSize: 12,
            fontFamily: "inherit", letterSpacing: 0.3,
          }}>{t}</button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>

        {/* === HOSTS & VMs === */}
        {tab === "Hosts & VMs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {state.hosts.map(host => (
              <div key={host.id} style={{ background: "#0b1420", border: `1px solid ${host.status === "disconnected" ? "#e0606044" : "#1a2535"}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "10px 16px", borderBottom: "1px solid #1a2535", display: "flex", alignItems: "center", gap: 12, background: "#0d1826" }}>
                  <span style={{ fontSize: 16 }}>🖥</span>
                  <span style={{ fontWeight: 700, color: "#cde" }}>{host.name}</span>
                  <Badge label={host.status} color={host.status} />
                  <div style={{ marginLeft: "auto", display: "flex", gap: 20, fontSize: 11, color: "#557" }}>
                    <span>CPU <strong style={{ color: "#aac" }}>{host.cpu}%</strong></span>
                    <span>RAM <strong style={{ color: "#aac" }}>{host.ram}%</strong></span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, padding: 12 }}>
                  {host.vms.map(vmId => {
                    const vm = state.vms[vmId];
                    if (!vm) return null;
                    return (
                      <div key={vmId} onClick={() => setSelectedVM(selectedVM === vmId ? null : vmId)}
                        style={{
                          background: selectedVM === vmId ? "#0f2030" : "#0a1520",
                          border: `1px solid ${selectedVM === vmId ? "#1a7acc" : "#1a2535"}`,
                          borderRadius: 6, padding: "10px 12px", cursor: "pointer",
                          opacity: animating === vmId ? 0.4 : 1,
                          transition: "all 0.3s",
                          boxShadow: animating === vmId ? "0 0 20px #ffaa0044" : "none",
                        }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, color: "#cde", fontSize: 12 }}>{vm.name}</span>
                          <Badge label={vm.status} color={vm.status} />
                        </div>
                        <div style={{ color: "#557", fontSize: 11, marginBottom: 6 }}>{vm.os}</div>
                        <div style={{ fontSize: 11, color: "#667" }}>vCPU: {vm.cpu} · RAM: {vm.ram}GB</div>
                        {vm.snapshot && <div style={{ marginTop: 5, fontSize: 10, color: "#ffaa00" }}>📸 snapshot attivo</div>}
                      </div>
                    );
                  })}
                  {host.vms.length === 0 && <div style={{ color: "#334", fontSize: 12, padding: 8 }}>Nessuna VM</div>}
                </div>
              </div>
            ))}
            {selectedVM && (
              <div style={{ background: "#0d1826", border: "1px solid #1a7acc44", borderRadius: 8, padding: 16 }}>
                <div style={{ fontWeight: 700, color: "#6ab0f5", marginBottom: 10 }}>VM selezionata: {state.vms[selectedVM].name}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["vMotion", "Snapshot", "Storage"].map(a => (
                    <button key={a} onClick={() => setTab(a === "vMotion" ? "vMotion" : a === "Snapshot" ? "Snapshot" : "Storage")}
                      style={{ padding: "6px 14px", background: "#1a2535", border: "1px solid #2a3a55", borderRadius: 4, color: "#6ab0f5", cursor: "pointer", fontSize: 12 }}>
                      → {a}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === vMOTION === */}
        {tab === "vMotion" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 700 }}>
            <div style={{ background: "#0d1826", border: "1px solid #1a2535", borderRadius: 8, padding: 16 }}>
              <div style={{ color: "#6ab0f5", fontWeight: 700, marginBottom: 8 }}>🔄 vMotion — Live Migration</div>
              <div style={{ color: "#557", fontSize: 12, lineHeight: 1.7, marginBottom: 16 }}>
                Sposta una VM da un host a un altro <strong style={{ color: "#aac" }}>senza spegnerla</strong> e senza interruzione di servizio. 
                La memoria viene copiata in background, poi lo stato viene trasferito in millisecondi.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {vmList.filter(([,vm]) => vm.status === "running").map(([id, vm]) => (
                  <div key={id} style={{ background: "#091320", border: "1px solid #1a2535", borderRadius: 6, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: "#cde", fontSize: 12 }}>{vm.name}</span>
                      <Badge label={vm.status} color={vm.status} />
                    </div>
                    <div style={{ color: "#557", fontSize: 11, marginBottom: 8 }}>Host attuale: <strong style={{ color: "#88aacc" }}>{vm.host}</strong></div>
                    {state.hosts.filter(h => h.id !== vm.host && h.status === "connected").map(h => (
                      <button key={h.id} onClick={() => doVMotion(id, h.id)}
                        disabled={!!animating}
                        style={{
                          width: "100%", padding: "6px 10px", marginTop: 4,
                          background: animating ? "#1a2535" : "#0f2a40",
                          border: "1px solid #1a6a9a", borderRadius: 4,
                          color: animating ? "#446" : "#6ab0f5", cursor: animating ? "default" : "pointer",
                          fontSize: 11, fontFamily: "inherit",
                        }}>
                        {animating === id ? "⏳ migrazione in corso..." : `→ Migra su ${h.name}`}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: "#0d1826", border: "1px solid #1a2535", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, color: "#557", lineHeight: 1.8 }}>
                <strong style={{ color: "#aac" }}>Requisiti vMotion:</strong> shared storage (SAN/NFS), rete dedicata vMotion vmkernel, 
                host nella stessa versione ESXi, CPU compatibili (EVC mode per CPU diverse).
              </div>
            </div>
          </div>
        )}

        {/* === HA / DRS === */}
        {tab === "HA / DRS" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 700 }}>
            {/* HA */}
            <div style={{ background: "#0d1826", border: `1px solid ${state.ha.enabled ? "#1a7acc44" : "#1a2535"}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontWeight: 700, color: state.ha.enabled ? "#6ab0f5" : "#667" }}>🔴 High Availability (HA)</div>
                <button onClick={toggleHA} style={{
                  padding: "5px 16px", borderRadius: 4, cursor: "pointer", fontSize: 12,
                  background: state.ha.enabled ? "#1a3a2a" : "#1a2535",
                  border: `1px solid ${state.ha.enabled ? "#4caf84" : "#2a3545"}`,
                  color: state.ha.enabled ? "#4caf84" : "#778",
                }}>{state.ha.enabled ? "✓ Abilitato" : "Abilita HA"}</button>
              </div>
              <div style={{ color: "#557", fontSize: 12, lineHeight: 1.7, marginBottom: 12 }}>
                Se un host <strong style={{ color: "#e06060" }}>si guasta</strong>, HA rileva il failure e 
                <strong style={{ color: "#4caf84" }}> riavvia automaticamente le VM</strong> sugli host rimasti nel cluster.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={simulateHostFail} style={{
                  padding: "7px 16px", borderRadius: 4, cursor: "pointer", fontSize: 12,
                  background: "#2a1010", border: "1px solid #e0606066", color: "#e06060",
                }}>⚡ Simula failure esxi-01</button>
              </div>
            </div>

            {/* DRS */}
            <div style={{ background: "#0d1826", border: `1px solid ${state.drs.enabled ? "#ffaa0033" : "#1a2535"}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontWeight: 700, color: state.drs.enabled ? "#ffaa00" : "#667" }}>⚖️ Distributed Resource Scheduler (DRS)</div>
                <button onClick={toggleDRS} style={{
                  padding: "5px 16px", borderRadius: 4, cursor: "pointer", fontSize: 12,
                  background: state.drs.enabled ? "#2a2010" : "#1a2535",
                  border: `1px solid ${state.drs.enabled ? "#ffaa00" : "#2a3545"}`,
                  color: state.drs.enabled ? "#ffaa00" : "#778",
                }}>{state.drs.enabled ? "✓ Abilitato" : "Abilita DRS"}</button>
              </div>
              <div style={{ color: "#557", fontSize: 12, lineHeight: 1.7, marginBottom: 12 }}>
                Monitora continuamente il <strong style={{ color: "#aac" }}>carico CPU/RAM</strong> degli host e 
                sposta le VM automaticamente con vMotion per bilanciare le risorse.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {state.hosts.map(h => (
                  <div key={h.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: "#778" }}>{h.name}</span>
                      <span style={{ color: h.cpu > 70 ? "#e06060" : "#4caf84" }}>CPU {h.cpu}%</span>
                    </div>
                    <ProgressBar value={h.cpu} max={100} color="#1a7acc" />
                  </div>
                ))}
                {state.drs.enabled && (
                  <div style={{ fontSize: 11, color: "#4caf84", marginTop: 4 }}>
                    ✓ DRS attivo — bilanciamento automatico in corso
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* === SNAPSHOT === */}
        {tab === "Snapshot" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 700 }}>
            <div style={{ background: "#0d1826", border: "1px solid #1a2535", borderRadius: 8, padding: 14, color: "#557", fontSize: 12, lineHeight: 1.7 }}>
              Uno <strong style={{ color: "#aac" }}>snapshot</strong> congela lo stato della VM in un momento preciso (disco + memoria). 
              Puoi usarlo prima di aggiornamenti rischiosi e tornare indietro in secondi. 
              <strong style={{ color: "#e06060" }}> Non usarlo come backup</strong> — degrada le performance nel tempo.
            </div>
            {vmList.map(([id, vm]) => (
              <div key={id} style={{ background: "#0b1420", border: "1px solid #1a2535", borderRadius: 8, padding: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 600, color: "#cde", fontSize: 12 }}>{vm.name}</div>
                  <div style={{ color: "#557", fontSize: 11 }}>{vm.os} · {vm.host}</div>
                </div>
                {vm.snapshot ? (
                  <div style={{ flex: 1, background: "#0a1e10", border: "1px solid #4caf8444", borderRadius: 5, padding: "6px 10px", fontSize: 11 }}>
                    <div style={{ color: "#4caf84" }}>📸 {vm.snapshot.name}</div>
                    <div style={{ color: "#557" }}>{vm.snapshot.created}</div>
                  </div>
                ) : (
                  <div style={{ flex: 1, color: "#334", fontSize: 11 }}>— nessuno snapshot —</div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => takeSnapshot(id)} style={{ padding: "5px 12px", background: "#0f2a40", border: "1px solid #1a6a9a", borderRadius: 4, color: "#6ab0f5", cursor: "pointer", fontSize: 11 }}>
                    📸 Crea
                  </button>
                  {vm.snapshot && <>
                    <button onClick={() => revertSnapshot(id)} style={{ padding: "5px 12px", background: "#2a1a0a", border: "1px solid #aa6600", borderRadius: 4, color: "#ffaa00", cursor: "pointer", fontSize: 11 }}>
                      ↩ Revert
                    </button>
                    <button onClick={() => deleteSnapshot(id)} style={{ padding: "5px 12px", background: "#2a0a0a", border: "1px solid #aa3333", borderRadius: 4, color: "#e06060", cursor: "pointer", fontSize: 11 }}>
                      🗑 Elimina
                    </button>
                  </>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* === NETWORKING === */}
        {tab === "Networking" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 700 }}>
            <div style={{ background: "#0d1826", border: "1px solid #1a2535", borderRadius: 8, padding: 14, color: "#557", fontSize: 12, lineHeight: 1.7 }}>
              Il <strong style={{ color: "#aac" }}>vSwitch</strong> è uno switch virtuale dentro ESXi. Le VM si connettono a <strong style={{ color: "#aac" }}>Port Group</strong>, che possono avere VLAN tag. Il traffico fisico esce dagli <strong style={{ color: "#aac" }}>uplink (vmnic)</strong>.
            </div>
            {state.vswitches.map(vs => (
              <div key={vs.id} style={{ background: "#0b1420", border: "1px solid #1a2535", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ background: "#0d1826", padding: "10px 16px", borderBottom: "1px solid #1a2535", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "#4caf84", fontSize: 18 }}>🔀</span>
                  <span style={{ fontWeight: 700, color: "#cde" }}>{vs.id}</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    {vs.uplinks.map(u => <Badge key={u} label={u} color="#4caf84" />)}
                  </div>
                </div>
                <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {vs.portgroups.map(pg => (
                    <div key={pg} style={{ background: "#091320", border: "1px solid #1a3050", borderRadius: 5, padding: "8px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: "#6ab0f5", fontSize: 14 }}>🔌</span>
                      <span style={{ fontSize: 12, color: "#aac" }}>{pg}</span>
                      {pg.includes("VLAN") && <Badge label="VLAN tagged" color="#ffaa00" />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ background: "#0d1826", border: "1px solid #1a2535", borderRadius: 8, padding: 14 }}>
              <div style={{ fontWeight: 600, color: "#778", fontSize: 12, marginBottom: 10 }}>vmkernel interfaces</div>
              {[
                { name: "vmk0", ip: "192.168.1.10", use: "Management" },
                { name: "vmk1", ip: "10.10.10.10",  use: "vMotion" },
                { name: "vmk2", ip: "10.20.20.10",  use: "Storage (iSCSI)" },
              ].map(vmk => (
                <div key={vmk.name} style={{ display: "flex", gap: 12, alignItems: "center", padding: "5px 0", borderBottom: "1px solid #1a2535" }}>
                  <span style={{ color: "#6ab0f5", width: 40, fontSize: 12 }}>{vmk.name}</span>
                  <span style={{ color: "#aac", fontSize: 12, flex: 1 }}>{vmk.ip}</span>
                  <Badge label={vmk.use} color={vmk.use === "vMotion" ? "#ffaa00" : vmk.use === "Management" ? "connected" : "#888"} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === STORAGE === */}
        {tab === "Storage" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 700 }}>
            <div style={{ background: "#0d1826", border: "1px solid #1a2535", borderRadius: 8, padding: 14, color: "#557", fontSize: 12, lineHeight: 1.7 }}>
              Il <strong style={{ color: "#aac" }}>datastore</strong> è dove ESXi salva i file delle VM (.vmdk, .vmx). 
              Può essere locale (un disco del server) oppure condiviso su <strong style={{ color: "#aac" }}>SAN NetApp</strong> via iSCSI/FC — indispensabile per vMotion e HA.
            </div>
            {state.datastores.map(ds => {
              const pct = Math.round((ds.used / ds.size) * 100);
              return (
                <div key={ds.id} style={{ background: "#0b1420", border: "1px solid #1a2535", borderRadius: 8, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#cde", fontSize: 13 }}>{ds.name}</div>
                      <div style={{ fontSize: 11, color: "#557", marginTop: 2 }}>{ds.host === "shared" ? "🌐 Shared (tutti gli host)" : `🖥 ${ds.host}`}</div>
                    </div>
                    <Badge label={ds.type} color={ds.type.includes("SAN") ? "#ffaa00" : "connected"} />
                  </div>
                  <ProgressBar value={ds.used} max={ds.size} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#557", marginTop: 6 }}>
                    <span>Usato: <strong style={{ color: pct > 80 ? "#e06060" : "#aac" }}>{ds.used} GB ({pct}%)</strong></span>
                    <span>Totale: <strong style={{ color: "#aac" }}>{ds.size} GB</strong></span>
                    <span>Libero: <strong style={{ color: "#4caf84" }}>{ds.size - ds.used} GB</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log */}
      <div style={{ borderTop: "1px solid #1a2535" }}>
        <div style={{ background: "#080c14", padding: "4px 16px", fontSize: 10, color: "#334", letterSpacing: 2, textTransform: "uppercase" }}>
          Event Log
        </div>
        <Log entries={state.log} />
      </div>
    </div>
  );
}
