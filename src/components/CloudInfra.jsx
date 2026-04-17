import React, { useMemo, useState } from "react";

const drills = [
  {
    id: "dr",
    title: "Disaster Recovery Simulator (RTO/RPO)",
    objective: "Maintain RTO < 15 min and RPO < 5 min during failover.",
    target: { regionsUp: 2, dbReplicaLag: 4, trafficShift: 100 },
  },
  {
    id: "outage",
    title: "Cloud Outage War Room",
    objective: "Isolate the faulted region and bring the error rate below 2%.",
    target: { regionsUp: 2, dbReplicaLag: 6, trafficShift: 100 },
  },
  {
    id: "hybrid",
    title: "Hybrid Cloud Failure Scenario",
    objective: "Restore the on-prem ↔ cloud link without data loss.",
    target: { regionsUp: 3, dbReplicaLag: 3, trafficShift: 80 },
  },
];

export default function CloudInfra() {
  const [drillIndex, setDrillIndex] = useState(0);
  const [state, setState] = useState({ regionsUp: 1, dbReplicaLag: 12, trafficShift: 40, errorRate: 9.8 });
  const [timeline, setTimeline] = useState(["War room started: primary region unreachable."]);

  const drill = drills[drillIndex];
  const solved = useMemo(
    () =>
      state.regionsUp >= drill.target.regionsUp &&
      state.dbReplicaLag <= drill.target.dbReplicaLag &&
      state.trafficShift >= drill.target.trafficShift &&
      state.errorRate <= 2,
    [drill.target.dbReplicaLag, drill.target.regionsUp, drill.target.trafficShift, state]
  );

  const act = (action) => {
    if (action === "failover") {
      setState((s) => ({
        ...s,
        regionsUp: Math.min(3, s.regionsUp + 1),
        trafficShift: Math.min(100, s.trafficShift + 30),
        errorRate: Math.max(1.1, +(s.errorRate - 2.5).toFixed(1)),
      }));
      setTimeline((log) => ["Multi-region failover executed.", ...log]);
    }
    if (action === "db-sync") {
      setState((s) => ({ ...s, dbReplicaLag: Math.max(1, s.dbReplicaLag - 4), errorRate: Math.max(1, +(s.errorRate - 0.8).toFixed(1)) }));
      setTimeline((log) => ["Database replica sync accelerated.", ...log]);
    }
    if (action === "reroute") {
      setState((s) => ({ ...s, trafficShift: Math.min(100, s.trafficShift + 20), errorRate: Math.max(0.8, +(s.errorRate - 1.5).toFixed(1)) }));
      setTimeline((log) => ["Global LB update: traffic rerouted.", ...log]);
    }
  };

  const nextDrill = () => {
    if (!solved) return;
    if (drillIndex < drills.length - 1) {
      setDrillIndex((i) => i + 1);
      setState({ regionsUp: 1, dbReplicaLag: 10, trafficShift: 50, errorRate: 8.6 });
      setTimeline((log) => [`New drill started: ${drills[drillIndex + 1].title}`, ...log]);
      return;
    }
    setTimeline((log) => ["✅ All cloud drills completed.", ...log]);
  };

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <h2>{drill.title}</h2>
      <p>{drill.objective}</p>
      <p>
        Target → Regions up: {drill.target.regionsUp}, Replica lag: {drill.target.dbReplicaLag}m, Traffic shift: {drill.target.trafficShift}%
      </p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <p>Regions up: {state.regionsUp}</p>
        <p>DB replica lag: {state.dbReplicaLag}m</p>
        <p>Traffic shift: {state.trafficShift}%</p>
        <p>Error rate: {state.errorRate}%</p>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => act("failover")}>
          Trigger Failover
        </button>
        <button type="button" onClick={() => act("db-sync")}>
          DB Sync Recovery
        </button>
        <button type="button" onClick={() => act("reroute")}>
          Reroute Traffic
        </button>
      </div>
      <button type="button" disabled={!solved} onClick={nextDrill}>
        {drillIndex < drills.length - 1 ? "Confirm & next drill" : "Confirm completion"}
      </button>
      <ul>
        {timeline.slice(0, 8).map((line, i) => (
          <li key={`${line}-${i}`}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
