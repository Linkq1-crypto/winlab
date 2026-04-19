/**
 * LabTerminal.jsx — WinLab production-grade terminal simulator
 *
 * Features:
 *  - All 5 free labs with state-based verification
 *  - Dynamic prompt [root@web01 dir]#
 *  - df -h updates after deletions
 *  - journalctl with real timestamps
 *  - nano/vim fake editor overlay
 *  - Easter eggs for advanced commands (+XP)
 *  - Victory screen: time vs avg, concept, XP, easter eggs
 *  - Adaptive latency (100-300ms for heavy commands)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { LABS, buildVictory, ts, tsLine } from "./labs/labEngine.js";

// ─── Heavy commands (realistic latency 200-400ms) ─────────────────────────
const HEAVY = new Set(["systemctl", "journalctl", "apt", "yum", "dnf", "find", "du", "top", "ps", "dmesg"]);

// ─── Random instance ID per session ───────────────────────────────────────
function genInstanceId() {
  const chars = "abcdefghjkmnpqrstuvwxyz0123456789";
  let s = "srv-";
  for (let i = 0; i < 2; i++) s += chars[Math.floor(Math.random() * 24)];
  for (let i = 0; i < 3; i++) s += chars[24 + Math.floor(Math.random() * 10)];
  return s;
}

// ─── /proc virtual files ──────────────────────────────────────────────────
const PROC_FILES = {
  "/proc/cpuinfo": [
    "processor\t: 0",
    "vendor_id\t: GenuineIntel",
    "cpu family\t: 6",
    "model\t\t: 85",
    "model name\t: Intel(R) Xeon(R) Gold 6148 CPU @ 2.40GHz",
    "stepping\t: 4",
    "cpu MHz\t\t: 2399.926",
    "cache size\t: 28160 KB",
    "physical id\t: 0",
    "siblings\t: 4",
    "core id\t\t: 0",
    "cpu cores\t: 2",
    "flags\t\t: fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov",
    "bogomips\t: 4799.85",
    "clflush size\t: 64",
    "cache_alignment\t: 64",
    "address sizes\t: 46 bits physical, 48 bits virtual",
  ],
  "/proc/meminfo": [
    "MemTotal:        8192000 kB",
    "MemFree:          412340 kB",
    "MemAvailable:    1823400 kB",
    "Buffers:          182400 kB",
    "Cached:          1624188 kB",
    "SwapCached:        12344 kB",
    "Active:          4218320 kB",
    "Inactive:        1834240 kB",
    "SwapTotal:       2097148 kB",
    "SwapFree:        1834240 kB",
    "Dirty:              1024 kB",
    "Writeback:             0 kB",
    "AnonPages:       4232188 kB",
    "Mapped:           823400 kB",
    "Shmem:             34120 kB",
    "KReclaimable:     382400 kB",
    "Slab:             512320 kB",
    "VmallocTotal:   34359738367 kB",
    "HugePages_Total:       0",
    "HugePages_Free:        0",
    "HugePages_Rsvd:        0",
    "HugePages_Surp:        0",
    "Hugepagesize:       2048 kB",
  ],
  "/proc/version": [
    "Linux version 5.15.0-101-generic (buildd@lcy02-amd64-046) (gcc (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0, GNU ld (GNU Binutils for Ubuntu) 2.38) #111-Ubuntu SMP Tue Mar 5 20:16:58 UTC 2024",
  ],
  "/proc/uptime": ["347214.82 1243812.44"],
};

// ─── Fake editor ────────────────────────────────────────────────────────────
function FakeEditor({ path, lines: initial, onClose }) {
  const [lines, setLines] = useState(initial);
  const [cursor, setCursor] = useState(0);
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="fixed inset-0 bg-[#0a0a0b] z-50 font-mono text-sm flex flex-col select-none">
      <div className="bg-[#c0c0c0] text-black text-center text-xs py-0.5 px-2">
        GNU nano 5.6 — {path} — Modified
      </div>
      <div className="flex-1 overflow-auto p-0">
        {lines.map((line, i) => (
          <div key={i} className={`flex ${i === cursor ? "bg-slate-700" : ""}`}>
            <span className="text-slate-600 w-8 text-right pr-2 shrink-0 select-none">{i + 1}</span>
            <span className={line.includes("ERROR") || line.includes("error") || line.includes("Failed") ? "text-red-400" : "text-green-300"}>{line}</span>
          </div>
        ))}
      </div>
      <div className="bg-[#c0c0c0] text-black grid grid-cols-5 gap-x-2 px-2 py-0.5 text-[10px]">
        {["^G Help","^X Exit","^O Write","^W Search","^K Cut"].map(s => (
          <span key={s}><strong>{s.split(" ")[0]}</strong> {s.split(" ").slice(1).join(" ")}</span>
        ))}
      </div>
      <input ref={ref} className="opacity-0 h-0 w-0 absolute"
        onKeyDown={e => {
          if (e.ctrlKey && e.key === "x") { e.preventDefault(); onClose(lines); }
          if (e.ctrlKey && e.key === "o") { e.preventDefault(); onClose(lines); }
          if (e.key === "ArrowUp")   { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
          if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(lines.length - 1, c + 1)); }
          if (e.key === "Escape")    { e.preventDefault(); onClose(lines); }
        }}
      />
    </div>
  );
}

// ─── Victory screen ─────────────────────────────────────────────────────────
function VictoryScreen({ victory, lab, onNext, onUpgrade, hasNext }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
      <div className="text-5xl">🎉</div>
      <h2 className="text-xl font-bold text-white">Incident Resolved</h2>
      <p className="text-slate-400 text-sm">{lab.title}</p>

      <div className="grid grid-cols-3 gap-3 w-full max-w-sm mt-2">
        <div className="bg-slate-800 rounded-lg p-3">
          <p className="text-lg font-bold text-emerald-400">{victory.time}</p>
          <p className="text-[10px] text-slate-500 uppercase">Your time</p>
        </div>
        <div className={`bg-slate-800 rounded-lg p-3`}>
          <p className={`text-lg font-bold ${victory.faster ? "text-blue-400" : "text-yellow-400"}`}>
            {victory.vs_avg}
          </p>
          <p className="text-[10px] text-slate-500 uppercase">vs avg</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <p className="text-lg font-bold text-yellow-400">+{victory.xp} XP</p>
          <p className="text-[10px] text-slate-500 uppercase">earned</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 w-full max-w-sm text-left">
        <p className="text-xs text-slate-500 uppercase mb-1">Concept mastered</p>
        <p className="text-sm text-white font-medium">{victory.concept}</p>
      </div>

      {victory.easterEggs.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 w-full max-w-sm text-left">
          <p className="text-xs text-yellow-400 font-bold mb-2">⚡ Easter eggs found</p>
          {victory.easterEggs.map((e, i) => (
            <p key={i} className="text-xs text-slate-300">{e.msg}</p>
          ))}
        </div>
      )}

      <div className="flex gap-3 mt-2">
        {hasNext ? (
          <button onClick={onNext}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-lg transition-colors">
            Next Lab →
          </button>
        ) : (
          <button onClick={onUpgrade}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg transition-colors">
            Unlock Pro Labs →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main terminal ───────────────────────────────────────────────────────────
export default function LabTerminal({ initialLabIndex = 0, onUpgrade = () => {} }) {
  const [labIndex, setLabIndex]         = useState(initialLabIndex);
  const [sysState, setSysState]         = useState(() => ({ ...LABS[initialLabIndex].state }));
  const [cwd, setCwd]                   = useState("/root");
  const [lines, setLines]               = useState([]);
  const [input, setInput]               = useState("");
  const [cmdHistory, setCmdHistory]     = useState([]);
  const [histIdx, setHistIdx]           = useState(-1);
  const [processing, setProcessing]     = useState(false);
  const [editorState, setEditorState]   = useState(null);
  const [labCompleted, setLabCompleted] = useState(false);
  const [victory, setVictory]           = useState(null);
  const [easterEggs, setEasterEggs]     = useState([]);
  const [startTime]                     = useState(Date.now());
  const [cmdCount, setCmdCount]         = useState(0);
  const [hintIdx, setHintIdx]           = useState(0);
  const [instanceId]                    = useState(genInstanceId);
  const [idleDelay, setIdleDelay]       = useState(false);

  const endRef          = useRef(null);
  const inputRef        = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const lab             = LABS[labIndex];

  // Auto-scroll
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);

  // Session idle simulation — after 30s inactivity, flag delay
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - lastActivityRef.current > 30000) {
        setIdleDelay(true);
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Boot sequence on lab change
  useEffect(() => {
    setSysState({ ...lab.state });
    setCwd("/root");
    setLines([]);
    setLabCompleted(false);
    setVictory(null);
    setEasterEggs([]);
    setHintIdx(0);
    setCmdCount(0);

    const boot = [
      { text: "Connecting to incident environment...", type: "info", d: 0 },
      { text: `SSH session established → ${instanceId} (${lab.subtitle})`, type: "success", d: 500 },
      { text: "", type: "out", d: 700 },
      { text: `⚠  ACTIVE INCIDENT: ${lab.title}`, type: "err", d: 900 },
      { text: `Difficulty: ${lab.difficulty.toUpperCase()} · Est. ${lab.estimatedMin} min`, type: "info", d: 1100 },
      { text: "", type: "out", d: 1200 },
      { text: "Type 'hint' for guidance · 'help' for commands · 'check' to verify solution", type: "hint", d: 1400 },
      { text: "", type: "out", d: 1500 },
    ];
    boot.forEach(({ text, type, d }) => setTimeout(() => addLine(text, type), d));
  }, [labIndex]);

  const addLine = useCallback((text, type = "out") => {
    setLines(prev => [...prev, { text, type }]);
  }, []);

  const addLines = useCallback((arr) => {
    setLines(prev => [...prev, ...arr]);
  }, []);

  // ── Easter egg checker ─────────────────────────────────────────────────────
  const checkEasterEggs = useCallback((cmd) => {
    if (!lab.easterEggs) return;
    for (const [key, egg] of Object.entries(lab.easterEggs)) {
      if (egg.trigger.test(cmd)) {
        setEasterEggs(prev => {
          if (prev.find(e => e.key === key)) return prev;
          setTimeout(() => addLine(egg.msg, "success"), 200);
          return [...prev, { key, ...egg }];
        });
        break;
      }
    }
  }, [lab, addLine]);

  // ── State-based check ──────────────────────────────────────────────────────
  const runCheck = useCallback(() => {
    const result = lab.check(sysState);
    if (result.pass) {
      const v = buildVictory(lab.id, Date.now() - startTime, cmdCount, easterEggs);
      setLabCompleted(true);
      setVictory(v);
      addLines([
        { text: "", type: "out" },
        { text: "✅  " + result.message, type: "success" },
        { text: `⏱   Time: ${v.time} — ${v.vs_avg}`, type: "info" },
        { text: `⚡   +${v.xp} XP`, type: "success" },
      ]);
      setTimeout(() => setVictory(v), 1200);
    } else if (result.partial) {
      addLine("⚠  Almost: " + result.message, "warn");
    } else {
      addLine("✗  Not yet: " + result.message, "err");
    }
  }, [lab, sysState, startTime, cmdCount, easterEggs, addLine, addLines]);

  // ── Command processor ─────────────────────────────────────────────────────
  const processCommand = useCallback((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    addLine(`[root@web01 ${cwd === "/root" ? "~" : cwd.split("/").pop()}]# ${trimmed}`, "prompt");
    setCmdHistory(prev => [...prev, trimmed]);
    setHistIdx(-1);
    setCmdCount(c => c + 1);
    checkEasterEggs(trimmed);

    const parts  = trimmed.split(/\s+/);
    const cmd    = parts[0].toLowerCase();
    const args   = parts.slice(1);
    const isHeavy = HEAVY.has(cmd);
    const latency = isHeavy ? 200 + Math.random() * 200 : 80 + Math.random() * 100;

    setProcessing(true);

    setTimeout(() => {
      setProcessing(false);
      handleCommand(cmd, args, trimmed);
    }, latency);
  }, [cwd, addLine, checkEasterEggs, sysState, lab]);

  // ── Command dispatcher ────────────────────────────────────────────────────
  const handleCommand = useCallback((cmd, args, raw) => {
    const fs    = lab.filesystem || {};
    const files = lab.files || {};

    // check / verify
    if (cmd === "check" || cmd === "verify") {
      runCheck(); return;
    }

    // hint
    if (cmd === "hint") {
      const hints = lab.hints || [];
      const h = hints[hintIdx] || hints[hints.length - 1];
      addLine("💡 " + h, "hint");
      setHintIdx(i => Math.min(i + 1, hints.length - 1));
      return;
    }

    // help
    if (cmd === "help") {
      addLines([
        { text: "Core commands:", type: "info" },
        { text: "  systemctl [status|start|stop|restart|reload] <svc>", type: "out" },
        { text: "  journalctl [-u <svc>] [-xe] [--vacuum-size=N]", type: "out" },
        { text: "  df -h           · du -sh [path]", type: "out" },
        { text: "  find <path> [-name <pattern>] [-size +N]", type: "out" },
        { text: "  ls [-la] [path] · cd <path> · pwd · cat <file>", type: "out" },
        { text: "  nano / vim <file>  (Ctrl+X to exit)", type: "out" },
        { text: "  ps aux [--sort=-%cpu] · top · kill [-9] <pid>", type: "out" },
        { text: "  killall <name>  · iptables -L INPUT -n -v", type: "out" },
        { text: "  restorecon -Rv <path> · chcon -t <ctx> <file>", type: "out" },
        { text: "  sed -i 's/old/new/g' <file>", type: "out" },
        { text: "  check / verify  — validate your solution", type: "out" },
        { text: "  hint            — next guided hint", type: "out" },
        { text: "  clear           — clear terminal", type: "out" },
      ]);
      return;
    }

    // clear
    if (cmd === "clear") { setLines([]); return; }

    // pwd
    if (cmd === "pwd") { addLine(cwd, "out"); return; }

    // whoami / id
    if (cmd === "whoami") { addLine("root", "out"); return; }
    if (cmd === "id")     { addLine("uid=0(root) gid=0(root) groups=0(root)", "out"); return; }

    // uname
    if (cmd === "uname") { addLine("Linux web01 5.15.0-101-generic #111-Ubuntu SMP x86_64 GNU/Linux", "out"); return; }

    // history (with timestamps)
    if (cmd === "history") {
      const now = Date.now();
      addLines(cmdHistory.slice().reverse().slice(0, 20).reverse().map((c, i) => ({
        text: `${String(i + 1).padStart(4)}  ${new Date(now - (cmdHistory.length - i) * 37000).toISOString().slice(0,19).replace("T"," ")}  ${c}`,
        type: "out",
      })));
      return;
    }

    // free
    if (cmd === "free") {
      addLines([
        { text: "               total        used        free      shared  buff/cache   available", type: "out" },
        { text: "Mem:         8192000     5903488      412340       34120     1876172     1823400", type: "out" },
        { text: "Swap:        2097148      262908     1834240", type: "out" },
      ]);
      return;
    }

    // dmesg
    if (cmd === "dmesg") {
      const t = (n) => `[${n.toFixed(6).padStart(12)}]`;
      const jitter = () => (Math.random() * 0.0005).toFixed(6);
      addLines([
        { text: `${t(0.000000)} Linux version 5.15.0-101-generic (buildd@lcy02-amd64-046) (gcc (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0)`, type: "out" },
        { text: `${t(0.000000)} Command line: BOOT_IMAGE=/boot/vmlinuz-5.15.0-101-generic root=UUID=7f1b2c3d-4e5f-6a7b console=ttyS0`, type: "out" },
        { text: `${t(0.000000)} KERNEL supported cpus:`, type: "out" },
        { text: `${t(0.000000)}   Intel GenuineIntel`, type: "out" },
        { text: `${t(0.000000)}   AMD AuthenticAMD`, type: "out" },
        { text: `${t(0.012456)} x86/fpu: xstate_offset[2]:  576, xstate_sizes[2]:  256`, type: "out" },
        { text: `${t(0.054321)} ACPI: Core revision 20210930`, type: "out" },
        { text: `${t(0.187654)} PCI: Using configuration type 1 for base access`, type: "out" },
        { text: `${t(0.432109)} bootcon [uart0] enabled`, type: "out" },
        { text: `${t(0.876543)} pci 0000:00:01.0: [8086:7010] reg 0x10: [io  0x01f0-0x01f7]`, type: "out" },
        { text: `${t(1.102938)} Spectre V2 : Mitigation: Retpolines`, type: "warn" },
        { text: `${t(1.245678)} audit: initializing netlink subsys (enabled)`, type: "out" },
        { text: `${t(2.001234)} thermal LNXTHERM:00: registered as thermal_zone0`, type: "out" },
        { text: `${t(2.456789)} scsi host0: virtio_scsi`, type: "out" },
        { text: `${t(2.890123)} eth0: hyperv_netvsc: adapter sn: 00155d01-a2b3-c4d5`, type: "out" },
        { text: `${t(3.123456)} EXT4-fs (sda1): mounted filesystem with ordered data mode. Opts: (null). Quota mode: none.`, type: "out" },
        { text: `${t(4.567890)} systemd[1]: systemd 249.11-0ubuntu3.12 running in system mode (+PAM +AUDIT +SELINUX +APPARMOR)`, type: "out" },
        { text: `${t(5.012345)} systemd[1]: Detected architecture x86-64.`, type: "out" },
        { text: `${t(5.876543)} systemd[1]: Set hostname to <${instanceId}>.`, type: "out" },
      ]);
      return;
    }

    // cd
    if (cmd === "cd") {
      const target = args[0] || "/root";
      let resolved;
      if (target === "~" || !target) resolved = "/root";
      else if (target === "..") resolved = cwd.split("/").slice(0, -1).join("/") || "/";
      else if (target.startsWith("/")) resolved = target;
      else resolved = (cwd === "/" ? "" : cwd) + "/" + target;
      resolved = resolved.replace(/\/+/g, "/") || "/";

      if (fs[resolved] !== undefined) {
        setCwd(resolved);
      } else {
        addLine(`bash: cd: ${target}: No such file or directory`, "err");
      }
      return;
    }

    // ls
    if (cmd === "ls") {
      const showHidden = args.some(a => a.includes("a"));
      const showLong   = args.some(a => a.includes("l"));
      const dirArg     = args.find(a => a.startsWith("/")) || cwd;
      const entries    = fs[dirArg] || [];
      if (entries.length === 0) return;
      const visible = showHidden ? entries : entries.filter(e => !e.startsWith("."));
      if (showLong) {
        addLines(visible.map(e => {
          const isDir  = fs[`${dirArg === "/" ? "" : dirArg}/${e}`] !== undefined;
          const fInfo  = files[`${dirArg === "/" ? "" : dirArg}/${e}`];
          const size   = fInfo?.size || (isDir ? "-" : "4.0K");
          return { text: `${isDir ? "d" : "-"}rwxr-xr-x  1 root root  ${size.padStart(6)}  ${ts().slice(0,6)}  ${e}`, type: "out" };
        }));
      } else {
        addLine(visible.join("  "), "out");
      }
      return;
    }

    // cat
    if (cmd === "cat") {
      const target = args[0];
      if (!target) { addLine("cat: missing operand", "err"); return; }
      const path   = target.startsWith("/") ? target : `${cwd === "/" ? "" : cwd}/${target}`;

      // /proc virtual filesystem
      if (PROC_FILES[path]) {
        addLines(PROC_FILES[path].map(l => ({ text: l, type: "out" })));
        return;
      }

      const file   = files[path];
      if (file) {
        addLines(file.content.map(l => ({
          text: l,
          type: l.match(/error|Error|failed|Failed|FAIL/i) ? "err"
              : l.startsWith("#") ? "info"
              : "out",
        })));
      } else {
        addLine(`cat: ${target}: No such file or directory`, "err");
      }
      return;
    }

    // nano / vim / vi
    if (cmd === "nano" || cmd === "vim" || cmd === "vi") {
      const target = args[0];
      if (!target) { addLine(`${cmd}: missing filename`, "err"); return; }
      const path  = target.startsWith("/") ? target : `${cwd === "/" ? "" : cwd}/${target}`;
      const file  = files[path];
      const content = file?.content || [`# ${path} (new file)`];
      setEditorState({ path, content: [...content] });
      return;
    }

    // sed -i (simulate in-place edit on httpd.conf)
    if (cmd === "sed" && args.includes("-i")) {
      const subExpr = args.find(a => a.startsWith("s/"));
      const fileArg = args[args.length - 1];
      const filePath = fileArg.startsWith("/") ? fileArg : `${cwd === "/" ? "" : cwd}/${fileArg}`;
      if (subExpr && lab.id === "lab-apache" && filePath.includes("httpd.conf")) {
        if (subExpr.includes("ServerNaame") || subExpr.includes("Naame")) {
          setSysState(prev => ({ ...prev, configFixed: true }));
          addLine(`sed: in-place edit applied to ${filePath}`, "success");
          addLine("Typo 'ServerNaame' → 'ServerName' fixed.", "success");
        } else {
          addLine(`sed: applied to ${filePath}`, "out");
        }
      } else {
        addLine(`sed: ${fileArg}: file modified`, "out");
      }
      return;
    }

    // df -h
    if (cmd === "df") {
      if (lab.getDfOutput) {
        addLines(lab.getDfOutput(sysState));
      } else {
        addLines([
          { text: "Filesystem      Size  Used Avail Use% Mounted on", type: "out" },
          { text: "/dev/sda1        50G   18G   32G  36% /",          type: "success" },
          { text: "tmpfs           3.9G     0  3.9G   0% /dev/shm",   type: "out" },
        ]);
      }
      return;
    }

    // du
    if (cmd === "du") {
      if (lab.id === "lab-diskfull") {
        addLines([
          { text: "42G\t/var/log/jenkins/jenkins.log.1", type: "err" },
          { text: "12M\t/var/log/jenkins/jenkins.log",   type: "out" },
          { text: "250M\t/var/log/httpd",                 type: "out" },
          { text: "42G\ttotal /var/log",                  type: "err" },
          { text: "", type: "out" },
          { text: "💡 /var/log/jenkins/jenkins.log.1 is 42G — orphan log never rotated.", type: "hint" },
        ]);
      } else {
        addLines([
          { text: "1.2G\t/var/log", type: "out" },
          { text: "256M\t/var/cache", type: "out" },
        ]);
      }
      return;
    }

    // find
    if (cmd === "find") {
      if (lab.id === "lab-diskfull") {
        addLines([
          { text: "/var/log/jenkins/jenkins.log.1 (42G)", type: "err" },
          { text: "", type: "out" },
          { text: "💡 Truncate without deleting: > /var/log/jenkins/jenkins.log.1", type: "hint" },
          { text: "   Or remove it: rm /var/log/jenkins/jenkins.log.1", type: "hint" },
        ]);
      } else {
        addLine(`find: no matches for the given criteria`, "out");
      }
      return;
    }

    // journalctl
    if (cmd === "journalctl") {
      const unitFlag = args.indexOf("-u");
      const unit     = unitFlag !== -1 ? args[unitFlag + 1] : null;
      const vacuum   = args.find(a => a.startsWith("--vacuum-size="));

      if (vacuum && lab.id === "lab-diskfull") {
        const freed = 8; // journalctl frees 8G
        setSysState(prev => ({ ...prev, diskUsedGB: Math.max(0, prev.diskUsedGB - freed), journalVacuumed: true }));
        addLines([
          { text: "Vacuuming journal files by size limit...", type: "info" },
          { text: `Freed ${freed}G of archived journal.`, type: "success" },
          { text: "Hint: still need to free more. Check /var/log/jenkins/jenkins.log.1", type: "hint" },
        ]);
        return;
      }

      const logLines = unit
        ? [
            { text: `-- Logs for ${unit}.service --`, type: "info" },
            { text: tsLine(`systemd[1]: Starting ${unit}.service...`), type: "out" },
            { text: tsLine(`${unit}[${Math.floor(Math.random()*9000+1000)}]: ${unit === "httpd" ? "Syntax error on line 5 of /etc/httpd/conf/httpd.conf: Invalid command 'ServerNaame'" : "Starting service..."}`), type: unit === "httpd" ? "err" : "out" },
            { text: tsLine(`systemd[1]: ${unit}.service: Control process exited with error code.`), type: unit === "httpd" ? "err" : "out" },
          ]
        : [
            { text: `-- Boot ${ts()} --`, type: "info" },
            { text: tsLine("kernel: Linux version 5.14.0-362.8.1.el9.x86_64"), type: "out" },
            { text: tsLine("systemd[1]: Reached target Multi-User System."), type: "out" },
          ];
      addLines(logLines);
      return;
    }

    // systemctl
    if (cmd === "systemctl") {
      const sub = args[0];
      const svc = args[1]?.replace(/\.service$/, "");

      if (!sub) { addLine("Usage: systemctl [status|start|stop|restart|reload] <service>", "err"); return; }

      const svcDef = lab.services?.[svc];

      if (sub === "status") {
        if (!svc) { addLine("Failed to connect to bus: No such file or directory", "err"); return; }
        if (svcDef) {
          addLines(svcDef.getStatus(sysState));
        } else {
          addLines([
            { text: `● ${svc}.service`, type: "out" },
            { text: `   Active: active (running) since ${ts()}`, type: "success" },
          ]);
        }
        return;
      }

      if (sub === "start" || sub === "restart" || sub === "reload") {
        if (svcDef?.[sub]) {
          const { lines: out, stateUpdate } = svcDef[sub](sysState);
          addLines(out);
          if (stateUpdate && Object.keys(stateUpdate).length > 0) {
            setSysState(prev => ({ ...prev, ...stateUpdate }));
          }
        } else {
          addLine(`Started ${svc}.service`, "success");
        }
        return;
      }

      if (sub === "stop") {
        addLine(`Stopped ${svc || "unknown"}.service`, "out");
        return;
      }

      if (sub === "list-units" || sub === "list-unit-files") {
        addLines([
          { text: "UNIT                   LOAD   ACTIVE   SUB     DESCRIPTION", type: "out" },
          { text: "httpd.service          loaded failed   failed  The Apache HTTP Server", type: lab.id === "lab-apache" ? "err" : "out" },
          { text: "nginx.service          loaded active   running The nginx HTTP Server", type: "success" },
          { text: "sshd.service           loaded active   running OpenSSH server daemon", type: "success" },
          { text: "firewalld.service      loaded active   running firewalld - dynamic firewall", type: "success" },
          { text: "crond.service          loaded active   running Command Scheduler", type: "success" },
        ]);
        return;
      }

      addLine(`Unknown operation '${sub}'.`, "err");
      return;
    }

    // top / ps
    if (cmd === "top" || (cmd === "ps" && args.includes("aux"))) {
      if (lab.getTopOutput) {
        addLines(lab.getTopOutput(sysState));
      } else {
        addLines([
          { text: "  PID USER  %CPU %MEM COMMAND", type: "out" },
          { text: " 1821 root   0.3  0.1 nginx", type: "out" },
          { text: " 1122 root   0.1  0.2 sshd", type: "out" },
          { text: "    1 root   0.0  0.1 systemd", type: "out" },
        ]);
      }
      return;
    }

    // kill / killall
    if (cmd === "kill" || cmd === "killall") {
      const pidOrName = args.find(a => !a.startsWith("-"));
      if (lab.id === "lab-cpu") {
        if (pidOrName === "9931" || pidOrName === "malware_sim") {
          setSysState(prev => ({ ...prev, rogueKilled: true }));
          addLines([
            { text: `Killed process ${pidOrName === "malware_sim" ? "9931 (malware_sim)" : pidOrName}`, type: "success" },
            { text: "CPU usage dropping...", type: "info" },
          ]);
        } else {
          addLine(`kill: (${pidOrName}): No such process`, "err");
        }
      } else {
        addLine(`kill: (${pidOrName || "?"}): No such process`, "err");
      }
      return;
    }

    // iptables
    if (cmd === "iptables") {
      if (args.includes("-L") || args.includes("--list")) {
        if (lab.getIptablesOutput) {
          addLines(lab.getIptablesOutput(sysState));
        } else {
          addLines([
            { text: "Chain INPUT (policy ACCEPT)", type: "out" },
            { text: "target  prot  source      destination", type: "out" },
            { text: "ACCEPT  all   anywhere    anywhere   state RELATED,ESTABLISHED", type: "success" },
          ]);
        }
        return;
      }
      // iptables -I INPUT -p tcp --dport 2222 -j ACCEPT
      if ((args.includes("-I") || args.includes("-A")) && args.includes("ACCEPT") && lab.id === "lab-ssh") {
        const dport = args[args.indexOf("--dport") + 1];
        if (dport === "2222") {
          setSysState(prev => ({ ...prev, iptablesBlocking: false }));
          addLines([
            { text: "iptables: rule inserted — port 2222 ACCEPT", type: "success" },
            { text: "SSH connections on port 2222 are now allowed.", type: "success" },
          ]);
        } else {
          addLine(`iptables: ACCEPT rule added for port ${dport || "?"}`, "out");
        }
        return;
      }
      if (args.includes("-D") && lab.id === "lab-ssh") {
        addLine("iptables: rule deleted.", "success");
        return;
      }
      addLine(`iptables: rule applied`, "out");
      return;
    }

    // ls -Z / SELinux context
    if (cmd === "ls" && args.includes("-Z")) {
      if (lab.id === "lab-selinux") {
        addLines([
          { text: "system_u:object_r:user_home_t:s0    /var/www/html/index.html", type: "err" },
          { text: "⚠  Context 'user_home_t' is wrong for web content.", type: "warn" },
          { text: "   Expected: system_u:object_r:httpd_sys_content_t:s0", type: "hint" },
          { text: "   Fix with: restorecon -Rv /var/www/html/", type: "hint" },
        ]);
      } else {
        addLine("unconfined_u:object_r:default_t:s0  (no issues found)", "out");
      }
      return;
    }

    // restorecon / chcon
    if (cmd === "restorecon" || cmd === "chcon") {
      if (lab.id === "lab-selinux") {
        setSysState(prev => ({ ...prev, selinuxContextFixed: true }));
        addLines([
          { text: `${cmd}: relabeling /var/www/html/index.html`, type: "info" },
          { text: "Relabeled /var/www/html/index.html from user_home_t to httpd_sys_content_t", type: "success" },
        ]);
      } else {
        addLine(`${cmd}: no relabeling required`, "out");
      }
      return;
    }

    // chmod
    if (cmd === "chmod") {
      if (lab.id === "lab-selinux") {
        setSysState(prev => ({ ...prev, chmod777Attempted: true }));
        addLines([
          { text: `chmod: permissions changed on ${args[1] || "file"}`, type: "out" },
          { text: "⚠  chmod has no effect here — SELinux is enforcing.", type: "warn" },
          { text: "   The issue is the security context, not Unix permissions.", type: "hint" },
          { text: "   Check: ls -Z /var/www/html/", type: "hint" },
        ]);
      } else {
        addLine(`chmod: permissions changed`, "out");
      }
      return;
    }

    // ausearch
    if (cmd === "ausearch") {
      if (lab.id === "lab-selinux") {
        addLines([
          { text: `time->${ts()}`, type: "out" },
          { text: "type=AVC msg=audit(1712345678.123:456): avc: denied { read } for", type: "err" },
          { text: "  pid=1821 comm=\"nginx\" name=\"index.html\" dev=\"sda1\"", type: "err" },
          { text: "  scontext=system_u:system_r:httpd_t:s0", type: "out" },
          { text: "  tcontext=unconfined_u:object_r:user_home_t:s0 tclass=file", type: "err" },
          { text: "", type: "out" },
          { text: "SELinux is blocking nginx from reading the file. Fix: restorecon -Rv /var/www/html/", type: "hint" },
        ]);
      } else {
        addLine("ausearch: no AVC denials found", "success");
      }
      return;
    }

    // setenforce (penalize)
    if (cmd === "setenforce") {
      if (args[0] === "0") {
        addLines([
          { text: "SELinux set to Permissive mode.", type: "warn" },
          { text: "⚠  This disables security enforcement — not a real fix.", type: "err" },
          { text: "   Restore context instead: restorecon -Rv /var/www/html/", type: "hint" },
        ]);
      } else {
        addLine("SELinux set to Enforcing.", "success");
      }
      return;
    }

    // rm / truncate (disk-full lab)
    if (cmd === "rm" || cmd === ">") {
      const target = args.find(a => !a.startsWith("-"));
      if (lab.id === "lab-diskfull" && target?.includes("jenkins.log.1")) {
        setSysState(prev => ({ ...prev, diskUsedGB: Math.max(0, prev.diskUsedGB - 42), jenkinsLogRemoved: true }));
        if (cmd === ">") {
          addLine(`> ${target}: file truncated to 0 bytes (inode preserved)`, "success");
        } else {
          addLine(`rm: removed '${target}'`, "success");
        }
        addLines([
          { text: "Freed 42G of disk space.", type: "success" },
          { text: "Hint: run 'check' to verify the disk is below threshold.", type: "hint" },
        ]);
      } else if (target) {
        addLine(`rm: cannot remove '${target}': No such file or directory`, "err");
      } else {
        addLine("rm: missing operand", "err");
      }
      return;
    }

    // truncate via >
    if (raw.match(/^>\s+\S+/)) {
      const target = raw.replace(/^>\s+/, "");
      if (lab.id === "lab-diskfull" && target.includes("jenkins.log.1")) {
        setSysState(prev => ({ ...prev, diskUsedGB: Math.max(0, prev.diskUsedGB - 42), jenkinsLogRemoved: true }));
        addLines([
          { text: `Truncated ${target} to 0 bytes.`, type: "success" },
          { text: "Freed 42G — file preserved, inode intact.", type: "success" },
        ]);
      }
      return;
    }

    // unknown
    addLine(`bash: ${cmd}: command not found`, "err");
  }, [cwd, sysState, lab, runCheck, hintIdx, addLine, addLines, checkEasterEggs]);

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    lastActivityRef.current = Date.now();

    // Ctrl+C — interrupt
    if (e.ctrlKey && e.key === "c") {
      e.preventDefault();
      addLines([
        { text: `[root@web01 ${cwd === "/root" ? "~" : cwd.split("/").pop()}]# ${input}^C`, type: "prompt" },
      ]);
      setInput("");
      setProcessing(false);
      return;
    }

    if (e.key === "Enter" && !processing) {
      const val = input.trim();
      setInput("");

      // Idle wake-up: add one-time latency
      if (idleDelay) {
        setIdleDelay(false);
        setTimeout(() => { if (val) processCommand(val); }, 280 + Math.random() * 120);
        return;
      }

      if (val) processCommand(val);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = histIdx === -1 ? cmdHistory.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setInput(cmdHistory[idx] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx !== -1) {
        const idx = histIdx + 1;
        if (idx >= cmdHistory.length) { setHistIdx(-1); setInput(""); }
        else { setHistIdx(idx); setInput(cmdHistory[idx]); }
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      // basic tab completion for common paths
      const completions = Object.keys(lab.files || {}).filter(f => f.startsWith(input.split(" ").pop() || ""));
      if (completions.length === 1) {
        const parts = input.split(" ");
        parts[parts.length - 1] = completions[0];
        setInput(parts.join(" "));
      }
    }
  }, [input, processing, cmdHistory, histIdx, processCommand, idleDelay, cwd, addLines]);

  const promptDir = cwd === "/root" ? "~" : cwd.split("/").pop();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#0d0d0f] font-mono text-sm rounded-xl overflow-hidden border border-slate-800">

      {/* Editor overlay */}
      {editorState && (
        <FakeEditor
          path={editorState.path}
          lines={editorState.content}
          onClose={(saved) => {
            setEditorState(null);
            // Check if httpd.conf was fixed
            if (editorState.path.includes("httpd.conf") && lab.id === "lab-apache") {
              const fixed = !saved.join("\n").includes("ServerNaame");
              if (fixed) {
                setSysState(prev => ({ ...prev, configFixed: true }));
                addLine("httpd.conf saved. Typo corrected.", "success");
              } else {
                addLine("httpd.conf saved (typo still present on line 5).", "warn");
              }
            } else {
              addLine(`[${editorState.path.includes("nano") ? "nano" : "editor"}] ${editorState.path} saved.`, "info");
            }
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
        />
      )}

      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="text-slate-400 text-xs ml-2">{lab.subtitle}</span>
        <span className="ml-auto text-xs text-slate-600">Lab {labIndex + 1}/5</span>
      </div>

      {/* Victory screen overlay */}
      {victory && (
        <div className="absolute inset-0 z-40 bg-[#0d0d0f]/95 flex items-center justify-center">
          <VictoryScreen
            victory={victory}
            lab={lab}
            hasNext={labIndex < LABS.length - 1}
            onNext={() => { setLabIndex(i => i + 1); setVictory(null); }}
            onUpgrade={onUpgrade}
          />
        </div>
      )}

      {/* Output area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-0.5 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line, i) => (
          <div key={i} className={`leading-5 whitespace-pre-wrap break-all ${
            line.type === "err"     ? "text-red-400" :
            line.type === "success" ? "text-emerald-400" :
            line.type === "warn"    ? "text-yellow-400" :
            line.type === "info"    ? "text-blue-400" :
            line.type === "hint"    ? "text-purple-400" :
            line.type === "prompt"  ? "text-green-500 font-semibold" :
            "text-slate-300"
          }`}>
            {line.text || "\u00a0"}
          </div>
        ))}
        {processing && (
          <div className="text-slate-500 animate-pulse">▋</div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-slate-800 px-4 py-2.5 flex items-center gap-2 bg-slate-900/50">
        <span className="text-green-500 shrink-0 select-none text-xs">[root@web01 {promptDir}]#</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={processing || !!editorState}
          className="flex-1 bg-transparent outline-none text-green-300 text-xs placeholder-slate-700"
          placeholder={processing ? "" : "type a command…"}
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
      </div>

      {/* Lab nav */}
      <div className="flex gap-1 px-4 py-2 bg-slate-900/80 border-t border-slate-800 overflow-x-auto">
        {LABS.map((l, i) => (
          <button key={l.id} onClick={() => setLabIndex(i)}
            className={`px-3 py-1 rounded text-[10px] font-medium whitespace-nowrap transition-colors ${
              i === labIndex
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}>
            {i + 1}. {l.title.split("·")[1]?.trim() || l.title}
          </button>
        ))}
      </div>
    </div>
  );
}
