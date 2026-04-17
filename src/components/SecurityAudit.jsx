import React, { useState } from 'react';

const mockFindings = [
  { severity: 'High', title: 'CVE-2024-21408', target: 'Server-01', patch: 'KB5037771' },
  { severity: 'Medium', title: 'Insecure Cipher Suite', target: 'Web-GW', patch: 'TLS Policy v2' },
  { severity: 'Low', title: 'Outdated OpenSSH Banner', target: 'Jump-Host', patch: 'OpenSSH 9.8' },
];

export default function SecurityAudit() {
  const [scanned, setScanned] = useState(false);
  const [findings, setFindings] = useState([]);

  const runScan = () => { setScanned(true); setFindings(mockFindings); };
  const remediate = (title) => { setFindings((prev) => prev.filter((f) => f.title !== title)); };

  return (
    <div className="rounded-lg border border-emerald-900 bg-zinc-950 p-4 text-emerald-500">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest">Vulnerability Scanner</h2>
        <button onClick={runScan} className="rounded bg-emerald-600 px-3 py-1 text-xs font-bold text-black">START SCAN</button>
      </div>
      {!scanned && <p className="animate-pulse text-zinc-600">Waiting for scan initiation...</p>}
      {scanned && (
        <div className="space-y-2">
          {findings.length === 0 && <p className="text-green-400">All findings remediated ✅</p>}
          {findings.map((v) => (
            <div key={v.title} className="rounded bg-zinc-900 p-2">
              <span className={`mr-2 font-bold ${v.severity === 'High' ? 'text-red-500' : v.severity === 'Medium' ? 'text-amber-400' : 'text-yellow-300'}`}>[{v.severity}]</span>
              <span className="text-white">{v.title}</span>
              <p className="text-[10px] uppercase text-zinc-500">{v.target} · Patch: {v.patch}</p>
              <button onClick={() => remediate(v.title)} className="mt-1 rounded bg-slate-700 px-2 py-1 text-[10px] text-white">Mark remediated</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
