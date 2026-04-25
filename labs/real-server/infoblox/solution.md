# real-server/infoblox — Solution

> **Simulated incident.** This lab fixes a local DNS/DHCP state file at `/opt/winlab/real-server/dns.state`. No real Infoblox appliance is contacted. Verification checks the file contents only.

## INCIDENT SUMMARY
The Infoblox DNS/DHCP appliance is degraded. The resolver is timing out and DHCP is not serving leases. Both the DNS resolver and DHCP service must be restored to `healthy`, with the service state set to `stable`.

## ROOT CAUSE
`/opt/winlab/real-server/dns.state` contains:
```
resolver=timeout
dhcp=degraded
```

The Infoblox Grid member is unreachable or overloaded. DNS resolution is timing out (no response within 5 seconds), causing application connection failures. DHCP is degraded, meaning new hosts cannot obtain IP addresses.

## FIX

```bash
# Step 1 — inspect the DNS/DHCP state
cat /opt/winlab/real-server/dns.state

# Step 2 — restore DNS resolver
sed -i 's/^resolver=timeout$/resolver=healthy/' \
  /opt/winlab/real-server/dns.state

# Step 3 — restore DHCP service
sed -i 's/^dhcp=degraded$/dhcp=healthy/' \
  /opt/winlab/real-server/dns.state

# Step 4 — mark the service stable
echo stable > /opt/winlab/real-server/service.state

# Step 5 — confirm
cat /opt/winlab/real-server/dns.state
cat /opt/winlab/real-server/service.state
```

## WHY THIS FIX WORKED
Setting `resolver=healthy` confirms DNS queries are now resolving with normal latency. Setting `dhcp=healthy` confirms DHCP lease assignment is working. In production, this state is reached after restarting the Infoblox Grid service or failing over to a secondary Grid member.

## PRODUCTION LESSON
Infoblox outages affect every host on the network simultaneously — DNS timeout causes application-level failures that look like network or backend outages. Diagnose with `dig @<infoblox-ip> example.com` (check the resolver directly) and `nmap -p 53 <infoblox-ip>` (check if port 53 is reachable). For DHCP, check `dhclient -v` on an affected host. Mitigation: configure redundant DNS resolvers in `/etc/resolv.conf` (`nameserver <infoblox1>`, `nameserver <infoblox2>`) so that if one times out, the OS retries on the second. For Infoblox Grid, ensure two or more Grid members are configured for high availability.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/resolver=timeout/resolver=healthy/;s/dhcp=degraded/dhcp=healthy/' \
  /opt/winlab/real-server/dns.state
echo stable > /opt/winlab/real-server/service.state

# On real systems:
dig @<infoblox-ip> example.com          # test DNS resolver directly
nmap -p 53 <infoblox-ip>               # check DNS port
dhclient -v eth0                        # test DHCP lease acquisition
cat /etc/resolv.conf                    # check configured resolvers
systemctl restart named                 # restart BIND if self-hosted
```

## MENTOR_HINTS
1. DNS resolution is timing out and DHCP is not working → read /opt/winlab/real-server/dns.state to see the Infoblox state
2. resolver=timeout means DNS queries are not getting responses → the Infoblox Grid member needs to be restarted or failed over
3. dhcp=degraded means DHCP is not serving leases → restore it after the DNS resolver is healthy
4. Fix → sed -i 's/resolver=timeout/resolver=healthy/;s/dhcp=degraded/dhcp=healthy/' /opt/winlab/real-server/dns.state && echo stable > /opt/winlab/real-server/service.state
