# apache-ssl — Solution

## INCIDENT SUMMARY
The Apache virtual host is configured to use an expired SSL certificate. The `SSLCertificateFile` directive points to `/etc/ssl/winlab/expired.pem`. HTTPS connections will fail TLS handshake. A valid replacement certificate exists at `/etc/ssl/winlab/current.pem`.

## ROOT CAUSE
`/opt/winlab/apache-ssl/vhost.conf` contains:

```
SSLCertificateFile /etc/ssl/winlab/expired.pem
```

The cert is expired and the config has not been updated to reference the renewed certificate. The `cert.state` marker also reads `expired`, signalling that no rotation has been applied.

## FIX

```bash
# Step 1 — update the cert path
sed -i 's|expired.pem|current.pem|' /opt/winlab/apache-ssl/vhost.conf

# Step 2 — confirm the change
grep SSLCertificateFile /opt/winlab/apache-ssl/vhost.conf

# Step 3 — mark as active
echo active > /opt/winlab/apache-ssl/cert.state
```

## WHY THIS FIX WORKED
The vhost.conf file is the authoritative config for this virtual host. Pointing `SSLCertificateFile` at the valid certificate allows TLS handshakes to succeed. The `cert.state` marker is the verification signal used by monitoring.

## PRODUCTION LESSON
Automate certificate rotation with certbot or a cert-manager sidecar. Track expiry in a monitoring alert firing at 30 days before expiry — never at 0. Always stage the new cert on a non-prod vhost first and verify with `openssl s_client`.

## COMMANDS TO REMEMBER
```bash
openssl x509 -in /etc/ssl/winlab/current.pem -noout -dates  # check validity
openssl s_client -connect localhost:443 -servername app       # test TLS handshake
apachectl configtest                                          # validate apache config
apachectl graceful                                            # reload without dropping connections
```

## MENTOR_HINTS
1. HTTPS is failing with a certificate error → inspect the vhost config
2. SSLCertificateFile points to expired.pem → a current.pem exists in the same directory
3. Path needs updating from expired.pem to current.pem → edit vhost.conf
4. Fix → sed -i 's|expired.pem|current.pem|' /opt/winlab/apache-ssl/vhost.conf && echo active > /opt/winlab/apache-ssl/cert.state
