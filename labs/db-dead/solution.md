# db-dead — Solution

## INCIDENT SUMMARY
The database service is down. The simulation uses `fake_db.py`, a Python TCP server that listens on port 5432 and responds to connections. The process is not running. Applications attempting to connect to the database will get `Connection refused` on port 5432.

## ROOT CAUSE
`seed.sh` kills any running `fake_db.py` process but does not restart it. The `fake_db.py` file is written to disk but left un-started. Port 5432 has no listener, so all connection attempts fail immediately.

## FIX

```bash
# Step 1 — confirm port 5432 is not listening
ss -ltn | grep :5432
# Expected: no output

# Step 2 — confirm fake_db.py exists
ls /opt/winlab/db-dead/fake_db.py

# Step 3 — start the database process
nohup python3 /opt/winlab/db-dead/fake_db.py >/tmp/winlab-db-dead.log 2>&1 &
echo $! > /opt/winlab/db-dead/db.pid

# Step 4 — verify it is listening
sleep 1
ss -ltn | grep :5432
```

## WHY THIS FIX WORKED
Starting `fake_db.py` in the background creates a TCP listener on port 5432. The nohup ensures the process survives shell exit. Storing the PID allows future kill/restart operations.

## PRODUCTION LESSON
Database recovery SOP: (1) check process running, (2) check port listening, (3) check logs for crash reason before restarting — a crash loop means the start command is not the fix. After restart, verify with a real connection attempt: `psql -h 127.0.0.1 -U app -c '\l'`. Set a systemd service or supervisord config to auto-restart on failure.

## COMMANDS TO REMEMBER
```bash
ss -ltn | grep :5432                          # check if port is listening
pgrep -f fake_db.py                           # check if process is running
nohup python3 /opt/winlab/db-dead/fake_db.py >/tmp/winlab-db-dead.log 2>&1 &
echo $! > /opt/winlab/db-dead/db.pid          # store the new PID
```

## MENTOR_HINTS
1. Database connections are failing → check if port 5432 is listening with ss -ltn
2. Port 5432 has no listener → confirm fake_db.py exists and is not running
3. Process not running, file exists → start it in the background with nohup
4. Fix → nohup python3 /opt/winlab/db-dead/fake_db.py >/tmp/winlab-db-dead.log 2>&1 & && echo $! > /opt/winlab/db-dead/db.pid
