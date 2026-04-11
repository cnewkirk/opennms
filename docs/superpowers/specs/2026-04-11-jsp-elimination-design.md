# JSP Elimination Design

**Date:** 2026-04-11
**Branch:** `feat/ui-refactor`
**Goal:** Eliminate all remaining JSPs by replacing them with proper Vue 3 SPA pages backed by first-class REST APIs.

---

## Context

The Vaadin purge (Phases 0–3) removed ~81K lines of Vaadin UI code. All former Vaadin pages now have Vue replacements and JSP redirect shells. The remaining ~230 JSPs are standard Bootstrap/Spring MVC pages — admin workflows, element detail pages, and reporting. They predate the SPA era and have no place in a modern Vue-first architecture.

The Vue SPA already links to `element/interface.jsp` from four containers (AlarmDetail, EventDetail, OutageDetail, NodesTable), meaning every operator workflow that follows an alarm to an interface drops out of the SPA. That's the highest-friction seam and the starting point.

---

## Pattern (Established — No New Architecture)

Every replacement follows the existing Vaadin→Vue template:

1. **Replace JSP with redirect scriptlet** — the JSP becomes a 3-line `response.sendRedirect` to the Vue route
2. **Vue container** in `ui/src/containers/<Page>.vue` — owns routing, breadcrumbs, role guards
3. **Step/panel components** in `ui/src/components/<Feature>/` — pure display + form logic, no routing
4. **Service layer** in `ui/src/services/<feature>Service.ts` — REST calls via existing axios instances
5. **Router entry** in `ui/src/main/router/index.ts` — lazy-loaded, role-guarded where needed
6. **`legacyToVueRoutes` entry** in `ui/src/components/Menu/SideMenu.vue` — intercepts sidebar nav

REST APIs go in `opennms-webapp-rest` (not Karaf bundles). New packages added to `applicationContext-cxf-rest-v2.xml` component-scan.

---

## Phase 1 — Element Sub-pages

**Priority rationale:** These pages are linked from four existing Vue containers. Every alarm/outage/node workflow that drills into an interface currently exits the SPA.

### 1a. Interface Detail

**Route:** `#/interface/:nodeId/:ipAddress`
**Replaces:** `element/interface.jsp` (336 lines)
**JSP redirect:** `element/interface.jsp` — params `node` + `intf` → `#/interface/{node}/{intf}`

**What it shows:**
- Interface header: IP address, hostname, managed/unmanaged status, primary flag
- Services table: service name, poll status (up/down/unknown), last check time — with links to service detail
- Recent events (by IP address filter + by ifIndex filter) — reuse EventsTable component
- Recent outages — reuse OutagesTable component
- Action links: Response Time Graphs (→ resource graphs), SNMP Interface Data Graphs, Metadata tab, Delete, Rescan, Schedule Outage

**REST APIs (all exist):**
- `GET /api/v2/nodes/{id}/ipinterfaces/{ipAddr}` — interface detail
- `GET /api/v2/nodes/{id}/ipinterfaces/{ipAddr}/services` — services list (IfServiceRestService)
- Events FIQL: `GET /api/v2/events?_s=ipAddress=={ip}` and `ifIndex=={n}`
- Outages FIQL: `GET /api/v2/outages?_s=ipAddress=={ip}`
- Delete: `DELETE /rest/nodes/{id}/ipinterfaces/{ipAddr}` (v1 NodeRestService — verify CSRF handling)
- Rescan: `POST /rest/nodes/{id}/rescan` — **needs verification; may require new REST endpoint**

**Components:**
- `InterfaceDetail.vue` (container)
- `components/InterfaceDetail/InterfaceHeader.vue`
- `components/InterfaceDetail/ServicesTable.vue`
- Reuse: `components/Nodes/EventsTable.vue`, `components/Nodes/OutagesTable.vue`

---

### 1b. SNMP Interface Detail

**Route:** `#/snmpinterface/:nodeId/:ifIndex`
**Replaces:** `element/snmpinterface.jsp` (241 lines)
**JSP redirect:** `element/snmpinterface.jsp` — params `node` + `ifindex` → `#/snmpinterface/{node}/{ifindex}`

**What it shows:**
- SNMP interface header: ifDescr, ifName, ifAlias, ifType, speed, physical address, admin/oper status
- Link to SNMP Interface Data Graphs (→ resource graphs with snmpinterface resource)
- Recent events (by ifIndex)
- Link back to parent node

**REST APIs:**
- `GET /api/v2/nodes/{id}/snmpinterfaces/{ifIndex}` — SNMP interface detail
- Events FIQL: `GET /api/v2/events?_s=ifIndex=={n}`

**Components:**
- `SnmpInterfaceDetail.vue` (container)
- `components/SnmpInterfaceDetail/SnmpInterfaceHeader.vue`
- Reuse: `components/Nodes/EventsTable.vue`

---

### 1c. Availability Detail

**Route:** Redirect only — `element/availability.jsp` → `#/node/:id?tab=overview`

The AvailabilityPanel in NodeDetails.vue already renders availability data with charts and outage segments. No new Vue page needed.

---

### 1d. Metadata Pages

**Route:** Inline tabs on parent Vue pages

- `element/node-metadata.jsp` → metadata tab/panel on `NodeDetails.vue` (Overview tab)
- `element/interface-metadata.jsp` → metadata tab/panel on `InterfaceDetail.vue`
- `element/service-metadata.jsp` → inline in ServicesTable row expand or modal

**REST APIs (all confirmed in v2):**
- `GET /api/v2/nodes/{id}/metadata` — node metadata (NodeRestService)
- `GET /api/v2/nodes/{id}/ipinterfaces/{ipAddr}/metadata` — interface metadata (NodeIpInterfacesRestService)
- `GET /api/v2/nodes/{id}/ipinterfaces/{ipAddr}/services/{serviceName}/metadata` — service metadata (NodeMonitoredServiceRestService)

---

### 1e. Element Search / Index

**Route:** `element/index.jsp` → redirect to `#/nodes`

The Nodes page already provides search and filtering. No new Vue page needed.

---

### 1f. Linked Node

**Route:** `element/linkednode.jsp` → redirect to `#/node/:id?tab=network`

`linkednode.jsp` renders enlinkd topology data (LLDP, CDP, OSPF, ISIS links). NodeDetails.vue's Network tab already contains `EnlinkdLinksTab` which covers this. Redirect only — no new Vue page needed.

---

### Vue SPA Link Updates (Phase 1)

After adding the new routes, update all hardcoded `.jsp` links in Vue components:
- `NodesTable.vue:473` — `element/interface.jsp` → `#/interface/{nodeId}/{ipAddress}`
- `AlarmDetail.vue:73` — same
- `EventDetail.vue:75` — same
- `OutageDetail.vue:71` — same
- Any `element/snmpinterface.jsp` links — update to `#/snmpinterface/{nodeId}/{ifIndex}`

---

## Phase 2 — Admin Hub

**Route:** `#/admin`
**Replaces:** `admin/index.jsp` (404 lines)
**JSP redirect:** `admin/index.jsp` → `#/admin`

A Vue card-grid page mirroring the current layout. All destination links rewritten to Vue SPA routes where replacements exist; remaining legacy JSP links kept as absolute hrefs until Phase 3 replaces them.

This page is primarily link rewiring — no new REST API needed. Role-guarded to admin.

**Components:**
- `Admin.vue` (container)
- `components/Admin/AdminCard.vue` — reusable card with title + link list

---

## Phase 3 — Admin Workflows

Ordered simple → complex. Each gets full REST API + Vue implementation.

### 3a. System Configuration (`admin/sysconfig.jsp`)
Displays system config properties (NMS version, Java version, OS, DB info). REST endpoint exists or can read from `/rest/info`. Read-only display page.

### 3b. Scheduled Outages (`admin/sched-outages/`)
CRUD for maintenance windows. REST: `/rest/sched-outages` (GET list, POST create, PUT update, DELETE).
Three JSPs (index, editoutage + JSON node/interface helpers) → one Vue page with list + edit dialog.

### 3c. Users / Groups / Roles (`admin/userGroupView/`)
~9 JSPs. REST: `/rest/users`, `/rest/groups`, `/rest/roles`.
Replaces: user list, user create/edit, group list, group management, role list, role edit.
**Note:** Password changes require existing password validation — keep the security model intact.

### 3d. Discovery Configuration (`admin/discovery/`)
~7 JSPs (edit-config, edit-scan, add-specific, add-range, etc.). REST: `DiscoveryRestService` (v2).
Replaces: full discovery config editor and single-scan trigger.

### 3e. SNMP Configuration (`admin/snmpConfig.jsp`)
Per-IP SNMP community string and version config. REST: `/rest/snmpConfig`.
690-line JSP → Vue form with IP lookup + community/v3 credential editor.

### 3f. Thresholds (`admin/thresholds/`)
Threshold group management. REST: `/rest/thresholds` (read) — write endpoints may need addition.

### 3g. Notification Wizard (`admin/notification/`)
Most complex: ~10 JSPs, multi-step wizard (choose UEI → build rule → choose path → validate). REST: `/rest/notifications`, `/rest/destinationPaths`, `/rest/notificationCommands`.
Replaces with a Vue wizard following the JMX Config Generator pattern (Pinia store for step state).

---

## Out of Scope (Separate Effort)

- **KSC Reports** (`KSC/`) — specialized report builder, lower operator priority
- **Asset Management** (`asset/`, `admin/asset/`) — bulk import/export workflow
- **Legacy Reports** (`report/`) — JDBC/JasperReports integration
- **Charts** (`charts/`) — deprecated chart renderer
- **Account Self-Service** (`account/selfService/`) — password change flows
- **`alarm/advsearch.jsp`**, **`event/advsearch.jsp`** — advanced search (Vue alarms/events pages already have filtering)
- **`frontPage.jsp`** — already redirects to `index.jsp` → `#/dashboard`

---

## Completion Criteria

A JSP is considered replaced when:
1. The JSP file is a redirect-only scriptlet (≤5 lines)
2. The Vue container is implemented and covers all content from the original JSP
3. All inbound links from Vue components point to the Vue route (not the JSP)
4. `legacyToVueRoutes` entry added for any sidebar-linked pages
5. Tested in both light and dark mode
6. REST endpoints return correct data (verified with curl before writing TypeScript interfaces)
