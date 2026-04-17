const path = require("path");

/**
 * Generate video content metadata based on templates
 * Simulates AI-generated video concepts for Linux/DevOps tutorials
 */
function generateVideo() {
  const hooks = [
    "Linux Disk Cleanup Guide",
    "Nginx Troubleshooting",
    "Docker Best Practices",
    "SSH Security Setup",
    "Systemd Service Management",
    "Firewall Configuration",
    "Log Rotation Setup",
    "Process Monitoring",
    "File Permissions Explained",
    "Network Diagnostics",
    "Backup Strategies",
    "Package Management Tips",
    "Cron Job Automation",
    "SSL Certificate Setup",
    "Database Backup Guide"
  ];

  const steps = [
    ["df -h", "du -sh *", "find / -size +100M -exec ls -lh {} \\;", "rm -rf /tmp/*", "journalctl --vacuum-size=500M"],
    ["systemctl status nginx", "journalctl -u nginx --since '1 hour ago'", "nginx -t", "systemctl restart nginx", "tail -f /var/log/nginx/error.log"],
    ["docker ps --format 'table {{.Names}}\\t{{.Status}}'", "docker system df", "docker system prune -af", "docker volume prune -f", "docker images --format '{{.Repository}}:{{.Tag}}'"],
    ["ssh-keygen -t ed25519", "ssh-copy-id user@server", "chmod 600 ~/.ssh/id_ed25519", "ssh -i ~/.ssh/id_ed25519 user@server", "cat /etc/ssh/sshd_config | grep -i password"],
    ["systemctl list-units --type=service --state=running", "systemctl cat nginx", "systemctl edit --full myservice", "systemctl enable --now myservice", "journalctl -u myservice -f"],
    ["ufw status verbose", "ufw allow 22/tcp", "ufw allow 80,443/tcp", "ufw enable", "ufw status numbered"],
    ["cat /etc/logrotate.d/nginx", "logrotate -d /etc/logrotate.conf", "du -sh /var/log/*", "find /var/log -name '*.gz' -delete", "systemctl restart rsyslog"],
    ["ps aux --sort=-%mem | head -10", "htop", "kill -15 <PID>", "nice -n 10 command", "systemctl set-property system.slice MemoryLimit=2G"],
    ["ls -la /var/www/html", "chmod 755 -R /var/www", "chown www-data:www-data -R /var/www", "find /var/www -type f -exec chmod 644 {} \\;", "getfacl /var/www"],
    ["ping -c 4 google.com", "traceroute google.com", "dig example.com", "ss -tulnp", "netstat -rn"],
    ["tar czvf backup-$(date +%F).tar.gz /etc /var/www", "rsync -avz /data user@backup:/data", "scp backup.tar.gz user@remote:/backups", "lftp -e 'mirror -R /local /remote' ftp.server", "restic backup /data --tag daily"],
    ["apt update && apt upgrade -y", "yum check-update", "dnf update --refresh", "apt autoremove", "dpkg -l | grep linux-image"],
    ["crontab -l", "echo '0 3 * * * /backup.sh' | crontab -", "systemctl status cron", "cat /var/log/syslog | grep CRON", "at now + 5 minutes"],
    ["certbot --nginx -d example.com", "certbot renew --dry-run", "systemctl status certbot.timer", "crontab -l | grep certbot", "openssl x509 -in cert.pem -text -noout"],
    ["mysqldump --all-databases > full_backup.sql", "pg_dump mydb > mydb_backup.sql", "mysql < backup.sql", "systemctl restart mariadb", "mysqlcheck --all-databases --auto-repair"]
  ];

  const hook = hooks[Math.floor(Math.random() * hooks.length)];
  const s = steps[Math.floor(Math.random() * steps.length)];

  // Tutorial duration: 60-480 seconds (1-8 minutes)
  const duration = 60 + Math.floor(Math.random() * 420);

  // Estimated file size: ~1MB per 5 seconds of tutorial
  const fileSize = duration * 0.2 * 1024 * 1024 * (0.8 + Math.random() * 0.4);

  return {
    hook,
    steps: s,
    duration,
    pacing: duration < 180 ? "fast" : "medium",
    commands: s.length,
    hasQuestion: hook.includes("?") ? 1 : 0,
    fileSize
  };
}

/**
 * Build feature vector from video metadata for ML prediction
 * Returns array of features matching model input dimensions (10 features)
 */
function buildFeatures(video) {
  return [
    video.fileSize / (1024 * 1024),           // File size in MB
    video.duration,                            // Duration in seconds
    video.fileSize / video.duration,           // Bytes per second
    Math.min(video.duration, 60) / 60,        // Normalized duration
    Math.min(video.fileSize / (50 * 1024 * 1024), 1.0),  // Normalized size
    video.duration < 60 ? 1.0 : 0.0,          // Is short form
    Math.min(video.duration, 45) / 45,        // Duration for shorts
    Math.log1p(video.fileSize) / 20,          // Log normalized size
    (video.duration % 15) / 15,               // Duration pattern
    Math.min(video.fileSize / video.duration / 1000000, 1.0)  // Mbps
  ];
}

/**
 * Predict video quality score using trained ML model
 * Uses Ridge Regression model (R²=0.80)
 * @param {number[]} features - Feature vector (10 dimensions)
 * @returns {number} Quality score between 0 and 1
 */
function predict(features) {
  try {
    const { predict } = require("../ml/predict_simple");
    const score = predict(features);
    return score;
  } catch (err) {
    console.error("⚠️  ML prediction failed, using fallback:", err.message);
    return heuristicPredict(features);
  }
}

/**
 * Fallback heuristic prediction for tutorials
 */
function heuristicPredict(features) {
  const duration = features[1] || 180;
  const fileSize = features[0] || 36;
  const durationMin = duration / 60;

  // Tutorial scoring: optimal 1-8 minutes
  let durationScore;
  if (durationMin <= 1) durationScore = 0.3;
  else if (durationMin <= 5) durationScore = 0.9 + 0.1 * (1 - Math.abs(durationMin - 3) / 2);
  else if (durationMin <= 10) durationScore = 0.75;
  else if (durationMin <= 20) durationScore = 0.6;
  else durationScore = Math.max(0.2, 0.6 - (durationMin - 20) / 40);

  // Tutorial size scoring: optimal 10-150MB
  let sizeScore;
  if (fileSize < 2) sizeScore = 0.2;
  else if (fileSize < 10) sizeScore = 0.6;
  else if (fileSize < 150) sizeScore = 0.9;
  else if (fileSize < 300) sizeScore = 0.7;
  else sizeScore = Math.max(0.3, 0.7 - (fileSize - 300) / 500);

  let score = (durationScore * 0.6 + sizeScore * 0.4);
  score += (Math.random() - 0.5) * 0.04;

  return Math.max(0.0, Math.min(1.0, score));
}

module.exports = {
  generateVideo,
  buildFeatures,
  predict
};
