# network-lab — Solution

## INCIDENT SUMMARY
The internal API endpoint `api.internal` is unreachable. The routing table at `/opt/winlab/network-lab/routing.table` has `api.internal unreachable` instead of a valid next-hop route. Traffic to the API is being dropped. The `network.state` marker reads `degraded`.

## ROOT CAUSE
`/opt/winlab/network-lab/routing.table` contains:
```
api.internal unreachable
```

The route to `api.internal` was removed (or misconfigured) during a network change, leaving the entry as `unreachable`. The correct route via gateway `10.0.0.10` was not restored.

## FIX

```bash
# Step 1 — inspect the routing table
cat /opt/winlab/network-lab/routing.table

# Step 2 — fix the unreachable route
sed -i 's/^api.internal unreachable$/api.internal via 10.0.0.10/' \
  /opt/winlab/network-lab/routing.table

# Step 3 — confirm the change
cat /opt/winlab/network-lab/routing.table

# Step 4 — update network state
echo healthy > /opt/winlab/network-lab/network.state
```

## WHY THIS FIX WORKED
Replacing the `unreachable` kernel route with a valid `via 10.0.0.10` next-hop entry restores the forwarding path to `api.internal`. The `healthy` state marker confirms the routing table is consistent.

## PRODUCTION LESSON
Routing changes are among the hardest incidents to diagnose because they often affect only a subset of traffic. Use `traceroute api.internal` and `ip route show` to identify unreachable routes. Always make routing changes in maintenance windows and verify with a connectivity test immediately after. Use network monitoring that traces end-to-end reachability, not just interface status.

## COMMANDS TO REMEMBER
```bash
cat /opt/winlab/network-lab/routing.table
sed -i 's/api.internal unreachable/api.internal via 10.0.0.10/' routing.table
echo healthy > /opt/winlab/network-lab/network.state
# On real systems:
ip route show
ip route add api.internal via 10.0.0.10
traceroute api.internal
```

## MENTOR_HINTS
1. API endpoint is unreachable → inspect the routing table at /opt/winlab/network-lab/routing.table
2. api.internal is set to unreachable → the correct route is via 10.0.0.10
3. Route corrected → also update network.state to healthy
4. Fix → sed -i 's/^api.internal unreachable$/api.internal via 10.0.0.10/' /opt/winlab/network-lab/routing.table && echo healthy > /opt/winlab/network-lab/network.state
