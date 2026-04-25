# ghost-asset-incident — Solution

## INCIDENT SUMMARY
The `logo.svg` asset is missing from the CDN. The asset manifest at `manifests/assets.json` records it as `"missing"`, `assets/logo.svg.state` reads `missing`, and `cdn.state` reads `broken`. Users are seeing broken image placeholders. The asset must be declared restored in all three locations.

## ROOT CAUSE
`logo.svg` was deleted or never uploaded to the CDN origin, and the manifest was not updated to reflect its absence before the CDN cached the 404 response. The stale cache entry is now serving 404s to all users globally. Three records must be updated to restore the asset and invalidate the cache.

## FIX

```bash
# Step 1 — inspect the current manifest and states
cat /opt/winlab/ghost-asset-incident/manifests/assets.json
cat /opt/winlab/ghost-asset-incident/assets/logo.svg.state
cat /opt/winlab/ghost-asset-incident/cdn.state

# Step 2 — restore logo.svg in the asset manifest
sed -i 's/"logo.svg": "missing"/"logo.svg": "present"/' \
  /opt/winlab/ghost-asset-incident/manifests/assets.json

# Step 3 — update the asset state
echo restored > /opt/winlab/ghost-asset-incident/assets/logo.svg.state

# Step 4 — warm the CDN (purge and re-cache)
echo warm > /opt/winlab/ghost-asset-incident/cdn.state
```

## WHY THIS FIX WORKED
Updating the manifest tells the asset pipeline the file is present. Setting `logo.svg.state=restored` confirms the origin file is available. Setting `cdn.state=warm` simulates a CDN cache purge and re-population, so clients receive the asset instead of a cached 404.

## PRODUCTION LESSON
CDNs cache 404 responses by default. After restoring a missing asset, always purge the CDN cache explicitly — uploading the file to the origin is not enough. Use asset integrity hashes in HTML (`integrity="sha256-..."`) to detect missing assets before users do. Automate asset manifest validation in your CI pipeline so missing files are caught at deploy time.

## COMMANDS TO REMEMBER
```bash
cat /opt/winlab/ghost-asset-incident/manifests/assets.json
sed -i 's/"logo.svg": "missing"/"logo.svg": "present"/' manifests/assets.json
echo restored > /opt/winlab/ghost-asset-incident/assets/logo.svg.state
echo warm > /opt/winlab/ghost-asset-incident/cdn.state
```

## MENTOR_HINTS
1. logo.svg is showing as missing → inspect manifests/assets.json and assets/logo.svg.state
2. Both show missing → update assets.json to "present" and logo.svg.state to restored
3. Asset is restored → also set cdn.state to warm to simulate cache purge
4. Fix → sed -i 's/"logo.svg": "missing"/"logo.svg": "present"/' manifests/assets.json && echo restored > assets/logo.svg.state && echo warm > cdn.state
