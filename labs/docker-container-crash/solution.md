# docker-container-crash — Solution

## INCIDENT SUMMARY
A containerised service has exited and will not auto-restart. `container.state` shows `restart_policy=no` and `status=exited`. The task simulates the ops procedure: update the restart policy to `unless-stopped` and mark the container as running to restore service.

## ROOT CAUSE
`/opt/winlab/docker-container-crash/container.state` contains:
```
restart_policy=no
status=exited
```

`restart_policy=no` means Docker will never restart the container on failure or host reboot. When the container crashes, it stays down. The correct policy for a production service is `unless-stopped`, which restarts automatically on any exit except an explicit `docker stop`.

## FIX

```bash
# Step 1 — inspect the current state
cat /opt/winlab/docker-container-crash/container.state

# Step 2 — update restart policy
sed -i 's/^restart_policy=.*/restart_policy=unless-stopped/' \
  /opt/winlab/docker-container-crash/container.state

# Step 3 — mark service as running
sed -i 's/^status=.*/status=running/' \
  /opt/winlab/docker-container-crash/container.state

# Step 4 — confirm
cat /opt/winlab/docker-container-crash/container.state
```

## WHY THIS FIX WORKED
`unless-stopped` is the production-safe restart policy. It restarts on crash, on Docker daemon restart, and on host reboot — but respects an explicit `docker stop`, allowing controlled maintenance. `always` would restart even after `docker stop`, which is rarely desirable.

## PRODUCTION LESSON
Set `restart: unless-stopped` (or `restart_policy: condition: on-failure` in Swarm) for every production service. In Kubernetes the equivalent is `restartPolicy: Always` for deployments. Combine with a proper `livenessProbe` so the orchestrator detects hangs, not just crashes.

## COMMANDS TO REMEMBER
```bash
# On real Docker systems:
docker update --restart unless-stopped <container>
docker inspect <container> --format '{{.HostConfig.RestartPolicy.Name}}'
docker ps -a --filter "status=exited"

# In this lab:
sed -i 's/^restart_policy=.*/restart_policy=unless-stopped/' container.state
sed -i 's/^status=.*/status=running/' container.state
```

## MENTOR_HINTS
1. Container is not running and does not restart → check the restart policy in container.state
2. restart_policy=no is the fault → change to unless-stopped
3. Policy updated → also set status=running to complete the state transition
4. Fix → sed -i 's/^restart_policy=.*/restart_policy=unless-stopped/;s/^status=.*/status=running/' /opt/winlab/docker-container-crash/container.state
