# advanced-scenarios/java-oom — Solution

> **Simulated incident.** This lab fixes a local JVM options file at `/opt/winlab/advanced-scenarios/jvm.options`. No Java process is running. Verification checks the file contents only. The production lesson maps directly to real JVM heap tuning.

## INCIDENT SUMMARY
The Java service is crashing with `OutOfMemoryError: Java heap space`. The JVM is configured with a maximum heap of only 128m, which is insufficient for the application's working set. The heap ceiling must be raised to 512m and the service state set to `stable`.

## ROOT CAUSE
`/opt/winlab/advanced-scenarios/jvm.options` contains:
```
-Xms128m
-Xmx128m
-XX:+UseSerialGC
```

`-Xmx128m` caps the heap at 128 MB. The application allocates more than this under normal load, causing the JVM to throw `OutOfMemoryError` and crash. `-XX:+UseSerialGC` (single-threaded garbage collection) makes heap pressure worse under concurrent load.

## FIX

```bash
# Step 1 — inspect the JVM options
cat /opt/winlab/advanced-scenarios/jvm.options

# Step 2 — raise the heap ceiling to 512m
sed -i 's/^-Xmx128m$/-Xmx512m/' \
  /opt/winlab/advanced-scenarios/jvm.options

# Step 3 — mark the service stable
echo stable > /opt/winlab/advanced-scenarios/service.state

# Step 4 — confirm
cat /opt/winlab/advanced-scenarios/jvm.options
cat /opt/winlab/advanced-scenarios/service.state
```

## WHY THIS FIX WORKED
Increasing `-Xmx512m` gives the heap four times more room. The garbage collector can now reclaim objects before the JVM is forced to throw `OutOfMemoryError`. The service stabilises and stops crashing.

## PRODUCTION LESSON
Set `-Xmx` to ~75% of the container/VM memory limit, not a round low number. On a 1 GB container, use `-Xmx768m`. Leave room for off-heap memory (thread stacks, native libraries, OS page cache). Use G1GC (`-XX:+UseG1GC`) instead of SerialGC for services under concurrent load — SerialGC stops the world for every collection. Enable GC logging (`-Xlog:gc*:file=/var/log/app/gc.log`) to observe the collection pattern before tuning. Alert on JVM heap usage > 85%.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/-Xmx128m/-Xmx512m/' /opt/winlab/advanced-scenarios/jvm.options
echo stable > /opt/winlab/advanced-scenarios/service.state

# On real systems:
java -XX:+PrintFlagsFinal -version | grep HeapSize   # current heap limits
jmap -heap <pid>                                      # live heap usage
jstat -gcutil <pid> 1000 10                          # GC stats every 1s, 10 times
jcmd <pid> GC.run                                    # force GC
```

## MENTOR_HINTS
1. Java service is crashing with OutOfMemoryError → read /opt/winlab/advanced-scenarios/jvm.options to find the heap setting
2. -Xmx128m caps the heap at 128 MB which is too low for the application → raise it to 512m
3. Change -Xmx128m to -Xmx512m so the JVM has enough heap to handle the workload
4. Fix → sed -i 's/-Xmx128m/-Xmx512m/' /opt/winlab/advanced-scenarios/jvm.options && echo stable > /opt/winlab/advanced-scenarios/service.state
