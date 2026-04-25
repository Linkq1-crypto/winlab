# k8s-node-notready — Solution

> **Simulated incident.** This lab represents a Kubernetes node stuck in NotReady by editing a local status file at `/opt/winlab/k8s-node-notready/node.status`. No Kubernetes cluster is running. Verification checks the file contents only. The production lesson maps directly to real Kubernetes node recovery.

## INCIDENT SUMMARY
A Kubernetes node is stuck in `NotReady` state. The node status file shows `Ready=False` and `Kubelet=stopped`. The node cannot schedule new pods and existing pods on it are evicted. Both fields must be corrected to restore the node to a schedulable state.

## ROOT CAUSE
`/opt/winlab/k8s-node-notready/node.status` contains:
```
Ready=False
Kubelet=stopped
```

Two coupled faults:
1. `Kubelet=stopped` — the kubelet process is not running, so the node cannot communicate with the control plane or manage pods
2. `Ready=False` — with the kubelet stopped, the node fails its readiness conditions and is marked unschedulable

## FIX

```bash
# Step 1 — inspect the node status
cat /opt/winlab/k8s-node-notready/node.status

# Step 2 — restore the kubelet
sed -i 's/^Kubelet=stopped$/Kubelet=running/' \
  /opt/winlab/k8s-node-notready/node.status

# Step 3 — mark the node ready
sed -i 's/^Ready=False$/Ready=True/' \
  /opt/winlab/k8s-node-notready/node.status

# Step 4 — confirm
cat /opt/winlab/k8s-node-notready/node.status
```

## WHY THIS FIX WORKED
Restarting the kubelet allows the node to re-register with the API server and resume heartbeats. Once heartbeats resume, the control plane clears the `NotReady` condition and marks the node schedulable again. Pods can now be scheduled and running pods stop being evicted.

## PRODUCTION LESSON
A `NotReady` node in real Kubernetes almost always has one of four root causes: (1) kubelet is crashed or stopped — check `systemctl status kubelet` and `journalctl -u kubelet`; (2) disk pressure — the kubelet evicts pods when the node runs out of disk space; (3) memory pressure — OOM kills the kubelet itself; (4) network partition — the node is alive but cannot reach the API server. Always check `kubectl describe node <name>` for the `Conditions` section before taking action.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/Kubelet=stopped/Kubelet=running/' node.status
sed -i 's/Ready=False/Ready=True/' node.status

# On real Kubernetes:
kubectl get nodes                            # find NotReady nodes
kubectl describe node <name>                # see Conditions and events
systemctl restart kubelet                   # restart the kubelet
journalctl -u kubelet -n 50 --no-pager     # kubelet crash logs
kubectl cordon / kubectl uncordon <node>    # safely drain before maintenance
```

## MENTOR_HINTS
1. Node is in NotReady state → read /opt/winlab/k8s-node-notready/node.status to find the broken fields
2. Kubelet=stopped is the root cause → fix it to running first
3. Ready=False follows the stopped kubelet → also set it to True
4. Fix → sed -i 's/Kubelet=stopped/Kubelet=running/;s/Ready=False/Ready=True/' /opt/winlab/k8s-node-notready/node.status
