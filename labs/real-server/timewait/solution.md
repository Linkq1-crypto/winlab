# real-server/timewait — Solution

> **Simulated incident.** This lab fixes a local socket state file at `/opt/winlab/real-server/socket.state`. No real network stack is modified. Verification checks the file contents only.

## INCIDENT SUMMARY
The server has 28,000 TCP sockets in TIME_WAIT state, exhausting the local port range and preventing new outbound connections. Applications are failing with "Cannot assign requested address". The TIME_WAIT count must be reduced to 500 and port exhaustion cleared, with the service state set to `stable`.

## ROOT CAUSE
`/opt/winlab/real-server/socket.state` contains:
```
time_wait=28000
port_exhaustion=true
```

Each short-lived outbound TCP connection leaves the local port in TIME_WAIT for 60 seconds (the `2*MSL` window). At 28,000 concurrent TIME_WAIT sockets, the ephemeral port range (`ip_local_port_range`, typically 32768–60999 = ~28,000 ports) is fully consumed.

## FIX

```bash
# Step 1 — inspect the socket state
cat /opt/winlab/real-server/socket.state

# Step 2 — reduce TIME_WAIT to a healthy level
sed -i 's/^time_wait=28000$/time_wait=500/' \
  /opt/winlab/real-server/socket.state

# Step 3 — clear port exhaustion
sed -i 's/^port_exhaustion=true$/port_exhaustion=false/' \
  /opt/winlab/real-server/socket.state

# Step 4 — mark the service stable
echo stable > /opt/winlab/real-server/service.state

# Step 5 — confirm
cat /opt/winlab/real-server/socket.state
cat /opt/winlab/real-server/service.state
```

## WHY THIS FIX WORKED
Enabling `tcp_tw_reuse` (or reducing request rate) allows the kernel to reuse TIME_WAIT sockets for new outbound connections, dropping the count from 28,000 to a manageable 500. With ports available, new connections succeed.

## PRODUCTION LESSON
Enable `net.ipv4.tcp_tw_reuse=1` in `/etc/sysctl.conf` to allow reuse of TIME_WAIT sockets for new connections. Also widen the ephemeral port range: `net.ipv4.ip_local_port_range = 1024 65535`. For services making many short-lived connections (HTTP clients, Redis), use connection pooling — a persistent pool of 20 connections eliminates thousands of TIME_WAIT sockets. Check with `ss -s` (socket statistics) and `ss -t state time-wait | wc -l`.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/time_wait=28000/time_wait=500/;s/port_exhaustion=true/port_exhaustion=false/' \
  /opt/winlab/real-server/socket.state
echo stable > /opt/winlab/real-server/service.state

# On real systems:
ss -s                                           # socket summary stats
ss -t state time-wait | wc -l                  # count TIME_WAIT sockets
sysctl net.ipv4.tcp_tw_reuse=1                 # enable socket reuse
sysctl net.ipv4.ip_local_port_range            # check ephemeral range
cat /proc/sys/net/ipv4/ip_local_port_range
```

## MENTOR_HINTS
1. Applications fail with cannot assign address errors → read /opt/winlab/real-server/socket.state to see the socket count
2. time_wait=28000 has exhausted the ephemeral port range → port_exhaustion=true confirms no ports are left
3. Enable tcp_tw_reuse or reduce connection rate to drop TIME_WAIT count; then set time_wait=500 and port_exhaustion=false
4. Fix → sed -i 's/time_wait=28000/time_wait=500/;s/port_exhaustion=true/port_exhaustion=false/' /opt/winlab/real-server/socket.state && echo stable > /opt/winlab/real-server/service.state
