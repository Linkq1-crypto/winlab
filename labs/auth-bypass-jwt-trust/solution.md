# auth-bypass-jwt-trust — Solution

## INCIDENT SUMMARY
The authentication handler has a critical security flaw: it trusts the `role` claim from a JWT payload even when the signature has not been verified. An attacker can forge any role by crafting an unsigned or self-signed JWT. The code must be fixed to return `"guest"` when the signature is not verified, and marked with `JWT_SIGNATURE_REQUIRED=true`.

## ROOT CAUSE
`/opt/winlab/auth-bypass-jwt-trust/auth.js` contains:

```js
export function getAccess(payload, verifySignature) {
  if (!verifySignature) {
    return payload.role || "guest";
  }
  return payload.role;
}
```

When `verifySignature` is falsy, the function still returns `payload.role` from the untrusted payload. An attacker can pass `{ role: "admin" }` with any signature and receive admin access.

## FIX

```bash
# Step 1 — inspect the vulnerable code
cat /opt/winlab/auth-bypass-jwt-trust/auth.js

# Step 2 — rewrite the function to deny unverified payloads
cat > /opt/winlab/auth-bypass-jwt-trust/auth.js <<'EOF'
// JWT_SIGNATURE_REQUIRED=true
export function getAccess(payload, verifySignature) {
  if (!verifySignature) {
    return "guest";
  }
  return payload.role;
}
EOF
```

## WHY THIS FIX WORKED
When `verifySignature` is false, the function now returns `"guest"` unconditionally — the payload is not consulted. An unverified JWT provides no privilege escalation. The `JWT_SIGNATURE_REQUIRED=true` marker confirms the fix is intentional and gives auditors a searchable token.

## PRODUCTION LESSON
Never trust JWT claims without verifying the signature. Use `jsonwebtoken.verify()` with a known public key and check the `alg` field to prevent algorithm confusion attacks (e.g. RS256 → HS256 downgrade). Reject tokens with `alg: none`. Log every access grant — not just failures — so you can detect privilege escalation in your SIEM.

## COMMANDS TO REMEMBER
```bash
cat /opt/winlab/auth-bypass-jwt-trust/auth.js   # inspect the vulnerability
# Fix: return "guest" when verifySignature is false
# Add: // JWT_SIGNATURE_REQUIRED=true
# Remove: return payload.role || "guest"
```

## MENTOR_HINTS
1. Authentication may be granting roles without signature verification → read auth.js
2. When verifySignature is false, the code still returns payload.role → this allows JWT forgery
3. The fix is to return "guest" when the signature is not verified → rewrite the !verifySignature branch
4. Fix → replace "return payload.role || \"guest\"" with "return \"guest\"" and add // JWT_SIGNATURE_REQUIRED=true
