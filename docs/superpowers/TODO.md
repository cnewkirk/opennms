# OpenNMS Superpowers — TODO

## API Token Smoke Tests

The feature is implemented and upstream-PR-ready, but has no smoke test coverage in the
`smoke-test/` module. These need to be written as a follow-up PR after the feature lands.

### What to write

**File:** `smoke-test/src/test/java/org/opennms/smoketest/ApiTokenIT.java`

This should be a standalone REST-based IT (no Selenium, no UI) that uses
`OpenNMSStack.MINIMAL` — same pattern as `NodeRestIT.java` and `RestSessionIT.java`.
No new containers needed; it exercises the REST API directly via `HttpClient` or JAX-RS
`Client` (see `RestClient` for the helper, or raw Apache HttpClient for bearer header
control since `RestClient` is basic-auth-only).

**Test cases to cover** (mirrors the manual E2E suite we've validated):

#### Authentication
- Basic auth still works on `/api/v2/apiTokens` → 200
- Valid bearer token (`onms_...`) → 200
- Invalid bearer (correct prefix, wrong hash) → 401
- Malformed bearer (no `onms_` prefix) → 401
- No `Authorization` header → 401

#### Token lifecycle
- `POST /api/v2/apiTokens` returns 201 with `token`, `id`, `createdAt`, `expiresAt`
- Returned `token` starts with `onms_` and is 69 characters
- `lastUsedAt` is null on a fresh token, non-null after the token is used for auth
- `DELETE /api/v2/apiTokens/{id}` returns 204
- Using a revoked token returns 401
- Revoking a non-existent token returns 404

#### Information leakage
- `GET /api/v2/apiTokens` response does NOT contain `tokenHash` field
- `POST` with `expiresInDays: 9999` returns 400, body does not contain "365"
- `POST` with `expiresInDays: -1` returns 400

#### Admin cross-user operations
- Admin can create token for another user (`POST ?username=rtc`) → 201
- Admin can list another user's tokens (`GET ?username=rtc`) → 200
- Admin can revoke another user's token (`DELETE /{id}` as admin) → 204

#### Bulk revoke
- `DELETE /api/v2/apiTokens?username=admin` → 204
- Subsequent `GET /api/v2/apiTokens` returns empty list

### Implementation notes

- `RestClient` in `smoke-test/src/main/java/org/opennms/smoketest/utils/RestClient.java`
  is JAX-RS-based and only supports basic auth. For bearer token tests you'll need to
  construct requests manually — use `javax.ws.rs.client.ClientBuilder` with an
  `Authorization: Bearer <token>` header directly, or Apache `HttpClient` (already on
  the classpath via `RestSessionIT`).
- The `rtc` user exists in the default OpenNMS install with no `ROLE_REST`. Admin
  cross-user tests should use `admin:admin` credentials (basic) for the admin actor.
  Token-holder is `rtc` (or create a separate user via REST if you need a ROLE_REST
  non-admin for IDOR coverage).
- Token response JSON is not currently backed by a JAXB type in the smoke-test classpath
  — parse with Jackson `ObjectMapper` or use `Response.readEntity(Map.class)` via a
  `GenericType<Map<String, Object>>`.
- Test cleanup: revoke all tokens for `admin` and `rtc` in `@After`.

### Where this lives in the build

The `smoke-test` module is gated behind the `smoke` Maven profile:

```bash
./compile.pl -DskipTests -Dsmoke --projects :smoke-test -am install
./compile.pl -t -Dsmoke --projects :smoke-test install -Dtest=ApiTokenIT
```

The test class must end in `IT` and extend nothing (or `OpenNMSSeleniumIT` if Selenium
is needed, but it isn't here). Mark with `@Category(FlakyTests.class)` only if
genuinely flaky — REST-only tests shouldn't be.

### Include in the same PR as the feature

`ApiTokenIT.java` should be part of the upstream feature PR, not a follow-up.
Reviewers will ask for tests if they're absent, and the smoke test framework
runs against the current build — there's no chicken-and-egg problem.
`OpenNMSStack.MINIMAL` spins up a container from the source being reviewed,
so the tests exercise the feature code directly.

---

## Vaadin → Vue: High-Complexity Pages (Deferred)

These three Vaadin-backed admin pages require significant REST API work and/or complex UI
before a Vue migration is practical. Document here so they aren't forgotten.

### SNMP Collections Admin (`admin/manageSnmpCollections.jsp`)

**Current:** Vaadin iframe at `admin/admin-snmp-collections`. Powered by
`features/vaadin-snmp-events-and-metrics` (`SnmpCollectionAdminApplication`).

**What it does:** Deep hierarchical editor for `datacollection-config.xml` — collections,
groups, MBeans, system definitions. Multi-level tree with inline forms for each node type.

**Why deferred:** No v2 REST API for reading or writing the collection config. The existing
`/rest/config/datacollection` (v1) is read-only XML. A new writable REST service would be
needed before Vue components are meaningful. The data model is also deeply nested (collection
→ group → MBean → attribute).

**Prerequisites before Vue migration:**
- New `DataCollectionConfigRestService` (v2) with read/write for collections, groups, MBeans
- Decide on scope: full editor vs. read-only viewer with file upload/download

---

### BSM Admin (`admin/bsm/adminpage.jsp`)

**Current:** Vaadin application (BSM-specific Vaadin module in `features/bsm/vaadin-adminpage`).

**What it does:** Graph editor for Business Service topology — create/edit/delete business
services, add edges (IP service, reduction key, child service), set map/reduce functions,
preview impact propagation.

**Why deferred:** No REST API for BSM CRUD that is suitable for a Vue graph editor.
The BSM domain model is complex (reduction functions, map functions, edge weights, threshold
expressions). A viable Vue replacement would need either a new REST layer or to adapt the
existing `/api/v2/businessservices` endpoints (which are read-heavy and mutation-limited).

**Prerequisites before Vue migration:**
- Audit existing BSM REST endpoints for completeness
- Graph visualization library selection (topology map pattern, or a dedicated graph lib like vis.js)

---

### Surveillance View Display (`surveillance-view.jsp`, `dashboard.jsp`)

**Current:** `surveillance-view.jsp` embeds a Vaadin live status matrix
(`vaadin-surveillance-views`); `dashboard.jsp` is the main dashboard wrapping it.

**What it does:** Live N×M matrix of node categories (rows × columns) showing outage/availability
status per cell. Clicking a cell shows a detail panel with nodes, alarms, notifications, graphs.
Auto-refreshes on a configurable interval.

**Why deferred:** Substantial real-time data requirements. Each cell requires aggregating
availability data per category intersection — the existing REST (`/rest/availability`)
supports this but needs careful caching/polling. The detail panel has five sub-tables
(nodes, alarms, notifications, graphs, outages) — comparable in scope to the node detail page.

**Prerequisites before Vue migration:**
- Verify availability API covers row×column intersection queries
- Decide on refresh strategy (polling vs. WebSocket/SSE)
- Consider whether `surveillance-view.jsp` and `dashboard.jsp` should become one Vue route

---

## Dashboard Outages Widget: service name blank

**Component:** `ui/src/components/Dashboard/widgets/OutagesWidget.vue:57`

```vue
<td>{{ outage.serviceName }}</td>
```

**Root cause:** The OpenNMS v2 REST API (`/api/v2/outages`) serializes `OnmsOutage`
with the service info nested under `monitoredService.serviceType.name`. There is no
flat `serviceName` field in the response — `getServiceType()` is `@JsonIgnore` in the
`OnmsOutage` model. The `Outage` TypeScript type (`ui/src/types/index.ts:302`) declares
`serviceName: string` but this field will always be `undefined` at runtime.

**Correct path:** `outage.monitoredService.serviceType.name`

**Same issue in:** `ui/src/components/Nodes/OutagesTable.vue:26` (node detail page).

**Fix:** Either (a) update the `Outage` TS type to reflect the nested shape and update
both templates, or (b) add a `@XmlElement(name="serviceName") @Transient` convenience
getter to `OnmsOutage.java` (like `getNodeLabel()`) that returns
`getMonitoredService().getServiceType().getName()`.

Option (b) is smaller and consistent with the existing pattern in `OnmsOutage`
(`getNodeId`, `getNodeLabel`, `getIpAddress` are all `@Transient @XmlElement` helpers
over the same nested object graph).
