# JSP Elimination — Phase 4+ Design

**Date:** 2026-05-01  
**Branch:** `feat/ui-refactor-omnibus`  
**Predecessor:** `2026-04-11-jsp-elimination-design.md` (Phases 1–3, complete)

---

## Goal

Every user-navigable URL currently served by a JSP must redirect to a real, working Vue SPA page. No placeholders. No "coming soon" pages. No loss of existing functionality.

Physical deletion of `.jsp` files is not required — redirect-only tombstones are acceptable.

---

## Out of Scope

- **`admin/ng-requisitions/`** — embedded AngularJS SPA; requires a full rebuild, tracked as a separate GitHub issue.
- Physical file deletion of any `.jsp` file.

---

## Strategy: Domain-Parallel Tracks

Work is divided into 8 independent functional domains. Each domain ships as a complete unit: REST endpoint(s) + Vue container(s) + JSP redirect(s). Domains have no cross-dependencies and can be executed in parallel.

---

## Domain Inventory

| Domain | Active JSPs | REST gap | New Vue routes |
|---|---|---|---|
| A — Admin Ops | `admin/manage.jsp`, `admin/snmpInterfaces.jsp`, `admin/nodemanagement/instrumentationLogReader.jsp` | Partial | `/manage-interfaces`, `/snmp-interfaces`, `/instrumentation-log` |
| B — Node Assets & Hardware | `asset/index.jsp`, `asset/modify.jsp`, `asset/nodelist.jsp`, `hardware/list.jsp` | Exists | `/assets`, `/asset/:nodeId/edit`, `/hardware` |
| C — Notification Inbox | `notification/index.jsp`, `notification/detail.jsp` | Exists | `/notifications`, `/notification/:id` |
| D — KSC Reports | `KSC/index.jsp`, `KSC/customGraphChooseResource.jsp`, `WEB-INF/jsp/KSC/*` | Exists (`/rest/ksc`) | `/ksc-reports`, `/ksc-report/:id` |
| E — Path Outages & On-Call Roles | `pathOutage/index.jsp`, `pathOutage/showNodes.jsp`, `admin/userGroupView/roles/*.jsp` | **None — new REST required** | `/path-outages`, `/on-call-roles`, `/on-call-role/:id` |
| F — Reports & Statistics | `report/database/index.jsp`, `WEB-INF/jsp/statisticsReports/*`, `report/index.jsp` | Exists | `/reports`, `/statistics-reports` |
| G — System Pages | `support/index.jsp`, `status/index.jsp`, `rtc/index.jsp`, `account/selfService/*`, `about/index.jsp`, `help/index.jsp` | Partial | `/support`, `/status`, `/account`, `/about` |
| H — Legacy Redirects | `charts/index.jsp`, `heatmap/index.jsp`, `geomap/standalone.jsp`, `alarm/advsearch.jsp`, `event/advsearch.jsp`, `frontPage.jsp`, misc | None needed | Redirect to existing Vue routes |

Domain H is redirect-only — no new Vue pages. Target mappings:
- `charts/index.jsp` → `/resource-graphs`
- `heatmap/index.jsp` → `/resource-graphs`
- `geomap/standalone.jsp` → `/map`
- `alarm/advsearch.jsp` → `/alarms`
- `event/advsearch.jsp` → `/events`
- `frontPage.jsp` → `/dashboard`

---

## REST Layer Conventions

All new REST services go in `opennms-webapp-rest`, package `org.opennms.web.rest.v2`, accessible at `/api/v2/`. This is the established modern pattern — v1 (`/rest/`) is legacy.

**Service class rules (derived from WallboardConfigRestService, NotificationConfigRestService):**
- `@Component` — no explicit bean name
- `@Path("kebab-case-path")` — kebab-case for compound names
- `@Tag(name = "...", description = "... API")` — Swagger/OpenAPI grouping
- `@Operation(summary = "...", operationId = "...")` on each method
- **No `@Transactional` at class level** — CGLIB proxy hides `@Path` from the CXF basePackages scanner; omit entirely
- **No `extends OnmsRestService`** — that is a v1 pattern
- Auth via `@Context SecurityContext securityContext` + inline `securityContext.isUserInRole(Authentication.ROLE_ADMIN)` check
- Produce `MediaType.APPLICATION_JSON`; XML optional where the model already has `@XmlRootElement`

New packages do NOT need to be added to `applicationContext-cxf-rest-v2.xml` as long as the service is in `org.opennms.web.rest.v2` — it is already in the `basePackages` scan.

---

## Domain E — REST Design (Path Outages & On-Call Roles)

This is the only domain requiring entirely new JAX-RS service classes. Other domains (notably A and G) may need one or two additional endpoints on existing services, but do not need new service files.

### Path Outages — `PathOutageRestService.java`

**Backend:** `PathOutageDao` (Spring-injected, Hibernate-backed). Entity: `OnmsPathOutage` with fields `nodeId`, `criticalPathIp` (`InetAddress`), `criticalPathServiceName`.

```
GET    /api/v2/path-outages               → PathOutageDao.getAllCriticalPaths() — list of [nodeId, ip, serviceName]
GET    /api/v2/path-outages/{nodeId}      → single node's critical path config
POST   /api/v2/path-outages              → create or update path outage for a node
DELETE /api/v2/path-outages/{nodeId}     → remove critical path config for a node
GET    /api/v2/path-outages/{nodeId}/dependents → PathOutageDao.getNodesForPathOutage — nodes depending on this path
```

### On-Call Roles — `OnCallRoleRestService.java`

**Backend:** `GroupService` (existing Spring bean, used by `GroupRestService`). Model: `Role` from `org.opennms.netmgt.config.groups` — already `@XmlRootElement(name = "role")` + JAXB-annotated; no new DTO needed. A `RoleList` wrapper class (analogous to `OnmsGroupList`) is required for list responses.

```
GET    /api/v2/on-call-roles              → list all roles (GroupService)
GET    /api/v2/on-call-roles/{name}       → role detail with schedule
POST   /api/v2/on-call-roles             → create role
PUT    /api/v2/on-call-roles/{name}       → update role + schedule
DELETE /api/v2/on-call-roles/{name}       → delete role
GET    /api/v2/on-call-roles/{name}/schedule → full schedule (time windows + assigned users)
PUT    /api/v2/on-call-roles/{name}/schedule → replace schedule
```

---

## Vue Layer Conventions

All new pages follow the established container pattern exactly. No deviation.

**File layout per page:**
```
ui/src/containers/<PageName>.vue          # route owner, breadcrumbs, role guard
ui/src/components/<Feature>/<Sub>.vue     # pure display/form components
ui/src/services/<feature>Service.ts       # all REST calls via axios instances
```

**Key rules:**
- Service file is mandatory — no inline axios in containers or components
- `import { v2 } from '@/services/axiosInstances'` for `/api/v2/*`; `rest` for `/rest/*`
- JAXB array normalization in the service layer: `Array.isArray(raw) ? raw : raw ? [raw] : []`
- Breadcrumb last item: `{ to: '#', position: 'last' }`
- Role guard pattern (copy from any existing admin route in `router/index.ts`): `adminRole` + `whenever(rolesAreLoaded, () => checkRoles())`
- PrimeVue components for all new pages — no new Feather DS components
- `useSnackbar()` for success/error feedback (default import, not named)
- Curl-verify every REST endpoint and inspect actual JSON shape before writing TypeScript interfaces

---

## Redirect Mechanism

Each replaced JSP becomes a redirect-only scriptlet:

```jsp
<%@ page language="java" %>
<%
  String ctx = request.getContextPath();
  response.sendRedirect(ctx + "/ui/route-name");
%>
```

For JSPs that receive query parameters that the Vue route needs (e.g. `nodeId`, `ipAddress`):

```jsp
<%
  String nodeId = request.getParameter("node");
  String ip     = request.getParameter("intf");
  response.sendRedirect(ctx + "/ui/interface/" + nodeId + "/" + ip);
%>
```

Admin.vue `href:` links for the replaced pages are replaced with `to:` router-link entries.

If the page appears in the sidebar navigation, add a `legacyToVueRoutes` entry in `ui/src/components/Menu/SideMenu.vue` so that sidebar clicks on the legacy URL are intercepted and routed to the Vue page without a full page reload.

---

## Sequencing

Domain H can be done immediately — redirect-only, no REST or Vue work.

Domain E must be done before its Vue pages, but is independent of all other domains.

Domains A–D, F–G can proceed in any order or in parallel.

---

## Completion Criteria (per JSP)

A JSP is considered replaced when all of the following are true:

1. The `.jsp` file contains only a `sendRedirect` scriptlet (or is confirmed unreachable)
2. The Vue container covers all content from the original JSP
3. REST endpoints verified with `curl` before TypeScript interfaces were written
4. All inbound `href:` links in Vue components (Admin.vue, SideMenu.vue, etc.) point to the Vue route
5. Tested in both light and dark mode
6. No Feather DS components introduced (PrimeVue only for new pages)
