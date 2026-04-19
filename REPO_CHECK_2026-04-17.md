# Repo check rapido (2026-04-17)

## Contesto
Verifica iniziale della repo `winlab` con focus su installazione dipendenze e script base.

## Comandi eseguiti
1. `npm test`
2. `npm ci`
3. `npm ci --legacy-peer-deps`
4. `npm test` (secondo tentativo)
5. `npx prisma generate`
6. `npm run build`

## Risultati principali
- `npm ci` fallisce per conflitto peer dependency tra `vite@8.x` e `vite-plugin-pwa@1.2.0` (supporta fino a `vite@7.x`).
- Anche forzando con `npm ci --legacy-peer-deps`, l'ambiente resta incoerente: script base non trovano binari/artefatti attesi (`vite` non disponibile).
- `npm test` fallisce perché `@prisma/client` non risolve `index.js` nel setup attuale.
- `npx prisma generate` fallisce con `403 Forbidden` verso npm registry (limite ambiente/rete o policy).

## Valutazione
Stato repo **non pronto** per una verifica end-to-end in questo ambiente senza:
1. allineamento versioni Vite/PWA,
2. installazione dipendenze completa,
3. generazione client Prisma con accesso registry.

## Fix consigliati
1. Allineare stack frontend:
   - o downgrade `vite` a `^7.x`,
   - o aggiornare/sostituire `vite-plugin-pwa` con versione compatibile `vite@8`.
2. Rigenerare lockfile dopo l'allineamento (`rm -rf node_modules package-lock.json && npm install`).
3. Eseguire `npx prisma generate` in ambiente con accesso npm e verificare che `node_modules/@prisma/client/index.js` esista.
4. Rilanciare check minimi: `npm run build`, `npm test`, `npm run test:unit`.
