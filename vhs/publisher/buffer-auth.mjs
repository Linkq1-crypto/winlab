#!/usr/bin/env node
// ── Buffer OAuth2 — ottieni il tuo access token ───────────────────────────────
// Uso:
//   node buffer-auth.mjs --client-id YOUR_ID --client-secret YOUR_SECRET

import { createServer } from 'http';

const args       = process.argv.slice(2);
const get        = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const clientId   = get('--client-id');
const clientSec  = get('--client-secret');
const PORT       = 8085;
const REDIRECT   = `http://127.0.0.1:${PORT}/callback`;

if (!clientId || !clientSec) {
  console.log(`
Uso:
  node buffer-auth.mjs --client-id <id> --client-secret <secret>

Come ottenere client_id e client_secret:
  1. Vai su https://buffer.com/developers/apps
  2. Crea una nuova app
  3. Redirect URI da inserire: http://127.0.0.1:${PORT}/callback
  4. Copia client_id e client_secret
`);
  process.exit(0);
}

// Step 1: apri URL di autorizzazione
const authUrl = `https://bufferapp.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code`;

console.log('\n1. Apri questo URL nel browser:\n');
console.log(`   ${authUrl}\n`);
console.log('2. Autorizza l\'app Buffer');
console.log('3. Aspetta il redirect (torno automaticamente con il token)...\n');

// Step 2: server locale che cattura il callback
const server = createServer(async (req, res) => {
  const url  = new URL(req.url, `http://127.0.0.1`);
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400); res.end('Nessun codice ricevuto');
    return;
  }

  // Step 3: scambia il code con access_token
  try {
    const tokenRes = await fetch('https://api.bufferapp.com/1/oauth2/token.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSec,
        redirect_uri:  REDIRECT,
        code,
        grant_type:    'authorization_code',
      }),
    });

    const data = await tokenRes.json();

    if (!tokenRes.ok || !data.access_token) {
      res.writeHead(500); res.end(`Errore: ${JSON.stringify(data)}`);
      console.error('\nErrore token:', data);
      server.close();
      return;
    }

    const token = data.access_token;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h2>✓ Token ottenuto!</h2><p>Torna nel terminale.</p>`);

    console.log('\n✓ ACCESS TOKEN:\n');
    console.log(`   ${token}\n`);
    console.log('Esporta in PowerShell:');
    console.log(`   $env:BUFFER_TOKEN = "${token}"\n`);
    console.log('Oppure salvalo nel .env:');
    console.log(`   BUFFER_TOKEN=${token}\n`);

    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500); res.end(err.message);
    console.error(err);
    server.close();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server in ascolto su http://127.0.0.1:${PORT} ...\n`);
});
