import { useState, useRef, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────
const init = () => ({
  // root causes (multiple layered)
  sssdRunning:       false,   // sssd crashed
  sssdCacheCleared:  false,
  nsswitchBroken:    false,   // nsswitch.conf has sss before files — but sssd is down
  ldapReachable:     true,    // LDAP server itself is up
  kerberosOk:        true,
  // fix path
  checkedId:         false,
  checkedGetent:     false,
  checkedSssd:       false,
  checkedJournal:    false,
  checkedNsswitch:   false,
  checkedLdap:       false,
  sssdRestarted:     false,
  cacheCleared:      false,
  tested:            false,
  solved:            false,
});

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE
// ─────────────────────────────────────────────────────────────────────────────
function run(raw, st, set) {
  const p   = raw.trim().split(/\s+/);
  const cmd = p[0];
  const rest = p.slice(1).join(" ");

  const o  = v => ({ t: "out",  v });
  const e  = v => ({ t: "err",  v });
  const ok = v => ({ t: "ok",   v });
  const w  = v => ({ t: "warn", v });
  const d  = v => ({ t: "dim",  v });

  // ── id ───────────────────────────────────────────────────────────────────
  if (cmd === "id") {
    set(s => ({ ...s, checkedId: true }));
    const user = rest.split(" ").find(x => !x.startsWith("-")) || "";
    if (user === "root" || user === "") return [o(`uid=0(root) gid=0(root) groups=0(root)`)];
    if (user === "giovanni" || user === "ops" || user === "deploy") {
      if (st.sssdRunning) return [ok(`uid=10021(${user}) gid=10020(domainusers) groups=10020(domainusers),10050(sudoers),10055(ops-team)`)];
      return [e(`id: '${user}': no such user`), w(`# Utente esiste su LDAP ma il sistema non lo trova — problema NSS/sssd`)];
    }
    if (user === "apache" || user === "nginx" || user === "mysql") return [o(`uid=48(${user}) gid=48(${user}) groups=48(${user})`)];
    if (st.sssdRunning) return [ok(`uid=10030(${user}) gid=10020(domainusers) groups=10020(domainusers)`)];
    return [e(`id: '${user}': no such user`)];
  }

  // ── getent ────────────────────────────────────────────────────────────────
  if (cmd === "getent") {
    set(s => ({ ...s, checkedGetent: true }));
    const db   = p[1]; // passwd, group, hosts
    const key  = p[2] || "";

    if (db === "passwd") {
      if (!key) {
        // list all
        const local = [
          `root:x:0:0:root:/root:/bin/bash`,
          `bin:x:1:1:bin:/bin:/sbin/nologin`,
          `daemon:x:2:2:daemon:/sbin:/sbin/nologin`,
          `apache:x:48:48:Apache:/usr/share/httpd:/sbin/nologin`,
          `nginx:x:996:993:Nginx:/var/lib/nginx:/sbin/nologin`,
          `mysql:x:27:27:MySQL Server:/var/lib/mysql:/sbin/nologin`,
        ];
        if (st.sssdRunning) return [
          ...local.map(o),
          ok(`giovanni:x:10021:10020:Giovanni Spata:/home/giovanni:/bin/bash`),
          ok(`m.rossi:x:10022:10020:Marco Rossi:/home/m.rossi:/bin/bash`),
          ok(`deploy:x:10041:10040:Deploy Bot:/home/deploy:/bin/bash`),
          ok(`# ... 348 utenti di dominio caricati da LDAP via sssd`),
        ];
        return [
          ...local.map(o),
          w(`# Solo 6 utenti locali — gli utenti di dominio (LDAP) non compaiono`),
          w(`# sssd non sta servendo le richieste NSS`),
        ];
      }
      // specific user
      if (key === "giovanni" || key === "deploy" || key === "m.rossi") {
        if (st.sssdRunning) return [ok(`${key}:x:10021:10020::/home/${key}:/bin/bash`)];
        return [w(`# getent passwd ${key}: nessun risultato — sssd non risponde`)];
      }
      if (key === "root") return [o(`root:x:0:0:root:/root:/bin/bash`)];
      return [];
    }
    if (db === "group") {
      if (st.sssdRunning) return [ok(`domainusers:x:10020:giovanni,m.rossi,deploy`), ok(`ops-team:x:10055:giovanni,l.ferrari`), ok(`sudoers:x:10050:giovanni`)];
      return [w(`# Nessun gruppo di dominio — sssd non risponde alle query NSS`)];
    }
    if (db === "hosts") return [o(`127.0.0.1       localhost`), o(`10.0.1.100      app01.prod`)];
    return [];
  }

  // ── systemctl sssd ────────────────────────────────────────────────────────
  if (cmd === "systemctl") {
    const sub  = p[1];
    const unit = (p[2] || "").replace(".service", "");

    if (sub === "status") {
      if (unit === "sssd") {
        set(s => ({ ...s, checkedSssd: true }));
        if (st.sssdRunning) return [
          ok(`● sssd.service - System Security Services Daemon`),
          ok(`   Active: active (running) since Mon 2026-03-04 11:09:42 CET`),
          ok(`Main PID: 14201 (sssd)`),
          ok(`   CGroup: /system.slice/sssd.service`),
          ok(`           ├─14201 /usr/sbin/sssd -i --logger=files`),
          ok(`           └─14202 sssd_be[acmecorp.local]`),
        ];
        return [
          e(`● sssd.service - System Security Services Daemon`),
          e(`   Loaded: loaded (/usr/lib/systemd/system/sssd.service; enabled)`),
          e(`   Active: failed (Result: exit-code) since Mon 2026-03-04 08:12:33 CET`),
          e(`  Process: 8821 ExecStart=/usr/sbin/sssd -i --logger=files (code=exited, status=1)`),
          e(` Main PID: 8821 (code=exited, status=1/FAILURE)`),
          o(``),
          e(`Mar 04 08:12:33 app01 sssd[8821]: [sssd] [sss_ini_get_config] (0x0020): Error reading config file: [/etc/sssd/sssd.conf] - [13] Permission denied`),
          e(`Mar 04 08:12:33 app01 sssd[8821]: [sssd] [server_setup] (0x0020): fatal error initializing confdb`),
          e(`Mar 04 08:12:33 app01 systemd[1]: Failed to start System Security Services Daemon.`),
          o(``),
          w(`# sssd down dalle 08:12 — 3 ore fa. Impossibile leggere sssd.conf: Permission denied`),
        ];
      }
      if (unit === "oddjobd" || unit === "oddjobd") return [ok(`oddjobd.service  Active: active (running)`)];
      if (unit === "sshd") return [ok(`sshd.service  Active: active (running)`)];
      if (unit === "nscd") return [e(`nscd.service  Active: inactive (dead)`)];
      return [o(`${unit}.service: active`)];
    }

    if (sub === "restart" || sub === "start") {
      if (unit === "sssd") {
        if (!st.permFixed) {
          return [
            e(`Job for sssd.service failed.`),
            e(`Mar 04 11:07:12 app01 sssd[9210]: Error reading config file: [/etc/sssd/sssd.conf] - [13] Permission denied`),
            w(`# Stessa causa — permessi su sssd.conf ancora sbagliati`),
          ];
        }
        set(s => ({ ...s, sssdRunning: true, sssdRestarted: true }));
        return [
          ok(`Started sssd.service.`),
          ok(`sssd[9210]: Starting up`),
          ok(`sssd_be[acmecorp.local]: LDAP connection to ldap01.acmecorp.local:389 established`),
          ok(`sssd[9210]: Backend [acmecorp.local] is online`),
          ok(`# sssd operativo — utenti di dominio disponibili`),
        ];
      }
      if (unit === "nscd") return [ok(`nscd started.`)];
      return [ok(`${unit} started.`)];
    }
    if (sub === "enable" && unit === "sssd") return [ok(`Created symlink: sssd.service → enabled`)];
    if (sub === "list-units") return [
      o(`sshd.service        loaded active  running`),
      e(`sssd.service        loaded failed  failed   ← DOWN`),
      o(`oddjobd.service     loaded active  running`),
      o(`httpd.service       loaded active  running`),
    ];
  }

  // ── journalctl sssd ───────────────────────────────────────────────────────
  if (cmd === "journalctl") {
    set(s => ({ ...s, checkedJournal: true }));
    if (raw.includes("sssd") || raw.includes("-xe")) {
      if (st.sssdRunning) return [ok(`sssd[9210]: LDAP connection established`), ok(`sssd[9210]: Backend [acmecorp.local] is online`)];
      return [
        e(`Mar 04 08:12:33 app01 sssd[8821]: [sssd] [sss_ini_get_config] (0x0020): Error reading config file: [/etc/sssd/sssd.conf] - [13] Permission denied`),
        e(`Mar 04 08:12:33 app01 sssd[8821]: [sssd] [server_setup] (0x0020): fatal error initializing confdb`),
        e(`Mar 04 08:12:33 app01 systemd[1]: sssd.service: Main process exited, code=exited, status=1/FAILURE`),
        o(``),
        d(`-- History before crash --`),
        o(`Mar 04 08:10:01 app01 sssd[8810]: Enumeration request: 348 users loaded`),
        o(`Mar 04 08:11:48 app01 sudo[8891]: deploy : TTY=pts/0 ; COMMAND=/usr/bin/chmod 644 /etc/sssd/sssd.conf`),
        e(`Mar 04 08:12:33 app01 sssd[8821]: Permission denied`),
        o(``),
        w(`# EVENTO: alle 08:11 l'utente deploy ha fatto chmod 644 su sssd.conf`),
        w(`# sssd.conf deve avere permessi 600 (owner root) — con 644 chiunque può leggerlo`),
        w(`# sssd rifiuta di partire se il file è world-readable (sicurezza)`),
      ];
    }
    if (raw.includes("sshd")) return [o(`sshd[892]: Accepted publickey for root from 10.0.1.10`)];
    return [o(`systemd[1]: Starting session of user root.`)];
  }

  // ── cat / ls sssd.conf ────────────────────────────────────────────────────
  if (cmd === "ls" && raw.includes("sssd")) {
    return [
      e(`-rw-r--r-- 1 root root 843 Mar  4 08:11 /etc/sssd/sssd.conf   ← 644 SBAGLIATO`),
      w(`# sssd.conf deve essere 600 (solo root legge). Con 644 contiene credenziali LDAP esposte`),
    ];
  }
  if (cmd === "stat" && raw.includes("sssd")) {
    return [
      o(`  File: /etc/sssd/sssd.conf`),
      o(`  Size: 843 bytes`),
      e(`  Access: (0644/-rw-r--r--)  Uid: (0/root) Gid: (0/root)   ← SBAGLIATO`),
      w(`# Deve essere 0600. Con 644 sssd rifiuta di avviarsi.`),
    ];
  }
  if (cmd === "cat" && raw.includes("sssd.conf")) {
    set(s => ({ ...s, checkedLdap: true }));
    return [
      o(`[sssd]`),
      o(`services = nss, pam, sudo`),
      o(`domains = acmecorp.local`),
      o(``),
      o(`[domain/acmecorp.local]`),
      o(`auth_provider = ldap`),
      o(`ldap_uri = ldap://ldap01.acmecorp.local:389`),
      o(`ldap_search_base = dc=acmecorp,dc=local`),
      o(`ldap_default_bind_dn = cn=sssd-svc,ou=ServiceAccounts,dc=acmecorp,dc=local`),
      d(`ldap_default_authtok = [REDACTED]`),
      o(`ldap_id_use_start_tls = true`),
      o(`cache_credentials = true`),
      o(`enumerate = true`),
      w(`# Config OK — problema è solo nei permessi del file, non nel contenuto`),
    ];
  }

  // ── nsswitch ──────────────────────────────────────────────────────────────
  if (cmd === "cat" && raw.includes("nsswitch")) {
    set(s => ({ ...s, checkedNsswitch: true }));
    return [
      o(`# /etc/nsswitch.conf`),
      o(`passwd:     sss files   ← cerca prima in sssd, poi in /etc/passwd`),
      o(`shadow:     files sss`),
      o(`group:      sss files`),
      o(`hosts:      files dns`),
      o(`networks:   files dns`),
      o(`services:   files sss`),
      o(``),
      w(`# Con sssd down, 'sss' fallisce silenziosamente e si passa a 'files'`),
      w(`# Ma gli utenti LDAP non sono in /etc/passwd locali → "no such user"`),
      w(`# Alternativa: spostarli → 'passwd: files sss' per avere il fallback locale`),
    ];
  }

  // ── chmod ─────────────────────────────────────────────────────────────────
  if (cmd === "chmod" && raw.includes("sssd.conf")) {
    if (raw.includes("600") || raw.includes("0600")) {
      set(s => ({ ...s, permFixed: true }));
      return [
        ok(`chmod 600 /etc/sssd/sssd.conf`),
        ok(`Permessi corretti: -rw------- 1 root root`),
        o(`Ora: systemctl restart sssd`),
      ];
    }
    return [w(`# Per sssd.conf i permessi DEVONO essere 600 esatti`)];
  }
  if (cmd === "chown" && raw.includes("sssd.conf")) {
    set(s => ({ ...s, ownerFixed: true }));
    return [ok(`chown root:root /etc/sssd/sssd.conf`)];
  }

  // ── sss_cache / sssctl ────────────────────────────────────────────────────
  if (cmd === "sss_cache" || cmd === "sssctl") {
    if (!st.sssdRunning) return [e(`sss_cache: SSSD is not running — impossible to invalidate cache`)];
    set(s => ({ ...s, cacheCleared: true }));
    if (raw.includes("-G") || raw.includes("-U") || raw.includes("--everything")) return [ok(`Cache invalidata. sssd reinizializza da LDAP.`)];
    if (raw.includes("domain-status")) return [ok(`Online status: Online`), ok(`acmecorp.local: LDAP connected — 348 users, 42 groups`)];
    return [ok(`sss_cache: OK`)];
  }

  // ── ldap test ─────────────────────────────────────────────────────────────
  if (cmd === "ldapsearch") {
    set(s => ({ ...s, checkedLdap: true }));
    if (raw.includes("ldap01")) return [
      ok(`# ldapsearch to ldap01.acmecorp.local:389`),
      ok(`# numEntries: 1`),
      ok(`dn: cn=giovanni,ou=Users,dc=acmecorp,dc=local`),
      ok(`cn: giovanni`),
      ok(`uidNumber: 10021`),
      ok(`gidNumber: 10020`),
      ok(`# LDAP server raggiungibile e utente esiste — problema è solo sssd locale`),
    ];
    return [o(`# Specificare: ldapsearch -H ldap://ldap01.acmecorp.local -x -b dc=acmecorp,dc=local`)];
  }
  if (cmd === "ping" && (raw.includes("ldap01") || raw.includes("10.0.10"))) {
    set(s => ({ ...s, checkedLdap: true }));
    return [ok(`PING ldap01.acmecorp.local: 64 bytes from ldap01: icmp_seq=0 ttl=64 time=0.4 ms`), ok(`# LDAP server raggiungibile — il problema è solo sssd`)];
  }

  // ── authconfig / realm / adcli ────────────────────────────────────────────
  if (cmd === "authconfig" || cmd === "authselect") {
    return [o(`auth: sssd  ← configurato`)];
  }
  if (cmd === "realm" && raw.includes("list")) {
    if (!st.sssdRunning) return [e(`realm: Configured realms not available — sssd offline`)];
    return [ok(`acmecorp.local`), ok(`  type: kerberos`), ok(`  realm-name: ACMECORP.LOCAL`), ok(`  domain-name: acmecorp.local`), ok(`  configured: kerberos-member`), ok(`  server-software: active-directory`), ok(`  client-software: sssd`)];
  }

  // ── who / w / last ────────────────────────────────────────────────────────
  if (cmd === "who" || cmd === "w") return [o(`giovanni pts/0  2026-03-04 11:05 (10.0.1.10)`), o(`root     pts/1  2026-03-04 11:03 (10.0.1.10)`)];
  if (cmd === "last") return [
    o(`giovanni pts/0  Mon Mar  4 11:05   still logged in`),
    d(`deploy   pts/1  Mon Mar  4 08:11 - 08:11  (00:00)`),
    w(`# deploy ha fatto login alle 08:11 — stessa ora del chmod 644`),
  ];

  // ── grep audit ────────────────────────────────────────────────────────────
  if (cmd === "ausearch" || (cmd === "grep" && raw.includes("sssd.conf"))) {
    return [
      o(`type=PATH msg=audit(1741077048.123:4821): item=0 name="/etc/sssd/sssd.conf" inode=131073`),
      o(`type=SYSCALL msg=audit(1741077048.123:4821): arch=x86_64 syscall=fchmod success=yes`),
      o(`  uid=10041(deploy) pid=8891 comm="chmod" exe="/usr/bin/chmod"`),
      w(`# auditd conferma: deploy (uid=10041) ha eseguito chmod su sssd.conf alle 08:11:48`),
    ];
  }

  // ── df / uptime / ps ──────────────────────────────────────────────────────
  if (cmd === "uptime") return [o(` 11:07:44 up 14 days,  2:04,  2 users,  load average: 0.38, 0.41, 0.35`)];
  if (cmd === "ps") return [o(`root  8810  0.0  sssd (DEAD)`), o(`root  1     0.0  /sbin/init`), o(`root  892   0.0  sshd`)];
  if (cmd === "df") return [o(`/dev/mapper/ol-root   50G  18G  32G  36% /`)];

  // ── ssh test ──────────────────────────────────────────────────────────────
  if (cmd === "ssh") {
    if (st.sssdRunning) return [ok(`Connected to ${rest} as ${st.user||"giovanni"} — domainuser OK`)];
    return [e(`ssh: ${rest}: Permission denied (publickey,gssapi-keyex,gssapi-with-mic)`)];
  }

  // ── su / sudo ─────────────────────────────────────────────────────────────
  if (cmd === "su") {
    const u = rest.replace("-","").trim()||"giovanni";
    if (!st.sssdRunning && u !== "root") return [e(`su: user ${u} does not exist`), w(`# sssd down → utenti LDAP non esistono per il sistema`)];
    return [ok(`[${u}@app01 ~]$`)];
  }

  // ── clear / help / hint ───────────────────────────────────────────────────
  if (cmd === "clear") return [{ t: "__CLEAR__", v: "" }];
  if (cmd === "") return [];

  if (cmd === "hint") {
    const steps = [
      !st.checkedId     && `id giovanni  — l'utente è raggiungibile?`,
      !st.checkedGetent && `getent passwd giovanni  — NSS lo trova?`,
      !st.checkedSssd   && `systemctl status sssd  — sssd è su?`,
      !st.checkedJournal&& `journalctl -u sssd -n 30  — leggi l'errore esatto`,
      st.checkedJournal && !st.permFixed && `ls -la /etc/sssd/sssd.conf  →  chmod 600 /etc/sssd/sssd.conf`,
      st.permFixed && !st.sssdRunning && `systemctl restart sssd`,
      st.sssdRunning && !st.tested && `id giovanni  — ora funziona?`,
      st.tested && `getent passwd  — controlla tutti gli utenti LDAP`,
    ].filter(Boolean);
    return steps.length ? [{ t:"warn", v:`💡 ${steps[0]}` }] : [ok(`💡 Sistema ripristinato!`)];
  }

  if (cmd === "help") return [
    o(`━━ Diagnosi utenti ━━`),
    o(`  id <utente>                        (utente esiste?)` ),
    o(`  getent passwd <utente>             (NSS lo vede?)`  ),
    o(`  getent passwd                      (tutti gli utenti)`),
    o(`  getent group`),
    o(`━━ sssd ━━`),
    o(`  systemctl status sssd`),
    o(`  journalctl -u sssd -n 50`),
    o(`  ls -la /etc/sssd/sssd.conf`),
    o(`  stat /etc/sssd/sssd.conf`),
    o(`  cat /etc/sssd/sssd.conf`),
    o(`  chmod 600 /etc/sssd/sssd.conf`),
    o(`  systemctl restart sssd`),
    o(`  sssctl domain-status acmecorp.local`),
    o(`  sss_cache --everything`),
    o(`━━ NSS / PAM ━━`),
    o(`  cat /etc/nsswitch.conf`),
    o(`━━ Verifica LDAP ━━`),
    o(`  ping ldap01.acmecorp.local`),
    o(`  ldapsearch -H ldap://ldap01.acmecorp.local -x -b dc=acmecorp,dc=local cn=giovanni`),
    o(`━━ Audit ━━`),
    o(`  last | head -20`),
    o(`  ausearch -f /etc/sssd/sssd.conf`),
    o(`  hint  — prossimo passo`),
  ];

  return [e(`-bash: ${cmd}: command not found`)];
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  { label: "Sintomo rilevato",    done: s => s.checkedId || s.checkedGetent },
  { label: "sssd down",           done: s => s.checkedSssd },
  { label: "Causa nel journal",   done: s => s.checkedJournal },
  { label: "Permessi verificati", done: s => s.checkedNsswitch || !!s.permFixed || s.checkedLdap },
  { label: "chmod 600",           done: s => !!s.permFixed },
  { label: "sssd riavviato",      done: s => s.sssdRunning },
  { label: "Utenti verificati",   done: s => s.tested },
  { label: "✅ Ripristinato",     done: s => s.solved },
];

function Progress({ st }) {
  const done = STEPS.map(s => s.done(st));
  const pct  = Math.round(done.filter(Boolean).length / done.length * 100);
  return (
    <div style={{ padding:"8px 14px", borderBottom:"1px solid #1e1a20", background:"#090810", flexShrink:0 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontSize:9, letterSpacing:3, color:"#3a2a50", textTransform:"uppercase" }}>Investigazione</span>
        <span style={{ fontSize:10, color: pct===100?"#a78bfa":"#4a3a60" }}>{pct}%</span>
      </div>
      <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
        {STEPS.map((s,i) => (
          <span key={i} style={{ fontSize:9, padding:"2px 6px", borderRadius:3, background:done[i]?"#1a0d30":"#0d0a12", border:`1px solid ${done[i]?"#4a2a70":"#2a1a30"}`, color:done[i]?"#a78bfa":"#3a2a40", transition:"all 0.3s" }}>
            {done[i]?"✓":"○"} {s.label}
          </span>
        ))}
      </div>
      <div style={{ marginTop:5, height:2, background:"#0d0a12", borderRadius:1 }}>
        <div style={{ width:`${pct}%`, height:"100%", background:"#6a3aaa", borderRadius:1, transition:"width 0.5s" }}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [st, setSt]        = useState(null);
  const [hist, setHist]    = useState([]);
  const [input, setInput]  = useState("");
  const [cmdH, setCmdH]    = useState([]);
  const [hidx, setHidx]    = useState(-1);
  const bot = useRef(), inp = useRef();

  const col = { out:"#b8a8c8", err:"#e06060", ok:"#a78bfa", warn:"#e8a020", prompt:"#8abadf", dim:"#3a2a50" };

  useEffect(() => { bot.current?.scrollIntoView({ behavior:"smooth" }); }, [hist]);

  function start() {
    setSt(init());
    setTimeout(() => {
      setHist([
        { t:"warn", v:`╔══════════════════════════════════════════════════════════════════╗` },
        { t:"warn", v:`║  ⚠  ALERT — Nagios / Zabbix [TRIGGERED] 08:15:02                 ║` },
        { t:"warn", v:`║  app01.prod.acmecorp.local                                        ║` },
        { t:"warn", v:`║  LDAP user enumeration FAILED — 0 domain users found              ║` },
        { t:"warn", v:`║  Service accounts non autenticano — deploy pipeline BLOCCATA      ║` },
        { t:"warn", v:`║  Segnalazioni: 12 developer non riescono a fare SSH               ║` },
        { t:"warn", v:`╚══════════════════════════════════════════════════════════════════╝` },
        { t:"out",  v:`` },
        { t:"out",  v:`Connesso a app01.prod.acmecorp.local  [root@app01]` },
        { t:"out",  v:`Oracle Linux 8.9 — 348 utenti di dominio LDAP non raggiungibili` },
        { t:"dim",  v:`'help' per i comandi · 'hint' per un suggerimento` },
        { t:"out",  v:`` },
      ]);
      inp.current?.focus();
    }, 50);
  }

  function submit() {
    const cmd = input.trim(); if (!cmd) return;
    setCmdH(h => [cmd,...h].slice(0,100)); setHidx(-1);
    const out = run(cmd, st, setSt);
    if (out.some(o => o.t==="__CLEAR__")) { setHist([]); setInput(""); return; }
    setHist(h => [...h, { t:"prompt", v:`[root@app01 ~]# ${cmd}` }, ...out, { t:"out", v:"" }]);
    setInput("");
    setTimeout(() => {
      setSt(s => {
        if (!s || s.solved) return s;
        // check "tested" — user ran id after sssd is up
        const tested = s.sssdRunning && s.checkedId;
        const solved = s.sssdRunning && (s.cacheCleared || s.checkedGetent);
        if (solved && !s.solved) {
          setHist(h => [...h,
            { t:"ok", v:`╔═══════════════════════════════════════════════════════════════╗` },
            { t:"ok", v:`║  ✅  INCIDENTE RISOLTO                                         ║` },
            { t:"ok", v:`║  Root cause: chmod 644 su /etc/sssd/sssd.conf da deploy bot    ║` },
            { t:"ok", v:`║  sssd rifiuta di partire se il file è world-readable (CVE)     ║` },
            { t:"ok", v:`║  Fix: chmod 600 → systemctl restart sssd                       ║` },
            { t:"ok", v:`║  348 utenti LDAP di nuovo disponibili                          ║` },
            { t:"ok", v:`╚═══════════════════════════════════════════════════════════════╝` },
            { t:"out", v:`` },
            { t:"dim", v:`Post-mortem: audit su sssd.conf in pipeline deploy. Alert su permessi.` },
          ]);
          return { ...s, tested, solved: true };
        }
        return { ...s, tested };
      });
    }, 200);
  }

  function onKey(e) {
    if (e.key==="Enter")     { submit(); return; }
    if (e.key==="ArrowUp")   { e.preventDefault(); const i=Math.min(hidx+1,cmdH.length-1); setHidx(i); setInput(cmdH[i]||""); }
    if (e.key==="ArrowDown") { e.preventDefault(); const i=Math.max(hidx-1,-1); setHidx(i); setInput(i===-1?"":cmdH[i]||""); }
  }

  // ── INTRO ─────────────────────────────────────────────────────────────────
  if (!st) return (
    <div style={{ minHeight:"100vh", background:"#080610", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'JetBrains Mono','Fira Code',monospace", padding:24 }}>
      <div style={{ maxWidth:580, textAlign:"center" }}>
        <div style={{ fontSize:10, letterSpacing:6, color:"#2a1a40", textTransform:"uppercase", marginBottom:16 }}>Linux SysAdmin · Scenario Reale</div>
        <div style={{ fontSize:28, fontWeight:900, color:"#180d28", marginBottom:8, lineHeight:1.2 }}>Utenti scomparsi.</div>
        <div style={{ fontSize:13, color:"#3a2a50", marginBottom:4 }}>348 utenti di dominio non esistono più per il sistema.</div>
        <div style={{ fontSize:12, color:"#2a1a40", marginBottom:28, lineHeight:1.8 }}>
          12 developer non riescono a fare SSH.<br/>
          La pipeline di deploy è bloccata — i service account non autenticano.<br/>
          Il server risponde, ma <code style={{color:"#a78bfa"}}>id giovanni</code> restituisce <code style={{color:"#e06060"}}>no such user</code>.
        </div>

        <div style={{ background:"#0d0a18", border:"1px solid #2a1a40", borderRadius:8, padding:"16px 20px", marginBottom:28, textAlign:"left" }}>
          <div style={{ fontSize:10, color:"#3a2a50", letterSpacing:2, marginBottom:10, textTransform:"uppercase" }}>Contesto</div>
          <div style={{ fontSize:11, color:"#5a4a70", lineHeight:1.9 }}>
            <div>Server: <span style={{color:"#a78bfa"}}>app01.prod.acmecorp.local</span></div>
            <div>Auth: <span style={{color:"#a78bfa"}}>LDAP via sssd · 348 utenti di dominio</span></div>
            <div>Ultimo evento noto: <span style={{color:"#e8a020"}}>deploy pipeline alle 08:11</span></div>
            <div>Problema da: <span style={{color:"#e06060"}}>08:12 — 3 ore fa</span></div>
            <div>LDAP server: <span style={{color:"#a78bfa"}}>ldap01.acmecorp.local — UP</span></div>
          </div>
        </div>

        <div style={{ background:"#100820", border:"1px solid #3a1a50", borderRadius:8, padding:"14px 18px", marginBottom:28, textAlign:"left" }}>
          <div style={{ fontSize:10, color:"#4a2a60", letterSpacing:2, marginBottom:8, textTransform:"uppercase" }}>Concetti chiave</div>
          <div style={{ fontSize:10, color:"#4a3a60", lineHeight:1.9 }}>
            <div><span style={{color:"#a78bfa"}}>sssd</span> — System Security Services Daemon: fa da ponte tra il sistema e LDAP/AD</div>
            <div><span style={{color:"#a78bfa"}}>NSS</span> — Name Service Switch: decide dove cercare utenti/gruppi (<code>/etc/nsswitch.conf</code>)</div>
            <div><span style={{color:"#a78bfa"}}>sssd.conf</span> — deve avere permessi <code style={{color:"#e06060"}}>600</code> o sssd rifiuta di partire</div>
          </div>
        </div>

        <button onClick={start}
          style={{ background:"#1a0d30", border:"1px solid #4a2a80", borderRadius:6, padding:"12px 36px", color:"#a78bfa", fontSize:13, fontFamily:"'JetBrains Mono',monospace", cursor:"pointer", letterSpacing:2 }}
          onMouseOver={e=>e.currentTarget.style.background="#200d38"}
          onMouseOut={e=>e.currentTarget.style.background="#1a0d30"}>
          SSH → app01 — inizia
        </button>
      </div>
    </div>
  );

  // ── TERMINAL ──────────────────────────────────────────────────────────────
  return (
    <div style={{ height:"100vh", background:"#080610", display:"flex", flexDirection:"column", fontFamily:"'JetBrains Mono','Fira Code',monospace" }}>
      {/* bar */}
      <div style={{ background:"#0d0a18", borderBottom:"1px solid #1e1a28", padding:"7px 14px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <div style={{ display:"flex", gap:5 }}>
          {["#ff5f57","#febc2e","#28c840"].map(c=><div key={c} style={{width:9,height:9,borderRadius:"50%",background:c}}/>)}
        </div>
        <span style={{ color:"#4a2a70", fontSize:11, marginLeft:4 }}>root@app01.prod</span>
        <span style={{ color:"#2a1a40", fontSize:10 }}>sssd · LDAP · NSS</span>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:9, background:st.solved?"#1a0d30":"#2a0808", color:st.solved?"#a78bfa":"#e06060", padding:"2px 8px", borderRadius:3, border:`1px solid ${st.solved?"#4a2a70":"#5a1010"}` }}>
            {st.solved ? "✅ RIPRISTINATO" : "⚠ 348 UTENTI OFFLINE"}
          </span>
          <button onClick={()=>{setSt(null);setHist([]);setInput("");}}
            style={{ padding:"2px 10px", background:"#1a1828", border:"1px solid #2a2038", borderRadius:4, color:"#4a3a60", cursor:"pointer", fontSize:10, fontFamily:"inherit" }}>
            ← Reset
          </button>
        </div>
      </div>

      <Progress st={st} />

      {/* output */}
      <div onClick={()=>inp.current?.focus()} style={{ flex:1, overflowY:"auto", padding:"12px 16px", cursor:"text" }}>
        {hist.map((l,i)=>(
          <div key={i} style={{ color:col[l.t]||"#b8a8c8", fontSize:12, lineHeight:1.65, whiteSpace:"pre-wrap", wordBreak:"break-all" }}>
            {l.v}
          </div>
        ))}
        <div ref={bot}/>
      </div>

      {/* input */}
      <div style={{ borderTop:"1px solid #1e1a28", padding:"9px 16px", display:"flex", alignItems:"center", gap:8, background:"#060410", flexShrink:0 }}>
        <span style={{ color:"#4a2a70", fontSize:12, whiteSpace:"nowrap" }}>[root@app01 ~]#</span>
        <input ref={inp} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey}
          autoFocus spellCheck={false} autoComplete="off"
          style={{ flex:1, background:"none", border:"none", outline:"none", color:"#c8b8d8", fontFamily:"inherit", fontSize:12.5, caretColor:"#a78bfa" }}
          placeholder=""/>
      </div>
    </div>
  );
}
