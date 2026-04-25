# db-connection-failure — Solution

## INCIDENT SUMMARY
The application's database configuration points to a wrong host and port. `app.env` has `DB_HOST=db.internal` and `DB_PORT=9999`. The correct values are `DB_HOST=127.0.0.1` and `DB_PORT=5432`. The `connection.state` marker must also be updated to confirm the fix is applied.

## ROOT CAUSE
`/opt/winlab/db-connection-failure/app.env` contains misconfigured values:
```
DB_HOST=db.internal   ← wrong: non-existent hostname
DB_PORT=9999          ← wrong: no service on this port
```
This simulates a post-migration config drift where the environment file was not updated to reflect the new database location.

## FIX

```bash
# Step 1 — inspect the current config
cat /opt/winlab/db-connection-failure/app.env

# Step 2 — fix DB_HOST
sed -i 's/^DB_HOST=.*/DB_HOST=127.0.0.1/' /opt/winlab/db-connection-failure/app.env

# Step 3 — fix DB_PORT
sed -i 's/^DB_PORT=.*/DB_PORT=5432/' /opt/winlab/db-connection-failure/app.env

# Step 4 — confirm
cat /opt/winlab/db-connection-failure/app.env

# Step 5 — update connection state
echo connected > /opt/winlab/db-connection-failure/connection.state
```

## WHY THIS FIX WORKED
The environment file is the single source of truth for the application's database coordinates. Correcting the host and port restores connectivity. The `connection.state` flag signals that the change has been validated.

## PRODUCTION LESSON
Never hardcode database hostnames in application code. Use environment variables with validated defaults. After any infrastructure migration, run a connectivity check (`nc -zv $DB_HOST $DB_PORT`) before deploying application code. Audit all `.env` files in your repo for stale references.

## COMMANDS TO REMEMBER
```bash
cat /opt/winlab/db-connection-failure/app.env             # inspect
sed -i 's/^DB_HOST=.*/DB_HOST=127.0.0.1/' app.env        # fix host
sed -i 's/^DB_PORT=.*/DB_PORT=5432/' app.env              # fix port
echo connected > /opt/winlab/db-connection-failure/connection.state
nc -zv 127.0.0.1 5432                                     # test connectivity
```

## MENTOR_HINTS
1. Application cannot connect to the database → inspect the env config file
2. DB_HOST=db.internal and DB_PORT=9999 are wrong → correct values are 127.0.0.1 and 5432
3. Config updated → also update the connection.state marker to complete the fix
4. Fix → sed -i 's/^DB_HOST=.*/DB_HOST=127.0.0.1/;s/^DB_PORT=.*/DB_PORT=5432/' /opt/winlab/db-connection-failure/app.env && echo connected > /opt/winlab/db-connection-failure/connection.state
