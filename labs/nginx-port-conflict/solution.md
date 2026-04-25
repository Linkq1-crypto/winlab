# solution: nginx-port-conflict

## ROOT CAUSE

The container installs both `apache2` and `nginx`. The issue is **not** a service conflict — it is a nginx **configuration error**.

The nginx package on Ubuntu auto-enables the default site:

```
/etc/nginx/sites-enabled/default  →  symlink to sites-available/default
```

That file declares:

```nginx
listen 80 default_server;
listen [::]:80 default_server;
```

`seed.sh` also generates `/etc/nginx/conf.d/winlab-nginx-recovered.conf` which declares:

```nginx
listen 80 default_server;
```

nginx constraint: **one `default_server` per address:port combination**.
Two declarations = config-level fatal error:

```
nginx: [emerg] duplicate default server for 0.0.0.0:80
```

---

## DIAGNOSTIC COMMANDS

```bash
# validate nginx config → reveals the error
nginx -t 2>&1

# find all default_server declarations
grep -Rn "default_server" /etc/nginx

# confirm sites-enabled content
ls -la /etc/nginx/sites-enabled/

# inspect the conflicting file
cat /etc/nginx/sites-enabled/default | grep -n "listen"
```

---

## FIX

```bash
# remove the default site (it is boilerplate — real config lives in conf.d/)
rm /etc/nginx/sites-enabled/default

# validate
nginx -t

# start
nginx
```

---

## WHY rm AND NOT sed

| Option | Notes |
|--------|-------|
| `rm /etc/nginx/sites-enabled/default` | Clean, standard, production-realistic |
| `sed` to strip `default_server` | Leaves ambiguous config, not idiomatic |

Removing the default site and managing vhosts in `conf.d/` is standard practice in production nginx setups.

---

## FINAL STATE

```
/etc/nginx/sites-enabled/          → empty
/etc/nginx/conf.d/winlab-nginx-recovered.conf  → sole default_server on :80
                                                  responds: "WinLab nginx recovered"
nginx -t                           → OK
nginx status                       → running
verify.sh                          → VERIFY_OK
```

---

## VERIFY LOGIC

`verify.sh` passes because:

1. **Port free** — no process occupies :80
2. **Config valid** — `nginx -t` exits 0
3. **Service up** — nginx is running
4. **Correct response** — `curl localhost` contains `"WinLab nginx recovered"`

---

## LESSON

> Not every port 80 error is a port conflict.
> After freeing the port, always validate the service configuration.

Two separate failure layers exist:
- **Layer 1** — port occupied (process conflict)
- **Layer 2** — config invalid (duplicate `default_server`)

Resolving layer 1 exposes layer 2. Both must be fixed.

---

## MENTOR_HINTS

1. Port 80 was occupied → find and kill the conflicting process
2. Port is now free, but nginx still fails → validate config
3. Config error → duplicate default_server on :80
4. Fix → remove /etc/nginx/sites-enabled/default (one default_server only)
