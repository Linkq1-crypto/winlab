# real-server/apachewrk — Solution

> **Simulated incident.** This lab fixes a local Apache status file at `/opt/winlab/real-server/apache.status`. No real Apache is running. Verification checks the file contents only.

## INCIDENT SUMMARY
Apache has hit its `MaxRequestWorkers` limit. All 150 worker slots are occupied and new connections are being queued or refused. The worker count must be reduced to 90 (representing a recovered state) and the service state set to `stable`.

## ROOT CAUSE
`/opt/winlab/real-server/apache.status` contains:
```
MaxRequestWorkers=150
current_workers=150
```

Every worker slot is taken. Apache cannot spawn new workers to handle incoming requests. New clients wait until a slot frees or receive a 503 Service Unavailable.

## FIX

```bash
# Step 1 — inspect the worker state
cat /opt/winlab/real-server/apache.status

# Step 2 — reduce current workers to a healthy level
sed -i 's/^current_workers=150$/current_workers=90/' \
  /opt/winlab/real-server/apache.status

# Step 3 — mark the service stable
echo stable > /opt/winlab/real-server/service.state

# Step 4 — confirm
cat /opt/winlab/real-server/apache.status
cat /opt/winlab/real-server/service.state
```

## WHY THIS FIX WORKED
Setting `current_workers=90` represents idle workers becoming available after slow requests complete or are killed. At 60% worker utilisation, Apache can absorb bursts without hitting the limit.

## PRODUCTION LESSON
On real Apache with `mpm_prefork`: increase `MaxRequestWorkers` in `/etc/apache2/mods-enabled/mpm_prefork.conf` and reload. But first diagnose why workers are saturated — run `apachectl fullstatus` to see which URLs are holding workers open. Long-running PHP scripts, slow upstream proxies, or a connection flood are common causes. Consider switching to `mpm_event` (event-driven) which handles keep-alive connections with far fewer threads. Set `ServerLimit` and `MaxRequestWorkers` based on available RAM, not a guess.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/current_workers=150/current_workers=90/' /opt/winlab/real-server/apache.status
echo stable > /opt/winlab/real-server/service.state

# On real systems:
apachectl fullstatus                 # worker status and URL per slot
apachectl -t                         # test config syntax
systemctl reload apache2             # reload config without dropping connections
grep MaxRequestWorkers /etc/apache2/mods-enabled/mpm_*.conf
```

## MENTOR_HINTS
1. Apache is refusing new connections → read /opt/winlab/real-server/apache.status to see worker saturation
2. current_workers=150 equals MaxRequestWorkers — all slots are full → workers must be freed
3. Reduce current_workers to 90 to represent a recovered state with available slots
4. Fix → sed -i 's/current_workers=150/current_workers=90/' /opt/winlab/real-server/apache.status && echo stable > /opt/winlab/real-server/service.state
