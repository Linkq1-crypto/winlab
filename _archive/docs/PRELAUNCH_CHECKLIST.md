# WinLab — Pre-Launch Checklist
> Aggiornato: Aprile 2026

---

## 0. DEPLOY SUL VPS — procedura corretta

### Strategia: offline → lavori → relaunch pulito

```bash
# 1. Porta il sito offline (mostra pagina di manutenzione)
sudo systemctl stop nginx

# 2. Carica il codice
cd ~/winlab
git pull   # oppure scp del tar.gz

# 3. Installa dipendenze + builda
npm install
npm run build

# 4. Aggiorna il DB
npx prisma db push

# 5. Riavvia il processo Node
pm2 restart winlab

# 6. Riporta il sito online
sudo systemctl start nginx
# oppure se nginx non parte al boot:
sudo systemctl enable --now nginx
```

> **TL;DR**: dimentichi `systemctl start nginx` → sito offline (safe, non rompe nulla).
> Soluzione migliore: `sudo systemctl enable --now nginx` → nginx parte automaticamente al boot del VPS.

---

## 1. INFRASTRUTTURA

- [ ] DNS `winlab.cloud` → IP VPS puntato correttamente (`dig winlab.cloud +short`)
- [ ] SSL certbot attivo (`certbot --nginx -d winlab.cloud -d www.winlab.cloud`)
- [ ] `sudo systemctl enable nginx` — nginx si avvia al boot
- [ ] `pm2 save && pm2 startup` — Node si avvia al boot
- [ ] Firewall: porta 80 e 443 aperte, 3000 chiusa all'esterno

---

## 2. VARIABILI D'AMBIENTE (.env sul VPS)

- [ ] `DATABASE_URL` — SQLite prod o MySQL
- [ ] `JWT_SECRET` — stringa lunga e random
- [ ] `APP_URL=https://winlab.cloud`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `STRIPE_SECRET_KEY` (sk_live_...)
- [ ] `STRIPE_WEBHOOK_SECRET` (whsec_...)
- [ ] `CLOUDFLARE_API_TOKEN`
- [ ] `CLOUDFLARE_ZONE_ID=51e8c4002c0b13eab210d2627e1b66b0`
- [ ] `NODE_ENV=production`

---

## 3. DATABASE

- [ ] `npx prisma db push` eseguito sul server prod
- [ ] Backup automatico schedulato (`cron` o `pm2-cron`)
- [ ] Verifica che SQLite sia su un volume persistente (non in-memory)

---

## 4. STRIPE

- [ ] Price IDs corretti nel frontend (sk_live_ non sk_test_)
- [ ] Webhook Stripe configurato su `https://winlab.cloud/api/stripe/webhook`
- [ ] Webhook secret copiato nel .env
- [ ] Test checkout funzionante con carta reale (1€ e rimborso)

---

## 5. CLOUDFLARE

- [ ] Zona attiva su Cloudflare
- [ ] Proxy (arancione) attivo su `winlab.cloud` e `www.winlab.cloud`
- [ ] SSL/TLS mode: **Full (strict)**
- [ ] Cache purge funzionante (`POST /api/admin/purge-cache`)
- [ ] Page Rule o Cache Rule per `/api/*` → bypass cache

---

## 6. PRIVACY / LEGALE

- [ ] Cookie banner visibile al primo accesso
- [ ] Privacy Policy accessibile da `/privacy` o footer
- [ ] Terms of Service accessibili da `/terms` o footer
- [ ] `robots.txt` blocca `/myrooting/*`, `/api/*`, `/dash_board`
- [ ] Email `privacy@winlab.cloud` funzionante

---

## 7. SOCIAL PUBLISHER (vhs/publisher)

- [ ] Login Playwright: Facebook, LinkedIn, TikTok (`node login.mjs facebook`)
- [ ] Cookie sessions salvati in `vhs/publisher/sessions/`
- [ ] Schedule video launch week pronto (`node schedule.mjs`)
- [ ] YouTube: upload manuale su YouTube Studio (no API)

---

## 8. SMOKE TEST FINALE

- [ ] Registrazione nuovo utente funziona
- [ ] Login funziona, cookie httpOnly presente in DevTools
- [ ] Lab si carica e completa
- [ ] Pagamento Stripe funziona (test card)
- [ ] Email di reset password arriva
- [ ] Dashboard `/myrooting/telemetry` accessibile solo da loggato
- [ ] `https://winlab.cloud/robots.txt` corretto
- [ ] Nessuna chiave API esposta nel bundle frontend (`npm run build` e cerca nel dist/)

---

## 9. POST-LAUNCH (primi 3 giorni)

- [ ] Monitorare `pm2 logs winlab` ogni ora
- [ ] Analytics launch dashboard aperta su `/myrooting/telemetry`
- [ ] Purge CF cache dopo ogni aggiornamento contenuto
- [ ] Rispondere ai primi utenti su social entro 1h

---

> ⚠️ **Appena arrivi a 4.500€ MRR**: apri la società (SRL o ditta individuale), aggiorna le legal pages con ragione sociale, P.IVA e sede legale.
