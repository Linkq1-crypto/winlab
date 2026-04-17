// ============================================================
// Incident Library — 30 realistic incidents across 6 categories
// ============================================================

export interface IncidentStage {
  name: string
  delay: number // ms
  actions: ((env: any) => void)[]
}

export interface Incident {
  id: string
  category: "network" | "db" | "app" | "infra" | "auth" | "storage"
  difficulty: "medium" | "hard" | "expert"
  rootCauses: string[]
  layers: string[]
  stages: IncidentStage[]
  description: string
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------
const ms = (s: number) => s * 1000

function log(env: any, msg: string) {
  if (Array.isArray(env.logs)) env.logs.push(msg)
}

// ----------------------------------------------------------
// NETWORK INCIDENTS (5)
// ----------------------------------------------------------

export const NETWORK_INCIDENTS: Incident[] = [
  {
    id: "net_latency_spike",
    category: "network",
    difficulty: "medium",
    rootCauses: [
      "Switch buffer overflow on core-router-01",
      "QoS policy misconfiguration after firmware upgrade",
    ],
    layers: ["physical", "data-link", "transport"],
    description:
      "Latency spikes from 5ms to 800ms+ on the core network affecting all downstream services. Intermittent packet loss accompanies the spikes.",
    stages: [
      {
        name: "baseline_degradation",
        delay: ms(3),
        actions: [
          (env) => {
            env.network.latencyMs = 45
            log(env, "[net] latency increased to 45ms on eth0")
          },
        ],
      },
      {
        name: "spike_onset",
        delay: ms(5),
        actions: [
          (env) => {
            env.network.latencyMs = 320
            env.network.drops = 2
            log(env, "[net] latency spike detected: 320ms")
            log(env, "[net] 2 packet drops on interface bond0")
          },
        ],
      },
      {
        name: "peak_latency",
        delay: ms(8),
        actions: [
          (env) => {
            env.network.latencyMs = 850
            env.network.drops = 12
            log(env, "[net] CRITICAL latency: 850ms")
            log(env, "[net] packet loss burst: 12 drops in 2s window")
            if (env.services) {
              env.services.mysql.status = "degraded"
              env.services.redis.status = "degraded"
            }
          },
        ],
      },
      {
        name: "cascade_effects",
        delay: ms(6),
        actions: [
          (env) => {
            env.network.dnsDown = false
            env.network.jitterMs = 250
            log(env, "[net] jitter elevated: 250ms")
            log(env, "[app] upstream timeout on 3 requests")
            if (env.db) env.db.lag = (env.db.lag || 0) + 1500
          },
        ],
      },
    ],
  },
  {
    id: "dns_resolution_failure",
    category: "network",
    difficulty: "medium",
    rootCauses: [
      "DNS resolver (bind9) crashed due to memory exhaustion",
      "Upstream DNS provider outage (8.8.8.8 unreachable)",
    ],
    layers: ["application", "network"],
    description:
      "DNS resolution fails intermittently then completely. Services cannot resolve internal or external hostnames.",
    stages: [
      {
        name: "intermittent_failures",
        delay: ms(4),
        actions: [
          (env) => {
            env.network.dnsDown = false
            env.network.dnsFlaky = true
            log(env, "[dns] intermittent resolution failures for internal hosts")
          },
        ],
      },
      {
        name: "resolver_crash",
        delay: ms(6),
        actions: [
          (env) => {
            env.network.dnsDown = true
            log(env, "[dns] resolver bind9 process terminated (OOM)")
            log(env, "[dns] ALL resolution requests failing")
          },
        ],
      },
      {
        name: "service_impact",
        delay: ms(5),
        actions: [
          (env) => {
            if (env.services) {
              env.services.api.status = "down"
              env.services.mysql.status = "degraded"
            }
            log(env, "[app] cannot resolve db-primary.internal: NXDOMAIN")
            log(env, "[app] cannot resolve cache.internal: NXDOMAIN")
          },
        ],
      },
      {
        name: "caching_exhaustion",
        delay: ms(4),
        actions: [
          (env) => {
            env.network.dnsCacheExpired = true
            log(env, "[dns] local cache entries expired")
            log(env, "[net] new connections failing — hostname resolution unavailable")
          },
        ],
      },
    ],
  },
  {
    id: "packet_loss_burst",
    category: "network",
    difficulty: "hard",
    rootCauses: [
      "Fiber optic cable degradation on link between dc1 and dc2",
      "SFP module overheating causing CRC errors",
    ],
    layers: ["physical", "data-link"],
    description:
      "Burst packet loss of 15-30% on the inter-datacenter link. TCP retransmissions flood the network causing congestion collapse.",
    stages: [
      {
        name: "crc_errors_begin",
        delay: ms(3),
        actions: [
          (env) => {
            env.network.drops = 5
            env.network.crcErrors = 47
            log(env, "[net] CRC errors on eth2: 47 in 10s")
          },
        ],
      },
      {
        name: "loss_burst",
        delay: ms(7),
        actions: [
          (env) => {
            env.network.drops = 150
            env.network.packetLossPct = 18
            env.network.latencyMs = 450
            log(env, "[net] packet loss burst: 18% loss rate")
            log(env, "[net] TCP retransmissions: 2400/sec")
          },
        ],
      },
      {
        name: "congestion_collapse",
        delay: ms(6),
        actions: [
          (env) => {
            env.network.drops = 500
            env.network.packetLossPct = 32
            env.network.latencyMs = 1200
            if (env.services) {
              env.services.api.status = "degraded"
              env.services.replicator.status = "down"
            }
            log(env, "[net] congestion collapse — effective throughput < 10Mbps")
            log(env, "[replication] sync failed: connection reset by peer")
          },
        ],
      },
      {
        name: "tcp_backoff",
        delay: ms(5),
        actions: [
          (env) => {
            env.network.tcpRetransmits = 8500
            log(env, "[net] TCP exponential backoff engaged")
            log(env, "[net] established connections timing out")
          },
        ],
      },
    ],
  },
  {
    id: "network_partition",
    category: "network",
    difficulty: "expert",
    rootCauses: [
      "BGP session flap caused split-brain between availability zones",
      "Firewall rule change isolated az-2 from az-1",
    ],
    layers: ["network", "application"],
    description:
      "Complete network partition between availability zones. az-2 cannot reach az-1 services. Replication and consensus protocols break.",
    stages: [
      {
        name: "bgp_flap",
        delay: ms(4),
        actions: [
          (env) => {
            env.network.partition = "az-2:az-1"
            log(env, "[bgp] session to 10.0.1.1 flapping: up/down/up/down")
          },
        ],
      },
      {
        name: "partition_established",
        delay: ms(6),
        actions: [
          (env) => {
            env.network.drops = 9999
            env.network.partition = "az-2:az-1"
            env.network.partitionActive = true
            if (env.services) {
              env.services.replicator.status = "down"
              env.services.consensus.status = "split-brain"
            }
            log(env, "[net] PARTITION: az-2 cannot reach az-1")
            log(env, "[consensus] quorum lost — split brain detected")
          },
        ],
      },
      {
        name: "replication_break",
        delay: ms(5),
        actions: [
          (env) => {
            if (env.db) {
              env.db.replicationBroken = true
              env.db.lag = 5000
            }
            log(env, "[db] replication stream broken: connection refused")
            log(env, "[db] secondary falling behind: lag=5000ms")
          },
        ],
      },
      {
        name: "failover_attempt",
        delay: ms(8),
        actions: [
          (env) => {
            env.network.failoverAttempted = true
            log(env, "[ha] initiating failover to az-3")
            log(env, "[ha] WARNING: failover target also unreachable")
            if (env.services) {
              env.services.api.status = "down"
            }
          },
        ],
      },
    ],
  },
  {
    id: "bgp_route_issue",
    category: "network",
    difficulty: "expert",
    rootCauses: [
      "Rogue BGP route announcement from misconfigured edge router",
      "Route hijacking: traffic for 10.0.0.0/8 redirected to null route",
    ],
    layers: ["network", "routing"],
    description:
      "BGP route misconfiguration causes traffic destined for internal subnets to be routed to a blackhole. External connectivity partially fails.",
    stages: [
      {
        name: "rogue_announcement",
        delay: ms(5),
        actions: [
          (env) => {
            env.network.bgpRogueRoute = true
            log(env, "[bgp] unexpected route announcement: 10.0.0.0/8 via 192.168.99.1")
          },
        ],
      },
      {
        name: "route_propagation",
        delay: ms(6),
        actions: [
          (env) => {
            env.network.routingTableCorrupted = true
            env.network.drops = 50
            log(env, "[bgp] route propagated to 12 peers")
            log(env, "[net] traffic for 10.0.0.0/8 being blackholed")
          },
        ],
      },
      {
        name: "connectivity_loss",
        delay: ms(7),
        actions: [
          (env) => {
            env.network.drops = 200
            env.network.latencyMs = 999
            if (env.services) {
              env.services.api.status = "down"
              env.services.mysql.status = "down"
            }
            log(env, "[net] external connectivity: 80% packet loss")
            log(env, "[app] all outbound connections timing out")
          },
        ],
      },
      {
        name: "route_withdrawal_partial",
        delay: ms(5),
        actions: [
          (env) => {
            env.network.bgpRogueRoute = false
            env.network.routingTableCorrupted = false
            env.network.drops = 10
            log(env, "[bgp] route withdrawn but convergence incomplete")
            log(env, "[net] partial recovery — some prefixes still unreachable")
          },
        ],
      },
    ],
  },
]

// ----------------------------------------------------------
// DATABASE INCIDENTS (5)
// ----------------------------------------------------------

export const DB_INCIDENTS: Incident[] = [
  {
    id: "mysql_replication_lag",
    category: "db",
    difficulty: "medium",
    rootCauses: [
      "Long-running analytical query on primary blocking replication thread",
      "Network latency between primary and replica causing I/O bottleneck",
    ],
    layers: ["database", "network"],
    description:
      "MySQL replication lag grows from 200ms to 15+ seconds. Read replicas serve stale data causing application inconsistencies.",
    stages: [
      {
        name: "lag_increase",
        delay: ms(4),
        actions: [
          (env) => {
            if (!env.db) env.db = {}
            env.db.lag = 800
            log(env, "[db] replication lag: 800ms (threshold: 500ms)")
          },
        ],
      },
      {
        name: "query_blocking",
        delay: ms(6),
        actions: [
          (env) => {
            env.db.lag = 3500
            env.db.longRunningQuery = "SELECT * FROM analytics JOIN ..."
            log(env, "[db] long-running query on primary: 45s elapsed")
            log(env, "[db] replication lag: 3500ms")
            if (env.services) env.services.mysql.status = "degraded"
          },
        ],
      },
      {
        name: "stale_reads",
        delay: ms(5),
        actions: [
          (env) => {
            env.db.lag = 12000
            env.db.staleData = true
            log(env, "[db] CRITICAL replication lag: 12000ms")
            log(env, "[app] read replicas returning stale data")
            log(env, "[app] user session mismatch detected on 3 requests")
          },
        ],
      },
      {
        name: "binlog_backlog",
        delay: ms(4),
        actions: [
          (env) => {
            env.db.lag = 15000
            env.db.binlogBacklog = true
            env.db.binlogSizeGB = 45
            log(env, "[db] binlog backlog: 45GB pending replay")
            log(env, "[db] relay log space critically low")
          },
        ],
      },
    ],
  },
  {
    id: "connection_pool_exhaustion",
    category: "db",
    difficulty: "hard",
    rootCauses: [
      "Connection leak in application — connections not returned to pool",
      "Connection pool max size too low for traffic surge",
    ],
    layers: ["application", "database"],
    description:
      "Application connection pool exhausted. New database connections queue and eventually timeout. All database-dependent operations fail.",
    stages: [
      {
        name: "pool_utilization_high",
        delay: ms(3),
        actions: [
          (env) => {
            if (!env.db) env.db = {}
            env.db.activeConnections = 95
            env.db.maxConnections = 100
            log(env, "[db] connection pool: 95/100 active (95%)")
          },
        ],
      },
      {
        name: "pool_exhaustion",
        delay: ms(5),
        actions: [
          (env) => {
            env.db.activeConnections = 100
            env.db.connectionQueue = 47
            env.db.connectionWaitMs = 5000
            log(env, "[db] connection pool EXHAUSTED: 100/100")
            log(env, "[db] 47 connections waiting in queue")
            if (env.services) env.services.mysql.status = "degraded"
          },
        ],
      },
      {
        name: "timeout_cascade",
        delay: ms(6),
        actions: [
          (env) => {
            env.db.connectionQueue = 120
            env.db.connectionWaitMs = 30000
            env.db.connectionTimeouts = 34
            log(env, "[db] connection timeout: 34 requests failed")
            log(env, "[app] HTTP 500 on /api/users — cannot acquire connection")
            log(env, "[app] HTTP 500 on /api/orders — cannot acquire connection")
          },
        ],
      },
      {
        name: "application_degradation",
        delay: ms(5),
        actions: [
          (env) => {
            env.db.connectionTimeouts = 89
            env.cpu = 92
            if (env.services) {
              env.services.api.status = "degraded"
              env.services.mysql.status = "down"
            }
            log(env, "[app] error rate: 67% of requests returning 500")
            log(env, "[db] pool recovery stalled — leaked connections not released")
          },
        ],
      },
    ],
  },
  {
    id: "deadlock_storm",
    category: "db",
    difficulty: "hard",
    rootCauses: [
      "Schema change introduced circular lock dependency on order/inventory tables",
      "Transaction isolation level change from READ-COMMITTED to SERIALIZABLE",
    ],
    layers: ["database", "application"],
    description:
      "Deadlock storms on MySQL InnoDB tables. 200+ deadlocks per minute. Transactions roll back causing data inconsistencies and retries.",
    stages: [
      {
        name: "deadlock_onset",
        delay: ms(4),
        actions: [
          (env) => {
            if (!env.db) env.db = {}
            env.db.deadlocks = 12
            log(env, "[db] deadlock detected: trx 4521 vs 4523 on table `orders`")
          },
        ],
      },
      {
        name: "deadlock_storm",
        delay: ms(6),
        actions: [
          (env) => {
            env.db.deadlocks = 215
            env.db.rolledBackTrx = 180
            env.db.lockWaitTimeout = true
            log(env, "[db] DEADLOCK STORM: 215 deadlocks in last minute")
            log(env, "[db] 180 transactions rolled back")
            if (env.services) env.services.mysql.status = "degraded"
          },
        ],
      },
      {
        name: "retry_amplification",
        delay: ms(5),
        actions: [
          (env) => {
            env.db.deadlocks = 450
            env.db.retryRate = 78
            env.cpu = 88
            log(env, "[app] retry amplification: 78% of requests are retries")
            log(env, "[db] lock wait timeout exceeded for 45 transactions")
          },
        ],
      },
      {
        name: "data_inconsistency",
        delay: ms(6),
        actions: [
          (env) => {
            env.db.deadlocks = 620
            env.db.dataInconsistent = true
            env.db.corrupted = "partial"
            log(env, "[db] WARNING: partial data inconsistency detected")
            log(env, "[db] order/inventory counts mismatch on 23 rows")
            log(env, "[app] inventory shows negative stock for 8 items")
          },
        ],
      },
    ],
  },
  {
    id: "disk_full_db",
    category: "db",
    difficulty: "medium",
    rootCauses: [
      "Binary logs not being purged — consumed all disk space",
      "Large unpartitioned table grew beyond expected size",
    ],
    layers: ["storage", "database"],
    description:
      "MySQL data partition reaches 100% disk usage. Database switches to read-only mode. Writes fail with 'disk full' errors.",
    stages: [
      {
        name: "disk_warning",
        delay: ms(3),
        actions: [
          (env) => {
            if (!env.storage) env.storage = {}
            env.storage.usagePct = 92
            log(env, "[storage] /var/lib/mysql at 92% capacity")
          },
        ],
      },
      {
        name: "disk_critical",
        delay: ms(5),
        actions: [
          (env) => {
            env.storage.usagePct = 99
            env.storage.full = true
            log(env, "[storage] CRITICAL: /var/lib/mysql at 99% — 200MB remaining")
            log(env, "[db] binlog write failed: No space left on device")
          },
        ],
      },
      {
        name: "readonly_mode",
        delay: ms(6),
        actions: [
          (env) => {
            if (!env.db) env.db = {}
            env.db.readOnly = true
            env.db.writeErrors = 15
            log(env, "[db] InnoDB switching to read-only mode")
            log(env, "[app] INSERT/UPDATE failing: ERROR 1021 (HY000): Disk full")
            if (env.services) env.services.mysql.status = "degraded"
          },
        ],
      },
      {
        name: "service_failure",
        delay: ms(5),
        actions: [
          (env) => {
            env.db.writeErrors = 120
            env.db.crashRisk = true
            if (env.services) env.services.mysql.status = "down"
            log(env, "[db] ERROR: InnoDB cannot write undo log — crash risk")
            log(env, "[app] all write operations returning 500")
          },
        ],
      },
    ],
  },
  {
    id: "corrupted_index",
    category: "db",
    difficulty: "expert",
    rootCauses: [
      "Unclean shutdown during index rebuild caused partial corruption",
      "Hardware-level bit flip on RAM caused incorrect index page writes",
    ],
    layers: ["database", "storage", "hardware"],
    description:
      "Corrupted secondary index on users table causes incorrect query results and occasional crashes. CHECK TABLE reports corruption.",
    stages: [
      {
        name: "slow_queries",
        delay: ms(4),
        actions: [
          (env) => {
            if (!env.db) env.db = {}
            env.db.corrupted = "index:idx_users_email"
            env.db.slowQueries = 35
            log(env, "[db] unusual query plan on SELECT ... WHERE email = ...")
            log(env, "[db] full table scan instead of index: 35 slow queries")
          },
        ],
      },
      {
        name: "incorrect_results",
        delay: ms(6),
        actions: [
          (env) => {
            env.db.incorrectResults = true
            env.db.corrupted = "index:idx_users_email"
            log(env, "[db] WARNING: index scan returning duplicate rows")
            log(env, "[app] user lookup returning 2 results for same email")
          },
        ],
      },
      {
        name: "corruption_spread",
        delay: ms(7),
        actions: [
          (env) => {
            env.db.corrupted = "multiple indexes"
            env.db.checkTableFails = true
            log(env, "[db] CHECK TABLE users FAILED: Corrupted index 'idx_users_email'")
            log(env, "[db] CHECK TABLE sessions FAILED: Corrupted index 'idx_sessions_token'")
            if (env.services) env.services.mysql.status = "degraded"
          },
        ],
      },
      {
        name: "crash_recovery",
        delay: ms(8),
        actions: [
          (env) => {
            env.db.crashed = true
            env.db.corrupted = "multiple indexes"
            log(env, "[db] mysqld crashed — InnoDB assertion failure in btr0cur.cc")
            log(env, "[db] crash recovery initiated — may need REPAIR TABLE")
          },
        ],
      },
    ],
  },
]

// ----------------------------------------------------------
// APPLICATION INCIDENTS (5)
// ----------------------------------------------------------

export const APP_INCIDENTS: Incident[] = [
  {
    id: "nginx_502",
    category: "app",
    difficulty: "medium",
    rootCauses: [
      "Backend application server crashed and not restarting",
      "Upstream keepalive connections stale after backend restart",
    ],
    layers: ["application", "http"],
    description:
      "Nginx returns 502 Bad Gateway for 40% of requests. Upstream application server is intermittently unavailable.",
    stages: [
      {
        name: "upstream_errors_begin",
        delay: ms(3),
        actions: [
          (env) => {
            if (!env.services) env.services = {}
            env.services.appBackend.status = "degraded"
            env.http502Rate = 8
            log(env, "[nginx] upstream prematurely closed connection")
            log(env, "[nginx] 502 rate: 8%")
          },
        ],
      },
      {
        name: "backend_crash",
        delay: ms(5),
        actions: [
          (env) => {
            env.services.appBackend.status = "down"
            env.http502Rate = 45
            log(env, "[app] node process crashed: FATAL ERROR: CALL_AND_RETRY_LAST")
            log(env, "[nginx] 502 rate: 45% — connect() failed (111: Connection refused)")
          },
        ],
      },
      {
        name: "restart_loop",
        delay: ms(6),
        actions: [
          (env) => {
            env.services.appBackend.status = "flapping"
            env.services.appBackend.restarts = 4
            env.http502Rate = 35
            log(env, "[systemd] app-backend.service: Start request repeated too quickly")
            log(env, "[systemd] app-backend.service: Failed with result 'exit-code'")
            log(env, "[nginx] 502 rate: 35% — intermittent upstream availability")
          },
        ],
      },
      {
        name: "circuit_breaker",
        delay: ms(5),
        actions: [
          (env) => {
            env.http502Rate = 60
            env.circuitBreakerOpen = true
            log(env, "[nginx] upstream health check failed 3/3")
            log(env, "[nginx] marking upstream 127.0.0.1:3000 as DOWN")
            log(env, "[app] circuit breaker OPEN — rejecting all requests")
          },
        ],
      },
    ],
  },
  {
    id: "config_error",
    category: "app",
    difficulty: "medium",
    rootCauses: [
      "Deployed configuration with typo in database connection string",
      "Environment variable override not applied in production",
    ],
    layers: ["application", "configuration"],
    description:
      "Application deployed with incorrect configuration. Database connection string points to staging environment. Feature flags misconfigured.",
    stages: [
      {
        name: "deploy_with_bad_config",
        delay: ms(3),
        actions: [
          (env) => {
            env.configError = "DATABASE_URL points to staging-db:5432"
            log(env, "[deploy] config loaded: DATABASE_URL=postgres://staging-db:5432/app")
            log(env, "[deploy] WARNING: connecting to non-production database")
          },
        ],
      },
      {
        name: "data_mismatch",
        delay: ms(5),
        actions: [
          (env) => {
            env.configError = "wrong_database"
            env.dataInconsistent = true
            log(env, "[app] user authentication failing — users table empty")
            log(env, "[app] orders not found — data from staging environment")
          },
        ],
      },
      {
        name: "feature_flag_chaos",
        delay: ms(4),
        actions: [
          (env) => {
            env.configError = "feature_flags_corrupted"
            env.featureFlags = { payments: false, notifications: true, auth_v2: false }
            log(env, "[config] feature flag 'payments' unexpectedly disabled")
            log(env, "[config] feature flag 'auth_v2' disabled — reverting to legacy auth")
            if (env.services) env.services.api.status = "degraded"
          },
        ],
      },
      {
        name: "cascading_failures",
        delay: ms(5),
        actions: [
          (env) => {
            env.http500Rate = 55
            log(env, "[app] 55% of requests returning HTTP 500")
            log(env, "[app] payment processing: all requests failing")
            log(env, "[app] notification service sending to wrong endpoints")
          },
        ],
      },
    ],
  },
  {
    id: "memory_leak_app",
    category: "app",
    difficulty: "hard",
    rootCauses: [
      "Event listener accumulation in singleton — listeners never removed",
      "Buffer pooling bug causing unbounded memory growth",
    ],
    layers: ["application", "runtime"],
    description:
      "Application memory grows linearly at ~50MB/hour. Eventually triggers OOM. Heap snapshots show unclosed connection objects.",
    stages: [
      {
        name: "memory_growth",
        delay: ms(4),
        actions: [
          (env) => {
            env.memory = 65
            env.memoryTrend = "increasing"
            log(env, "[app] heap usage: 65% (was 35% at startup)")
            log(env, "[app] memory growth rate: ~50MB/hour")
          },
        ],
      },
      {
        name: "gc_pressure",
        delay: ms(5),
        actions: [
          (env) => {
            env.memory = 82
            env.gcPauseMs = 450
            env.cpu = 75
            log(env, "[runtime] GC pause times elevated: 450ms avg")
            log(env, "[runtime] full GC runs: 12 in last hour (normal: 2)")
            if (env.services) env.services.api.status = "degraded"
          },
        ],
      },
      {
        name: "oom_warning",
        delay: ms(6),
        actions: [
          (env) => {
            env.memory = 94
            env.gcPauseMs = 1200
            env.cpu = 90
            log(env, "[runtime] WARNING: heap near limit — 94% used")
            log(env, "[runtime] V8 near-oom: triggering emergency GC")
          },
        ],
      },
      {
        name: "oom_crash",
        delay: ms(5),
        actions: [
          (env) => {
            env.memory = 100
            env.oomKilled = true
            if (env.services) env.services.appBackend.status = "down"
            log(env, "[runtime] FATAL ERROR: Ineffective mark-compacts near heap limit")
            log(env, "[kernel] Out of memory: Killed process 4521 (node) score 945")
          },
        ],
      },
    ],
  },
  {
    id: "thread_pool_exhaustion",
    category: "app",
    difficulty: "hard",
    rootCauses: [
      "Synchronous I/O blocking on slow NFS mount consuming all worker threads",
      "Thread pool size not tuned for production load",
    ],
    layers: ["application", "os"],
    description:
      "Application thread pool exhausted. All worker threads blocked on I/O. Request queue grows unbounded. Response times exceed 30 seconds.",
    stages: [
      {
        name: "thread_utilization_high",
        delay: ms(3),
        actions: [
          (env) => {
            if (!env.app) env.app = {}
            env.app.threadPoolActive = 48
            env.app.threadPoolMax = 50
            env.app.requestQueue = 12
            log(env, "[app] thread pool: 48/50 active threads")
            log(env, "[app] request queue depth: 12")
          },
        ],
      },
      {
        name: "pool_exhaustion",
        delay: ms(5),
        actions: [
          (env) => {
            env.app.threadPoolActive = 50
            env.app.requestQueue = 150
            env.app.threadPoolExhausted = true
            log(env, "[app] thread pool EXHAUSTED — all 50 threads blocked")
            log(env, "[app] request queue: 150 pending requests")
            log(env, "[app] threads blocked on: nfs_read(/mnt/shared/cache)")
          },
        ],
      },
      {
        name: "request_timeout",
        delay: ms(6),
        actions: [
          (env) => {
            env.app.requestQueue = 400
            env.app.requestTimeouts = 85
            env.app.avgResponseTimeMs = 32000
            log(env, "[app] request timeout: 85 requests exceeded 30s limit")
            log(env, "[app] avg response time: 32000ms (p99: 45000ms)")
            if (env.services) env.services.api.status = "degraded"
          },
        ],
      },
      {
        name: "queue_overflow",
        delay: ms(5),
        actions: [
          (env) => {
            env.app.requestQueue = 1200
            env.app.requestTimeouts = 340
            env.app.queueOverflow = true
            log(env, "[app] request queue overflow — dropping new requests")
            log(env, "[app] HTTP 503: Service Unavailable for 340 requests")
          },
        ],
      },
    ],
  },
  {
    id: "ssl_expired",
    category: "app",
    difficulty: "medium",
    rootCauses: [
      "Let's Encrypt certificate auto-renewal cron job silently failing",
      "Certificate expiration monitoring not configured for wildcard domain",
    ],
    layers: ["application", "security", "http"],
    description:
      "TLS certificate expired on production load balancer. All HTTPS connections fail with certificate validation errors. Mobile apps cannot connect.",
    stages: [
      {
        name: "expiration_warning",
        delay: ms(3),
        actions: [
          (env) => {
            env.sslDaysRemaining = 2
            log(env, "[ssl] certificate for *.example.com expires in 2 days")
            log(env, "[ssl] auto-renewal cron job last exit code: 1")
          },
        ],
      },
      {
        name: "certificate_expired",
        delay: ms(5),
        actions: [
          (env) => {
            env.sslDaysRemaining = -1
            env.sslExpired = true
            log(env, "[ssl] CERTIFICATE EXPIRED: *.example.com")
            log(env, "[ssl] notAfter: 2026-04-11T00:00:00Z")
            log(env, "[ssl] notBefore: 2026-01-11T00:00:00Z")
          },
        ],
      },
      {
        name: "connection_failures",
        delay: ms(6),
        actions: [
          (env) => {
            env.sslConnectionFailures = 250
            env.http502Rate = 100
            if (env.services) env.services.api.status = "down"
            log(env, "[nginx] SSL_do_handshake() failed: certificate has expired")
            log(env, "[app] 100% of HTTPS connections failing")
            log(env, "[mobile] app users seeing 'Cannot Connect' error")
          },
        ],
      },
      {
        name: "cdn_propagation_delay",
        delay: ms(5),
        actions: [
          (env) => {
            env.sslRenewed = true
            env.sslPropagating = true
            log(env, "[ssl] new certificate issued — propagating to CDN edge nodes")
            log(env, "[cdn] certificate update: 3/47 edge nodes updated")
            log(env, "[ssl] full propagation ETA: 15 minutes")
          },
        ],
      },
    ],
  },
]

// ----------------------------------------------------------
// STORAGE INCIDENTS (5)
// ----------------------------------------------------------

export const STORAGE_INCIDENTS: Incident[] = [
  {
    id: "raid_degraded",
    category: "storage",
    difficulty: "medium",
    rootCauses: [
      "Disk 3 in RAID-5 array failed with unrecoverable read errors",
      "Hot spare rebuild not triggered — no hot spare configured",
    ],
    layers: ["storage", "hardware"],
    description:
      "RAID-5 array degraded after disk failure. No hot spare. Rebuild not started. Array at risk of total data loss if another disk fails.",
    stages: [
      {
        name: "disk_failure",
        delay: ms(3),
        actions: [
          (env) => {
            if (!env.storage) env.storage = {}
            if (!env.storage.raid) env.storage.raid = {}
            env.storage.raid.status = "degraded"
            env.storage.raid.failedDisk = 3
            log(env, "[storage] RAID-5: Disk 3 (/dev/sdd) FAILED")
            log(env, "[storage] Array operating in DEGRADED mode")
          },
        ],
      },
      {
        name: "performance_impact",
        delay: ms(5),
        actions: [
          (env) => {
            env.storage.ioLatency = 45
            env.storage.raid.readPerformance = "degraded"
            log(env, "[storage] read latency increased: 45ms (normal: 5ms)")
            log(env, "[storage] parity recalculations on every read")
          },
        ],
      },
      {
        name: "second_disk_warning",
        delay: ms(6),
        actions: [
          (env) => {
            env.storage.raid.disk2SmartWarning = true
            env.storage.ioLatency = 120
            log(env, "[storage] WARNING: Disk 2 SMART reports pending sectors: 8")
            log(env, "[storage] CRITICAL: Second disk failure would cause DATA LOSS")
          },
        ],
      },
      {
        name: "rebuild_attempt",
        delay: ms(5),
        actions: [
          (env) => {
            env.storage.raid.rebuildStarted = true
            env.storage.rebuildProgress = 12
            env.storage.ioLatency = 200
            log(env, "[storage] manual rebuild initiated — replacing /dev/sdd")
            log(env, "[storage] rebuild progress: 12% (estimated 8 hours remaining)")
            log(env, "[storage] I/O performance severely impacted during rebuild")
          },
        ],
      },
    ],
  },
  {
    id: "rebuild_stuck",
    category: "storage",
    difficulty: "hard",
    rootCauses: [
      "Rebuild I/O conflicting with production database workload",
      "Replacement disk has bad sectors causing rebuild retries",
    ],
    layers: ["storage", "hardware"],
    description:
      "RAID rebuild stuck at 67% due to bad sectors on replacement disk. Rebuild retries failing. Array remains degraded.",
    stages: [
      {
        name: "rebuild_in_progress",
        delay: ms(4),
        actions: [
          (env) => {
            if (!env.storage) env.storage = {}
            if (!env.storage.raid) env.storage.raid = {}
            env.storage.raid.status = "rebuilding"
            env.storage.rebuildProgress = 67
            log(env, "[storage] RAID rebuild: 67% complete")
            log(env, "[storage] rebuild rate: 15MB/s (expected: 80MB/s)")
          },
        ],
      },
      {
        name: "bad_sector_error",
        delay: ms(5),
        actions: [
          (env) => {
            env.storage.rebuildStuck = true
            env.storage.rebuildErrors = 3
            log(env, "[storage] rebuild ERROR: unreadable sector at LBA 48291047")
            log(env, "[storage] rebuild retrying — 3 retries exhausted")
            log(env, "[storage] rebuild STUCK at 67%")
          },
        ],
      },
      {
        name: "io_contention",
        delay: ms(5),
        actions: [
          (env) => {
            env.storage.ioLatency = 500
            env.storage.rebuildPaused = true
            log(env, "[storage] rebuild paused due to I/O contention")
            log(env, "[storage] database I/O latency: 500ms (SLA: 10ms)")
          },
        ],
      },
      {
        name: "manual_intervention",
        delay: ms(6),
        actions: [
          (env) => {
            env.storage.rebuildPaused = true
            env.storage.needNewDisk = true
            log(env, "[storage] manual intervention required — replacement disk has defects")
            log(env, "[storage] recommended: use different replacement disk")
          },
        ],
      },
    ],
  },
  {
    id: "io_spike",
    category: "storage",
    difficulty: "hard",
    rootCauses: [
      "Scheduled backup job overlapping with peak production hours",
      "Log rotation triggering massive write burst",
    ],
    layers: ["storage", "application"],
    description:
      "Disk I/O latency spikes to 2000ms+ during backup window. All storage-dependent services experience severe slowdowns.",
    stages: [
      {
        name: "backup_start",
        delay: ms(3),
        actions: [
          (env) => {
            if (!env.storage) env.storage = {}
            env.storage.ioLatency = 25
            env.storage.iops = 5000
            log(env, "[storage] backup job started: /mnt/data -> /mnt/backup")
            log(env, "[storage] write I/O increasing")
          },
        ],
      },
      {
        name: "io_saturation",
        delay: ms(5),
        actions: [
          (env) => {
            env.storage.ioLatency = 800
            env.storage.iops = 25000
            env.storage.utilization = 98
            log(env, "[storage] disk utilization: 98%")
            log(env, "[storage] I/O latency: 800ms")
            log(env, "[storage] IOPS: 25000 (max: 28000)")
          },
        ],
      },
      {
        name: "io_spike",
        delay: ms(6),
        actions: [
          (env) => {
            env.storage.ioLatency = 2500
            env.storage.iops = 28000
            env.storage.utilization = 100
            if (env.db) env.db.lag = (env.db.lag || 0) + 3000
            log(env, "[storage] I/O SATURATION — latency: 2500ms")
            log(env, "[storage] disk queue depth: 128 (max)")
            if (env.services) env.services.mysql.status = "degraded"
          },
        ],
      },
      {
        name: "service_timeouts",
        delay: ms(5),
        actions: [
          (env) => {
            env.storage.ioLatency = 3000
            env.storage.timeoutErrors = 45
            log(env, "[db] I/O timeout: 45 operations exceeded 10s limit")
            log(env, "[app] request timeouts correlating with storage I/O spike")
          },
        ],
      },
    ],
  },
  {
    id: "disk_corruption",
    category: "storage",
    difficulty: "expert",
    rootCauses: [
      "Power failure during write caused filesystem metadata corruption",
      "Failing disk controller writing garbage data to disk",
    ],
    layers: ["storage", "hardware", "filesystem"],
    description:
      "Filesystem corruption detected on data volume. dmesg shows EXT4-fs error. Some files unreadable. Risk of total volume failure.",
    stages: [
      {
        name: "fs_errors",
        delay: ms(4),
        actions: [
          (env) => {
            if (!env.storage) env.storage = {}
            env.storage.fsErrors = 5
            log(env, "[kernel] EXT4-fs error (device sda1): ext4_lookup: deleted inode referenced")
            log(env, "[kernel] EXT4-fs (sda1): warning: maximal mount count reached")
          },
        ],
      },
      {
        name: "corruption_spread",
        delay: ms(6),
        actions: [
          (env) => {
            env.storage.fsErrors = 47
            env.storage.corrupted = true
            env.storage.corruptedFiles = 12
            log(env, "[kernel] EXT4-fs error: 47 errors in last 60 seconds")
            log(env, "[storage] 12 files reported as corrupted/unreadable")
            log(env, "[storage] directory entry corruption in /var/data/users/")
          },
        ],
      },
      {
        name: "remount_readonly",
        delay: ms(5),
        actions: [
          (env) => {
            env.storage.filesystemReadonly = true
            env.storage.corrupted = true
            log(env, "[kernel] EXT4-fs (sda1): Remounting filesystem read-only")
            log(env, "[storage] filesystem remounted read-only due to corruption")
            log(env, "[app] write operations failing: Read-only file system")
          },
        ],
      },
      {
        name: "fsck_required",
        delay: ms(5),
        actions: [
          (env) => {
            env.storage.needsFsck = true
            env.storage.unmountRequired = true
            log(env, "[storage] manual fsck required — unmount needed")
            log(env, "[storage] WARNING: service downtime required for repair")
            log(env, "[storage] estimated fsck duration: 45 minutes")
          },
        ],
      },
    ],
  },
  {
    id: "filesystem_readonly",
    category: "storage",
    difficulty: "medium",
    rootCauses: [
      "Kernel detected storage errors and remounted root filesystem as read-only",
      "Inode table corruption triggered emergency remount",
    ],
    layers: ["storage", "os"],
    description:
      "Root filesystem remounted read-only by kernel. System cannot write any files. Services crash on log rotation, temp file creation, and database writes.",
    stages: [
      {
        name: "kernel_detection",
        delay: ms(3),
        actions: [
          (env) => {
            if (!env.storage) env.storage = {}
            log(env, "[kernel] EXT4-fs error (device sda1): htree_dirblock_to_tree")
            log(env, "[kernel] Aborting journal on device sda1-8")
          },
        ],
      },
      {
        name: "readonly_remount",
        delay: ms(5),
        actions: [
          (env) => {
            env.storage.filesystemReadonly = true
            log(env, "[kernel] EXT4-fs (sda1): Remounting filesystem read-only")
            log(env, "[storage] / remounted as read-only")
          },
        ],
      },
      {
        name: "service_failures",
        delay: ms(6),
        actions: [
          (env) => {
            env.storage.writeFailures = 80
            if (env.services) env.services.mysql.status = "down"
            log(env, "[app] cannot write to /tmp: Read-only file system")
            log(env, "[app] log rotation failed: Read-only file system")
            log(env, "[db] InnoDB: cannot create new redo log file")
          },
        ],
      },
      {
        name: "cascading_crashes",
        delay: ms(5),
        actions: [
          (env) => {
            env.storage.writeFailures = 200
            env.crashedServices = ["mysql", "redis", "app-backend"]
            log(env, "[systemd] mysql.service: Main process exited, code=exited, status=1/FAILURE")
            log(env, "[systemd] redis.service: Failed to create journal file")
            log(env, "[systemd] app-backend.service: Cannot write PID file")
          },
        ],
      },
    ],
  },
]

// ----------------------------------------------------------
// AUTH INCIDENTS (5)
// ----------------------------------------------------------

export const AUTH_INCIDENTS: Incident[] = [
  {
    id: "ldap_timeout",
    category: "auth",
    difficulty: "medium",
    rootCauses: [
      "LDAP server overloaded by authentication storm after password policy change",
      "Network latency between app servers and LDAP directory",
    ],
    layers: ["authentication", "network"],
    description:
      "LDAP authentication requests timing out after 30s. Users cannot log in. SSH access blocked for all employees.",
    stages: [
      {
        name: "ldap_latency",
        delay: ms(4),
        actions: [
          (env) => {
            if (!env.auth) env.auth = {}
            env.auth.ldapLatencyMs = 5000
            log(env, "[ldap] bind request to ldap://dc01:389 taking 5000ms")
            log(env, "[auth] authentication requests queuing")
          },
        ],
      },
      {
        name: "ldap_timeout",
        delay: ms(5),
        actions: [
          (env) => {
            env.auth.ldapLatencyMs = 30000
            env.auth.ldapTimeout = true
            env.auth.authFailures = 45
            log(env, "[ldap] BIND timeout: Operation timed out (30s)")
            log(env, "[auth] 45 authentication requests timed out")
            log(env, "[ssh] SSH login failing — LDAP unreachable")
          },
        ],
      },
      {
        name: "ldap_server_down",
        delay: ms(6),
        actions: [
          (env) => {
            env.auth.ldapDown = true
            env.auth.authFailures = 200
            log(env, "[ldap] ldap://dc01:389 — connection refused")
            log(env, "[ldap] ldap://dc02:389 — connection refused")
            log(env, "[auth] ALL LDAP servers unreachable")
            if (env.services) env.services.auth.status = "down"
          },
        ],
      },
      {
        name: "fallback_exhausted",
        delay: ms(5),
        actions: [
          (env) => {
            env.auth.fallbackExhausted = true
            env.auth.localAuthDisabled = true
            log(env, "[auth] local auth fallback also unavailable")
            log(env, "[auth] NO authentication methods available")
            log(env, "[incident] ALL user access blocked")
          },
        ],
      },
    ],
  },
  {
    id: "permission_bug",
    category: "auth",
    difficulty: "hard",
    rootCauses: [
      "RBAC policy update incorrectly granted admin role to all users",
      "Group membership sync bug — everyone added to 'super-admins' group",
    ],
    layers: ["authentication", "authorization", "application"],
    description:
      "Permission escalation bug grants elevated access to all users. Regular users can access admin endpoints and modify system settings.",
    stages: [
      {
        name: "policy_change",
        delay: ms(3),
        actions: [
          (env) => {
            if (!env.auth) env.auth = {}
            env.auth.permissionChange = "rbac_update"
            log(env, "[auth] RBAC policy update deployed v2.3.1")
            log(env, "[auth] new group mapping: 'all-users' -> 'admin' (UNEXPECTED)")
          },
        ],
      },
      {
        name: "escalation_detected",
        delay: ms(5),
        actions: [
          (env) => {
            env.auth.privilegeEscalation = true
            env.auth.adminAccessAll = true
            log(env, "[security] WARNING: all users have admin role")
            log(env, "[security] non-admin user accessed /admin/settings")
            log(env, "[security] 23 unauthorized admin actions in last 5 minutes")
          },
        ],
      },
      {
        name: "config_changes",
        delay: ms(6),
        actions: [
          (env) => {
            env.auth.unauthorizedChanges = 8
            env.auth.configTampered = true
            log(env, "[security] system configuration modified by non-admin users")
            log(env, "[security] 8 unauthorized configuration changes detected")
            log(env, "[security] feature flags, rate limits, and user policies altered")
          },
        ],
      },
      {
        name: "emergency_lockdown",
        delay: ms(5),
        actions: [
          (env) => {
            env.auth.emergencyLockdown = true
            env.auth.allAccessRevoked = true
            log(env, "[security] EMERGENCY LOCKDOWN — all sessions invalidated")
            log(env, "[security] RBAC reverted to pre-deployment snapshot")
            log(env, "[auth] ALL users logged out — re-authentication required")
          },
        ],
      },
    ],
  },
  {
    id: "token_expiry",
    category: "auth",
    difficulty: "medium",
    rootCauses: [
      "JWT signing key rotated but old key not honored during grace period",
      "Token expiry set to 1 hour but refresh token endpoint broken",
    ],
    layers: ["authentication", "application"],
    description:
      "All JWT tokens simultaneously expire due to signing key rotation. Refresh token endpoint fails. 100% of users logged out.",
    stages: [
      {
        name: "key_rotation",
        delay: ms(3),
        actions: [
          (env) => {
            if (!env.auth) env.auth = {}
            env.auth.keyRotated = true
            log(env, "[auth] JWT signing key rotated — new key ID: kid-2026-04-12")
            log(env, "[auth] old key grace period: DISABLED (misconfiguration)")
          },
        ],
      },
      {
        name: "mass_invalid",
        delay: ms(5),
        actions: [
          (env) => {
            env.auth.tokensExpired = true
            env.auth.invalidTokenCount = 15000
            log(env, "[auth] 15,000 tokens invalidated — signed with old key")
            log(env, "[auth] all API requests returning 401 Unauthorized")
            if (env.services) env.services.api.status = "degraded"
          },
        ],
      },
      {
        name: "refresh_broken",
        delay: ms(6),
        actions: [
          (env) => {
            env.auth.refreshEndpointBroken = true
            env.auth.refreshErrors = 3000
            log(env, "[auth] refresh token endpoint returning 500")
            log(env, "[auth] 3,000 refresh attempts failed")
            log(env, "[app] users seeing 'Session Expired' — cannot re-authenticate")
          },
        ],
      },
      {
        name: "service_degradation",
        delay: ms(5),
        actions: [
          (env) => {
            env.auth.refreshErrors = 8000
            env.http401Rate = 95
            log(env, "[app] 95% of requests returning 401")
            log(env, "[app] mobile app crash loop: auto-login failing")
            log(env, "[auth] emergency: rolling back key rotation")
          },
        ],
      },
    ],
  },
  {
    id: "sudo_misconfig",
    category: "auth",
    difficulty: "hard",
    rootCauses: [
      "sudoers file syntax error after automated config management run",
      "ALL=(ALL) NOPASSWD rule accidentally applied to non-admin group",
    ],
    layers: ["authentication", "os", "configuration"],
    description:
      "sudo configuration broken due to syntax error. Admins cannot use sudo. Simultaneously, a misconfigured rule grants passwordless root to a service account.",
    stages: [
      {
        name: "config_change",
        delay: ms(3),
        actions: [
          (env) => {
            if (!env.auth) env.auth = {}
            env.auth.sudoBroken = true
            log(env, "[auth] sudoers file modified by Ansible run")
            log(env, "[auth] sudo: parse error in /etc/sudoers.d/custom near line 15")
          },
        ],
      },
      {
        name: "admin_locked",
        delay: ms(5),
        actions: [
          (env) => {
            env.auth.sudoBroken = true
            env.auth.adminSudoFails = true
            log(env, "[auth] sudo: unable to parse /etc/sudoers — ALL sudo denied")
            log(env, "[ops] admins cannot escalate — emergency response blocked")
          },
        ],
      },
      {
        name: "privilege_escalation",
        delay: ms(6),
        actions: [
          (env) => {
            env.auth.sudoMisconfigured = true
            env.auth.serviceAccountRoot = true
            log(env, "[security] ALERT: svc-deploy has NOPASSWD: ALL")
            log(env, "[security] service account can execute any command as root")
            if (env.services) env.services.auth.status = "degraded"
          },
        ],
      },
      {
        name: "manual_fix_required",
        delay: ms(5),
        actions: [
          (env) => {
            env.auth.needsManualFix = true
            env.auth.visudoRequired = true
            log(env, "[ops] need physical/console access to fix sudoers")
            log(env, "[ops] visudo required — cannot fix remotely")
            log(env, "[incident] severity escalated to P1")
          },
        ],
      },
    ],
  },
  {
    id: "account_lockout",
    category: "auth",
    difficulty: "medium",
    rootCauses: [
      "Brute-force attack triggered account lockout for 500+ users",
      "Password sync script using old credentials causing lockout cascade",
    ],
    layers: ["authentication", "security"],
    description:
      "Mass account lockout after brute-force detection. 500+ user accounts locked. Legitimate users cannot access services.",
    stages: [
      {
        name: "brute_force_detected",
        delay: ms(3),
        actions: [
          (env) => {
            if (!env.auth) env.auth = {}
            env.auth.bruteForceDetected = true
            env.auth.failedLoginAttempts = 2500
            log(env, "[security] brute-force pattern detected from 203.0.113.50")
            log(env, "[security] 2,500 failed login attempts in 5 minutes")
          },
        ],
      },
      {
        name: "mass_lockout",
        delay: ms(5),
        actions: [
          (env) => {
            env.auth.locked = true
            env.auth.lockedAccounts = 520
            log(env, "[auth] 520 accounts locked due to failed login threshold")
            log(env, "[auth] lockout policy: 30 minute automatic lockout")
            if (env.services) env.services.auth.status = "degraded"
          },
        ],
      },
      {
        name: "legitimate_users_blocked",
        delay: ms(6),
        actions: [
          (env) => {
            env.auth.lockedAccounts = 680
            env.auth.supportTickets = 150
            log(env, "[support] 150 tickets opened — users cannot log in")
            log(env, "[auth] legitimate users affected — source IPs mixed")
            log(env, "[auth] password sync service also locked out (svc-sync account)")
          },
        ],
      },
      {
        name: "lockout_bypass_attempt",
        delay: ms(5),
        actions: [
          (env) => {
            env.auth.lockoutBypassEnabled = true
            env.auth.manualUnlockInProgress = true
            log(env, "[ops] emergency: enabling lockout bypass for VIP users")
            log(env, "[ops] manual unlock initiated for 680 accounts")
            log(env, "[ops] estimated unlock completion: 20 minutes")
          },
        ],
      },
    ],
  },
]

// ----------------------------------------------------------
// INFRA INCIDENTS (5)
// ----------------------------------------------------------

export const INFRA_INCIDENTS: Incident[] = [
  {
    id: "ntp_desync",
    category: "infra",
    difficulty: "hard",
    rootCauses: [
      "NTP server providing incorrect time (15 minutes fast)",
      "Firewall blocking NTP UDP port 123 to external stratum servers",
    ],
    layers: ["infrastructure", "network", "os"],
    description:
      "Server clocks desynchronized by up to 15 minutes. Token validation, distributed locks, and log correlation all fail due to time skew.",
    stages: [
      {
        name: "clock_drift",
        delay: ms(4),
        actions: [
          (env) => {
            if (!env.infra) env.infra = {}
            env.infra.timeSkewMs = 2000
            log(env, "[ntp] clock offset: +2000ms on server-01")
            log(env, "[ntp] NTP stratum server unreachable")
          },
        ],
      },
      {
        name: "significant_skew",
        delay: ms(5),
        actions: [
          (env) => {
            env.infra.timeSkewMs = 15000
            env.infra.ntpUnreachable = true
            log(env, "[ntp] clock offset: +15000ms — CRITICAL")
            log(env, "[auth] JWT token validation failing — issuer time in future")
            log(env, "[db] binlog timestamp mismatch between primary and replica")
          },
        ],
      },
      {
        name: "distributed_systems_impact",
        delay: ms(6),
        actions: [
          (env) => {
            env.infra.distributedLocksBroken = true
            env.infra.logCorrelationImpossible = true
            if (env.services) env.services.consensus.status = "broken"
            log(env, "[consensus] Raft election timeout — clock skew too high")
            log(env, "[locks] distributed lock lease validation unreliable")
            log(env, "[observability] cannot correlate events across servers")
          },
        ],
      },
      {
        name: "ntp_recovery",
        delay: ms(5),
        actions: [
          (env) => {
            env.infra.ntpRecoveryInProgress = true
            env.infra.slewing = true
            log(env, "[ntp] switching to backup NTP pool: pool.ntp.org")
            log(env, "[ntp] slewing clock — adjusting at 500ppm")
            log(env, "[ntp] estimated resync time: 30 minutes")
          },
        ],
      },
    ],
  },
  {
    id: "log_flood",
    category: "infra",
    difficulty: "medium",
    rootCauses: [
      "Debug logging accidentally enabled in production deployment",
      "Application error loop generating 10,000 log lines/second",
    ],
    layers: ["infrastructure", "application", "storage"],
    description:
      "Log flood at 10K lines/sec filling disk and overwhelming log aggregation. Monitoring alerts drowned in noise. Disk filling at 2GB/minute.",
    stages: [
      {
        name: "logging_increase",
        delay: ms(3),
        actions: [
          (env) => {
            if (!env.infra) env.infra = {}
            env.infra.logRate = 1000
            env.infra.logLevel = "debug"
            log(env, "[app] log level changed: info -> DEBUG")
            log(env, "[app] verbose logging enabled for all modules")
          },
        ],
      },
      {
        name: "log_flood",
        delay: ms(5),
        actions: [
          (env) => {
            env.infra.logRate = 10000
            env.infra.diskFillRateGBMin = 2
            env.infra.logAggregatorOverwhelmed = true
            log(env, "[infra] log rate: 10,000 lines/sec")
            log(env, "[infra] disk fill rate: 2GB/minute")
            log(env, "[infra] log aggregator buffer full — dropping entries")
          },
        ],
      },
      {
        name: "disk_pressure",
        delay: ms(6),
        actions: [
          (env) => {
            env.infra.logDiskUsage = 95
            env.infra.logAggregatorDropping = true
            if (!env.storage) env.storage = {}
            env.storage.usagePct = 95
            log(env, "[storage] /var/log at 95% — 5GB remaining")
            log(env, "[infra] log aggregation dropping 60% of entries")
            log(env, "[monitoring] alert noise: 500 alerts/minute — unusable")
          },
        ],
      },
      {
        name: "emergency_log_rotation",
        delay: ms(5),
        actions: [
          (env) => {
            env.infra.logRotationForced = true
            env.infra.logTruncated = true
            log(env, "[ops] emergency log rotation and truncation")
            log(env, "[ops] /var/log/app/*.log truncated")
            log(env, "[app] log level reset: DEBUG -> ERROR")
          },
        ],
      },
    ],
  },
  {
    id: "oom_killer",
    category: "infra",
    difficulty: "hard",
    rootCauses: [
      "Memory cgroup limit too low for production workload",
      "Memory leak in sidecar container consuming node memory",
    ],
    layers: ["infrastructure", "os", "application"],
    description:
      "Linux OOM killer activating randomly, killing critical processes. System memory at 100%. Swap thrashing causing extreme latency.",
    stages: [
      {
        name: "memory_pressure",
        delay: ms(4),
        actions: [
          (env) => {
            env.memory = 88
            env.swapUsage = 60
            log(env, "[kernel] memory pressure: 88% used")
            log(env, "[kernel] swap usage increasing: 60%")
          },
        ],
      },
      {
        name: "swap_thrashing",
        delay: ms(5),
        actions: [
          (env) => {
            env.memory = 96
            env.swapUsage = 95
            env.cpu = 85
            log(env, "[kernel] swap thrashing detected")
            log(env, "[kernel] kswapd0 consuming 45% CPU")
            log(env, "[system] system responsiveness degraded")
          },
        ],
      },
      {
        name: "oom_kill",
        delay: ms(6),
        actions: [
          (env) => {
            env.memory = 100
            env.oomKilled = true
            env.oomKilledProcess = "mysql"
            env.oomKilledPID = 4521
            log(env, "[kernel] Out of memory: Killed process 4521 (mysqld)")
            log(env, "[kernel] mysqld invoked oom-killer: gfp_mask=0x6200ca")
            if (env.services) env.services.mysql.status = "down"
          },
        ],
      },
      {
        name: "cascade_kills",
        delay: ms(5),
        actions: [
          (env) => {
            env.oomKillCount = 4
            env.oomKilledProcesses = ["mysqld", "redis-server", "node", "nginx"]
            log(env, "[kernel] OOM killer killed 4 processes in 2 minutes")
            log(env, "[system] critical services down: mysql, redis, app, nginx")
            log(env, "[incident] full service outage — node unrecoverable")
          },
        ],
      },
    ],
  },
  {
    id: "zombie_processes",
    category: "infra",
    difficulty: "hard",
    rootCauses: [
      "Parent process not reaping child processes — PID table filling up",
      "Cron job spawning processes that exit but are never waited on",
    ],
    layers: ["infrastructure", "os"],
    description:
      "Zombie processes accumulating. PID table approaching max (65536). System cannot create new processes. All service management fails.",
    stages: [
      {
        name: "zombie_accumulation",
        delay: ms(4),
        actions: [
          (env) => {
            if (!env.infra) env.infra = {}
            env.infra.zombieCount = 5000
            env.infra.totalProcesses = 5500
            log(env, "[os] zombie processes: 5,000")
            log(env, "[os] parent PID 1234 not reaping children")
          },
        ],
      },
      {
        name: "pid_exhaustion_warning",
        delay: ms(5),
        actions: [
          (env) => {
            env.infra.zombieCount = 20000
            env.infra.totalProcesses = 21000
            env.infra.pidMax = 65536
            log(env, "[os] WARNING: 20,000 zombie processes")
            log(env, "[os] PID usage: 21,000/65,536 (32%)")
            log(env, "[os] new process creation slowing")
          },
        ],
      },
      {
        name: "pid_exhaustion",
        delay: ms(6),
        actions: [
          (env) => {
            env.infra.zombieCount = 55000
            env.infra.totalProcesses = 58000
            env.infra.cannotFork = true
            log(env, "[os] CRITICAL: 55,000 zombie processes")
            log(env, "[os] fork() failing: Resource temporarily unavailable")
            log(env, "[systemd] cannot start new services")
            log(env, "[cron] cron jobs failing — cannot fork")
          },
        ],
      },
      {
        name: "system_unresponsive",
        delay: ms(5),
        actions: [
          (env) => {
            env.infra.zombieCount = 64000
            env.infra.systemUnresponsive = true
            log(env, "[os] PID table 98% full — system nearly unusable")
            log(env, "[os] SSH cannot fork new sessions")
            log(env, "[incident] node requires reboot to clear zombie processes")
          },
        ],
      },
    ],
  },
  {
    id: "kernel_panic",
    category: "infra",
    difficulty: "expert",
    rootCauses: [
      "Kernel module bug in network driver causing NULL pointer dereference",
      "Hardware memory error (ECC uncorrectable) triggering panic",
    ],
    layers: ["infrastructure", "os", "hardware"],
    description:
      "Kernel panic on production server. System completely unresponsive. Crash dump being written. Requires manual reboot and hardware diagnostics.",
    stages: [
      {
        name: "kernel_warnings",
        delay: ms(3),
        actions: [
          (env) => {
            if (!env.infra) env.infra = {}
            log(env, "[kernel] WARNING: possible circular locking dependency detected")
            log(env, "[kernel] ixgbe 0000:01:00.0: TX hang on queue 3")
          },
        ],
      },
      {
        name: "oops",
        delay: ms(5),
        actions: [
          (env) => {
            env.infra.kernelOops = true
            log(env, "[kernel] BUG: unable to handle kernel NULL pointer dereference")
            log(env, "[kernel] IP: [<ffffffffa0042156>] ixgbe_xmit_frame+0x126/0x780")
            log(env, "[kernel] Oops: 0002 [#1] SMP")
          },
        ],
      },
      {
        name: "kernel_panic",
        delay: ms(6),
        actions: [
          (env) => {
            env.infra.kernelPanic = true
            env.infra.systemHalted = true
            log(env, "[kernel] Kernel panic — not syncing: Fatal exception")
            log(env, "[kernel] CPU: 2 PID: 0 Comm: swapper/2 Tainted: G")
            log(env, "[kernel] System completely halted")
          },
        ],
      },
      {
        name: "kdump_and_recovery",
        delay: ms(8),
        actions: [
          (env) => {
            env.infra.kdumpInProgress = true
            env.infra.needsManualReboot = true
            if (env.services) {
              Object.keys(env.services).forEach((k) => {
                env.services[k].status = "down"
              })
            }
            log(env, "[kdump] capturing crash dump — 4GB vmcore")
            log(env, "[kdump] crash dump complete")
            log(env, "[ops] manual reboot required — node unreachable")
            log(env, "[ops] all services on this node: DOWN")
          },
        ],
      },
    ],
  },
]

// ----------------------------------------------------------
// Combined exports
// ----------------------------------------------------------

export const ALL_INCIDENTS: Incident[] = [
  ...NETWORK_INCIDENTS,
  ...DB_INCIDENTS,
  ...APP_INCIDENTS,
  ...STORAGE_INCIDENTS,
  ...AUTH_INCIDENTS,
  ...INFRA_INCIDENTS,
]

export function getIncidentsByCategory(
  category: Incident["category"]
): Incident[] {
  return ALL_INCIDENTS.filter((i) => i.category === category)
}

export function getIncidentsByDifficulty(
  difficulty: Incident["difficulty"]
): Incident[] {
  return ALL_INCIDENTS.filter((i) => i.difficulty === difficulty)
}

export function getIncidentById(id: string): Incident | undefined {
  return ALL_INCIDENTS.find((i) => i.id === id)
}
