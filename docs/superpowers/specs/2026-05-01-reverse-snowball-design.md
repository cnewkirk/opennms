# JSP Elimination — Reverse Snowball Execution Design

**Date:** 2026-05-01  
**Branch:** `feat/ui-refactor-omnibus`  
**Predecessor specs:** `2026-05-01-jsp-elimination-phase4-design.md`, `2026-04-30-service-uptime-perses.md`

---

## Goal

Complete all remaining JSP elimination and Feather→PrimeVue cleanup in a single ordered execution sequence, hardest first ("reverse snowball"). Every user-navigable legacy URL must redirect to a working Vue SPA page by the end of this sequence.

---

## Execution Order

```
A → G → Perses → D → F → C → B → Feather → Spring MVC
```

| # | Track | Rationale |
|---|---|---|
| 1 | Domain A — Admin Ops | New REST required; 762 lines of legacy JSPs; raw JDBC manage/unmanage operations |
| 2 | Domain G — System Pages | Partial REST; account self-service is servlet-backed; password change needs new REST |
| 3 | Service Uptime Perses | Plan written; medium-hard (4 files + unit tests + Perses wiring); no REST gap |
| 4 | Domain D — KSC Reports | REST exists at `/rest/ksc`; WEB-INF fragments need examination |
| 5 | Domain F — Reports & Stats | REST exists; listing pages |
| 6 | Domain C — Notifications | REST exists; 2 pages (inbox + detail) |
| 7 | Domain B — Assets & Hardware | REST exists; 4 pages |
| 8 | Feather Table SCSS | Independent sweep; 20 components + 1 `FeatherButton` |
| 9 | Spring MVC Redirects | 5 controller edits, zero new Vue |

---

## Domain A — Admin Ops

### Pages
- `admin/manage.jsp` (310 lines) → `/manage-interfaces`
- `admin/snmpInterfaces.jsp` (88 lines) → `/snmp-interfaces`
- `admin/nodemanagement/instrumentationLogReader.jsp` (364 lines) → `/instrumentation-log`

### REST — No new endpoints for manage or snmpInterfaces

**`manage.jsp` composes existing v1 endpoints:**
- Read nodes: `GET /api/v2/nodes?limit=0`
- Read interfaces per node: `GET /rest/nodes/{id}/ipinterfaces`
- Toggle interface managed state: `PUT /rest/nodes/{id}/ipinterfaces/{ip}` with `isManaged=M|U`
- Toggle service state: `PUT /rest/ifservices?node.nodeId={id}` with `status=A|F`
  - `IfServicesRestService` status values: `A` = managed, `F` = forced unmanaged

**`snmpInterfaces.jsp` composes existing v1 endpoints:**
- Read: `GET /rest/nodes/{id}/snmpinterfaces`
- Toggle collection: `PUT /rest/nodes/{id}/snmpinterfaces/{ifIndex}` with `collect=C|N`

### REST — New endpoint for instrumentation log

New `GET /api/v2/instrumentation-log` in `opennms-webapp-rest`, package `org.opennms.web.rest.v2`:
- Uses `org.opennms.util.ilr.Collector` (already on the classpath) to parse log entries
- Query params: `date` (ISO date, defaults to today), `limit`, `offset`
- Returns JSON array of parsed log entries
- Admin-only (`ROLE_ADMIN` check via `SecurityContext`)

### Vue Routes
| Route | Container | Notes |
|---|---|---|
| `/manage-interfaces` | `ManageInterfaces.vue` | Node selector → interface/service toggle table; batch PUT on save |
| `/snmp-interfaces` | `SnmpInterfaces.vue` | Node selector → SNMP interface collection toggle; PUT per change |
| `/instrumentation-log` | `InstrumentationLog.vue` | Date picker + paginated log entry table |

---

## Domain G — System Pages

### Pages
- `rtc/index.jsp` (39 lines) → redirect to `/surveillance-dashboard` (same content)
- `rtc/category.jsp` (210 lines) → `/rtc/category`
- `help/index.jsp` (51 lines) → `/help` (static links)
- `support/index.jsp` (66 lines) → `/support` (static links)
- `status/index.jsp` (46 lines) → `/status`
- `about/index.jsp` (251 lines) → `/about`
- `account/selfService/index.jsp` + `newPassword.jsp` + `passwordChanged.jsp` + `passwordGate.jsp` (483 lines total) → `/account`

### REST

**`rtc/category.jsp`:** `GET /rest/categories/{name}` — exists.

**`status/index.jsp`:** `GET /rest/info` — `services` map has daemon name → running/stopped. No new REST.

**`about/index.jsp`:** `/rest/info` has version but not DB metadata. New endpoint:
- `GET /api/v2/system/about` — returns version info + DB product name/version (from `DataSourceFactory`)
- Any authenticated user (original page has no role guard).

**`account/selfService/`:** No existing REST. New endpoint:
- `PUT /api/v2/account/password` with body `{ currentPassword: string, newPassword: string }`
- Uses `UserFactory.getInstance()` + `UserManager` — same pattern as `NewPasswordActionServlet`
- Any authenticated user (for their own password only)
- Returns 204 on success, 401 if current password wrong, 403 if readonly user

### Vue Routes
| Route | Container | Notes |
|---|---|---|
| `/rtc/category` | `RtcCategory.vue` | Category name from query param `?category=X` |
| `/help` | `Help.vue` | Static doc links |
| `/support` | `Support.vue` | Static support links |
| `/status` | `SystemStatus.vue` | Daemon service status from `/rest/info` |
| `/about` | `About.vue` | Version + DB info from `/api/v2/system/about` |
| `/account` | `Account.vue` | Multi-step password change form; calls `PUT /api/v2/account/password` |

---

## Service Uptime Perses

Full implementation plan already exists at `docs/superpowers/plans/2026-04-30-service-uptime-perses.md`. Execute as-is — no new design decisions.

**Files touched:**
- `ui/src/composables/useNodeAvailability.ts` — expose raw `outages`
- `ui/src/containers/NodeDetails.vue` — thread `outages` prop
- `ui/src/components/NodeDetail/AvailabilityPanel.vue` — replace Chart.js timeline with `ServiceUptimeRow`
- `ui/src/components/NodeDetail/ServiceUptimeRow.vue` — new component (Perses chart + outage bands)
- `ui/src/composables/useServiceUptimeData.ts` — new composable with `buildOutageSegments`
- `ui/tests/composables/useServiceUptimeData.test.ts` — unit tests

---

## Domains D–B (same pattern, REST exists for all)

### Domain D — KSC Reports
- REST: `/rest/ksc` (report CRUD), `/rest/ksc/{id}` (single report)
- Routes: `/ksc-reports` (`KscReports.vue`), `/ksc-report/:id` (`KscReportDetail.vue`)
- JSPs: `KSC/index.jsp`, `KSC/customGraphChooseResource.jsp`
- Service file: `kscReportService.ts`

### Domain F — Reports & Statistics
- REST: `/rest/reports` (database reports list/run), `/rest/statisticsReports` (statistics)
- Routes: `/reports` (`Reports.vue`), `/statistics-reports` (`StatisticsReports.vue`), `/statistics-report/:id` (`StatisticsReportDetail.vue`)
- JSPs: `report/index.jsp`, statistics JSPs under `WEB-INF/jsp/statisticsReports/`
- Service file: `reportService.ts`

### Domain C — Notification Inbox
- REST: `/rest/notifications` (list), `/rest/notifications/{id}` (detail), `/rest/acks` (acknowledge)
- Routes: `/notifications` (`Notifications.vue`), `/notification/:id` (`NotificationDetail.vue`)
- JSPs: `notification/index.jsp`, `notification/detail.jsp`
- Service file: `notificationService.ts`

### Domain B — Assets & Hardware
- REST: `/rest/assets` (asset node list), `/rest/nodes/{id}/assetRecord` (asset data), `/rest/nodes/{id}/hardwareInventory` (hardware)
- Routes: `/assets` (`Assets.vue`), `/asset/:nodeId/edit` (`AssetEdit.vue`), `/hardware` (`Hardware.vue`)
- JSPs: `asset/index.jsp`, `asset/modify.jsp`, `asset/nodelist.jsp`, `hardware/list.jsp`
- Service file: `assetService.ts`

**Pattern for all four domains:**
1. `curl` every endpoint and inspect actual JSON shape before writing TypeScript interfaces
2. JAXB array normalization: `Array.isArray(raw) ? raw : raw ? [raw] : []`
3. Service file (axios) → container (breadcrumbs, role guard) → child components as needed
4. PrimeVue only — no Feather DS components
5. JSP redirects committed; Admin.vue `href:` → `to:` router-link updates

---

## Feather Table SCSS Sweep

Replace `@import "@featherds/table/scss/table"` and Bootstrap table classes in 20 components with PrimeVue `DataTable` or scoped CSS using design tokens. Fix `Common/EmptyList.vue` (`FeatherButton` → PrimeVue `Button`).

**All 20 components** (from audit doc):
`NodesTable`, `AlarmsTable`, `EventsTable`, `OutagesTable`, `IpInterfacesTable`, `SnmpInterfacesTable`, `ColumnSelectionDrawer`, `ColumnSelectionPanel`, `NodeAdvancedFiltersDrawer`, `NetworkTab`, `ConfigurationTable`, `EventConfigSourceTable`, `EventConfigEventTable`, `MapAlarmsGrid`, `MapNodesGrid`, `GraphDataTable`, `DCBTable`, `ZenithConnectView`, `ZenithConnectRegisterResult`, `ZenithConnectSuccess`

---

## Spring MVC Redirects

Add `sendRedirect` to five existing Java controllers — no new Vue pages needed.

| Controller | Legacy URL | Vue target |
|---|---|---|
| `AlarmController` | `alarm/index.htm` | `/ui/alarms` |
| `NodeListController` | `element/nodeList.htm` | `/ui/nodes` |
| `EventController` (list) | `event/index.htm` | `/ui/events` |
| `EventController` (detail) | `event/detail.htm?id=X` | `/ui/event/:id` |
| `OutageController` (detail) | `outage/detail.htm?id=X` | `/ui/outage/:id` |

Pattern (from `AlarmDetailController`): read `id` param, `response.sendRedirect(contextPath + "/ui/event/" + id)`.

---

## Conventions (applies to all domains)

- New REST: `opennms-webapp-rest`, `org.opennms.web.rest.v2`, no class-level `@Transactional`, no `extends OnmsRestService`
- New Vue: PrimeVue only, service file mandatory, JAXB array normalization in service layer
- JSP redirect pattern: 2-line `sendRedirect` scriptlet
- Curl-verify all endpoints before writing TypeScript interfaces
- Test both light and dark mode before marking a domain complete
- Overlay rebuild required to activate JSP redirects (they are dormant until `build-dark-mode-overlay.sh`)
