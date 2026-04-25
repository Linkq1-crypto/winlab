# pm2-crash-recovery — Solution

## INCIDENT SUMMARY
The application process managed by the process supervisor has crashed. `pm2.status` reads `crashed` and no process is listening on port 4001. A `start-app.sh` script is provided to restart the process and restore the `online` status marker.

## ROOT CAUSE
`seed.sh` kills any running `pm2_demo.py` process and sets `pm2.status=crashed` without restarting it. The application is down. Port 4001 has no listener. The recovery script `start-app.sh` already exists at `/opt/winlab/pm2-crash-recovery/start-app.sh` and handles the full restart sequence.

## FIX

```bash
# Step 1 — confirm app is down
cat /opt/winlab/pm2-crash-recovery/pm2.status
ss -ltn | grep :4001
# Expected: crashed / no output

# Step 2 — run the recovery script
bash /opt/winlab/pm2-crash-recovery/start-app.sh

# Step 3 — verify the process is running and port is listening
cat /opt/winlab/pm2-crash-recovery/pm2.status   # should be: online
ss -ltn | grep :4001                             # should show listener
```

## WHY THIS FIX WORKED
`start-app.sh` starts `pm2_demo.py` with `nohup`, stores the PID, and writes `online` to `pm2.status`. This is the same role a real process supervisor (pm2, systemd, supervisord) plays — starting the process, tracking its PID, and updating status.

## PRODUCTION LESSON
Never rely on manual restarts in production. Use a process supervisor with `--watch` mode or a systemd unit with `Restart=on-failure`. Add a health check endpoint and configure your load balancer to remove the node from rotation when the health check fails. The recovery script pattern used here mirrors pm2's `pm2 start` command.

## COMMANDS TO REMEMBER
```bash
cat /opt/winlab/pm2-crash-recovery/pm2.status         # check status
ss -ltn | grep :4001                                  # check port
bash /opt/winlab/pm2-crash-recovery/start-app.sh      # run recovery script
cat /opt/winlab/pm2-crash-recovery/app.pid            # read the new PID
```

## MENTOR_HINTS
1. Application is down, pm2.status is crashed → check if anything is listening on port 4001
2. Port 4001 has no listener → look for a recovery script in the lab directory
3. start-app.sh exists → run it to restart the process and update the status marker
4. Fix → bash /opt/winlab/pm2-crash-recovery/start-app.sh
