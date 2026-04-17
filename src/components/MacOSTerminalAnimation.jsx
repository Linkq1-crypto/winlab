/**
 * WinLab Premium macOS Terminal Animation
 * 
 * Apple-style terminal with:
 * - Traffic lights (red/yellow/green)
 * - Glassmorphism blur effect
 * - Smooth opening animation (easeOutExpo)
 * - WinLab brand preset
 * - Typing animation with cursor
 * - Success glow effects
 * 
 * Usage: Drop into landing page hero section
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Theme ────────────────────────────────────────────────────────────────────
const WINLAB_THEME = {
  bg: "#0a0a0a",
  panel: "#111111",
  header: "#1e1e1e",
  text: "#e5e7eb",
  sub: "#9ca3af",
  accent: "#3b82f6",
  success: "#22c55e",
  error: "#ef4444",
  warning: "#f59e0b",
};

// ─── Easing ───────────────────────────────────────────────────────────────────
function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// ─── Canvas Helpers ───────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r, fill = true, stroke = false) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// ─── Draw: macOS Window ───────────────────────────────────────────────────────
function drawMacWindow(ctx, x, y, w, h, radius = 14) {
  // Window shadow
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = WINLAB_THEME.panel;
  roundRect(ctx, x, y, w, h, radius, true, false);
  ctx.restore();

  // Window body (dark glass)
  ctx.fillStyle = "rgba(17, 17, 17, 0.95)";
  roundRect(ctx, x, y, w, h, radius, true, false);

  // Header bar
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + 42, radius);
  ctx.lineTo(x + w, y + 42);
  ctx.lineTo(x, y + 42);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.fillStyle = WINLAB_THEME.header;
  ctx.fill();
  ctx.restore();

  // Traffic lights
  const cy = y + 21;
  const cx = x + 24;
  const dotRadius = 6;
  const spacing = 18;

  const dots = [
    { color: "#ff5f57", hover: "#ff3b30" }, // close
    { color: "#febc2e", hover: "#ffcc00" }, // minimize
    { color: "#28c840", hover: "#20c840" }, // maximize
  ];

  dots.forEach((dot, i) => {
    ctx.beginPath();
    ctx.fillStyle = dot.color;
    ctx.arc(cx + i * spacing, cy, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  // Window title (centered)
  ctx.fillStyle = WINLAB_THEME.sub;
  ctx.font = "13px -apple-system, BlinkMacSystemFont, 'SF Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("winlab — terminal", x + w / 2, y + 26);
}

// ─── Draw: Terminal Body ──────────────────────────────────────────────────────
function drawTerminalContent(ctx, x, y, w, h, lines, typingProgress) {
  // Terminal background
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  roundRect(ctx, x + 2, y + 44, w - 4, h - 46, 10, true, false);

  // Font settings
  ctx.font = "24px 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace";
  ctx.textAlign = "left";

  const lineHeight = 36;
  const startY = y + 85;
  const paddingX = x + 24;
  const now = performance.now();

  lines.forEach((line, i) => {
    const lineY = startY + i * lineHeight;

    // Skip if off-screen
    if (lineY > y + h - 20) return;

    // Typing animation per line
    const lineProgress = Math.min(1, Math.max(0, (typingProgress * 3.5) - i * 0.35));
    const eased = easeOutExpo(lineProgress);
    const charCount = Math.floor(line.text.length * eased);
    const visibleText = line.text.substring(0, charCount);

    // Determine color
    let color = WINLAB_THEME.text;
    if (line.type === "command") color = "#60a5fa"; // blue accent
    if (line.type === "success") color = WINLAB_THEME.success;
    if (line.type === "error") color = WINLAB_THEME.error;
    if (line.type === "warning") color = WINLAB_THEME.warning;
    if (line.type === "info") color = WINLAB_THEME.sub;

    // Draw text
    ctx.fillStyle = color;
    ctx.fillText(visibleText, paddingX, lineY);

    // Cursor (blinking, only on current line)
    const isCurrentLine = i === Math.floor(typingProgress * 3.5);
    const cursorBlink = Math.floor(now / 530) % 2 === 0;

    if (isCurrentLine && cursorBlink && eased < 1) {
      const textWidth = ctx.measureText(visibleText).width;
      ctx.fillStyle = color;
      ctx.fillRect(paddingX + textWidth + 2, lineY - 18, 10, 20);
    }

    // Success glow effect
    if (line.type === "success" && eased === 1) {
      ctx.save();
      ctx.shadowColor = WINLAB_THEME.success;
      ctx.shadowBlur = 15;
      ctx.fillStyle = WINLAB_THEME.success;
      ctx.fillText(line.text, paddingX, lineY);
      ctx.restore();
    }
  });
}

// ─── Animation State ──────────────────────────────────────────────────────────
let animationStart = null;

// ─── Main Draw Function ───────────────────────────────────────────────────────
/**
 * Draw a single frame of the macOS terminal animation
 */
function drawFrame(canvas, ctx, progress, lines, options = {}) {
  const {
    width = 900,
    height = 540,
    posX = 190,
    posY = 90,
  } = options;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background gradient (subtle)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, WINLAB_THEME.bg);
  bgGrad.addColorStop(1, "#050508");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Opening animation (scale + fade)
  const openProgress = Math.min(1, progress * 2); // faster than overall progress
  const openEased = easeOutExpo(openProgress);

  ctx.save();
  
  // Transform: scale from 0.9 to 1.0
  const scale = 0.92 + 0.08 * openEased;
  const alpha = openEased;
  
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(scale, scale);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);
  ctx.globalAlpha = alpha;

  // Draw macOS window
  drawMacWindow(ctx, posX, posY, width, height);

  // Draw terminal content
  if (lines && lines.length > 0) {
    drawTerminalContent(ctx, posX, posY, width, height, lines, progress);
  }

  ctx.restore();

  // Brand footer (outside window)
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = WINLAB_THEME.sub;
  ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("WinLab.cloud — Real Linux Labs", canvas.width / 2, canvas.height - 30);
  ctx.restore();
}

// ─── Preset Scenarios ─────────────────────────────────────────────────────────
const SCENARIOS = {
  apache_fix: {
    title: "Fix Apache Down",
    lines: [
      { text: "$ systemctl status httpd", type: "command" },
      { text: "● httpd.service - The Apache HTTP Server", type: "info" },
      { text: "   Active: inactive (dead) since Mon 2024-03-04", type: "error" },
      { text: "", type: "info" },
      { text: "$ journalctl -u httpd -n 5", type: "command" },
      { text: "kernel: Out of memory: Kill process 3412", type: "warning" },
      { text: "", type: "info" },
      { text: "$ systemctl start httpd", type: "command" },
      { text: "Started httpd.service", type: "success" },
      { text: "", type: "info" },
      { text: "$ curl -I http://localhost", type: "command" },
      { text: "HTTP/1.1 200 OK", type: "success" },
      { text: "", type: "info" },
      { text: "✓ Scenario resolved — Apache back online", type: "success" },
    ],
  },
  disk_cleanup: {
    title: "Disk Full Fix",
    lines: [
      { text: "$ df -h", type: "command" },
      { text: "Filesystem      Size  Used Avail Use% Mounted on", type: "info" },
      { text: "/dev/sda1        50G   50G    0  100% /", type: "error" },
      { text: "", type: "info" },
      { text: "$ du -sh /var/log/*", type: "command" },
      { text: "48G  /var/log/httpd/access_log", type: "warning" },
      { text: "", type: "info" },
      { text: "$ truncate -s 0 /var/log/httpd/access_log", type: "command" },
      { text: "", type: "info" },
      { text: "$ df -h", type: "command" },
      { text: "/dev/sda1        50G   2G   48G   4% /", type: "success" },
      { text: "", type: "info" },
      { text: "✓ Scenario resolved — 48GB freed", type: "success" },
    ],
  },
  selinux_fix: {
    title: "SELinux Denial Fix",
    lines: [
      { text: "$ curl http://localhost", type: "command" },
      { text: "curl: (56) Connection reset by peer", type: "error" },
      { text: "", type: "info" },
      { text: "$ ausearch -m avc -ts recent", type: "command" },
      { text: "avc: denied { read } for httpd", type: "warning" },
      { text: "  tcontext=unconfined_u:object_r:user_home_t", type: "warning" },
      { text: "", type: "info" },
      { text: "$ restorecon -v /var/www/html/index.html", type: "command" },
      { text: "Relabeled to httpd_sys_content_t", type: "success" },
      { text: "", type: "info" },
      { text: "$ systemctl restart httpd", type: "command" },
      { text: "✓ Scenario resolved — SELinux fixed", type: "success" },
    ],
  },
  ssh_brute_force: {
    title: "SSH Brute Force Defense",
    lines: [
      { text: "$ lastb | head -10", type: "command" },
      { text: "root  185.234.12.45  Mon Mar  4 10:00", type: "error" },
      { text: "... 4800 failed attempts in 2 hours", type: "warning" },
      { text: "", type: "info" },
      { text: "$ systemctl start fail2ban", type: "command" },
      { text: "Started fail2ban.service", type: "success" },
      { text: "", type: "info" },
      { text: "$ fail2ban-client status sshd", type: "command" },
      { text: "Banned IP: 185.234.12.45", type: "success" },
      { text: "", type: "info" },
      { text: "✓ Scenario resolved — Attack mitigated", type: "success" },
    ],
  },
};

// ─── React Component ──────────────────────────────────────────────────────────
export function MacOSTerminalAnimation({
  scenario = "apache_fix",
  loop = true,
  autoPlay = true,
  className = "",
  width = 1280,
  height = 720,
}) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [isComplete, setIsComplete] = useState(false);

  const lines = SCENARIOS[scenario]?.lines || SCENARIOS.apache_fix.lines;

  const animate = useCallback(
    (timestamp) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");

      if (!animationStart) animationStart = timestamp;
      const elapsed = timestamp - animationStart;
      const duration = 4500; // 4.5 seconds for full animation
      const progress = Math.min(1, elapsed / duration);

      // Draw frame
      drawFrame(canvas, ctx, progress, lines, {
        width: 900,
        height: 540,
        posX: 190,
        posY: 90,
      });

      // Check completion
      if (progress >= 1) {
        setIsComplete(true);
        if (loop) {
          animationStart = null; // reset for next loop
        }
      }

      // Continue animation
      if (progress < 1 || loop) {
        animationRef.current = requestAnimationFrame(animate);
      }
    },
    [lines, loop]
  );

  useEffect(() => {
    if (!autoPlay) return;

    animationStart = null; // reset
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [scenario, autoPlay, animate]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{
        maxWidth: "100%",
        height: "auto",
        borderRadius: "16px",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8), 0 0 1px rgba(255, 255, 255, 0.1)",
      }}
    />
  );
}

// ─── Landing Page Hero Integration ────────────────────────────────────────────
export function TerminalHeroSection({ onCTA }) {
  const [currentScenario, setCurrentScenario] = useState(0);
  const scenarios = Object.keys(SCENARIOS);

  // Auto-cycle through scenarios
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentScenario((prev) => (prev + 1) % scenarios.length);
    }, 6000); // new scenario every 6 seconds

    return () => clearInterval(interval);
  }, [scenarios.length]);

  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-16 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-blue-600/[0.08] rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-blue-800/[0.06] rounded-full blur-3xl" />
      </div>

      {/* Grid dots */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
        {/* Copy (left side) */}
        <div>
          <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-blue-600/30 bg-blue-600/10 text-blue-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            10 interactive labs · AI Mentor · Verified Certification
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.05] mb-6">
            Break the servers.
            <br />
            <span className="text-blue-500">Save your career.</span>
          </h1>

          <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-lg">
            The only hands-on sysadmin simulator where you can fail safely —
            without taking down production. Master vSphere, RAID, Linux, SSSD
            and Terraform in a realistic sandbox.
          </p>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={onCTA}
              className="relative group px-7 py-4 bg-blue-600 text-white font-bold rounded-xl text-sm overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="absolute -inset-1 bg-blue-600/40 blur-lg opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
              <span className="relative">Start First Lab — Free →</span>
            </button>

            <a
              href="#pricing"
              className="px-7 py-4 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 font-semibold rounded-xl text-sm transition-all"
            >
              B2B Team Plans
            </a>
          </div>

          <div className="flex items-center gap-6 mt-10 text-xs text-slate-600">
            <span>✓ No credit card required</span>
            <span>✓ Cancel anytime</span>
            <span>✓ Linux & Windows scenarios</span>
          </div>
        </div>

        {/* Terminal Animation (right side) */}
        <div className="relative">
          <MacOSTerminalAnimation
            scenario={scenarios[currentScenario]}
            loop={true}
            width={1280}
            height={720}
          />

          {/* Scenario indicator dots */}
          <div className="flex justify-center gap-2 mt-6">
            {scenarios.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentScenario(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentScenario
                    ? "bg-blue-500 w-6"
                    : "bg-slate-600 hover:bg-slate-500"
                }`}
                aria-label={`Show scenario ${scenarios[i]}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-700">
        <span className="text-xs">scroll</span>
        <div
          className="w-px h-8 bg-gradient-to-b from-slate-700 to-transparent"
          style={{
            animation: "bounce 1.5s infinite",
          }}
        />
      </div>
    </section>
  );
}

// ─── Default Export ───────────────────────────────────────────────────────────
export default MacOSTerminalAnimation;
