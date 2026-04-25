# cicd-broken-pipeline — Solution

## INCIDENT SUMMARY
The CI/CD pipeline is failing. `pipeline.state` reads `failed`. The pipeline config at `pipeline.env` is missing a required secret (`CI_SECRET` is empty) and targets the wrong environment (`DEPLOY_ENV=staging` instead of `production`). Both must be fixed and `pipeline.state` set to `passed`.

## ROOT CAUSE
`/opt/winlab/cicd-broken-pipeline/pipeline.env` contains:
```
CI_SECRET=
DEPLOY_ENV=staging
```

Two faults:
1. `CI_SECRET` is empty — the pipeline cannot authenticate to the deployment target
2. `DEPLOY_ENV=staging` — the pipeline is targeting the wrong environment; the production deploy is blocked

## FIX

```bash
# Step 1 — inspect the pipeline config
cat /opt/winlab/cicd-broken-pipeline/pipeline.env

# Step 2 — set CI_SECRET to any non-empty value
sed -i 's/^CI_SECRET=$/CI_SECRET=deploy-token-prod/' \
  /opt/winlab/cicd-broken-pipeline/pipeline.env

# Step 3 — point to production
sed -i 's/^DEPLOY_ENV=.*/DEPLOY_ENV=production/' \
  /opt/winlab/cicd-broken-pipeline/pipeline.env

# Step 4 — confirm
cat /opt/winlab/cicd-broken-pipeline/pipeline.env

# Step 5 — mark pipeline as passed
echo passed > /opt/winlab/cicd-broken-pipeline/pipeline.state
```

## WHY THIS FIX WORKED
Providing a non-empty `CI_SECRET` satisfies the authentication requirement. Switching `DEPLOY_ENV` to `production` ensures the pipeline targets the correct environment. The `passed` state marker signals that the pipeline completed successfully.

## PRODUCTION LESSON
Never store secrets as empty strings — use a secrets manager (Vault, AWS Secrets Manager, GitHub Actions secrets) and fail the pipeline loudly if a required secret is missing. Add an env validation step at the start of every pipeline that asserts all required vars are set and non-empty. Use `set -u` in shell scripts so unset variables cause immediate failure.

## COMMANDS TO REMEMBER
```bash
cat /opt/winlab/cicd-broken-pipeline/pipeline.env
sed -i 's/^CI_SECRET=$/CI_SECRET=deploy-token-prod/' pipeline.env
sed -i 's/^DEPLOY_ENV=.*/DEPLOY_ENV=production/' pipeline.env
echo passed > /opt/winlab/cicd-broken-pipeline/pipeline.state
```

## MENTOR_HINTS
1. Pipeline is failing → inspect /opt/winlab/cicd-broken-pipeline/pipeline.env for missing config
2. CI_SECRET is empty and DEPLOY_ENV is staging → set CI_SECRET to any non-empty value and change DEPLOY_ENV to production
3. Config is fixed → update pipeline.state to passed
4. Fix → sed -i 's/^CI_SECRET=$/CI_SECRET=token/;s/^DEPLOY_ENV=.*/DEPLOY_ENV=production/' /opt/winlab/cicd-broken-pipeline/pipeline.env && echo passed > /opt/winlab/cicd-broken-pipeline/pipeline.state
