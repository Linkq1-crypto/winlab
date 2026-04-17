# WINLAB — Full Lab Catalog

> Status: ✅ Built | 🔨 Planned | 🚧 In Progress

---

## 🔴 FREE (Starter) — 5 Labs

| # | ID | Name | Icon | Description | Status |
|---|---|---|---|---|---|
| 1 | `linux-terminal` | Linux Terminal | 🖥️ | 24 real-world sysadmin scenarios (Apache down, disk full, SELinux, CPU 100%, SSH denied) | ✅ |
| 2 | — | Linux Basics | 🐧 | Core commands, file permissions, process management | ✅ (in linux-terminal) |
| 3 | — | Service Management | 🔧 | systemctl, journalctl, unit files | ✅ (in linux-terminal) |
| 4 | — | Network Diagnostics | 🌐 | ip, ss, ping, netstat, firewall basics | ✅ (in linux-terminal) |
| 5 | — | Log Analysis | 📋 | journalctl, tail, grep, log rotation | ✅ (in linux-terminal) |

---

## 🟡 PRO — 10+ Labs

| # | ID | Name | Icon | Description | Status |
|---|---|---|---|---|---|
| 6 | `raid-simulator` | RAID Configuration | 💾 | RAID 0/1/5/6/10 — create, degrade, rebuild, verify | ✅ |
| 7 | `os-install` | OS Installation | 📀 | Oracle Linux 8 install on RAID hardware — partitioning, LVM, first boot | ✅ |
| 8 | `vsphere` | vSphere | ☁️ | VM provisioning, templates, resource pools, snapshots | ✅ |
| 9 | `sssd-ldap` | SSSD / LDAP | 🔐 | LDAP integration, SSSD config, user sync, kerberos auth | ✅ |
| 10 | `real-server` | Real Server Incidents | 🔥 | Live incident response — syslog flood, OOM, zombie processes | ✅ |
| 11 | `advanced-scenarios` | Advanced Scenarios | ⚡ | NFS hang, LVM full, DNS failure, brute force SSH, kernel panic | ✅ |
| 12 | `ai-challenges` | AI Challenges | 🤖 | AI-generated custom sysadmin challenges | ✅ |
| 13 | `network-lab` | Network Lab | 🌐 | Routing, switching, VLANs, firewalls, OSPF, BGP | 🔨 |
| 14 | `security-audit` | Security Audit | 🛡️ | Penetration testing, compliance scanning, hardening | 🔨 |
| 15 | `intune-mdm` | Intune MDM | 🔐 | Microsoft Intune — device enrollment, compliance policies, app deployment | 🔨 |
| 16 | `jamf-pro` | Jamf Pro | 📦 | macOS MDM — enrollment profiles, app distribution, FileVault management | 🔨 |

---

## 🟣 ELITE (Business/MSP)

| # | ID | Name | Icon | Description | Status |
|---|---|---|---|---|---|
| 17 | `enterprise-arch` | Enterprise Architecture | 🏢 | Multi-site AD, Group Policy, DNS/DHCP, load balancing | 🔨 |
| 18 | `automation` | Automation | ⚙️ | Ansible playbooks, Terraform IaC, CI/CD pipelines | 🔨 |
| 19 | `cloud-infrastructure` | Cloud Infrastructure | ☁️ | AWS/GCP/Azure — VPC, EC2, S3, IAM, CloudFormation | 🔨 |
| 20 | `msp-multi-tenant` | Multi-Tenant MSP | 🌍 | Multi-environment, API access, team management, SLA monitoring | 🔨 |

---

## 📊 Totals

| Tier | Built | Planned | Total |
|---|---|---|---|
| Free | 5 | 5 | 5 |
| Pro | 8 | 4 | 12 |
| Elite | 0 | 4 | 4 |
| **TOTAL** | **13** | **13** | **21** |

---

## 🔨 Missing Labs (Priority Order)

### P0 — Must Build (mentioned in UI, missing simulators)

1. **Intune MDM** (`intune-mdm`) — Windows device management, compliance policies, conditional access
2. **Jamf Pro** (`jamf-pro`) — macOS MDM, enrollment profiles, FileVault, app deployment
3. **Network Lab** (`network-lab`) — exists as stub, needs full simulator
4. **Security Audit** (`security-audit`) — exists as stub, needs full simulator

### P1 — Should Build

5. **Enterprise Architecture** (`enterprise-arch`) — multi-site AD, Group Policy, DNS/DHCP
6. **Automation** (`automation`) — Ansible + Terraform labs
7. **Cloud Infrastructure** (`cloud-infrastructure`) — AWS/GCP/Azure scenarios

### P2 — Nice to Have

8. **Multi-Tenant MSP** (`msp-multi-tenant`) — API, team management, SLA

---

## Lab Detail Notes

### Linux Terminal (24 Scenarios)
**Free tier** — 5 scenarios open, 19 locked behind Pro:

| Tier | Scenarios |
|---|---|
| Free (5) | Apache down, Disk full, SELinux denial, CPU 100%, SSH denied |
| Pro (19) | MySQL down, RAM/Swap exhausted, Cron not executing, Zombie processes, Journald full, NFS mount hang, LVM volume full, DNS not resolving, Brute force SSH, Kernel panic boot, SSL cert expired, Inode exhausted, Port already occupied, Sudoers corrupted, RAID degraded, Logrotate broken, + more |

### RAID Simulator
Supports RAID 0/1/5/6/10 with realistic LSI MegaRAID controller UI.

### OS Installation
Oracle Linux 8 on RAID hardware — Anaconda text mode, LVM partitioning, first boot hardening.

### vSphere
VM provisioning, template cloning, resource pool management, snapshot lifecycle.

### SSSD / LDAP
Linux-AD integration — SSSD config, LDAP bind, Kerberos, sudo rules from AD.

### Real Server Incidents
Live incident response with syslog, OOM killer, zombie processes, disk exhaustion.

### Advanced Scenarios
Multi-stage incident investigations — NFS, LVM, DNS, SSH brute force, kernel panic.

### AI Challenges
AI-generated custom sysadmin scenarios with difficulty scaling.
