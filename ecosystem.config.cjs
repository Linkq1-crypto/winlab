// ecosystem.config.js – PM2 Cluster Mode Configuration
// Start: pm2 start ecosystem.config.js
// Monitor: pm2 monit
// Logs: pm2 logs winlab

module.exports = {
  apps: [
    {
      name: 'winlab',
      script: 'server.js',
      interpreter: 'node',
      interpreter_args: '--experimental-vm-modules',
      instances: 1, // SQLite write path is not safe under PM2 cluster contention
      exec_mode: 'fork',
      max_memory_restart: '1G',

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },

      // Auto-restart
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '60s',
      restart_delay: 4000,

      // Logging (create dir first: mkdir -p /var/log/pm2)
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/pm2/winlab-error.log',
      out_file: '/var/log/pm2/winlab-out.log',
      merge_logs: true,

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,

      // PM2 monitoring
      monitoring: false, // Set true if using PM2 Plus
    },
  ],
};
