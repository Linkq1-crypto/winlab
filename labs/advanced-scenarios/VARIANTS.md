# advanced-scenarios — Variants

**Default variant:** `nginx-php-user-mismatch` (used when `LAB_VARIANT` is unset)

## Supported LAB_VARIANT values

| LAB_VARIANT | Broken file | Summary |
|---|---|---|
| `nginx-php-user-mismatch` | `php-fpm.conf` | PHP-FPM running as `apache`, Nginx needs `www-data` |
| `mysql-replica-deadlock` | `replica.status` | SQL thread stopped on deadlock, replication lagging 900s |
| `disk-log-flood` | `logs/app.log` (48 MB) | Runaway log flood consuming all disk space |
| `ssl-chain-expired` | `certificate.pem` | Certificate expired 2024-01-01, chain invalid |
| `cron-stopped-jobs` | `scheduler.state` | Cron daemon stopped, backup job missed |
| `java-oom` | `jvm.options` | JVM heap capped at 128m, crashing with OutOfMemoryError |

## Routing

Both `seed.sh` and `verify.sh` use a `case "${LAB_VARIANT:-nginx-php-user-mismatch}"` statement. `seed.sh` writes the active variant to `/opt/winlab/advanced-scenarios/active.variant`.

## Hint loading

The ML hint engine resolves hints using `labId` + `active.variant`:

```
labs/advanced-scenarios/<active.variant>/mentor/step{1..4}.txt
labs/advanced-scenarios/<active.variant>/locales/en.json
```

Read `active.variant` from the running container to determine the correct variant path.

## gen-lab.js invocation

```bash
node scripts/gen-lab.js advanced-scenarios/nginx-php-user-mismatch
node scripts/gen-lab.js advanced-scenarios/mysql-replica-deadlock
node scripts/gen-lab.js advanced-scenarios/disk-log-flood
node scripts/gen-lab.js advanced-scenarios/ssl-chain-expired
node scripts/gen-lab.js advanced-scenarios/cron-stopped-jobs
node scripts/gen-lab.js advanced-scenarios/java-oom
```
