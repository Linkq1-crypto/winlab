# env-var-update — Solution

## INCIDENT SUMMARY
The application is in a broken state because its environment configuration has not been updated for the production deployment. `app.env` has `APP_MODE=broken` and `FEATURE_LOGIN=disabled`. Both must be corrected to restore normal operation.

## ROOT CAUSE
`/opt/winlab/env-var-update/app.env` contains placeholder values from the development environment that were never overridden before deploy:
```
APP_MODE=broken
FEATURE_LOGIN=disabled
```

`APP_MODE=broken` causes the application to return error responses. `FEATURE_LOGIN=disabled` blocks all authentication attempts.

## FIX

```bash
# Step 1 — inspect the current config
cat /opt/winlab/env-var-update/app.env

# Step 2 — set production mode
sed -i 's/^APP_MODE=.*/APP_MODE=production/' /opt/winlab/env-var-update/app.env

# Step 3 — enable login
sed -i 's/^FEATURE_LOGIN=.*/FEATURE_LOGIN=enabled/' /opt/winlab/env-var-update/app.env

# Step 4 — confirm
cat /opt/winlab/env-var-update/app.env
```

## WHY THIS FIX WORKED
Environment variables are the primary configuration mechanism for twelve-factor applications. Updating `APP_MODE` to `production` restores normal request handling. Enabling `FEATURE_LOGIN` restores authentication — critical for any user-facing service.

## PRODUCTION LESSON
Never use `broken` or `disabled` as default values that require manual override. Use explicit validation on startup: if `APP_MODE` is not one of `development|staging|production`, fail the process immediately. Use a secrets manager or config service to inject production values at deploy time, not at build time, so the same artefact runs in all environments.

## COMMANDS TO REMEMBER
```bash
cat /opt/winlab/env-var-update/app.env
sed -i 's/^APP_MODE=.*/APP_MODE=production/' /opt/winlab/env-var-update/app.env
sed -i 's/^FEATURE_LOGIN=.*/FEATURE_LOGIN=enabled/' /opt/winlab/env-var-update/app.env
```

## MENTOR_HINTS
1. Application is broken → inspect /opt/winlab/env-var-update/app.env for misconfigured values
2. APP_MODE=broken and FEATURE_LOGIN=disabled → set APP_MODE=production
3. APP_MODE fixed → also set FEATURE_LOGIN=enabled
4. Fix → sed -i 's/^APP_MODE=.*/APP_MODE=production/;s/^FEATURE_LOGIN=.*/FEATURE_LOGIN=enabled/' /opt/winlab/env-var-update/app.env
