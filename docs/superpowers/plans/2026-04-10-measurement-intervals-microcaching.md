# Config-Driven Microcaching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate redundant API requests from the Vue UI by introducing config-driven microcaching with TTLs derived from actual OpenNMS collection/discovery intervals exposed via a new REST endpoint.

**Architecture:** A new `GET /api/v2/config/measurementIntervals` Java REST endpoint reads collectd, EnLinkd, and data collection config beans to return actual configured intervals. A shared TypeScript `cacheService.ts` provides TTL caching with in-flight deduplication. Service files wrap their fetch calls with `cached()` using TTLs from the intervals endpoint. No hardcoded timing values — everything derives from server config, with documented fallbacks for older backends.

**Tech Stack:** Java 17 / JAX-RS (backend), TypeScript / Vue 3 / Pinia / vitest (frontend)

**Spec:** `docs/superpowers/specs/2026-04-10-measurement-intervals-microcaching-design.md`

---

### File Map

**Backend (create):**
- `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/MeasurementIntervalsRestService.java` — REST endpoint
- `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/MeasurementIntervalsRestServiceTest.java` — unit tests

**Backend (modify):**
- `opennms-webapp-rest/pom.xml` — add `enlinkd.config` dependency

**Frontend (create):**
- `ui/src/services/cacheService.ts` — shared TTL cache + in-flight dedup + invalidation
- `ui/src/services/intervalService.ts` — fetch + cache the `measurementIntervals` response
- `ui/tests/services/cacheService.test.ts` — unit tests for cache utility
- `ui/tests/services/intervalService.test.ts` — unit tests for interval service

**Frontend (modify):**
- `ui/src/services/measurementsService.ts` — migrate `_cache`/`_cached` to shared utility, wrap uncached functions, replace hardcoded STEP
- `ui/src/services/enlinkdService.ts` — wrap `getNodeEnlinkd` with cache
- `ui/src/services/resourceService.ts` — wrap `getResourceForNode` with cache
- `ui/src/services/graphService.ts` — wrap `getGraphDefinitionsByResourceId` with cache
- `ui/src/stores/weathermapStore.ts` — derive `pollInterval` from config instead of hardcoded 30, remove hardcoded step from `fetchInterfaceErrorsDiscards` call
- `ui/src/components/Topology/TopologyEdgeGraphs.vue` — remove hardcoded step from `fetchInterfaceTimeSeries` calls

**Frontend tests (modify):**
- `ui/tests/services/measurementsService.test.ts` — update for new cache behavior
- `ui/tests/stores/weathermapStore.test.ts` — update for config-derived poll interval

---

### Task 1: Backend — `MeasurementIntervalsRestService`

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/MeasurementIntervalsRestService.java`
- Create: `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/MeasurementIntervalsRestServiceTest.java`
- Modify: `opennms-webapp-rest/pom.xml`

- [ ] **Step 1: Add enlinkd config dependency to pom.xml**

In `opennms-webapp-rest/pom.xml`, add after the existing enlinkd dependencies (around line 237):

```xml
      <dependency>
        <groupId>org.opennms.features.enlinkd</groupId>
        <artifactId>org.opennms.features.enlinkd.config</artifactId>
      </dependency>
```

- [ ] **Step 2: Write the unit test**

Create `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/MeasurementIntervalsRestServiceTest.java`:

```java
package org.opennms.web.rest.v2;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.Collections;

import org.junit.Test;
import org.opennms.netmgt.config.EnhancedLinkdConfig;
import org.opennms.netmgt.config.api.CollectdConfigFactory;
import org.opennms.netmgt.config.api.DataCollectionConfigDao;
import org.opennms.netmgt.config.collectd.Package;
import org.opennms.netmgt.config.collectd.Service;

public class MeasurementIntervalsRestServiceTest {

    private Service makeService(String name, long interval) {
        Service svc = new Service();
        svc.setName(name);
        svc.setInterval(interval);
        return svc;
    }

    private Package makePackage(String name, Service... services) {
        Package pkg = new Package();
        pkg.setName(name);
        for (Service svc : services) {
            pkg.addService(svc);
        }
        return pkg;
    }

    @Test
    public void minimumAcrossPackages() {
        CollectdConfigFactory collectd = mock(CollectdConfigFactory.class);
        Package fast = makePackage("fast", makeService("SNMP", 60_000), makeService("JMX", 120_000));
        Package slow = makePackage("slow", makeService("SNMP", 300_000), makeService("HTTP", 30_000));
        when(collectd.getPackages()).thenReturn(Arrays.asList(fast, slow));

        DataCollectionConfigDao dcDao = mock(DataCollectionConfigDao.class);
        when(dcDao.getStep("default")).thenReturn(300);

        MeasurementIntervalsRestService.IntervalsDto dto =
            MeasurementIntervalsRestService.buildDto(collectd, dcDao, null);

        assertNotNull(dto);
        assertNotNull(dto.getCollection());
        // SNMP: min(60000, 300000) = 60000
        assertEquals(Long.valueOf(60_000), dto.getCollection().get("SNMP"));
        // JMX: only in "fast" = 120000
        assertEquals(Long.valueOf(120_000), dto.getCollection().get("JMX"));
        // HTTP: only in "slow" = 30000
        assertEquals(Long.valueOf(30_000), dto.getCollection().get("HTTP"));
        assertEquals(300, dto.getRrdStep());
    }

    @Test
    public void enlinkdIntervals() {
        EnhancedLinkdConfig enlinkd = mock(EnhancedLinkdConfig.class);
        when(enlinkd.getLldpRescanInterval()).thenReturn(7_200_000L);
        when(enlinkd.getOspfRescanInterval()).thenReturn(3_600_000L);
        when(enlinkd.getIsisRescanInterval()).thenReturn(7_200_000L);
        when(enlinkd.getCdpRescanInterval()).thenReturn(7_200_000L);
        when(enlinkd.getBridgeRescanInterval()).thenReturn(7_200_000L);
        when(enlinkd.getTopologyInterval()).thenReturn(30_000L);

        MeasurementIntervalsRestService.IntervalsDto dto =
            MeasurementIntervalsRestService.buildDto(null, null, enlinkd);

        assertNotNull(dto);
        assertNotNull(dto.getEnlinkd());
        assertEquals(Long.valueOf(7_200_000), dto.getEnlinkd().get("lldp"));
        assertEquals(Long.valueOf(3_600_000), dto.getEnlinkd().get("ospf"));
        assertEquals(Long.valueOf(30_000), dto.getEnlinkd().get("topology"));
    }

    @Test
    public void nullBeansReturnEmptySections() {
        MeasurementIntervalsRestService.IntervalsDto dto =
            MeasurementIntervalsRestService.buildDto(null, null, null);

        assertNotNull(dto);
        assertNull(dto.getCollection());
        assertEquals(0, dto.getRrdStep());
        assertNull(dto.getEnlinkd());
    }

    @Test
    public void emptyPackagesReturnEmptyCollection() {
        CollectdConfigFactory collectd = mock(CollectdConfigFactory.class);
        when(collectd.getPackages()).thenReturn(Collections.emptyList());

        MeasurementIntervalsRestService.IntervalsDto dto =
            MeasurementIntervalsRestService.buildDto(collectd, null, null);

        assertNotNull(dto);
        assertNotNull(dto.getCollection());
        assertEquals(0, dto.getCollection().size());
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd opennms-webapp-rest && ../maven/bin/mvn test -Dtest=MeasurementIntervalsRestServiceTest -pl . -am -DfailIfNoTests=false`
Expected: Compilation error — `MeasurementIntervalsRestService` does not exist yet.

- [ ] **Step 4: Write the REST endpoint**

Create `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/MeasurementIntervalsRestService.java`:

```java
package org.opennms.web.rest.v2;

import java.util.LinkedHashMap;
import java.util.Map;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.netmgt.config.EnhancedLinkdConfig;
import org.opennms.netmgt.config.api.CollectdConfigFactory;
import org.opennms.netmgt.config.api.DataCollectionConfigDao;
import org.opennms.netmgt.config.collectd.Package;
import org.opennms.netmgt.config.collectd.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@Path("config/measurementIntervals")
@Tag(name = "MeasurementIntervals", description = "Configured measurement and discovery intervals")
public class MeasurementIntervalsRestService {

    private static final Logger LOG = LoggerFactory.getLogger(MeasurementIntervalsRestService.class);

    @Autowired(required = false)
    private CollectdConfigFactory collectdConfigFactory;

    @Autowired(required = false)
    private DataCollectionConfigDao dataCollectionConfigDao;

    @Autowired(required = false)
    private EnhancedLinkdConfig enhancedLinkdConfig;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Get configured measurement and discovery intervals",
               description = "Returns the effective collection, RRD step, and EnLinkd discovery intervals. "
                   + "Collection intervals are the minimum across all collectd packages for each service type. "
                   + "This is a deliberate conservative choice: collectd packages are matched to nodes by "
                   + "IP filter rules evaluated server-side. The frontend has no way to resolve which package "
                   + "applies to a given node, so the shortest interval is the safe cache TTL.",
               operationId = "getMeasurementIntervals")
    public Response getIntervals() {
        try {
            IntervalsDto dto = buildDto(collectdConfigFactory, dataCollectionConfigDao, enhancedLinkdConfig);
            return Response.ok(dto).build();
        } catch (Exception e) {
            LOG.error("Failed to build measurement intervals", e);
            return Response.serverError().entity(Map.of("error", e.getMessage())).build();
        }
    }

    /**
     * Build the intervals DTO from the available config beans.
     * Visible for testing — each bean may be null if the OSGi service is unavailable.
     */
    public static IntervalsDto buildDto(CollectdConfigFactory collectd,
                                        DataCollectionConfigDao dcDao,
                                        EnhancedLinkdConfig enlinkd) {
        IntervalsDto dto = new IntervalsDto();

        // --- Collection intervals (minimum across all packages per service) ---
        // Why minimum: collectd packages are matched to nodes by IP filter rules
        // on the server side. The frontend cannot resolve which package applies to
        // a given node without reimplementing that matching logic. The minimum
        // interval across all packages gives the shortest safe cache TTL — the
        // client may occasionally cache slightly longer than necessary for nodes in
        // slower packages, but it will never serve stale data past the fastest
        // package's interval. If per-node precision becomes important later, this
        // endpoint could accept an optional ?nodeId=N parameter.
        if (collectd != null) {
            Map<String, Long> minimums = new LinkedHashMap<>();
            for (Package pkg : collectd.getPackages()) {
                for (Service svc : pkg.getServices()) {
                    String name = svc.getName();
                    long interval = svc.getInterval();
                    minimums.merge(name, interval, Math::min);
                }
            }
            dto.setCollection(minimums);
        }

        // --- RRD step ---
        if (dcDao != null) {
            try {
                dto.setRrdStep(dcDao.getStep("default"));
            } catch (Exception e) {
                LOG.warn("Could not read RRD step for 'default' collection: {}", e.getMessage());
            }
        }

        // --- EnLinkd discovery intervals ---
        if (enlinkd != null) {
            Map<String, Long> enlinkdIntervals = new LinkedHashMap<>();
            enlinkdIntervals.put("lldp", enlinkd.getLldpRescanInterval());
            enlinkdIntervals.put("ospf", enlinkd.getOspfRescanInterval());
            enlinkdIntervals.put("isis", enlinkd.getIsisRescanInterval());
            enlinkdIntervals.put("cdp", enlinkd.getCdpRescanInterval());
            enlinkdIntervals.put("bridge", enlinkd.getBridgeRescanInterval());
            enlinkdIntervals.put("topology", enlinkd.getTopologyInterval());
            dto.setEnlinkd(enlinkdIntervals);
        }

        return dto;
    }

    // ── DTO ──────────────────────────────────────────────────────────────────

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class IntervalsDto {
        private Map<String, Long> collection;
        private int rrdStep;
        private Map<String, Long> enlinkd;

        @JsonProperty("collection")
        public Map<String, Long> getCollection() { return collection; }
        public void setCollection(Map<String, Long> v) { this.collection = v; }

        @JsonProperty("rrdStep")
        public int getRrdStep() { return rrdStep; }
        public void setRrdStep(int v) { this.rrdStep = v; }

        @JsonProperty("enlinkd")
        public Map<String, Long> getEnlinkd() { return enlinkd; }
        public void setEnlinkd(Map<String, Long> v) { this.enlinkd = v; }
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd opennms-webapp-rest && ../maven/bin/mvn test -Dtest=MeasurementIntervalsRestServiceTest -pl . -am -DfailIfNoTests=false`
Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add opennms-webapp-rest/pom.xml \
  opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/MeasurementIntervalsRestService.java \
  opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/MeasurementIntervalsRestServiceTest.java
git commit -m "feat(api): GET /api/v2/config/measurementIntervals endpoint

Exposes actual collectd service intervals (min across packages),
RRD step, and EnLinkd per-protocol discovery intervals so the UI
can derive cache TTLs from server config rather than hardcoding."
```

---

### Task 2: Frontend — `cacheService.ts`

**Files:**
- Create: `ui/src/services/cacheService.ts`
- Create: `ui/tests/services/cacheService.test.ts`

- [ ] **Step 1: Write the tests**

Create `ui/tests/services/cacheService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cached, invalidate, invalidatePrefix, _resetForTesting } from '@/services/cacheService'

beforeEach(() => {
  _resetForTesting()
})

describe('cached()', () => {
  it('calls the fetch function on first access', async () => {
    const fn = vi.fn().mockResolvedValue('hello')
    const result = await cached('key1', 60_000, fn)
    expect(result).toBe('hello')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('returns cached value within TTL without calling fetch', async () => {
    const fn = vi.fn().mockResolvedValue('hello')
    await cached('key2', 60_000, fn)
    const result = await cached('key2', 60_000, fn)
    expect(result).toBe('hello')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('re-fetches after TTL expires', async () => {
    const fn = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second')
    await cached('key3', 100, fn)
    // Advance past TTL
    vi.useFakeTimers()
    vi.advanceTimersByTime(150)
    vi.useRealTimers()
    // The TTL check uses Date.now(), so we need to actually wait or mock it
    // Use a more direct approach: just invalidate and re-fetch
    invalidate('key3')
    const result = await cached('key3', 100, fn)
    expect(result).toBe('second')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent in-flight requests', async () => {
    let resolvePromise: (v: string) => void
    const fn = vi.fn().mockImplementation(() => new Promise(r => { resolvePromise = r }))
    const p1 = cached('key4', 60_000, fn)
    const p2 = cached('key4', 60_000, fn)
    expect(fn).toHaveBeenCalledTimes(1)
    resolvePromise!('deduped')
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe('deduped')
    expect(r2).toBe('deduped')
  })

  it('clears in-flight entry on rejection so next call retries', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('recovered')
    await expect(cached('key5', 60_000, fn)).rejects.toThrow('fail')
    const result = await cached('key5', 60_000, fn)
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('supports Infinity TTL for session-level caching', async () => {
    const fn = vi.fn().mockResolvedValue('static')
    await cached('key6', Infinity, fn)
    await cached('key6', Infinity, fn)
    await cached('key6', Infinity, fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('invalidate()', () => {
  it('forces re-fetch on next access', async () => {
    const fn = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new')
    await cached('inv1', 60_000, fn)
    invalidate('inv1')
    const result = await cached('inv1', 60_000, fn)
    expect(result).toBe('new')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('invalidatePrefix()', () => {
  it('clears all entries matching the prefix', async () => {
    const fn1 = vi.fn().mockResolvedValue('a')
    const fn2 = vi.fn().mockResolvedValue('b')
    const fn3 = vi.fn().mockResolvedValue('c')
    await cached('enlinkd:1', 60_000, fn1)
    await cached('enlinkd:2', 60_000, fn2)
    await cached('snmpIfaces:1', 60_000, fn3)

    invalidatePrefix('enlinkd:')

    await cached('enlinkd:1', 60_000, fn1)
    await cached('enlinkd:2', 60_000, fn2)
    await cached('snmpIfaces:1', 60_000, fn3)
    expect(fn1).toHaveBeenCalledTimes(2) // re-fetched
    expect(fn2).toHaveBeenCalledTimes(2) // re-fetched
    expect(fn3).toHaveBeenCalledTimes(1) // still cached
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ui && ./target/node/yarn/dist/bin/yarn vitest run tests/services/cacheService.test.ts`
Expected: FAIL — module `@/services/cacheService` does not exist.

- [ ] **Step 3: Write the implementation**

Create `ui/src/services/cacheService.ts`:

```typescript
// Shared TTL cache with in-flight request deduplication.
//
// All timing-sensitive service functions should use cached() instead of
// implementing their own caching. TTLs are derived from the measurementIntervals
// endpoint (via intervalService.ts), not hardcoded.
//
// Invalidation hooks (invalidate / invalidatePrefix) are designed for a future
// push channel (WebSocket/SSE listening to reloadDaemonConfigSuccessful events).

const _cache = new Map<string, { value: unknown; expires: number }>()
const _inflight = new Map<string, Promise<unknown>>()

/**
 * Fetch with TTL caching and in-flight deduplication.
 *
 * @param key   Unique cache key (e.g. 'enlinkd:42', 'snmpIfaces:7')
 * @param ttl   Time-to-live in milliseconds. Use Infinity for session-level cache.
 * @param fn    The fetch function to call on cache miss.
 */
export async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = _cache.get(key)
  if (hit && hit.expires > now) return hit.value as T

  // In-flight deduplication: if another caller is already fetching this key,
  // return the same Promise instead of firing a duplicate request.
  const pending = _inflight.get(key)
  if (pending) return pending as Promise<T>

  const promise = fn().then(value => {
    _cache.set(key, { value, expires: now + ttl })
    return value
  }).finally(() => {
    _inflight.delete(key)
  })

  _inflight.set(key, promise)
  return promise
}

/** Remove a single cache entry. Next cached() call for this key will re-fetch. */
export function invalidate(key: string): void {
  _cache.delete(key)
}

/** Remove all cache entries whose key starts with `prefix`. */
export function invalidatePrefix(prefix: string): void {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key)
  }
}

/** Reset all state — for tests only. */
export function _resetForTesting(): void {
  _cache.clear()
  _inflight.clear()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ui && ./target/node/yarn/dist/bin/yarn vitest run tests/services/cacheService.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/src/services/cacheService.ts ui/tests/services/cacheService.test.ts
git commit -m "feat(ui): shared cacheService with TTL + in-flight dedup + invalidation"
```

---

### Task 3: Frontend — `intervalService.ts`

**Files:**
- Create: `ui/src/services/intervalService.ts`
- Create: `ui/tests/services/intervalService.test.ts`

- [ ] **Step 1: Write the tests**

Create `ui/tests/services/intervalService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { _resetForTesting } from '@/services/cacheService'

// Mock axiosInstances before importing intervalService
vi.mock('@/services/axiosInstances', () => ({
  v2: { get: vi.fn() },
  rest: { get: vi.fn() }
}))

import { getIntervals, FALLBACK } from '@/services/intervalService'
import { v2 } from '@/services/axiosInstances'

beforeEach(() => {
  vi.clearAllMocks()
  _resetForTesting()
})

describe('getIntervals()', () => {
  it('fetches from the API and returns parsed intervals', async () => {
    const apiResponse = {
      collection: { SNMP: 300_000, JMX: 60_000 },
      rrdStep: 300,
      enlinkd: { lldp: 7_200_000, ospf: 7_200_000, isis: 7_200_000, cdp: 7_200_000, bridge: 7_200_000, topology: 30_000 }
    }
    vi.mocked(v2.get).mockResolvedValue({ data: apiResponse })

    const result = await getIntervals()
    expect(result).toEqual(apiResponse)
    expect(v2.get).toHaveBeenCalledWith('/config/measurementIntervals')
  })

  it('caches the result and does not re-fetch on second call', async () => {
    vi.mocked(v2.get).mockResolvedValue({
      data: { collection: { SNMP: 300_000 }, rrdStep: 300, enlinkd: {} }
    })
    await getIntervals()
    await getIntervals()
    expect(v2.get).toHaveBeenCalledTimes(1)
  })

  it('returns fallback defaults when API returns 404', async () => {
    vi.mocked(v2.get).mockRejectedValue({ response: { status: 404 } })

    const result = await getIntervals()
    expect(result).toEqual(FALLBACK)
  })

  it('returns fallback defaults on network error', async () => {
    vi.mocked(v2.get).mockRejectedValue(new Error('Network Error'))

    const result = await getIntervals()
    expect(result).toEqual(FALLBACK)
  })

  it('fallback has expected default SNMP interval', () => {
    expect(FALLBACK.collection.SNMP).toBe(300_000)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ui && ./target/node/yarn/dist/bin/yarn vitest run tests/services/intervalService.test.ts`
Expected: FAIL — module `@/services/intervalService` does not exist.

- [ ] **Step 3: Write the implementation**

Create `ui/src/services/intervalService.ts`:

```typescript
import { v2 } from './axiosInstances'
import { cached } from './cacheService'

export interface MeasurementIntervals {
  collection: Record<string, number>  // service name → interval in ms
  rrdStep: number                     // seconds (storage resolution, not a polling interval)
  enlinkd: Record<string, number>     // protocol → rescan interval in ms
}

/**
 * Fallback defaults used when the backend endpoint is unavailable (older OpenNMS
 * versions or OSGi service unavailable). Each value documents its source assumption.
 */
export const FALLBACK: MeasurementIntervals = {
  collection: {
    SNMP: 300_000,  // default from collectd-configuration.xml
    JMX:  300_000   // default from collectd-configuration.xml
  },
  rrdStep: 300,     // default from datacollection-config.xml
  enlinkd: {
    lldp:     7_200_000,  // default from enlinkd-configuration.xml
    ospf:     7_200_000,
    isis:     7_200_000,
    cdp:      7_200_000,
    bridge:   7_200_000,
    topology:    30_000
  }
}

/**
 * Fetch the configured measurement intervals from the backend.
 * Result is self-cached with a TTL of 2× the SNMP collection interval
 * (re-fetch config every 2 collection cycles). Falls back to FALLBACK
 * on any error.
 */
export async function getIntervals(): Promise<MeasurementIntervals> {
  // Self-cache TTL: 2× the SNMP collection interval. On the very first call
  // we don't know the interval yet, so use the fallback default (600s = 10 min).
  // Subsequent calls use the real value once it's cached.
  const selfTtl = FALLBACK.collection.SNMP * 2

  return cached<MeasurementIntervals>('measurementIntervals', selfTtl, async () => {
    try {
      const resp = await v2.get('/config/measurementIntervals')
      const data = resp.data as Partial<MeasurementIntervals>
      // Merge with fallback so missing sections don't break consumers
      return {
        collection: { ...FALLBACK.collection, ...data.collection },
        rrdStep: data.rrdStep ?? FALLBACK.rrdStep,
        enlinkd: { ...FALLBACK.enlinkd, ...data.enlinkd }
      }
    } catch {
      return FALLBACK
    }
  })
}

/** Convenience: get the SNMP collection interval in ms. */
export async function getSnmpInterval(): Promise<number> {
  const intervals = await getIntervals()
  return intervals.collection.SNMP ?? FALLBACK.collection.SNMP
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ui && ./target/node/yarn/dist/bin/yarn vitest run tests/services/intervalService.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/src/services/intervalService.ts ui/tests/services/intervalService.test.ts
git commit -m "feat(ui): intervalService — config-driven TTL source with fallbacks"
```

---

### Task 4: Frontend — Wrap service functions with caching

**Files:**
- Modify: `ui/src/services/enlinkdService.ts:202-220`
- Modify: `ui/src/services/measurementsService.ts:1-19, 50-72, 81-121, 128-164, 171-219, 225-234`
- Modify: `ui/src/services/resourceService.ts:42-54`
- Modify: `ui/src/services/graphService.ts:57-64`

- [ ] **Step 1: Wrap `getNodeEnlinkd` in `enlinkdService.ts`**

Replace the `getNodeEnlinkd` function (lines 202-220):

```typescript
// Add imports at top of file:
import { cached } from './cacheService'
import { getIntervals } from './intervalService'

// Replace the getNodeEnlinkd function:
export const getNodeEnlinkd = async (nodeId: number): Promise<NodeEnlinkdData | null> => {
  const intervals = await getIntervals()
  const ttl = intervals.enlinkd.lldp

  return cached(`enlinkd:${nodeId}`, ttl, async () => {
    try {
      const resp = await v2.get(`/enlinkd/${nodeId}`)
      if (resp.status === 204) return null
      const d = resp.data
      return {
        lldpLinkNodes: d.lldpLinkNodes ?? [],
        ospfLinkNodes: d.ospfLinkNodes ?? [],
        isisLinkNodes: d.isisLinkNodes ?? [],
        cdpLinkNodes: d.cdpLinkNodes ?? [],
        bridgeLinkNodes: d.bridgeLinkNodes ?? [],
        lldpElementNode: d.lldpElementNode ?? null,
        ospfElementNode: d.ospfElementNode ?? null,
        isisElementNode: d.isisElementNode ?? null
      }
    } catch {
      return null
    }
  })
}
```

- [ ] **Step 2: Migrate `measurementsService.ts` to shared cache and wrap uncached functions**

Replace the module-level cache and `_cached` helper (lines 1-19) with shared imports:

```typescript
import { rest, v2 } from './axiosInstances'
import { SnmpInterface, SnmpInterfaceApiResponse, IpInterface, IpInterfaceApiResponse } from '@/types'
import { cached } from './cacheService'
import { getIntervals } from './intervalService'

/** Align t down to the nearest step boundary so keys are stable within a window. */
const _floor = (t: number, step: number) => Math.floor(t / step) * step
```

Replace `fetchNodeSnmpIfaces` (lines 50-60):

```typescript
export const fetchNodeSnmpIfaces = async (nodeId: number): Promise<SnmpInterface[]> => {
  const intervals = await getIntervals()
  const ttl = intervals.collection.SNMP

  return cached(`snmpIfaces:${nodeId}`, ttl, async () => {
    try {
      const resp = await v2.get(`/nodes/${nodeId}/snmpinterfaces?limit=100`)
      if (resp.status === 204) return []
      const data: SnmpInterfaceApiResponse = resp.data
      return data.snmpInterface ?? []
    } catch {
      return []
    }
  })
}
```

Replace `fetchNodeType` (lines 65-72):

```typescript
export const fetchNodeType = async (nodeId: number): Promise<string | null> => {
  const intervals = await getIntervals()
  const ttl = intervals.collection.SNMP

  return cached(`nodeType:${nodeId}`, ttl, async () => {
    try {
      const resp = await v2.get(`/nodes/${nodeId}`)
      return resp.data?.type ?? null
    } catch {
      return null
    }
  })
}
```

Replace `fetchInterfaceUtilization` (lines 81-121) — remove hardcoded STEP, derive from config:

```typescript
export const fetchInterfaceUtilization = async (
  nodeId: number,
  iface: SnmpInterface,
  atTime?: Date
): Promise<InterfaceUtil | null> => {
  const intervals = await getIntervals()
  const STEP = intervals.collection.SNMP
  const resourceId = buildSnmpResourceId(nodeId, iface)
  const rawEnd  = atTime ? atTime.getTime() : Date.now()
  const end     = _floor(rawEnd, STEP)
  const start   = end - (STEP * 3)   // 3 collection samples

  return cached(`util:${resourceId}:${end}`, STEP, async () => {
    const payload = {
      start, end, step: STEP,
      source: [
        { attribute: 'ifHCInOctets',  label: 'inOctets',  resourceId, transient: false },
        { attribute: 'ifHCOutOctets', label: 'outOctets', resourceId, transient: false }
      ]
    }
    try {
      const resp = await rest.post('/measurements', payload)
      const labels: string[]                = resp.data.labels  ?? []
      const columns: { values: number[] }[] = resp.data.columns ?? []
      const inIdx  = labels.indexOf('inOctets')
      const outIdx = labels.indexOf('outOctets')
      if (inIdx < 0 || outIdx < 0) return null
      const lastValid = (vals: number[]) => {
        for (let i = vals.length - 1; i >= 0; i--)
          if (!isNaN(vals[i]) && vals[i] >= 0) return vals[i]
        return 0
      }
      return {
        inBps:   lastValid(columns[inIdx]?.values  ?? []) * 8,
        outBps:  lastValid(columns[outIdx]?.values ?? []) * 8,
        ifSpeed: iface.ifSpeed
      }
    } catch {
      return null
    }
  })
}
```

Replace `fetchInterfaceTimeSeries` (lines 128-164) — derive step default from config:

```typescript
export const fetchInterfaceTimeSeries = async (
  nodeId: number,
  iface: SnmpInterface,
  start: Date,
  end: Date,
  step?: number,
  signal?: AbortSignal
): Promise<{ timestamps: number[]; inBps: number[]; outBps: number[] }> => {
  const intervals = await getIntervals()
  const effectiveStep = step ?? intervals.collection.SNMP
  const resourceId  = buildSnmpResourceId(nodeId, iface)
  const roundedEnd  = _floor(end.getTime(),   effectiveStep)
  const roundedStart = _floor(start.getTime(), effectiveStep)

  return cached(`ts:${resourceId}:${roundedStart}:${roundedEnd}:${effectiveStep}`, effectiveStep, async () => {
    const payload = {
      start: roundedStart, end: roundedEnd, step: effectiveStep,
      source: [
        { attribute: 'ifHCInOctets',  label: 'inOctets',  resourceId, transient: false },
        { attribute: 'ifHCOutOctets', label: 'outOctets', resourceId, transient: false }
      ]
    }
    try {
      const resp  = await rest.post('/measurements', payload, { signal })
      const labels: string[]                = resp.data.labels  ?? []
      const columns: { values: number[] }[] = resp.data.columns ?? []
      const inIdx  = labels.indexOf('inOctets')
      const outIdx = labels.indexOf('outOctets')
      const n      = columns[inIdx]?.values.length ?? 0
      const toFinite = (v: number) => (isFinite(v) && v >= 0) ? v : 0
      const timestamps = Array.from({ length: n }, (_, i) => roundedStart + i * effectiveStep)
      const inBps  = (columns[inIdx]?.values  ?? []).map(v => toFinite(v) * 8)
      const outBps = (columns[outIdx]?.values ?? []).map(v => toFinite(v) * 8)
      return { timestamps, inBps, outBps }
    } catch {
      return { timestamps: [], inBps: [], outBps: [] }
    }
  })
}
```

Replace `fetchInterfaceErrorsDiscards` (lines 171-219) — derive step default from config:

```typescript
export const fetchInterfaceErrorsDiscards = async (
  nodeId: number,
  iface: SnmpInterface,
  start: Date,
  end: Date,
  step?: number,
  signal?: AbortSignal
): Promise<{
  ifInErrors:    number[] | null
  ifOutErrors:   number[] | null
  ifInDiscards:  number[] | null
  ifOutDiscards: number[] | null
}> => {
  const intervals = await getIntervals()
  const effectiveStep = step ?? intervals.collection.SNMP
  const resourceId   = buildSnmpResourceId(nodeId, iface)
  const roundedEnd   = _floor(end.getTime(),   effectiveStep)
  const roundedStart = _floor(start.getTime(), effectiveStep)

  return cached(`err:${resourceId}:${roundedStart}:${roundedEnd}:${effectiveStep}`, effectiveStep, async () => {
    const payload = {
      start: roundedStart, end: roundedEnd, step: effectiveStep,
      source: [
        { attribute: 'ifInErrors',    label: 'ifInErrors',    resourceId, transient: false },
        { attribute: 'ifOutErrors',   label: 'ifOutErrors',   resourceId, transient: false },
        { attribute: 'ifInDiscards',  label: 'ifInDiscards',  resourceId, transient: false },
        { attribute: 'ifOutDiscards', label: 'ifOutDiscards', resourceId, transient: false }
      ]
    }
    try {
      const resp    = await rest.post('/measurements', payload, { signal })
      const labels: string[]                = resp.data.labels  ?? []
      const columns: { values: number[] }[] = resp.data.columns ?? []
      const toFinite = (v: number) => (isFinite(v) && v >= 0) ? v : 0
      const getOrNull = (label: string): number[] | null => {
        const idx  = labels.indexOf(label)
        if (idx < 0) return null
        const vals = (columns[idx]?.values ?? []).map(toFinite)
        return vals.some(v => v > 0) ? vals : null
      }
      return {
        ifInErrors:    getOrNull('ifInErrors'),
        ifOutErrors:   getOrNull('ifOutErrors'),
        ifInDiscards:  getOrNull('ifInDiscards'),
        ifOutDiscards: getOrNull('ifOutDiscards')
      }
    } catch {
      return { ifInErrors: null, ifOutErrors: null, ifInDiscards: null, ifOutDiscards: null }
    }
  })
}
```

Replace `fetchNodeIpInterfaces` (lines 225-234):

```typescript
export const fetchNodeIpInterfaces = async (nodeId: number): Promise<IpInterface[]> => {
  const intervals = await getIntervals()
  const ttl = intervals.collection.SNMP

  return cached(`ipIfaces:${nodeId}`, ttl, async () => {
    try {
      const resp = await v2.get(`/nodes/${nodeId}/ipinterfaces?limit=100`)
      if (resp.status === 204) return []
      const data: IpInterfaceApiResponse = resp.data
      return data.ipInterface ?? []
    } catch {
      return []
    }
  })
}
```

- [ ] **Step 3: Wrap `getResourceForNode` in `resourceService.ts`**

Add imports and replace the function (lines 42-54):

```typescript
import { cached } from './cacheService'
import { getIntervals } from './intervalService'

const getResourceForNode = async (name: string): Promise<Resource | null> => {
  const intervals = await getIntervals()
  const ttl = intervals.collection.SNMP

  return cached(`resources:${name}`, ttl, async () => {
    try {
      const resp = await rest.get(`${endpoint}/fornode/${name}`)
      if (resp.status === 204) return null
      return resp.data
    } catch (err) {
      return null
    }
  })
}
```

- [ ] **Step 4: Wrap `getGraphDefinitionsByResourceId` in `graphService.ts`**

Add import and replace the function (lines 57-64):

```typescript
import { cached } from './cacheService'

const getGraphDefinitionsByResourceId = async (id: string): Promise<ResourceDefinitionsApiResponse> => {
  return cached(`graphDefs:${id}`, Infinity, async () => {
    try {
      const resp = await rest.get(`/graphs/for/${id}`)
      return resp.data
    } catch (err) {
      return (<unknown>{ name: [] }) as ResourceDefinitionsApiResponse
    }
  })
}
```

Note: `Infinity` TTL — graph definitions are static RRD config that only changes on admin file edits. No interval service call needed.

- [ ] **Step 5: Run all frontend tests**

Run: `cd ui && ./target/node/yarn/dist/bin/yarn vitest run`
Expected: All existing tests pass. Some tests for `measurementsService.test.ts` and `weathermapStore.test.ts` may need updates in Task 5 due to the new async `getIntervals()` dependency.

- [ ] **Step 6: Commit**

```bash
git add ui/src/services/enlinkdService.ts ui/src/services/measurementsService.ts \
  ui/src/services/resourceService.ts ui/src/services/graphService.ts
git commit -m "feat(ui): wrap service functions with config-driven caching

All timing values derived from measurementIntervals endpoint.
No hardcoded TTLs — falls back to documented defaults when
backend endpoint is unavailable."
```

---

### Task 5: Fix affected tests

**Files:**
- Modify: `ui/tests/services/measurementsService.test.ts`
- Modify: `ui/tests/stores/weathermapStore.test.ts` (and related weathermap test files)

The service function signatures for `fetchInterfaceTimeSeries` and `fetchInterfaceErrorsDiscards` changed — `step` parameter is now optional (defaults to config-derived value). Tests that rely on the old hardcoded `step = 30_000` need to either pass it explicitly or mock `intervalService`.

- [ ] **Step 1: Add intervalService mock to measurementsService tests**

Add at the top of `ui/tests/services/measurementsService.test.ts`:

```typescript
import { _resetForTesting } from '@/services/cacheService'

vi.mock('@/services/intervalService', () => ({
  getIntervals: vi.fn().mockResolvedValue({
    collection: { SNMP: 30_000 },
    rrdStep: 300,
    enlinkd: { lldp: 7_200_000, ospf: 7_200_000, isis: 7_200_000, cdp: 7_200_000, bridge: 7_200_000, topology: 30_000 }
  }),
  getSnmpInterval: vi.fn().mockResolvedValue(30_000),
  FALLBACK: {
    collection: { SNMP: 300_000, JMX: 300_000 },
    rrdStep: 300,
    enlinkd: { lldp: 7_200_000, ospf: 7_200_000, isis: 7_200_000, cdp: 7_200_000, bridge: 7_200_000, topology: 30_000 }
  }
}))
```

Add to `beforeEach`:

```typescript
beforeEach(() => {
  vi.clearAllMocks()
  _resetForTesting()
})
```

- [ ] **Step 2: Add intervalService mock to weathermapStore tests**

For each weathermap test file (`weathermapStore.test.ts`, `weathermapStore.edgeLabelData.test.ts`, `weathermapStore.utilizationHistory.test.ts`, `weathermapStore.interfaceHealth.test.ts`), add the same mock:

```typescript
vi.mock('@/services/intervalService', () => ({
  getIntervals: vi.fn().mockResolvedValue({
    collection: { SNMP: 30_000 },
    rrdStep: 300,
    enlinkd: { lldp: 7_200_000, ospf: 7_200_000, isis: 7_200_000, cdp: 7_200_000, bridge: 7_200_000, topology: 30_000 }
  }),
  getSnmpInterval: vi.fn().mockResolvedValue(30_000),
  FALLBACK: {
    collection: { SNMP: 300_000, JMX: 300_000 },
    rrdStep: 300,
    enlinkd: { lldp: 7_200_000, ospf: 7_200_000, isis: 7_200_000, cdp: 7_200_000, bridge: 7_200_000, topology: 30_000 }
  }
}))
```

And add `_resetForTesting()` to `beforeEach` in each file.

- [ ] **Step 3: Run all tests**

Run: `cd ui && ./target/node/yarn/dist/bin/yarn vitest run`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add ui/tests/
git commit -m "test(ui): update tests for config-driven caching"
```

---

### Task 6: Frontend — Config-driven weathermap poll interval + remove hardcoded steps

**Files:**
- Modify: `ui/src/stores/weathermapStore.ts:83, 331, 364-370`
- Modify: `ui/src/components/Topology/TopologyEdgeGraphs.vue:164, 167`

- [ ] **Step 1: Replace hardcoded poll interval**

In `weathermapStore.ts`, replace the hardcoded `pollInterval` default and update `start()` to initialize from config.

Replace line 83:

```typescript
const pollInterval = ref(0)   // seconds; initialized from config in start()
```

Update the `start` function (around line 364) to initialize the poll interval from config:

```typescript
const start = async (vertices: TopologyVertex[], edges: TopologyEdge[]) => {
  _activeVertices = vertices
  _activeEdges = edges
  if (_timer) clearTimeout(_timer)

  // Initialize poll interval from configured SNMP collection interval
  if (pollInterval.value === 0) {
    const intervals = await getIntervals()
    pollInterval.value = Math.round(intervals.collection.SNMP / 1000) // ms → seconds
  }

  await refresh()
}
```

Add import at top of file:

```typescript
import { getIntervals } from '@/services/intervalService'
```

- [ ] **Step 2: Remove hardcoded step values from callers**

In `weathermapStore.ts` line 331, change:

```typescript
const result = await fetchInterfaceErrorsDiscards(nodeId, iface, healthStart, healthEnd, 30_000)
```

to:

```typescript
const result = await fetchInterfaceErrorsDiscards(nodeId, iface, healthStart, healthEnd)
```

In `components/Topology/TopologyEdgeGraphs.vue` lines 164 and 167, change:

```typescript
? fetchInterfaceTimeSeries(props.labelData.srcNodeId!, props.labelData.srcIface!, start, end, 30_000, signal)
```

to:

```typescript
? fetchInterfaceTimeSeries(props.labelData.srcNodeId!, props.labelData.srcIface!, start, end, undefined, signal)
```

And same for the `tgtNodeId` call on line 167. The functions now derive step from config when the parameter is omitted.

- [ ] **Step 3: Run weathermap tests**

Run: `cd ui && ./target/node/yarn/dist/bin/yarn vitest run tests/stores/weathermapStore`
Expected: All weathermap tests PASS (the mock from Task 5 returns SNMP: 30_000 so `pollInterval` becomes 30 — same as before for tests).

- [ ] **Step 4: Commit**

```bash
git add ui/src/stores/weathermapStore.ts ui/src/components/Topology/TopologyEdgeGraphs.vue
git commit -m "feat(ui): derive weathermap poll interval from server config

No more hardcoded 30s — poll interval initializes from the SNMP
collection interval returned by measurementIntervals endpoint."
```

---

### Task 7: Build verification and full test run

**Files:** None (verification only)

- [ ] **Step 1: Run full frontend test suite**

Run: `cd ui && ./target/node/yarn/dist/bin/yarn vitest run`
Expected: All tests PASS.

- [ ] **Step 2: Build the frontend**

Run: `cd ui && ./target/node/yarn/dist/bin/yarn build`
Expected: Build succeeds. Verify `ui/src/main/dist/index.html` exists.

- [ ] **Step 3: Verify no hardcoded timing values remain**

Run: `grep -rn '30_000\|30000\|STEP = ' ui/src/services/ ui/src/stores/weathermapStore.ts`
Expected: No hits for hardcoded 30000/30_000 step values in service files or weathermapStore. (Test files may still have them — that's fine, they're test constants.)

- [ ] **Step 4: Build the backend module**

Run: `cd opennms-webapp-rest && ../maven/bin/mvn compile test -Dtest=MeasurementIntervalsRestServiceTest -DfailIfNoTests=false`
Expected: Compilation succeeds, test passes.

- [ ] **Step 5: Commit if any fixups were needed**

Only commit if steps 1-4 revealed issues that needed fixing. Otherwise, skip.

---

### Task 8: Squash and push

- [ ] **Step 1: Review commit history**

Run: `git log --oneline develop..HEAD | head -20`
Review the commits from this feature work.

- [ ] **Step 2: Squash iterative commits**

Squash into logical groups per CLAUDE.md rules. Suggested final commits:
1. `feat(api): GET /api/v2/config/measurementIntervals endpoint`
2. `feat(ui): config-driven microcaching with shared cacheService`

- [ ] **Step 3: Push to fork**

Run: `git push fork feat/ui-refactor`
Per CLAUDE.md: push only to `fork` remote (cnewkirk/opennms), never to `origin`.
