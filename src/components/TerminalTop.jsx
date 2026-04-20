import { useState, useEffect, useRef } from "react";

function jit(base, range = 0.3) {
  return (base + (Math.random() - 0.5) * range).toFixed(1);
}

function getLoad(s) {
  if (s === "highcpu" || s === "iowait" || s === "apachewrk") return [12.44, 11.98, 10.21];
  if (s === "swap" || s === "oomkiller") return [6.10, 5.88, 5.21];
  if (s === "mysqlslow") return [3.24, 2.98, 2.44];
  return [0.32, 0.28, 0.22];
}

function getProcs(s, tick) {
  const v = (n, r=0.2) => jit(n, r);
  const row = (pid, user, pr, ni, virt, res, shr, stat, cpu, mem, time, cmd) =>
    `${String(pid).padStart(6)} ${user.padEnd(9)} ${String(pr).padStart(3)} ${String(ni).padStart(3)}  ${virt.padStart(6)} ${res.padStart(6)} ${shr.padStart(5)} ${stat}  ${String(cpu).padStart(4)}  ${String(mem).padStart(4)}   ${time.padStart(9)} ${cmd}`;

  const base = [
    row(1,    "root",   20, 0, "169m",  "12m", "8m",  "S", "0.0", "0.2", "0:01.12", "systemd"),
    row(901,  "apache", 20, 0, "348m",  "28m", "8m",  "S", v(0.3), "0.4", "0:12.44", "httpd"),
    row(1234, "root",   20, 0, "168m",  "8m",  "4m",  "S", "0.0", "0.1", "0:01.23", "sshd"),
    row(4001, "root",   20, 0, "116m",  "6m",  "4m",  "S", "0.0", "0.1", "0:00.08", "bash"),
    row(4122, "root",   20, 0,  "26m",  "2m",  "1m",  "S", "0.0", "0.0", "0:00.01", "top"),
  ];

  if (s === "highcpu") {
    const c = v(98.2, 1.5);
    return [
      row(4512, "root",  20, 0, "256m", "256m", "4m", "R", c,    "3.2", "8:44.21", "stress-ng --cpu 4"),
      ...base,
    ];
  }
  if (s === "iowait") {
    return [
      row(4821, "mysql", 20, 0, "1.2g", "482m", "12m","D", v(8.2), "6.2", "3:24.81", "mysqld"),
      row(4822, "mysql", 20, 0, "1.2g", "480m", "12m","D", v(0.8), "6.1", "1:12.33", "mysqld (innodb flush)"),
      ...base,
    ];
  }
  if (s === "apachewrk") {
    return Array.from({length:5}, (_,i) =>
      row(900+i, "apache", 20, 0, "348m", "28m", "8m","S", v(0.3), "0.4", `0:${String(12+i).padStart(2,'0')}.44`, "httpd")
    ).concat(base);
  }
  if (s === "swap" || s === "oomkiller") {
    const m = v(98.8, 0.5);
    return [
      row(8944, "tomcat", 20, 0, "15g", "14.8g","128m","S", v(12.3), m, "24:12.88", "java -Xmx15g -jar app.jar"),
      ...base,
    ];
  }
  if (s === "mysqlslow") {
    return [
      row(4821, "mysql", 20, 0, "1.2g", "482m","12m","S", v(18.4), "6.2", "14:21.88", "mysqld"),
      ...base,
    ];
  }
  if (s === "dockerdaemon") {
    return [
      row(2891, "root", 20, 0, "4.7g","3.9g","64m","S", v(14.2), "51.2","14:12.33","dockerd"),
      ...base,
    ];
  }
  if (s === "elasticsearch") {
    return [
      row(3321, "elastic",20, 0, "16g","15.2g","128m","S", v(32.1), "98.8","44:12.88","java (elasticsearch)"),
      ...base,
    ];
  }
  return [
    row(4821, "mysql", 20, 0, "1.2g", "482m","12m","S", v(0.5), "0.6","3:24.81","mysqld"),
    ...base,
  ];
}

export default function TerminalTop({ scenario, instanceId, onExit }) {
  const [tick, setTick] = useState(0);
  const ref = useRef();

  useEffect(() => {
    ref.current?.focus();
    const iv = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(iv);
  }, []);

  const s = scenario || "free";
  const [l1, l5, l15] = getLoad(s);
  const load1  = jit(l1,  0.4);
  const load5  = jit(l5,  0.3);
  const load15 = jit(l15, 0.2);

  const highCpu = ["highcpu","iowait","apachewrk"].includes(s);
  const highMem = ["swap","oomkiller","elasticsearch"].includes(s);
  const cpuUs   = highCpu ? jit(96.2, 1.5) : jit(2.1, 0.4);
  const cpuId   = highCpu ? jit(1.2,  0.8) : jit(96.8, 0.4);
  const cpuWa   = s==="iowait" ? jit(92.4, 1.0) : jit(0.2, 0.1);
  const memUsed = highMem ? jit(7750, 50) : jit(4821, 80);
  const memFree = (7813.5 - parseFloat(memUsed)).toFixed(1);

  const now     = new Date().toLocaleTimeString("en-US", { hour12:false });
  const procs   = getProcs(s, tick);

  function handleKey(e) {
    if (e.key === "q" || e.key === "Q" || (e.ctrlKey && e.key === "c")) {
      e.preventDefault(); onExit();
    }
  }

  const C = { ok:"#4caf84", err:"#e06060", warn:"#ffaa00", dim:"#556677", hdr:"#1a2030" };

  return (
    <div ref={ref} tabIndex={0} onKeyDown={handleKey}
      style={{ position:"absolute", inset:0, background:"#060809", fontFamily:"'JetBrains Mono','Fira Code',monospace", fontSize:12, color:"#c8d8c8", padding:"6px 10px", outline:"none", overflow:"hidden" }}>

      <div style={{ color: C.ok }}>
        {`top - ${now} up 4 days,  2:41,  1 user,  load average: ${load1}, ${load5}, ${load15}`}
      </div>
      <div>Tasks: 312 total,   1 running, 311 sleeping,   0 stopped,   0 zombie</div>
      <div style={{ color: highCpu ? C.err : "#c8d8c8" }}>
        {`%Cpu(s): ${String(cpuUs).padStart(5)} us,  0.8 sy,  0.0 ni, ${String(cpuId).padStart(5)} id, ${String(cpuWa).padStart(5)} wa,  0.0 hi,  0.1 si,  0.0 st`}
      </div>
      <div style={{ color: highMem ? C.warn : "#c8d8c8" }}>
        {`MiB Mem :   7813.5 total,  ${String(memFree).padStart(6)} free,  ${String(memUsed).padStart(6)} used,   2590.1 buff/cache`}
      </div>
      <div>MiB Swap:   2048.0 total,   1821.4 free,    226.6 used.   2201.4 avail Mem</div>

      <div style={{ marginTop:6, background: C.hdr, color: C.ok, padding:"1px 0" }}>
        {"    PID USER      PR  NI    VIRT    RES   SHR  S  %CPU  %MEM       TIME+ COMMAND"}
      </div>
      {procs.map((line, i) => {
        const isHot = line.includes("stress-ng") || line.includes("java") || parseFloat(line.match(/\d+\.\d+/g)?.[4]||0) > 50;
        return (
          <div key={i} style={{ color: isHot ? C.err : "#c8d8c8", fontVariantNumeric:"tabular-nums" }}>
            {line}
          </div>
        );
      })}

      <div style={{ marginTop:8, color: C.dim, fontSize:11 }}>
        q quit  k kill  r renice  1 per-cpu  m mem-mode  h help
      </div>
    </div>
  );
}
