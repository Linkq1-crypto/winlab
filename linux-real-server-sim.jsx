import { useState, useRef, useEffect } from "react";
import { useLabTelemetry } from "./src/hooks/useLabTelemetry";
import { getRealismWorker, destroyRealismWorker } from "./src/hooks/realism-worker";

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
    "model name\t: Intel(R) Xeon(R) Gold 6148 CPU @ 2.40GHz",
    "cpu MHz\t\t: 2399.926",
    "cache size\t: 28160 KB",
    "cpu cores\t: 2",
    "flags\t\t: fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov",
    "bogomips\t: 4799.85",
  ],
  "/proc/meminfo": [
    "MemTotal:        8192000 kB",
    "MemFree:          412340 kB",
    "MemAvailable:    1823400 kB",
    "Buffers:          182400 kB",
    "Cached:          1624188 kB",
    "SwapTotal:       2097148 kB",
    "SwapFree:        1834240 kB",
  ],
  "/proc/version": [
    "Linux version 5.15.0-206.153.7.el8uek.x86_64 (mockbuild@oraclelinux) (gcc 8.5.0) #2 SMP",
  ],
  "/proc/uptime": ["347214.82 1243812.44"],
};

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────
const SCENARIOS = [
  { id: "iowait",    label: "High I/O Wait",           desc: "iostat 98% — disk saturated, apps stalled",        icon: "💿", cat: "storage" },
  { id: "apachewrk", label: "Apache workers exhausted",desc: "MaxRequestWorkers reached — server under load",     icon: "🕸", cat: "web"     },
  { id: "mysqlslow", label: "MySQL slow queries",      desc: "DB very slow — queries stuck in SHOW PROCESSLIST",  icon: "🐢", cat: "db"      },
  { id: "netflap",   label: "NIC flapping",            desc: "eth0 going up and down — dmesg shows link errors",  icon: "🔌", cat: "net"     },
  { id: "timewait",  label: "TIME_WAIT flood",         desc: "Port exhaustion — 28k TIME_WAIT connections",       icon: "⏳", cat: "net"     },
  { id: "tcpdump",   label: "Anomalous traffic",       desc: "tcpdump to identify a suspicious outbound connection", icon: "🦈", cat: "net"  },
  { id: "strace",    label: "Hung process",            desc: "Process stuck — strace reveals the cause",          icon: "🔬", cat: "debug"   },
  { id: "coredump",  label: "Core dump crash",         desc: "App crashing — analysis with gdb/coredump",         icon: "💣", cat: "debug"   },
  { id: "syslogflood", label: "Syslog flood",          desc: "Syslog overwhelmed — 50k msg/sec from one process", icon: "📡", cat: "log"     },
  { id: "fsck",      label: "Corrupted filesystem",    desc: "EXT4 errors — filesystem needs repair with fsck",   icon: "🔧", cat: "storage" },
  { id: "oomkiller", label: "Selective OOM killer",    desc: "Java heap leak — OOM killing the wrong process",    icon: "🩸", cat: "memory"  },
  { id: "infoblox",  label: "Infoblox DNS timeout",    desc: "Sites not resolving — Infoblox DHCP/DNS down",      icon: "🏛", cat: "net"     },
];

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────
const makeState = (id) => ({
  scenario: id,
  iowaitFixed:     false,
  apacheFixed:     false,
  mysqlFixed:      false,
  netflapFixed:    false,
  timewaitFixed:   false,
  tcpdumpFound:    false,
  straceFound:     false,
  coredumpFixed:   false,
  syslogFixed:     false,
  fsckDone:        false,
  oomFixed:        false,
  infobloxFixed:   false,
  solved:          false,
});

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND ENGINE
// ─────────────────────────────────────────────────────────────────────────────
function runCommand(raw, state, setState) {
  const parts = raw.trim().split(/\s+/);
  const cmd   = parts[0];

  const lines = (arr) => arr.map(t => ({ text: t, type: "out" }));
  const err   = (t)   => [{ text: t, type: "err"  }];
  const ok    = (t)   => [{ text: t, type: "ok"   }];
  const warn  = (t)   => [{ text: t, type: "warn" }];
  const dim   = (t)   => [{ text: t, type: "dim"  }];

  const s = state.scenario;

  // ── uptime ────────────────────────────────────────────────────────────────
  if (cmd === "uptime") {
    const lsKey = `winlab_lab_start_${s}`;
    if (!localStorage.getItem(lsKey)) localStorage.setItem(lsKey, String(Date.now()));
    const elSec = Math.floor((Date.now() - parseInt(localStorage.getItem(lsKey), 10)) / 1000);
    const d = Math.floor(elSec / 86400);
    const h = Math.floor((elSec % 86400) / 3600);
    const m = Math.floor((elSec % 3600) / 60);
    const upStr = d > 0 ? `${d} day${d>1?'s':''}, ${h}:${String(m).padStart(2,'0')}` : `${h}:${String(m).padStart(2,'0')}`;
    const load = s==="iowait"?"12.44, 11.98, 10.21":s==="apachewrk"?"8.32, 7.80, 6.50":s==="oomkiller"?"6.10, 5.88, 5.21":"0.32, 0.28, 0.22";
    const now = new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
    return lines([` ${now} up ${upStr},  1 user,  load average: ${load}`]);
  }

  // ── iostat ────────────────────────────────────────────────────────────────
  if (cmd === "iostat") {
    if (s === "iowait") return lines([
      "Linux 5.15.0-206.153.7.el8uek.x86_64   03/04/2026   _x86_64_   (8 CPU)",
      "",
      "avg-cpu:  %user   %nice %system %iowait  %steal   %idle",
      "           3.12    0.00    1.88   92.45    0.00    2.55  ← I/O WAIT CRITICAL",
      "",
      "Device            r/s     w/s     rkB/s   wkB/s  await  %util",
      "sda              0.10  1842.33      1.2 921166.0  498.3   98.7%  ← SATURATED",
      "sdb              0.08     0.12      0.8      0.6    1.2    0.1%",
      "dm-0             0.10  1842.33      1.2 921166.0  498.3   98.7%",
    ]);
    return lines([
      "avg-cpu: %user %nice %system %iowait %steal %idle",
      "          2.10  0.00    1.20    0.80   0.00  95.90",
      "",
      "Device   r/s   w/s   rkB/s  wkB/s  await  %util",
      "sda     12.40  8.20  498.0  328.0    1.2    3.1%",
    ]);
  }

  // ── iotop ─────────────────────────────────────────────────────────────────
  if (cmd === "iotop") {
    if (s === "iowait") return lines([
      "Total DISK READ: 1.2 K/s  |  Total DISK WRITE: 900.0 M/s",
      "  TID  PRIO  USER   DISK READ   DISK WRITE   COMMAND",
      " 4821  be/4  mysql       0 B/s  898.4 M/s    mysqld --skip-networking ← WRITING 900MB/s",
      " 4822  be/4  mysql       0 B/s    1.6 M/s    mysqld (innodb flush thread)",
      "  892  be/4  root        0 B/s    0.0 B/s    sshd",
      "# ROOT CAUSE: InnoDB flush thread writing uncontrollably",
    ]);
    return lines(["No excessive I/O detected."]);
  }

  // ── lsof (iowait) ─────────────────────────────────────────────────────────
  if (cmd === "lsof" && raw.includes("+D") && raw.includes("mysql")) {
    if (s === "iowait") return lines([
      "COMMAND   PID  USER  FD  TYPE  DEVICE    SIZE/OFF     NODE NAME",
      "mysqld   4821 mysql  12u  REG  253,0  1099511627776  12345 /var/lib/mysql/ibdata1",
      "mysqld   4821 mysql  13u  REG  253,0   549755813888  12346 /var/lib/mysql/ib_logfile0",
      "# ibdata1 is 1TB — uncontrolled growth, innodb_file_per_table=OFF",
    ]);
  }

  // ── my.cnf / mysql config ─────────────────────────────────────────────────
  if (cmd === "cat" && raw.includes("my.cnf")) {
    if (s === "iowait") return lines([
      "[mysqld]",
      "innodb_file_per_table = 0          ← every table writes to single ibdata1",
      "innodb_flush_log_at_trx_commit = 1  ← flush on every commit → maximum I/O",
      "innodb_flush_method = fsync",
      "# FIX: innodb_flush_log_at_trx_commit=2 and innodb_io_capacity=200",
    ]);
  }
  if ((cmd === "vi" || cmd === "nano") && raw.includes("my.cnf")) {
    if (s === "iowait") {
      setState(st => ({ ...st, iowaitFixed: true }));
      return ok("my.cnf updated: innodb_flush_log_at_trx_commit=2, innodb_io_capacity=200\nNow: systemctl restart mysqld");
    }
  }

  // ── apache status / workers ───────────────────────────────────────────────
  if (cmd === "curl" && (raw.includes("server-status") || raw.includes("mod_status"))) {
    if (s === "apachewrk") return lines([
      "Apache Server Status for localhost",
      "Server Version: Apache/2.4.57 (Oracle Linux) OpenSSL/3.0.7",
      "Current Time: Mon, 04 Mar 2026 11:03:14 GMT",
      "Total Accesses: 8492341   Total kBytes: 142849221",
      "CPULoad: 3.88  Uptime: 3600  ReqPerSec: 2358  BytesPerSec: 40728",
      "",
      "Scoreboard Key: '_'=Waiting 'S'=Starting 'R'=Reading 'W'=Sending 'K'=Keepalive",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
      "# ALL 256 workers in W state (Sending) — MaxRequestWorkers reached",
      "# New requests queuing — 503 errors for users",
    ]);
    return lines(["_W_WR___WW_W_R  8 workers active, 248 idle"]);
  }
  if (cmd === "cat" && raw.includes("httpd.conf")) {
    if (s === "apachewrk") return lines([
      "# /etc/httpd/conf/httpd.conf",
      "<IfModule mpm_prefork_module>",
      "    StartServers          5",
      "    MinSpareServers       5",
      "    MaxSpareServers      20",
      "    MaxRequestWorkers   256  ← REACHED — increase or switch to event MPM",
      "    MaxConnectionsPerChild 0",
      "</IfModule>",
    ]);
  }
  if ((cmd === "vi" || cmd === "nano") && raw.includes("httpd.conf")) {
    if (s === "apachewrk") {
      setState(st => ({ ...st, apacheFixed: true }));
      return ok("MaxRequestWorkers increased to 512, MPM event configured.\nNow: apachectl configtest && systemctl restart httpd");
    }
  }
  if (cmd === "apachectl" && raw.includes("configtest")) return ok("Syntax OK");
  if (cmd === "systemctl" && parts[1]==="restart" && parts[2]==="httpd") {
    if (s === "apachewrk" && state.apacheFixed) {
      setState(st => ({ ...st, apacheFixed: true }));
      return ok("httpd restarted — MaxRequestWorkers: 512, MPM: event");
    }
    return ok("httpd restarted.");
  }
  if (cmd === "systemctl" && parts[1]==="start" && parts[2]==="mysqld") {
    if (s === "iowait" && state.iowaitFixed) {
      setState(st => ({ ...st, iowaitFixed: true }));
      return ok("mysqld started — I/O throttling active.");
    }
    return ok("mysqld started.");
  }

  // ── mysql slow queries ────────────────────────────────────────────────────
  if (cmd === "mysql" || cmd === "mysqladmin") {
    if (raw.includes("processlist") || raw.includes("PROCESSLIST")) {
      if (s === "mysqlslow") return lines([
        "+-------+----------+-----------+----------+---------+------+--------------------------------+",
        "| Id    | User     | Host      | db       | Time    | State| Info                           |",
        "+-------+----------+-----------+----------+---------+------+--------------------------------+",
        "| 12341 | app_user | 10.0.1.12 | proddb   |    4821 | Sending data | SELECT o.*, u.*, p.* FROM orders o JOIN users u JOIN products p WHERE... |",
        "| 12342 | app_user | 10.0.1.13 | proddb   |    4818 | Waiting for lock | UPDATE inventory SET qty=qty-1 WHERE product_id IN (...) |",
        "| 12343 | app_user | 10.0.1.14 | proddb   |    3901 | Waiting for lock | UPDATE inventory... |",
        "| 12344 | report   | 10.0.1.20 | proddb   |    8234 | Sending data | SELECT * FROM orders JOIN shipments JOIN... (full table scan) |",
        "| ...   | ...      | ...       | ...      |    ...  | ...  | 89 query in lock wait           |",
        "+-------+----------+-----------+----------+---------+------+--------------------------------+",
        "# PID 12344 (report user) doing full scan for 8234 sec — locking entire table",
      ]);
    }
    if (raw.includes("KILL") || raw.includes("kill")) {
      const pid = parts.find(p => /^\d{4,}$/.test(p));
      if (s === "mysqlslow" && pid === "12344") {
        setState(st => ({ ...st, mysqlFixed: true }));
        return ok(`Query 12344 killed. Lock released — 89 queries unblocked.`);
      }
      return ok(`Query ${pid||""} killed.`);
    }
    if (raw.includes("slow") || raw.includes("slow_query_log")) {
      if (s === "mysqlslow") return lines([
        "# /var/log/mysql/slow.log",
        "# Time: 2026-03-04T08:55:01.123456Z",
        "# User@Host: report[report] @ 10.0.1.20 [10.0.1.20]",
        "# Query_time: 8234.281  Lock_time: 8234.100  Rows_sent: 0  Rows_examined: 142857192",
        "SELECT * FROM orders o",
        "  JOIN shipments s ON o.id = s.order_id",
        "  JOIN line_items li ON o.id = li.order_id",
        "WHERE o.created_at > '2020-01-01'  -- full table scan, no index",
        "# 142 MILLION rows examined — missing index on created_at",
      ]);
    }
    if (raw.includes("explain") || raw.includes("EXPLAIN")) {
      if (s === "mysqlslow") return lines([
        "+----+-------------+-------+------+---------------+------+---------+------+-----------+-------------+",
        "| id | select_type | table | type | possible_keys | key  | key_len | ref  | rows      | Extra       |",
        "+----+-------------+-------+------+---------------+------+---------+------+-----------+-------------+",
        "|  1 | SIMPLE      | o     | ALL  | NULL          | NULL | NULL    | NULL | 142857192 | Using where |",
        "# type=ALL → FULL TABLE SCAN on 142M rows — no index used",
      ]);
    }
  }

  // ── dmesg ─────────────────────────────────────────────────────────────────
  if (cmd === "dmesg") {
    if (s === "netflap") return lines([
      "[1234567.123456] e1000e: eth0 NIC Link is Down",
      "[1234567.523456] e1000e: eth0 NIC Link is Up 1000 Mbps Full Duplex",
      "[1234571.001234] e1000e: eth0 NIC Link is Down",
      "[1234571.412345] e1000e: eth0 NIC Link is Up 1000 Mbps Full Duplex",
      "[1234575.009812] e1000e: eth0 NIC Link is Down",
      "[1234575.432101] e1000e: eth0 NIC Link is Up 1000 Mbps Full Duplex",
      "# eth0 flapping every ~4 seconds — faulty cable or switch port problem",
    ]);
    if (s === "fsck") return lines([
      "[  182.123456] EXT4-fs error (device dm-0): ext4_find_entry:1455: inode #131073: comm httpd: reading directory lblock 0",
      "[  182.234567] EXT4-fs error (device dm-0): ext4_validate_block_bitmap:376: comm kjournald2: bg 4: bad block bitmap checksum",
      "[  182.345678] SCSI error: return code = 0x08000002",
      "[  182.456789] end_request: I/O error, dev sda, sector 293601280",
      "# EXT4 errors + I/O error on sda — corrupted filesystem",
    ]);
    if (s === "oomkiller") return lines([
      "[ 3210.123456] java invoked oom-killer: gfp_mask=0x6200ca(GFP_HIGHUSER_MOVABLE), order=0",
      "[ 3210.234567] oom-kill:constraint=CONSTRAINT_NONE,nodemask=(null),cpuset=/,mems_allowed=0",
      "[ 3210.345678] Out of memory: Killed process 8921 (java) total-vm:24576000kB, anon-rss:15728640kB",
      "[ 3210.456789] oom_reaper: reaped process 8921 (java), now anon-rss:0kB, file-rss:0kB",
      "[ 3215.001234] java invoked oom-killer: gfp_mask=0x6200ca",
      "[ 3215.123456] Out of memory: Killed process 8944 (java) total-vm:24576000kB",
      "# OOM killing java every 5 minutes — heap leak in progress",
    ]);
    return lines(["[ 0.000000] Linux version 5.15.0-206.153.7.el8uek.x86_64","[    0.123] BIOS-provided physical RAM map"]);
  }

  // ── ethtool ───────────────────────────────────────────────────────────────
  if (cmd === "ethtool") {
    if (s === "netflap") {
      if (raw.includes("-S")) return lines([
        "NIC statistics:",
        "     rx_packets: 84123891",
        "     rx_errors: 0",
        "     rx_crc_errors: 18482  ← CRC ERRORS — faulty cable/SFP",
        "     rx_missed_errors: 0",
        "     tx_packets: 76234901",
        "     tx_errors: 0",
        "     link_state_change: 214  ← 214 state changes in 47 days (ABNORMAL)",
      ]);
      return lines([
        "Settings for eth0:",
        "        Speed: 1000Mb/s",
        "        Duplex: Full",
        "        Auto-negotiation: on",
        "        Port: Twisted Pair",
        "        Link detected: yes",
      ]);
    }
    return lines(["Settings for eth0:","  Speed: 1000Mb/s","  Link detected: yes"]);
  }
  if (cmd === "ip" && raw.includes("link")) {
    if (s === "netflap") return lines([
      "2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP",
      "    link/ether 00:50:56:ab:cd:ef brd ff:ff:ff:ff:ff:ff",
      "    RX errors 0  dropped 0  overruns 0  frame 0",
      "    TX errors 0  dropped 0  overruns 0  carrier 214  ← 214 carrier errors",
    ]);
    return lines(["2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500","    inet 192.168.1.100/24"]);
  }

  // ── ss (TIME_WAIT) ────────────────────────────────────────────────────────
  if (cmd === "ss") {
    if (s === "timewait" && (raw.includes("-s") || raw.includes("summary"))) return lines([
      "Netid  State      Recv-Q  Send-Q",
      "Total: 29412 (kernel 30001)",
      "TCP:   28934 (estab 42, closed 28810, orphaned 0, timewait 28810)  ← 28,810 TIME_WAIT!",
      "UDP:   18",
      "# 28,810 TIME_WAIT connections — port exhaustion imminent",
    ]);
    if (s === "timewait" && raw.includes("TIME-WAIT")) return lines([
      "ESTAB       0  0  10.0.1.100:80   10.0.2.50:52141",
      "TIME-WAIT   0  0  10.0.1.100:80   10.0.2.50:52140  (10.0 sec)",
      "TIME-WAIT   0  0  10.0.1.100:80   10.0.2.50:52139  (10.1 sec)",
      "TIME-WAIT   0  0  10.0.1.100:80   10.0.2.50:52138  (10.2 sec)",
      "# ... 28,810 TIME-WAIT rows all from 10.0.2.50 (load balancer)",
    ]);
    return lines(["ESTAB  0  0  10.0.1.100:80  10.0.2.50:52141","LISTEN 0  0  0.0.0.0:22   0.0.0.0:*"]);
  }
  if (cmd === "sysctl" && raw.includes("net.ipv4")) {
    if (s === "timewait") return lines([
      "net.ipv4.tcp_tw_reuse = 0           ← should be 1",
      "net.ipv4.tcp_fin_timeout = 60       ← too high, lower to 15",
      "net.ipv4.ip_local_port_range = 32768 60999  ← narrow range",
    ]);
    return lines(["net.ipv4.tcp_tw_reuse = 1","net.ipv4.tcp_fin_timeout = 15"]);
  }
  if (cmd === "sysctl" && raw.includes("-w")) {
    if (s === "timewait" && raw.includes("tw_reuse=1")) {
      setState(st => ({ ...st, timewaitFixed: true }));
      return ok("net.ipv4.tcp_tw_reuse = 1\nnet.ipv4.tcp_fin_timeout = 15\nTIME_WAIT connections will drain in ~15 sec.");
    }
    return ok(`sysctl: applicato.`);
  }
  if (cmd === "cat" && raw.includes("sysctl.conf")) {
    if (s === "timewait") return lines([
      "# /etc/sysctl.conf",
      "vm.swappiness = 10",
      "# MISSING TCP TIME_WAIT tuning settings",
    ]);
  }

  // ── tcpdump ───────────────────────────────────────────────────────────────
  if (cmd === "tcpdump") {
    if (s === "tcpdump") return lines([
      "tcpdump: verbose output suppressed, use -v or -vv for full protocol decode",
      "listening on eth0, link-type EN10MB (Ethernet), capture size 262144 bytes",
      "",
      "11:03:14.123456 IP 10.0.1.100.45321 > 185.220.101.48.443: Flags [S], seq 1234567",
      "11:03:14.234567 IP 10.0.1.100.45322 > 185.220.101.48.443: Flags [S], seq 2345678",
      "11:03:14.345678 IP 10.0.1.100.45323 > 185.220.101.48.443: Flags [S], seq 3456789",
      "11:03:14.456789 IP 10.0.1.100.45324 > 185.220.101.48.443: Flags [S], seq 4567890",
      "# Connections to 185.220.101.48:443 (Tor exit node!) every 0.1s",
      "# Likely cryptominer/malware — identify the process",
    ]);
    return lines(["tcpdump: listening on eth0, link-type EN10MB","11:03:14.123456 IP 10.0.1.100.80 > 10.0.2.50.52141: Flags [.], ack 1"]);
  }
  if (cmd === "lsof" && (raw.includes("185.220") || raw.includes("-i"))) {
    if (s === "tcpdump") return lines([
      "COMMAND     PID   USER  FD  TYPE  DEVICE    NODE NAME",
      "xmrig      6612   www    8u  IPv4  0t0       TCP 10.0.1.100:45321->185.220.101.48:443 (ESTABLISHED)",
      "xmrig      6612   www    9u  IPv4  0t0       TCP 10.0.1.100:45322->185.220.101.48:443 (ESTABLISHED)",
      "# xmrig — cryptominer! Process 6612 started by user www",
    ]);
  }
  if (cmd === "kill" && raw.includes("6612")) {
    if (s === "tcpdump") {
      setState(st => ({ ...st, tcpdumpFound: true }));
      return ok("xmrig (6612) killed.\nCRITICAL: investigate entry vector — check Apache logs, www crontab, PHP backdoor files.");
    }
  }
  if (cmd === "ps" && raw.includes("xmrig")) {
    if (s === "tcpdump") return lines([
      "  PID  PPID USER  %CPU %MEM COMMAND",
      " 6612  4501 www   98.2  0.4 /tmp/.cache/xmrig --pool pool.minexmr.com:443 --donate-level=0",
      "# Running from /tmp/.cache/ — disguised as a cache file",
    ]);
  }

  // ── strace ────────────────────────────────────────────────────────────────
  if (cmd === "strace") {
    if (s === "strace") return lines([
      "strace: Process 9321 attached",
      "epoll_wait(5, [], 1, 5000)             = 0",
      "epoll_wait(5, [], 1, 5000)             = 0",
      "epoll_wait(5, [], 1, 5000)             = 0",
      "connect(7, {sa_family=AF_INET, sin_port=htons(5432), sin_addr=inet_addr(\"10.0.3.50\")}, 16) = -1 ETIMEDOUT (Connection timed out)",
      "epoll_wait(5, [], 1, 5000)             = 0",
      "connect(7, {sa_family=AF_INET, sin_port=htons(5432), sin_addr=inet_addr(\"10.0.3.50\")}, 16) = -1 ETIMEDOUT",
      "# Process waiting for connection to 10.0.3.50:5432 (PostgreSQL) — DB unreachable",
    ]);
  }
  if (cmd === "ping" && raw.includes("10.0.3.50")) {
    if (s === "strace") return lines([
      "PING 10.0.3.50: 56 bytes of data",
      "Request timeout for icmp_seq 0",
      "Request timeout for icmp_seq 1",
      "# 10.0.3.50 not responding — host down or firewall",
    ]);
  }
  if (cmd === "telnet" && raw.includes("5432")) {
    if (s === "strace") return lines(["Trying 10.0.3.50...", "telnet: connect to address 10.0.3.50: Connection refused","# Port 5432 refused — PostgreSQL down or firewall blocking"]);
  }
  if (cmd === "firewall-cmd" && raw.includes("add-rich-rule") && raw.includes("5432")) {
    if (s === "strace") {
      setState(st => ({ ...st, straceFound: true }));
      return ok("Firewall rule added. Connection to PostgreSQL unblocked.");
    }
  }
  if (cmd === "ssh" && raw.includes("10.0.3")) {
    if (s === "strace") {
      setState(st => ({ ...st, straceFound: true }));
      return ok("Connected to 10.0.3.50. Verify PostgreSQL is running: systemctl status postgresql");
    }
  }

  // ── gdb / coredump ────────────────────────────────────────────────────────
  if (cmd === "ls" && raw.includes("/var/core")) {
    if (s === "coredump") return lines([
      "-rw------- 1 root root 2.1G Mar  4 08:42 core.app_server.9022",
      "-rw------- 1 root root 2.0G Mar  3 22:18 core.app_server.7891",
      "-rw------- 1 root root 1.9G Mar  3 10:05 core.app_server.6134",
      "# 3 core dumps from app_server — recurring crash",
    ]);
  }
  if (cmd === "coredumpctl") {
    if (s === "coredump") return lines([
      "TIME                            PID  UID  GID SIG COREFILE  EXE",
      "Mon 2026-03-04 08:42:11 UTC    9022 1001 1001  11 present   /opt/app/bin/app_server",
      "Sun 2026-03-03 22:18:33 UTC    7891 1001 1001  11 present   /opt/app/bin/app_server",
      "Sun 2026-03-03 10:05:12 UTC    6134 1001 1001  11 present   /opt/app/bin/app_server",
      "# Signal 11 = SIGSEGV — recurring segmentation fault",
    ]);
    if (raw.includes("info") || raw.includes("gdb")) return lines([
      "           PID: 9022",
      "          COMM: app_server",
      "          SIGNAL: 11 (SEGV)",
      "COREDUMP BACKTRACE:",
      "  #0  0x00007f8b4c2a1234 in parse_json_request () at src/request.c:291",
      "  #1  0x00007f8b4c291000 in handle_client () at src/server.c:148",
      "  #2  0x00007f8b4c290500 in main () at src/server.c:82",
      "# CRASH in parse_json_request() — likely unhandled malformed input",
    ]);
  }
  if (cmd === "gdb") {
    if (s === "coredump") return lines([
      "GNU gdb (GDB) 8.2-17.0.1",
      "Core was generated by `/opt/app/bin/app_server --port 8080'.",
      "Program terminated with signal SIGSEGV, Segmentation fault.",
      "#0  0x00007f8b4c2a1234 in parse_json_request (buf=0x0, len=4096) at src/request.c:291",
      "291         if (buf->data[0] == '{') {   /* buf->data is NULL pointer! */",
      "(gdb) bt",
      "#0  parse_json_request (buf=0x0) at src/request.c:291",
      "#1  handle_client (conn=0x55ab12cd3e40) at src/server.c:148",
      "# NULL pointer dereference — client sends empty request → crash",
    ]);
    if (raw.includes("core")) {
      setState(st => ({ ...st, coredumpFixed: true }));
      return ok("Crash identified: NULL pointer in parse_json_request() — empty HTTP request causes segfault.\nReport to dev team: validate input before dereferencing.");
    }
  }

  // ── syslog flood ──────────────────────────────────────────────────────────
  if (cmd === "tail" && raw.includes("syslog")) {
    if (s === "syslogflood") return lines([
      "Mar  4 11:03:14 server01 snmpd[2210]: Connection from UDP: [10.0.5.1]:161->[10.0.1.100]:161",
      "Mar  4 11:03:14 server01 snmpd[2210]: Connection from UDP: [10.0.5.1]:161->[10.0.1.100]:161",
      "Mar  4 11:03:14 server01 snmpd[2210]: Connection from UDP: [10.0.5.1]:161->[10.0.1.100]:161",
      "# ... 50,000 times per second — NMS sending SNMP poll every 0.02ms",
    ]);
  }
  if (cmd === "journalctl" && raw.includes("--disk-usage")) {
    if (s === "syslogflood") return warn("Archived and active journals take up 84.0G on disk. Rate: ~2.1 GB/hour");
    return ok("Journals take up 420.0M on disk.");
  }
  if (cmd === "cat" && raw.includes("rsyslog.conf")) {
    if (s === "syslogflood") return lines([
      "# /etc/rsyslog.conf",
      "# no rate limiting configured  ← PROBLEM",
      "module(load=\"imjournal\")",
      "# FIX: add SystemLogRateLimitInterval=60 SystemLogRateLimitBurst=1000",
    ]);
  }
  if ((cmd === "vi" || cmd === "nano") && raw.includes("rsyslog")) {
    if (s === "syslogflood") {
      setState(st => ({ ...st, syslogFixed: true }));
      return ok("Rate limiting configured: SystemLogRateLimitBurst=1000.\nNow: systemctl restart rsyslog");
    }
  }
  if (cmd === "systemctl" && parts[1]==="restart" && parts[2]==="rsyslog") {
    if (s === "syslogflood" && state.syslogFixed) return ok("rsyslog restarted — rate limiting active. Log flood stopped.");
    return ok("rsyslog restarted.");
  }

  // ── fsck ──────────────────────────────────────────────────────────────────
  if (cmd === "fsck") {
    if (s === "fsck") {
      if (raw.includes("-n")) return lines([
        "fsck from util-linux 2.32.1",
        "e2fsck 1.45.6 (20-Mar-2020)",
        "/dev/sda1: recovering journal",
        "Pass 1: Checking inodes, blocks, and sizes",
        "Pass 2: Checking directory structure",
        "Inode 131073 has invalid block (blk #293601280). IGNORED.",
        "Pass 3: Checking directory connectivity",
        "Pass 4: Checking reference counts",
        "Pass 5: Checking group summary information",
        "/dev/sda1: 48291/3276800 files, 12345678/13107200 blocks",
        "# Errors found — run fsck -y on unmounted filesystem",
      ]);
      if (raw.includes("-y") || raw.includes("-p")) {
        setState(st => ({ ...st, fsckDone: true }));
        return ok("e2fsck: 14 inodes corrected, 3 orphaned inodes deleted, 1 bad block recovered.\n/dev/sda1: REPAIRED");
      }
    }
    return lines(["fsck: no errors detected."]);
  }
  if (cmd === "umount") {
    return ok(`Filesystem unmounted: ${parts[1]||"/dev/sda1"}`);
  }
  if (cmd === "mount" && !raw.includes("nfs")) {
    if (s === "fsck" && state.fsckDone) {
      setState(st => ({ ...st, fsckDone: true }));
      return ok("Filesystem remounted. Verify: dmesg | grep EXT4");
    }
    return ok(`Mount completato.`);
  }

  // ── OOM killer ────────────────────────────────────────────────────────────
  if (cmd === "free") {
    if (s === "oomkiller") return lines([
      "               total        used        free      shared  buff/cache   available",
      "Mem:          31.3Gi      30.8Gi       102Mi       430Mi       380Mi       120Mi  ← CRITICAL",
      "Swap:          7.9Gi       7.9Gi          0B",
    ]);
    return lines(["Mem: 31.3Gi  8.2Gi  21.1Gi","Swap: 7.9Gi  0B  7.9Gi"]);
  }
  if (cmd === "jmap" || (raw.includes("jcmd") && raw.includes("heap"))) {
    if (s === "oomkiller") return lines([
      "Heap Configuration:",
      "   MaxHeapSize              = 16106127360 (15.0GB)  ← -Xmx15g",
      "Heap Usage:",
      "   Young Generation: 14.9GB used / 15.0GB max  ← HEAP FULL",
      "   Old  Generation: 14.8GB used / 15.0GB max",
      "# GC unable to free memory — memory leak in the application",
      "# Unreleased objects: SessionCache (6.2GB), QueryResultCache (4.1GB)",
    ]);
  }
  if (cmd === "jstack" || (raw.includes("jcmd") && raw.includes("thread"))) {
    if (s === "oomkiller") return lines([
      `"main" #1 prio=5 os_prio=0 tid=0x00007f8b4c001800 nid=0x22e1 waiting on condition`,
      `"GC Thread#0" daemon prio=10 ... in GC`,
      `"GC Thread#1" daemon prio=10 ... in GC`,
      `# 48 GC threads active simultaneously — GC thrashing`,
    ]);
  }
  if (cmd === "kill" && raw.includes("9022")) {
    if (s === "oomkiller") return warn("PID 9022 already killed by OOM killer. Process restarts automatically and crashes again.");
  }
  if ((cmd === "vi" || cmd === "nano") && (raw.includes("jvm") || raw.includes(".conf") || raw.includes("Xmx"))) {
    if (s === "oomkiller") {
      setState(st => ({ ...st, oomFixed: true }));
      return ok("JVM heap reduced: -Xmx8g. Heap dump enabled: -XX:+HeapDumpOnOutOfMemoryError\nNow: systemctl restart app && analyze heap dump with jmap");
    }
  }

  // ── Infoblox ──────────────────────────────────────────────────────────────
  if (cmd === "dig" || cmd === "nslookup") {
    if (s === "infoblox") return lines([
      ";; connection timed out; no servers could be reached",
      "# Server DNS: 10.0.10.1 (Infoblox Primary) — timeout",
      "# Server DNS: 10.0.10.2 (Infoblox Secondary) — timeout",
    ]);
    return lines([`${parts[1]||"google.com"}\taddress: 142.250.180.46`]);
  }
  if (cmd === "ping" && (raw.includes("10.0.10.1")||raw.includes("10.0.10.2"))) {
    if (s === "infoblox") return lines([
      `PING 10.0.10.1: 56 bytes of data`,
      `64 bytes from 10.0.10.1: icmp_seq=0 ttl=64 time=0.4 ms`,
      `# Infoblox responds to ping — DNS service problem, not the host`,
    ]);
  }
  if (cmd === "curl" && raw.includes("infoblox")) {
    if (s === "infoblox") return lines([
      "HTTP/1.1 200 OK",
      '{"result":[{"status":"WORKING","services":{"dns":{"status":"FAILED","description":"named service not running"},"dhcp":{"status":"WORKING"}}}]}',
      "# Infoblox API responds — named service is DOWN on Infoblox itself",
    ]);
    return ok("HTTP/1.1 200 OK");
  }
  if (cmd === "cat" && raw.includes("resolv.conf")) {
    if (s === "infoblox") return lines([
      "# /etc/resolv.conf",
      "nameserver 10.0.10.1   ← Infoblox Primary (DNS service down)",
      "nameserver 10.0.10.2   ← Infoblox Secondary (DNS service down)",
      "search lab.local",
    ]);
  }
  if ((cmd === "vi" || cmd === "nano") && raw.includes("resolv.conf")) {
    if (s === "infoblox") {
      setState(st => ({ ...st, infobloxFixed: true }));
      return ok("Added nameserver 8.8.8.8 as temporary fallback.\nOpen ticket with Infoblox team — named service crash — request restart.");
    }
  }
  if (cmd === "nmcli" && raw.includes("dns")) {
    if (s === "infoblox") {
      setState(st => ({ ...st, infobloxFixed: true }));
      return ok("DNS fallback 8.8.8.8 configured via nmcli. Temporary resolution active.");
    }
  }

  // ── generici ─────────────────────────────────────────────────────────────
  if (cmd === "ps" || cmd === "top") {
    if (s === "iowait")   return lines(["USER    PID %CPU %MEM COMMAND","mysql  4821  8.2  4.1 mysqld","# I/O bound — use iostat/iotop"]);
    if (s === "oomkiller")return lines(["USER    PID %CPU %MEM COMMAND","tomcat 8944 12.3 98.8 java -Xmx15g -jar app.jar  ← 98.8% RAM"]);
    if (s === "tcpdump")  return lines(["USER  PID %CPU %MEM COMMAND","www   6612 98.2  0.4 /tmp/.cache/xmrig  ← CRYPTOMINER!"]);
    return lines(["USER    PID %CPU %MEM COMMAND","root      1  0.0  0.1 /sbin/init","apache  901  0.3  1.1 /usr/sbin/httpd"]);
  }
  if (cmd === "df") return lines([
    "Filesystem              Size  Used Avail Use% Mounted on",
    "/dev/mapper/ol-root      50G   18G   32G  36% /",
    "/dev/sda1               500M  300M  200M  60% /boot",
  ]);
  if (cmd === "ip" && raw.includes("addr")) return lines(["2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP>","    inet 10.0.1.100/24"]);
  if (cmd === "ip" && raw.includes("route")) return lines(["default via 10.0.1.1 dev eth0","10.0.1.0/24 dev eth0"]);
  if (cmd === "hostname") return lines(["server01.prod.lab.local"]);
  if (cmd === "whoami")   return lines(["root"]);
  if (cmd === "uname")    return lines(["Linux server01 5.15.0-206.153.7.el8uek.x86_64 Oracle Linux 8"]);
  if (cmd === "clear")    return [{ text: "__CLEAR__", type: "clear" }];
  if (cmd === "")         return [];
  if (cmd === "journalctl") return lines(["systemd[1]: Starting Session of user root.","sshd[4001]: Accepted publickey for root from 10.0.2.10"]);

  if (cmd === "hint") {
    const H = {
      iowait:    "iostat -x 1 3 → sda 98% → iotop → mysqld writing 900MB/s → cat /etc/my.cnf → innodb_flush_log_at_trx_commit=2",
      apachewrk: "curl localhost/server-status → all workers W → cat /etc/httpd/conf/httpd.conf → increase MaxRequestWorkers",
      mysqlslow: "mysql -e 'SHOW PROCESSLIST' → PID 12344 for 8234 sec → KILL 12344 → EXPLAIN the query",
      netflap:   "dmesg | grep eth0 → flapping → ethtool -S eth0 → CRC errors → faulty cable/SFP",
      timewait:  "ss -s → 28k TIME_WAIT → sysctl net.ipv4.tcp_tw_reuse → sysctl -w tcp_tw_reuse=1",
      tcpdump:   "tcpdump -i eth0 -n → connections to Tor IP → ps aux | grep xmrig → kill the miner",
      strace:    "strace -p <PID> → ETIMEDOUT to 10.0.3.50:5432 → ping → telnet 5432 → firewall",
      coredump:  "coredumpctl list → gdb with core → backtrace → NULL pointer in parse_json_request",
      syslogflood:"tail /var/log/syslog → snmpd flood → cat /etc/rsyslog.conf → add rate limit → restart",
      fsck:      "dmesg | grep EXT4 → umount → fsck -n (dry run) → fsck -y → remount",
      oomkiller: "dmesg | grep oom → free -h → jmap PID → heap leak → reduce -Xmx → heap dump",
      infoblox:  "dig google.com → timeout → ping 10.0.10.1 → curl Infoblox API → named down → nmcli dns fallback",
    };
    return warn("💡 " + (H[s]||"Use help for available commands."));
  }

  if (cmd === "help") return lines([
    "━━ Diagnostica sistema ━━",
    "  uptime | iostat -x 1 3 | iotop | vmstat 1 3 | free -h",
    "  ps aux | top | dmesg | dmesg | grep EXT4",
    "━━ Apache ━━",
    "  curl http://localhost/server-status",
    "  cat /etc/httpd/conf/httpd.conf | apachectl configtest",
    "  systemctl restart httpd",
    "━━ MySQL ━━",
    "  mysql -e 'SHOW FULL PROCESSLIST'",
    "  mysql -e 'KILL <query_id>'",
    "  mysql -e 'EXPLAIN SELECT ...'",
    "  cat /etc/my.cnf | vi /etc/my.cnf",
    "━━ Rete ━━",
    "  ethtool eth0 | ethtool -S eth0",
    "  ip link | ss -s | ss -o state TIME-WAIT",
    "  sysctl net.ipv4.tcp_tw_reuse",
    "  sysctl -w net.ipv4.tcp_tw_reuse=1 net.ipv4.tcp_fin_timeout=15",
    "  tcpdump -i eth0 -n host 185.220.101.48",
    "  dig google.com | nslookup google.com",
    "  cat /etc/resolv.conf | nmcli con modify eth0 ipv4.dns 8.8.8.8",
    "━━ Debug processi ━━",
    "  strace -p <PID> -e trace=network",
    "  lsof -i :5432 | lsof +D /var/lib/mysql",
    "  ps aux | grep xmrig | kill <PID>",
    "━━ JVM / Java ━━",
    "  jmap -heap <PID> | jstack <PID>",
    "  vi /etc/opt/app/jvm.conf  (modifica -Xmx)",
    "━━ Core dump ━━",
    "  coredumpctl list | coredumpctl info",
    "  gdb /opt/app/bin/app_server /var/core/core.<PID>",
    "━━ Filesystem ━━",
    "  umount /dev/sda1 | fsck -n /dev/sda1 | fsck -y /dev/sda1",
    "━━ Log ━━",
    "  tail -f /var/log/messages | tail -f /var/log/syslog",
    "  cat /etc/rsyslog.conf | vi /etc/rsyslog.conf",
    "  systemctl restart rsyslog",
    "━━ Infoblox ━━",
    "  curl -k https://10.0.10.1/wapi/v2.10/grid?_return_fields=name,service_status",
    "  hint — scenario-specific hint",
  ]);

  return err(`-bash: ${cmd}: command not found`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK SOLVED
// ─────────────────────────────────────────────────────────────────────────────
function checkSolved(st) {
  switch(st.scenario) {
    case "iowait":     return st.iowaitFixed;
    case "apachewrk":  return st.apacheFixed;
    case "mysqlslow":  return st.mysqlFixed;
    case "netflap":    return false; // hardware — informational
    case "timewait":   return st.timewaitFixed;
    case "tcpdump":    return st.tcpdumpFound;
    case "strace":     return st.straceFound;
    case "coredump":   return st.coredumpFixed;
    case "syslogflood":return st.syslogFixed;
    case "fsck":       return st.fsckDone;
    case "oomkiller":  return st.oomFixed;
    case "infoblox":   return st.infobloxFixed;
    default:           return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────────────────────────────
const CAT = {
  storage: { color:"#f5a623", label:"Storage" },
  web:     { color:"#4caf84", label:"Web"     },
  db:      { color:"#5bc0de", label:"Database"},
  net:     { color:"#9b59b6", label:"Network" },
  debug:   { color:"#e06060", label:"Debug"   },
  log:     { color:"#e67e22", label:"Log"     },
  memory:  { color:"#e91e63", label:"Memory"  },
};

const col = { out:"#c5d8c5", err:"#e06060", ok:"#4caf84", warn:"#ffaa00", prompt:"#6ab0f5", dim:"#445566" };

// Maps landing page scenario names → internal scenario ids
const LANDING_SCENARIO_MAP = {
  apache:  'apachewrk',
  disk:    'syslogflood',
  selinux: 'apachewrk',
  cpu:     'oomkiller',
  ssh:     'netflap',
};

export default function App({ scenario: scenarioProp } = {}) {
  const [scenario, setScenario] = useState(null);
  const [state, setState] = useState(null);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [cmdHist, setCmdHist] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [instanceId] = useState(genInstanceId);
  const [idleDelay, setIdleDelay] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const bottomRef = useRef();
  const inputRef  = useRef();

  // Telemetry
  const scenarioId = scenario?.id || null;
  const { startSession, endSession, recordCommand } = useLabTelemetry(
    scenarioId,
    null,
    "real-server"
  );

  // Realism background worker
  const [auditResult, setAuditResult] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const workerRef = useRef(null);

  useEffect(() => {
    if (scenario && !state?.solved) {
      workerRef.current = getRealismWorker({
        chaosIntensity: 0.15,
        chaosIntervalMs: 15000,
        userSkill: "mid",
        onAudit: (result) => setAuditResult(result),
        onAnomaly: (a) => setAnomalies((prev) => [...prev, a].slice(-10)),
      });
    }
    return () => {
      if (workerRef.current) workerRef.current.stop();
    };
  }, [scenario?.id, state?.solved]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (Date.now() - lastActivityRef.current > 30000) setIdleDelay(true);
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  // Auto-start when a scenario prop is passed (demo modal from landing page)
  useEffect(() => {
    if (!scenarioProp || scenario) return;
    const internalId = LANDING_SCENARIO_MAP[scenarioProp] || scenarioProp;
    const s = SCENARIOS.find(sc => sc.id === internalId);
    if (s) start(s);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start(s) {
    setScenario(s);
    setState(makeState(s.id));
    // Persistent uptime — set only on first visit, survives browser close
    const lsKey = `winlab_lab_start_${s.id}`;
    if (!localStorage.getItem(lsKey)) localStorage.setItem(lsKey, String(Date.now()));
    startSession();
    const intro = {
      iowait:     "⚠  ALERT: load average 12.44. I/O Wait at 92%. Server stalled on disk.",
      apachewrk:  "⚠  ALERT: site very slow. Apache returning 503. Traffic spike in progress.",
      mysqlslow:  "⚠  ALERT: application timing out. MySQL not responding. DBA unavailable.",
      netflap:    "⚠  ALERT: monitoring reports eth0 flapping. Intermittent network connections.",
      timewait:   "⚠  ALERT: application unable to open new connections. Port exhaustion.",
      tcpdump:    "⚠  ALERT: IDS reports anomalous outbound traffic to unknown IPs.",
      strace:     "⚠  ALERT: app_worker process (PID 9321) hung for 40 minutes. CPU 0%.",
      coredump:   "⚠  ALERT: app_server crashing every ~10 hours. 3 core dumps in /var/core since yesterday.",
      syslogflood:"⚠  ALERT: /var/log growing 2GB/hour. Disk at 88%. Syslog flooded.",
      fsck:       "⚠  ALERT: dmesg shows EXT4 errors and I/O errors on sda. Filesystem corrupted.",
      oomkiller:  "⚠  ALERT: OOM killer active. Java crashing every 5 minutes. Suspected heap leak.",
      infoblox:   "⚠  ALERT: 40 sites not resolving names. Infoblox DNS unreachable.",
    }[s.id] || "Shell ready.";
    setHistory([
      { text: `SSH session established → ${instanceId} (Oracle Linux 8.9)`, type: "dim" },
      { text: intro, type: "warn" },
      { text: "Type 'help' for available commands, 'hint' for a scenario hint.", type: "dim" },
    ]);
    setCmdHist([]); setHistIdx(-1);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function submit() {
    if (!input.trim()) return;
    submit_val(input.trim());
    setInput("");
  }

  function submit_val(cmd) {
    lastActivityRef.current = Date.now();
    const startTime = Date.now();
    setCmdHist(h => [cmd, ...h].slice(0, 100));
    setHistIdx(-1);

    // ── realism: dmesg ──────────────────────────────────────────────────────
    if (cmd === "dmesg" || cmd.startsWith("dmesg ")) {
      // handled in runCommand, but patch hostname
      const out = runCommand(cmd, state, setState);
      const patched = out.map(o => ({ ...o, text: o.text?.replace(/\bserver01\b/g, instanceId) }));
      setHistory(h => [...h, { text: `[root@${instanceId} ~]# ${cmd}`, type: "prompt" }, ...patched]);
      return;
    }

    // ── realism: /proc files ────────────────────────────────────────────────
    if (cmd.startsWith("cat ") && PROC_FILES[cmd.slice(4).trim()]) {
      const lines = PROC_FILES[cmd.slice(4).trim()].map(t => ({ text: t, type: "out" }));
      setHistory(h => [...h, { text: `[root@${instanceId} ~]# ${cmd}`, type: "prompt" }, ...lines]);
      return;
    }

    // ── realism: history ────────────────────────────────────────────────────
    if (cmd === "history") {
      const base = new Date("2026-03-04T08:00:00Z");
      const lines = cmdHist.slice().reverse().map((c, i) => {
        const t = new Date(base.getTime() + i * 37000).toISOString().replace("T"," ").slice(0,19);
        return { text: `  ${String(i+1).padStart(3)}  ${t}  ${c}`, type: "out" };
      });
      setHistory(h => [...h, { text: `[root@${instanceId} ~]# ${cmd}`, type: "prompt" }, ...lines]);
      return;
    }

    const out = runCommand(cmd, state, setState);
    const durationMs = Date.now() - startTime;
    if (out.some(o => o.type === "clear")) { setHistory([]); return; }
    setHistory(h => [...h, { text: `[root@${instanceId} ~]# ${cmd}`, type: "prompt" }, ...out]);

    // Record command telemetry
    const [cmdName, ...cmdArgs] = cmd.split(/\s+/);
    const exitCode = out.some(o => o.type === "err") ? 1 : 0;
    const stdoutLength = out.filter(o => o.type !== "err").reduce((sum, o) => sum + (o.text?.length || 0), 0);
    const stderrLength = out.filter(o => o.type === "err").reduce((sum, o) => sum + (o.text?.length || 0), 0);
    recordCommand({
      raw: cmd, cmd: cmdName, args: cmdArgs, exitCode, durationMs,
      stdoutLength, stderrLength, serviceStates: {}, logCount: 0, newLogs: 0,
    });

    setTimeout(() => {
      setState(st => {
        if (!st || st.solved) return st;
        if (checkSolved(st)) {
          setHistory(h => [...h, { text: "✅  PROBLEM IDENTIFIED AND RESOLVED — great work!", type: "ok" }]);
          endSession(true);
          return { ...st, solved: true };
        }
        return st;
      });
    }, 150);
  }

  function handleKey(e) {
    lastActivityRef.current = Date.now();
    if (e.ctrlKey && e.key === "c") {
      e.preventDefault();
      setHistory(h => [...h, { text: `[root@${instanceId} ~]# ${input}^C`, type: "prompt" }]);
      setInput(""); return;
    }
    if (e.key === "Enter") {
      if (!input.trim()) return;
      if (idleDelay) {
        setIdleDelay(false);
        const val = input.trim(); setInput("");
        setTimeout(() => submit_val(val), 280 + Math.random() * 120);
        return;
      }
      submit(); return;
    }
    if (e.key === "ArrowUp")   { e.preventDefault(); const i=Math.min(histIdx+1,cmdHist.length-1); setHistIdx(i); setInput(cmdHist[i]||""); }
    if (e.key === "ArrowDown") { e.preventDefault(); const i=Math.max(histIdx-1,-1); setHistIdx(i); setInput(i===-1?"":cmdHist[i]||""); }
  }

  // ── SELECTOR ──────────────────────────────────────────────────────────────
  if (!scenario) {
    const cats = [...new Set(SCENARIOS.map(s=>s.cat))];
    return (
      <div style={{ minHeight:"100vh", background:"#0a0c0f", fontFamily:"'JetBrains Mono','Fira Code',monospace", padding:"24px 20px", display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div style={{ marginBottom:32, textAlign:"center" }}>
          <div style={{ fontSize:10, letterSpacing:5, color:"#3a5a3a", textTransform:"uppercase", marginBottom:4 }}>Production Server Scenarios</div>
          <div style={{ fontSize:22, fontWeight:900, color:"#1a3020" }}>Real Linux Troubleshooting</div>
          <div style={{ fontSize:11, color:"#334", marginTop:4 }}>Real commands — realistic enterprise production output</div>
        </div>
        <div style={{ width:"100%", maxWidth:1000 }}>
          {cats.map(cat => (
            <div key={cat} style={{ marginBottom:20 }}>
              <div style={{ fontSize:9, letterSpacing:4, color:CAT[cat].color, textTransform:"uppercase", marginBottom:8, paddingLeft:2 }}>
                ── {CAT[cat].label} ──
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:8 }}>
                {SCENARIOS.filter(s=>s.cat===cat).map(s=>(
                  <button key={s.id} onClick={()=>start(s)}
                    style={{ background:"#0d1117", border:`1px solid #1c2030`, borderRadius:8, padding:"14px 16px", cursor:"pointer", textAlign:"left", fontFamily:"inherit", transition:"border-color 0.15s" }}
                    onMouseOver={e=>e.currentTarget.style.borderColor=CAT[cat].color}
                    onMouseOut={e=>e.currentTarget.style.borderColor="#1c2030"}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                      <span style={{ fontSize:20 }}>{s.icon}</span>
                      <span style={{ fontSize:9, background:CAT[cat].color+"22", color:CAT[cat].color, padding:"2px 6px", borderRadius:3, letterSpacing:1 }}>{CAT[cat].label.toUpperCase()}</span>
                    </div>
                    <div style={{ color:"#c8d8c8", fontWeight:700, fontSize:12, marginBottom:3 }}>{s.label}</div>
                    <div style={{ color:"#3a4a5a", fontSize:10, lineHeight:1.4 }}>{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── TERMINAL ──────────────────────────────────────────────────────────────
  const catInfo = CAT[scenario.cat];
  return (
    <div style={{ height:"100vh", background:"#060809", display:"flex", flexDirection:"column", fontFamily:"'JetBrains Mono','Fira Code',monospace" }}>
      {/* titlebar */}
      <div style={{ background:"#0d1117", borderBottom:"1px solid #1c2030", padding:"7px 14px", display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        <div style={{ display:"flex", gap:5 }}>
          {["#ff5f57","#febc2e","#28c840"].map(c=><div key={c} style={{ width:9,height:9,borderRadius:"50%",background:c }}/>)}
        </div>
        <span style={{ color:"#3a6a3a", fontSize:11, marginLeft:4 }}>root@{instanceId}</span>
        <span style={{ color:catInfo.color, fontSize:10, marginLeft:6 }}>{scenario.icon} {scenario.label}</span>
        <span style={{ fontSize:9, background:catInfo.color+"22", color:catInfo.color, padding:"1px 6px", borderRadius:3 }}>{catInfo.label}</span>
        {state?.solved && <span style={{ fontSize:10, background:"#1a3520", color:"#4caf84", padding:"2px 8px", borderRadius:4 }}>✅ SOLVED</span>}
        {auditResult && <span style={{ fontSize:9, background:auditResult.metaScore > 0.7 ? "#1a3520" : "#352020", color:auditResult.metaScore > 0.7 ? "#4caf84" : "#e06060", padding:"1px 6px", borderRadius:3 }} title={`Realism: ${(auditResult.metaScore * 100).toFixed(0)}%`}>🛡️ {(auditResult.metaScore * 100).toFixed(0)}%</span>}
        <span style={{ fontSize:9, background:"#1a2530", color:"#557", padding:"1px 6px", borderRadius:3 }} title="Telemetry active">📊</span>
        <button onClick={()=>{
          if (scenario && !state?.solved) endSession(false);
          setScenario(null);setState(null);setHistory([]);
        }}
          style={{ marginLeft:"auto", padding:"2px 10px", background:"#1c2030", border:"1px solid #2c3040", borderRadius:4, color:"#4a5a6a", cursor:"pointer", fontSize:10, fontFamily:"inherit" }}>
          ← Scenarios
        </button>
      </div>

      {/* output */}
      <div onClick={()=>inputRef.current?.focus()} style={{ flex:1, overflowY:"auto", padding:"12px 16px", cursor:"text", lineHeight:1.6 }}>
        {history.map((line,i)=>(
          <div key={i} style={{ color:col[line.type]||"#c5d8c5", fontSize:12, whiteSpace:"pre-wrap", wordBreak:"break-all", marginBottom:1 }}>
            {line.text}
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>

      {/* input */}
      <div style={{ borderTop:"1px solid #1c2030", padding:"9px 16px", display:"flex", alignItems:"center", gap:8, background:"#080b0e", flexShrink:0 }}>
        <span style={{ color:"#3a6a3a", fontSize:12, whiteSpace:"nowrap" }}>{`[root@${instanceId} ~]#`}</span>
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
          autoFocus spellCheck={false} autoComplete="off" autoCorrect="off"
          style={{ flex:1, background:"none", border:"none", outline:"none", color:"#c8d8c8", fontFamily:"inherit", fontSize:12.5, caretColor:"#4caf84" }}
          placeholder="type a real command..."/>
      </div>
    </div>
  );
}
