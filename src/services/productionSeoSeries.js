const PRODUCTION_SEO_SERIES_START_UTC = "2026-05-09T18:00:00.000Z";

const PRODUCTION_SEO_SERIES_ARTICLES = [
  {
    slug: "pm2-crash-loop-nodejs",
    title: "PM2 Crash Loop: Why Your Node.js App Keeps Restarting (And How to Fix It Fast)",
    excerpt: "PM2 keeps restarting your Node.js app every few seconds? Learn how to diagnose crash loops, read PM2 logs correctly, and fix the most common production errors fast.",
    tags: ["pm2", "nodejs", "production"],
    content: [
      "Your PM2 process keeps restarting every few seconds. A deploy finishes, PM2 shows the app online for a moment, then the process crashes and immediately restarts. It looks dramatic, but most crash loops come from a small set of repeat offenders: syntax errors, missing environment variables, port conflicts, duplicate server listeners, broken build artifacts, or dependency drift after deployment.",
      "The first move is not another restart. Read the logs and find the first real error. `pm2 logs api --lines 100 --err` is usually enough to tell you whether the failure happens during startup, module resolution, port binding, or early runtime execution. That distinction changes the whole debugging path.",
      "If you see `EADDRINUSE`, check which process still owns the port and kill the stale listener before restarting PM2. If you see `Cannot find module`, your deploy probably pulled code without installing the new dependencies. If the log shows `SyntaxError: Invalid or unexpected token`, do not assume the codebase is fine just because local development worked. A copied character, smart quote, or hidden Unicode glyph can be enough to crash production immediately.",
      "Another common cause is duplicated `app.listen(...)` calls across multiple entry points. Search the repo, identify the real runtime file, and make sure only one listener exists. On stacks that mix older scripts, alternate servers, or PM2 ecosystem configs, this is more common than people expect.",
      "A safe restart workflow is simple: `git pull`, `npm install` or `npm ci`, `npm run build` when needed, `pm2 restart api`, then check the logs again and verify the health endpoint. The key is to debug from evidence, not from the PM2 restart noise. Most crash loops are repetitive failures with clear signatures once you stop panicking and read the first real error.",
    ].join("\n\n"),
  },
  {
    slug: "css-not-loading-production-react-nginx",
    title: "CSS Not Loading in Production? Here's the Real Reason It Happens",
    excerpt: "CSS missing in production after deploying React or Vite? Learn how to diagnose MIME type issues, broken Nginx configs, Cloudflare cache problems, and missing build files.",
    tags: ["react", "nginx", "vite"],
    content: [
      "The site looks completely broken after deploy: no styling, no layout, plain HTML, broken fonts, and browser console errors that point to rejected stylesheets. In many React and Vite deployments, the CSS bundle exists, but Nginx is serving `index.html` instead of the real stylesheet file.",
      "Start in the browser network tab and inspect the CSS request directly. Then verify the response with `curl -I https://example.com/assets/index-xxxx.css`. A working response returns `content-type: text/css`. If you get `text/html`, the file is missing and your server is falling back to the SPA entry page. The browser rejects the response because HTML is not CSS.",
      "The usual fixes are straightforward. Rebuild the frontend with `npm run build` and confirm the generated CSS file exists under `dist/assets`. Then verify the Nginx root points to the actual build output directory, usually `/var/www/app/dist`, not the project root. If the root is wrong, Nginx cannot resolve the generated asset files and silently serves the fallback page instead.",
      "Cloudflare can make this look worse by caching old HTML, stale 404 responses, or outdated asset references. That is why a deployment can look broken for some users even after the origin server is fixed. In emergency cases, purge the cache and retest with a hard refresh or an incognito session.",
      "The pattern is consistent: missing builds, wrong static root, stale cache, or incorrect asset paths. The way out is also consistent. Check the requested CSS URL, verify its MIME type, confirm the file exists on disk, validate the Nginx root, and only then blame the frontend framework.",
    ].join("\n\n"),
  },
  {
    slug: "nginx-reverse-proxy-react-spa",
    title: "Nginx Reverse Proxy for React SPA: The Setup Most Deploy Guides Get Wrong",
    excerpt: "Learn how to configure Nginx correctly for a React SPA with a Node.js backend. Fix 404 refresh errors, proxy API requests, and serve static assets properly.",
    tags: ["nginx", "react", "spa"],
    content: [
      "A React app works until someone refreshes a deep route like `/dashboard`. Suddenly Nginx returns `404 Not Found`. React did not break. Nginx was never told how client-side routing works in a single-page application.",
      "In a standard production setup, Nginx serves the frontend assets, Node.js handles API traffic, React owns the browser routes, and PM2 manages the backend process. The important detail is that routes such as `/settings/billing` are not real files on disk. Without a fallback, Nginx tries to find a physical file and returns 404.",
      "The core fix is the `try_files` directive: `try_files $uri $uri/ /index.html;`. That tells Nginx to serve the exact file when it exists and otherwise fall back to `index.html`, allowing React Router to take over. Pair that with a correct `root` that points to the Vite `dist` directory and a dedicated `/api/` proxy block for the backend.",
      "Common mistakes include pointing `root` to the repo root instead of the build output, omitting proxy headers so every request appears to come from localhost, or assuming a `502 Bad Gateway` is an Nginx issue when the actual cause is a crashed PM2 process. When the proxy returns 502, inspect `pm2 list` and the backend error logs immediately.",
      "A reliable deployment flow is: update the code, install dependencies, build the frontend, restart or reload the backend, validate `nginx -t`, reload Nginx, and manually refresh deep routes such as `/dashboard`, `/settings`, and `/profile`. Most React production problems attributed to routing are really infrastructure mistakes at the reverse proxy layer.",
    ].join("\n\n"),
  },
  {
    slug: "cloudflare-cache-purge-after-deploy",
    title: "Cloudflare Cache Purge After Deploy: Why Users Still See Old Files",
    excerpt: "Deployed new frontend code but users still see the old version? Learn how Cloudflare caching works, when to purge cache, and how hashed assets solve most deployment issues.",
    tags: ["cloudflare", "caching", "deployment"],
    content: [
      "A deploy finishes successfully, the frontend is rebuilt, Nginx reloads cleanly, PM2 restarts the backend, and yet users still report the old interface, broken CSS, or stale JavaScript. The server may already be fixed. The cache layer can still be lying to the browser.",
      "Cloudflare sits between the browser and your origin server. It can serve a cached asset, a stale HTML file, or even an old 404 response without hitting your machine at all. That is why some users see the updated app while others remain stuck on broken responses from an edge location.",
      "The first thing to check is the response header: `curl -I https://example.com/assets/index-a81f2.js` and inspect `cf-cache-status`. A `HIT` when users still see the wrong code is a strong sign that Cloudflare is involved. This becomes especially painful when `index.html` is cached too aggressively and still references deleted asset hashes.",
      "The emergency fix is simple: purge the cache, even if that temporarily reduces efficiency. The long-term fix is better cache architecture. Hashed asset filenames can be cached aggressively, but `index.html` should usually be served with a no-cache policy so the browser and CDN keep validating the newest HTML shell.",
      "Cache bugs feel random until you understand the interaction between HTML freshness, hashed assets, browser caches, and CDN edge behavior. Once that model is clear, Cloudflare problems stop looking mysterious and start looking like predictable infrastructure behavior.",
    ].join("\n\n"),
  },
  {
    slug: "pm2-zero-downtime-deploy-reload-vs-restart",
    title: "Deploy Zero Downtime with PM2: Restart vs Reload Explained",
    excerpt: "Learn the real difference between PM2 restart and reload, how cluster mode works, and how to minimize downtime during Node.js deployments.",
    tags: ["pm2", "deployment", "nodejs"],
    content: [
      "A few seconds of downtime during deploy may sound harmless until users lose active requests, dashboards disconnect, payments fail, or monitoring lights up. The difference between `pm2 restart` and `pm2 reload` matters more than most guides admit.",
      "`pm2 restart api` stops the current process and then starts it again. During that gap, the API is unavailable and Nginx may briefly return 502 responses. For low-traffic personal projects that may be acceptable. For systems with live users, it becomes a real availability risk.",
      "`pm2 reload api` behaves differently, but only in cluster mode. PM2 starts new workers first, waits for them to come up, and only then drains the old ones. That approach minimizes visible downtime and keeps traffic flowing through the transition. On small multi-core servers, it is often the easiest path to near-zero-downtime deploys.",
      "Reload is not magic. If the new workers crash immediately because of a bad deploy, missing variables, or dependency errors, PM2 will not save you. That is why every reload should be followed by log inspection and a health check. Zero-downtime strategy still depends on healthy startup behavior.",
      "The right mental model is simple: `restart` is a hard bounce, `reload` is a rolling replacement. If you care about continuity, use cluster mode where it is safe for your stack, validate the deploy quickly, and keep restart-based deploys only for cases where brief downtime is acceptable.",
    ].join("\n\n"),
  },
  {
    slug: "npm-ci-vs-npm-install-production",
    title: "npm install vs npm ci: Which One Should You Use in Production?",
    excerpt: "Learn the real difference between npm install and npm ci, why CI/CD pipelines prefer npm ci, and how dependency consistency affects production deployments.",
    tags: ["npm", "ci-cd", "production"],
    content: [
      "A deployment that worked yesterday can break today even when the repository looks unchanged. One of the least obvious reasons is dependency drift caused by using `npm install` in environments that should be deterministic.",
      "`npm install` is flexible. It resolves version ranges, updates the lockfile when needed, and can change the dependency tree. That is useful during development, but it creates unpredictability in CI pipelines, Docker builds, and production servers where consistency matters more than convenience.",
      "`npm ci` does the opposite. It installs exactly what is locked in `package-lock.json`, refuses to proceed when the lockfile is out of sync, and avoids silent dependency recalculation. That strictness is the reason mature pipelines prefer it. Reproducibility is not a nice-to-have during deploys; it is one of the main defenses against mysterious runtime differences.",
      "The practical split is easy: use `npm install` while actively developing and changing dependencies, then use `npm ci` everywhere you need stable, repeatable installs. If `npm ci` fails, that is a useful signal that the lockfile and package manifest are drifting apart.",
      "Most production instability comes from hidden inconsistency. Moving deploys to `npm ci` removes one major source of randomness and makes it much easier to trust that local, CI, and production environments are actually running the same dependency graph.",
    ].join("\n\n"),
  },
  {
    slug: "react-blank-white-screen-after-deploy",
    title: "React App Blank White Screen After Deploy: Full Debugging Guide",
    excerpt: "React app showing a blank white page in production? Learn how to debug broken builds, missing assets, JavaScript crashes, and failed API initialization.",
    tags: ["react", "deployment", "frontend"],
    content: [
      "A blank white screen in production is one of the most unnerving frontend failures because the interface gives you almost no clue what actually broke. The server can look healthy, PM2 can stay online, Nginx can reload successfully, and the entire app can still fail before the first render.",
      "The first step is always the browser console. Errors such as `Unexpected token <`, `Cannot read properties of undefined`, or a failed startup fetch usually tell you whether the frontend crashed because JavaScript was served as HTML, a bundle is missing, or initialization logic blew up before rendering.",
      "Then confirm the built assets really exist. Check `dist/assets`, verify that the JavaScript and CSS files match what `index.html` references, and inspect their response headers with `curl -I`. If the browser expected JavaScript and got `text/html`, the problem is almost always missing build output or a bad Nginx path.",
      "Environment variables are another common cause. Vite variables must be prefixed correctly, and startup code that relies on them can fail instantly in production even when local development masked the issue. API initialization failures can also blank the app if the initial request path is broken or returns a fatal error the UI does not handle.",
      "Blank screens stop feeling random when you debug layer by layer: console, built assets, MIME types, environment variables, API reachability, then cache. The trick is not treating the white page itself as the error. It is only the symptom of an earlier failure.",
    ].join("\n\n"),
  },
  {
    slug: "vite-build-fails-in-ci",
    title: "Why Your Vite Build Works Locally But Fails in CI/CD",
    excerpt: "Learn why Vite builds succeed locally but fail in CI/CD pipelines. Fix dependency mismatches, environment variable issues, Node.js version conflicts, and memory errors.",
    tags: ["vite", "ci-cd", "frontend"],
    content: [
      "Everything worked locally, but CI fails the build. That pattern is common because local machines are forgiving and CI environments are strict. When Vite breaks only in the pipeline, the failure is usually not random. It is exposing a difference between environments that local development tolerated.",
      "Start by comparing Node.js versions across local, CI, Docker, and production. Build tools and dependencies can behave very differently across major versions. Then inspect environment variables. In Vite, frontend variables must start with `VITE_`, and missing prefixes often show up in CI before they become obvious locally.",
      "Dependency drift is another recurring cause, especially when pipelines use `npm install` instead of `npm ci`. Case sensitivity also matters. Imports that work on a case-insensitive workstation can fail on Linux runners if the file name casing does not match exactly.",
      "Large builds can also hit memory limits in CI. When the logs show heap exhaustion, increasing `NODE_OPTIONS=--max-old-space-size=4096` is often a practical short-term fix while you optimize bundle size or source map generation.",
      "The larger lesson is that CI is a different operating environment, not just a faster copy of your laptop. Once you systematically compare runtime versions, env vars, dependency installation mode, filesystem behavior, and memory limits, Vite pipeline failures become far easier to reason about.",
    ].join("\n\n"),
  },
  {
    slug: "nginx-404-not-found-react-production",
    title: "Nginx 404 Not Found: The 3 Causes I See Constantly in Production",
    excerpt: "Learn the most common causes of Nginx 404 errors in React and Node.js deployments, including broken root paths, missing builds, and SPA routing problems.",
    tags: ["nginx", "react", "production"],
    content: [
      "A server can be online, PM2 can be healthy, and every frontend route can still return `404 Not Found`. That usually feels catastrophic, but in practice most Nginx 404 incidents in React and Node.js deployments come from three repeatable causes.",
      "The first is the wrong `root` path. Vite serves production assets from `dist`, so if Nginx points to the repo root instead of the build output, the browser starts requesting files that do not exist. The second is an incomplete deployment where the code changed but `npm run build` never regenerated the newest assets.",
      "The third cause is missing SPA fallback routing. Refreshing a deep route like `/dashboard` fails unless the Nginx location block uses `try_files $uri $uri/ /index.html;`. Without that rule, Nginx tries to find a physical file for a client-side route and returns 404 every time.",
      "When debugging, keep it simple: validate the Nginx config, confirm the current `dist/assets` output on disk, inspect the HTTP response directly, and verify the backend process state separately. Mixing frontend, proxy, and backend assumptions too early just slows the investigation down.",
      "Nginx stops looking mysterious once you treat it as a file and routing layer with deterministic rules. Most 404 incidents are either bad paths, missing artifacts, or absent SPA fallback logic, and each one can be proven quickly from the filesystem and the config.",
    ].join("\n\n"),
  },
  {
    slug: "ssh-refusing-connections-linux",
    title: "SSH Refusing Connections? Here's the First Thing I Check on Linux Servers",
    excerpt: "Learn how to diagnose SSH connection failures on Linux servers using systemctl, journalctl, firewall-cmd, and real-world production troubleshooting techniques.",
    tags: ["linux", "ssh", "operations"],
    content: [
      "Few production problems raise stress faster than a sudden `Connection refused` when you try to SSH into a server. The mistake is jumping straight into guesses about the firewall, the network, or a full reboot without first verifying whether the SSH service is even alive.",
      "The first command should be `systemctl status sshd`. If the service is inactive, the problem space narrows immediately. From there, the next step is not panic or random trial and error. Start the service if needed, then inspect the logs with `journalctl -u sshd --since '10 minutes ago'` and look for concrete failure messages.",
      "If `sshd` is healthy but connections still fail, then it makes sense to inspect firewall rules and verify that port 22 is allowed. A clean troubleshooting sequence is service status, logs, firewall, listening port, then broader network assumptions. Reversing that order wastes time.",
      "Under pressure, even small command mistakes become common. That is another reason fixed diagnostic chains matter. Structured troubleshooting reduces the noise and gets you to the evidence faster.",
      "The real lesson is that Linux incidents become more manageable when you stop treating them emotionally. Verify state, read logs, check the actual service boundary, and only then escalate into network or policy debugging.",
    ].join("\n\n"),
  },
  {
    slug: "linux-high-load-average-troubleshooting",
    title: "Linux Server Running Slow? How to Tell CPU Problems from I/O Problems Fast",
    excerpt: "Learn how to diagnose high load average on Linux servers using vmstat, iotop, ps aux, and real production troubleshooting workflows.",
    tags: ["linux", "performance", "operations"],
    content: [
      "A high load average does not automatically mean the CPU is overloaded. That misunderstanding sends a lot of debugging in the wrong direction. A slow Linux server can be CPU-bound, I/O-bound, or under memory pressure, and load average alone does not tell you which one is true.",
      "The fastest first check is still `vmstat 1 3`. The `us`, `sy`, `wa`, and `id` columns tell you whether the machine is burning CPU or mostly waiting on disk. A high `wa` means I/O wait, not processor saturation. That single distinction can completely change what you inspect next.",
      "If the box is CPU-bound, sort processes by CPU usage and identify the offender. If the box is I/O-bound, switch focus to disk activity with tools such as `iotop` and look for database flushes, backup jobs, or logging storms. Memory pressure should also be checked with `free -h` so you do not miss swap behavior or starvation.",
      "One reason senior debugging looks faster is that it separates these bottleneck classes early instead of treating all slowness as one generic problem. The server may show a huge load number while the CPU itself is mostly idle and blocked on storage latency.",
      "Performance incidents stop feeling chaotic when you identify the constrained resource first. `vmstat`, `ps`, `iotop`, and memory checks are still enough to explain a large percentage of slow Linux server cases without overcomplicating the investigation.",
    ].join("\n\n"),
  },
];

function addUtcDays(isoString, dayOffset) {
  const startMs = new Date(isoString).getTime();
  return new Date(startMs + dayOffset * 24 * 60 * 60 * 1000).toISOString();
}

function buildProductionSeoSeriesSchedule(startUtc = PRODUCTION_SEO_SERIES_START_UTC) {
  return PRODUCTION_SEO_SERIES_ARTICLES.map((article, index) => ({
    ...article,
    status: "published",
    publishedAt: addUtcDays(startUtc, index),
  }));
}

export {
  PRODUCTION_SEO_SERIES_ARTICLES,
  PRODUCTION_SEO_SERIES_START_UTC,
  buildProductionSeoSeriesSchedule,
};
