export const apiTimeoutTemplate = {
  id: "api-timeout",
  title: "API Timeout",
  rootCauses: [
    {
      id: "upstream_slow",
      description: "Upstream service latency causes request timeouts.",
      mutations: [
        {
          file: "labs/memory-leak/index.js",
          replace: ["const REQUEST_DELAY_MS = 250;", "const REQUEST_DELAY_MS = 3200;"],
          optional: true,
        },
      ],
      signals: [
        "upstream timeout detected",
        "retry storm observed",
        "p95 latency: 3241ms",
      ],
      verify: {
        mustContain: ["timeout fixed", "latency < 500ms"],
      },
    },
    {
      id: "db_pool_exhausted",
      description: "Database connection pool exhaustion stalls request handling.",
      mutations: [
        {
          file: "labs/memory-leak/index.js",
          replace: ["const POOL_SIZE = 20;", "const POOL_SIZE = 2;"],
          optional: true,
        },
      ],
      signals: [
        "connection pool exhausted",
        "queue depth rising",
        "pending DB checkout timed out",
      ],
      verify: {
        mustContain: ["connections restored"],
      },
    },
    {
      id: "dns_resolution",
      description: "Service discovery points traffic at an invalid resolver.",
      mutations: [
        {
          file: "labs/memory-leak/resolver.conf",
          replace: ["nameserver 8.8.8.8", "nameserver 127.0.0.1"],
          optional: true,
        },
      ],
      signals: [
        "host not found",
        "dns lookup failed",
        "upstream address unresolved",
      ],
      verify: {
        mustContain: ["dns ok"],
      },
    },
  ],
  baseLogs: [
    "requests failing",
    "p95 latency high",
    "customer traffic impacted",
  ],
};

export default apiTimeoutTemplate;
