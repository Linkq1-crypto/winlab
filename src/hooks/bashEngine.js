/**
 * WinLab Bash Engine
 * Provides: virtual filesystem, pipe parsing, chain parsing (&&, ;), path resolution,
 * pipe filters (grep, wc, head, tail, awk, sort, uniq, cut), standalone commands
 * (cd, ls, pwd, date, echo, which, env, cat for VFS paths).
 *
 * Usage:
 *   import { VFS, resolvePath, promptDir, runBashLayer, applyChain } from './bashEngine';
 *   const [cwd, setCwd] = useState('/root');
 *   // In submit_val:
 *   const { out, newCwd, handled } = runBashLayer(raw, cwd, setCwd, instanceId);
 *   if (handled) { setHistory(...out); setCwd(newCwd); return; }
 *   // else fall through to scenario-specific runCommand
 */

// ── Virtual Filesystem ────────────────────────────────────────────────────────
export const VFS = {
  '/':                      { type:'d', children:['bin','boot','dev','etc','home','opt','proc','root','run','sbin','srv','sys','tmp','usr','var'] },
  '/bin':                   { type:'d', children:['bash','cat','cp','echo','grep','ls','mkdir','mv','rm','sh','touch'] },
  '/etc':                   { type:'d', children:['crontab','fstab','hosts','hostname','httpd','my.cnf','nginx','nsswitch.conf','passwd','resolv.conf','rsyslog.conf','shadow','sysctl.conf','systemd'] },
  '/etc/hosts':             { type:'f', content:'127.0.0.1 localhost\n::1       localhost\n10.0.1.100 server01.prod.lab.local server01' },
  '/etc/hostname':          { type:'f', content:'server01.prod.lab.local' },
  '/etc/resolv.conf':       { type:'f', content:'nameserver 10.0.10.1\nnameserver 10.0.10.2\nsearch lab.local' },
  '/etc/sysctl.conf':       { type:'f', content:'vm.swappiness = 10\nnet.core.somaxconn = 65535\n# TCP TIME_WAIT tuning not configured' },
  '/etc/passwd':            { type:'f', content:'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nmysql:x:27:27:MySQL Server:/var/lib/mysql:/bin/false\napache:x:48:48:Apache:/var/www/html:/sbin/nologin\napp:x:1001:1001:App User:/home/app:/bin/bash' },
  '/etc/my.cnf':            { type:'f', content:'[mysqld]\ninnodb_file_per_table = 0\ninnodb_flush_log_at_trx_commit = 1\ninnodb_flush_method = fsync\nbind-address = 127.0.0.1\nmax_connections = 500' },
  '/etc/rsyslog.conf':      { type:'f', content:'# /etc/rsyslog.conf\nmodule(load="imjournal")\n# no rate limiting configured  ← PROBLEM' },
  '/etc/crontab':           { type:'f', content:'SHELL=/bin/bash\nPATH=/sbin:/bin:/usr/sbin:/usr/bin\n#min  hour  dom  mon  dow  user  command\n0 * * * * root /usr/local/bin/backup.sh' },
  '/etc/httpd':             { type:'d', children:['conf','conf.d','logs','modules'] },
  '/etc/httpd/conf':        { type:'d', children:['httpd.conf','magic'] },
  '/etc/httpd/conf/httpd.conf': { type:'f', content:'ServerRoot "/etc/httpd"\n<IfModule mpm_prefork_module>\n    StartServers 5\n    MinSpareServers 5\n    MaxSpareServers 20\n    MaxRequestWorkers 256\n    MaxConnectionsPerChild 0\n</IfModule>' },
  '/etc/nginx':             { type:'d', children:['nginx.conf','sites-available','sites-enabled','conf.d'] },
  '/etc/nginx/nginx.conf':  { type:'f', content:'user nginx;\nworker_processes auto;\nerror_log /var/log/nginx/error.log warn;\npid /run/nginx.pid;\nevents { worker_connections 1024; }\nhttp { include /etc/nginx/sites-enabled/*; }' },
  '/etc/nginx/sites-available':{ type:'d', children:['default','myapp'] },
  '/etc/nginx/sites-enabled':  { type:'d', children:['myapp'] },
  '/etc/systemd':           { type:'d', children:['system','network'] },
  '/home':                  { type:'d', children:['app','deploy'] },
  '/home/app':              { type:'d', children:['.bashrc','.bash_history'] },
  '/opt':                   { type:'d', children:['app'] },
  '/opt/app':               { type:'d', children:['bin','config','logs'] },
  '/opt/app/bin':           { type:'d', children:['app_server','run.sh'] },
  '/opt/app/config':        { type:'d', children:['app.conf','jvm.conf'] },
  '/opt/app/config/jvm.conf':{ type:'f', content:'-Xms4g\n-Xmx15g\n-XX:+UseG1GC\n-XX:MaxGCPauseMillis=200' },
  '/opt/app/logs':          { type:'d', children:['app.log','gc.log'] },
  '/proc':                  { type:'d', children:['cpuinfo','meminfo','version','uptime','loadavg','net','sys','1','4821','8944'] },
  '/proc/loadavg':          { type:'f', content:'0.32 0.28 0.22 1/312 4821' },
  '/proc/net':              { type:'d', children:['dev','tcp','if_inet6'] },
  '/root':                  { type:'d', children:['.bashrc','.bash_history','.ssh','scripts'] },
  '/root/.bashrc':          { type:'f', content:'# .bashrc\nexport PS1="[\\u@\\h \\W]\\$ "\nexport PATH=$PATH:/usr/local/bin\nalias ll="ls -lah"\nalias grep="grep --color=auto"' },
  '/root/.ssh':             { type:'d', children:['authorized_keys','known_hosts','id_rsa.pub'] },
  '/root/scripts':          { type:'d', children:['check-disk.sh','backup.sh'] },
  '/tmp':                   { type:'d', children:['.cache','mysql.sock','systemd-private-abc'] },
  '/tmp/.cache':            { type:'d', children:['xmrig','.lock'] },
  '/usr':                   { type:'d', children:['bin','lib','local','sbin','share'] },
  '/usr/bin':               { type:'d', children:['awk','curl','find','git','grep','htop','iostat','iotop','jmap','jstack','lsof','nc','ps','python3','sed','ss','strace','tcpdump','telnet','top','traceroute','vim','wget'] },
  '/usr/local/bin':         { type:'d', children:['backup.sh','check-disk.sh'] },
  '/var':                   { type:'d', children:['core','lib','log','run','spool','tmp','www'] },
  '/var/core':              { type:'d', children:['core.app_server.9022','core.app_server.7891','core.app_server.6134'] },
  '/var/lib':               { type:'d', children:['mysql','rpm','yum'] },
  '/var/lib/mysql':         { type:'d', children:['ibdata1','ib_logfile0','ib_logfile1','proddb','mysql','performance_schema'] },
  '/var/log':               { type:'d', children:['audit','boot.log','cron','dmesg','httpd','messages','mysql','nginx','secure','syslog','yum.log'] },
  '/var/log/messages':      { type:'f', content:'Apr 19 10:41:02 server01 systemd[1]: Started Session 42 of user root.\nApr 19 10:41:03 server01 sshd[4001]: Accepted publickey for root from 10.0.2.10\nApr 19 11:03:14 server01 snmpd[2210]: Connection from UDP: [10.0.5.1]:161' },
  '/var/log/syslog':        { type:'f', content:'Apr 19 11:03:14 server01 snmpd[2210]: Connection from UDP: [10.0.5.1]:161->[10.0.1.100]:161\nApr 19 11:03:14 server01 snmpd[2210]: Connection from UDP: [10.0.5.1]:161->[10.0.1.100]:161' },
  '/var/log/httpd':         { type:'d', children:['access_log','error_log'] },
  '/var/log/httpd/error_log': { type:'f', content:'[Mon Apr 19 11:03:14.123456 2026] [mpm_prefork:error] [pid 1234] AH00161: server reached MaxRequestWorkers setting, consider raising the MaxRequestWorkers setting\n[Mon Apr 19 11:03:14.234567 2026] [proxy:error] server01:80 (111)Connection refused' },
  '/var/log/nginx':         { type:'d', children:['access.log','error.log'] },
  '/var/log/nginx/error.log':{ type:'f', content:'2026/04/19 11:03:14 [error] 4821#4821: *1 connect() failed (111: Connection refused)\n2026/04/19 11:03:14 [crit] 4821#4821: *2 SSL_do_handshake() failed' },
  '/var/log/mysql':         { type:'d', children:['error.log','slow.log'] },
  '/var/log/secure':        { type:'f', content:'Apr 19 10:41:03 server01 sshd[4001]: Accepted publickey for root from 10.0.2.10\nApr 19 10:41:03 server01 sshd[4001]: pam_unix(sshd:session): session opened for user root' },
  '/var/www':               { type:'d', children:['html','myapp'] },
  '/var/www/html':          { type:'d', children:['index.html'] },
};

// ── Path utilities ────────────────────────────────────────────────────────────
export function resolvePath(cwd, target) {
  if (!target || target === '') return cwd;
  if (target === '-') return '/root'; // cd - simplification
  let abs = target.startsWith('/') ? target : `${cwd === '/' ? '' : cwd}/${target}`;
  // Normalise . and ..
  const parts = abs.split('/').filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return '/' + out.join('/') || '/';
}

export function promptDir(cwd) {
  if (cwd === '/root') return '~';
  if (cwd.startsWith('/root/')) return '~' + cwd.slice(5);
  return cwd;
}

// ── Format ls output ──────────────────────────────────────────────────────────
function lsLine(name, path) {
  const node = VFS[path];
  const isDir = node?.type === 'd';
  const size  = isDir ? 4096 : (node?.content?.length || 512);
  const date  = 'Apr 19 11:03';
  return `${isDir?'d':'−'}rwxr-xr-x  1 root root ${String(size).padStart(7)} ${date} ${isDir ? '\x1b[34m'+name+'\x1b[0m' : name}`;
}

// ── Pipe filter engine ────────────────────────────────────────────────────────
function applyPipeFilter(seg, inputLines) {
  const parts = seg.trim().split(/\s+/);
  const c = parts[0];

  if (c === 'grep') {
    const flags   = parts.filter(p => p.startsWith('-'));
    const terms   = parts.filter(p => !p.startsWith('-') && p !== 'grep');
    const pattern = terms.join(' ');
    if (!pattern) return inputLines;
    const ic = flags.includes('-i');
    const iv = flags.includes('-v');
    return inputLines.filter(l => {
      const t = l.text || '';
      const m = ic ? t.toLowerCase().includes(pattern.toLowerCase()) : t.includes(pattern);
      return iv ? !m : m;
    });
  }
  if (c === 'wc' && parts.includes('-l')) {
    return [{ text: String(inputLines.length), type: 'out' }];
  }
  if (c === 'head') {
    const n = parseInt(parts.find((p,i) => parts[i-1]==='-n') || parts.find(p=>/^\d+$/.test(p)) || '10');
    return inputLines.slice(0, n);
  }
  if (c === 'tail') {
    const n = parseInt(parts.find((p,i) => parts[i-1]==='-n') || parts.find(p=>/^\d+$/.test(p)) || '10');
    return inputLines.slice(-n);
  }
  if (c === 'sort') {
    const sorted = [...inputLines].sort((a,b)=>(a.text||'').localeCompare(b.text||''));
    return parts.includes('-r') ? sorted.reverse() : sorted;
  }
  if (c === 'uniq') {
    const seen = new Set();
    return inputLines.filter(l => { if (seen.has(l.text)) return false; seen.add(l.text); return true; });
  }
  if (c === 'cut') {
    const dIdx = parts.indexOf('-d');
    const fIdx = parts.indexOf('-f');
    const delim = dIdx !== -1 ? parts[dIdx+1]?.replace(/['"]/g,'') || ':' : ':';
    const field = fIdx !== -1 ? parseInt(parts[fIdx+1]) - 1 : 0;
    return inputLines.map(l => ({ ...l, text: (l.text||'').split(delim)[field] || '' })).filter(l=>l.text);
  }
  if (c === 'awk') {
    const m = seg.match(/\{[^}]*print\s+\$(\d+)[^}]*\}/);
    if (m) {
      const fi = parseInt(m[1]) - 1;
      return inputLines.map(l => ({ ...l, text: (l.text||'').split(/\s+/)[fi] || '' })).filter(l=>l.text);
    }
    return inputLines;
  }
  if (c === 'xargs') return inputLines; // passthrough
  return inputLines;
}

// ── Split on pipes (respecting quotes) ───────────────────────────────────────
function splitPipes(raw) {
  const segs = [];
  let cur = '', inQ = false, qc = '';
  for (const ch of raw) {
    if (!inQ && (ch==='"'||ch==="'")) { inQ=true; qc=ch; cur+=ch; }
    else if (inQ && ch===qc) { inQ=false; cur+=ch; }
    else if (!inQ && ch==='|') { segs.push(cur.trim()); cur=''; }
    else cur+=ch;
  }
  segs.push(cur.trim());
  return segs.filter(Boolean);
}

// ── Split on && / ; (respecting quotes) ──────────────────────────────────────
function splitChain(raw) {
  const ops  = [];
  const cmds = [];
  let cur='', inQ=false, qc='';
  let i=0;
  while (i < raw.length) {
    const ch = raw[i];
    if (!inQ && (ch==='"'||ch==="'")) { inQ=true; qc=ch; cur+=ch; }
    else if (inQ && ch===qc)          { inQ=false; cur+=ch; }
    else if (!inQ && raw[i]==='&' && raw[i+1]==='&') { cmds.push(cur.trim()); ops.push('&&'); cur=''; i++; }
    else if (!inQ && ch===';')        { cmds.push(cur.trim()); ops.push(';'); cur=''; }
    else cur+=ch;
    i++;
  }
  cmds.push(cur.trim());
  return { cmds: cmds.filter(Boolean), ops };
}

// ── Core bash-layer command handler ──────────────────────────────────────────
// Returns { handled: bool, out: LineObj[], newCwd: string }
function execSingle(raw, cwd, instanceId) {
  const parts  = raw.trim().split(/\s+/);
  const cmd    = parts[0];
  const args   = parts.slice(1);
  const lines  = arr => arr.map(t => ({ text: t, type: 'out' }));
  const err    = t   => [{ text: t, type: 'err' }];

  if (cmd === 'pwd') return { handled:true, out: lines([cwd]), newCwd: cwd };

  if (cmd === 'cd') {
    const target = args[0] || '/root';
    const next   = resolvePath(cwd, target.replace(/^~/, '/root'));
    const node   = VFS[next];
    if (!node)              return { handled:true, out: err(`-bash: cd: ${target}: No such file or directory`), newCwd: cwd };
    if (node.type !== 'd')  return { handled:true, out: err(`-bash: cd: ${target}: Not a directory`), newCwd: cwd };
    return { handled:true, out: [], newCwd: next };
  }

  if (cmd === 'ls') {
    const flags   = args.filter(a => a.startsWith('-'));
    const pathArg = args.find(a => !a.startsWith('-'));
    const target  = pathArg ? resolvePath(cwd, pathArg.replace(/^~/, '/root')) : cwd;
    const node    = VFS[target];
    if (!node) return { handled:true, out: err(`ls: cannot access '${pathArg||cwd}': No such file or directory`), newCwd: cwd };
    if (node.type === 'f') return { handled:true, out: lines([target.split('/').pop()]), newCwd: cwd };
    const children = node.children || [];
    const long = flags.some(f => f.includes('l'));
    const all  = flags.some(f => f.includes('a'));
    const shown = all ? ['.','..', ...children] : children;
    if (long) {
      const header = `total ${children.length * 8}`;
      const rows = shown.map(name => {
        if (name==='.' || name==='..') return `drwxr-xr-x  2 root root    4096 Apr 19 11:03 ${name}`;
        const childPath = target==='/' ? '/'+name : target+'/'+name;
        return lsLine(name, childPath);
      });
      return { handled:true, out: lines([header, ...rows]), newCwd: cwd };
    }
    // Short form — columnize
    return { handled:true, out: lines([shown.join('  ')]), newCwd: cwd };
  }

  if (cmd === 'cat') {
    if (!args.length) return { handled:true, out: err('cat: missing operand'), newCwd: cwd };
    const target = resolvePath(cwd, args[0].replace(/^~/, '/root'));
    // /proc special files handled by caller — check VFS first
    const node = VFS[target];
    if (node?.type === 'f') return { handled:true, out: lines(node.content.split('\n')), newCwd: cwd };
    if (node?.type === 'd') return { handled:true, out: err(`cat: ${args[0]}: Is a directory`), newCwd: cwd };
    // Not in VFS — let caller handle (scenario-specific files like /etc/my.cnf override)
    return { handled: false, out: [], newCwd: cwd };
  }

  if (cmd === 'date') {
    const now  = new Date();
    const opts = { weekday:'short', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false, timeZoneName:'short' };
    return { handled:true, out: lines([now.toLocaleString('en-US', opts).replace(',','')]), newCwd: cwd };
  }

  if (cmd === 'echo') {
    const msg = args.join(' ')
      .replace(/\$HOSTNAME/g, `${instanceId}`)
      .replace(/\$USER/g, 'root')
      .replace(/\$HOME/g, '/root')
      .replace(/\$PWD/g, cwd)
      .replace(/\$SHELL/g, '/bin/bash')
      .replace(/\$\?/g, '0');
    return { handled:true, out: lines([msg.replace(/^['"]|['"]$/g,'')]), newCwd: cwd };
  }

  if (cmd === 'which' || cmd === 'type') {
    const known = ['ls','cd','pwd','cat','grep','awk','sed','top','ps','df','du','free','kill','chmod','chown','mkdir','rm','cp','mv','touch','find','curl','wget','ssh','scp','tar','gzip','vim','nano','systemctl','journalctl','dmesg','ifconfig','ip','ss','netstat','ping','traceroute','dig','nslookup','nmap','tcpdump','strace','lsof','iostat','iotop','vmstat','mpstat','sar','uptime','uname','hostname','who','w','id','env','echo','date','history','man'];
    const t = args[0];
    if (known.includes(t)) return { handled:true, out: lines([`${t} is /usr/bin/${t}`]), newCwd: cwd };
    return { handled:true, out: err(`${cmd}: ${t}: not found`), newCwd: cwd };
  }

  if (cmd === 'env' || cmd === 'printenv') {
    return { handled:true, out: lines([
      `USER=root`, `HOME=/root`, `SHELL=/bin/bash`, `PWD=${cwd}`,
      `HOSTNAME=${instanceId}`, `TERM=xterm-256color`,
      `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
      `LANG=en_US.UTF-8`, `EDITOR=vim`,
    ]), newCwd: cwd };
  }

  if (cmd === 'id') {
    return { handled:true, out: lines(['uid=0(root) gid=0(root) groups=0(root) context=system_u:system_r:unconfined_t:s0']), newCwd: cwd };
  }

  if (cmd === 'w' || cmd === 'who') {
    return { handled:true, out: lines([
      ` ${new Date().toLocaleTimeString('en-US',{hour12:false})} up 1:42,  1 user,  load average: 0.32, 0.28, 0.22`,
      'USER     TTY      FROM             LOGIN@   IDLE JCPU   PCPU WHAT',
      `root     pts/0    10.0.2.10        10:41    0.00s  0.02s  0.00s -bash`,
    ]), newCwd: cwd };
  }

  if (cmd === 'last') {
    return { handled:true, out: lines([
      `root     pts/0        10.0.2.10        Sun Apr 19 10:41   still logged in`,
      `root     pts/0        10.0.2.10        Sat Apr 18 22:15 - 23:42  (01:26)`,
      `reboot   system boot  5.15.0-206       Sat Mar  4 08:00 - 10:41 (47+02:41)`,
      `wtmp begins Sat Mar  4 08:00:01 2026`,
    ]), newCwd: cwd };
  }

  if (cmd === 'man') {
    if (!args[0]) return { handled:true, out: err('What manual page do you want?'), newCwd: cwd };
    return { handled:true, out: lines([
      `MAN(1) — ${args[0].toUpperCase()} manual page`,
      `Use \`${args[0]} --help\` for quick usage or search docs online.`,
      `(Full man pages not rendered in this environment)`,
    ]), newCwd: cwd };
  }

  if (cmd === 'touch') {
    return { handled:true, out: [], newCwd: cwd }; // silent success
  }

  if (cmd === 'mkdir') {
    return { handled:true, out: [], newCwd: cwd }; // silent success
  }

  if (cmd === 'file') {
    const target = resolvePath(cwd, (args[0]||'').replace(/^~/, '/root'));
    const node   = VFS[target];
    if (!node) return { handled:true, out: err(`file: ${args[0]}: No such file or directory`), newCwd: cwd };
    const desc   = node.type==='d' ? 'directory' : 'ASCII text';
    return { handled:true, out: lines([`${args[0]}: ${desc}`]), newCwd: cwd };
  }

  if (cmd === 'find') {
    const pathArg = args.find(a => !a.startsWith('-')) || cwd;
    const nameArg = args.find((a,i) => args[i-1] === '-name');
    const base    = resolvePath(cwd, pathArg.replace(/^~/, '/root'));
    const results = Object.keys(VFS).filter(p => {
      if (!p.startsWith(base)) return false;
      if (nameArg) return p.split('/').pop().includes(nameArg.replace(/\*/g,''));
      return true;
    }).slice(0, 20);
    return { handled:true, out: lines(results.length ? results : [`find: '${pathArg}': No such file or directory`]), newCwd: cwd };
  }

  if (cmd === 'grep') {
    // Standalone grep on a file
    const pattern = args.find(a => !a.startsWith('-'));
    const fileArg = args[args.length - 1];
    if (!pattern) return { handled:true, out: err('Usage: grep [OPTIONS] PATTERN [FILE]'), newCwd: cwd };
    const target  = resolvePath(cwd, fileArg?.replace(/^~/, '/root') || '');
    const node    = VFS[target];
    if (node?.type === 'f') {
      const ic = args.includes('-i');
      const matches = node.content.split('\n').filter(l =>
        ic ? l.toLowerCase().includes(pattern.toLowerCase()) : l.includes(pattern)
      );
      return { handled:true, out: matches.length ? lines(matches) : [{ text:`(no match for '${pattern}')`, type:'dim' }], newCwd: cwd };
    }
    return { handled: false, out: [], newCwd: cwd };
  }

  return { handled: false, out: [], newCwd: cwd };
}

// ── Public API: run a full command (with pipes + chains) ─────────────────────
export function runBashLayer(raw, cwd, instanceId, runScenarioCmd) {
  const { cmds, ops } = splitChain(raw);

  let currentCwd = cwd;
  let allOut     = [];
  let lastOk     = true;

  for (let ci = 0; ci < cmds.length; ci++) {
    const op = ops[ci - 1];
    if (op === '&&' && !lastOk) break;

    const segments = splitPipes(cmds[ci]);
    let linesBuf   = [];
    let handled    = false;

    // First segment
    const first = execSingle(segments[0], currentCwd, instanceId);
    if (first.handled) {
      linesBuf   = first.out;
      currentCwd = first.newCwd;
      handled    = true;
    } else {
      // Fall through to scenario engine
      linesBuf = runScenarioCmd(segments[0], currentCwd);
      handled  = true;
    }

    // Remaining pipe segments (filters)
    for (let pi = 1; pi < segments.length; pi++) {
      linesBuf = applyPipeFilter(segments[pi], linesBuf);
    }

    lastOk  = !linesBuf.some(l => l.type === 'err');
    allOut  = [...allOut, ...linesBuf];
  }

  return { out: allOut, newCwd: currentCwd };
}
