import React, { useState } from 'react';

export default function JamfPro() {
  const [profiles, setProfiles] = useState([
    { name: 'FileVault Encryption', scope: 'All Managed Macs', enabled: true },
    { name: 'Wi-Fi Corporate', scope: 'HQ + Branch', enabled: true },
  ]);
  const [profileName, setProfileName] = useState('');
  const [scope, setScope] = useState('Pilot Group');

  const addProfile = () => {
    if (!profileName.trim()) return;
    setProfiles((prev) => [...prev, { name: profileName.trim(), scope, enabled: false }]);
    setProfileName('');
  };

  const toggleProfile = (name) => {
    setProfiles((prev) => prev.map((p) => (p.name === name ? { ...p, enabled: !p.enabled } : p)));
  };

  return (
    <div className="rounded-lg bg-gray-100 p-4 text-gray-800 shadow-inner">
      <div className="-mx-4 -mt-4 mb-4 rounded-t-lg bg-red-700 p-2 text-white">JAMF PRO ADMIN</div>
      <h3 className="font-semibold">Configuration Profiles</h3>
      <ul className="mt-2 space-y-2">
        {profiles.map((p) => (
          <li key={p.name} className="rounded border bg-white p-2 text-sm">
            <div className="flex items-center justify-between">
              <span>{p.name}</span>
              <button onClick={() => toggleProfile(p.name)} className={`rounded px-2 py-0.5 text-xs ${p.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                {p.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <p className="text-xs text-gray-500">Scope: {p.scope}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded border border-dashed border-gray-400 bg-white p-3">
        <p className="mb-2 text-xs font-semibold text-gray-500">Create profile</p>
        <div className="grid gap-2 md:grid-cols-3">
          <input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Profile name" className="rounded border px-2 py-1 text-sm" />
          <input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Scope" className="rounded border px-2 py-1 text-sm" />
          <button onClick={addProfile} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">Upload .mobileconfig</button>
        </div>
      </div>
    </div>
  );
}
