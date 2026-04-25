# redis-oom — Solution

## INCIDENT SUMMARY
Redis is in an OOM (out-of-memory) error state. The config sets `maxmemory 16mb` with `maxmemory-policy noeviction` — meaning Redis refuses all writes when the limit is reached rather than evicting old keys. A 24 MB stale `cache.rdb` dump is also consuming disk. Both must be fixed to restore stability.

## ROOT CAUSE
`/opt/winlab/redis-oom/redis.conf` contains:
```
maxmemory 16mb
maxmemory-policy noeviction
```

With `noeviction`, Redis returns `OOM command not allowed` errors on every write once the 16 MB limit is hit. The 24 MB `cache.rdb` is an oversized snapshot that should have been evicted by a proper LRU policy.

## FIX

```bash
# Step 1 — inspect the config
cat /opt/winlab/redis-oom/redis.conf

# Step 2 — switch eviction policy to allkeys-lru
sed -i 's/^maxmemory-policy .*/maxmemory-policy allkeys-lru/' \
  /opt/winlab/redis-oom/redis.conf

# Step 3 — remove the oversized RDB snapshot
rm /opt/winlab/redis-oom/cache.rdb

# Step 4 — confirm config is correct
grep maxmemory /opt/winlab/redis-oom/redis.conf

# Step 5 — mark service as stable
echo stable > /opt/winlab/redis-oom/service.state
```

## WHY THIS FIX WORKED
`allkeys-lru` evicts the least-recently-used keys when the memory limit is reached, keeping Redis writable under pressure instead of hard-failing. Removing the stale RDB reclaims disk space and prevents a full re-load of expired data on restart.

## PRODUCTION LESSON
`noeviction` is the wrong policy for any cache workload. Use `allkeys-lru` for pure caches or `volatile-lru` if you use Redis both as cache and session store. Always set `maxmemory` and pair it with an appropriate eviction policy. Monitor `used_memory_human` and `mem_fragmentation_ratio` via `redis-cli INFO memory`.

## COMMANDS TO REMEMBER
```bash
cat /opt/winlab/redis-oom/redis.conf                       # inspect
sed -i 's/maxmemory-policy.*/maxmemory-policy allkeys-lru/' redis.conf
rm /opt/winlab/redis-oom/cache.rdb                         # remove stale dump
echo stable > /opt/winlab/redis-oom/service.state
redis-cli INFO memory                                       # on live systems
```

## MENTOR_HINTS
1. Redis is rejecting writes with OOM errors → inspect the eviction policy in redis.conf
2. maxmemory-policy is noeviction → change to allkeys-lru and remove the stale cache.rdb
3. Config and disk cleaned up → update service.state to stable to complete the fix
4. Fix → sed -i 's/^maxmemory-policy .*/maxmemory-policy allkeys-lru/' /opt/winlab/redis-oom/redis.conf && rm /opt/winlab/redis-oom/cache.rdb && echo stable > /opt/winlab/redis-oom/service.state
