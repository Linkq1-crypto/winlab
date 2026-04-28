# ssh-misconfigured — Solution

## ROOT CAUSE

`seed.sh` overwrites `/etc/ssh/sshd_config` with two faults and leaves sshd stopped:

1. **Port 2222** — non-standard port, clients connecting on 22 get refused
2. **PasswordAuthentication no** — users without SSH keys cannot authenticate even if they find port 2222

## DIAGNOSTIC COMMANDS

```bash
# is sshd running?
pgrep sshd

# test config validity
/usr/sbin/sshd -t

# read the config
cat /etc/ssh/sshd_config

# check what ports are listening (after starting sshd)
ss -tlnp | grep sshd
```

## FIX

```bash
# fix the port
sed -i 's/^Port 2222/Port 22/' /etc/ssh/sshd_config

# enable password authentication
sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config

# validate
/usr/sbin/sshd -t

# start
/usr/sbin/sshd

# confirm
ss -tlnp | grep ':22 '
```

## VERIFY LOGIC

`verify.sh` passes when:
1. `/usr/sbin/sshd -t` exits 0 (config valid)
2. `pgrep sshd` finds a running process
3. `ss -tlnp` shows `:22` listening
4. `sshd -T` reports `passwordauthentication yes`

## LESSON

> After any sshd_config change, always run `sshd -t` before restarting.
> A misconfigured sshd that fails to restart locks everyone out of the server.
> Two faults compound each other: wrong port AND no password auth means
> even a user who discovers port 2222 cannot connect without a key.

## MENTOR_HINTS

1. sshd is not running → check config: /usr/sbin/sshd -t && cat /etc/ssh/sshd_config
2. Two problems found → fix port: sed -i 's/^Port 2222/Port 22/' /etc/ssh/sshd_config
3. Fix password auth: sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
4. Start sshd: /usr/sbin/sshd — confirm: ss -tlnp | grep ':22 '
