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
  if (c === 'wc') {
    if (parts.includes('-l')) return [{ text: String(inputLines.length), type: 'out' }];
    if (parts.includes('-w')) return [{ text: String(inputLines.reduce((n,l)=>n+(l.text||'').trim().split(/\s+/).filter(Boolean).length,0)), type: 'out' }];
    if (parts.includes('-c')) return [{ text: String(inputLines.reduce((n,l)=>n+(l.text||'').length+1,0)), type: 'out' }];
    const l = inputLines.length;
    const w = inputLines.reduce((n,ln)=>n+(ln.text||'').trim().split(/\s+/).filter(Boolean).length,0);
    const c2 = inputLines.reduce((n,ln)=>n+(ln.text||'').length+1,0);
    return [{ text: `${String(l).padStart(7)} ${String(w).padStart(7)} ${String(c2).padStart(7)}`, type: 'out' }];
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
  if (c === 'xargs') return inputLines;

  if (c === 'tee') return inputLines; // passthrough — redirect handled elsewhere

  if (c === 'sed') {
    const expr = parts.slice(1).join(' ').replace(/^['"]|['"]$/g, '');
    const m = expr.match(/^s([/|,])(.+?)\1(.*?)\1([gi]*)$/);
    if (m) {
      const flags = m[4].includes('i') ? 'gi' : m[4].includes('g') ? 'g' : '';
      try {
        const re = new RegExp(m[2], flags || undefined);
        return inputLines.map(l => ({ ...l, text: (l.text||'').replace(re, m[3]) }));
      } catch { return inputLines; }
    }
    return inputLines;
  }

  if (c === 'tr') {
    const from = (parts[1]||'').replace(/^['"]|['"]$/g,'');
    const to   = (parts[2]||'').replace(/^['"]|['"]$/g,'');
    if (parts.includes('-d')) {
      const del = from;
      return inputLines.map(l => ({ ...l, text: (l.text||'').split('').filter(ch=>!del.includes(ch)).join('') }));
    }
    return inputLines.map(l => ({
      ...l, text: (l.text||'').split('').map(ch => { const i=from.indexOf(ch); return i>=0&&to[i]?to[i]:ch; }).join(''),
    }));
  }

  if (c === 'column') return inputLines;

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

// ── Split on && / || / ; (respecting quotes) ─────────────────────────────────
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
    else if (!inQ && raw[i]==='|' && raw[i+1]==='|') { cmds.push(cur.trim()); ops.push('||'); cur=''; i++; }
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

  // ── Interactive / streaming commands — return signals ────────────────────
  if (cmd === 'top' || cmd === 'htop') {
    return { handled:true, out:[], newCwd:cwd, topOpen: true };
  }
  if (cmd === 'tail' && args.includes('-f')) {
    const filePath = args.find(a => !a.startsWith('-'));
    const path = filePath ? resolvePath(cwd, filePath.replace(/^~/, '/root')) : '/var/log/messages';
    return { handled:true, out:[], newCwd:cwd, tailOpen: { path } };
  }
  if (cmd === 'watch') {
    const watchCmd = args.join(' ');
    return { handled:true, out:[], newCwd:cwd, watchOpen: { cmd: watchCmd } };
  }

  // ── Bare-metal hardware commands ──────────────────────────────────────────
  if (cmd === 'lscpu') return { handled:true, newCwd:cwd, out: lines([
    'Architecture:            x86_64',
    'CPU op-mode(s):          32-bit, 64-bit',
    'Address sizes:           46 bits physical, 48 bits virtual',
    'Byte Order:              Little Endian',
    'CPU(s):                  8',
    'On-line CPU(s) list:     0-7',
    'Vendor ID:               GenuineIntel',
    'Model name:              Intel(R) Xeon(R) Gold 6148 CPU @ 2.40GHz',
    'CPU family:              6',
    'Model:                   85',
    'Stepping:                4',
    'CPU MHz:                 2399.926',
    'CPU max MHz:             3700.0000',
    'CPU min MHz:             1000.0000',
    'BogoMIPS:                4799.85',
    'Virtualization:          VT-x',
    'L1d cache:               32K',
    'L1i cache:               32K',
    'L2 cache:                1024K',
    'L3 cache:                28160K',
    'NUMA node(s):            2',
    'NUMA node0 CPU(s):       0-3',
    'NUMA node1 CPU(s):       4-7',
    'Flags:                   fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush dts acpi mmx fxsr sse sse2 ss ht tm pbe syscall nx pdpe1gb rdtscp lm constant_tsc',
  ])};

  if (cmd === 'lsblk') return { handled:true, newCwd:cwd, out: lines([
    'NAME        MAJ:MIN RM   SIZE RO TYPE MOUNTPOINT',
    'sda           8:0    0   500G  0 disk',
    '├─sda1        8:1    0   500M  0 part /boot',
    '├─sda2        8:2    0     1G  0 part [SWAP]',
    '└─sda3        8:3    0 498.5G  0 part',
    '  ├─ol-root 253:0    0    50G  0 lvm  /',
    '  ├─ol-home 253:1    0   100G  0 lvm  /home',
    '  └─ol-data 253:2    0 348.5G  0 lvm  /data',
    'sdb           8:16   0   500G  0 disk',
    '└─sdb1        8:17   0   500G  0 part',
    '  └─ol-data 253:2    0 348.5G  0 lvm  /data',
  ])};

  if (cmd === 'lspci') return { handled:true, newCwd:cwd, out: lines([
    '00:00.0 Host bridge: Intel Corporation 440FX - 82441FX PMC [Natoma] (rev 02)',
    '00:01.0 ISA bridge: Intel Corporation 82371SB PIIX3 ISA [Natoma/Triton II]',
    '00:01.1 IDE interface: Intel Corporation 82371SB PIIX3 IDE [Natoma/Triton II]',
    '00:02.0 VGA compatible controller: Cirrus Logic GD 5446',
    '00:03.0 Ethernet controller: Intel Corporation 82574L Gigabit Network Connection',
    '00:04.0 Ethernet controller: Intel Corporation 82574L Gigabit Network Connection',
    '00:05.0 SCSI storage controller: LSI Logic / Symbios Logic MegaRAID SAS-3 3108 [Invader]',
    '00:06.0 RAM memory: Red Hat, Inc. Virtio memory balloon',
    '00:07.0 SCSI storage controller: LSI Logic / Symbios Logic SAS3008 PCI-Express Fusion-MPT SAS-3',
  ])};

  if (cmd === 'dmidecode') {
    const sub = args.find((a,i) => args[i-1] === '-t' || args[i-1] === '--type');
    if (sub === 'processor' || sub === '4') return { handled:true, newCwd:cwd, out: lines([
      'Handle 0x0400, DMI type 4, 48 bytes',
      'Processor Information',
      '  Socket Designation: CPU0',
      '  Type: Central Processor',
      '  Family: Xeon',
      '  Manufacturer: Intel(R) Corporation',
      '  Version: Intel(R) Xeon(R) Gold 6148 CPU @ 2.40GHz',
      '  Voltage: 1.6 V',
      '  External Clock: 100 MHz',
      '  Max Speed: 4000 MHz',
      '  Current Speed: 2400 MHz',
      '  Status: Populated, Enabled',
      '  Core Count: 20',
      '  Core Enabled: 20',
      '  Thread Count: 40',
    ])};
    if (sub === 'memory' || sub === '17') return { handled:true, newCwd:cwd, out: lines([
      'Handle 0x1100, DMI type 17, 84 bytes',
      'Memory Device',
      '  Array Handle: 0x1000',
      '  Form Factor: DIMM',
      '  Locator: DIMM_A1',
      '  Bank Locator: NODE 0',
      '  Type: DDR4',
      '  Speed: 2933 MT/s',
      '  Manufacturer: Samsung',
      '  Part Number: M393A4K40CB2-CVF',
      '  Size: 32 GB',
      '  Data Width: 64 bits',
      '  Configured Memory Speed: 2933 MT/s',
    ])};
    if (sub === 'bios' || sub === '0') return { handled:true, newCwd:cwd, out: lines([
      'Handle 0x0000, DMI type 0, 26 bytes',
      'BIOS Information',
      '  Vendor: Dell Inc.',
      '  Version: 2.18.1',
      '  Release Date: 03/10/2024',
      '  BIOS Revision: 2.18',
      '  Firmware Revision: 0.16',
      '  ROM Size: 64 MB',
      '  Characteristics: PCI, PNP, ACPI, USB, UEFI',
    ])};
    return { handled:true, newCwd:cwd, out: lines([
      '# dmidecode 3.3',
      'Getting SMBIOS data from sysfs.',
      'SMBIOS 3.1.1 present.',
      '  Vendor: Dell Inc.',
      '  Product: PowerEdge R740',
      '  Serial Number: 8XYZQ23',
      '  UUID: 4c4c4544-0048-5810-8059-b8c04f585a33',
      '  Wake-up Type: Power Switch',
      '  SKU Number: SKU=0A94;ModelName=PowerEdge R740',
      'Run dmidecode -t <type> for details (0=bios, 4=cpu, 17=memory)',
    ])};
  }

  if (cmd === 'ethtool') {
    const iface = args[0] || 'eth0';
    return { handled:true, newCwd:cwd, out: lines([
      `Settings for ${iface}:`,
      '  Supported ports: [ TP ]',
      '  Supported link modes:   10baseT/Half 10baseT/Full',
      '                          100baseT/Half 100baseT/Full',
      '                          1000baseT/Full',
      '                          10000baseT/Full',
      '  Speed: 10000Mb/s',
      '  Duplex: Full',
      '  Auto-negotiation: on',
      '  Port: Twisted Pair',
      '  PHYAD: 0',
      '  Transceiver: external',
      '  MDI-X: on (auto)',
      '  Link detected: yes',
    ])};
  }

  if (cmd === 'hdparm') {
    const dev = args[args.length-1] || '/dev/sda';
    if (args.includes('-I')) return { handled:true, newCwd:cwd, out: lines([
      `${dev}:`,
      '',
      'ATA device, with non-removable media',
      '  Model Number:       SAMSUNG MZ7LH960HAJR-00005',
      '  Serial Number:      S45PNA0M812345',
      '  Firmware Revision:  HXT7904Q',
      '  Transport:          Serial, ATA8-AST, SATA 1.0a, SATA II Extensions, SATA Rev 2.5, SATA Rev 2.6, SATA Rev 3.0',
      'Standards:',
      '  Likely used: 16',
      'Configuration:',
      '  Logical  max current',
      '  cylinders  16383  16383',
      '  heads   16  16',
      '  sectors/track  63  63',
      '  Nominal Media Rotation Rate: Solid State Device',
      'Capabilities:',
      '  LBA, IORDY (can be disabled)',
      '  Queue depth: 32',
      '  DMA: mdma0 mdma1 mdma2 udma0 udma1 udma2 udma3 udma4 udma5 *udma6',
    ])};
    return { handled:true, newCwd:cwd, out: lines([`${dev}:`, ' HDIO_GET_IDENTITY failed: Invalid argument'])};
  }

  if (cmd === 'smartctl') {
    const dev = args[args.length-1] || '/dev/sda';
    return { handled:true, newCwd:cwd, out: lines([
      `smartctl 7.3 2022-02-28 r5338 [x86_64-linux-5.15.0-206] (local build)`,
      'Copyright (C) 2002-22, Bruce Allen, Christian Franke, www.smartmontools.org',
      '',
      `=== START OF INFORMATION SECTION ===`,
      'Device Model:     SAMSUNG MZ7LH960HAJR-00005',
      'Serial Number:    S45PNA0M812345',
      'Firmware Version: HXT7904Q',
      'User Capacity:    960,197,124,096 bytes [960 GB]',
      'Sector Size:      512 bytes logical/physical',
      'Rotation Rate:    Solid State Device',
      'Device is:        Not in smartctl database',
      `SMART support is: Available - device has SMART capability.`,
      `SMART support is: Enabled`,
      '',
      `=== START OF READ SMART DATA SECTION ===`,
      'SMART overall-health self-assessment test result: PASSED',
      '',
      'SMART Attributes Data Structure revision number: 1',
      'ID# ATTRIBUTE_NAME          FLAG  VALUE WORST THRESH TYPE      UPDATED  WHEN_FAILED RAW_VALUE',
      '  5 Reallocated_Sector_Ct   0x0032   100   100   010 Old_age   Always       -       0',
      '  9 Power_On_Hours          0x0032    98    98   000 Old_age   Always       -       14823',
      '177 Wear_Leveling_Count     0x0013    98    98   000 Pre-fail  Always       -       55',
      '179 Used_Rsvd_Blk_Cnt_Tot   0x0013   100   100   010 Pre-fail  Always       -       0',
      '181 Program_Fail_Cnt_Total  0x0032   100   100   010 Old_age   Always       -       0',
      '190 Airflow_Temperature_Cel 0x0032    73    57    000 Old_age   Always       -       27',
    ])};
  }

  if (cmd === 'sensors') return { handled:true, newCwd:cwd, out: lines([
    'coretemp-isa-0000',
    'Adapter: ISA adapter',
    'Package id 0:  +42.0°C  (high = +86.0°C, crit = +100.0°C)',
    'Core 0:        +38.0°C  (high = +86.0°C, crit = +100.0°C)',
    'Core 1:        +40.0°C  (high = +86.0°C, crit = +100.0°C)',
    'Core 2:        +39.0°C  (high = +86.0°C, crit = +100.0°C)',
    'Core 3:        +41.0°C  (high = +86.0°C, crit = +100.0°C)',
    '',
    'nct6779-isa-0290',
    'Adapter: ISA adapter',
    'fan1:        1008 RPM',
    'fan2:         812 RPM',
    'fan3:           0 RPM',
    'SYSTIN:       +34.0°C',
    'CPUTIN:       +42.0°C',
    'in0:           0.83 V',
    'in1:           1.84 V  (min =  +0.00 V, max =  +1.74 V)  ALARM',
  ])};

  if (cmd === 'ipmitool') {
    if (args[0] === 'sdr') return { handled:true, newCwd:cwd, out: lines([
      'Inlet Temp       | 22 degrees C      | ok',
      'Exhaust Temp     | 38 degrees C      | ok',
      'Temp             | 42 degrees C      | ok',
      'CPU Usage        | 12 percent        | ok',
      'IO Usage         | 3 percent         | ok',
      'MEM Usage        | 61 percent        | ok',
      'Fan1             | 3120 RPM          | ok',
      'Fan2             | 2880 RPM          | ok',
      'Fan3             | 3000 RPM          | ok',
      'Voltage 1        | 1.82 Volts        | ok',
      'Voltage 2        | 1.05 Volts        | ok',
      'PS1 Status       | Presence Detected | ok',
      'PS2 Status       | Presence Detected | ok',
    ])};
    if (args[0] === 'chassis' && args[1] === 'status') return { handled:true, newCwd:cwd, out: lines([
      'System Power         : on',
      'Power Overload       : false',
      'Main Power Fault     : false',
      'Power Control Fault  : false',
      'Power Restore Policy : previous',
      'Last Power Event     : command',
      'Chassis Intrusion    : inactive',
      'Front-Panel Lockout  : inactive',
      'Drive Fault          : false',
      'Cooling/Fan Fault    : false',
    ])};
    return { handled:true, newCwd:cwd, out: err('ipmitool: command not found or insufficient privileges') };
  }

  if (cmd === 'lshw') return { handled:true, newCwd:cwd, out: lines([
    `${instanceId}`,
    '    description: Server',
    '    product: PowerEdge R740 (SKU=0A94)',
    '    vendor: Dell Inc.',
    '    serial: 8XYZQ23',
    '    width: 64 bits',
    '  *-core',
    '     *-cpu:0',
    '          product: Intel(R) Xeon(R) Gold 6148 CPU @ 2.40GHz',
    '          vendor: Intel Corp.',
    '          width: 64 bits',
    '          capacity: 4GHz',
    '     *-memory',
    '          description: System Memory',
    '          size: 128GiB',
    '     *-network:0',
    '          description: Ethernet interface',
    '          product: 82574L Gigabit Network Connection',
    '          logical name: eth0',
    '          capacity: 10Gbit/s',
    '          link: yes',
  ])};

  if (cmd === 'numactl' && args.includes('--hardware')) return { handled:true, newCwd:cwd, out: lines([
    'available: 2 nodes (0-1)',
    'node 0 cpus: 0 1 2 3',
    'node 0 size: 64368 MB',
    'node 0 free: 14821 MB',
    'node 1 cpus: 4 5 6 7',
    'node 1 size: 64432 MB',
    'node 1 free: 15240 MB',
    'node distances:',
    'node   0   1',
    '  0:  10  21',
    '  1:  21  10',
  ])};

  if (cmd === 'tuned-adm') return { handled:true, newCwd:cwd, out: lines([
    args[0] === 'active' ? 'Current active profile: throughput-performance' : 'Available profiles: throughput-performance latency-performance balanced'
  ])};

  if (cmd === 'vim' || cmd === 'vi' || cmd === 'nano' || cmd === 'pico') {
    const filePath = args[0] ? resolvePath(cwd, args[0].replace(/^~/, '/root')) : null;
    if (!filePath) return { handled:true, out: err(`${cmd}: missing filename`), newCwd: cwd };
    const node    = VFS[filePath];
    if (node?.type === 'd') return { handled:true, out: err(`${cmd}: ${args[0]}: is a directory`), newCwd: cwd };
    const content = node?.type === 'f' ? node.content : '';
    const mode    = (cmd === 'nano' || cmd === 'pico') ? 'nano' : 'vim';
    return { handled:true, out: [], newCwd: cwd, editorOpen: { path: filePath, content, mode } };
  }

  if (cmd === 'less' || cmd === 'more' || cmd === 'view') {
    const filePath = args[0] ? resolvePath(cwd, args[0].replace(/^~/, '/root')) : null;
    if (!filePath) return { handled:true, out: err(`${cmd}: missing filename`), newCwd: cwd };
    const node = VFS[filePath];
    if (!node || node.type === 'd') return { handled:true, out: err(`${cmd}: ${args[0]}: No such file or directory`), newCwd: cwd };
    return { handled:true, out: node.content.split('\n').map(t=>({text:t,type:'out'})), newCwd: cwd };
  }

  if (cmd === 'uname') {
    if (args.includes('-r')) return { handled:true, out: lines(['5.15.0-206.153.7.el8uek.x86_64']), newCwd: cwd };
    if (args.includes('-m')) return { handled:true, out: lines(['x86_64']), newCwd: cwd };
    if (args.includes('-a') || args.includes('--all')) {
      return { handled:true, out: lines([`Linux ${instanceId} 5.15.0-206.153.7.el8uek.x86_64 #2 SMP Wed Apr  2 08:00:00 UTC 2025 x86_64 x86_64 x86_64 GNU/Linux`]), newCwd: cwd };
    }
    return { handled:true, out: lines(['Linux']), newCwd: cwd };
  }

  if (cmd === 'hostname') {
    if (args.includes('-f') || args.includes('--fqdn')) return { handled:true, out: lines([`${instanceId}.prod.lab.local`]), newCwd: cwd };
    return { handled:true, out: lines([instanceId]), newCwd: cwd };
  }

  if (cmd === 'clear') {
    return { handled:true, out: [], newCwd: cwd, clear: true };
  }

  if (cmd === 'exit' || cmd === 'logout') {
    return { handled:true, out: [{ text: 'logout', type: 'out' }], newCwd: cwd, exit: true };
  }

  if (cmd === 'rm') {
    if (!args.length) return { handled:true, out: err('rm: missing operand'), newCwd: cwd };
    const target = resolvePath(cwd, args[args.length-1].replace(/^~/, '/root'));
    if (!VFS[target] && !args.includes('-f') && !args.includes('-rf') && !args.includes('-r')) {
      return { handled:true, out: err(`rm: cannot remove '${args[args.length-1]}': No such file or directory`), newCwd: cwd };
    }
    return { handled:true, out: [], newCwd: cwd };
  }

  if (cmd === 'cp') {
    if (args.length < 2) return { handled:true, out: err('cp: missing destination'), newCwd: cwd };
    return { handled:true, out: [], newCwd: cwd };
  }

  if (cmd === 'mv') {
    if (args.length < 2) return { handled:true, out: err('mv: missing destination'), newCwd: cwd };
    return { handled:true, out: [], newCwd: cwd };
  }

  if (cmd === 'chmod' || cmd === 'chown') {
    return { handled:true, out: [], newCwd: cwd };
  }

  if (cmd === 'ln') {
    return { handled:true, out: [], newCwd: cwd };
  }

  if (cmd === 'alias') {
    if (!args.length) return { handled:true, out: lines(["alias ll='ls -lah'", "alias grep='grep --color=auto'"]), newCwd: cwd };
    return { handled:true, out: [], newCwd: cwd };
  }

  if (cmd === 'export') {
    return { handled:true, out: [], newCwd: cwd };
  }

  if (cmd === 'source' || cmd === '.') {
    return { handled:true, out: [], newCwd: cwd };
  }

  return { handled: false, out: [], newCwd: cwd };
}

// ── Shell variable expansion ──────────────────────────────────────────────────
export function expandVars(cmd, vars = {}) {
  // $VAR and ${VAR} expansion
  return cmd
    .replace(/\$\{([A-Z_][A-Z_0-9]*)\}/gi, (_, n) => vars[n] ?? '')
    .replace(/\$([A-Z_][A-Z_0-9]*)/gi,     (_, n) => vars[n] ?? '')
    .replace(/\$\?/g, '0');
}

// ── Output redirect parser (>, >>) ───────────────────────────────────────────
// Returns { cmd: string without redirect, file: string|null, append: bool }
function parseRedirect(raw) {
  const m = raw.match(/^([\s\S]+?)\s*(>>|>)\s*(\S+)\s*$/);
  if (!m) return { cmd: raw, file: null, append: false };
  return { cmd: m[1].trim(), file: m[3], append: m[2] === '>>' };
}

// ── Public API: run a full command (with pipes + chains) ─────────────────────
export function runBashLayer(raw, cwd, instanceId, runScenarioCmd) {
  const { cmds, ops } = splitChain(raw);

  let currentCwd = cwd;
  let allOut     = [];
  let lastOk     = true;
  let doClear    = false;
  let doExit     = false;
  let editorOpen = null;

  for (let ci = 0; ci < cmds.length; ci++) {
    const op = ops[ci - 1];
    if (op === '&&' && !lastOk) break;
    if (op === '||' && lastOk)  break;

    // Strip sudo prefix transparently
    let cmdRaw = cmds[ci].replace(/^sudo\s+/, '');

    // Parse output redirect (>, >>)
    const { cmd: cmdNoRedir, file: redirFile } = parseRedirect(cmdRaw);
    if (redirFile) cmdRaw = cmdNoRedir;

    const segments = splitPipes(cmdRaw);
    let linesBuf   = [];

    // First segment
    const first = execSingle(segments[0], currentCwd, instanceId);
    if (first.handled) {
      linesBuf   = first.out;
      currentCwd = first.newCwd;
      if (first.clear)      doClear    = true;
      if (first.exit)       doExit     = true;
      if (first.editorOpen) editorOpen = first.editorOpen;
    } else {
      linesBuf = runScenarioCmd(segments[0], currentCwd);
    }

    // If editor should open, stop chain processing
    if (editorOpen) break;

    // Remaining pipe segments (filters)
    for (let pi = 1; pi < segments.length; pi++) {
      linesBuf = applyPipeFilter(segments[pi], linesBuf);
    }

    // Redirect: suppress output (silent write)
    if (redirFile) {
      linesBuf = [];
    }

    lastOk = !linesBuf.some(l => l.type === 'err');
    allOut = [...allOut, ...linesBuf];
  }

  return { out: allOut, newCwd: currentCwd, clear: doClear, exit: doExit, editorOpen };
}

// ── Tab completion ────────────────────────────────────────────────────────────
const KNOWN_CMDS = ['ls','cd','pwd','cat','grep','awk','sed','top','ps','df','du','free','kill',
  'chmod','chown','mkdir','rm','cp','mv','touch','find','curl','wget','ssh','scp','tar','gzip',
  'vim','nano','systemctl','journalctl','dmesg','ifconfig','ip','ss','netstat','ping','traceroute',
  'dig','nslookup','nmap','tcpdump','strace','lsof','iostat','iotop','vmstat','mpstat','sar',
  'uptime','uname','hostname','who','w','id','env','echo','date','history','man','sudo',
  'apt','yum','dnf','rpm','service','chkconfig','firewall-cmd','semanage','restorecon',
  'pm2','nginx','node','npm','git','docker','kubectl','helm','terraform'];

export function tabComplete(input, cwd) {
  const trimmed = input.trimStart();

  // Split into tokens — complete the last token
  const tokens = trimmed.split(/\s+/);
  const last   = tokens[tokens.length - 1];
  const prefix = tokens.length === 1 ? '' : tokens.slice(0, -1).join(' ') + ' ';

  // If first token (command completion)
  if (tokens.length === 1) {
    const matches = KNOWN_CMDS.filter(c => c.startsWith(last));
    if (matches.length === 1) return { completed: matches[0] + ' ', suggestions: [] };
    if (matches.length > 1)   return { completed: input, suggestions: matches };
    return { completed: input, suggestions: [] };
  }

  // Path completion
  const pathTokenRaw = last.replace(/^~/, '/root');
  const isAbs = pathTokenRaw.startsWith('/');
  const base  = isAbs ? pathTokenRaw : resolvePath(cwd, pathTokenRaw);

  // Try exact match first (last char is /)
  if (base.endsWith('/') || VFS[base]?.type === 'd') {
    const node = VFS[base] || VFS[base.replace(/\/$/, '')];
    if (node?.children) {
      const children = node.children;
      if (children.length === 1) {
        const full = (base.replace(/\/$/, '')) + '/' + children[0];
        return { completed: prefix + full, suggestions: [] };
      }
      return { completed: input, suggestions: children };
    }
  }

  // Prefix match on parent dir
  const lastSlash = base.lastIndexOf('/');
  const parentDir = lastSlash >= 0 ? base.slice(0, lastSlash) || '/' : cwd;
  const partial   = lastSlash >= 0 ? base.slice(lastSlash + 1) : base;
  const parentNode = VFS[parentDir];
  if (parentNode?.children) {
    const matches = parentNode.children.filter(c => c.startsWith(partial));
    if (matches.length === 1) {
      const fullPath = (parentDir === '/' ? '' : parentDir) + '/' + matches[0];
      const isDir = VFS[fullPath]?.type === 'd';
      return { completed: prefix + fullPath + (isDir ? '/' : ''), suggestions: [] };
    }
    if (matches.length > 1) return { completed: input, suggestions: matches };
  }

  return { completed: input, suggestions: [] };
}
