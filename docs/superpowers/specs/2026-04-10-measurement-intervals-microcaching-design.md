# Config-Driven Microcaching via `measurementIntervals` Endpoint

**Date:** 2026-04-10
**Status:** Draft
**Branch:** `feat/ui-refactor`

## Problem

The Vue UI has no request-level caching outside of `measurementsService.ts`. The topology weathermap polling loop re-fetches mostly-static data (SNMP interfaces, IP interfaces, EnLinkd topology, node type) every 30 seconds for every node. The resource graph panel re-fetches resource lists and graph definitions on every panel mount. All TTLs in the existing measurements cache are hardcoded at 30 seconds regardless of actual configured collection intervals.

The result: a 10-node topology generates ~40 redundant API requests every 30 seconds for data that changes on the order of minutes to hours.

## Solution

A two-layer approach:

1. **Backend:** A new REST endpoint that exposes the actual configured measurement and discovery intervals, so the frontend can ground its cache TTLs in server truth rather than hardcoded guesses.
2. **Frontend:** A shared caching utility that all service files use, with TTLs derived from the backend endpoint, in-flight request deduplication, and an invalidation hook ready for a future push channel.

## Backend: `GET /api/v2/config/measurementIntervals`

### Location

New class `MeasurementIntervalsRestService` in `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/`.

### Injected Beans

All via `@Autowired(required=false)` for OSGi safety:

- **`CollectdConfigFactory`** — iterate packages → services → `getInterval()` per service name
- **`DataCollectionConfigDao`** — `getStep(collectionName)` for the RRD storage step
- **`EnhancedLinkdConfig`** — per-protocol rescan intervals and topology interval

### Response Shape

All interval values in milliseconds. `rrdStep` in seconds (matching existing `DatacollectionConfig` convention since it represents storage resolution, not a polling interval).

```json
{
  "collection": {
    "SNMP": 300000,
    "JMX": 300000,
    "HTTP": 60000,
    "WS-Man": 300000
  },
  "rrdStep": 300,
  "enlinkd": {
    "lldp": 7200000,
    "ospf": 7200000,
    "isis": 7200000,
    "cdp": 7200000,
    "bridge": 7200000,
    "topology": 30000
  }
}
```

### Minimum-Across-Packages Decision

The `collection` object maps service name → the **minimum** interval found across all collectd packages for that service.

**Why minimum, not per-package:** Collectd packages are matched to nodes by IP filter rules evaluated server-side. The frontend has no way to resolve which package applies to a given node without reimplementing that matching logic. Using the minimum interval across all packages gives the shortest safe TTL — the frontend may occasionally cache slightly longer than necessary for nodes in slower packages, but it will never serve stale data past the fastest package's interval.

This is a deliberate conservative choice. If per-node precision becomes important later, the endpoint could be extended with an optional `?nodeId=N` parameter that resolves the effective package server-side. For now, the global minimum covers the use case without complexity.

### Auth

No special role required beyond a valid session. This is read-only configuration metadata, not sensitive operational data.

### Graceful Degradation

If any injected bean is null (OSGi service not available), that section of the response is omitted rather than returning a 500. The frontend handles missing sections via its fallback defaults.

## Frontend: `cacheService.ts`

### Location

`ui/src/services/cacheService.ts` — shared utility imported by all service files that need caching.

### Responsibilities

**1. TTL cache**

Generic `cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T>`. Module-level `Map<string, { value: unknown; expires: number }>`. Same semantics as the existing `_cached()` in `measurementsService.ts`, but shared. A `ttl` of `Infinity` means "never expire" (session-level cache) — used for static data like graph definitions.

**2. In-flight deduplication**

A second `Map<string, Promise<unknown>>` tracking pending requests. If `cached()` has a cache miss and a request for the same key is already in flight, it returns the existing Promise instead of firing a duplicate HTTP request. The entry is removed on Promise settlement (resolve or reject).

**3. Invalidation hooks**

- `invalidate(key: string)` — removes a single cache entry
- `invalidatePrefix(prefix: string)` — clears all entries whose key starts with `prefix` (e.g., `invalidatePrefix('enlinkd:')`)

These hooks exist so a future push channel (WebSocket/SSE subscribed to `uei.opennms.org/internal/reloadDaemonConfigSuccessful` events) can invalidate the cache without polling. The architecture is push-ready; the push channel itself is out of scope.

## Frontend: `intervalService.ts`

### Location

`ui/src/services/intervalService.ts`

### Behavior

- `getIntervals(): Promise<MeasurementIntervals>` — returns the parsed `measurementIntervals` response
- First call fetches from `GET /api/v2/config/measurementIntervals`
- Result is cached with a 10-minute TTL via `cacheService.cached()` (eating our own cooking)
- If the endpoint returns 404 or a network error (older backend without the endpoint), falls back to hardcoded conservative defaults

### Fallback Defaults

```typescript
const FALLBACK: MeasurementIntervals = {
  collection: { SNMP: 300_000, JMX: 300_000 },
  rrdStep: 300,
  enlinkd: {
    lldp: 7_200_000,    // default from enlinkd-configuration.xml
    ospf: 7_200_000,
    isis: 7_200_000,
    cdp: 7_200_000,
    bridge: 7_200_000,
    topology: 30_000
  }
}
```

The fallback matters because this feature may ship on the fork branch before the backend endpoint exists upstream, or an admin may run a newer UI against an older backend. It degrades gracefully to documented heuristic TTLs rather than breaking.

## Frontend: Service File Changes

### Functions That Gain Caching

| Function | File | Cache key | TTL source |
|---|---|---|---|
| `getNodeEnlinkd(nodeId)` | `enlinkdService.ts` | `enlinkd:{nodeId}` | `enlinkd.lldp` |
| `fetchNodeSnmpIfaces(nodeId)` | `measurementsService.ts` | `snmpIfaces:{nodeId}` | `collection.SNMP` |
| `fetchNodeType(nodeId)` | `measurementsService.ts` | `nodeType:{nodeId}` | `collection.SNMP` |
| `fetchNodeIpInterfaces(nodeId)` | `measurementsService.ts` | `ipIfaces:{nodeId}` | `collection.SNMP` |
| `getResourceForNode(nodeId)` | `resourceService.ts` | `resources:{nodeId}` | `collection.SNMP` |
| `getGraphDefinitionsByResourceId(id)` | `graphService.ts` | `graphDefs:{resourceId}` | Session (no expiry) |

### Functions That Migrate to Shared Utility

The existing `_cache`, `_cached()`, and `_floor()` in `measurementsService.ts` are replaced by imports from `cacheService.ts`. The time-window floor logic (`_floor()`) stays in `measurementsService.ts` since it's specific to measurements cache key construction — the shared cache service doesn't need to know about time alignment.

- `fetchInterfaceUtilization` — migrated, same behavior
- `fetchInterfaceTimeSeries` — migrated, same behavior
- `fetchInterfaceErrorsDiscards` — migrated, same behavior

### Bonus Fix

`graphStore.ts` — `getDefinitionData()` currently stores graph definitions in an array with linear search. Switch to `Map<string, PreFabGraph>` for O(1) lookup. Small change, touched because we're in the graph path.

### What Doesn't Change

The weathermap store (`weathermapStore.ts`) and resource graph composable (`useResourceGraphs.ts`) call the same service functions and benefit automatically — no changes needed to store or composable code.

## No Hardcoded Timing Values

Every timing value in the frontend must be derived from the `measurementIntervals` response. No magic numbers. Specifically:

| Current hardcoded value | Location | Replaced by |
|---|---|---|
| `pollInterval = ref(30)` | `weathermapStore.ts:83` | `collection.SNMP / 1000` (seconds) |
| `const STEP = 30_000` | `measurementsService.ts:86` | `collection.SNMP` |
| `step = 30_000` default param | `fetchInterfaceTimeSeries` | `collection.SNMP` |
| `step = 30_000` default param | `fetchInterfaceErrorsDiscards` | `collection.SNMP` |
| 10-minute self-cache TTL | `intervalService.ts` | `collection.SNMP * 2` (re-fetch config every 2 collection cycles) |

The **only** hardcoded numbers are the fallback defaults in `intervalService.ts`, which are explicitly documented as last-resort values when the backend endpoint is unavailable (e.g., older OpenNMS version).

## Cache Invalidation Strategy

**Today (shipping):** Config-derived TTL on the `measurementIntervals` response via the `intervalService.ts` self-cache (`collection.SNMP * 2`). Individual data caches (EnLinkd, SNMP interfaces, etc.) use config-derived TTLs and expire naturally.

**Future (when push channel exists):** The `cacheService.invalidate()` and `invalidatePrefix()` hooks are the integration points. A WebSocket/SSE listener subscribed to `uei.opennms.org/internal/reloadDaemonConfigSuccessful` would call `invalidate('measurementIntervals')`, which causes the next `getIntervals()` call to re-fetch. Downstream caches would pick up the new TTLs on their next natural expiry.

The event bus already fires the right UEIs (`reloadDaemonConfig`, `reloadDaemonConfigSuccessful`, `reloadDaemonConfigFailed`). The missing piece is an SSE/WebSocket endpoint to deliver them to the browser — that's a separate feature.

## Testing

### Backend

- Unit test for `MeasurementIntervalsRestService`:
  - Mock injected beans, verify response shape
  - Verify minimum-across-packages logic (two packages with SNMP at 300s and 60s → response shows 60000)
  - Verify graceful degradation when a bean is null (section omitted, not 500)

### Frontend

- Unit tests for `cacheService.ts`:
  - Cache hit within TTL returns cached value without calling fetch function
  - Cache miss after TTL expiry calls fetch function
  - In-flight dedup: two concurrent calls with same key produce one fetch, both callers get same result
  - `invalidate(key)` forces next call to re-fetch
  - `invalidatePrefix(prefix)` clears correct entries
- Unit tests for `intervalService.ts`:
  - Happy path: fetches from API, caches result
  - Fallback: API returns 404 or network error → returns hardcoded defaults
- Existing weathermap and resource graph tests continue to pass (caching is transparent to consumers)

### What We Don't Test

No E2E tests against the live container for caching specifically. Caching is invisible to the user — same data, fewer HTTP requests. Correctness is verified via unit tests on cache logic; existing E2E tests confirm no regressions.

## Expected Impact

For a 10-node topology with 30-second weathermap polling:

| Data type | Before | After | Reduction |
|---|---|---|---|
| EnLinkd (per node) | Every 30s | Once per `lldpRescanInterval` (default 2h) | ~99% |
| SNMP interfaces (per node) | Every 30s | Once per `collection.SNMP` (default 5m) | ~90% |
| Node type (per node) | Every 30s | Once per `collection.SNMP` (default 5m) | ~90% |
| IP interfaces (per node) | Every 30s | Once per `collection.SNMP` (default 5m) | ~90% |
| Resource list (per node detail) | Every panel mount | Once per `collection.SNMP` (default 5m) | ~80% |
| Graph definitions (per resource) | Every panel mount | Once per session | ~99% |
| Measurements (utilization) | Every 30s (already cached) | No change (migrated to shared utility) | — |
