# k8s-crashloop — Solution

> **Simulated incident.** This lab represents a Kubernetes pod in CrashLoopBackOff by editing a local YAML file at `/opt/winlab/k8s-crashloop/deployment.yaml`. No Kubernetes cluster is running. Verification checks the file contents only. The production lesson maps directly to real Kubernetes incident response.

## INCIDENT SUMMARY
A Kubernetes pod is stuck in `CrashLoopBackOff`. The deployment file shows a broken liveness probe, an invalid image tag, and an unhealthy pod status. The pod restarts indefinitely because the container never passes its health check. The three fields must be corrected to restore the deployment to a running state.

## ROOT CAUSE
`/opt/winlab/k8s-crashloop/deployment.yaml` contains:
```
livenessProbe: broken
imageTag: bad-build
podStatus: CrashLoopBackOff
```

Two concurrent faults:
1. `imageTag: bad-build` — the container image does not exist or fails to start
2. `livenessProbe: broken` — the health check is misconfigured, causing Kubernetes to kill and restart the container before it stabilises

Both must be corrected together. Fixing only the image tag without correcting the probe leaves the pod failing health checks. Fixing only the probe still leaves the container unable to start from a bad image.

## FIX

```bash
# Step 1 — inspect the current deployment state
cat /opt/winlab/k8s-crashloop/deployment.yaml

# Step 2 — fix the liveness probe
sed -i 's/^livenessProbe: broken$/livenessProbe: healthy/' \
  /opt/winlab/k8s-crashloop/deployment.yaml

# Step 3 — fix the image tag
sed -i 's/^imageTag: bad-build$/imageTag: stable/' \
  /opt/winlab/k8s-crashloop/deployment.yaml

# Step 4 — update pod status
sed -i 's/^podStatus: CrashLoopBackOff$/podStatus: Running/' \
  /opt/winlab/k8s-crashloop/deployment.yaml

# Step 5 — confirm
cat /opt/winlab/k8s-crashloop/deployment.yaml
```

## WHY THIS FIX WORKED
Setting `livenessProbe: healthy` restores the health-check configuration so Kubernetes stops restarting the container. Setting `imageTag: stable` points the deployment to an image that exists and starts cleanly. Once both faults are resolved the pod status can advance to `Running`.

## PRODUCTION LESSON
In real Kubernetes, `CrashLoopBackOff` almost always has one of three root causes: (1) the container image is bad — check `kubectl describe pod` for `ImagePullBackOff` or exit codes; (2) the liveness probe is too aggressive (probe interval shorter than startup time) — use a `startupProbe` to give the container time to initialise; (3) the application is crashing at runtime — check `kubectl logs <pod> --previous` for the last crash output. Always fix the root cause before restarting; a restart loop is a symptom, not a fix.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/livenessProbe: broken/livenessProbe: healthy/' deployment.yaml
sed -i 's/imageTag: bad-build/imageTag: stable/' deployment.yaml
sed -i 's/podStatus: CrashLoopBackOff/podStatus: Running/' deployment.yaml

# On real Kubernetes:
kubectl describe pod <name>           # see probe failures and image errors
kubectl logs <pod> --previous         # last crash output
kubectl set image deployment/<name> app=registry/image:stable
kubectl rollout status deployment/<name>
```

## MENTOR_HINTS
1. Pod is in CrashLoopBackOff → read deployment.yaml to find the two broken fields
2. livenessProbe is broken and imageTag is bad-build → fix livenessProbe to healthy first
3. Probe fixed → also change imageTag to stable
4. Fix → sed -i 's/livenessProbe: broken/livenessProbe: healthy/;s/imageTag: bad-build/imageTag: stable/;s/podStatus: CrashLoopBackOff/podStatus: Running/' /opt/winlab/k8s-crashloop/deployment.yaml
