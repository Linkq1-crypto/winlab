import { useState, useRef, useEffect, useCallback } from "react";

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO DEFINITIONS
// ═════════════════════════════════════════════════════════════════════════════
const SCENARIOS = [
  {
    id: "phpfpm",
    title: "502 Bad Gateway",
    subtitle: "Nginx + PHP-FPM · deploy rotto",
    icon: "🔴",
    alert: "HTTP check FAILED — 502 Bad Gateway (expected 200)\nStack: Nginx · PHP-FPM 8.1 · MySQL 8\nUltimo evento: deploy v2.4.1 alle 09:10",
    host: "web01.prod.acmecorp.local",
    user: "giovanni",
    cause: "www.conf copiato da staging Apache → produzione Nginx: user=apache non esiste",
    steps: ["Diagnosi iniziale","502 identificato","php-fpm down","Causa nel journal","Config analizzata","www.conf corretto","php-fpm riavviato","✅ Sito operativo"],
    checkSolved: s => s.phpfpmFixed && s.services?.phpfpm === "active",
  },
  {
    id: "mysql_repl",
    title: "MySQL Replica Rotta",
    subtitle: "Replica slave lag · dati inconsistenti",
    icon: "🗄",
    alert: "DB-02 replication lag: 14.823 secondi — CRITICO\nSlave I/O: Yes · Slave SQL: No\nUltimo evento: UPDATE massivo su tabella orders ieri sera",
    host: "db02.prod.acmecorp.local",
    user: "dba",
    cause: "Deadlock su slave durante UPDATE massivo → SQL thread stopped con errore 1213",
    steps: ["Stato replica","Errore identificato","Relay log letto","Skip errore/fix","Replica riavviata","Lag azzerato","✅ Replica OK"],
    checkSolved: s => s.replicaFixed,
  },
  {
    id: "diskfull",
    title: "Disco al 100%",
    subtitle: "/var esaurito · scritture bloccate",
    icon: "💾",
    alert: "disk usage CRITICAL: /var 100% on app01.prod\nScritture su DB e log bloccate · app non risponde\nLogrotate ultimo run: 18 giorni fa",
    host: "app01.prod.acmecorp.local",
    user: "ops",
    cause: "access.log non ruotato — cresciuto a 89G. logrotate.d/nginx ha errore di sintassi",
    steps: ["Disco analizzato","File colpevole trovato","Causa logrotate","Log svuotato","Logrotate fixato","✅ Disco libero"],
    checkSolved: s => s.diskFixed && s.logrotateFixed,
  },
  {
    id: "ssl",
    title: "Certificato SSL Scaduto",
    subtitle: "HTTPS down · Let's Encrypt renewal fallito",
    icon: "🔐",
    alert: "SSL cert EXPIRED: api.acmecorp.com\nSCADUTO: Feb 28 2026 00:00:00 GMT\nRinnovo automatico fallito — certbot cron non gira",
    host: "api01.prod.acmecorp.local",
    user: "giovanni",
    cause: "certbot cronjob disabilitato dopo hardening. Port 80 bloccato da firewall → challenge HTTP fallisce",
    steps: ["HTTPS down verificato","Cert scaduto confermato","Certbot status","Firewall analizzato","Porta 80 aperta","Cert rinnovato","✅ HTTPS operativo"],
    checkSolved: s => s.sslFixed,
  },
  {
    id: "cron_load",
    title: "Load Spike da Cron",
    subtitle: "Load average 45 · server irresponsivo",
    icon: "🔥",
    alert: "load average: 45.12, 42.88, 38.21 — CRITICO\nServer quasi irresponsivo · utenti segnalano timeout\nNessun deploy recente",
    host: "batch01.prod.acmecorp.local",
    user: "giovanni",
    cause: "Script di report lanciato ogni minuto per errore (*/1 invece di 0 */1). 45 istanze parallele di report.py",
    steps: ["Load analizzato","Processo trovato","Crontab letto","Processi killati","Cron corretto","✅ Load normale"],
    checkSolved: s => s.cronFixed && s.processesKilled,
  },
  {
    id: "oom_java",
    title: "OOM · Java Heap Leak",
    subtitle: "Microservizio crasha ogni 2 ore",
    icon: "🧠",
    alert: "payment-service DOWN — OOM killer attivo\nPID 12891 (java) killed · riavviato automaticamente · ora crasha di nuovo\nFrequenza crash: ogni ~2 ore dall'ultimo deploy",
    host: "pay01.prod.acmecorp.local",
    user: "giovanni",
    cause: "SessionCache non svuota le sessioni scadute. Heap 8G pieno in 2h. -XX:+HeapDumpOnOutOfMemoryError non configurato",
    steps: ["Servizio down","OOM confermato","Heap analizzato","Leak identificato","Heap dump generato","Config JVM fixata","✅ Stabile"],
    checkSolved: s => s.jvmFixed,
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// INITIAL STATES
// ═════════════════════════════════════════════════════════════════════════════
const makeState = (id) => {
  const base = { scenario: id, solved: false };
  switch(id) {
    case "phpfpm":    return { ...base, services: { nginx:"active", phpfpm:"failed", mysqld:"active" }, phpfpmFixed:false, wwwConfFixed:false, logDirCreated:false, checkedUptime:false, checkedNginx:false, checkedCurl:false, checkedPhpfpm:false, checkedJournal:false, checkedConf:false };
    case "mysql_repl":return { ...base, replicaFixed:false, skippedError:false, checkedStatus:false, checkedLag:false, checkedError:false };
    case "diskfull":  return { ...base, diskFixed:false, logrotateFixed:false, logFound:false, logTruncated:false, logrotateChecked:false };
    case "ssl":       return { ...base, sslFixed:false, port80Opened:false, certbotChecked:false, firewallChecked:false };
    case "cron_load": return { ...base, cronFixed:false, processesKilled:false, processFound:false, cronRead:false };
    case "oom_java":  return { ...base, jvmFixed:false, heapDumped:false, leakFound:false, oomChecked:false };
    default: return base;
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// COMMAND ENGINES (one per scenario)
// ═════════════════════════════════════════════════════════════════════════════
function runPhpfpm(raw, st, set) {
  const p = raw.trim().split(/\s+/);
  const cmd = p[0], rest = p.slice(1).join(" ");
  const o = (v) => ({ t:"out", v });
  const e = (v) => ({ t:"err", v });
  const ok = (v) => ({ t:"ok",  v });
  const w = (v) => ({ t:"warn",v });
  const HOST = "web01.prod";

  if (cmd==="uptime") { set(s=>({...s,checkedUptime:true})); return [o(` 11:04:22 up 23 days, load average: 0.41, 0.38, 0.35`)]; }
  if (cmd==="systemctl") {
    const sub=p[1], unit=(p[2]||"").replace(".service","");
    if (sub==="status") {
      if (unit==="nginx") { set(s=>({...s,checkedNginx:true})); return [ok(`● nginx.service  Active: active (running)`), o(`Main PID: 3813  worker: 3814`)]; }
      if (unit==="php-fpm"||unit==="phpfpm") {
        set(s=>({...s,checkedPhpfpm:true}));
        if (st.services?.phpfpm==="active") return [ok(`● php-fpm.service  Active: active (running)`), ok(`Main PID: 9210  [pool www] ready to handle connections`)];
        return [e(`● php-fpm.service`), e(`   Active: failed (Result: exit-code) since Mon 11:01:43`), e(`Mar 04 11:01:43 ${HOST} php-fpm[8821]: ERROR: [pool www] cannot get uid for user 'apache'`), e(`Mar 04 11:01:43 ${HOST} systemd[1]: Failed to start The PHP FastCGI Process Manager.`), w(`# user 'apache' non esiste su questo server`)];
      }
      if (unit==="mysqld"||unit==="mysql") return [ok(`● mysqld.service  Active: active (running)`)];
      return [e(`Unit ${p[2]||""} not found.`)];
    }
    if ((sub==="start"||sub==="restart")&&(unit==="php-fpm"||unit==="phpfpm")) {
      if (!st.wwwConfFixed) return [e(`Job for php-fpm.service failed.`), e(`ERROR: [pool www] cannot get uid for user 'apache'`), w(`# Correggi prima /etc/php-fpm.d/www.conf`)];
      set(s=>({...s, services:{...s.services,phpfpm:"active"}, phpfpmFixed:true}));
      return [ok(`Started php-fpm.service.`), ok(`NOTICE: fpm is running, pid 9210`), ok(`NOTICE: ready to handle connections`), o(`Socket: /run/php-fpm/www.sock  owner=nginx:nginx`)];
    }
    if ((sub==="start"||sub==="restart")&&unit==="nginx") return [ok(`nginx restarted.`)];
    if (sub==="list-units") return [o(`nginx.service    loaded active  running`), e(`php-fpm.service  loaded failed  failed`), o(`mysqld.service   loaded active  running`)];
  }
  if (cmd==="journalctl"&&(raw.includes("php-fpm")||raw.includes("-xe"))) {
    set(s=>({...s,checkedJournal:true}));
    if (st.services?.phpfpm==="active") return [ok(`php-fpm[9210]: NOTICE: fpm is running`)];
    return [e(`php-fpm[8821]: ERROR: failed to open error_log (/var/log/php-fpm/error.log): No such file or directory`), e(`php-fpm[8821]: ERROR: [pool www] cannot get uid for user 'apache'`), e(`systemd[1]: Failed to start The PHP FastCGI Process Manager.`), w(`# Due problemi: (1) dir log mancante, (2) user 'apache' non esiste`)];
  }
  if (cmd==="curl") {
    set(s=>({...s,checkedCurl:true}));
    if (st.services?.phpfpm==="active") return [ok(`HTTP/1.1 200 OK`), ok(`X-Powered-By: PHP/8.1.27`), ok(`# Sito operativo`)];
    return [e(`HTTP/1.1 502 Bad Gateway`), w(`# nginx non riesce a raggiungere il backend PHP`)];
  }
  if (cmd==="cat"&&rest.includes("www.conf")) {
    set(s=>({...s,checkedConf:true}));
    return [o(`[www]`), e(`user = apache         ← utente non esiste su questo server`), e(`group = apache`), e(`listen.owner = apache ← nginx gira come 'nginx', non 'apache'`), e(`listen.group = apache`), o(`listen = /run/php-fpm/www.sock`), w(`# Questo file è stato copiato da staging (Apache) → va adattato per Nginx`)];
  }
  if (cmd==="cat"&&raw.includes("nginx.conf")) return [o(`user nginx;`), o(`# nginx gira come utente 'nginx'`)];
  if (cmd==="id") {
    if (rest==="apache"||rest.includes("apache")) return [e(`id: 'apache': no such user`), w(`# Confermato: apache non esiste. Il server usa nginx`)];
    if (rest==="nginx"||rest.includes("nginx"))  return [o(`uid=996(nginx) gid=993(nginx) groups=993(nginx)`)];
    return [o(`uid=1000(giovanni) gid=1000(giovanni)`)];
  }
  if (cmd==="mkdir") { set(s=>({...s,logDirCreated:true})); return [ok(`mkdir: created directory '/var/log/php-fpm'`)]; }
  if ((cmd==="vi"||cmd==="nano"||cmd==="sed")&&rest.includes("www.conf")) {
    set(s=>({...s,wwwConfFixed:true}));
    return [ok(`www.conf aggiornato:`), ok(`  user = nginx`), ok(`  group = nginx`), ok(`  listen.owner = nginx`), ok(`  listen.group = nginx`), o(`Ora: systemctl restart php-fpm`)];
  }
  if (cmd==="ls"&&raw.includes("php-fpm")) return st.services?.phpfpm==="active" ? [ok(`srw-rw---- 1 nginx nginx 0 www.sock`)] : [e(`ls: cannot access '/run/php-fpm/www.sock': No such file or directory`)];
  if (cmd==="tail"&&raw.includes("nginx")) return [e(`2026/03/04 11:02 [crit] connect() to unix:/run/php-fpm/www.sock failed (2: No such file or directory)`), w(`# nginx cerca il socket PHP ma php-fpm non gira`)];
  if (cmd==="git") return [o(`commit a3f82b1  deploy v2.4.1`), w(`commit 7e19ca3  deploy-bot: copy config from staging (web02-staging) ← PROBLEMA`)];
  if (cmd==="last") return [o(`deploy  10.0.1.5  Mon Mar 4 09:10-09:11  (00:01)`), w(`# deploy-bot connesso alle 09:10 → php-fpm crashato alle 09:11`)];
  if (cmd==="nginx"&&rest==="-t") return [ok(`nginx: configuration file syntax is ok`)];
  return null;
}

function runMysqlRepl(raw, st, set) {
  const p = raw.trim().split(/\s+/);
  const cmd = p[0];
  const o = (v) => ({ t:"out", v }); const e = (v) => ({ t:"err", v });
  const ok = (v) => ({ t:"ok",  v }); const w = (v) => ({ t:"warn",v });

  if (cmd==="mysql"||cmd==="mysqlcheck") {
    if (raw.includes("SHOW SLAVE STATUS")||raw.includes("slave status")||raw.includes("REPLICA STATUS")) {
      set(s=>({...s,checkedStatus:true}));
      if (st.replicaFixed) return [ok(`Slave_IO_Running: Yes`), ok(`Slave_SQL_Running: Yes`), ok(`Seconds_Behind_Master: 0`), ok(`# Replica OK`)];
      return [
        o(`*************************** 1. row ***************************`),
        o(`               Slave_IO_State: Waiting for master to send event`),
        o(`                  Master_Host: db01.prod.acmecorp.local`),
        o(`                  Master_Port: 3306`),
        o(`                Connect_Retry: 60`),
        o(`              Master_Log_File: mysql-bin.001243`),
        o(`          Read_Master_Log_Pos: 892341122`),
        o(`               Relay_Log_File: relay-bin.000089`),
        ok(`              Slave_IO_Running: Yes`),
        e(`             Slave_SQL_Running: No   ← SQL thread FERMO`),
        e(`                   Last_Error: Error 'Deadlock found when trying to get lock' on query, Error_code: 1213`),
        e(`                 Last_Errno: 1213`),
        e(`   Seconds_Behind_Master: NULL  ← lag non calcolabile — SQL thread fermo`),
        w(`# Slave_SQL_Running=No — il thread SQL ha smesso di applicare gli eventi`),
      ];
    }
    if (raw.includes("STOP SLAVE")||raw.includes("STOP REPLICA")) return [ok(`Query OK, 0 rows affected`)];
    if (raw.includes("SET GLOBAL SQL_SLAVE_SKIP_COUNTER")||raw.includes("SKIP_COUNTER")) {
      set(s=>({...s,skippedError:true}));
      return [ok(`Query OK, 0 rows affected`), w(`# Attenzione: skippare errori può causare inconsistenza — valuta pt-table-checksum`)];
    }
    if (raw.includes("START SLAVE")||raw.includes("START REPLICA")) {
      if (!st.skippedError) return [e(`Slave SQL thread stopped with error 1213 — risolvi prima l'errore`)];
      set(s=>({...s,replicaFixed:true}));
      return [ok(`Query OK, 0 rows affected`), ok(`Slave started.`)];
    }
    if (raw.includes("SHOW SLAVE HOSTS")||raw.includes("SHOW REPLICAS")) return [o(`+----------+------+------+--------+`), o(`| Server_id| Host | Port | Master |`), o(`+----------+------+------+--------+`), o(`|        2 | db02 | 3306 | db01   |`)];
    if (raw.includes("Seconds_Behind_Master")||raw.includes("lag")) {
      set(s=>({...s,checkedLag:true}));
      if (st.replicaFixed) return [ok(`Seconds_Behind_Master: 0`)];
      return [e(`Seconds_Behind_Master: NULL  ← SQL thread fermo`)];
    }
    if (raw.includes("SHOW PROCESSLIST")) return [o(`Id  User   Host          db      Time  State       Info`), o(`1   system              NULL    0     Slave has read all relay log  NULL`), e(`2   system              NULL    4821  waiting for deadlock  UPDATE orders SET status=...`)];
  }
  if (cmd==="mysqlbinlog"||(raw.includes("relay")&&raw.includes("log"))) {
    set(s=>({...s,checkedError:true}));
    return [o(`# relay-bin.000089 — posizione 892341088`), e(`#260304  9:42:11 server id 1  Query  'UPDATE orders SET status='shipped' WHERE id IN (1..50000)'`), e(`# Deadlock: questo UPDATE massiccio ha causato il deadlock sullo slave`), w(`# Lo slave ha fermato il SQL thread per non corrompere i dati`)];
  }
  if (cmd==="pt-table-checksum"||cmd==="pt-slave-restart") return [w(`# pt-tools non installato — usa SKIP_COUNTER con cautela`)];
  if (cmd==="systemctl"&&p[1]==="status"&&(p[2]||"").includes("mysql")) {
    return st.replicaFixed ? [ok(`mysqld.service  Active: active (running)`), ok(`Replica lag: 0 seconds`)] : [ok(`mysqld.service  Active: active (running)`), e(`Replica SQL thread: stopped`)];
  }
  return null;
}

function runDiskfull(raw, st, set) {
  const p = raw.trim().split(/\s+/); const cmd = p[0], rest = p.slice(1).join(" ");
  const o=(v)=>({t:"out",v}); const e=(v)=>({t:"err",v}); const ok=(v)=>({t:"ok",v}); const w=(v)=>({t:"warn",v});

  if (cmd==="df") {
    if (st.diskFixed) return [ok(`/dev/mapper/vg0-var   200G   82G  118G  42% /var`), ok(`# /var libero`)];
    return [o(`Filesystem                  Size  Used Avail Use% Mounted on`), e(`/dev/mapper/vg0-var          200G  200G     0 100% /var   ← PIENO`), o(`/dev/mapper/vg0-root          50G   18G   32G  36% /`), o(`/dev/sda1                    500M  294M  207M  59% /boot`)];
  }
  if (cmd==="du") {
    if (raw.includes("/var/log")||raw.includes("-sh")) return [o(`89G   /var/log/nginx`), o(`12G   /var/log/app`), o(` 2G   /var/log/mysql`), w(`# /var/log/nginx occupa 89G — anomalo`)];
    return [o(`89G  /var/log/nginx`), o(`12G  /var/log/app`)];
  }
  if (cmd==="ls"&&raw.includes("/var/log/nginx")) {
    set(s=>({...s,logFound:true}));
    return [o(`-rw-r--r-- 1 nginx nginx 95580116992 Mar  4 11:05 access.log   ← 89G!`), o(`-rw-r--r-- 1 nginx nginx        18241 Mar  4 11:04 error.log`), w(`# access.log da 89G — logrotate non ruota da 18 giorni`)];
  }
  if (cmd==="truncate"||(cmd===">"&&raw.includes("access.log"))||( raw.includes("truncate")&&raw.includes("access.log"))) {
    set(s=>({...s,logTruncated:true, diskFixed:true}));
    return [ok(`Svuotato /var/log/nginx/access.log (0 bytes)`), ok(`nginx signaled — riapre file di log`), o(`Liberate ~89G su /var`)];
  }
  if (cmd==="rm"&&raw.includes("access.log")) {
    set(s=>({...s,logTruncated:true, diskFixed:true}));
    return [ok(`Eliminato access.log — liberate 89G`), w(`# nginx ora darà errore sul log — esegui: nginx -s reopen  o  systemctl reload nginx`)];
  }
  if (cmd==="logrotate"||cmd==="cat"&&raw.includes("logrotate")) {
    set(s=>({...s,logrotateChecked:true}));
    if (cmd==="logrotate"&&(rest.includes("-d")||rest.includes("debug"))) return [e(`error: /etc/logrotate.d/nginx:7 unknown option 'dailyy'  ← TYPO`), w(`# logrotate esce con errore — i log non vengono mai ruotati`)];
    if (cmd==="cat") return [o(`/var/log/nginx/*.log {`), e(`    dailyy     ← TYPO! deve essere 'daily'`), o(`    rotate 14`), o(`    compress`), o(`    delaycompress`), o(`    notifempty`), o(`    sharedscripts`), o(`    postrotate`), o(`        /bin/kill -USR1 $(cat /var/run/nginx.pid)`), o(`    endscript`), o(`}`)];
  }
  if ((cmd==="vi"||cmd==="nano"||cmd==="sed")&&raw.includes("logrotate")) {
    set(s=>({...s,logrotateFixed:true}));
    return [ok(`'dailyy' → 'daily' corretto.`), ok(`logrotate test: OK`), o(`Ora: logrotate -f /etc/logrotate.d/nginx`)];
  }
  if (cmd==="logrotate"&&(rest.includes("-f")||rest.includes("force"))) {
    if (!st.logrotateFixed) return [e(`error: /etc/logrotate.d/nginx:7 unknown option 'dailyy'`)];
    return [ok(`rotating log /var/log/nginx/access.log → access.log.1`), ok(`compressing log → access.log.1.gz`)];
  }
  if (cmd==="systemctl"&&p[2]==="nginx") return [ok(`nginx OK`)];
  if (cmd==="find"&&raw.includes("/var/log")) return [o(`/var/log/nginx/access.log  89G`), o(`/var/log/app/app.log        8G`)];
  return null;
}

function runSsl(raw, st, set) {
  const p = raw.trim().split(/\s+/); const cmd = p[0], rest = p.slice(1).join(" ");
  const o=(v)=>({t:"out",v}); const e=(v)=>({t:"err",v}); const ok=(v)=>({t:"ok",v}); const w=(v)=>({t:"warn",v});

  if (cmd==="curl") {
    if (raw.includes("https")) {
      if (st.sslFixed) return [ok(`HTTP/1.1 200 OK`), ok(`X-Powered-By: PHP/8.1.27`), ok(`# HTTPS operativo`)];
      return [e(`curl: (60) SSL certificate problem: certificate has expired`), e(`notAfter=Feb 28 00:00:00 2026 GMT`), w(`# Certificato scaduto — Le's Encrypt non ha rinnovato`)];
    }
    if (raw.includes("http://")&&!raw.includes("https")) return st.port80Opened ? [ok(`HTTP/1.1 200 OK  (redirect a HTTPS)`)] : [e(`curl: (7) Failed to connect to api.acmecorp.com port 80: Connection refused`)];
    return [o(`curl: http/https test`)];
  }
  if (cmd==="openssl") {
    if (raw.includes("enddate")||raw.includes("dates")) return [e(`notBefore=Nov 30 00:00:00 2025 GMT`), e(`notAfter=Feb 28 00:00:00 2026 GMT  ← SCADUTO`)];
    if (raw.includes("s_client")) {
      if (st.sslFixed) return [ok(`SSL handshake success`), ok(`Certificate chain OK`), ok(`Verify return code: 0 (ok)`)];
      return [e(`SSL handshake failure`), e(`certificate verify failed (certificate has expired)`)];
    }
  }
  if (cmd==="certbot") {
    set(s=>({...s,certbotChecked:true}));
    if (raw.includes("certificates")) return [o(`Found certs:`), e(`  api.acmecorp.com  EXPIRED: 2026-02-28`), o(`  Path: /etc/letsencrypt/live/api.acmecorp.com/fullchain.pem`)];
    if (raw.includes("renew")||raw.includes("certonly")) {
      if (!st.port80Opened) return [e(`Attempting to renew using HTTP-01 challenge`), e(`Connection to port 80 REFUSED — challenge fallita`), e(`certbot failed to renew certificate`), w(`# Port 80 bloccata da firewall → ACME challenge HTTP non funziona`)];
      set(s=>({...s,sslFixed:true}));
      return [ok(`Attempting to renew api.acmecorp.com...`), ok(`Performing HTTP-01 challenge`), ok(`Challenge passed.`), ok(`Certificate renewed: /etc/letsencrypt/live/api.acmecorp.com/fullchain.pem`), ok(`Expiry date: 2026-06-04`), o(`Ora: systemctl reload nginx`)];
    }
  }
  if (cmd==="systemctl"&&(raw.includes("certbot")||raw.includes("timer"))) return [e(`certbot.timer  inactive dead  ← timer disabilitato!`), w(`# Il rinnovo automatico non gira — disabilitato dopo hardening del server`)];
  if (cmd==="crontab"||raw.includes("crontab")) return [o(`# No crontab for root`), w(`# certbot renew non è in nessun crontab`)];
  if (cmd==="firewall-cmd") {
    if (raw.includes("--list")) { set(s=>({...s,firewallChecked:true})); return [o(`public (active)`), e(`  services: dhcpv6-client ssh https  ← http MANCA!`), w(`# Porta 80 non aperta — ACME HTTP-01 challenge fallisce`)]; }
    if (raw.includes("--add-service=http")) { set(s=>({...s,port80Opened:true})); return [ok(`success — http aggiunto`)]; }
    if (raw.includes("--permanent")) return [ok(`success`)];
  }
  if (cmd==="systemctl"&&(p[1]==="reload"||p[1]==="restart")&&p[2]==="nginx") return st.sslFixed ? [ok(`nginx reloaded — nuovo certificato attivo`)] : [ok(`nginx reloaded.`)];
  return null;
}

function runCronLoad(raw, st, set) {
  const p = raw.trim().split(/\s+/); const cmd = p[0], rest = p.slice(1).join(" ");
  const o=(v)=>({t:"out",v}); const e=(v)=>({t:"err",v}); const ok=(v)=>({t:"ok",v}); const w=(v)=>({t:"warn",v});

  if (cmd==="uptime") return [e(` 14:33:01 up 12 days, load average: 45.12, 42.88, 38.21  ← CRITICO`)];
  if (cmd==="top"||cmd==="htop"||cmd==="ps") {
    set(s=>({...s,processFound:true}));
    if (st.processesKilled) return [ok(`USER  PID %CPU %MEM COMMAND`), ok(`root    1  0.0  0.1 /sbin/init`), ok(`nginx 901  0.3  1.1 nginx`)];
    return [
      o(`USER   PID  %CPU  %MEM  COMMAND`),
      e(`root  18201  98.2   4.1  python3 /opt/app/bin/report.py --full`),
      e(`root  18234  97.8   4.1  python3 /opt/app/bin/report.py --full`),
      e(`root  18267  97.1   4.0  python3 /opt/app/bin/report.py --full`),
      e(`root  18298  96.9   4.0  python3 /opt/app/bin/report.py --full`),
      e(`# ... 45 processi report.py in esecuzione contemporaneamente`),
      w(`# PPID: 1 — lanciati da cron, ognuno usa ~100% CPU`),
    ];
  }
  if (cmd==="crontab"||raw.includes("crontab")) {
    set(s=>({...s,cronRead:true}));
    return [
      o(`# Crontab di root — /var/spool/cron/root`),
      o(`SHELL=/bin/bash`),
      o(`PATH=/sbin:/bin:/usr/sbin:/usr/bin`),
      o(`MAILTO=ops@acmecorp.it`),
      o(``),
      e(`*/1 * * * * /opt/app/bin/report.py --full > /var/log/report.log 2>&1`),
      w(`# */1 = ogni minuto — SBAGLIATO! Dovrebbe essere '0 */1 *' (ogni ora) o '0 2 *' (notte)`),
      w(`# Report ci mette >60 sec → si sovrappongono → 45 istanze parallele`),
    ];
  }
  if (cmd==="kill"||cmd==="killall"||cmd==="pkill") {
    if (!st.processFound) return [w(`# Prima identifica i processi con ps aux`)];
    set(s=>({...s,processesKilled:true}));
    return [ok(`Terminati 45 processi report.py`), ok(`Load average scenderà in ~1 minuto`)];
  }
  if ((cmd==="vi"||cmd==="nano")&&raw.includes("crontab")) { return [w(`# Usa 'crontab -e' per editare il crontab di root`)]; }
  if (cmd==="crontab"&&rest==="-e") return [w(`# Editor aperto — modifica la riga con report.py`)];
  if ((cmd==="vi"||cmd==="nano")&&(raw.includes("report")||raw.includes("*/1"))) {
    set(s=>({...s,cronFixed:true}));
    return [ok(`Crontab aggiornato:`), ok(`  0 2 * * * /opt/app/bin/report.py --full  (ogni notte alle 02:00)`), o(`# Ora: verifica con: crontab -l`)];
  }
  if (cmd==="atop"||cmd==="sar") return [e(`45 processi report.py  CPU: 98%  — batch job runaway`)];
  if (cmd==="strace") return [o(`strace: attach a report.py`), o(`read(0, ...)  — legge dati da DB`), w(`# script legge l'intera tabella orders ogni run`)];
  if (cmd==="uptime"&&st.processesKilled) return [ok(` load average: 1.21, 8.44, 22.11  (in discesa)`)];
  return null;
}

function runOomJava(raw, st, set) {
  const p = raw.trim().split(/\s+/); const cmd = p[0], rest = p.slice(1).join(" ");
  const o=(v)=>({t:"out",v}); const e=(v)=>({t:"err",v}); const ok=(v)=>({t:"ok",v}); const w=(v)=>({t:"warn",v});

  if (cmd==="systemctl") {
    const sub=p[1], unit=(p[2]||"").replace(".service","");
    if (sub==="status"&&(unit==="payment-service"||unit==="payment")) {
      set(s=>({...s,oomChecked:true}));
      if (st.jvmFixed) return [ok(`● payment-service.service  Active: active (running)`), ok(`Main PID: 14211  uptime: 42min — stabile`)];
      return [e(`● payment-service.service`), e(`   Active: activating (auto-restart) (Result: signal) since Mon 11:04:21`), e(`   Active: failed — PID 12891 killed by signal 9`), w(`# Il servizio si riavvia in loop — OOM killer lo uccide ogni ~2 ore`)];
    }
    if ((sub==="restart"||sub==="start")&&unit==="payment") return st.jvmFixed ? [ok(`payment-service started OK`)] : [w(`# Si riavvierà ma crasherà di nuovo fra ~2h se non risolvi il leak`)];
  }
  if (cmd==="dmesg") {
    set(s=>({...s,oomChecked:true}));
    return [
      e(`[81234.123] java invoked oom-killer: gfp_mask=0x6200ca(GFP_HIGHUSER_MOVABLE)`),
      e(`[81234.234] Out of memory: Killed process 12891 (java) total-vm:16777216kB, anon-rss:8388608kB`),
      e(`[81234.345] oom_reaper: reaped process 12891 (java), now anon-rss:0kB`),
      e(`[79034.100] Out of memory: Killed process 11203 (java) total-vm:16777216kB`),
      w(`# OOM killer uccide java ogni ~2 ore — heap esaurito`),
    ];
  }
  if (cmd==="free") return [e(`Mem:  15.5Gi  15.3Gi  102Mi  ← CRITICO`), e(`Swap:  7.9Gi   7.9Gi    0B`)];
  if (cmd==="ps"||cmd==="top") return st.jvmFixed ? [ok(`tomcat 14211 2.1 55.2 java -Xmx8g ... payment-service`)] : [e(`tomcat 12891 8.2 99.1 java -Xmx8g ... payment-service  ← 99% RAM`)];
  if (cmd==="jmap"||(raw.includes("jcmd")&&raw.includes("heap"))) {
    set(s=>({...s,leakFound:true}));
    const pid = p.find(x=>/^\d{4,}/.test(x))||"12891";
    return [
      o(`Heap Configuration:`),
      o(`   MaxHeapSize = 8589934592 bytes (8.0 GB)`),
      e(`Heap Usage: 8.1 GB / 8.0 GB  ← OLTRE IL LIMITE`),
      o(``),
      o(`Histogram of live objects by class:`),
      e(`  1: com.acmecorp.payment.SessionCache  6.2 GB (4.812.441 instances)  ← LEAK`),
      e(`  2: com.acmecorp.payment.TokenStore    1.1 GB (  891.234 instances)`),
      o(`  3: [B byte[]                          0.3 GB`),
      w(`# SessionCache non svuota le sessioni scadute — 4.8M oggetti accumulati`),
    ];
  }
  if (cmd==="jstack") {
    const pid = p.find(x=>/^\d{4,}/.test(x))||"12891";
    return [o(`"main" prio=5 nid=0x22e1 RUNNABLE`), o(`"GC Thread#0" daemon in GC`), o(`"GC Thread#1" daemon in GC`), e(`# 24 GC thread attivi — thrashing. Heap pieno → GC continuo → 0 lavoro utile`)];
  }
  if (cmd==="jcmd"&&raw.includes("GC.heap_dump")) {
    set(s=>({...s,heapDumped:true}));
    return [ok(`Heap dump file created: /tmp/heapdump-12891.hprof (8.1 GB)`), o(`Analizza con: jhat, Eclipse MAT, or VisualVM`)];
  }
  if ((cmd==="vi"||cmd==="nano"||cmd==="cat")&&(raw.includes("jvm")||raw.includes(".conf")||raw.includes("Xmx")||raw.includes("service"))) {
    if (cmd==="cat") return [o(`JAVA_OPTS="-Xms2g -Xmx8g -server"`), e(`# Manca: -XX:+HeapDumpOnOutOfMemoryError -XX:MaxMetaspaceSize=512m`), w(`# Nessun heap dump automatico — bug difficile da diagnosticare`)];
    set(s=>({...s,jvmFixed:true}));
    return [ok(`JVM options aggiornate:`), ok(`  -Xmx6g  (ridotto da 8g)`), ok(`  -XX:+HeapDumpOnOutOfMemoryError`), ok(`  -XX:HeapDumpPath=/var/dumps/`), ok(`  -XX:MaxMetaspaceSize=512m`), o(`Segnala al team dev: SessionCache.evictExpired() non viene chiamato — fix nel codice`)];
  }
  if (cmd==="tail"&&raw.includes("payment")) return [e(`ERROR c.a.p.SessionCache - Cache size: 4812441 entries (never evicted)`)];
  if (raw.includes("grep")&&raw.includes("SessionCache")) return [e(`ERROR SessionCache - eviction thread not started`), e(`WARN  SessionCache - size=4812441, maxSize=100000  OVER LIMIT`)];
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTER
// ═════════════════════════════════════════════════════════════════════════════
function runCommand(raw, st, set) {
  const cmd = raw.trim().split(/\s+/)[0];
  const o=(v)=>({t:"out",v}); const e=(v)=>({t:"err",v}); const ok=(v)=>({t:"ok",v}); const w=(v)=>({t:"warn",v});

  // universal commands
  if (cmd==="clear")   return [{t:"__CLEAR__",v:""}];
  if (cmd==="")        return [];
  if (cmd==="whoami")  return [o(st.user||"root")];
  if (cmd==="hostname")return [o(st.host||"server01")];
  if (cmd==="uname")   return [o(`Linux 5.15.0-206.153.7.el8uek.x86_64 Oracle Linux 8.9`)];
  if (cmd==="date")    return [o(new Date().toUTCString())];
  if (cmd==="ping")    return [o(`PING ${raw.split(" ")[1]||"8.8.8.8"}: 3 packets, 0% packet loss`)];
  if (cmd==="ss"||cmd==="netstat") return [o(`tcp LISTEN 0.0.0.0:80  nginx`), o(`tcp LISTEN 0.0.0.0:22  sshd`), o(`tcp LISTEN 0.0.0.0:3306  mysqld`)];

  if (cmd==="hint") {
    const hints = {
      phpfpm: [
        !st.checkedCurl ? "curl -I http://localhost — qual è il codice HTTP?" : null,
        !st.checkedPhpfpm ? "systemctl status php-fpm — il backend PHP è su?" : null,
        !st.checkedJournal ? "journalctl -u php-fpm -n 30 — leggi l'errore esatto" : null,
        !st.checkedConf ? "cat /etc/php-fpm.d/www.conf — user= e listen.owner=?" : null,
        st.checkedConf && !st.wwwConfFixed ? "id apache — quell'utente esiste? Poi: vi /etc/php-fpm.d/www.conf" : null,
        st.wwwConfFixed && !st.logDirCreated ? "mkdir -p /var/log/php-fpm  (la dir log manca)" : null,
        st.logDirCreated && st.phpfpmFixed!==true ? "systemctl restart php-fpm" : null,
        "curl -I http://localhost — ora funziona?",
      ].filter(Boolean),
      mysql_repl: [
        !st.checkedStatus ? "mysql -e 'SHOW SLAVE STATUS\\G'" : null,
        st.checkedStatus && !st.checkedError ? "mysqlbinlog /var/lib/mysql/relay-bin.000089 | tail -50" : null,
        st.checkedError && !st.skippedError ? "mysql -e 'STOP SLAVE; SET GLOBAL SQL_SLAVE_SKIP_COUNTER=1;'" : null,
        st.skippedError && !st.replicaFixed ? "mysql -e 'START SLAVE;'" : null,
        st.replicaFixed ? "mysql -e 'SHOW SLAVE STATUS\\G' — verifica Seconds_Behind_Master: 0" : null,
      ].filter(Boolean),
      diskfull: [
        !st.logFound ? "df -h → du -sh /var/log/* → ls -lh /var/log/nginx/" : null,
        st.logFound && !st.logTruncated ? "truncate -s 0 /var/log/nginx/access.log  (svuota senza eliminare)" : null,
        !st.logrotateChecked ? "logrotate -d /etc/logrotate.d/nginx  (test con debug)" : null,
        st.logrotateChecked && !st.logrotateFixed ? "vi /etc/logrotate.d/nginx — correggi il typo" : null,
        st.logrotateFixed ? "logrotate -f /etc/logrotate.d/nginx" : null,
      ].filter(Boolean),
      ssl: [
        !st.certbotChecked ? "certbot certificates  oppure  openssl x509 -enddate -in /etc/letsencrypt/live/api.acmecorp.com/cert.pem -noout" : null,
        !st.firewallChecked ? "firewall-cmd --list-all  (porta 80 aperta?)" : null,
        st.firewallChecked && !st.port80Opened ? "firewall-cmd --add-service=http --permanent && --reload" : null,
        st.port80Opened && !st.sslFixed ? "certbot renew --force-renewal" : null,
        st.sslFixed ? "systemctl reload nginx && curl -I https://api.acmecorp.com" : null,
      ].filter(Boolean),
      cron_load: [
        !st.processFound ? "ps aux --sort=-%cpu | head -20  o  top" : null,
        st.processFound && !st.cronRead ? "crontab -l -u root  (o cat /var/spool/cron/root)" : null,
        st.cronRead && !st.processesKilled ? "pkill -f report.py  (killa tutte le istanze)" : null,
        st.processesKilled && !st.cronFixed ? "crontab -e  → correggi */1 in  0 2 * * *" : null,
        "uptime  (verifica che il load stia scendendo)",
      ].filter(Boolean),
      oom_java: [
        !st.oomChecked ? "dmesg | grep -i oom  oppure  systemctl status payment-service" : null,
        !st.leakFound ? "jmap -histo:live $(pgrep java) | head -20" : null,
        st.leakFound && !st.heapDumped ? "jcmd $(pgrep java) GC.heap_dump /tmp/heapdump.hprof" : null,
        !st.jvmFixed ? "vi /etc/opt/app/jvm.conf  → riduci -Xmx, aggiungi -XX:+HeapDumpOnOutOfMemoryError" : null,
        st.jvmFixed ? "systemctl restart payment-service && tail -f /var/log/app/payment.log" : null,
      ].filter(Boolean),
    };
    const h = hints[st.scenario]||[];
    return h.length ? [w(`💡 ${h[0]}`)] : [ok(`💡 Sei sulla buona strada — continua!`)];
  }

  if (cmd==="help") return [
    o(`━━ Generali ━━`),
    o(`  uptime | df -h | free -h | ps aux | top | dmesg`),
    o(`  systemctl status|restart|reload <svc>`),
    o(`  journalctl -u <svc> -n 50 | journalctl -xe`),
    o(`  tail -f /var/log/<app>/error.log`),
    o(`  curl -I http://localhost | curl -I https://<host>`),
    o(`━━ Config ━━`),
    o(`  cat <file> | vi <file> | grep <pattern> <file>`),
    o(`  ls -lh <dir> | find <dir> -size +1G`),
    o(`━━ Rete ━━`),
    o(`  firewall-cmd --list-all | --add-service=http`),
    o(`  ss -tlpn | ping <host>`),
    o(`━━ MySQL ━━`),
    o(`  mysql -e 'SHOW SLAVE STATUS\\G'`),
    o(`  mysql -e 'STOP SLAVE; SET GLOBAL SQL_SLAVE_SKIP_COUNTER=1; START SLAVE;'`),
    o(`━━ Java ━━`),
    o(`  jmap -histo:live <PID> | jstack <PID>`),
    o(`  jcmd <PID> GC.heap_dump /tmp/heap.hprof`),
    o(`━━ SSL ━━`),
    o(`  certbot certificates | certbot renew`),
    o(`  openssl x509 -enddate -in <cert.pem> -noout`),
    o(`  hint — prossimo passo | clear — pulisce schermo`),
  ];

  // route to scenario engine
  let result = null;
  switch(st.scenario) {
    case "phpfpm":     result = runPhpfpm(raw, st, set);    break;
    case "mysql_repl": result = runMysqlRepl(raw, st, set); break;
    case "diskfull":   result = runDiskfull(raw, st, set);  break;
    case "ssl":        result = runSsl(raw, st, set);       break;
    case "cron_load":  result = runCronLoad(raw, st, set);  break;
    case "oom_java":   result = runOomJava(raw, st, set);   break;
  }
  if (result) return result;

  if (cmd==="systemctl") return [o(`Servizio non trovato o non pertinente per questo scenario.`)];
  return [e(`-bash: ${cmd}: command not found`)];
}

// ═════════════════════════════════════════════════════════════════════════════
// PROGRESS BAR
// ═════════════════════════════════════════════════════════════════════════════
function Progress({ scen, state }) {
  const done = scen.steps.map((_, i) => {
    const keys = [
      // phpfpm
      () => state.checkedUptime || state.checkedNginx,
      () => state.checkedCurl,
      () => state.checkedPhpfpm,
      () => state.checkedJournal,
      () => state.checkedConf,
      () => state.wwwConfFixed,
      () => state.services?.phpfpm === "active",
      () => state.solved,
      // mysql
      () => state.checkedStatus,
      () => state.checkedLag,
      () => state.checkedError,
      () => state.skippedError,
      () => state.replicaFixed,
      () => state.replicaFixed,
      () => state.solved,
      // disk
      () => !!state.logFound,
      () => !!state.logTruncated,
      () => !!state.logrotateChecked,
      () => !!state.logrotateFixed,
      () => state.solved,
      () => state.solved,
      // ssl
      () => !!state.certbotChecked,
      () => !!state.certbotChecked,
      () => !!state.firewallChecked,
      () => !!state.port80Opened,
      () => !!state.sslFixed,
      () => state.solved,
      () => state.solved,
      // cron
      () => !!state.processFound,
      () => !!state.processFound,
      () => !!state.cronRead,
      () => !!state.processesKilled,
      () => !!state.cronFixed,
      () => state.solved,
      // oom
      () => !!state.oomChecked,
      () => !!state.oomChecked,
      () => !!state.leakFound,
      () => !!state.heapDumped,
      () => !!state.jvmFixed,
      () => state.solved,
      () => state.solved,
    ];
    try { return keys[i]?.() || false; } catch { return false; }
  });
  const pct = Math.round((done.filter(Boolean).length / scen.steps.length) * 100);
  return (
    <div style={{ padding:"8px 14px", borderBottom:"1px solid #1a2020", background:"#080e0e", flexShrink:0 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontSize:9, letterSpacing:3, color:"#2a4030", textTransform:"uppercase" }}>Investigazione</span>
        <span style={{ fontSize:10, color: pct===100?"#3dba74":"#2a5040" }}>{pct}%</span>
      </div>
      <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
        {scen.steps.map((s,i)=>(
          <div key={i} style={{ fontSize:9, padding:"2px 6px", borderRadius:3, background: done[i]?"#0d2018":"#0d1212", border:`1px solid ${done[i]?"#1a5a30":"#1a2020"}`, color: done[i]?"#3dba74":"#2a3a30", transition:"all 0.3s" }}>
            {done[i]?"✓":"○"} {s}
          </div>
        ))}
      </div>
      <div style={{ marginTop:5, height:2, background:"#0d1212", borderRadius:1 }}>
        <div style={{ width:`${pct}%`, height:"100%", background:"#1a6a30", borderRadius:1, transition:"width 0.5s" }}/>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// APP
// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [selected, setSelected] = useState(null);
  const [state, setState]       = useState(null);
  const [history, setHist]      = useState([]);
  const [input, setInput]       = useState("");
  const [cmdHist, setCH]        = useState([]);
  const [hidx, setHidx]         = useState(-1);
  const bottomRef = useRef();
  const inputRef  = useRef();

  const scen = SCENARIOS.find(s => s.id === selected);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [history]);

  function startScenario(s) {
    setSelected(s.id);
    const st = { ...makeState(s.id), host: s.host, user: s.user };
    setState(st);
    setCH([]); setHidx(-1);
    setTimeout(() => {
      setHist([
        { t:"warn", v:`╔══════════════════════════════════════════════════════════════════╗` },
        { t:"warn", v:`║  ⚠  ALERT — PagerDuty [TRIGGERED]                                ║` },
        { t:"warn", v:`║  ${s.alert.split("\n").map((l,i)=>i===0?l:l.padStart(l.length+2)).join("\n║  ")}` },
        { t:"warn", v:`╚══════════════════════════════════════════════════════════════════╝` },
        { t:"out",  v:`` },
        { t:"out",  v:`Connesso a ${s.host}  [${s.user}@${s.host.split(".")[0]}]` },
        { t:"out",  v:`Oracle Linux 8.9 — Kernel 5.15.0-206.153.7.el8uek.x86_64` },
        { t:"dim",  v:`'help' per i comandi · 'hint' per un suggerimento` },
        { t:"out",  v:`` },
      ]);
      inputRef.current?.focus();
    }, 50);
  }

  function submit() {
    const cmd = input.trim(); if (!cmd) return;
    setCH(h => [cmd, ...h].slice(0, 100)); setHidx(-1);
    const out = runCommand(cmd, state, setState);
    if (out.some(o => o.t === "__CLEAR__")) { setHist([]); setInput(""); return; }
    const host = state.host?.split(".")[0] || "server01";
    const user = state.user || "root";
    setHist(h => [...h, { t:"prompt", v:`[${user}@${host} ~]$ ${cmd}` }, ...out, { t:"out", v:"" }]);
    setInput("");
    setTimeout(() => {
      setState(st => {
        if (!st || st.solved) return st;
        const s = SCENARIOS.find(x => x.id === st.scenario);
        if (s?.checkSolved(st)) {
          const cause = s.cause;
          setHist(h => [...h,
            { t:"ok", v:`╔═══════════════════════════════════════════════════════════════╗` },
            { t:"ok", v:`║  ✅  INCIDENTE RISOLTO                                         ║` },
            { t:"ok", v:`║  Causa root: ${cause.substring(0,52)}${cause.length>52?"…":""}` },
            { t:"ok", v:`╚═══════════════════════════════════════════════════════════════╝` },
            { t:"out", v:"" },
          ]);
          return { ...st, solved: true };
        }
        return st;
      });
    }, 200);
  }

  function handleKey(e) {
    if (e.key==="Enter") { submit(); return; }
    if (e.key==="ArrowUp")   { e.preventDefault(); const i=Math.min(hidx+1,cmdHist.length-1); setHidx(i); setInput(cmdHist[i]||""); }
    if (e.key==="ArrowDown") { e.preventDefault(); const i=Math.max(hidx-1,-1); setHidx(i); setInput(i===-1?"":cmdHist[i]||""); }
  }

  const col = { out:"#7aab8a", err:"#e06060", ok:"#3dba74", warn:"#e8a020", prompt:"#5a9acf", dim:"#2a4a30" };

  // ── SELECTOR ──────────────────────────────────────────────────────────────
  if (!selected) return (
    <div style={{ minHeight:"100vh", background:"#060a08", fontFamily:"'JetBrains Mono','Fira Code',monospace", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
      <div style={{ marginBottom:32, textAlign:"center" }}>
        <div style={{ fontSize:10, letterSpacing:5, color:"#1a3a20", textTransform:"uppercase", marginBottom:6 }}>Linux SysAdmin · Scenari Reali</div>
        <div style={{ fontSize:22, fontWeight:900, color:"#0d2018", marginBottom:4 }}>Produzione. Niente guide.</div>
        <div style={{ fontSize:11, color:"#1a3020" }}>Scegli un incidente e risolvi con comandi reali.</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12, width:"100%", maxWidth:900 }}>
        {SCENARIOS.map(s => (
          <button key={s.id} onClick={() => startScenario(s)}
            style={{ background:"#0a100e", border:"1px solid #1a2820", borderRadius:10, padding:"18px 20px", cursor:"pointer", textAlign:"left", fontFamily:"inherit", transition:"all 0.15s" }}
            onMouseOver={e => { e.currentTarget.style.borderColor="#2a6a30"; e.currentTarget.style.background="#0c1410"; }}
            onMouseOut={e => { e.currentTarget.style.borderColor="#1a2820"; e.currentTarget.style.background="#0a100e"; }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
              <span style={{ fontSize:26, flexShrink:0 }}>{s.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ color:"#8ac8a0", fontWeight:700, fontSize:13, marginBottom:3 }}>{s.title}</div>
                <div style={{ color:"#2a5a38", fontSize:10, marginBottom:8 }}>{s.subtitle}</div>
                <div style={{ background:"#080e0a", borderRadius:5, padding:"8px 10px", borderLeft:"2px solid #2a4a20" }}>
                  {s.alert.split("\n").map((l,i) => (
                    <div key={i} style={{ fontSize:9, color: i===0?"#e8a020":"#2a4a30", lineHeight:1.7 }}>{l}</div>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // ── TERMINAL ──────────────────────────────────────────────────────────────
  const host = state?.host?.split(".")[0] || "server01";
  const user = state?.user || "root";
  return (
    <div style={{ height:"100vh", background:"#060a08", display:"flex", flexDirection:"column", fontFamily:"'JetBrains Mono','Fira Code',monospace" }}>
      {/* bar */}
      <div style={{ background:"#080e0c", borderBottom:"1px solid #1a2018", padding:"7px 14px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <div style={{ display:"flex", gap:5 }}>
          {["#ff5f57","#febc2e","#28c840"].map(c=><div key={c} style={{width:9,height:9,borderRadius:"50%",background:c}}/>)}
        </div>
        <span style={{ color:"#2a5a30", fontSize:11, marginLeft:4 }}>{user}@{host}</span>
        <span style={{ color:"#1a3a20", fontSize:10 }}>{scen?.title}</span>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:9, background: state?.solved?"#0d3020":"#2a0a08", color: state?.solved?"#3dba74":"#e06060", padding:"2px 8px", borderRadius:3, border:`1px solid ${state?.solved?"#1a6030":"#5a1010"}` }}>
            {state?.solved ? "✅ RISOLTO" : "⚠ INCIDENTE ATTIVO"}
          </span>
          <button onClick={()=>{setSelected(null);setState(null);setHist([]);}}
            style={{ padding:"2px 10px", background:"#1a2030", border:"1px solid #2a3040", borderRadius:4, color:"#4a5a6a", cursor:"pointer", fontSize:10, fontFamily:"inherit" }}>
            ← Scenari
          </button>
        </div>
      </div>
      {/* progress */}
      {scen && <Progress scen={scen} state={state||{}} />}
      {/* output */}
      <div onClick={()=>inputRef.current?.focus()} style={{ flex:1, overflowY:"auto", padding:"12px 16px", cursor:"text" }}>
        {history.map((line,i)=>(
          <div key={i} style={{ color:col[line.t]||"#7aab8a", fontSize:12, lineHeight:1.65, whiteSpace:"pre-wrap", wordBreak:"break-all" }}>
            {line.v}
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>
      {/* input */}
      <div style={{ borderTop:"1px solid #1a2018", padding:"9px 16px", display:"flex", alignItems:"center", gap:8, background:"#050908", flexShrink:0 }}>
        <span style={{ color:"#2a6a30", fontSize:12, whiteSpace:"nowrap" }}>[{user}@{host} ~]$</span>
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
          autoFocus spellCheck={false} autoComplete="off"
          style={{ flex:1, background:"none", border:"none", outline:"none", color:"#9ac8a8", fontFamily:"inherit", fontSize:12.5, caretColor:"#3dba74" }}
          placeholder=""/>
      </div>
    </div>
  );
}
