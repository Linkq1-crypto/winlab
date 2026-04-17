// realism/state.ts — Core environment model (fs, services, network, storage, logs)

export type ServiceState = "stopped" | "starting" | "running" | "stopping" | "failed" | "degraded" | "restarting";

export type LogLevel = "info" | "warn" | "error" | "crit";

export interface LogEntry {
  timestamp: number;
  source: string;
  level: LogLevel;
  message: string;
}

export interface Service {
  status: ServiceState;
  pid?: number;
  since?: number;
  deps: string[];
  enabled: boolean;
  configPath?: string;
}

export interface FileEntry {
  content: string;
  permissions: number;  // octal, e.g. 0o644
  owner: string;
  group: string;
  size: number;
  modifiedAt: number;
}

export interface VirtualFS {
  files: Map<string, FileEntry>;
  directories: Set<string>;
  read(path: string): string | null;
  write(path: string, content: string, permissions?: number): void;
  exists(path: string): boolean;
  remove(path: string): void;
  listDir(path: string): string[];
  getPermissions(path: string): number | null;
}

export interface NetworkState {
  latencyMs: number;
  drops: number;
  interfaces: Record<string, {
    up: boolean;
    ip?: string;
    mask?: string;
    gateway?: string;
  }>;
}

export interface RAIDState {
  level: number;
  status: "healthy" | "degraded" | "rebuilding" | "failed";
  devices: Array<{
    name: string;
    status: "active" | "failed" | "spare" | "rebuilding";
    size: number;
  }>;
  missingBlocks: number;
  rebuildProgress: number;  // 0-100
}

export interface StorageState {
  raid: RAIDState;
  volumes: Record<string, {
    size: number;
    used: number;
    inodes: number;
    inodesUsed: number;
    mountPoint: string;
  }>;
}

export class Env {
  fs: VirtualFS;
  services: Record<string, Service>;
  network: NetworkState;
  storage: StorageState;
  logs: LogEntry[];
  user: string;
  hostname: string;
  cwd: string;
  environment: Record<string, string>;

  constructor() {
    this.fs = createVirtualFS();
    this.services = {};
    this.network = {
      latencyMs: 20,
      drops: 0,
      interfaces: {
        eth0: { up: true, ip: "10.0.1.100", mask: "24", gateway: "10.0.1.1" },
      },
    };
    this.storage = {
      raid: {
        level: 1,
        status: "healthy",
        devices: [
          { name: "/dev/sda1", status: "active", size: 104856832 },
          { name: "/dev/sdb1", status: "active", size: 104856832 },
        ],
        missingBlocks: 0,
        rebuildProgress: 100,
      },
      volumes: {
        "/": { size: 53687091200, used: 19327352832, inodes: 3276800, inodesUsed: 450000, mountPoint: "/" },
        "/data": { size: 107374182400, used: 45097156608, inodes: 6553600, inodesUsed: 1200000, mountPoint: "/data" },
      },
    };
    this.logs = [];
    this.user = "root";
    this.hostname = "server01.lab.local";
    this.cwd = "/root";
    this.environment = {
      HOME: "/root",
      PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/root/bin",
      SHELL: "/bin/bash",
      LANG: "en_US.UTF-8",
    };
  }

  snapshot(): string {
    return JSON.stringify({
      services: this.services,
      network: this.network,
      storage: {
        raid: this.storage.raid,
        volumes: this.storage.volumes,
      },
      logs: this.logs.length,
    });
  }

  clone(): Env {
    const clone = new Env();
    clone.services = JSON.parse(JSON.stringify(this.services));
    clone.network = JSON.parse(JSON.stringify(this.network));
    clone.storage = JSON.parse(JSON.stringify(this.storage));
    clone.logs = [...this.logs];
    clone.user = this.user;
    clone.hostname = this.hostname;
    clone.cwd = this.cwd;
    clone.environment = { ...this.environment };
    clone.fs = cloneVirtualFS(this.fs);
    return clone;
  }
}

function createVirtualFS(): VirtualFS {
  const files = new Map<string, FileEntry>();
  const directories = new Set<string>();

  // Initialize base directories
  directories.add("/");
  directories.add("/etc");
  directories.add("/var");
  directories.add("/var/log");
  directories.add("/var/lib");
  directories.add("/var/lib/mysql");
  directories.add("/usr");
  directories.add("/root");
  directories.add("/tmp");

  return {
    files,
    directories,
    read(path: string): string | null {
      const entry = files.get(path);
      return entry?.content ?? null;
    },
    write(path: string, content: string, permissions = 0o644): void {
      files.set(path, {
        content,
        permissions,
        owner: "root",
        group: "root",
        size: content.length,
        modifiedAt: Date.now(),
      });
    },
    exists(path: string): boolean {
      return files.has(path) || directories.has(path);
    },
    remove(path: string): void {
      files.delete(path);
    },
    listDir(path: string): string[] {
      const entries = new Set<string>();
      for (const file of files.keys()) {
        if (file.startsWith(path) && file !== path) {
          const relative = file.slice(path.length).split("/")[1];
          if (relative) entries.add(relative);
        }
      }
      for (const dir of directories) {
        if (dir.startsWith(path) && dir !== path) {
          const relative = dir.slice(path.length).split("/")[1];
          if (relative) entries.add(relative);
        }
      }
      return Array.from(entries);
    },
    getPermissions(path: string): number | null {
      return files.get(path)?.permissions ?? null;
    },
  };
}

function cloneVirtualFS(fs: VirtualFS): VirtualFS {
  const newFS = createVirtualFS();
  for (const [path, entry] of fs.files) {
    newFS.files.set(path, { ...entry });
  }
  for (const dir of fs.directories) {
    newFS.directories.add(dir);
  }
  return newFS;
}

export function createDefaultEnv(): Env {
  const env = new Env();

  // Default services
  env.services = {
    sshd: { status: "running", pid: 892, since: Date.now() - 86400000, deps: ["network"], enabled: true, configPath: "/etc/ssh/sshd_config" },
    httpd: { status: "running", pid: 1234, since: Date.now() - 3600000, deps: ["network"], enabled: true, configPath: "/etc/httpd/conf/httpd.conf" },
    mysqld: { status: "running", pid: 2345, since: Date.now() - 86400000, deps: ["storage"], enabled: true, configPath: "/etc/my.cnf" },
    nginx: { status: "running", pid: 3456, since: Date.now() - 3600000, deps: ["network"], enabled: false },
    network: { status: "running", pid: undefined, since: Date.now() - 86400000, deps: [], enabled: true },
    crond: { status: "running", pid: 567, since: Date.now() - 86400000, deps: [], enabled: true, configPath: "/etc/crontab" },
    chronyd: { status: "running", pid: 678, since: Date.now() - 86400000, deps: ["network"], enabled: true },
    firewalld: { status: "running", pid: 789, since: Date.now() - 86400000, deps: [], enabled: true },
    rsyslog: { status: "running", pid: 456, since: Date.now() - 86400000, deps: ["storage"], enabled: true },
  };

  // Initialize filesystem with common configs
  env.fs.write("/etc/httpd/conf/httpd.conf", `<VirtualHost *:80>
    ServerName server01.lab.local
    DocumentRoot /var/www/html
</VirtualHost>`, 0o644);

  env.fs.write("/etc/my.cnf", `[mysqld]
datadir=/var/lib/mysql
socket=/var/lib/mysql/mysql.sock
innodb_flush_log_at_trx_commit=1
innodb_file_per_table=ON`, 0o644);

  env.fs.write("/etc/resolv.conf", `nameserver 10.0.10.1
nameserver 10.0.10.2
search lab.local`, 0o644);

  return env;
}
