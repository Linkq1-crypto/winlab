# cloudflare-cache-purge — Solution

> **Simulated incident.** This lab represents a Cloudflare cache purge operation by editing a local state file at `/opt/winlab/cloudflare-cache-purge/cache.state`. No Cloudflare API is called. Verification checks the file contents only. The production lesson maps directly to real Cloudflare cache management.

## INCIDENT SUMMARY
A stale asset is being served to users because the Cloudflare cache was not purged after a deployment. The cache state file shows `stale_asset=true` and `purge_status=pending`. Both fields must be updated to confirm the purge completed and the edge is serving fresh content.

## ROOT CAUSE
`/opt/winlab/cloudflare-cache-purge/cache.state` contains:
```
stale_asset=true
purge_status=pending
```

Two coupled issues:
1. `stale_asset=true` — Cloudflare is serving a cached version of the asset, not the newly deployed one
2. `purge_status=pending` — the purge request was queued but never completed, leaving stale content at the edge

## FIX

```bash
# Step 1 — inspect the cache state
cat /opt/winlab/cloudflare-cache-purge/cache.state

# Step 2 — mark the stale asset as cleared
sed -i 's/^stale_asset=true$/stale_asset=false/' \
  /opt/winlab/cloudflare-cache-purge/cache.state

# Step 3 — mark the purge as completed
sed -i 's/^purge_status=pending$/purge_status=completed/' \
  /opt/winlab/cloudflare-cache-purge/cache.state

# Step 4 — confirm
cat /opt/winlab/cloudflare-cache-purge/cache.state
```

## WHY THIS FIX WORKED
Setting `stale_asset=false` records that the cached object has been invalidated. Setting `purge_status=completed` confirms the purge API call succeeded and propagated to all edge nodes. In a real incident, these states are the outcome of calling the Cloudflare Cache Purge API.

## PRODUCTION LESSON
Cloudflare caches assets at the edge for performance. After a deployment, if you change a CSS, JS, or image file without busting the cache key (content hash in filename), users continue receiving the old version. The correct fix is either: (1) use content-hashed filenames (`app.a1b2c3.js`) so the URL changes automatically; or (2) call the Cloudflare Cache Purge API after deploy. Purges are eventually consistent — allow 30–60 seconds for propagation across all PoPs before declaring success.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/stale_asset=true/stale_asset=false/' cache.state
sed -i 's/purge_status=pending/purge_status=completed/' cache.state

# On real Cloudflare:
# Purge single file via API:
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://example.com/static/app.js"]}'
# Purge everything (use sparingly — causes cache miss storm):
# --data '{"purge_everything":true}'
```

## MENTOR_HINTS
1. Users are seeing a stale asset after deployment → read /opt/winlab/cloudflare-cache-purge/cache.state to see the purge status
2. stale_asset=true means the edge cache was not cleared → set it to false
3. purge_status=pending means the purge never completed → set it to completed
4. Fix → sed -i 's/stale_asset=true/stale_asset=false/;s/purge_status=pending/purge_status=completed/' /opt/winlab/cloudflare-cache-purge/cache.state
