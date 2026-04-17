// realism/log-corpus.ts — Realistic log templates for various services

export interface LogTemplate {
  source: string;
  patterns: string[];
}

export const corpus: LogTemplate[] = [
  {
    source: "systemd",
    patterns: [
      "Starting {svc}.service...",
      "Started {svc}.service.",
      "Stopping {svc}.service...",
      "Stopped {svc}.service.",
      "Unit {svc}.service entered failed state.",
      "Failed to start {svc}.service.",
      "{svc}.service: Main process exited, code=exited, status=1/FAILURE",
      "{svc}.service: Failed with result 'exit-code'.",
      "{svc}.service: Scheduled restart job, restart counter is at {count}.",
    ],
  },
  {
    source: "kernel",
    patterns: [
      "Out of memory: Killed process {pid} ({proc}) total-vm:{vm}kB, anon-rss:{rss}kB",
      "EXT4-fs error (device {dev}): ext4_find_entry: inode #{inode}: comm {proc}: reading directory lblock 0",
      "EXT4-fs warning: mounting unchecked fs, running e2fsck is recommended",
      "md/raid1:md0: Disk failure on {dev}, disabling device.",
      "md/raid1:md0: Rebuild started ({pct}%)",
      "TCP: request_sock_TCP: Possible SYN flooding on port {port}. Sending cookies.",
      "nf_conntrack: table full, dropping packet",
      "device {iface} entered promiscuous mode",
      "CPU: {pct}% user space used, throttling processes",
      "scsi {id}: rejecting I/O to offline device",
    ],
  },
  {
    source: "nginx",
    patterns: [
      "connect() failed (111: Connection refused) while connecting to upstream, client: {client}, server: localhost",
      "upstream timed out (110: Connection timed out) while reading response header from upstream",
      "{pct}#{pid}: *{req} open() \"{path}\" failed (2: No such file or directory)",
      "SSL_do_handshake() failed (SSL: error:14094410:SSL routines:ssl3_read_bytes:sslv3 alert handshake failure)",
      "worker process {pid} exited with code {code}",
      "worker process {pid} was killed by signal {sig}",
      "no live upstreams while connecting to upstream",
    ],
  },
  {
    source: "httpd",
    patterns: [
      "AH00094: Command line: '/usr/sbin/httpd -D FOREGROUND'",
      "AH00163: Apache/2.4.57 (Oracle Linux) OpenSSL/3.0.7 configured -- resuming normal operations",
      "AH00052: child pid {pid} exit signal Segmentation fault (11)",
      "server reached MaxRequestWorkers setting, consider raising the MaxRequestWorkers setting",
      "SSL Library Error: error:14094415:SSL routines:ssl3_read_bytes:sslv3 alert certificate expired",
      "(98)Address already in use: AH00072: make_sock: could not bind to address 0.0.0.0:{port}",
      "client denied by server configuration: {path}",
    ],
  },
  {
    source: "mysql",
    patterns: [
      "InnoDB: Unable to open ./ibdata1",
      "InnoDB: Fatal error: cannot read from tablespace {id}",
      "[ERROR] InnoDB: Checksum mismatch in datafile: ./ibdata1",
      "[Warning] Aborted connection {id} to db: '{db}' user: '{user}' host: '{host}' ({reason})",
      "[ERROR] mysqld: Disk is full writing '/var/lib/mysql/#sql_{id}.ibd' (Errcode: 28 - No space left on device)",
      "[Warning] InnoDB: Cannot open table {db}/{table} from the internal data dictionary",
      "Aborting",
      "InnoDB: Starting crash recovery",
      "[ERROR] Slave I/O for channel '': error connecting to master",
    ],
  },
  {
    source: "sshd",
    patterns: [
      "Failed password for {user} from {ip} port {port} ssh2",
      "Accepted publickey for {user} from {ip} port {port} ssh2",
      "Connection closed by {ip} port {port} [preauth]",
      "error: maximum authentication attempts exceeded for {user} from {ip} port {port} ssh2",
      "Received disconnect from {ip} port {port}:11: Bye Bye [preauth]",
      "pam_unix(sshd:auth): authentication failure; logname= uid=0 euid=0 tty=ssh ruser= rhost={ip}",
      "reverse mapping checking getaddrinfo for {host} [{ip}] failed - POSSIBLE BREAK-IN ATTEMPT!",
    ],
  },
  {
    source: "chronyd",
    patterns: [
      "System clock wrong by {sec} seconds",
      "Can't synchronise: no selectable sources",
      "Selected source {source} ({stratum} stratum, {offset} offset)",
      "Source {source} replaced with {newsource}",
      "Frequency {freq} +/- {ppm} ppm from 4 readings",
    ],
  },
  {
    source: "crond",
    patterns: [
      "(CRON) INFO (Running @reboot jobs)",
      "(root) CMD ({cmd})",
      "(CRON) error (grandchild # {pid} failed with exit status {code})",
      "(CRON) INFO (pidfile fd = {fd})",
      "chdir failed ({path}): Permission denied",
    ],
  },
  {
    source: "fail2ban",
    patterns: [
      "Ban {ip}",
      "Unban {ip}",
      "Found {ip} - {date}",
      "Ignore {ip}",
      "Created ban rule '{rule}'",
      "Notice {ban} already banned",
    ],
  },
  {
    source: "firewalld",
    patterns: [
      "WARNING: COMMAND_FAILED: '{cmd}' failed",
      "SUCCESS: Added service '{svc}'",
      "SUCCESS: Removed service '{svc}'",
      "WARNING: ALREADY_ENABLED: '{svc}' already enabled",
      "ERROR: ZONE_ALREADY_SET",
    ],
  },
];

/**
 * Interpolate a log pattern with context values.
 */
export function interpolate(pattern: string, ctx: Record<string, string | number>): string {
  return pattern.replace(/\{(\w+)\}/g, (_, key) => {
    if (key in ctx) return String(ctx[key]);

    // Generate realistic defaults for common placeholders
    const defaults: Record<string, string> = {
      svc: "unknown",
      pid: String(Math.floor(Math.random() * 9000) + 1000),
      proc: "unknown",
      dev: "sda1",
      inode: "2",
      port: String(Math.floor(Math.random() * 60000) + 1000),
      pct: String(Math.floor(Math.random() * 100)),
      count: "1",
      client: "10.0.2.50",
      ip: "10.0.2.50",
      user: "root",
      path: "/var/www/html/index.html",
      code: "1",
      sig: "11",
      req: String(Math.floor(Math.random() * 99999)),
      sec: String((Math.random() * 100).toFixed(4)),
      source: "pool.ntp.org",
      stratum: "2",
      offset: "+0.0012345",
      freq: "12.345",
      ppm: "0.123",
      db: "proddb",
      host: "10.0.2.50",
      reason: "Got timeout reading communication packets",
      id: String(Math.floor(Math.random() * 99999)),
      table: "orders",
      cmd: "/opt/backup.sh",
      fd: "3",
      iface: "eth0",
      rule: "ssh",
      ban: "10.0.2.50",
      newsource: "pool.ntp.org",
      vm: "12345678",
      rss: "8765432",
    };

    return defaults[key] || key;
  });
}
