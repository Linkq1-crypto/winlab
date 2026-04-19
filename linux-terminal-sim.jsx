import { useState, useRef, useEffect, useCallback } from "react";
import { useLabTelemetry } from "./src/hooks/useLabTelemetry.js";
import { getRealismWorker, destroyRealismWorker } from "./src/hooks/realism-worker.js";
import { runBashLayer, promptDir, tabComplete } from "./src/hooks/bashEngine.js";

// ─── Random instance ID per session ──────────────────────────────────────────
function genInstanceId() {
  const chars = "abcdefghjkmnpqrstuvwxyz0123456789";
  let s = "srv-";
  for (let i = 0; i < 2; i++) s += chars[Math.floor(Math.random() * 24)];
  for (let i = 0; i < 3; i++) s += chars[24 + Math.floor(Math.random() * 10)];
  return s;
}

// ─── /proc virtual filesystem ────────────────────────────────────────────────
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
  ],
  "/proc/version": [
    "Linux version 5.15.0-101-generic (buildd@lcy02-amd64-046) (gcc (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0, GNU ld 2.38) #111-Ubuntu SMP Tue Mar 5 20:16:58 UTC 2024",
  ],
  "/proc/uptime": ["347214.82 1243812.44"],
};

const SCENARIOS = [
  // BASE
  { id: "free",       label: "Free shell",         desc: "Explore Oracle Linux 8 freely",                  icon: "🖥",  cat: "base" },
  { id: "webdown",    label: "Apache down",         desc: "Site not responding — find and fix it",          icon: "🔴",  cat: "base" },
  { id: "diskfull",   label: "Disk full",           desc: "Server is stuck — storage exhausted",            icon: "💾",  cat: "base" },
  { id: "selinux",    label: "SELinux denial",       desc: "httpd returns 403 — wrong file context",         icon: "🔒",  cat: "base" },
  { id: "highcpu",    label: "CPU at 100%",          desc: "Something is hammering the server",              icon: "🔥",  cat: "base" },
  { id: "sshfail",    label: "SSH refused",          desc: "Cannot connect — diagnose the firewall",         icon: "🚫",  cat: "base" },
  // ADVANCED
  { id: "mysql",      label: "MySQL down",           desc: "Database went down after an update",             icon: "🗄",  cat: "adv"  },
  { id: "swap",       label: "RAM / Swap exhausted", desc: "OOM killer active — system unstable",            icon: "🧠",  cat: "adv"  },
  { id: "cron",       label: "Cron not running",     desc: "Nightly backup hasn't run in weeks",             icon: "⏰",  cat: "adv"  },
  { id: "network",    label: "No route to host",     desc: "Server cannot reach the internet",               icon: "🌐",  cat: "adv"  },
  { id: "zombie",     label: "Zombie processes",     desc: "Dozens of Z processes — system degraded",        icon: "💀",  cat: "adv"  },
  { id: "journal",    label: "Journald full",        desc: "System logs consuming 40G of disk",              icon: "📋",  cat: "adv"  },
  // EXPERT
  { id: "nfs",        label: "NFS mount hang",       desc: "Client is stuck — NFS mount not responding",    icon: "📂",  cat: "exp"  },
  { id: "lvm",        label: "LVM volume full",      desc: "/data is at 100% — extend the LVM volume",      icon: "🗂",  cat: "exp"  },
  { id: "dnsfail",    label: "DNS not resolving",    desc: "Hostnames not resolving — services down",        icon: "🔍",  cat: "exp"  },
  { id: "sshbrute",   label: "Brute force SSH",      desc: "Attack in progress — thousands of login attempts", icon: "⚔", cat: "exp"  },
  { id: "kernpanic",  label: "Kernel panic boot",    desc: "Server won't boot after an update",              icon: "💥",  cat: "exp"  },
  { id: "timedesync", label: "Clock desync",         desc: "Time is wrong — certs and logs broken",          icon: "🕐",  cat: "exp"  },
  // NIGHTMARE
  { id: "ssl",        label: "SSL cert expired",     desc: "HTTPS down — cert expired, urgent renewal",      icon: "🔐",  cat: "nm"   },
  { id: "inode",      label: "Inodes exhausted",     desc: "Disk shows free space but no file can be created", icon: "🔢", cat: "nm"   },
  { id: "port",       label: "Port already in use",  desc: "Apache won't start — port 80 conflict",          icon: "🔌",  cat: "nm"   },
  { id: "sudoers",    label: "Sudoers corrupted",    desc: "sudo is broken — privileged access lost",         icon: "🔑",  cat: "nm"   },
  { id: "raid",       label: "RAID degraded",        desc: "A disk failed — array is in degraded state",     icon: "💣",  cat: "nm"   },
  { id: "logrotate",  label: "Logrotate broken",     desc: "Logs not rotating — configuration error",         icon: "📦",  cat: "nm"   },
];

const makeState = (id) => ({
  scenario: id,
  services: {
    httpd:    ["webdown","ssl","port"].includes(id) ? "inactive" : "active",
    sshd:     id === "sshfail" ? "inactive" : "active",
    firewalld:"active",
    crond:    id === "cron" ? "inactive" : "active",
    mysqld:   id === "mysql" ? "inactive" : "active",
    NetworkManager: id === "network" ? "inactive" : "active",
    named:    id === "dnsfail" ? "inactive" : "active",
    chronyd:  id === "timedesync" ? "inactive" : "active",
    fail2ban: "inactive",
  },
  diskFull:      id === "diskfull",
  journalFull:   id === "journal",
  selinuxIssue:  id === "selinux",
  cpuHog:        id === "highcpu" ? "stress-ng" : null,
  sshBlocked:    id === "sshfail",
  mysqlBroken:   id === "mysql",
  swapExhausted: id === "swap",
  cronBroken:    id === "cron",
  networkDown:   id === "network",
  zombies:       id === "zombie",
  nfsHang:       id === "nfs",
  lvmFull:       id === "lvm",
  dnsBroken:     id === "dnsfail",
  bruteForce:    id === "sshbrute",
  kernelBad:     id === "kernpanic",
  timeDesync:    id === "timedesync",
  sslExpired:    id === "ssl",
  inodesFull:    id === "inode",
  portConflict:  id === "port",
  sudoersBroken: id === "sudoers",
  raidDegraded:  id === "raid",
  logrotBroken:  id === "logrotate",
  lvmExtended:   false,
  fail2banOn:    false,
  sslRenewed:    false,
  sudoersFixed:  false,
  fixes: {},
  solved: false,
});

function runCommand(input, state, setState) {
  const raw = input.trim();
  const [cmd, ...args] = raw.split(/\s+/);

  const lines = (arr) => arr.map(l => ({ text: l, type: "out" }));
  const err   = (m)   => [{ text: m, type: "err"  }];
  const ok    = (m)   => [{ text: m, type: "ok"   }];
  const warn  = (m)   => [{ text: m, type: "warn" }];

  // ── systemctl ──────────────────────────────────────────────────────────────
  if (cmd === "systemctl") {
    const sub = args[0], unit = args[1];
    const svc = unit?.replace(".service","");
    if (sub === "status") {
      const st = state.services[svc];
      if (!st) return err(`Unit ${unit||""} could not be found.`);
      const up = st === "active";
      return lines([
        `● ${svc}.service`,
        `   Loaded: loaded (/usr/lib/systemd/system/${svc}.service; enabled)`,
        `   Active: ${up ? "active (running)" : "inactive (dead)"} since ${new Date().toLocaleString("en-US")}`,
        up ? `Main PID: ${2000+Math.floor(Math.random()*3000)} (${svc})` : `  (dead)`,
      ]);
    }
    if (sub === "start" || sub === "restart") {
      if (state.selinuxIssue && svc === "httpd")
        return err("Job for httpd.service failed.\nSELinux is preventing httpd from read access on /var/www/html/index.html");
      if (state.diskFull && svc === "httpd")
        return err("Failed to start httpd: No space left on device");
      if (state.mysqlBroken && svc === "mysqld")
        return err("Job for mysqld.service failed. See 'journalctl -u mysqld'.");
      if (state.nfsHang && svc === "nfs")
        return err("Failed to start nfs-server: portmapper unreachable.");
      if (state.portConflict && svc === "httpd")
        return err("Job for httpd.service failed.\n(98)Address already in use: AH00072: make_sock: could not bind to address 0.0.0.0:80\nSee 'journalctl -u httpd' for details.");
      if (state.sslExpired && svc === "httpd" && !state.sslRenewed)
        return err("Job for httpd.service failed.\nSSL_CTX_use_certificate_file: certificate expired (notAfter=Feb 28 00:00:00 2024)\nSee 'journalctl -u httpd'.");
      if (state.cronBroken && svc === "crond") {
        setState(s => ({ ...s, services: { ...s.services, crond: "active" }, cronBroken: false, fixes: { ...s.fixes, cron: true } }));
        return ok("Started crond.service");
      }
      if (state.dnsBroken && svc === "named") {
        if (!state.fixes?.dnsfix) return err("Job for named.service failed — syntax error in /etc/named.conf");
        setState(s => ({ ...s, dnsBroken: false, services: { ...s.services, named: "active" }, fixes: { ...s.fixes, dns: true } }));
        return ok("Started named.service — DNS is now operational.");
      }
      if (state.timeDesync && svc === "chronyd") {
        setState(s => ({ ...s, timeDesync: false, services: { ...s.services, chronyd: "active" }, fixes: { ...s.fixes, time: true } }));
        return ok("Started chronyd.service — NTP sync in progress.");
      }
      if (svc === "fail2ban") {
        setState(s => ({ ...s, fail2banOn: true, services: { ...s.services, fail2ban: "active" }, fixes: { ...s.fixes, brute: true } }));
        return ok("Started fail2ban.service — SSH brute-force protection active.");
      }
      if (state.sslRenewed && svc === "httpd") {
        setState(s => ({ ...s, sslExpired: false, services: { ...s.services, httpd: "active" }, fixes: { ...s.fixes, ssl: true } }));
        return ok("Started httpd.service — HTTPS operational with new certificate.");
      }
      if (!state.portConflict && svc === "httpd" && state.scenario === "port") {
        setState(s => ({ ...s, services: { ...s.services, httpd: "active" }, fixes: { ...s.fixes, port: true } }));
        return ok("Started httpd.service — port 80 free.");
      }
      setState(s => ({ ...s, services: { ...s.services, [svc]: "active" }, sshBlocked: svc==="sshd" ? false : s.sshBlocked }));
      return ok(`Started ${svc}.service`);
    }
    if (sub === "stop") {
      setState(s => ({ ...s, services: { ...s.services, [svc]: "inactive" } }));
      return ok(`Stopped ${svc}.service`);
    }
    if (sub === "enable") return ok(`Created symlink /etc/systemd/system/multi-user.target.wants/${unit}`);
    if (sub === "list-units") return lines([
      "UNIT                   LOAD   ACTIVE  SUB",
      "chronyd.service        loaded " + (state.services.chronyd==="active"?"active  running":"failed  failed"),
      "crond.service          loaded " + (state.services.crond==="active"?"active  running":"failed  failed"),
      "fail2ban.service       loaded " + (state.fail2banOn?"active  running":"inactive dead   "),
      "httpd.service          loaded " + (state.services.httpd==="active"?"active  running":"failed  failed"),
      "mysqld.service         loaded " + (state.services.mysqld==="active"?"active  running":"failed  failed"),
      "named.service          loaded " + (state.services.named==="active"?"active  running":"failed  failed"),
      "sshd.service           loaded " + (state.services.sshd==="active"?"active  running":"failed  failed"),
    ]);
    return err(`Unknown operation '${sub}'.`);
  }

  // ── journalctl ────────────────────────────────────────────────────────────
  if (cmd === "journalctl") {
    if (raw.includes("--disk-usage"))
      return state.journalFull ? warn("Archived and active journals take up 40.2G on disk.") : ok("Journals take up 420.0M on disk.");
    if (raw.includes("--vacuum")) {
      if (state.journalFull) { setState(s => ({ ...s, journalFull: false, fixes: { ...s.fixes, journal: true } })); return ok("Vacuuming done, freed 39.7G."); }
      return ok("Nothing to vacuum.");
    }
    if (raw.includes("mysqld")||(raw.includes("-u")&&raw.includes("mysql"))) {
      if (state.mysqlBroken) return lines([
        "mysqld[3201]: [ERROR] InnoDB: Cannot open datafile './ibdata1'",
        "systemd[1]: mysqld.service: Main process exited, code=exited, status=1",
        "# ROOT CAUSE: /var/lib/mysql has root:root permissions instead of mysql:mysql",
      ]);
    }
    if (raw.includes("sshd")||(raw.includes("-u")&&raw.includes("ssh"))) {
      if (state.bruteForce) return lines([
        "sshd[4401]: Failed password for root from 185.234.12.45 port 43210 ssh2",
        "sshd[4402]: Failed password for root from 185.234.12.45 port 43211 ssh2",
        "# ... 4800 attempts in the last 2 hours from 185.234.12.45",
      ]);
    }
    if (raw.includes("named")||(raw.includes("-u")&&raw.includes("dns"))) {
      if (state.dnsBroken) return lines([
        "named[2201]: /etc/named.conf:14: unknown option 'forwarders-ip'",
        "named[2201]: loading configuration failed",
        "systemd[1]: named.service: Main process exited, code=exited, status=1",
      ]);
    }
    if (raw.includes("chronyd")) {
      if (state.timeDesync) return lines(["chronyd[1234]: System clock wrong by 7243.5 seconds","chronyd[1234]: Can't synchronise: no selectable sources"]);
    }
    if (raw.includes("crond")) {
      if (state.cronBroken) return lines(["crond[1122]: (CRON) ERROR chdir failed (/var/spool/cron): Permission denied"]);
    }
    if (raw.includes("-xe")||raw.includes("httpd")) {
      if (state.portConflict) return lines([
        "httpd[5501]: (98)Address already in use: AH00072: make_sock: could not bind to address 0.0.0.0:80",
        "httpd[5501]: no listening sockets available, shutting down",
        "# ROOT CAUSE: another process is using port 80",
      ]);
      if (state.sslExpired) return lines([
        "httpd[5502]: SSL_CTX_use_certificate_file: certificate is not yet valid OR expired",
        "httpd[5502]: Certificate file /etc/pki/tls/certs/server.crt expired: notAfter=Feb 28 00:00:00 2024",
        "systemd[1]: httpd.service: Failed to start.",
        "# ROOT CAUSE: SSL certificate expired — renewal required",
      ]);
      if (state.selinuxIssue) return lines(["setroubleshoot: SELinux is preventing httpd from read access on /var/www/html/index.html"]);
      if (state.services.httpd === "inactive") return lines(["kernel: Out of memory: Kill process 3412 (httpd)"]);
    }
    if (raw.includes("-p err")) {
      const errs = [];
      if (state.services.httpd!=="active") errs.push("systemd[1]: httpd.service failed");
      if (state.diskFull)      errs.push("kernel: EXT4-fs error: No space left");
      if (state.cpuHog)        errs.push("kernel: stress-ng consumed 99% CPU");
      if (state.swapExhausted) errs.push("kernel: Out of memory: Kill process 5511 (java)");
      if (state.bruteForce)    errs.push("sshd: 4800 failed login attempts in 2 hours");
      if (state.timeDesync)    errs.push("chronyd: System clock wrong by 7243 seconds");
      if (state.raidDegraded)  errs.push("md/raid1:md0: Disk failure on sdb1, disabling device.");
      if (state.inodesFull)    errs.push("kernel: ext4_new_inode: failed to allocate inode — no inodes left");
      return errs.length ? lines(errs) : ok("No error entries found.");
    }
    return lines(["systemd[1]: Starting Session 4 of user root.","sshd[4001]: Accepted publickey for root"]);
  }

  // ── SSL ───────────────────────────────────────────────────────────────────
  if (cmd === "openssl") {
    if (raw.includes("x509") && raw.includes("enddate")) {
      if (state.sslExpired) return lines([
        "notAfter=Feb 28 00:00:00 2024 GMT",
        "# EXPIRED — today is Mar 4 2025. Renew the certificate.",
      ]);
      return lines(["notAfter=Mar 04 00:00:00 2026 GMT  ← valid"]);
    }
    if (raw.includes("req") || raw.includes("genrsa")) {
      return ok("Key/CSR generation complete → /etc/pki/tls/certs/server.crt renewed.\nNext: systemctl restart httpd");
    }
    if (raw.includes("s_client")) {
      if (state.sslExpired && !state.sslRenewed)
        return err("SSL handshake failure: certificate has expired (Feb 28 00:00:00 2024 GMT)");
      return lines(["SSL handshake success","depth=0 CN=server01.lab.local","CONNECTED(00000003)"]);
    }
  }
  if (cmd === "certbot") {
    if (raw.includes("renew") || raw.includes("certonly")) {
      setState(s => ({ ...s, sslRenewed: true, fixes: { ...s.fixes, sslrenew: true } }));
      return ok("Congratulations! Your certificate and chain have been saved.\n/etc/letsencrypt/live/server01/fullchain.pem\nNext: systemctl restart httpd");
    }
    if (raw.includes("certificates")) {
      if (state.sslExpired) return lines([
        "Found the following certs:",
        "  Certificate Name: server01.lab.local",
        "    Expiry Date: 2024-02-28 (EXPIRED)",
        "    Certificate Path: /etc/letsencrypt/live/server01/fullchain.pem",
      ]);
    }
  }
  if (cmd === "cp" && raw.includes(".crt")) {
    setState(s => ({ ...s, sslRenewed: true, fixes: { ...s.fixes, sslrenew: true } }));
    return ok("Certificate copied. Next: systemctl restart httpd");
  }

  // ── INODE ─────────────────────────────────────────────────────────────────
  if (cmd === "df") {
    if (state.inodesFull) return lines([
      "Filesystem              Size  Used Avail Use% Mounted on",
      "/dev/mapper/ol-root      50G   18G   32G  36% /  ← free space but...",
      "tmpfs                   3.9G    0   3.9G   0% /tmp",
    ]);
    return lines([
      "Filesystem              Size  Used Avail Use% Mounted on",
      `/dev/mapper/ol-root      50G  ${state.diskFull?"50G     0 100%":state.journalFull?"44G   6G  88%":"18G  32G  36%"} /`,
      state.lvmFull ? "/dev/mapper/vg0-data    100G  100G     0 100% /data" : "/dev/mapper/vg0-data    100G   42G   58G  42% /data",
      "tmpfs                   3.9G  " + (state.swapExhausted?"3.9G     0 100%":"  0   3.9G   0%") + " /tmp",
    ]);
  }
  if (cmd === "df" && raw.includes("-i")) {
    if (state.inodesFull) return lines([
      "Filesystem              Inodes  IUsed  IFree IUse% Mounted on",
      "/dev/mapper/ol-root    3276800 3276800      0  100% /  ← INODES EXHAUSTED!",
    ]);
    return lines(["Filesystem  Inodes  IUsed  IFree IUse%","ol-root    3276800 450000 2826800  14%"]);
  }
  // override df for -i flag
  if (raw === "df -i" || raw === "df --inodes" || raw === "df -ih") {
    if (state.inodesFull) return lines([
      "Filesystem              Inodes  IUsed  IFree IUse% Mounted on",
      "/dev/mapper/ol-root    3276800 3276800      0  100% /  ← INODES EXHAUSTED!",
    ]);
    return lines(["Filesystem  Inodes  IUsed  IFree IUse%","ol-root    3276800 450000 2826800  14%"]);
  }
  if (cmd === "touch" || cmd === "mkdir") {
    if (state.inodesFull) return err(`${cmd}: cannot create '${args[0]||"file"}': No space left on device  (inodes exhausted)`);
    return ok(`${cmd} completed.`);
  }
  if (cmd === "find" && raw.includes("count")) {
    if (state.inodesFull) return warn("3,276,800 files found in /tmp/sessions — orphaned PHP sessions never cleaned up");
    return lines(["/var/log: 1240 files","/tmp: 12 files"]);
  }
  if (raw.includes("find") && raw.includes("/tmp") && (raw.includes("-delete")||raw.includes("-exec rm"))) {
    if (state.inodesFull) {
      setState(s => ({ ...s, inodesFull: false, fixes: { ...s.fixes, inode: true } }));
      return ok("3,276,612 files deleted from /tmp/sessions. Free inodes: 2,826,800");
    }
  }

  // ── PORT CONFLICT ─────────────────────────────────────────────────────────
  if ((cmd === "ss" || cmd === "netstat") && (raw.includes("-tlpn")||raw.includes("-tulpn")||raw.includes("-lnp"))) {
    if (state.portConflict) return lines([
      "Netid  State  Local Address:Port  Process",
      "tcp    LISTEN 0.0.0.0:80         users:((\"nginx\",pid=7701,fd=6))  ← nginx is occupying port 80!",
      "tcp    LISTEN 0.0.0.0:22         users:((\"sshd\",pid=892,fd=3))",
      "tcp    LISTEN 0.0.0.0:3306       users:((\"mysqld\",pid=1234,fd=18))",
    ]);
    return lines(["tcp LISTEN 0.0.0.0:80  httpd","tcp LISTEN 0.0.0.0:22  sshd","tcp LISTEN 0.0.0.0:3306 mysqld"]);
  }
  if ((cmd === "ss"||cmd === "netstat") && !raw.includes("-")) {
    if (state.portConflict) return lines(["tcp LISTEN 0.0.0.0:80  nginx  ← conflict!","tcp LISTEN 0.0.0.0:22  sshd"]);
    return lines(["tcp LISTEN 0.0.0.0:22","tcp LISTEN 0.0.0.0:80","tcp LISTEN 0.0.0.0:3306"]);
  }
  if (cmd === "lsof" && raw.includes(":80")) {
    if (state.portConflict) return lines([
      "COMMAND   PID  USER  FD  TYPE  DEVICE   NAME",
      "nginx    7701  root  6u  IPv4  0t0      TCP *:80 (LISTEN)  ← nginx on port 80",
    ]);
    return lines(["httpd  901  apache  4u  IPv4  0t0  TCP *:80 (LISTEN)"]);
  }
  if (cmd === "systemctl" && args[0]==="stop" && args[1]==="nginx") {
    if (state.portConflict) {
      setState(s => ({ ...s, portConflict: false, services: { ...s.services, nginx: "inactive" }, fixes: { ...s.fixes, port: true } }));
      return ok("Stopped nginx.service — port 80 free. Next: systemctl start httpd");
    }
  }
  if (cmd === "kill" && raw.includes("7701")) {
    if (state.portConflict) {
      setState(s => ({ ...s, portConflict: false, fixes: { ...s.fixes, port: true } }));
      return ok("nginx (7701) terminated — port 80 free. Next: systemctl start httpd");
    }
  }

  // ── SUDOERS ───────────────────────────────────────────────────────────────
  if (cmd === "sudo") {
    if (state.sudoersBroken && !state.sudoersFixed) return err("sudo: /etc/sudoers is world writable\nsudo: /etc/sudoers: syntax error near line 28\nsudo: no valid sudoers sources found, quitting");
    return ok(`[sudo] executed: ${args.join(" ")}`);
  }
  if (cmd === "visudo") {
    if (state.sudoersBroken) {
      setState(s => ({ ...s, sudoersFixed: true, fixes: { ...s.fixes, sudoers: true } }));
      return ok("visudo: /etc/sudoers: syntax OK. Permissions restored (0440).\nsudo is operational.");
    }
    return ok("visudo: file opened. No errors detected.");
  }
  if (cmd === "cat" && raw.includes("sudoers")) {
    if (state.sudoersBroken) return lines([
      "# /etc/sudoers",
      "root    ALL=(ALL)   ALL",
      "# line 28 — ERROR:",
      "%wheel  ALL=(ALL)   NOPASSWD ALl  ← 'ALl' should be 'ALL'",
      "# Also: chmod 777 was applied by mistake",
    ]);
    return lines(["root    ALL=(ALL) ALL","%wheel  ALL=(ALL) NOPASSWD: ALL"]);
  }
  if (cmd === "ls" && raw.includes("/etc/sudoers")) {
    if (state.sudoersBroken) return lines(["-rwxrwxrwx 1 root root 755  ← DANGEROUS! Must be -r--r----- (0440)"]);
    return lines(["-r--r----- 1 root root /etc/sudoers"]);
  }
  if (cmd === "chmod" && raw.includes("sudoers")) {
    if (state.sudoersBroken) {
      setState(s => ({ ...s, fixes: { ...s.fixes, sudochmod: true } }));
      return ok("Permissions fixed. But also resolve the syntax error with visudo.");
    }
  }

  // ── RAID ──────────────────────────────────────────────────────────────────
  if (cmd === "cat" && raw.includes("mdstat")) {
    if (state.raidDegraded) return lines([
      "Personalities : [raid1]",
      "md0 : active raid1 sda1[0]",
      "      104856832 blocks super 1.2 [2/1] [U_]  ← disk sdb1 MISSING",
      "",
      "# Array degraded — one disk has failed",
    ]);
    return lines(["md0 : active raid1 sda1[0] sdb1[1]","      104856832 blocks super 1.2 [2/2] [UU]  ← OK"]);
  }
  if (cmd === "mdadm") {
    if (raw.includes("--detail")) return state.raidDegraded ? lines([
      "        Array State : A_  ← degraded",
      "  Active Devices : 1",
      "Failed Devices : 1  (sdb1 removed/failed)",
      "State : clean, degraded",
    ]) : lines(["State : clean","Active Devices : 2","Failed Devices : 0"]);
    if (raw.includes("--add") && raw.includes("sdb")) {
      setState(s => ({ ...s, raidDegraded: false, fixes: { ...s.fixes, raid: true } }));
      return ok("mdadm: added /dev/sdb1\nRebuild in progress — monitor with: cat /proc/mdstat\nRecovery = 23.2% (24348416/104856832) finish=28.7min");
    }
    if (raw.includes("--manage") && raw.includes("--add")) {
      setState(s => ({ ...s, raidDegraded: false, fixes: { ...s.fixes, raid: true } }));
      return ok("mdadm: added device and started rebuild.");
    }
  }
  if (cmd === "smartctl") {
    if (state.raidDegraded && (raw.includes("sdb")||raw.includes("-a"))) return lines([
      "SMART overall-health self-assessment test result: FAILED!",
      "Drive failure expected in less than 24 hours. SAVE ALL DATA.",
      "Reallocated_Sector_Ct: 4096  (threshold: 5)  FAILING_NOW",
      "# sdb is dead — replace the physical disk then mdadm --add",
    ]);
    return lines(["SMART overall-health self-assessment test result: PASSED"]);
  }

  // ── LOGROTATE ─────────────────────────────────────────────────────────────
  if (cmd === "logrotate") {
    if (raw.includes("-d") || raw.includes("--debug")) {
      if (state.logrotBroken) return lines([
        "reading config file /etc/logrotate.conf",
        "reading config file /etc/logrotate.d/httpd",
        "error: /etc/logrotate.d/httpd:8 unknown option 'dailys'  ← typo error",
        "# ROOT CAUSE: 'dailys' should be 'daily'",
      ]);
      return lines(["rotating pattern: /var/log/httpd/*.log  after 1 days","rotating log /var/log/httpd/access_log"]);
    }
    if (raw.includes("-f") || raw.includes("--force")) {
      if (state.logrotBroken && !state.fixes?.logfix) return err("error: /etc/logrotate.d/httpd:8 unknown option 'dailys'");
      setState(s => ({ ...s, logrotBroken: false, fixes: { ...s.fixes, logrot: true } }));
      return ok("rotating log /var/log/httpd/access_log → access_log.1\nrotating log /var/log/nginx/access.log → access.log.1\nLogrotate completed successfully.");
    }
  }
  if (cmd === "cat" && raw.includes("logrotate.d")) {
    if (state.logrotBroken) return lines([
      "/var/log/httpd/*.log {",
      "    missingok",
      "    notifempty",
      "    dailys         ← TYPO ERROR — should be 'daily'",
      "    rotate 7",
      "    compress",
      "}",
    ]);
    return lines(["/var/log/httpd/*.log {","    daily","    rotate 7","    compress","}"]);
  }
  if ((cmd === "vi" || cmd === "nano" || cmd === "sed") && raw.includes("logrotate")) {
    if (state.logrotBroken) {
      setState(s => ({ ...s, fixes: { ...s.fixes, logfix: true } }));
      return ok("'dailys' corrected to 'daily'. Next: logrotate -f /etc/logrotate.conf");
    }
    return ok("File opened.");
  }

  // ── COMMON ────────────────────────────────────────────────────────────────
  if (cmd === "du") {
    if (state.diskFull)    return lines(["48G\t/var/log","# access_log not rotated"]);
    if (state.journalFull) return lines(["40G\t/var/log/journal","# journald has no size limit"]);
    if (state.lvmFull)     return lines(["98G\t/data/db","# database is filling /data"]);
    return lines(["2.1G\t/var/log","1.2G\t/var/www"]);
  }
  if (cmd === "pvs") return lines(["  PV       VG   Fmt  Attr PSize   PFree","  /dev/sdb  vg0  lvm2 a--  200.00g  "+(state.lvmFull&&!state.lvmExtended?"0":"98.00g")]);
  if (cmd === "vgs") return lines(["  VG  #PV #LV VSize   VFree","  vg0   1   2 200.00g  "+(state.lvmFull&&!state.lvmExtended?"0":"98.00g")]);
  if (cmd === "lvs") return lines(["  LV   VG  LSize","  data vg0  "+(state.lvmFull&&!state.lvmExtended?"100.00g":"150.00g")+"  /data","  root vg0   50.00g  /"]);
  if (cmd === "lvextend") {
    setState(s => ({ ...s, lvmExtended: true, fixes: { ...s.fixes, lvm: true } }));
    return ok("Size of logical volume vg0/data changed to 150.00 GiB.");
  }
  if (cmd === "xfs_growfs"||cmd === "resize2fs") {
    setState(s => ({ ...s, lvmFull: false }));
    return ok("Filesystem extended — /data now at 150G.");
  }
  if (cmd === "mount") {
    if (state.nfsHang && (raw.includes("nfs")||raw.includes("NFS"))) return err("mount.nfs: Connection timed out");
    if (raw.includes("-a")) return state.nfsHang ? err("mount.nfs: Connection timed out") : ok("All filesystems mounted.");
    return lines(["sysfs on /sys","proc on /proc"]);
  }
  if (cmd === "showmount") return state.nfsHang ? err("clnt_create: RPC: Port mapper failure") : lines(["Export list for 192.168.1.50:","/exports 192.168.1.0/24"]);
  if (cmd === "rpcinfo")   return state.nfsHang ? err("rpcinfo: can't contact portmapper") : lines(["100000  4  tcp  111  portmapper","100003  4  tcp  2049  nfs"]);
  if (raw.includes("umount") && raw.includes("-l")) { setState(s => ({ ...s, nfsHang: false, fixes: { ...s.fixes, nfs: true } })); return ok("Lazy umount completed."); }
  if (cmd === "nslookup"||cmd === "dig"||cmd === "host") {
    if (state.dnsBroken) return err(";; connection timed out; no servers could be reached");
    return lines([`${args[0]||"google.com"}\taddress: 142.250.180.46`]);
  }
  if (cmd === "cat" && raw.includes("named.conf")) {
    if (state.dnsBroken) return lines(['options {','  forwarders-ip { 8.8.8.8; };  ← ERROR: should be "forwarders"','};']);
    return lines(['options { forwarders { 8.8.8.8; }; };']);
  }
  if ((cmd==="vi"||cmd==="nano"||cmd==="sed") && raw.includes("named.conf")) {
    setState(s => ({ ...s, fixes: { ...s.fixes, dnsfix: true } }));
    return ok("named.conf corrected. Next: systemctl start named");
  }
  if (cmd === "named-checkconf") return state.dnsBroken&&!state.fixes?.dnsfix ? err("/etc/named.conf:14: unknown option 'forwarders-ip'") : ok("named.conf: OK");
  if (cmd === "lastb") return state.bruteForce ? lines(["root  185.234.12.45  Mon Mar  4 10:00","# 4800 entries — brute force attack"]) : lines(["No failed login attempts."]);
  if (cmd === "fail2ban-client") {
    if (raw.includes("status") && state.fail2banOn) return lines(["Banned IP list: 185.234.12.45 91.198.12.3"]);
    return err("fail2ban is not running");
  }
  if (cmd === "iptables" && raw.includes("DROP")) {
    setState(s => ({ ...s, fixes: { ...s.fixes, brute_ip: true } }));
    return ok("DROP rule added.");
  }
  if (cmd === "uname") return lines([`Linux server01 ${state.kernelBad?"5.15.0-206.153.7.el8uek":"5.15.0-200.130.1.el8uek"}.x86_64`]);
  if (cmd === "grubby") {
    if (raw.includes("--info")) return lines(["index=0  kernel=vmlinuz-5.15.0-206.153.7.el8uek  ← CURRENT (panicking)","index=1  kernel=vmlinuz-5.15.0-200.130.1.el8uek  ← STABLE"]);
    if (raw.includes("--set-default") && raw.includes("200.130")) {
      setState(s => ({ ...s, kernelBad: false, fixes: { ...s.fixes, kernel: true } }));
      return ok("Default kernel set: 5.15.0-200.130.1. Apply with: reboot");
    }
  }
  if (cmd === "rpm" && raw.includes("kernel")) return lines(["kernel-uek-5.15.0-206.153.7  ← recent (broken)","kernel-uek-5.15.0-200.130.1  ← previous (stable)"]);
  if (cmd === "date") return state.timeDesync ? lines(["Mon Mar  4 08:00:23 UTC 2024  ← WRONG"]) : lines([new Date().toUTCString()]);
  if (cmd === "timedatectl") return state.timeDesync
    ? lines(["Local time: Mon 2024-03-04 08:00:23 UTC","NTP active: no  ← PROBLEM","NTP synchronized: no"])
    : lines(["NTP active: yes","NTP synchronized: yes"]);
  if (cmd === "chronyc") {
    if (raw.includes("sources")) return state.timeDesync ? lines(["^? ntp1.example.com  Reach=0  ← no reachable NTP servers"]) : lines(["^* pool.ntp.org  +12ms"]);
    if (raw.includes("tracking")) return state.timeDesync ? lines(["System time: 7243.512345 seconds slow"]) : lines(["System time: 0.000012345 seconds fast"]);
  }
  if (cmd === "getenforce") return lines(["Enforcing"]);
  if (cmd === "ausearch") { if (!state.selinuxIssue) return ok("No AVC denials found."); return lines(["avc: denied { read } for httpd","  tcontext=user_home_t  ← WRONG context"]); }
  if (cmd === "ls" && raw.includes("-Z")) { if (state.selinuxIssue) return lines(["user_home_t  index.html  ← WRONG context"]); return lines(["httpd_sys_content_t  index.html"]); }
  if (cmd === "ls" && raw.includes("/var/lib/mysql")) { if (state.mysqlBroken) return lines(["drwxr-xr-x 2 root root mysql  ← must be mysql:mysql"]); return lines(["drwxr-xr-x 2 mysql mysql mysql"]); }
  if (cmd === "chcon" && raw.includes("httpd_sys_content_t")) { setState(s => ({ ...s, selinuxIssue: false, fixes: { ...s.fixes, selinux: true } })); return ok("Context updated. Run: systemctl restart httpd"); }
  if (cmd === "restorecon") { if (state.selinuxIssue) { setState(s => ({ ...s, selinuxIssue: false, fixes: { ...s.fixes, selinux: true } })); return ok("Context restored."); } return ok("No context to fix."); }
  if (cmd === "chown" && raw.includes("mysql") && raw.includes("/var/lib/mysql")) { setState(s => ({ ...s, mysqlBroken: false, fixes: { ...s.fixes, mysql: true } })); return ok("mysql:mysql permissions fixed. Next: systemctl start mysqld"); }
  if (cmd === "stat" && raw.includes("cron")) { return state.cronBroken ? lines(["Access: (0700/drwx------) Uid: (0/root)  ← must be 755"]) : lines(["Access: (0755/drwxr-xr-x)"]); }
  if (cmd === "chmod" && raw.includes("755") && raw.includes("cron")) { setState(s => ({ ...s, fixes: { ...s.fixes, cronfix: true } })); return ok("Permissions fixed. Next: systemctl restart crond"); }
  if (cmd === "crontab" && raw.includes("-l")) return lines(["0 2 * * * /opt/backup.sh"]);
  if (cmd === "ip") {
    if (raw.includes("route")||raw.split(" ").includes("r")) { if (state.networkDown) return lines(["192.168.1.0/24 dev eth0","# MISSING default gateway"]); return lines(["default via 192.168.1.1 dev eth0"]); }
    return lines(["2: eth0: inet 192.168.1.100/24"]);
  }
  if (cmd === "ping") { if (state.networkDown && !raw.includes("192.168.1")) return err("ping: connect: Network is unreachable"); return lines([`PING ${args[0]||"8.8.8.8"}: 3 packets, 0% packet loss`]); }
  if (cmd === "nmcli") {
    if (raw.includes("modify") && raw.includes("gw4")) { setState(s => ({ ...s, networkDown: false, fixes: { ...s.fixes, network: true } })); return ok("Gateway 192.168.1.1 configured."); }
    if (raw.includes("con") && raw.includes("up")) { setState(s => ({ ...s, networkDown: false })); return ok("Connection reactivated."); }
    return lines([state.networkDown?"eth0: connected (no gateway)":"eth0: connected  gw4 192.168.1.1"]);
  }
  if (cmd === "firewall-cmd") {
    if (raw.includes("--list")) return lines(["services: dhcpv6-client "+(state.sshBlocked?"":"ssh ")+"http https"]);
    if (raw.includes("--add-service=ssh")) { setState(s => ({ ...s, sshBlocked: false, fixes: { ...s.fixes, ssh: true } })); return ok("success"); }
    return ok("success");
  }
  if (cmd === "curl") {
    if (state.services.httpd !== "active") return err("curl: (7) Failed to connect to localhost port 80");
    if (state.selinuxIssue) return err("curl: (56) Connection reset by peer");
    if (raw.includes("https") && state.sslExpired && !state.sslRenewed) return err("curl: (60) SSL certificate problem: certificate has expired");
    return lines(["HTTP/1.1 200 OK","<html><body><h1>It works!</h1></body></html>"]);
  }
  if (cmd === "ps" || cmd === "top") {
    const zz = state.zombies ? ["root  8811  8800  Z  0:00 [defunct]","# 50 zombies with PPID 8800"] : [];
    if (state.cpuHog)        return lines(["root 4512 99.8% stress-ng --cpu 4",...zz]);
    if (state.swapExhausted) return lines(["tomcat 5511 94.2% java -jar app.jar",...zz]);
    return lines(["apache 901  0.3% /usr/sbin/httpd","mysql 1234  0.5% /usr/sbin/mysqld",...zz]);
  }
  if (cmd === "pstree") { if (state.zombies) return lines(["systemd─└─app_launcher(8800)─┬─[defunct](8811)","# kill -9 8800"]); return lines(["systemd─┬─sshd","        └─httpd"]); }
  if (cmd === "kill"||cmd === "killall") {
    if (state.cpuHog && (raw.includes("4512")||raw.includes("stress-ng"))) { setState(s => ({ ...s, cpuHog: null, fixes: { ...s.fixes, cpu: true } })); return ok("Process terminated. CPU back to normal."); }
    if (state.swapExhausted && (raw.includes("5511")||raw.includes("java"))) { setState(s => ({ ...s, swapExhausted: false, fixes: { ...s.fixes, swap: true } })); return ok("java terminated. RAM freed."); }
    if (state.zombies && raw.includes("8800")) { setState(s => ({ ...s, zombies: false, fixes: { ...s.fixes, zombie: true } })); return ok("Parent killed. 50 zombies removed."); }
    if (state.zombies) return warn("Zombies don't respond to signals — kill the parent (PID 8800).");
    return warn("Process not found.");
  }
  if (cmd === "free") { if (state.swapExhausted) return lines(["Mem: 7.7Gi  7.6Gi   12Mi  ← CRITICAL","Swap: 2.0Gi  2.0Gi    0B"]); return lines(["Mem: 7.7Gi  2.1Gi  3.8Gi","Swap: 2.0Gi    0B  2.0Gi"]); }
  if (cmd === "vmstat") { if (state.swapExhausted) return lines(["si=980 so=1020  ← heavy swap activity"]); return lines([" 0  0  0 3800000  0  0"]); }
  if (cmd === "find") {
    if (state.diskFull && raw.includes("/var/log")) return lines(["/var/log/httpd/access_log  48G"]);
    if (state.inodesFull && raw.includes("/tmp")) return warn("3,276,800 files in /tmp/sessions — orphaned PHP sessions\nUse: find /tmp -type f -delete");
    return lines(["/var/log/httpd/access_log  2.1M"]);
  }
  if (cmd === "truncate" && raw.includes("access_log")) { if (state.diskFull) { setState(s => ({ ...s, diskFull: false, fixes: { ...s.fixes, disk: true } })); return ok("48G freed."); } return warn("Disk is not full."); }
  if (cmd === "rm" && raw.includes("access_log")) { if (state.diskFull) { setState(s => ({ ...s, diskFull: false, fixes: { ...s.fixes, disk: true } })); return ok("48G freed."); } return warn("Not necessary."); }
  if (cmd === "uptime") {
    const lsKey = `winlab_lab_start_${state.scenario||'linux'}`;
    if (!localStorage.getItem(lsKey)) localStorage.setItem(lsKey, String(Date.now()));
    const elSec = Math.floor((Date.now() - parseInt(localStorage.getItem(lsKey), 10)) / 1000);
    const d = Math.floor(elSec / 86400);
    const h = Math.floor((elSec % 86400) / 3600);
    const m = Math.floor((elSec % 3600) / 60);
    const upStr = d > 0 ? `${d} day${d>1?'s':''}, ${h}:${String(m).padStart(2,'0')}` : `${h}:${String(m).padStart(2,'0')}`;
    const now = new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
    const load = state.cpuHog||state.swapExhausted?"3.98, 3.85":"0.12, 0.08";
    return lines([` ${now} up ${upStr},  1 user,  load average: ${load}`]);
  }
  if (cmd === "hostname") return lines(["server01.lab.local"]);
  if (cmd === "whoami")   return lines(["root"]);
  if (cmd === "cat" && raw.includes("os-release")) return lines(['NAME="Oracle Linux Server"','VERSION="8.9"']);
  if (cmd === "cat" && raw.includes("journald"))   return lines(["[Journal]","#SystemMaxUse=  ← no limit set"]);
  if (cmd === "clear") return [{ text: "__CLEAR__", type: "clear" }];
  if (cmd === "") return [];

  if (cmd === "hint") {
    const H = {
      webdown:    "journalctl -u httpd → OOM → restart httpd.",
      diskfull:   "df -h → du → truncate /var/log/httpd/access_log.",
      selinux:    "ausearch -m avc → chcon httpd_sys_content_t → restart.",
      highcpu:    "ps aux → kill 4512 (stress-ng).",
      sshfail:    "firewall-cmd --list-all → --add-service=ssh.",
      mysql:      "journalctl -u mysqld → chown -R mysql:mysql /var/lib/mysql → start.",
      swap:       "free -h → vmstat → kill 5511 (java).",
      cron:       "journalctl -u crond → stat /var/spool/cron → chmod 755 → restart.",
      network:    "ip route show → nmcli modify gw4 192.168.1.1.",
      zombie:     "pstree → kill -9 8800 (parent).",
      journal:    "journalctl --disk-usage → --vacuum-size=500M.",
      nfs:        "showmount -e / rpcinfo → umount -l the stuck mount.",
      lvm:        "pvs/vgs/lvs → lvextend -L +50G → xfs_growfs /data.",
      dnsfail:    "journalctl -u named → cat /etc/named.conf → fix 'forwarders-ip' → start.",
      sshbrute:   "lastb → journalctl -u sshd → systemctl start fail2ban.",
      kernpanic:  "grubby --info=ALL → --set-default with stable kernel → reboot.",
      timedesync: "timedatectl → systemctl start chronyd → chronyc sources.",
      ssl:        "openssl x509 -enddate → certbot renew OR openssl req → systemctl restart httpd.",
      inode:      "df -i → 100% inodes → find /tmp -type f -delete.",
      port:       "journalctl -u httpd → ss -tlpn → nginx on :80 → stop nginx → start httpd.",
      sudoers:    "cat /etc/sudoers → ls -la /etc/sudoers → visudo to fix syntax.",
      raid:       "cat /proc/mdstat → smartctl -a /dev/sdb → replace disk → mdadm --add.",
      logrotate:  "logrotate -d /etc/logrotate.conf → 'dailys' typo → fix to 'daily' → logrotate -f.",
      free:       "Explore: systemctl list-units, df -h, ps aux, free -h.",
    };
    return warn("💡 " + (H[state.scenario]||H.free));
  }

  if (cmd === "help") return lines([
    "━━ Systemd & Log ━━",
    "  systemctl status|start|stop|restart|list-units <svc>",
    "  journalctl -u <svc> | -xe | -p err | --disk-usage | --vacuum-size=500M",
    "━━ Storage ━━",
    "  df -h | df -i (inode) | du -sh /* | find /tmp -type f -delete",
    "  pvs | vgs | lvs | lvextend -L +50G /dev/vg0/data | xfs_growfs /data",
    "  cat /proc/mdstat | mdadm --detail /dev/md0 | mdadm --add /dev/md0 /dev/sdb1",
    "  smartctl -a /dev/sdb",
    "━━ SSL ━━",
    "  openssl x509 -enddate -in /etc/pki/tls/certs/server.crt -noout",
    "  certbot renew | certbot certificates | openssl req -newkey ...",
    "━━ Logrotate ━━",
    "  logrotate -d /etc/logrotate.conf | logrotate -f /etc/logrotate.conf",
    "  cat /etc/logrotate.d/httpd | vi /etc/logrotate.d/httpd",
    "━━ Processes ━━",
    "  ps aux | pstree | top | free -h | vmstat 1 3 | kill <PID>",
    "━━ Network ━━",
    "  ip route show | nmcli | ping | ss -tlpn | lsof -i :80",
    "  nslookup | named-checkconf | cat /etc/named.conf",
    "  showmount -e <host> | rpcinfo -p | umount -l /mnt/nfs",
    "━━ Security ━━",
    "  ausearch -m avc | chcon | restorecon",
    "  lastb | fail2ban-client status sshd | iptables -A INPUT -s IP -j DROP",
    "  ls -la /etc/sudoers | visudo | cat /etc/sudoers",
    "━━ Kernel / Time ━━",
    "  grubby --info=ALL | grubby --set-default <path>",
    "  date | timedatectl | chronyc sources | chronyc tracking",
    "  hint — get a hint | clear — clear screen",
  ]);

  return err(`-bash: ${cmd}: command not found`);
}

export default function App({ region = "US", labProgress = { completed: 0, total: 3 } }) {
  const [scenario, setScenario] = useState(null);
  const [termState, setTermState] = useState(null);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [cmdHist, setCmdHist] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [showHint, setShowHint] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [solvedAt, setSolvedAt] = useState(null);
  const [instanceId] = useState(genInstanceId);
  const [idleDelay, setIdleDelay] = useState(false);
  const [cwd, setCwd] = useState('/root');
  const lastActivityRef = useRef(Date.now());
  const bottomRef = useRef();
  const inputRef  = useRef();
  const inactivityTimer = useRef(null);
  const hintTimeout = useRef(null);

  // Idle session simulation — flags first keystroke after 30s of inactivity
  useEffect(() => {
    const iv = setInterval(() => {
      if (Date.now() - lastActivityRef.current > 30000) setIdleDelay(true);
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  // Telemetry
  const scenarioId = scenario?.id || null;
  const { startSession, endSession, recordCommand, recordHint } = useLabTelemetry(
    scenarioId,
    null, // userId — will be populated when user is logged in
    "linux-terminal"
  );

  // Realism background worker
  const [auditResult, setAuditResult] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const workerRef = useRef(null);

  useEffect(() => {
    if (scenario && !termState?.solved) {
      // Start background realism worker
      workerRef.current = getRealismWorker({
        chaosIntensity: 0.15,
        chaosIntervalMs: 15000,
        userSkill: "mid",
        onAudit: (result) => setAuditResult(result),
        onAnomaly: (a) => setAnomalies((prev) => [...prev, a].slice(-10)),
        onChaosEvent: () => {},
      });
      // Worker will audit periodically — env is simulated via termState
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.stop();
      }
    };
  }, [scenario?.id, termState?.solved]);

  // Reset inactivity timer on user input
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (hintTimeout.current) clearTimeout(hintTimeout.current);
    setShowHint(false);

    if (scenario && !termState?.solved) {
      inactivityTimer.current = setTimeout(() => {
        setShowHint(true);
        hintTimeout.current = setTimeout(() => {
          setShowHint(false);
        }, 8000);
      }, 5000); // Show hint after 5s of inactivity
    }
  }, [scenario, termState?.solved]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);

  // Inactivity timer for guided hints
  useEffect(() => {
    if (scenario && !termState?.solved) {
      inactivityTimer.current = setTimeout(() => {
        setShowHint(true);
        hintTimeout.current = setTimeout(() => setShowHint(false), 8000);
      }, 5000);
      return () => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        if (hintTimeout.current) clearTimeout(hintTimeout.current);
      };
    }
  }, [scenario, termState?.solved, history]);

  function startScenario(s) {
    setScenario(s);
    setTermState(makeState(s.id));
    setShowHint(false);
    setShowPaywall(false);
    setSolvedAt(null);

    // Persistent uptime — set only on first visit, survives browser close
    const lsKey = `winlab_lab_start_${s.id}`;
    if (!localStorage.getItem(lsKey)) localStorage.setItem(lsKey, String(Date.now()));
    setCwd('/root');

    // Start telemetry session
    startSession();

    // Simulated connection latency for realism
    const intro = {
      webdown:    "⚠  ALERT: site unreachable. Users reporting timeouts.",
      diskfull:   "⚠  ALERT: /dev/mapper/ol-root at 100%. Writes blocked.",
      selinux:    "⚠  ALERT: httpd responds but files return 403 Forbidden.",
      highcpu:    "⚠  ALERT: load average 3.98. Server unresponsive.",
      sshfail:    "⚠  ALERT: SSH not accepting connections from outside.",
      mysql:      "⚠  ALERT: database down after update. Apps are down.",
      swap:       "⚠  ALERT: OOM killer active. RAM exhausted.",
      cron:       "⚠  ALERT: nightly backup hasn't run in 3 weeks.",
      network:    "⚠  ALERT: server cannot reach the internet.",
      zombie:     "⚠  ALERT: 50 processes in Z state. System degraded.",
      journal:    "⚠  ALERT: /var/log/journal consuming 40G.",
      nfs:        "⚠  ALERT: NFS mount stuck. Processes hanging in I/O wait.",
      lvm:        "⚠  ALERT: /data at 100%. Database cannot write.",
      dnsfail:    "⚠  ALERT: DNS down. Hostnames not resolving.",
      sshbrute:   "⚠  ALERT: IDS reports 4800 SSH attempts in 2 hours.",
      kernpanic:  "⚠  ALERT: kernel panic at boot after update.",
      timedesync: "⚠  ALERT: TLS certificates rejected — clock is 2 hours behind.",
      ssl:        "⚠  ALERT: HTTPS down — SSL certificate expired. Site unreachable.",
      inode:      "⚠  ALERT: cannot create files — 'No space left' but df shows 36% used.",
      port:       "⚠  ALERT: Apache won't start after deploy. Port 80 conflict.",
      sudoers:    "⚠  ALERT: sudo is broken on all hosts. No privileged access.",
      raid:       "⚠  ALERT: RAID array md0 in DEGRADED state. Disk failed.",
      logrotate:  "⚠  ALERT: logs haven't rotated in weeks. Disk filling up.",
      free:       "Free shell on Oracle Linux 8. Type 'help' for commands.",
    }[s.id] || "Shell ready.";

    setHistory([
      { text: "Connecting to server...", type: "info" },
    ]);

    // Simulated latency for realism
    setTimeout(() => {
      setHistory([
        { text: `SSH session established → ${instanceId} (Oracle Linux 8.9)`, type: "ok" },
        { text: intro, type: s.id === "free" ? "ok" : "warn" },
        { text: "Type 'help' for commands, 'hint' for a nudge.", type: "info" },
      ]);
    }, 600 + Math.random() * 400);

    setCmdHist([]); setHistIdx(-1);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function submit() { if (input.trim()) { submit_val(input.trim()); setInput(""); } }
  function submit_val(val) {
    const cmd = val;
    const startTime = Date.now();
    setCmdHist(h => [cmd, ...h].slice(0, 50));
    setHistIdx(-1);

    const prompt = `[root@${instanceId} ${promptDir(cwd)}]$`;

    // ── history (pre-bash) ────────────────────────────────────────────────
    if (cmd === "history") {
      const now = Date.now();
      const histLines = cmdHist.slice().reverse().slice(0, 20).reverse().map((c, i) => ({
        text: `${String(i+1).padStart(4)}  ${new Date(now-(cmdHist.length-i)*37000).toISOString().slice(0,19).replace("T"," ")}  ${c}`,
        type: "out",
      }));
      setHistory(h => [...h, { text: `${prompt} ${cmd}`, type: "prompt" }, ...histLines]);
      return;
    }

    // ── /proc special files ───────────────────────────────────────────────
    const [cmdName, ...cmdArgs] = cmd.split(/\s+/);
    if (cmdName === "cat" && PROC_FILES[cmdArgs[0]]) {
      const procLines = PROC_FILES[cmdArgs[0]].map(l => ({ text: l, type: "out" }));
      setHistory(h => [...h, { text: `${prompt} ${cmd}`, type: "prompt" }, ...procLines]);
      return;
    }

    // ── bash engine (cd, ls, pipes, &&, date, echo, pwd …) ───────────────
    const { out, newCwd, clear: doClear, exit: doExit } = runBashLayer(cmd, cwd, instanceId, (raw) => {
      if (raw === "dmesg" || raw.startsWith("dmesg ")) {
        const T = n => `[${n.toFixed(6).padStart(12)}]`;
        return [
          { text: `${T(0.000000)} Linux version 5.15.0-101-generic (buildd@lcy02-amd64-046)`, type:"out" },
          { text: `${T(1.102938)} Spectre V2 : Mitigation: Retpolines`, type:"warn" },
          { text: `${T(2.456789)} scsi host0: virtio_scsi`, type:"out" },
          { text: `${T(2.890123)} eth0: hyperv_netvsc: adapter sn: 00155d01-a2b3-c4d5`, type:"out" },
          { text: `${T(5.876543)} systemd[1]: Set hostname to <${instanceId}>.`, type:"out" },
        ];
      }
      return runCommand(raw, termState, setTermState);
    });

    if (newCwd !== cwd) setCwd(newCwd);

    const durationMs = Date.now() - startTime;
    if (doClear) { setHistory([]); return; }
    setHistory(h => [...h, { text: `${prompt} ${cmd}`, type: "prompt" }, ...out]);

    // Record command telemetry
    const exitCode = out.some(o => o.type === "err") ? 1 : 0;
    const stdoutLength = out.filter(o => o.type !== "err").reduce((sum, o) => sum + (o.text?.length || 0), 0);
    const stderrLength = out.filter(o => o.type === "err").reduce((sum, o) => sum + (o.text?.length || 0), 0);

    recordCommand({
      raw: cmd,
      cmd: cmdName,
      args: cmdArgs,
      exitCode,
      durationMs,
      stdoutLength,
      stderrLength,
      serviceStates: termState?.services || {},
      logCount: 0,
      newLogs: 0,
    });

    setInput("");
    setTimeout(() => {
      setTermState(st => {
        if (st?.solved) return st;
        const solved =
          (st.scenario==="webdown"    && st.services.httpd==="active") ||
          (st.scenario==="diskfull"   && !st.diskFull) ||
          (st.scenario==="selinux"    && !st.selinuxIssue && st.services.httpd==="active") ||
          (st.scenario==="highcpu"    && !st.cpuHog) ||
          (st.scenario==="sshfail"    && !st.sshBlocked) ||
          (st.scenario==="mysql"      && !st.mysqlBroken && st.services.mysqld==="active") ||
          (st.scenario==="swap"       && !st.swapExhausted) ||
          (st.scenario==="cron"       && !st.cronBroken && st.services.crond==="active") ||
          (st.scenario==="network"    && !st.networkDown) ||
          (st.scenario==="zombie"     && !st.zombies) ||
          (st.scenario==="journal"    && !st.journalFull) ||
          (st.scenario==="nfs"        && !st.nfsHang) ||
          (st.scenario==="lvm"        && !st.lvmFull) ||
          (st.scenario==="dnsfail"    && !st.dnsBroken) ||
          (st.scenario==="sshbrute"   && st.fail2banOn) ||
          (st.scenario==="kernpanic"  && !st.kernelBad) ||
          (st.scenario==="timedesync" && !st.timeDesync) ||
          (st.scenario==="ssl"        && !st.sslExpired) ||
          (st.scenario==="inode"      && !st.inodesFull) ||
          (st.scenario==="port"       && !st.portConflict && st.services.httpd==="active") ||
          (st.scenario==="sudoers"    && st.sudoersFixed) ||
          (st.scenario==="raid"       && !st.raidDegraded) ||
          (st.scenario==="logrotate"  && !st.logrotBroken);
        if (solved) {
          setHistory(h => [...h, { text: "✅  SCENARIO SOLVED! System restored successfully.", type: "ok" }]);
          setSolvedAt(Date.now());
          endSession(true);
          return { ...st, solved: true };
        }
        return st;
      });
    }, 200);
  }

  function handleKey(e) {
    lastActivityRef.current = Date.now();

    // Ctrl+C — interrupt current input
    if (e.ctrlKey && e.key === "c") {
      e.preventDefault();
      setHistory(h => [...h, { text: `[root@${instanceId} ${promptDir(cwd)}]$ ${input}^C`, type: "prompt" }]);
      setInput("");
      return;
    }

    if (e.key === "Enter") {
      if (!input.trim()) return;
      // Idle wake-up: simulate SSH session re-activating
      if (idleDelay) {
        setIdleDelay(false);
        const val = input.trim();
        setInput("");
        setTimeout(() => submit_val(val), 280 + Math.random() * 120);
        return;
      }
      submit();
      return;
    }
    if (e.key === "ArrowUp")   { e.preventDefault(); const i=Math.min(histIdx+1,cmdHist.length-1); setHistIdx(i); setInput(cmdHist[i]||""); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); const i=Math.max(histIdx-1,-1); setHistIdx(i); setInput(i===-1?"":cmdHist[i]||""); return; }
    if (e.key === "Tab") {
      e.preventDefault();
      const { completed, suggestions } = tabComplete(input, cwd);
      if (suggestions.length > 1) {
        setHistory(h => [...h,
          { text: `[root@${instanceId} ${promptDir(cwd)}]$ ${input}`, type: "prompt" },
          { text: suggestions.join("  "), type: "out" },
        ]);
      }
      setInput(completed);
    }
  }

  const col = { out:"#b8d0c8", err:"#e06060", ok:"#4caf84", warn:"#ffaa00", prompt:"#6ab0f5", info:"#7788aa" };
  const catColor = { base:"#4caf84", adv:"#ffaa00", exp:"#e06060", nm:"#cc55ff" };
  const catLabel = { base:"── Base ──", adv:"── Advanced ──", exp:"── Expert ──", nm:"── Nightmare ──" };
  const catBg    = { base:"#0b1218", adv:"#0d1018", exp:"#100a0a", nm:"#0d0a12" };
  const catBorder= { base:"#1a2530", adv:"#2a2010", exp:"#2a1010", nm:"#2a1040" };

  if (!scenario) return (
    <div style={{ minHeight:"100vh", background:"#060a0f", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", fontFamily:"monospace", padding:"32px 16px" }}>
      <div style={{ color:"#4caf84", fontSize:11, letterSpacing:4, marginBottom:6, textTransform:"uppercase" }}>Linux Troubleshooting Lab</div>
      <div style={{ color:"#c8ddd0", fontSize:22, fontWeight:900, marginBottom:4 }}>Choose a scenario</div>
      <div style={{ color:"#445", fontSize:12, marginBottom:28 }}>6 free · 18 locked — upgrade to unlock all tracks</div>
      <div style={{ width:"100%", maxWidth:980 }}>

        {/* ── FREE: Base scenarios ── */}
        <div style={{ marginBottom:28 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <div style={{ color:"#4caf84", fontSize:10, letterSpacing:3, textTransform:"uppercase" }}>── Free ──</div>
            <span style={{ background:"rgba(34,197,94,.1)", border:"1px solid rgba(34,197,94,.25)", color:"#4caf84", fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:100, letterSpacing:.5 }}>NO SIGNUP</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8 }}>
            {SCENARIOS.filter(s=>s.cat==="base").map(s => (
              <button key={s.id} onClick={() => startScenario(s)}
                style={{ background:"#0b1218", border:"1px solid #1a2530", borderRadius:8, padding:"12px 14px", cursor:"pointer", textAlign:"left", fontFamily:"monospace", transition:"all 0.15s" }}
                onMouseOver={e => { e.currentTarget.style.borderColor="#4caf84"; e.currentTarget.style.background="#0d1a14"; }}
                onMouseOut={e => { e.currentTarget.style.borderColor="#1a2530"; e.currentTarget.style.background="#0b1218"; }}>
                <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
                <div style={{ color:"#cde", fontWeight:700, fontSize:12, marginBottom:2 }}>{s.label}</div>
                <div style={{ color:"#557", fontSize:10 }}>{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── LOCKED: Advanced / Expert / Nightmare ── */}
        <div style={{ marginBottom:28 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <div style={{ color:"#445", fontSize:10, letterSpacing:3, textTransform:"uppercase" }}>── Locked ──</div>
            <span style={{ background:"rgba(251,146,60,.08)", border:"1px solid rgba(251,146,60,.2)", color:"#fb923c", fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:100, letterSpacing:.5 }}>$5/mo</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8 }}>
            {SCENARIOS.filter(s=>s.cat!=="base").map(s => (
              <div key={s.id}
                style={{ background:"#080b0e", border:"1px solid #111820", borderRadius:8, padding:"12px 14px", textAlign:"left", fontFamily:"monospace", opacity:.55, position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", top:8, right:8, fontSize:11 }}>🔒</div>
                <div style={{ fontSize:20, marginBottom:4, filter:"grayscale(1)" }}>{s.icon}</div>
                <div style={{ color:"#556", fontWeight:700, fontSize:12, marginBottom:2 }}>{s.label}</div>
                <div style={{ color:"#334", fontSize:10 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── PREMIUM TRACKS: Jamf + Intune ── */}
        <div>
          <div style={{ color:"#445", fontSize:10, letterSpacing:3, textTransform:"uppercase", marginBottom:10 }}>── Premium Tracks ──</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:10 }}>

            {/* Jamf */}
            <div style={{ background:"linear-gradient(135deg,rgba(251,146,60,.07),#0a0e12)", border:"1px solid rgba(251,146,60,.3)", borderRadius:10, padding:"16px", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:10, right:10, background:"rgba(251,146,60,.15)", color:"#fb923c", fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:100, border:"1px solid rgba(251,146,60,.3)" }}>HOT</div>
              <div style={{ fontSize:24, marginBottom:8 }}>🍎</div>
              <div style={{ color:"#e8d5c0", fontWeight:800, fontSize:13, marginBottom:4 }}>Jamf Pro MDM</div>
              <div style={{ color:"#664433", fontSize:11, lineHeight:1.5, marginBottom:10 }}>Enroll devices, deploy policies, manage compliance. The #1 Apple MDM in enterprise.</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10 }}>
                {["Enrollment","Policies","Smart Groups","Scripts"].map(t => (
                  <span key={t} style={{ background:"rgba(251,146,60,.08)", border:"1px solid rgba(251,146,60,.15)", color:"#996633", fontSize:9, padding:"2px 7px", borderRadius:4 }}>{t}</span>
                ))}
              </div>
              <div style={{ color:"#fb923c", fontSize:10, fontWeight:600 }}>6 labs · Intermediate → Advanced · 🔒 $5/mo</div>
            </div>

            {/* Intune */}
            <div style={{ background:"linear-gradient(135deg,rgba(59,130,246,.07),#0a0e12)", border:"1px solid rgba(59,130,246,.3)", borderRadius:10, padding:"16px", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:10, right:10, background:"rgba(59,130,246,.15)", color:"#60a5fa", fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:100, border:"1px solid rgba(59,130,246,.3)" }}>HOT</div>
              <div style={{ fontSize:24, marginBottom:8 }}>🪟</div>
              <div style={{ color:"#c8d8f0", fontWeight:800, fontSize:13, marginBottom:4 }}>Microsoft Intune</div>
              <div style={{ color:"#334466", fontSize:11, lineHeight:1.5, marginBottom:10 }}>Manage Windows, macOS and mobile devices across hybrid environments with Entra ID.</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10 }}>
                {["Entra ID","Compliance","Autopilot","RBAC"].map(t => (
                  <span key={t} style={{ background:"rgba(59,130,246,.08)", border:"1px solid rgba(59,130,246,.15)", color:"#336699", fontSize:9, padding:"2px 7px", borderRadius:4 }}>{t}</span>
                ))}
              </div>
              <div style={{ color:"#60a5fa", fontSize:10, fontWeight:600 }}>5 labs · Intermediate → Advanced · 🔒 $5/mo</div>
            </div>

          </div>
        </div>

        {/* Upgrade CTA */}
        <div style={{ textAlign:"center", marginTop:32, paddingTop:24, borderTop:"1px solid #111820" }}>
          <a href="/#cta" style={{ background:"#22c55e", color:"#000", fontWeight:800, fontSize:13, padding:"11px 28px", borderRadius:7, textDecoration:"none", display:"inline-block" }}>
            Unlock all 24 labs — $5/mo forever →
          </a>
          <div style={{ color:"#334", fontSize:10, marginTop:8 }}>First 6 labs always free · No credit card required</div>
        </div>

      </div>
    </div>
  );

  return (
    <div style={{ height:"100vh", background:"#060a0f", display:"flex", flexDirection:"column", fontFamily:"'Fira Code','JetBrains Mono',monospace" }}>
      <div style={{ background:"#0a0f14", borderBottom:"1px solid #1a2530", padding:"8px 16px", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ display:"flex", gap:6 }}>
          {["#ff5f57","#febc2e","#28c840"].map(c=><div key={c} style={{ width:10,height:10,borderRadius:"50%",background:c }}/>)}
        </div>
        <span style={{ color:"#4caf84", fontSize:12, marginLeft:6 }}>root@{instanceId}</span>
        <span style={{ color:"#335", fontSize:12 }}>~ Oracle Linux 8</span>
        <span style={{ marginLeft:"auto", fontSize:11, color:catColor[scenario.cat] }}>{scenario.icon} {scenario.label}</span>
        {termState?.solved && <span style={{ fontSize:10, background:"#1a3520", color:"#4caf84", padding:"2px 8px", borderRadius:4 }}>✅ SOLVED</span>}
        {auditResult && <span style={{ fontSize:9, background:auditResult.metaScore > 0.7 ? "#1a3520" : "#352020", color:auditResult.metaScore > 0.7 ? "#4caf84" : "#e06060", padding:"1px 6px", borderRadius:3 }} title={`Realism Score: ${(auditResult.metaScore * 100).toFixed(0)}%`}>🛡️ {(auditResult.metaScore * 100).toFixed(0)}%</span>}
        <span style={{ fontSize:9, background:"#1a2530", color:"#557", padding:"1px 6px", borderRadius:3 }} title="Telemetry active">📊</span>
        <button onClick={()=>{
          if (scenario && !termState?.solved) endSession(false);
          setScenario(null);setTermState(null);setHistory([]);
        }}
          style={{ padding:"3px 10px",background:"#1a2530",border:"1px solid #2a3540",borderRadius:4,color:"#668",cursor:"pointer",fontSize:11 }}>← Scenarios</button>
      </div>
      <div onClick={()=>inputRef.current?.focus()} style={{ flex:1,overflowY:"auto",padding:"14px 18px",cursor:"text" }}>
        {history.map((line,i)=>(
          <div key={i} style={{ color:col[line.type]||"#b8d0c8",fontSize:12.5,lineHeight:1.65,whiteSpace:"pre-wrap",wordBreak:"break-all" }}>
            {line.text}
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>
      <div style={{ borderTop:"1px solid #1a2530",padding:"10px 18px",display:"flex",alignItems:"center",gap:8,background:"#080d12" }}>
        <span style={{ color:"#4caf84",fontSize:12.5,whiteSpace:"nowrap" }}>{`[root@${instanceId} ${promptDir(cwd)}]$`}</span>
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
          autoFocus spellCheck={false} autoComplete="off"
          style={{ flex:1,background:"none",border:"none",outline:"none",color:"#ddeedd",fontFamily:"inherit",fontSize:13,caretColor:"#4caf84" }}
          placeholder="type a command..."/>
      </div>
    </div>
  );
}
