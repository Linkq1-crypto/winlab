import React, { useState } from 'react';

export default function NetworkLab() {
  const [log, setLog] = useState(['Switch-L3 initialized...', 'VLAN 10: Up', 'VLAN 20: Up']);
  const [command, setCommand] = useState('');

  const executeCommand = () => {
    const cmd = command.trim().toLowerCase();
    if (!cmd) return;
    if (cmd.startsWith('ping')) {
      const target = cmd.split(' ')[1] || '192.168.1.1';
      setLog((prev) => [...prev, `Pinging ${target}... Reply in 2ms`]);
    } else if (cmd === 'show vlan') {
      setLog((prev) => [...prev, 'VLAN 10 - USERS - ACTIVE', 'VLAN 20 - SERVERS - ACTIVE']);
    } else if (cmd === 'show ip route') {
      setLog((prev) => [...prev, '0.0.0.0/0 via 192.168.1.254', '192.168.1.0/24 directly connected']);
    } else if (cmd === 'show ip interface brief') {
      setLog((prev) => [...prev, 'Gi0/0  192.168.1.1  UP  UP', 'Gi0/1  10.0.0.1     UP  UP', 'Gi0/2  unassigned   DOWN  DOWN']);
    } else if (cmd === 'show spanning-tree') {
      setLog((prev) => [...prev, 'VLAN 10: Root Bridge - This switch', 'VLAN 20: Root Bridge - 00:1A:2B:3C:4D:5E']);
    } else {
      setLog((prev) => [...prev, `% Unknown command: ${cmd}`]);
    }
    setCommand('');
  };

  return (
    <div className="rounded-lg bg-black p-4 font-mono text-green-500">
      <div className="mb-4 h-48 overflow-auto rounded border border-green-800 p-2 text-sm">
        {log.map((line, i) => (<div key={`${line}-${i}`}>{`> ${line}`}</div>))}
      </div>
      <div className="flex gap-2">
        <span className="text-white">console#</span>
        <input className="w-full border-none bg-transparent text-green-500 outline-none" value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && executeCommand()} placeholder="ping 8.8.8.8 | show vlan | show ip route" />
      </div>
    </div>
  );
}
