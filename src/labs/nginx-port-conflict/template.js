export const nginxPortConflictTemplate = {
  id: "nginx-port-conflict",
  title: "Nginx Port Conflict",
  rootCauses: [
    {
      id: "duplicate_listener",
      description: "Two services are trying to bind the same public port.",
      mutations: [
        {
          file: "labs/nginx-port-conflict/nginx.conf",
          replace: ["listen 8080;", "listen 80;"],
          optional: true,
        },
      ],
      signals: [
        "bind() to 0.0.0.0:80 failed",
        "address already in use",
      ],
      verify: {
        mustContain: ["listener restored"],
      },
    },
    {
      id: "stale_process",
      description: "A stale worker process owns the target port after a bad restart.",
      mutations: [],
      signals: [
        "orphaned worker still bound to port",
        "healthcheck failed after restart",
      ],
      verify: {
        mustContain: ["stale process cleared"],
      },
    },
  ],
  baseLogs: [
    "nginx start requested",
    "public traffic unavailable",
    "edge healthcheck failing",
  ],
};

export default nginxPortConflictTemplate;
