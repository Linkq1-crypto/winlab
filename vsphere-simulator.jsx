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

const TABS = ["Hosts & VMs", "vMotion", "HA / DRS", "Snapshot", "Networking", "Storage", "CLI"];

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

// ── govc / esxcli command evaluator ──────────────────────────────────────────
function evalCLI(raw, state, setState, addLog) {
  const line = raw.trim();
  if (!line) return [];
  const parts = line.split(/\s+/);
  const bin   = parts[0];
  const sub   = parts[1] || "";

  const out  = (t, color = "#b8c8d8") => ({ text: t, color });
  const ok   = (t) => out(t, "#4caf84");
  const err  = (t) => out(t, "#e06060");
  const warn = (t) => out(t, "#ffaa00");
  const dim  = (t) => out(t, "#445566");

  // ── govc ────────────────────────────────────────────────────────────────────
  if (bin === "govc") {

    // govc ls / govc ls /
    if (sub === "ls") {
      const target = parts[2] || "/";
      if (target === "/" || target === "") {
        return [out("/datacenter-lab/"), dim("  └─ host/"), dim("  └─ vm/"), dim("  └─ datastore/"), dim("  └─ network/")];
      }
      if (target.includes("vm")) {
        return Object.values(state.vms).map(v => out(`/datacenter-lab/vm/${v.name}`));
      }
      if (target.includes("host")) {
        return state.hosts.map(h => out(`/datacenter-lab/host/${h.id}/`));
      }
      return [err(`govc: object not found: ${target}`)];
    }

    // govc vm.info <name>
    if (sub === "vm.info") {
      const name = parts.slice(2).join(" ");
      const entry = Object.entries(state.vms).find(([,v]) => v.name === name || v.name.includes(parts[2] || ""));
      if (!entry) return [err(`govc: VM '${name}' not found`)];
      const [, vm] = entry;
      return [
        out(`Name:               ${vm.name}`),
        out(`  Path:             /datacenter-lab/vm/${vm.name}`),
        out(`  UUID:             420d${Math.random().toString(16).slice(2,10)}-xxxx`),
        out(`  Guest name:       ${vm.os}`),
        out(`  Memory:           ${vm.ram * 1024} MB`),
        out(`  CPU:              ${vm.cpu} vCPU(s)`),
        out(`  Power state:      ${vm.status === "running" ? "poweredOn" : "poweredOff"}`),
        out(`  Boot time:        ${vm.status === "running" ? new Date(Date.now() - 3600000*24).toISOString() : "-"}`),
        out(`  IP address:       ${vm.status === "running" ? `192.168.1.${Math.floor(Math.random()*50)+10}` : "-"}`),
        out(`  Host:             ${vm.host}`),
      ];
    }

    // govc host.info
    if (sub === "host.info") {
      return state.hosts.flatMap(h => [
        out(`Name:               ${h.name}`),
        out(`  Path:             /datacenter-lab/host/${h.id}`),
        out(`  Manufacturer:     Dell Inc.`),
        out(`  Logical CPUs:     32 CPUs @ 2400 MHz`),
        out(`  Memory:           256 GB`),
        out(`  CPU usage:        ${h.cpu}%  (${Math.round(h.cpu*32*24/100)} MHz used)`),
        out(`  Memory usage:     ${h.ram}%  (${Math.round(h.ram*256/100)} GB used)`),
        out(`  Status:           ${h.status}`),
        dim(""),
      ]);
    }

    // govc vm.migrate -vm <name> -host <host>
    if (sub === "vm.migrate") {
      const vmFlag   = parts.indexOf("-vm");
      const hostFlag = parts.indexOf("-host");
      const vmName   = vmFlag   !== -1 ? parts[vmFlag + 1]   : null;
      const hostName = hostFlag !== -1 ? parts[hostFlag + 1] : null;
      if (!vmName || !hostName) return [err("Usage: govc vm.migrate -vm <name> -host <host>")];
      const vmEntry = Object.entries(state.vms).find(([,v]) => v.name === vmName || v.name.includes(vmName));
      const host    = state.hosts.find(h => h.id === hostName || h.name.includes(hostName));
      if (!vmEntry) return [err(`govc: VM '${vmName}' not found`)];
      if (!host)    return [err(`govc: host '${hostName}' not found`)];
      const [vmId, vm] = vmEntry;
      if (vm.host === host.id) return [warn(`${vm.name} is already on ${host.id}`)];
      if (host.status === "disconnected") return [err(`govc: host ${host.id} is disconnected`)];
      addLog(`vMotion: migrating ${vm.name} → ${host.id} via CLI...`, "warn");
      setTimeout(() => {
        setState(s => {
          const vms = { ...s.vms, [vmId]: { ...s.vms[vmId], host: host.id } };
          const hosts = s.hosts.map(h => {
            if (h.id === vm.host)  return { ...h, vms: h.vms.filter(v => v !== vmId) };
            if (h.id === host.id)  return { ...h, vms: [...h.vms, vmId] };
            return h;
          });
          return { ...s, vms, hosts };
        });
        addLog(`vMotion complete: ${vm.name} → ${host.id} ✓`);
      }, 1800);
      return [
        out(`Migrating ${vm.name} to ${host.id}...`),
        out(`  Progress: [████████████████████] 100%`, "#6ab0f5"),
        ok(`${vm.name}: migration completed successfully`),
      ];
    }

    // govc snapshot.create -vm <name> <snapname>
    if (sub === "snapshot.create") {
      const vmFlag  = parts.indexOf("-vm");
      const vmName  = vmFlag !== -1 ? parts[vmFlag + 1] : null;
      const snapName = parts[parts.length - 1] !== `-vm` && parts[parts.length-1] !== vmName ? parts[parts.length-1] : "snap-" + Date.now();
      const vmEntry = Object.entries(state.vms).find(([,v]) => v.name === vmName || v.name.includes(vmName || ""));
      if (!vmEntry) return [err(`govc: VM '${vmName}' not found`)];
      const [vmId, vm] = vmEntry;
      const ts = new Date().toLocaleString("en-US");
      setState(s => ({ ...s, vms: { ...s.vms, [vmId]: { ...s.vms[vmId], snapshot: { name: snapName, created: ts } } } }));
      addLog(`Snapshot '${snapName}' created for ${vm.name}`);
      return [ok(`[✓] Snapshot '${snapName}' created for ${vm.name} at ${ts}`)];
    }

    // govc snapshot.revert -vm <name>
    if (sub === "snapshot.revert") {
      const vmFlag = parts.indexOf("-vm");
      const vmName = vmFlag !== -1 ? parts[vmFlag + 1] : null;
      const vmEntry = Object.entries(state.vms).find(([,v]) => v.name === vmName || v.name.includes(vmName || ""));
      if (!vmEntry) return [err(`govc: VM '${vmName}' not found`)];
      const [, vm] = vmEntry;
      if (!vm.snapshot) return [warn(`${vm.name}: no snapshot to revert to`)];
      addLog(`Revert snapshot: ${vm.name} restored ✓`);
      return [ok(`[✓] ${vm.name} reverted to snapshot '${vm.snapshot.name}'`)];
    }

    // govc snapshot.remove -vm <name> -snapshot <snap>
    if (sub === "snapshot.remove") {
      const vmFlag = parts.indexOf("-vm");
      const vmName = vmFlag !== -1 ? parts[vmFlag + 1] : null;
      const vmEntry = Object.entries(state.vms).find(([,v]) => v.name === vmName || v.name.includes(vmName || ""));
      if (!vmEntry) return [err(`govc: VM '${vmName}' not found`)];
      const [vmId, vm] = vmEntry;
      if (!vm.snapshot) return [warn(`${vm.name}: no snapshot found`)];
      setState(s => ({ ...s, vms: { ...s.vms, [vmId]: { ...s.vms[vmId], snapshot: null } } }));
      addLog(`Snapshot removed for ${vm.name}`);
      return [ok(`[✓] Snapshot removed from ${vm.name}`)];
    }

    // govc datastore.info
    if (sub === "datastore.info") {
      return state.datastores.flatMap(ds => [
        out(`Name:        ${ds.name}`),
        out(`  Type:      ${ds.type}`),
        out(`  Capacity:  ${ds.size} GB`),
        out(`  Free:      ${ds.size - ds.used} GB`),
        out(`  Usage:     ${Math.round((ds.used/ds.size)*100)}%  (${ds.used} GB used)`),
        out(`  Hosts:     ${ds.host === "shared" ? "esxi-01, esxi-02" : ds.host}`),
        dim(""),
      ]);
    }

    // govc cluster.change -drs-enabled <true/false>
    if (sub === "cluster.change") {
      if (line.includes("-drs-enabled=true") || line.includes("-drs-enabled true")) {
        setState(s => ({ ...s, drs: { ...s.drs, enabled: true } }));
        addLog("DRS enabled via CLI");
        return [ok("[✓] DRS enabled — Fully Automated")];
      }
      if (line.includes("-ha-enabled=true") || line.includes("-ha-enabled true")) {
        setState(s => ({ ...s, ha: { ...s.ha, enabled: true } }));
        addLog("HA enabled via CLI");
        return [ok("[✓] HA enabled — admission control: 25%")];
      }
      return [err("Usage: govc cluster.change -drs-enabled=true|-ha-enabled=true")];
    }

    // help
    if (sub === "help" || sub === "--help" || sub === "") {
      return [
        out("govc — VMware vSphere CLI", "#6ab0f5"),
        dim(""),
        out("  govc ls [path]                              List inventory"),
        out("  govc vm.info <name>                         VM details"),
        out("  govc host.info                              Host details"),
        out("  govc vm.migrate -vm <n> -host <h>           Live migration"),
        out("  govc snapshot.create -vm <n> <snapname>     Create snapshot"),
        out("  govc snapshot.revert -vm <n>                Revert snapshot"),
        out("  govc snapshot.remove -vm <n>                Delete snapshot"),
        out("  govc datastore.info                         Datastore usage"),
        out("  govc cluster.change -drs-enabled=true       Enable DRS"),
        out("  govc cluster.change -ha-enabled=true        Enable HA"),
        dim(""),
        out("  esxcli --help                               ESXi host CLI"),
      ];
    }

    return [err(`govc: unknown command '${sub}'. Run 'govc help'`)];
  }

  // ── esxcli ──────────────────────────────────────────────────────────────────
  if (bin === "esxcli") {

    if (sub === "--help" || sub === "help" || sub === "") {
      return [
        out("esxcli — ESXi command-line interface", "#6ab0f5"),
        dim(""),
        out("  esxcli system version get"),
        out("  esxcli system hostname get"),
        out("  esxcli hardware cpu global get"),
        out("  esxcli hardware memory get"),
        out("  esxcli vm process list"),
        out("  esxcli vm process kill --type=soft --world-id=<id>"),
        out("  esxcli network vswitch standard list"),
        out("  esxcli network ip interface list"),
        out("  esxcli network ip route ipv4 list"),
        out("  esxcli storage core device list"),
        out("  esxcli storage vmfs extent list"),
        out("  esxcli software vib list"),
        out("  esxcli software vib update -d <depot>"),
      ];
    }

    const ns1 = parts[1] || "", ns2 = parts[2] || "", ns3 = parts[3] || "";

    if (ns1 === "system" && ns2 === "version" && ns3 === "get") {
      return [
        out("   Product: VMware ESXi"),
        out("   Version: 8.0.2"),
        out("   Build:   22380479"),
        out("   Update:  2"),
        out("   Patch:   0"),
      ];
    }

    if (ns1 === "system" && ns2 === "hostname" && ns3 === "get") {
      const host = state.hosts[0];
      return [
        out(`   Domain Name: lab.local`),
        out(`   Fully Qualified Domain Name: ${host.name}`),
        out(`   Host Name: ${host.id}`),
      ];
    }

    if (ns1 === "hardware" && ns2 === "cpu") {
      return [
        out("   CPU Packages: 2"),
        out("   CPU Cores: 32"),
        out("   CPU Threads: 64"),
        out("   Speed: 2400 MHz"),
      ];
    }

    if (ns1 === "hardware" && ns2 === "memory") {
      return [
        out("   Physical Memory: 274877906944 Bytes (256 GB)"),
      ];
    }

    if (ns1 === "vm" && ns2 === "process" && ns3 === "list") {
      const host = state.hosts[0];
      return host.vms.flatMap((vmId, i) => {
        const vm = state.vms[vmId];
        if (!vm || vm.status !== "running") return [];
        return [
          out(`   ${vm.name}`),
          out(`      World ID: ${10000 + i * 7}`),
          out(`      Process ID: 0`),
          out(`      VMX Cartel ID: ${10001 + i * 7}`),
          out(`      UUID: 420d-${Math.random().toString(16).slice(2,10)}`),
          out(`      Display Name: ${vm.name}`),
          out(`      Config File: /vmfs/volumes/datastore1/${vm.name}/${vm.name}.vmx`),
          dim(""),
        ];
      });
    }

    if (ns1 === "vm" && ns2 === "process" && ns3 === "kill") {
      const wid = parts.find(p => p.startsWith("--world-id"))?.split("=")[1] || parts[parts.indexOf("--world-id")+1];
      if (!wid) return [err("esxcli vm process kill --type=soft --world-id=<id>")];
      return [ok(`[✓] VM (world-id ${wid}) killed with signal soft`)];
    }

    if (ns1 === "network" && ns2 === "vswitch") {
      return state.vswitches.flatMap(vs => [
        out(`   ${vs.id}`),
        out(`      Name: ${vs.id}`),
        out(`      Uplinks: ${vs.uplinks.join(", ")}`),
        out(`      Portgroups: ${vs.portgroups.join(", ")}`),
        dim(""),
      ]);
    }

    if (ns1 === "network" && ns2 === "ip" && ns3 === "interface") {
      return [
        out("   Name: vmk0  IPv4: 192.168.1.10   Netmask: 255.255.255.0   Type: STATIC   Enabled: true"),
        out("   Name: vmk1  IPv4: 10.10.10.10     Netmask: 255.255.255.0   Type: STATIC   Enabled: true"),
        out("   Name: vmk2  IPv4: 10.20.20.10     Netmask: 255.255.255.0   Type: STATIC   Enabled: true"),
      ];
    }

    if (ns1 === "network" && ns2 === "ip" && ns3 === "route") {
      return [
        out("   Network       Netmask          Gateway        Interface   Source"),
        out("   0.0.0.0       0.0.0.0          192.168.1.1    vmk0        STATIC"),
        out("   192.168.1.0   255.255.255.0    0.0.0.0        vmk0        STATIC"),
        out("   10.10.10.0    255.255.255.0    0.0.0.0        vmk1        STATIC"),
      ];
    }

    if (ns1 === "storage" && ns2 === "core" && ns3 === "device") {
      return [
        out("   Device UID                         Device Type   Size  Display Name"),
        out("   naa.60003ff44dc75a1001a6be8b12345   Direct-Access 500GB  Local Dell Disk"),
        out("   naa.600a0980383035452454202b525153   Direct-Access 2TB    NetApp LUN"),
      ];
    }

    if (ns1 === "storage" && ns2 === "vmfs") {
      return state.datastores.map(ds =>
        out(`   ${ds.name}   VMFS6   ${ds.used}GB/${ds.size}GB   UUID: 6257${Math.random().toString(16).slice(2,12)}`)
      );
    }

    if (ns1 === "software" && ns2 === "vib" && ns3 === "list") {
      return [
        out("   Name                   Version             Vendor   Install Date"),
        out("   esx-base               8.0.2-0.0.22380479  VMware   2025-01-15"),
        out("   net-vmxnet3            1.1.3.0-3vmw.800    VMware   2025-01-15"),
        out("   scsi-megaraid-sas      07.714.04.00        VMware   2025-01-15"),
        out("   tools-light            12.3.0.22234872     VMware   2025-02-01"),
      ];
    }

    return [err(`esxcli: invalid command '${parts.slice(1).join(" ")}'. Run 'esxcli --help'`)];
  }

  if (bin === "help") {
    return [
      out("Available CLIs:", "#6ab0f5"),
      out("  govc <command>    VMware vSphere automation CLI"),
      out("  esxcli <ns> ...   ESXi host management CLI"),
      out(""),
      out("  govc help         govc command reference"),
      out("  esxcli --help     esxcli command reference"),
    ];
  }

  if (bin === "clear") return [{ text: "__CLEAR__" }];

  return [err(`-bash: ${bin}: command not found`)];
}

export default function App() {
  const [state, setState] = useState(INITIAL_STATE);
  const [tab, setTab] = useState("Hosts & VMs");
  const [selectedVM, setSelectedVM] = useState(null);
  const [motionTarget, setMotionTarget] = useState(null);
  const [animating, setAnimating] = useState(false);

  // ── CLI state ──────────────────────────────────────────────────────────────
  const [cliLines, setCliLines] = useState([
    { text: "root@vcenter:~# ", color: "#4caf84" },
    { text: "# govc and esxcli available — type 'help' to start", color: "#445566" },
    { text: "", color: "" },
  ]);
  const [cliInput, setCliInput] = useState("");
  const [cliHist, setCliHist] = useState([]);
  const [cliHistIdx, setCliHistIdx] = useState(-1);
  const cliInputRef = useRef();
  const cliBottomRef = useRef();

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

  // ── CLI submit ─────────────────────────────────────────────────────────────
  useEffect(() => { cliBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [cliLines]);

  function cliSubmit() {
    const cmd = cliInput.trim();
    if (!cmd) return;
    setCliHist(h => [cmd, ...h].slice(0, 50));
    setCliHistIdx(-1);
    const prompt = { text: `root@vcenter:~# ${cmd}`, color: "#4caf84" };
    const result = evalCLI(cmd, state, setState, addLog);
    if (result.length === 1 && result[0].text === "__CLEAR__") {
      setCliLines([{ text: "root@vcenter:~# ", color: "#4caf84" }]);
    } else {
      setCliLines(l => [...l, prompt, ...result, { text: "", color: "" }]);
    }
    setCliInput("");
  }

  function cliKeyDown(e) {
    if (e.key === "Enter") { cliSubmit(); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const i = Math.min(cliHistIdx + 1, cliHist.length - 1);
      setCliHistIdx(i); setCliInput(cliHist[i] || "");
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const i = Math.max(cliHistIdx - 1, -1);
      setCliHistIdx(i); setCliInput(i === -1 ? "" : cliHist[i] || "");
    }
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

        {/* === CLI === */}
        {tab === "CLI" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)", background: "#05080d", border: "1px solid #1a2535", borderRadius: 8, overflow: "hidden" }}>
            {/* header */}
            <div style={{ background: "#0a0f18", borderBottom: "1px solid #1a2535", padding: "8px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", gap: 5 }}>
                {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
              </div>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "#4caf84", marginLeft: 6 }}>root@vcenter</span>
              <span style={{ color: "#334", fontSize: 11 }}>~ vSphere CLI</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: "#334" }}>govc · esxcli</span>
                <button onClick={() => setCliLines([{ text: "# cleared", color: "#334" }])}
                  style={{ padding: "2px 10px", background: "#1a2535", border: "1px solid #2a3545", borderRadius: 4, color: "#557", cursor: "pointer", fontSize: 10 }}>
                  clear
                </button>
              </div>
            </div>

            {/* output */}
            <div onClick={() => cliInputRef.current?.focus()} style={{ flex: 1, overflowY: "auto", padding: "12px 18px", cursor: "text", fontFamily: "'Fira Code','JetBrains Mono',monospace", fontSize: 12.5, lineHeight: 1.7 }}>
              {cliLines.map((l, i) => (
                <div key={i} style={{ color: l.color || "#b8c8d8", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{l.text}</div>
              ))}
              <div ref={cliBottomRef} />
            </div>

            {/* input */}
            <div style={{ borderTop: "1px solid #1a2535", padding: "10px 18px", display: "flex", alignItems: "center", gap: 8, background: "#070c12" }}>
              <span style={{ color: "#4caf84", fontFamily: "monospace", fontSize: 12.5, whiteSpace: "nowrap" }}>root@vcenter:~#</span>
              <input
                ref={cliInputRef}
                value={cliInput}
                onChange={e => setCliInput(e.target.value)}
                onKeyDown={cliKeyDown}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#ddeedd", fontFamily: "'Fira Code','JetBrains Mono',monospace", fontSize: 13, caretColor: "#4caf84" }}
                placeholder="govc ls  |  esxcli --help  |  help"
              />
            </div>
          </div>
        )}

      </div>{/* end body */}

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
