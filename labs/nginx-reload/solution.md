# nginx-reload — Solution

## INCIDENT SUMMARY
nginx is running but serving a broken config. A new virtual host was added to `/etc/nginx/conf.d/winlab-reload.conf` with a syntax error — a missing semicolon after the `return` directive. nginx started with the old config but the new config has not been loaded. A reload will fail until the syntax is fixed.

## ROOT CAUSE
`/etc/nginx/conf.d/winlab-reload.conf` contains:

```nginx
return 200 "reload pending"
```

nginx requires a semicolon at the end of every directive. Without it, `nginx -t` fails and no reload is possible.

## FIX

```bash
# Step 1 — see the error
nginx -t

# Step 2 — fix the semicolon
sed -i 's/return 200 "reload pending"/return 200 "reload pending";/' \
  /etc/nginx/conf.d/winlab-reload.conf

# Step 3 — confirm config is valid
nginx -t

# Step 4 — reload nginx (zero-downtime)
nginx -s reload
```

## WHY THIS FIX WORKED
`nginx -s reload` sends `SIGHUP` to the master process, which re-reads all config files without dropping existing connections. No restart required, no downtime.

## PRODUCTION LESSON
Always run `nginx -t` before attempting a reload. In CI/CD, gate the deploy on `nginx -t && nginx -s reload` so a bad config never reaches production. Use `nginx -T` to dump the full merged config for easier debugging of include files.

## COMMANDS TO REMEMBER
```bash
nginx -t                        # test config syntax
nginx -s reload                 # reload without downtime
nginx -T 2>&1 | grep -n error   # full config dump with line numbers
journalctl -u nginx -n 50       # recent logs (systemd systems)
```

## MENTOR_HINTS
1. nginx config has a syntax error → run nginx -t to find it
2. nginx -t reports the bad directive → inspect the conf.d file
3. Missing semicolon after return directive → add the semicolon
4. Fix → sed -i 's/return 200 "reload pending"/return 200 "reload pending";/' /etc/nginx/conf.d/winlab-reload.conf && nginx -t && nginx -s reload
