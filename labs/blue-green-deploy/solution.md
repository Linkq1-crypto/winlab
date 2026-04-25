# blue-green-deploy — Solution

## INCIDENT SUMMARY
A blue/green deployment is pending. The green slot is warmed up but not yet promoted. `live_slot` points to `blue`, `green.health` reads `warming`, and `deploy.state` is `switch_pending`. The task is to complete the cutover: mark green as healthy, switch live traffic to green, and update the deploy state.

## ROOT CAUSE
The deployment is not incomplete due to a failure — it is intentionally paused at the validation gate. `green.health=warming` signals the green environment has not passed its final health check. Traffic remains on blue until the operator confirms green is ready.

## FIX

```bash
# Step 1 — inspect the current state
cat /opt/winlab/blue-green-deploy/live_slot
cat /opt/winlab/blue-green-deploy/green.health
cat /opt/winlab/blue-green-deploy/deploy.state

# Step 2 — mark green as healthy (post validation)
echo healthy > /opt/winlab/blue-green-deploy/green.health

# Step 3 — switch live traffic to green
echo green > /opt/winlab/blue-green-deploy/live_slot

# Step 4 — update deploy state
echo switched > /opt/winlab/blue-green-deploy/deploy.state
```

## WHY THIS FIX WORKED
Setting `green.health=healthy` confirms the validation gate passed. Updating `live_slot=green` simulates the DNS/load-balancer switch. `deploy.state=switched` closes the deployment window and signals monitoring that the cutover is complete.

## PRODUCTION LESSON
The blue/green pattern eliminates deployment downtime by keeping the previous version warm. The key discipline is the health-check gate — never cut over until green passes all smoke tests. Keep blue warm for at least one full request cycle so rollback takes seconds, not minutes. Route only 5-10% of traffic to green initially (canary step) before full cutover.

## COMMANDS TO REMEMBER
```bash
cat /opt/winlab/blue-green-deploy/{live_slot,green.health,deploy.state}
echo healthy > /opt/winlab/blue-green-deploy/green.health
echo green   > /opt/winlab/blue-green-deploy/live_slot
echo switched > /opt/winlab/blue-green-deploy/deploy.state
```

## MENTOR_HINTS
1. Deployment is paused at switch_pending → check green.health to see why traffic hasn't moved
2. green.health is warming → validate green, then set it to healthy
3. green is healthy → switch live_slot from blue to green
4. Fix → echo healthy > green.health && echo green > live_slot && echo switched > deploy.state
