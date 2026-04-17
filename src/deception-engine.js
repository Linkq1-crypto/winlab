// deception-engine.js – Honeypot + Deception System for WINLAB SOC
// Three layers: Gateway → Honeypot Sandbox → Intelligence Collector → AI SOC

// ─────────────────────────────────────────────────────────────────────────────
// 1. THREAT DETECTION (Deception Gateway)
// ─────────────────────────────────────────────────────────────────────────────

const THREAT_PATTERNS = {
  sqlInjection: [
    /('|%27)\s*(or|and)\s*('|%27)\s*=\s*('|%27)/i,
    /union\s+select/i,
    /;\s*drop\s+table/i,
    /'\s*or\s+'1'\s*=\s*'1/i,
    /admin'\s*--/i,
  ],
  xss: [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<img\s+src/i,
    /<iframe/i,
    /<svg\s+onload/i,
  ],
  pathTraversal: [
    /\.\.[\/\\]/,
    /%2e%2e[\/\\]/i,
    /\.\.%2f/i,
    /%252e%252e/i,
  ],
  commandInjection: [
    /;\s*(ls|cat|rm|wget|curl|bash|sh|nc|netcat|python|perl|ruby)/i,
    /\|\s*(bash|sh|nc|cat)/i,
    /`[^`]+`/,
    /\$\([^)]+\)/,
    /&&\s*(rm|wget|curl|bash)/i,
  ],
  recon: [
    /\b(nmap|nikto|sqlmap|dirb|gobuster|hydra|metasploit|burpsuite)\b/i,
    /\/etc\/passwd/i,
    /\/etc\/shadow/i,
    /wp-admin/i,
    /phpmyadmin/i,
    /\.env\b/i,
    /\.git\b/i,
    /robots\.txt/i,
  ],
  exploit: [
    /rm\s+-rf/i,
    /chmod\s+777/i,
    /wget\s+.*\|\s*bash/i,
    /curl\s+.*\|\s*sh/i,
    /base64\s+-d/i,
    /python\s+-c\s+['"]/i,
    /php\s+-r\s+['"]/i,
    /\/dev\/tcp\//i,
    /\/dev\/udp\//i,
  ],
};

function detectThreat(input) {
  if (!input || typeof input !== "string") return { threat: false, score: 0 };

  let score = 0;
  const triggers = [];

  for (const [category, patterns] of Object.entries(THREAT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        score += category === "exploit" ? 3 : category === "sqlInjection" || category === "commandInjection" ? 2.5 : 1.5;
        triggers.push(category);
      }
    }
  }

  return {
    threat: score >= 2,
    score: Math.min(score, 10),
    triggers: [...new Set(triggers)],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. HONEYPOT ENVIRONMENTS (Fake Systems)
// ─────────────────────────────────────────────────────────────────────────────

const HONEYPOT_ENVS = {
  "prod-db-01": {
    type: "database",
    hostname: "prod-db-01",
    os: "Ubuntu 22.04 LTS",
    users: ["admin", "root", "dbadmin", "backup_svc"],
    filesystem: {
      "/etc/passwd": "root:x:0:0:root:/root:/bin/bash\nadmin:x:1000:1000:Admin User:/home/admin:/bin/bash\ndbadmim:x:1001:1001:DB Admin:/home/dbadmin:/bin/bash\nbackup_svc:x:999:999:Backup Service:/var/backups:/usr/sbin/nologin",
      "/etc/shadow": "[PERMISSION DENIED]",
      "/var/log/auth.log": "Mar 15 08:23:01 prod-db-01 CRON[12345]: pam_unix(cron:session): session opened for user backup_svc\nMar 15 08:23:01 prod-db-01 CRON[12345]: pam_unix(cron:session): session closed for user backup_svc\nMar 15 09:00:00 prod-db-01 systemd[1]: Started PostgreSQL database server.\nMar 15 09:15:22 prod-db-01 sshd[23456]: Accepted publickey for admin from 10.0.1.50 port 43210\nMar 15 10:30:45 prod-db-01 sudo: admin : TTY=pts/0 ; PWD=/home/admin ; USER=root ; COMMAND=/usr/bin/systemctl restart postgresql",
      "/home/admin/.bash_history": "psql -U postgres\npg_dump production_db > backup.sql\nsystemctl status postgresql\nssh deploy@10.0.1.100\ncat /etc/hosts",
      "/home/admin/backup.sql": "-- PostgreSQL database dump\n-- Dumped from database version 14.7\n\\connect production_db\nCREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255), password_hash VARCHAR(255));\nINSERT INTO users VALUES (1, 'admin@company.com', '$2b$10$fakehash');",
      "/opt/app/config.json": '{\n  "database": {\n    "host": "10.0.1.10",\n    "port": 5432,\n    "name": "production_db",\n    "user": "dbadmin",\n    "password": "DB_P@ss2024!"\n  },\n  "api_key": "sk_live_honeypot_7f3a9b2c1d4e5f6a"\n}',
      "/var/backups/daily_backup.tar.gz": "[Binary file — 2.3 GB]",
    },
    fakeSecrets: {
      dbPassword: "DB_P@ss2024!",
      apiKey: "sk_live_honeypot_7f3a9b2c1d4e5f6a",
      jwtSecret: "jwt-secret-do-not-share-2024",
    },
    services: ["postgresql:5432", "ssh:22", "nginx:80"],
  },
  "web-app-01": {
    type: "webserver",
    hostname: "web-app-01",
    os: "CentOS 8",
    users: ["www-data", "deploy", "admin", "jenkins"],
    filesystem: {
      "/etc/passwd": "root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\ndeploy:x:1000:1000:Deploy User:/home/deploy:/bin/bash\njenkins:x:998:998:Jenkins CI:/var/lib/jenkins:/bin/bash",
      "/var/log/apache2/access.log": '10.0.1.50 - - [15/Mar/2024:08:23:01 +0000] "GET /api/users HTTP/1.1" 200 1234\n10.0.1.51 - - [15/Mar/2024:08:23:02 +0000] "POST /api/login HTTP/1.1" 200 567\n192.168.1.100 - - [15/Mar/2024:09:15:22 +0000] "GET /admin HTTP/1.1" 403 123\n10.0.1.52 - - [15/Mar/2024:10:30:45 +0000] "GET /api/health HTTP/1.1" 200 15',
      "/home/deploy/.env": "NODE_ENV=production\nDB_HOST=10.0.1.10\nDB_USER=deploy_user\nDB_PASS=WebApp!2024Secure\nJWT_SECRET=jwt-webapp-prod-key\nSTRIPE_KEY=sk_live_webapp_fake_key_abc123",
      "/var/www/html/index.html": "<!DOCTYPE html>\n<html>\n<head><title>WINLAB Production</title></head>\n<body><h1>Production Environment v3.2.1</h1></body>\n</html>",
      "/etc/nginx/sites-enabled/default": "server {\n  listen 80;\n  server_name app.winlab.cloud;\n  location / { proxy_pass http://127.0.0.1:3000; }\n  location /api/ { proxy_pass http://127.0.0.1:3001; }\n}",
    },
    fakeSecrets: {
      dbPass: "WebApp!2024Secure",
      jwtSecret: "jwt-webapp-prod-key",
      stripeKey: "sk_live_webapp_fake_key_abc123",
    },
    services: ["nginx:80", "node:3000", "node:3001", "ssh:22"],
  },
  "dc-01": {
    type: "domain-controller",
    hostname: "dc-01.corp.winlab.local",
    os: "Windows Server 2022",
    users: ["Administrator", "Domain Admins", "svc-ldap", "jsmith", "admin_msp"],
    filesystem: {
      "C:\\Windows\\System32\\config\\sam": "[ACCESS DENIED — SYSTEM FILE]",
      "C:\\Users\\Administrator\\Desktop\\credentials.txt": "LDAP Bind Password: Ld@pB!nd2024\nService Account: svc-ldap / SvcP@ss2024!\nDomain: corp.winlab.local",
      "C:\\inetpub\\wwwroot\\web.config": '<?xml version="1.0"?>\n<configuration>\n  <connectionStrings>\n    <add name="Default" connectionString="Server=dc-01;Database=WinLabAD;Integrated Security=true;" />\n  </connectionStrings>\n</configuration>',
      "C:\\ProgramData\\scripts\\setup.ps1": "# Domain Controller Setup Script\n$domainName = 'corp.winlab.local'\n$adminPassword = ConvertTo-SecureString 'Adm!n2024Secure' -AsPlainText -Force\nNew-ADOrganizationalUnit -Name 'IT' -Path 'DC=corp,DC=winlab,DC=local'",
    },
    fakeSecrets: {
      adminPassword: "Adm!n2024Secure",
      ldapBind: "Ld@pB!nd2024",
      serviceAccount: "svc-ldap / SvcP@ss2024!",
    },
    services: ["ldap:389", "ldaps:636", "kerberos:88", "dns:53", "rdp:3389"],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. HONEYPOT COMMAND PROCESSOR (Fake Terminal)
// ─────────────────────────────────────────────────────────────────────────────

function realisticDelay() {
  return new Promise((r) => setTimeout(r, Math.random() * 400 + 100));
}

async function processHoneypotCommand(cmd, env, state) {
  await realisticDelay();

  const parts = cmd.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase();
  const args = parts.slice(1).join(" ");

  const hostname = env.hostname.split(".")[0];

  // Credential honeypot detection
  if (env.fakeSecrets) {
    for (const [key, val] of Object.entries(env.fakeSecrets)) {
      if (cmd.includes(val) || cmd.includes(key)) {
        state.usedFakeCredentials = state.usedFakeCredentials || [];
        state.usedFakeCredentials.push({ key, timestamp: Date.now(), command: cmd });
      }
    }
  }

  switch (command) {
    case "whoami":
      return state.currentUser || "root";

    case "hostname":
      return env.hostname;

    case "uname":
      if (args === "-a" || args === "-r") return `${env.os} ${env.type === "domain-controller" ? "10.0.20348" : "5.15.0-91-generic"} x86_64 GNU/Linux`;
      return env.os;

    case "id":
      return state.currentUser === "root" ? "uid=0(root) gid=0(root) groups=0(root)" : `uid=1000(${state.currentUser || "admin"}) gid=1000(${state.currentUser || "admin"}) groups=1000(${state.currentUser || "admin"}),27(sudo)`;

    case "pwd":
      return state.cwd || (state.currentUser === "root" ? "/root" : "/home/admin");

    case "ls":
      if (state.cwd === "/etc") return "passwd shadow shadow- group gshadow hosts nginx ssh sudoers crontab";
      if (state.cwd === "/var/log") return "auth.log syslog syslog.1 kern.log dpkg.log nginx/ apache2/";
      if (state.cwd === "/home/admin") return "backup.sql credentials.txt .bash_history .ssh/ projects/";
      if (state.cwd === "/opt/app") return "config.json app.js node_modules/ package.json .env";
      if (state.cwd === "/var/www/html") return "index.html static/ api/ uploads/";
      return "bin boot dev etc home lib lib64 media mnt opt proc root run sbin srv sys tmp usr var";

    case "cat":
      if (state.cwd && env.filesystem[`${state.cwd}/${args}`]) return env.filesystem[`${state.cwd}/${args}`];
      if (env.filesystem[args]) return env.filesystem[args];
      if (args.includes("shadow") && state.currentUser !== "root") return "cat: /etc/shadow: Permission denied";
      return `cat: ${args}: No such file or directory`;

    case "cd":
      if (args === "~" || !args) state.cwd = "/home/admin";
      else if (args === "..") state.cwd = state.cwd?.split("/").slice(0, -1).join("/") || "/";
      else state.cwd = args.startsWith("/") ? args : `${state.cwd || "/"}/${args}`;
      return "";

    case "sudo":
      if (state.currentUser === "root") return `sudo: ${args}: command executed`;
      return `[sudo] password for ${state.currentUser || "admin"}:`;

    case "ps":
      return `  PID TTY          TIME CMD\n    1 ?        00:00:01 systemd\n  234 ?        00:00:00 sshd\n  567 ?        00:00:02 nginx\n  890 ?        00:00:15 postgres\n 1011 ?        00:00:01 cron\n ${1000 + Math.floor(Math.random() * 9000)} pts/0    00:00:00 ps`;

    case "netstat":
    case "ss":
      return `Active Internet connections\nProto Recv-Q Send-Q Local Address           Foreign Address         State\n${env.services.map((s) => `tcp        0      0 0.0.0.0:${s.split(":")[1]}          0.0.0.0:*               LISTEN`).join("\n")}`;

    case "ifconfig":
    case "ip":
      return `eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n        inet 10.0.1.${10 + Math.floor(Math.random() * 240)}  netmask 255.255.255.0  broadcast 10.0.1.255\n        inet6 fe80::a00:27ff:fe8e:1234  prefixlen 64  scopeid 0x20<link>\n        ether 08:00:27:8e:12:34  txqueuelen 1000  (Ethernet)`;

    case "curl":
    case "wget":
      return `  % Total    % Received\n100   123  100   123    0     0   4500      0 --:--:-- --:--:-- --:--:--  4500\n<!DOCTYPE html><html><head><title>403 Forbidden</title></head></html>`;

    case "nmap":
      return `Starting Nmap 7.93\nNmap scan report for ${env.hostname} (${10 + Math.floor(Math.random() * 240)}.0.1.${10 + Math.floor(Math.random() * 240)})\nPORT     STATE SERVICE\n${env.services.map((s) => `${s.split(":")[1].padEnd(8)}open  ${s.split(":")[0]}`).join("\n")}\n\nNmap done: 1 IP address (1 host up) scanned in 3.21 seconds`;

    case "find":
      return `/usr/bin/find: '${args || "."}': Permission denied`;

    case "chmod":
    case "chown":
      return `chmod: changing permissions of '${args.split(" ").pop()}': Operation not permitted`;

    case "rm":
      if (args.includes("-rf") && (args.includes("/") || args.includes("/*"))) return "rm: cannot remove '/': Operation not permitted — protected filesystem";
      return `rm: removing '${args.split(" ").filter((a) => !a.startsWith("-")).pop() || "file"}'`;

    case "passwd":
      return "passwd: Authentication token manipulation error\n(This is a honeypot — your attempt has been logged)";

    case "ssh":
      return `ssh: connect to host ${args.split(" ")[0] || "target"} port 22: Connection timed out`;

    case "ping":
      return `PING ${args.split(" ")[0] || "8.8.8.8"} (${args.split(" ")[0] || "8.8.8.8"}): 56 data bytes\n64 bytes: icmp_seq=0 ttl=64 time=1.234 ms\n64 bytes: icmp_seq=1 ttl=64 time=1.456 ms\n--- ping statistics ---\n2 packets transmitted, 2 packets received, 0.0% packet loss`;

    case "history":
      return state.history?.join("\n") || "    1  ps aux\n    2  cat /etc/passwd\n    3  ls -la /home\n    4  sudo -l\n    5  whoami";

    case "env":
      return `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\nHOME=${state.cwd || "/home/admin"}\nUSER=${state.currentUser || "admin"}\nHOSTNAME=${env.hostname}\nSHELL=/bin/bash`;

    case "help":
      return "Available: ls, cat, cd, pwd, whoami, hostname, ps, netstat, ifconfig, ping, ssh, curl, wget, nmap, find, env, history, clear";

    case "clear":
      return "__CLEAR__";

    case "":
      return "";

    default:
      // Simulate "command not found" with realistic path
      return `bash: ${command}: command not found`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ATTACKER PROFILING
// ─────────────────────────────────────────────────────────────────────────────

function profileAttacker(history) {
  if (!history || history.length === 0) return { type: "unknown", skill: "unknown", intent: "unknown" };

  const commands = history.map((h) => h.command || h).filter(Boolean);
  const uniqueCommands = [...new Set(commands.map((c) => c.trim().split(/\s+/)[0]?.toLowerCase()))];

  let score = 0;
  const behaviors = [];

  // Script kiddie indicators
  if (commands.some((c) => /nmap|sqlmap|nikto/i.test(c))) { score += 1; behaviors.push("uses automated scanners"); }
  if (commands.some((c) => /rm\s+-rf|chmod\s+777/i.test(c))) { score += 1; behaviors.push("destructive commands"); }
  if (commands.some((c) => /wget.*\|.*bash|curl.*\|.*sh/i.test(c))) { score += 2; behaviors.push("payload download + execution"); }

  // Recon indicators
  if (commands.some((c) => /cat\s+\/etc\/passwd/i.test(c))) { score += 1; behaviors.push("credential probing"); }
  if (commands.some((c) => /cat\s+.*\.env|cat\s+.*config/i.test(c))) { score += 1; behaviors.push("configuration file hunting"); }
  if (commands.some((c) => /find\s+/i.test(c))) { score += 0.5; behaviors.push("file system enumeration"); }

  // Advanced indicators
  if (commands.some((c) => /\/dev\/tcp|\/dev\/udp/i.test(c))) { score += 3; behaviors.push("reverse shell attempt"); }
  if (commands.some((c) => /python\s+-c|perl\s+-e|ruby\s+-e/i.test(c))) { score += 2; behaviors.push("polyglot shell execution"); }
  if (commands.some((c) => /base64\s+-d/i.test(c))) { score += 2; behaviors.push("encoded payload execution"); }
  if (commands.some((c) => /union\s+select|or\s+1\s*=\s*1/i.test(c))) { score += 2; behaviors.push("SQL injection"); }

  let type, skill;
  if (score <= 1) { type = "script-kiddie"; skill = "beginner"; }
  else if (score <= 3) { type = "recon-user"; skill = "intermediate"; }
  else if (score <= 5) { type = "pentester"; skill = "advanced"; }
  else { type = "apt-suspect"; skill = "expert"; }

  let intent = "exploration";
  if (behaviors.some((b) => b.includes("credential") || b.includes("password"))) intent = "credential-theft";
  if (behaviors.some((b) => b.includes("reverse shell") || b.includes("polyglot"))) intent = "system-compromise";
  if (behaviors.some((b) => b.includes("destructive"))) intent = "sabotage";

  return { type, skill, intent, behaviors, score };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. INTELLIGENCE COLLECTOR
// ─────────────────────────────────────────────────────────────────────────────

function createIntelCollector() {
  const sessions = new Map();

  function createSession(sessionId, ip, userAgent, env) {
    sessions.set(sessionId, {
      id: sessionId,
      ip,
      userAgent: userAgent?.slice(0, 200),
      env,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      commands: [],
      threatScore: 0,
      profile: null,
      usedFakeCredentials: [],
      isActive: true,
    });
    return sessions.get(sessionId);
  }

  function recordCommand(sessionId, command, output) {
    const session = sessions.get(sessionId);
    if (!session) return;

    const threat = detectThreat(command);
    session.commands.push({ command, output, threat, timestamp: Date.now() });
    session.lastActivity = Date.now();
    session.threatScore = Math.max(session.threatScore, threat.score);

    // Update profile every 5 commands
    if (session.commands.length % 5 === 0) {
      session.profile = profileAttacker(session.commands);
    }
  }

  function getSession(sessionId) {
    return sessions.get(sessionId);
  }

  function getAllSessions() {
    return [...sessions.values()].filter((s) => s.isActive);
  }

  function getStats() {
    const all = getAllSessions();
    const profiles = all.filter((s) => s.profile).map((s) => s.profile);
    return {
      activeAttackers: all.length,
      totalCommands: all.reduce((sum, s) => sum + s.commands.length, 0),
      avgThreatScore: all.length ? (all.reduce((sum, s) => sum + s.threatScore, 0) / all.length).toFixed(1) : 0,
      topAttackers: all.sort((a, b) => b.threatScore - a.threatScore).slice(0, 5).map((s) => ({
        ip: s.ip,
        env: s.env,
        threatScore: s.threatScore,
        commands: s.commands.length,
        profile: s.profile,
      })),
      skillDistribution: {
        beginner: profiles.filter((p) => p.skill === "beginner").length,
        intermediate: profiles.filter((p) => p.skill === "intermediate").length,
        advanced: profiles.filter((p) => p.skill === "advanced").length,
        expert: profiles.filter((p) => p.skill === "expert").length,
      },
      credentialDetections: all.reduce((sum, s) => sum + (s.usedFakeCredentials?.length || 0), 0),
    };
  }

  function closeSession(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      session.closedAt = Date.now();
      // Final profile
      session.profile = profileAttacker(session.commands);
    }
  }

  return { createSession, recordCommand, getSession, getAllSessions, getStats, closeSession };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export {
  detectThreat,
  THREAT_PATTERNS,
  HONEYPOT_ENVS,
  processHoneypotCommand,
  profileAttacker,
  realisticDelay,
  createIntelCollector,
};
