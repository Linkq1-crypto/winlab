# WinLab — Catalogo Lab

> Aggiornato: 2026-04-24

---

## Starter Tier

| ID | Titolo | Difficoltà | Durata | Tags |
|----|--------|-----------|--------|------|
| `linux-terminal` | **Linux Terminal — Le basi dalla riga di comando** | Easy | 15 min | linux, bash, terminal, basics, filesystem |
| `enhanced-terminal` | **Lab Guidato — 3 incidenti reali con AI Mentor** | Easy | 20 min | linux, apache, disk, security, guided |
| `disk-full` | **Disco pieno — Server bloccato** | Easy | 8 min | disk, storage, linux, find |
| `nginx-port-conflict` | **Conflitto di porta — Nginx non parte** | Easy | 6 min | nginx, port, systemd, linux |

---

## Pro Tier

| ID | Titolo | Difficoltà | Durata | Tags |
|----|--------|-----------|--------|------|
| `permission-denied` | **Accesso bloccato — Permission denied** | Medium | 10 min | permissions, chmod, selinux, acl, linux |
| `raid-simulator` | **RAID Configuration — Gestione array e recovery** | Medium | 20 min | raid, storage, mdadm, linux, disk-recovery |
| `memory-leak` | **Memory leak — App crasha sotto carico** | Hard | 15 min | memory, performance, debug, linux, nodejs |
| `db-dead` | **Database irraggiungibile — Servizio offline** | Hard | 20 min | database, mysql, postgresql, recovery, linux |
| `sssd-ldap` | **SSSD / LDAP — Gli utenti sono spariti** | Hard | 25 min | sssd, ldap, active-directory, authentication, enterprise |
| `advanced-scenarios` | **Scenari avanzati — 6 incidenti reali di produzione** | Hard | 20 min | nginx, mysql, disk, ssl, cron, java, oom, production |
| `real-server` | **Incidenti server reali — 12 scenari di produzione** | Hard | 25 min | iostat, apache, mysql, tcpdump, strace, oom, fsck, dns |

---

## Dettaglio: Advanced Scenarios (6 sub-scenari)

| # | Titolo | Stack | Causa nascosta |
|---|--------|-------|----------------|
| 1 | 502 Bad Gateway | Nginx + PHP-FPM | `www.conf` copiato da staging Apache — `user=apache` non esiste |
| 2 | MySQL Replica Rotta | MySQL replication | Deadlock su slave durante UPDATE massivo → SQL thread stopped (errore 1213) |
| 3 | *(+ altri 4)* | — | — |

## Dettaglio: Real Server (12 scenari)

| # | ID | Descrizione |
|---|-----|-------------|
| 1 | `iowait` | I/O Wait alto — iostat 98%, disco saturo, app bloccate |
| 2 | `apachewrk` | Apache workers esauriti — MaxRequestWorkers raggiunto |
| 3 | `mysqlslow` | MySQL slow queries — query bloccate in SHOW PROCESSLIST |
| 4 | `netflap` | NIC flapping — eth0 su e giù, errori link in dmesg |
| 5 | `timewait` | TIME_WAIT flood — port exhaustion, 28k connessioni |
| 6 | `tcpdump` | Traffico anomalo — connessione sospetta da analizzare |
| 7 | `strace` | Processo hung — strace rivela la causa |
| 8 | `coredump` | Core dump crash — analisi con gdb |
| 9 | `syslogflood` | Syslog flood — 50k msg/sec da un processo |
| 10 | `fsck` | Filesystem corrotto — EXT4 da riparare con fsck |
| 11 | `oomkiller` | OOM killer selettivo — Java heap leak, uccide il processo sbagliato |
| 12 | `infoblox` | Infoblox DNS timeout — DHCP/DNS Infoblox ko |

---

## Codex Incident Labs (Code debugging con AI)

| ID | Titolo | Obiettivo |
|----|--------|-----------|
| `api-timeout-n-plus-one` | **API Timeout: N+1 Query** | Ridurre la latenza /orders fixando pattern N+1 sul DB |
| `auth-bypass-jwt-trust` | **Auth Bypass: JWT Trust Bug** | Bloccare privilege escalation da JWT claim non verificati |
| `stripe-webhook-forgery` | **Stripe Webhook Forgery** | Rifiutare webhook Stripe non firmati (raw body preservation) |

---

## Ops Playbook Lab (Scenari operativi)

| ID | Titolo |
|----|--------|
| `deploy-new-version` | Deploy New Version |
| `rollback-failed-deploy` | Rollback Failed Deploy |
| `nginx-reload` | Nginx Config Reload |
| `pm2-crash-recovery` | PM2 Process Crash Recovery |
| `ssl-certificate-renewal` | SSL Certificate Renewal |
| `cloudflare-cache-purge` | Cloudflare Cache Purge |
| `memory-leak-diagnosis` | Memory Leak Diagnosis |
| `db-connection-failure` | Database Connection Failure |
| `env-var-update` | Update Environment Variable in Production |
| `ghost-asset-incident` | The 70-Hour Bug |
| `disk-full-recovery` | Disk Full — Emergency Recovery |
| `docker-container-crash` | Docker Container Crash Loop |
| `k8s-crashloop` | Kubernetes CrashLoopBackOff |
| `redis-oom` | Redis OOM — Cache Eviction Storm |
| `blue-green-deploy` | Zero-Downtime Blue-Green Deploy |
| `cicd-broken-pipeline` | CI/CD Pipeline — Missing Secret |
| `k8s-node-notready` | Kubernetes Node NotReady |

---

## Business Tier (placeholder, non ancora implementati)

| ID | Titolo | Stato |
|----|--------|-------|
| `network-lab` | Network Lab Simulator | Placeholder |
| `security-audit` | Security Audit Simulator | Placeholder |
| `apache-ssl` | Apache SSL | WIP (no content) |

---

## Riepilogo

| Categoria | Count |
|-----------|-------|
| Starter labs | 4 |
| Pro labs | 7 |
| Codex Incident Labs | 3 |
| Ops Playbook scenari | 17 |
| Business (placeholder) | 3 |
| **Totale** | **34** |
