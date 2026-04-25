# advanced-scenarios/nginx-php-user-mismatch — Solution

> **Simulated incident.** This lab fixes a local PHP-FPM config file at `/opt/winlab/advanced-scenarios/php-fpm.conf`. No real Nginx or PHP-FPM process is running. Verification checks the file contents only. The production lesson maps directly to real permission debugging.

## INCIDENT SUMMARY
Nginx is returning 502 Bad Gateway for all PHP requests. The root cause is a user mismatch between Nginx and PHP-FPM: the socket at `/run/php-fpm.sock` is owned by `www-data` (Nginx's user) but PHP-FPM is running as `apache`. Nginx cannot write to a socket it does not own. Both `user` and `group` in the PHP-FPM config must be changed to `www-data`, and the service state set to `healthy`.

## ROOT CAUSE
`/opt/winlab/advanced-scenarios/php-fpm.conf` contains:
```
user=apache
group=apache
listen=/run/php-fpm.sock
```

PHP-FPM creates the socket as the `apache` user. Nginx runs as `www-data`. The socket permissions deny `www-data` access → every proxied PHP request fails with a 502.

## FIX

```bash
# Step 1 — inspect the broken config
cat /opt/winlab/advanced-scenarios/php-fpm.conf

# Step 2 — fix the user
sed -i 's/^user=apache$/user=www-data/' \
  /opt/winlab/advanced-scenarios/php-fpm.conf

# Step 3 — fix the group
sed -i 's/^group=apache$/group=www-data/' \
  /opt/winlab/advanced-scenarios/php-fpm.conf

# Step 4 — mark the service healthy
echo healthy > /opt/winlab/advanced-scenarios/service.state

# Step 5 — confirm
cat /opt/winlab/advanced-scenarios/php-fpm.conf
cat /opt/winlab/advanced-scenarios/service.state
```

## WHY THIS FIX WORKED
With `user=www-data` and `group=www-data`, PHP-FPM creates the socket owned by `www-data`. Nginx, which also runs as `www-data`, can now connect to the socket. The 502 errors stop immediately after PHP-FPM is restarted with the new config.

## PRODUCTION LESSON
In real systems, PHP-FPM user mismatch is a common post-deployment 502. Check it with `ls -la /run/php-fpm.sock` (socket owner) vs `ps aux | grep nginx` (Nginx worker user). The fix is always: set `user` and `group` in `/etc/php/<ver>/fpm/pool.d/www.conf` to match the Nginx worker user, then `systemctl reload php-fpm`. Never run PHP-FPM as root.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/user=apache/user=www-data/;s/group=apache/group=www-data/' \
  /opt/winlab/advanced-scenarios/php-fpm.conf
echo healthy > /opt/winlab/advanced-scenarios/service.state

# On real systems:
ls -la /run/php-fpm.sock              # check socket ownership
ps aux | grep -E 'nginx|php-fpm'      # compare running users
systemctl reload php-fpm              # reload after config change
nginx -t && systemctl reload nginx    # validate and reload nginx
```

## MENTOR_HINTS
1. Nginx returns 502 Bad Gateway on PHP requests → read /opt/winlab/advanced-scenarios/php-fpm.conf to find the user mismatch
2. user=apache and group=apache do not match Nginx's www-data user → the socket is inaccessible to Nginx
3. Change user and group to www-data so Nginx can connect to the PHP-FPM socket
4. Fix → sed -i 's/user=apache/user=www-data/;s/group=apache/group=www-data/' /opt/winlab/advanced-scenarios/php-fpm.conf && echo healthy > /opt/winlab/advanced-scenarios/service.state
