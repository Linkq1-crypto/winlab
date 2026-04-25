# real-server — Variants

**Default variant:** `iowait` (used when `LAB_VARIANT` is unset)

## Supported LAB_VARIANT values

| LAB_VARIANT | Broken file | Summary |
|---|---|---|
| `iowait` | `hot-disk.img` (64 MB) | Large file saturating disk I/O throughput |
| `apachewrk` | `apache.status` | All 150 worker slots occupied, new connections refused |
| `mysqlslow` | `mysql.processlist` | 78 slow queries at 18s each, missing index |
| `netflap` | `nic.state` | eth0 flapping with unstable carrier signal |
| `timewait` | `socket.state` | 28,000 TIME_WAIT sockets exhausting ephemeral port range |
| `tcpdump` | `capture.summary` | Suspicious outbound connection to 198.51.100.24 |
| `strace` | `hung-process.trace` | Process hung waiting on stale lock file |
| `coredump` | `coredump.report` | api-gateway crashed, core dump pending analysis |
| `syslogflood` | `syslog.spam` (32 MB) | Syslog flood filling disk partition |
| `fsck` | `filesystem.state` | ext4 marked dirty after unclean shutdown |
| `oomkiller` | `oom.report` | OOM killer fired, nginx killed due to heap leak |
| `infoblox` | `dns.state` | DNS resolver timing out, DHCP degraded |

## Routing

Both `seed.sh` and `verify.sh` use `case "${LAB_VARIANT:-iowait}"`. All variants share the same first verify check: `service.state` must equal `stable`. Then each variant has an additional file-specific check.

`seed.sh` writes the active variant to `/opt/winlab/real-server/active.variant`.

## Hint loading

The ML hint engine resolves hints using `labId` + `active.variant`:

```
labs/real-server/<active.variant>/mentor/step{1..4}.txt
labs/real-server/<active.variant>/locales/en.json
```

Read `active.variant` from the running container to determine the correct variant path.

## gen-lab.js invocation

```bash
node scripts/gen-lab.js real-server/iowait
node scripts/gen-lab.js real-server/apachewrk
node scripts/gen-lab.js real-server/mysqlslow
node scripts/gen-lab.js real-server/netflap
node scripts/gen-lab.js real-server/timewait
node scripts/gen-lab.js real-server/tcpdump
node scripts/gen-lab.js real-server/strace
node scripts/gen-lab.js real-server/coredump
node scripts/gen-lab.js real-server/syslogflood
node scripts/gen-lab.js real-server/fsck
node scripts/gen-lab.js real-server/oomkiller
node scripts/gen-lab.js real-server/infoblox
```
