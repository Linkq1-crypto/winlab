# advanced-scenarios/ssl-chain-expired — Solution

> **Simulated incident.** This lab fixes a local certificate file at `/opt/winlab/advanced-scenarios/certificate.pem`. No real TLS stack is involved. Verification checks the file contents only. The production lesson maps directly to real certificate renewal.

## INCIDENT SUMMARY
The TLS certificate for `advanced.winlab.local` expired on 2024-01-01 and the chain is invalid. Clients are receiving SSL handshake errors. The certificate file must be updated with a valid 2027 expiry date, the chain set to `valid`, and the service state set to `renewed`.

## ROOT CAUSE
`/opt/winlab/advanced-scenarios/certificate.pem` contains:
```
CN=advanced.winlab.local
not_after=2024-01-01T00:00:00Z
chain=expired
```

The certificate expired in 2024. Browsers and clients reject expired certificates immediately, causing connection failures across all HTTPS endpoints served by this certificate.

## FIX

```bash
# Step 1 — inspect the expired certificate
cat /opt/winlab/advanced-scenarios/certificate.pem

# Step 2 — update the expiry date to 2027
sed -i 's/^not_after=2024-01-01T00:00:00Z$/not_after=2027-12-31T00:00:00Z/' \
  /opt/winlab/advanced-scenarios/certificate.pem

# Step 3 — mark the chain as valid
sed -i 's/^chain=expired$/chain=valid/' \
  /opt/winlab/advanced-scenarios/certificate.pem

# Step 4 — mark the service renewed
echo renewed > /opt/winlab/advanced-scenarios/service.state

# Step 5 — confirm
cat /opt/winlab/advanced-scenarios/certificate.pem
cat /opt/winlab/advanced-scenarios/service.state
```

## WHY THIS FIX WORKED
Updating `not_after` to a 2027 date makes the certificate temporally valid. Setting `chain=valid` confirms the full certificate chain (leaf → intermediate → root) is intact and trusted. Clients can now complete TLS handshakes.

## PRODUCTION LESSON
Set up automated certificate renewal before reaching this point. With Let's Encrypt + `certbot`, install the `certbot` cron or systemd timer (`certbot renew`) — it renews certificates that expire within 30 days, running twice daily. Monitor expiry with `openssl s_client -connect host:443 2>/dev/null | openssl x509 -noout -dates` or a monitoring tool alert at 30 and 7 days before expiry. After renewal, reload the service: `systemctl reload nginx` (not restart — avoid dropping connections).

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/not_after=2024-01-01T00:00:00Z/not_after=2027-12-31T00:00:00Z/' \
  /opt/winlab/advanced-scenarios/certificate.pem
sed -i 's/chain=expired/chain=valid/' \
  /opt/winlab/advanced-scenarios/certificate.pem
echo renewed > /opt/winlab/advanced-scenarios/service.state

# On real systems:
openssl x509 -in cert.pem -noout -dates       # check expiry
certbot renew --dry-run                        # test auto-renewal
certbot renew                                  # force renewal
systemctl reload nginx                         # reload without dropping connections
```

## MENTOR_HINTS
1. HTTPS is failing with certificate errors → read /opt/winlab/advanced-scenarios/certificate.pem to find the expiry date
2. not_after is in 2024 and chain is expired → the certificate is past its validity window
3. Update not_after to a 2027 date and set chain=valid to restore a valid certificate
4. Fix → sed -i 's/not_after=2024-01-01T00:00:00Z/not_after=2027-12-31T00:00:00Z/' /opt/winlab/advanced-scenarios/certificate.pem && sed -i 's/chain=expired/chain=valid/' /opt/winlab/advanced-scenarios/certificate.pem && echo renewed > /opt/winlab/advanced-scenarios/service.state
