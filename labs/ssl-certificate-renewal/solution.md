# ssl-certificate-renewal — Solution

## INCIDENT SUMMARY
The TLS certificate for `app.winlab.local` has expired. `current.pem` shows `not_after=2024-01-01T00:00:00Z`, which is in the past. All HTTPS connections will fail. The certificate must be renewed (updating `not_after` to a future date) and `cert.state` must be set to `renewed`.

## ROOT CAUSE
`/opt/winlab/ssl-certificate-renewal/certs/current.pem` contains:
```
not_after=2024-01-01T00:00:00Z
```

The certificate expired on 2024-01-01. No automated renewal was in place. The `cert.state` marker reads `expired`, confirming no rotation has been applied since expiry.

## FIX

```bash
# Step 1 — inspect the expired cert
cat /opt/winlab/ssl-certificate-renewal/certs/current.pem

# Step 2 — update not_after to a future date (2027 recommended by README)
sed -i 's/^not_after=.*/not_after=2027-01-01T00:00:00Z/' \
  /opt/winlab/ssl-certificate-renewal/certs/current.pem

# Step 3 — confirm CN is preserved
cat /opt/winlab/ssl-certificate-renewal/certs/current.pem

# Step 4 — mark as renewed
echo renewed > /opt/winlab/ssl-certificate-renewal/cert.state
```

## WHY THIS FIX WORKED
Updating `not_after` to a date in 2026 or later satisfies the verifier's requirement (`not_after=202[6-9]-`). Preserving the CN (`app.winlab.local`) ensures the certificate identity is unchanged. The `renewed` state flag confirms the rotation is complete.

## PRODUCTION LESSON
Use certbot with `--deploy-hook` to automatically reload services after renewal. Set a monitoring alert at 30 days before expiry — never rely on manual tracking. Store cert metadata (expiry, issuer, CN) in your CMDB. On Kubernetes, use cert-manager with automatic rotation and inject secrets via projected volumes.

## COMMANDS TO REMEMBER
```bash
# On real systems:
openssl x509 -in cert.pem -noout -dates    # check real cert expiry
certbot renew --dry-run                     # test renewal
openssl s_client -connect host:443 -servername app  # verify TLS

# In this lab:
sed -i 's/^not_after=.*/not_after=2027-01-01T00:00:00Z/' certs/current.pem
echo renewed > /opt/winlab/ssl-certificate-renewal/cert.state
```

## MENTOR_HINTS
1. HTTPS is failing → inspect the certificate at /opt/winlab/ssl-certificate-renewal/certs/current.pem
2. not_after is 2024-01-01 → the cert is expired, update to a future date (2027+)
3. not_after updated → also set cert.state to renewed
4. Fix → sed -i 's/^not_after=.*/not_after=2027-01-01T00:00:00Z/' /opt/winlab/ssl-certificate-renewal/certs/current.pem && echo renewed > /opt/winlab/ssl-certificate-renewal/cert.state
