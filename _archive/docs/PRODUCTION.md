# WINLAB Production Architecture — Load Balancing, Auto-Healing, Backup

## Architecture Overview

```
                 ┌─────────────┐
                 │  NGINX LB   │ :80 / :443
                 │ (Reverse    │
                 │  Proxy)     │
                 └──────┬──────┘
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
      ┌──────────┐ ┌──────────┐ ┌──────────┐
      │ Node A   │ │ Node B   │ │ Node C   │
      │ :3001    │ │ :3002    │ │ :3003    │
      │ PM2 Clst │ │ PM2 Clst │ │ PM2 Clst │
      └────┬─────┘ └────┬─────┘ └────┬─────┘
           │             │             │
           └─────────────┼─────────────┘
                         ▼
                  ┌─────────────┐
                  │   MySQL     │ :3306
                  │ (Primary)   │
                  └──────┬──────┘
                         │
                  ┌─────────────┐
                  │ MariaDB     │ :3307
                  │ (Replica)   │
                  └──────┬──────┘
                         │
                  ┌─────────────┐
                  │ Backblaze   │
                  │ B2 (Backup) │
                  └─────────────┘
```

---

## 1. NGINX Load Balancer

```bash
sudo cp nginx-loadbalancer.conf /etc/nginx/sites-available/winlab
sudo ln -s /etc/nginx/sites-available/winlab /etc/nginx/sites-enabled/winlab
sudo nginx -t && sudo systemctl reload nginx
```

---

## 2. PM2 Cluster Mode

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Auto-start on boot
```

---

## 3. State Recovery

If a node dies and restarts:
1. PM2 auto-restarts the process
2. On boot, the app loads the latest snapshot from DB
3. Applies any missed events from the `Event` outbox table
4. Node is back online with full state

---

## 4. Backup Schedule

```bash
# Run backup daily at 2am
0 2 * * * cd /var/www/simulator && node scripts/backup.js >> /var/log/winlab-backup.log 2>&1
```

---

## 5. Self-Healing Flow

```
Node dies
    ↓
PM2 detects crash → auto-restarts (max 10 times in 60s)
    ↓
If PM2 fails → NGINX marks node as DOWN
    ↓
Traffic rerouted to healthy nodes
    ↓
Node pulls state from DB → Backblaze B2 fallback
    ↓
Node back online → NGINX adds it back to pool
```
