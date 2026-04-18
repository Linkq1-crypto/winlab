/**
 * OpsPlaybook — Scenarios & Troubleshooting Matrix
 * Stack: Vite/React + Express + Nginx + PM2 + Cloudflare
 */

export const opsLabScenarios = [
  {
    id: "deploy-new-version",
    title: "Deploy New Version",
    objective: "Pull the latest code, rebuild the frontend, and restart the application with zero downtime using PM2.",
    checklist: [
      "SSH into the production server",
      "Pull latest changes from main branch",
      "Install any new dependencies",
      "Build the Vite frontend",
      "Restart the app with PM2",
      "Verify the process is running",
    ],
    runbook: [
      "ssh deploy@app.example.com",
      "cd /var/www/myapp",
      "git pull origin main",
      "npm install --omit=dev",
      "npm run build",
      "pm2 restart myapp",
      "pm2 status",
    ],
  },
  {
    id: "rollback-failed-deploy",
    title: "Rollback Failed Deploy",
    objective: "A deploy broke production. Roll back to the previous working commit and restart the service immediately.",
    checklist: [
      "Identify the last known good commit",
      "Hard reset to that commit",
      "Rebuild the frontend",
      "Restart PM2",
      "Confirm the rollback is live",
    ],
    runbook: [
      "git log --oneline -5",
      "git reset --hard HEAD~1",
      "npm run build",
      "pm2 restart myapp",
      "pm2 logs myapp --lines 20",
    ],
  },
  {
    id: "nginx-reload",
    title: "Nginx Config Reload",
    objective: "Update the Nginx reverse proxy config and reload it without dropping active connections.",
    checklist: [
      "Edit the Nginx site config",
      "Test the config syntax",
      "Reload Nginx (not restart — no downtime)",
      "Verify the new config is active",
    ],
    runbook: [
      "sudo nano /etc/nginx/sites-available/myapp",
      "sudo nginx -t",
      "sudo systemctl reload nginx",
      "curl -I https://app.example.com",
    ],
  },
  {
    id: "pm2-crash-recovery",
    title: "PM2 Process Crash Recovery",
    objective: "The Node.js app crashed and PM2 errored out. Diagnose, fix, and bring it back up.",
    checklist: [
      "Check PM2 process list for error status",
      "Read the crash logs",
      "Delete the crashed process entry",
      "Start fresh with the ecosystem file",
      "Save PM2 state so it survives reboots",
    ],
    runbook: [
      "pm2 list",
      "pm2 logs myapp --err --lines 50",
      "pm2 delete myapp",
      "pm2 start ecosystem.config.js",
      "pm2 save",
    ],
  },
  {
    id: "ssl-certificate-renewal",
    title: "SSL Certificate Renewal",
    objective: "The SSL certificate is expiring in 7 days. Renew it with Certbot and reload Nginx.",
    checklist: [
      "Check certificate expiry date",
      "Run Certbot renewal",
      "Verify the new cert is installed",
      "Reload Nginx to pick up the new cert",
      "Confirm HTTPS is working",
    ],
    runbook: [
      "sudo certbot certificates",
      "sudo certbot renew --dry-run",
      "sudo certbot renew",
      "sudo systemctl reload nginx",
      "curl -vI https://app.example.com 2>&1 | grep expire",
    ],
  },
  {
    id: "cloudflare-cache-purge",
    title: "Cloudflare Cache Purge",
    objective: "Users are seeing stale assets after a deploy. Purge the Cloudflare cache via the API.",
    checklist: [
      "Identify the Cloudflare Zone ID",
      "Call the purge everything API endpoint",
      "Verify assets are being served fresh",
    ],
    runbook: [
      "export CF_ZONE=your_zone_id",
      "export CF_TOKEN=your_api_token",
      'curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/purge_cache" -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" --data \'{"purge_everything":true}\'',
      "curl -I https://app.example.com/assets/index.js | grep cf-cache-status",
    ],
  },
  {
    id: "memory-leak-diagnosis",
    title: "Memory Leak Diagnosis",
    objective: "The Express app is consuming 2 GB of RAM and slowing down. Identify the leak and restart safely.",
    checklist: [
      "Check current memory usage with PM2",
      "Inspect OS-level memory stats",
      "Generate a heap snapshot",
      "Restart the process to restore service",
      "Set a memory limit in PM2 to auto-restart on threshold",
    ],
    runbook: [
      "pm2 monit",
      "free -h",
      "node --inspect server.js &",
      "pm2 restart myapp",
      "pm2 stop myapp",
      'pm2 start ecosystem.config.js --max-memory-restart 512M',
    ],
  },
  {
    id: "db-connection-failure",
    title: "Database Connection Failure",
    objective: "The app is returning 500 errors. The logs show database connection timeouts. Diagnose and restore connectivity.",
    checklist: [
      "Check app logs for the specific error",
      "Test database port is reachable",
      "Verify the DB service is running",
      "Check the .env connection string",
      "Restart the app after confirming DB is up",
    ],
    runbook: [
      "pm2 logs myapp --err --lines 30",
      "nc -zv db.example.com 5432",
      "sudo systemctl status postgresql",
      "cat /var/www/myapp/.env | grep DATABASE_URL",
      "pm2 restart myapp",
    ],
  },
  {
    id: "env-var-update",
    title: "Update Environment Variable in Production",
    objective: "A third-party API key has been rotated. Update the .env file and reload the app without a full redeploy.",
    checklist: [
      "SSH into the server",
      "Edit the .env file safely",
      "Confirm the new value is set",
      "Restart PM2 to pick up the change",
      "Tail logs to confirm no auth errors",
    ],
    runbook: [
      "ssh deploy@app.example.com",
      "cd /var/www/myapp",
      "nano .env",
      "grep API_KEY .env",
      "pm2 restart myapp",
      "pm2 logs myapp --lines 20",
    ],
  },
  {
    id: "disk-full-recovery",
    title: "Disk Full — Emergency Recovery",
    objective: "The server disk is at 100%. The app is failing to write logs and crashes on startup. Free up space fast.",
    checklist: [
      "Check disk usage by partition",
      "Find the largest directories",
      "Clear PM2 logs",
      "Remove old build artifacts",
      "Verify free space restored",
      "Restart the app",
    ],
    runbook: [
      "df -h",
      "du -sh /var/www/myapp/* | sort -rh | head -10",
      "pm2 flush",
      "rm -rf /var/www/myapp/dist_old",
      "df -h",
      "pm2 restart myapp",
    ],
  },
];

export const troubleshootingMatrix = [
  {
    symptom: "502 Bad Gateway from Nginx",
    cause: "Node.js / PM2 process is down or not listening on the expected port",
    fix: "Run `pm2 list` — if status is errored, check `pm2 logs` then `pm2 restart myapp`",
  },
  {
    symptom: "504 Gateway Timeout",
    cause: "App is running but responding too slowly — DB query, external API, or CPU spike",
    fix: "Check `pm2 monit` for CPU/RAM. Run `pm2 logs` to find the slow endpoint. Add a timeout or optimize the query.",
  },
  {
    symptom: "Assets returning 404 after deploy",
    cause: "Vite build not run — old `dist/` folder or missing build step",
    fix: "Run `npm run build` then `pm2 restart myapp`. Check Nginx root path points to `dist/`.",
  },
  {
    symptom: "CSS/JS served with wrong MIME type (text/html)",
    cause: "Nginx SPA fallback is intercepting static asset requests",
    fix: "Add `try_files $uri $uri/ =404` for `/assets/` location before the SPA catch-all in nginx config. Reload Nginx.",
  },
  {
    symptom: "App crashes on startup after git pull",
    cause: "New dependency not installed or breaking change in package.json",
    fix: "Run `npm install`. Check `pm2 logs myapp --err` for the exact module error.",
  },
  {
    symptom: "Cloudflare showing stale content after deploy",
    cause: "Cloudflare cache not purged — serving old assets from edge",
    fix: "Purge via Cloudflare dashboard or API. Add cache-busting headers or use Vite content hashing.",
  },
  {
    symptom: "SSL certificate error in browser",
    cause: "Cert expired or Nginx not reloaded after renewal",
    fix: "Run `sudo certbot renew` then `sudo systemctl reload nginx`. Verify with `curl -vI https://yourdomain.com`.",
  },
  {
    symptom: "PM2 process restarts in a loop",
    cause: "App crashes immediately on start — usually a missing .env var or port already in use",
    fix: "Run `pm2 logs myapp --err`. Check `.env` exists and all required vars are set. Check `lsof -i :3001` for port conflict.",
  },
  {
    symptom: "Environment variables not picked up",
    cause: "PM2 caching old env or .env file not reloaded",
    fix: "Run `pm2 restart myapp --update-env` or `pm2 delete myapp && pm2 start ecosystem.config.js`.",
  },
  {
    symptom: "High memory usage / OOM kill",
    cause: "Memory leak in Express routes, unclosed DB connections, or large in-memory caches",
    fix: "Set `--max-memory-restart 512M` in PM2. Profile with `node --inspect`. Check for missing `await` on DB queries.",
  },
  {
    symptom: "Database connection timeout",
    cause: "DB server down, wrong host/port in .env, or connection pool exhausted",
    fix: "Run `nc -zv db.host 5432`. Check `DATABASE_URL` in .env. Restart DB service. Increase pool size in Prisma/pg config.",
  },
  {
    symptom: "Disk full — app fails to start",
    cause: "Logs, old builds, or node_modules filling the disk",
    fix: "Run `df -h` and `du -sh /* | sort -rh`. Clear with `pm2 flush`, delete old `dist_*` folders, prune `node_modules`.",
  },
];
