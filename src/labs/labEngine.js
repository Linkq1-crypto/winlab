/**
 * WinLab — Lab Engine
 * Defines all 5 free labs with:
 *  - Simulated filesystem + file contents
 *  - State-based verification (not just command matching)
 *  - Dynamic df -h after deletion
 *  - Real-timestamp journalctl
 *  - Easter eggs for advanced commands
 *  - Victory data (time, concept, avg comparison)
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function ts() {
  return new Date().toLocaleString("en-US", {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

export function tsLine(msg) { return `${ts()} web01 ${msg}`; }

// ─── Global averages (for victory comparison) ────────────────────────────────
export const GLOBAL_AVG_MS = {
  "lab-apache":    240_000,  // 4 min average
  "lab-diskfull":  310_000,
  "lab-selinux":   420_000,
  "lab-cpu":       280_000,
  "lab-ssh":       350_000,
};

// ─── LAB DEFINITIONS ─────────────────────────────────────────────────────────

export const LABS = [

  // ── LAB 1: Apache syntax error ────────────────────────────────────────────
  {
    id: "lab-apache",
    title: "Lab 1 · Apache won't start",
    subtitle: "Incident: prod-web-01 · Port 80",
    difficulty: "easy",
    estimatedMin: 6,
    concept: "Config file debugging & service management",

    // Initial system state
    state: {
      apacheRunning: false,
      port80Free: true,      // nothing else on 80
      configFixed: false,
    },

    hints: [
      "Check the service status first — what does systemctl tell you?",
      "The error log is your best friend: cat /var/log/httpd/error_log",
      "There's a typo in httpd.conf. Open it with nano /etc/httpd/conf/httpd.conf",
      "Find 'ServerNaame' — that double 'a' is the culprit. Fix it with sed.",
    ],

    // Check function — receives systemState, returns { pass, partial, message }
    check(state) {
      if (state.apacheRunning && state.configFixed) {
        return { pass: true, partial: false, message: "Apache is active. Port 80 is responding. Incident closed." };
      }
      if (state.configFixed && !state.apacheRunning) {
        return { pass: false, partial: true, message: "Config looks good but Apache is still down. Did you restart it?" };
      }
      if (state.apacheRunning && !state.configFixed) {
        return { pass: false, partial: true, message: "Apache started but the config still has the typo — it'll fail on next reload." };
      }
      return { pass: false, partial: false, message: "Apache is down. Start your diagnosis with systemctl status httpd." };
    },

    easterEggs: {
      // Using sed instead of nano
      sed: { trigger: /^sed .* httpd\.conf/, xp: 20, msg: "⚡ Expert move — using sed instead of an editor. +20 XP bonus." },
      // Reading error log before checking status
      errorLogFirst: { trigger: /^cat.*error_log/, xp: 10, msg: "🔍 You went straight to the error log. Real SRE instinct. +10 XP." },
    },

    filesystem: {
      "/": ["etc", "var", "tmp", "home", "root"],
      "/etc": ["httpd", "nginx", "ssh", "hosts", "passwd"],
      "/etc/httpd": ["conf", "conf.d", "logs"],
      "/etc/httpd/conf": ["httpd.conf", "magic"],
      "/etc/httpd/conf.d": ["autoindex.conf", "welcome.conf"],
      "/var": ["log", "www", "cache"],
      "/var/log": ["httpd", "messages", "secure"],
      "/var/log/httpd": ["access_log", "error_log"],
      "/var/www": ["html"],
      "/var/www/html": ["index.html"],
    },

    files: {
      "/etc/httpd/conf/httpd.conf": {
        content: [
          "# Apache HTTP Server — Main Configuration",
          "ServerRoot \"/etc/httpd\"",
          "Listen 80",
          "",
          "ServerNaame web01.prod.local:80",   // <-- typo: double 'a'
          "ServerAdmin ops@company.com",
          "",
          "DocumentRoot \"/var/www/html\"",
          "<Directory \"/var/www/html\">",
          "    AllowOverride None",
          "    Require all granted",
          "</Directory>",
          "",
          "ErrorLog \"/var/log/httpd/error_log\"",
          "LogLevel warn",
        ],
        editable: true,
      },
      "/var/log/httpd/error_log": {
        content: [
          tsLine("httpd[2341]: AH00558: httpd: Could not reliably determine the server's FQDN"),
          tsLine("httpd[2341]: AH00526: Syntax error on line 5 of /etc/httpd/conf/httpd.conf:"),
          tsLine("httpd[2341]: Invalid command 'ServerNaame', perhaps misspelled or defined by a module not included in the server configuration"),
          tsLine("systemd[1]: httpd.service: Control process exited with error code."),
          tsLine("systemd[1]: Failed to start The Apache HTTP Server."),
        ],
        editable: false,
      },
      "/var/www/html/index.html": {
        content: ["<html><body><h1>WinLab Web Server</h1></body></html>"],
        editable: true,
      },
    },

    // systemctl responses
    services: {
      httpd: {
        getStatus(state) {
          if (state.apacheRunning) return [
            { text: "● httpd.service - The Apache HTTP Server", type: "out" },
            { text: "   Loaded: loaded (/usr/lib/systemd/system/httpd.service; enabled)", type: "out" },
            { text: `   Active: active (running) since ${ts()}`, type: "success" },
            { text: "  Process: 4821 ExecStart=/usr/sbin/httpd (code=exited, status=0/SUCCESS)", type: "out" },
            { text: " Main PID: 4821 (httpd)", type: "out" },
          ];
          return [
            { text: "● httpd.service - The Apache HTTP Server", type: "out" },
            { text: "   Loaded: loaded (/usr/lib/systemd/system/httpd.service; enabled)", type: "out" },
            { text: `   Active: failed (Result: exit-code) since ${ts()}`, type: "err" },
            { text: "  Process: 2341 ExecStart=/usr/sbin/httpd (code=exited, status=1/FAILURE)", type: "err" },
            { text: " Main PID: 2341 (code=exited, status=1/FAILURE)", type: "err" },
            { text: "", type: "out" },
            { text: `${ts()} web01 httpd[2341]: Syntax error on line 5 of /etc/httpd/conf/httpd.conf:`, type: "err" },
            { text: `${ts()} web01 httpd[2341]: Invalid command 'ServerNaame', perhaps misspelled`, type: "err" },
          ];
        },
        start(state) {
          if (!state.configFixed) return {
            lines: [
              { text: "Job for httpd.service failed because the control process exited with error code.", type: "err" },
              { text: `${ts()} web01 httpd: Syntax error on line 5 of /etc/httpd/conf/httpd.conf`, type: "err" },
              { text: "See 'journalctl -xe' for details.", type: "info" },
            ],
            stateUpdate: {},
          };
          return {
            lines: [
              { text: "Starting httpd.service — The Apache HTTP Server...", type: "info" },
              { text: `${ts()} web01 systemd[1]: Started httpd.service.`, type: "success" },
            ],
            stateUpdate: { apacheRunning: true },
          };
        },
        restart(state) { return this.start(state); },
      },
    },

    successMessages: [
      "INCIDENT RESOLVED — Apache is live on port 80",
      "Concept mastered: Config file debugging",
      "Skill unlocked: Reading error logs like a pro",
    ],
  },

  // ── LAB 2: Disk Full — orphan log + redirect trick ────────────────────────
  {
    id: "lab-diskfull",
    title: "Lab 2 · No space left on device",
    subtitle: "Incident: prod-app-01 · Storage",
    difficulty: "easy",
    estimatedMin: 8,
    concept: "Storage forensics & log management",

    state: {
      diskUsedGB: 50,
      diskTotalGB: 50,
      jenkinsLogRemoved: false,
      journalVacuumed: false,
    },

    hints: [
      "The disk is completely full. Start with df -h to see which partition.",
      "Use du -sh /var/log/* to find which log directory is eating space.",
      "There's an orphan Jenkins log that was never rotated: /var/log/jenkins/jenkins.log.1",
      "Pro tip: instead of rm, use > /var/log/jenkins/jenkins.log.1 to truncate without deleting.",
    ],

    check(state) {
      const freed = state.diskTotalGB - state.diskUsedGB;
      if (freed >= 10) return { pass: true, partial: false, message: `Disk at ${Math.round((state.diskUsedGB/state.diskTotalGB)*100)}%. Services recovered.` };
      if (freed >= 2) return { pass: false, partial: true, message: `Freed ${freed}GB but still under pressure. Find bigger files.` };
      return { pass: false, partial: false, message: "Disk still full. Use du -sh /var/log/* to find the biggest directories." };
    },

    easterEggs: {
      redirect: { trigger: /^>\s+\/var\/log\/jenkins\/jenkins\.log/, xp: 25, msg: "🧙 Truncation with redirect instead of rm — advanced ops move. +25 XP." },
      findCommand: { trigger: /^find .* -size \+/, xp: 15, msg: "🔎 Using find with -size flag. That's the SRE way. +15 XP." },
    },

    filesystem: {
      "/": ["etc", "var", "tmp", "home", "root"],
      "/var": ["log", "cache", "lib"],
      "/var/log": ["httpd", "nginx", "jenkins", "messages", "secure"],
      "/var/log/httpd": ["access_log", "error_log"],
      "/var/log/jenkins": ["jenkins.log", "jenkins.log.1"],
      "/tmp": [],
    },

    files: {
      "/var/log/jenkins/jenkins.log.1": {
        content: [
          "2024-01-01 00:00:01.000+0000 [id=1] INFO    jenkins.InitReactorRunner$1#onAttained: Started initialization",
          "... (42G of build output) ...",
          "2024-03-15 23:59:59.999+0000 [id=99] WARNING jenkins.model.Jenkins: Disk space critically low",
        ],
        size: "42G",
        editable: false,
      },
      "/var/log/jenkins/jenkins.log": {
        content: ["2024-04-01 09:00:01.000+0000 [id=1] INFO    jenkins.model.Jenkins: Jenkins is fully up and running"],
        size: "12M",
        editable: false,
      },
      "/var/log/messages": {
        content: [
          tsLine("kernel: EXT4-fs error (device sda1): ext4_find_entry: 247: inode #2: comm java: reading directory lblock 0"),
          tsLine("kernel: NOSPACE: No space left on /dev/sda1"),
          tsLine("systemd[1]: app.service: Failed to write PID to file /var/run/app.pid: No space left on device"),
        ],
        editable: false,
      },
    },

    // df output is dynamic
    getDfOutput(state) {
      const used = state.diskUsedGB;
      const total = state.diskTotalGB;
      const avail = total - used;
      const pct = Math.round((used / total) * 100);
      const color = pct >= 95 ? "err" : pct >= 80 ? "warn" : "success";
      return [
        { text: "Filesystem      Size  Used  Avail Use% Mounted on", type: "out" },
        { text: `/dev/sda1        ${total}G   ${used}G  ${avail < 0 ? 0 : avail}G  ${pct}% /`, type: color },
        { text: "tmpfs           3.9G     0  3.9G   0% /dev/shm", type: "out" },
      ];
    },

    services: {},
    successMessages: [
      "INCIDENT RESOLVED — Disk at 16%. Services writing again.",
      "Concept mastered: Log forensics & storage management",
      "Skill unlocked: du, find -size, truncation with >",
    ],
  },

  // ── LAB 3: SELinux / Permission Denied ────────────────────────────────────
  {
    id: "lab-selinux",
    title: "Lab 3 · Permission denied — SELinux blocks nginx",
    subtitle: "Incident: prod-web-02 · SELinux",
    difficulty: "medium",
    estimatedMin: 10,
    concept: "SELinux contexts & mandatory access control",

    state: {
      nginxRunning: true,
      selinuxContextFixed: false,
      chmod777Attempted: false,
    },

    hints: [
      "Nginx is running but returns 403. chmod 777 won't help here.",
      "This isn't a Unix permission issue — it's SELinux. Check with ls -Z /var/www/html/",
      "The file context is wrong: it shows 'user_home_t' instead of 'httpd_sys_content_t'",
      "Fix it with: restorecon -Rv /var/www/html/ or chcon -t httpd_sys_content_t /var/www/html/index.html",
    ],

    check(state) {
      if (state.selinuxContextFixed) return { pass: true, partial: false, message: "SELinux context restored. Nginx serving content correctly." };
      if (state.chmod777Attempted && !state.selinuxContextFixed) return {
        pass: false, partial: false,
        message: "chmod 777 had no effect — SELinux operates above DAC permissions. Check the security context with ls -Z.",
      };
      return { pass: false, partial: false, message: "Nginx is active but the site returns 403. SELinux is blocking access. Check 'ausearch -m avc -ts recent'." };
    },

    easterEggs: {
      ausearch: { trigger: /^ausearch/, xp: 30, msg: "🛡️ ausearch to read audit log — that's deep SELinux knowledge. +30 XP." },
      setenforce: { trigger: /^setenforce 0/, xp: -10, msg: "⚠️ Setting SELinux to Permissive is not the fix — it disables security. -10 XP. Fix the context instead." },
    },

    filesystem: {
      "/": ["etc", "var", "tmp"],
      "/var": ["log", "www"],
      "/var/www": ["html"],
      "/var/www/html": ["index.html"],
      "/etc": ["nginx", "selinux"],
      "/etc/nginx": ["nginx.conf"],
      "/etc/selinux": ["config"],
    },

    files: {
      "/var/www/html/index.html": {
        content: ["<html><body><h1>WinLab — Production</h1></body></html>"],
        selinuxContext: "unconfined_u:object_r:user_home_t:s0",  // wrong
        editable: false,
      },
      "/etc/selinux/config": {
        content: ["SELINUX=enforcing", "SELINUXTYPE=targeted"],
        editable: false,
      },
    },

    services: {
      nginx: {
        getStatus(state) {
          return [
            { text: "● nginx.service - The nginx HTTP and reverse proxy server", type: "out" },
            { text: "   Loaded: loaded (/usr/lib/systemd/system/nginx.service; enabled)", type: "out" },
            { text: `   Active: active (running) since ${ts()}`, type: "success" },
            { text: " Main PID: 1821 (nginx)", type: "out" },
            { text: "", type: "out" },
            { text: "nginx is running — but serving 403 Forbidden.", type: "warn" },
            { text: "Hint: the issue is not the service, it's SELinux context on the files.", type: "info" },
          ];
        },
        start(state) { return { lines: [{ text: "nginx is already running.", type: "info" }], stateUpdate: {} }; },
        restart(state) { return { lines: [{ text: "nginx restarted — but still returning 403. Check file contexts.", type: "warn" }], stateUpdate: {} }; },
      },
    },

    successMessages: [
      "INCIDENT RESOLVED — Nginx serving content. SELinux context correct.",
      "Concept mastered: SELinux Mandatory Access Control",
      "Skill unlocked: restorecon, chcon, ausearch, ls -Z",
    ],
  },

  // ── LAB 4: Rogue process / Memory leak ────────────────────────────────────
  {
    id: "lab-cpu",
    title: "Lab 4 · CPU at 100% — rogue process",
    subtitle: "Incident: prod-app-02 · Performance",
    difficulty: "medium",
    estimatedMin: 8,
    concept: "Process management & resource forensics",

    state: {
      rogueRunning: true,
      rogueKilled: false,
      serviceCrashDue: false,
    },

    hints: [
      "CPU is pegged at 100%. Use top or ps aux to find the culprit.",
      "Sort by CPU: ps aux --sort=-%cpu | head -10",
      "There's a process called 'malware_sim' (PID 9931) consuming 99% CPU.",
      "Kill it with: kill -9 9931 or killall malware_sim",
    ],

    check(state) {
      if (state.rogueKilled) return { pass: true, partial: false, message: "CPU back to normal. malware_sim terminated. System stable." };
      return { pass: false, partial: false, message: "CPU still at 100%. Find the rogue process with top or ps aux --sort=-%cpu." };
    },

    easterEggs: {
      strace: { trigger: /^strace -p/, xp: 35, msg: "🔬 strace to inspect a live process — senior SRE level. +35 XP." },
      lsof: { trigger: /^lsof -p/, xp: 20, msg: "🔎 Checking open files on the process. Thorough. +20 XP." },
      nice: { trigger: /^renice/, xp: 15, msg: "📊 Using renice before kill — measured response. +15 XP." },
    },

    filesystem: {
      "/": ["proc", "etc", "var", "tmp", "usr"],
      "/proc": ["9931"],
      "/proc/9931": ["cmdline", "status", "fd"],
      "/tmp": ["malware_sim", ".hidden_payload"],
    },

    files: {
      "/proc/9931/cmdline": {
        content: ["/tmp/malware_sim --loop --cpu-burn --no-sleep"],
        editable: false,
      },
      "/proc/9931/status": {
        content: [
          "Name:\tmalware_sim",
          "State:\tR (running)",
          "Pid:\t9931",
          "VmRSS:\t512 kB",
          "voluntary_ctxt_switches:\t0",
        ],
        editable: false,
      },
    },

    // top / ps output
    getTopOutput(state) {
      if (state.rogueKilled) return [
        { text: "top — CPU: 2.1% us,  0.5% sy,  0.0% ni, 97.3% id", type: "success" },
        { text: "  PID USER      PR  NI    VIRT    RES    SHR S  %CPU %MEM  TIME+    COMMAND", type: "out" },
        { text: " 1821 nginx     20   0   47956   8120   5432 S   0.3  0.1   0:01.22  nginx", type: "out" },
        { text: "    1 root      20   0  171220  10312   7844 S   0.0  0.1   0:03.44  systemd", type: "out" },
      ];
      return [
        { text: "top — CPU: 99.8% us,  0.1% sy,  0.0% ni,  0.0% id  ← OVERLOADED", type: "err" },
        { text: "  PID USER      PR  NI    VIRT    RES    SHR S  %CPU %MEM  TIME+    COMMAND", type: "out" },
        { text: " 9931 root      20   0    4096    512    256 R  99.1  0.0  42:17.33  malware_sim", type: "err" },
        { text: " 1821 nginx     20   0   47956   8120   5432 S   0.3  0.1   0:01.22  nginx", type: "out" },
        { text: "    1 root      20   0  171220  10312   7844 S   0.0  0.1   0:03.44  systemd", type: "out" },
      ];
    },

    services: {},
    successMessages: [
      "INCIDENT RESOLVED — CPU at 2%. System responsive.",
      "Concept mastered: Process forensics & signal handling",
      "Skill unlocked: top, ps aux, kill -9, strace",
    ],
  },

  // ── LAB 5: SSH port changed + firewall block ──────────────────────────────
  {
    id: "lab-ssh",
    title: "Lab 5 · SSH unreachable — port changed + iptables",
    subtitle: "Incident: prod-infra-01 · Access",
    difficulty: "hard",
    estimatedMin: 12,
    concept: "SSH hardening & iptables firewall",

    state: {
      sshPort: 2222,           // changed from default 22
      iptablesBlocking: true,  // iptables DROP on 22
      sshAccessible: false,
    },

    hints: [
      "You're on the server but SSH from outside is broken. Check the SSH config first.",
      "cat /etc/ssh/sshd_config | grep Port — the port was changed from 22 to 2222.",
      "Even on port 2222, iptables is blocking. Check: iptables -L INPUT -n -v",
      "Allow the new port: iptables -I INPUT -p tcp --dport 2222 -j ACCEPT",
    ],

    check(state) {
      if (!state.iptablesBlocking && state.sshPort !== 22) {
        return { pass: true, partial: false, message: "SSH accessible on port 2222. Firewall rule applied. Incident closed." };
      }
      if (!state.iptablesBlocking && state.sshPort === 22) {
        return { pass: false, partial: true, message: "Firewall fixed but SSH port is still 2222 in sshd_config — clients need to use -p 2222." };
      }
      if (state.iptablesBlocking) {
        return { pass: false, partial: false, message: "iptables is still blocking port 2222. Add the ACCEPT rule before the DROP." };
      }
      return { pass: false, partial: false, message: "Start with: cat /etc/ssh/sshd_config | grep -i port" };
    },

    easterEggs: {
      iptablesSave: { trigger: /^iptables-save|service iptables save|firewall-cmd --runtime-to-permanent/, xp: 20, msg: "💾 Persisting iptables rules — won't survive a reboot otherwise. +20 XP." },
      fail2ban: { trigger: /^fail2ban/, xp: 25, msg: "🛡️ Checking fail2ban — maybe it auto-blocked the port. Thorough thinking. +25 XP." },
      sshdReload: { trigger: /^systemctl reload sshd/, xp: 10, msg: "⚡ Reload instead of restart — zero dropped connections. +10 XP." },
    },

    filesystem: {
      "/": ["etc", "var", "tmp"],
      "/etc": ["ssh", "sysconfig"],
      "/etc/ssh": ["sshd_config", "ssh_config"],
      "/etc/sysconfig": ["iptables"],
    },

    files: {
      "/etc/ssh/sshd_config": {
        content: [
          "# OpenSSH Server Configuration",
          "Port 2222",
          "# Port 22 — disabled for security hardening",
          "AddressFamily any",
          "ListenAddress 0.0.0.0",
          "PermitRootLogin prohibit-password",
          "PasswordAuthentication no",
          "PubkeyAuthentication yes",
          "AuthorizedKeysFile .ssh/authorized_keys",
        ],
        editable: true,
      },
      "/etc/sysconfig/iptables": {
        content: [
          "*filter",
          ":INPUT DROP [0:0]",
          ":FORWARD DROP [0:0]",
          ":OUTPUT ACCEPT [0:0]",
          "-A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT",
          "-A INPUT -p tcp --dport 22 -j DROP",
          "# NOTE: port 2222 not yet allowed",
          "COMMIT",
        ],
        editable: true,
      },
    },

    // iptables -L output
    getIptablesOutput(state) {
      const lines = [
        { text: "Chain INPUT (policy DROP)", type: state.iptablesBlocking ? "err" : "out" },
        { text: "num  target   prot  opt  source      destination", type: "out" },
        { text: "1    ACCEPT   all   --   anywhere    anywhere   state RELATED,ESTABLISHED", type: "success" },
      ];
      if (!state.iptablesBlocking) {
        lines.push({ text: "2    ACCEPT   tcp   --   anywhere    anywhere   tcp dpt:2222", type: "success" });
      }
      lines.push({ text: `${state.iptablesBlocking ? "2" : "3"}    DROP     tcp   --   anywhere    anywhere   tcp dpt:22`, type: "err" });
      return lines;
    },

    services: {
      sshd: {
        getStatus(state) {
          return [
            { text: "● sshd.service - OpenSSH server daemon", type: "out" },
            { text: "   Loaded: loaded (/usr/lib/systemd/system/sshd.service; enabled)", type: "out" },
            { text: `   Active: active (running) since ${ts()}`, type: "success" },
            { text: ` Main PID: 1122 (sshd) — listening on port ${state.sshPort}`, type: state.iptablesBlocking ? "warn" : "success" },
            ...(state.iptablesBlocking ? [
              { text: "", type: "out" },
              { text: `⚠️  sshd is running on port ${state.sshPort} but iptables is blocking it.`, type: "warn" },
            ] : []),
          ];
        },
        start(state) { return { lines: [{ text: "sshd is already running.", type: "info" }], stateUpdate: {} }; },
        restart(state) { return { lines: [{ text: `sshd restarted on port ${state.sshPort}.`, type: "success" }], stateUpdate: {} }; },
        reload(state) { return { lines: [{ text: `sshd reloaded — port ${state.sshPort}.`, type: "success" }], stateUpdate: {} }; },
      },
    },

    successMessages: [
      "INCIDENT RESOLVED — SSH accessible on port 2222.",
      "Concept mastered: SSH hardening & iptables rules",
      "Skill unlocked: iptables -I, sshd_config, firewall persistence",
    ],
  },
];

// ─── Victory screen data builder ─────────────────────────────────────────────

export function buildVictory(labId, timeMs, commandCount, easterEggsFound) {
  const avg = GLOBAL_AVG_MS[labId] || 300_000;
  const diff = avg - timeMs;
  const lab = LABS.find(l => l.id === labId);
  const bonusXp = easterEggsFound.reduce((sum, e) => sum + (e.xp || 0), 0);
  const baseXp = 100;

  return {
    time: `${(timeMs / 1000).toFixed(1)}s`,
    vs_avg: diff > 0
      ? `${(diff / 1000).toFixed(0)}s faster than average`
      : `${(Math.abs(diff) / 1000).toFixed(0)}s slower than average`,
    faster: diff > 0,
    xp: baseXp + bonusXp,
    concept: lab?.concept || "Linux operations",
    easterEggs: easterEggsFound,
  };
}
