# real-server/netflap — Solution

> **Simulated incident.** This lab fixes a local NIC state file at `/opt/winlab/real-server/nic.state`. No real network interface is involved. Verification checks the file contents only.

## INCIDENT SUMMARY
The primary network interface `eth0` is flapping — going up and down repeatedly — with an unstable carrier signal. Services are experiencing intermittent connectivity loss. The NIC state must be corrected to `up` with a `stable` carrier, and the service state set to `stable`.

## ROOT CAUSE
`/opt/winlab/real-server/nic.state` contains:
```
eth0=flapping
carrier=unstable
```

The network interface is losing carrier signal repeatedly. Each flap triggers a kernel NETDEV event, causes ARP cache invalidation, and drops existing TCP connections. Services dependent on persistent connections (databases, message queues) are most affected.

## FIX

```bash
# Step 1 — inspect the NIC state
cat /opt/winlab/real-server/nic.state

# Step 2 — restore the interface to up
sed -i 's/^eth0=flapping$/eth0=up/' \
  /opt/winlab/real-server/nic.state

# Step 3 — stabilise the carrier
sed -i 's/^carrier=unstable$/carrier=stable/' \
  /opt/winlab/real-server/nic.state

# Step 4 — mark the service stable
echo stable > /opt/winlab/real-server/service.state

# Step 5 — confirm
cat /opt/winlab/real-server/nic.state
cat /opt/winlab/real-server/service.state
```

## WHY THIS FIX WORKED
Setting `eth0=up` and `carrier=stable` represents a NIC that has stopped flapping — either a faulty cable was replaced, a duplex mismatch was corrected, or a driver was updated. TCP connections stop dropping and services recover.

## PRODUCTION LESSON
On real systems, interface flapping shows in `journalctl -k | grep eth0` as repeated `NETDEV_UP`/`NETDEV_DOWN` events. Check `ethtool eth0` for link speed and duplex — a mismatch (one side auto, other fixed 100Mbit/Full) causes CRC errors and flapping. Swap the physical cable first (common cause). Check `ip -s link show eth0` for RX/TX errors. If the NIC driver is suspect, check `dmesg | grep -i eth0` for firmware error messages.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/eth0=flapping/eth0=up/;s/carrier=unstable/carrier=stable/' \
  /opt/winlab/real-server/nic.state
echo stable > /opt/winlab/real-server/service.state

# On real systems:
ip link show eth0                           # interface state
ethtool eth0                               # speed, duplex, link status
ip -s link show eth0                       # RX/TX error counts
journalctl -k | grep -i eth0              # kernel NIC events
```

## MENTOR_HINTS
1. Network is intermittently dropping connections → read /opt/winlab/real-server/nic.state to see the interface state
2. eth0=flapping and carrier=unstable mean the NIC is losing carrier signal repeatedly → the physical link is unstable
3. Fix the carrier by checking the cable and driver, then restore eth0=up and carrier=stable
4. Fix → sed -i 's/eth0=flapping/eth0=up/;s/carrier=unstable/carrier=stable/' /opt/winlab/real-server/nic.state && echo stable > /opt/winlab/real-server/service.state
