import React, { useMemo, useState } from 'react';

const initialDevices = [
  { id: 'WIN-01', user: 'm.rossi', os: 'Windows 11 23H2', encrypted: true, osUpToDate: true, avActive: true, lastCheckIn: '2026-04-11 08:22' },
  { id: 'WIN-02', user: 'a.bianchi', os: 'Windows 10 22H2', encrypted: false, osUpToDate: true, avActive: true, lastCheckIn: '2026-04-11 08:01' },
  { id: 'WIN-03', user: 'l.verdi', os: 'Windows 11 22H2', encrypted: true, osUpToDate: false, avActive: true, lastCheckIn: '2026-04-10 18:40' },
];

const evaluateCompliance = (device, policy) => {
  const checks = {
    encrypted: !policy.requireEncryption || device.encrypted,
    osUpToDate: !policy.requireOsUpToDate || device.osUpToDate,
    avActive: !policy.requireAvActive || device.avActive,
  };
  const failedRules = Object.entries(checks).filter(([, pass]) => !pass).map(([rule]) => rule);
  return { compliant: failedRules.length === 0, failedRules };
};

export default function IntuneMDM() {
  const [policy, setPolicy] = useState({ name: 'Baseline Windows Compliance', requireEncryption: true, requireOsUpToDate: true, requireAvActive: true });
  const [devices, setDevices] = useState(initialDevices);
  const report = useMemo(() => devices.map((d) => ({ ...d, ...evaluateCompliance(d, policy) })), [devices, policy]);
  const compliantCount = report.filter((d) => d.compliant).length;

  const remediateDevice = (id) => {
    setDevices((prev) => prev.map((d) => d.id === id ? { ...d, encrypted: true, osUpToDate: true, avActive: true, lastCheckIn: '2026-04-11 09:00' } : d));
  };

  return (
    <div className="rounded-lg bg-slate-900 p-4 text-white">
      <h2 className="mb-1 text-xl font-bold">Microsoft Intune Dashboard</h2>
      <p className="mb-4 text-sm text-slate-300">Policy: {policy.name}</p>
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <label className="flex items-center gap-2 rounded bg-slate-800 px-2 py-1">
          <input type="checkbox" checked={policy.requireEncryption} onChange={(e) => setPolicy((p) => ({ ...p, requireEncryption: e.target.checked }))} />
          Require BitLocker
        </label>
        <label className="flex items-center gap-2 rounded bg-slate-800 px-2 py-1">
          <input type="checkbox" checked={policy.requireOsUpToDate} onChange={(e) => setPolicy((p) => ({ ...p, requireOsUpToDate: e.target.checked }))} />
          Require OS Updates
        </label>
        <label className="flex items-center gap-2 rounded bg-slate-800 px-2 py-1">
          <input type="checkbox" checked={policy.requireAvActive} onChange={(e) => setPolicy((p) => ({ ...p, requireAvActive: e.target.checked }))} />
          Require Defender
        </label>
      </div>
      <p className="mb-2 text-sm">Compliance score: <span className="font-semibold">{compliantCount}/{report.length}</span></p>
      <div className="grid gap-2">
        {report.map((d) => (
          <div key={d.id} className="rounded border border-slate-700 p-2 text-sm">
            <div className="flex items-center justify-between">
              <span>{d.id} ({d.os}) — {d.user}</span>
              <span className={d.compliant ? 'text-green-400' : 'text-red-400'}>{d.compliant ? 'Compliant' : 'Non-compliant'}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Last check-in: {d.lastCheckIn}</p>
            {!d.compliant && (
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-red-300">Failed: {d.failedRules.join(', ')}</p>
                <button onClick={() => remediateDevice(d.id)} className="rounded bg-blue-600 px-2 py-1 text-xs">Remediate</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
