# WinLab — Compliance Integration Guide
# ========================================
# Tempo stimato: 5-10 minuti
# Cosa hai: 4 file pronti da integrare in coming-soon/index.html
#
# OPPURE (opzione veloce): mandami il file coming-soon/index.html
# e te lo restituisco già integrato. Zero lavoro per te.

## Cosa va fatto

### FIX 1 — Cookie Banner (CRITICO per GDPR)
# File: cookie-banner.html
# Problema: il banner attuale ha "Essential only" / "Accept all" 
#           → manca un vero pulsante "Reject" in egual risalto
# Soluzione: sostituisci l'intero blocco cookie banner con il codice
#            in cookie-banner.html
#
# Inoltre, nel tuo analytics code (sendBeacon), wrappa così:
#   if (window.__wl_analytics_allowed) { 
#     navigator.sendBeacon('/api/analytics', data);
#   }

### FIX 2 — Privacy Policy (CRITICO)
# File: privacy-policy.html
# Problema: mancano 2 servizi (Anthropic + Resend) dalla policy
#           + manca info sul data controller
# Soluzione: sostituisci il contenuto della route /privacy 
#            con il contenuto di privacy-policy.html
# TODO: sostituisci [Your Full Name] con il tuo nome legale

### FIX 3 — Cookie Policy (CRITICO)
# File: cookie-policy.html  
# Problema: manca una cookie policy che elenchi tutti i cookie
#           con terze parti e link alle loro informative
# Soluzione: sostituisci il contenuto della route /cookies
#            con il contenuto di cookie-policy.html

### FIX 4 — Terms & Conditions (IMPORTANTE)
# File: terms-conditions.html
# Problema: T&C mancanti o incompleti, manca clausola EU withdrawal,
#           manca link ODR europeo, mancano clausole US
# Soluzione: sostituisci il contenuto della route /terms
#            con il contenuto di terms-conditions.html
# TODO: sostituisci [Your Full Name] con il tuo nome legale

### FIX 5 — Backend: consent logging endpoint (OPZIONALE ma raccomandato)
# Aggiungi questo endpoint in server.js:
#
# app.post('/api/consent/log', express.json(), (req, res) => {
#   const { version, timestamp, preferences, userAgent } = req.body;
#   // Log to DB or file for GDPR audit trail
#   console.log('[CONSENT]', JSON.stringify(req.body));
#   // TODO: store in DB with prisma if you want a proper audit log
#   res.status(204).end();
# });

### FIX 6 — winlab_plan cookie (sendBeacon analytics)
# Questo cookie è stato rilevato come "non classificato"
# Il cookie banner lo classifica ora come "Analytics"
# → viene settato SOLO dopo consenso esplicito dell'utente

## Checklist post-integrazione
# [ ] Cookie banner mostra "Reject all" e "Accept all" della stessa dimensione
# [ ] Click "Reject all" → winlab_plan cookie NON viene settato
# [ ] Click "Accept all" → winlab_plan cookie viene settato
# [ ] Scudo (🛡) appare in basso a sinistra dopo la scelta
# [ ] Click sullo scudo → banner si riapre con preferenze pre-selezionate
# [ ] /privacy mostra tutti i 4 servizi terzi (Stripe, Anthropic, Resend, Cloudflare)
# [ ] /cookies mostra tabella completa dei cookie
# [ ] /terms mostra clausola withdrawal EU + link ODR
