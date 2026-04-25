# sssd-ldap — Solution

> **Simulated incident.** This lab fixes `/etc/sssd/sssd.conf` and a local state file inside the container. No real LDAP server is contacted — the verify check reads file contents only. The production lesson maps directly to real SSSD/LDAP configuration recovery.

## INCIDENT SUMMARY
Users cannot log in because SSSD is configured to contact an offline LDAP server and credential caching is disabled. The `ldap_uri` points to `ldap://offline.winlab.local` (a host that does not respond) and `cache_credentials = false` means SSSD cannot fall back to cached credentials. Both settings must be corrected and the directory state file updated to `online`.

## ROOT CAUSE
`/etc/sssd/sssd.conf` contains:
```
ldap_uri = ldap://offline.winlab.local
cache_credentials = false
```

And `/opt/winlab/sssd-ldap/directory.state` contains:
```
offline
```

Two coupled faults:
1. `ldap_uri` points to a dead host — SSSD cannot reach the directory server
2. `cache_credentials = false` — without a cache, every login requires a live LDAP response; when the server is down, all logins fail

## FIX

```bash
# Step 1 — inspect the broken config
cat /etc/sssd/sssd.conf
cat /opt/winlab/sssd-ldap/directory.state

# Step 2 — point SSSD at the correct LDAP server
sed -i 's/^ldap_uri = ldap:\/\/offline\.winlab\.local$/ldap_uri = ldap:\/\/directory.winlab.local/' \
  /etc/sssd/sssd.conf

# Step 3 — enable credential caching for offline resilience
sed -i 's/^cache_credentials = false$/cache_credentials = true/' \
  /etc/sssd/sssd.conf

# Step 4 — mark the directory as online
echo online > /opt/winlab/sssd-ldap/directory.state

# Step 5 — confirm
grep 'ldap_uri\|cache_credentials' /etc/sssd/sssd.conf
cat /opt/winlab/sssd-ldap/directory.state
```

## WHY THIS FIX WORKED
Changing `ldap_uri` to `ldap://directory.winlab.local` points SSSD at a reachable server so live authentication works again. Enabling `cache_credentials = true` allows SSSD to store hashed credentials locally — if the LDAP server goes offline briefly, users who have logged in before can still authenticate from the cache. Together these settings provide both connectivity and resilience.

## PRODUCTION LESSON
Always enable `cache_credentials = true` in SSSD — it is the primary protection against authentication outages during LDAP downtime. Set a `cache_credentials_minimal_first_factor_length` to enforce a minimum password length for cached logins. After changing sssd.conf in production, run `systemctl restart sssd` and `sss_cache -E` to flush the credential cache and force a re-read of the config. Test login with `id <user>` before declaring the incident resolved.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's|ldap_uri = ldap://offline.winlab.local|ldap_uri = ldap://directory.winlab.local|' /etc/sssd/sssd.conf
sed -i 's/cache_credentials = false/cache_credentials = true/' /etc/sssd/sssd.conf
echo online > /opt/winlab/sssd-ldap/directory.state

# On real systems:
systemctl status sssd                     # check if sssd is running
journalctl -u sssd -n 50 --no-pager      # sssd error logs
sss_cache -E                              # flush credential cache
id <username>                             # test LDAP lookup
```

## MENTOR_HINTS
1. Users cannot log in and SSSD is failing → inspect /etc/sssd/sssd.conf and /opt/winlab/sssd-ldap/directory.state
2. ldap_uri points to offline.winlab.local → change it to directory.winlab.local
3. cache_credentials is false → set it to true so logins work during LDAP downtime
4. Fix → sed -i 's|ldap_uri = ldap://offline.winlab.local|ldap_uri = ldap://directory.winlab.local|' /etc/sssd/sssd.conf && sed -i 's/cache_credentials = false/cache_credentials = true/' /etc/sssd/sssd.conf && echo online > /opt/winlab/sssd-ldap/directory.state
