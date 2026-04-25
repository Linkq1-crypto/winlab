# real-server/tcpdump — Solution

> **Simulated incident.** This lab fixes a local capture summary file at `/opt/winlab/real-server/capture.summary`. No real packet capture is performed. Verification checks the file contents only.

## INCIDENT SUMMARY
A packet capture has revealed a suspicious outbound connection from `198.51.100.24`. The source may indicate exfiltration or a compromised process. The connection must be investigated and blocked, the capture summary updated to `suspicious_connection=false`, and the service state set to `stable`.

## ROOT CAUSE
`/opt/winlab/real-server/capture.summary` contains:
```
suspicious_connection=true
source=198.51.100.24
```

An unexpected outbound connection was detected to an external IP (`198.51.100.24` is a documentation address representing an unknown external host). In production this would require firewall blocking and process investigation.

## FIX

```bash
# Step 1 — inspect the capture summary
cat /opt/winlab/real-server/capture.summary

# Step 2 — mark the suspicious connection as blocked/resolved
sed -i 's/^suspicious_connection=true$/suspicious_connection=false/' \
  /opt/winlab/real-server/capture.summary

# Step 3 — mark the service stable
echo stable > /opt/winlab/real-server/service.state

# Step 4 — confirm
cat /opt/winlab/real-server/capture.summary
cat /opt/winlab/real-server/service.state
```

## WHY THIS FIX WORKED
Setting `suspicious_connection=false` records that the connection has been blocked via firewall rule and the offending process identified and stopped. The network is clean and services can resume normal operation.

## PRODUCTION LESSON
When a tcpdump capture shows unexpected outbound traffic: (1) identify the process with `ss -tp` or `lsof -i @<dst_ip>` — the PID is shown next to the connection; (2) check what the process is with `ps -p <pid> -o comm,cmd`; (3) block the IP immediately with `iptables -A OUTPUT -d 198.51.100.24 -j DROP`; (4) check for persistence mechanisms (`crontab -l`, `/etc/init.d/`, systemd units); (5) preserve evidence before killing (copy the binary, capture memory). File an incident report — unexpected outbound connections are a security finding.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/suspicious_connection=true/suspicious_connection=false/' \
  /opt/winlab/real-server/capture.summary
echo stable > /opt/winlab/real-server/service.state

# On real systems:
tcpdump -i eth0 -n host 198.51.100.24              # capture packets to/from IP
ss -tp                                              # connections with PID
lsof -i @198.51.100.24                             # process owning connection
iptables -A OUTPUT -d 198.51.100.24 -j DROP        # block outbound
```

## MENTOR_HINTS
1. Packet capture shows unexpected outbound connection → read /opt/winlab/real-server/capture.summary to find the source IP
2. suspicious_connection=true from 198.51.100.24 indicates a potentially compromised process making unexpected outbound calls
3. Identify the process, block the IP with iptables, and stop the offending process
4. Fix → sed -i 's/suspicious_connection=true/suspicious_connection=false/' /opt/winlab/real-server/capture.summary && echo stable > /opt/winlab/real-server/service.state
