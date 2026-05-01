# PrimeVue Migration & JSP Replacement Audit

**Date:** 2026-05-01  
**Branch:** `feat/ui-refactor-omnibus`  
**Scope:** User-facing navigable pages only (excludes `includes/`, `errors/`, internal `WEB-INF/jsp/` fragments)

## Goals

1. **JSP elimination** — every user-navigable legacy URL should redirect to its Vue SPA equivalent so bookmarks continue to work
2. **PrimeVue migration** — all Vue components should use PrimeVue; `@featherds/table/scss/table` SCSS and the one remaining `FeatherButton` are the only Feather remnants
3. **Clean URLs** — no `#/` hash-mode URLs in menu links or JSP redirects; router is HTML5 history mode throughout

## Status Taxonomy

| Symbol | Meaning |
|---|---|
| ✅ done | Vue route exists · JSP/controller redirects · no Feather in landing component |
| 🔀 redirect-only | Redirect in place, but landing component still uses `@featherds/table/scss/table` |
| 🏗 vue-no-redirect | Vue route exists but legacy URL does NOT redirect (bookmark breaks) |
| ❌ legacy | No Vue equivalent; full legacy JSP served |
| ⏸ deferred | Intentionally kept legacy — Angular embed, no REST backing, or rarely used |

## Feather Remaining Column

- `none` — no Feather dependency
- `table-scss` — uses `@import "@featherds/table/scss/table"` SCSS only; plain `<table>` element styled by Feather CSS classes, no Feather Vue component
- `component` — uses an actual Feather Vue component (only `EmptyList.vue` → `FeatherButton`)

---

## Main Menu

| Feature | Legacy URL(s) | Vue route | Feather remaining | Status |
|---|---|---|---|---|
| Dashboard (widgets) | — (Vue-only) | `/dashboard` | none | ✅ done |
| Alarms | `alarm/index.htm` (Spring MVC, no redirect) | `/alarms` | table-scss (`AlarmsTable.vue`) | 🏗 vue-no-redirect |
| Nodes | `element/nodeList.htm` (no redirect) · `element/index.jsp` (✅) | `/nodes` | table-scss (`NodesTable.vue` + 5 sub-tables) | 🏗 vue-no-redirect |
| Events | `event/index.htm` (Spring MVC, no redirect) | `/events` | none | 🏗 vue-no-redirect |
| Outages | `outage/index.jsp` | `/outages` | table-scss (`OutagesTable.vue`) | 🔀 redirect-only |
| Metrics | `graph/index.jsp` | `/resource-graphs` | table-scss (`GraphDataTable.vue`) | 🔀 redirect-only |
| Topology | `topology` (Vaadin servlet → `utils.ts` shim) | `/topology` | none | ✅ done |
| Surveillance Dashboard | `dashboard.jsp` · `surveillance-view.jsp` | `/surveillance-dashboard` | none | ✅ done |
| Map | — (Vue-only) | `/map` | table-scss (`MapAlarmsGrid.vue`, `MapNodesGrid.vue`) | 🔀 redirect-only |
| Device Config Backup | — (Vue-only) | `/device-config-backup` | table-scss (`DCBTable.vue`) | 🔀 redirect-only |

**Note:** The menu sidebar link for Alarms, Nodes, and Events bypasses the legacy Spring MVC URL via `legacyToVueRoutes` in `utils.ts`, so the sidebar works correctly. It is bookmarked URLs (e.g. `alarm/index.htm`) that still land on the legacy view.

---

## Admin Hub

### Fully Done

| Feature | Legacy JSP(s) | Vue route | Status |
|---|---|---|---|
| Admin Hub (landing) | `admin/index.jsp` | `/admin` | ✅ done |
| System Config | `admin/sysconfig.jsp` | `/system-config` | ✅ done |
| Scheduled Outages | `admin/sched-outages/index.jsp` | `/scheduled-outages` | ✅ done |
| Users & Groups | `admin/userGroupView/index.jsp` + `users/*.jsp` | `/users-groups` | ✅ done |
| Discovery Config | `admin/discovery/index.jsp` · `edit-config.jsp` | `/discovery-config` | ✅ done |
| Discovery Scan | `admin/discovery/edit-scan.jsp` | `/discovery-scan` | ✅ done |
| SNMP Config | `admin/snmpConfig.jsp` | `/snmp-config` | ✅ done |
| Threshold Config | `admin/thresholds/index.jsp` | `/threshold-config` | ✅ done |
| Notifications | `admin/notification/index.jsp` · `destinationPaths.jsp` | `/notification-config` + `/notification-config/paths` | ✅ done |
| JMX Config Generator | `admin/jmxConfigGenerator.jsp` | `/jmx-config-generator` | ✅ done |
| MIB Compiler | `admin/mibCompiler.jsp` | `/mib-compiler` | ✅ done |
| Wallboard Config | `admin/wallboardConfig.jsp` | `/wallboard-config` | ✅ done |
| Surveillance Views Config | `admin/surveillanceViewsConfig.jsp` | `/surveillance-views-config` | ✅ done |
| BSM Admin | `admin/bsm/adminpage.jsp` | `/bsm-admin` | ✅ done |
| Flow Classification | `admin/classification/index.jsp` | `/flow-classification` | ✅ done |
| Geocoder Config | `admin/geoservice/index.jsp` | `/geocoder-config` | ✅ done |
| Grafana Endpoints | `admin/endpoint/index.jsp` | `/grafana-endpoints` | ✅ done |
| Asset Management | `admin/asset/index.jsp` | `/asset-management` | ✅ done |
| Add Interface | `admin/newInterface.jsp` | `/add-interface` | ✅ done |
| Delete Nodes | `admin/delete.jsp` | `/delete-nodes` | ✅ done |
| Send Event | `WEB-INF/jsp/admin/sendevent.jsp` (Spring MVC view) | `/send-event` | ✅ done |
| Surveillance Categories | `WEB-INF/jsp/admin/categories.jsp` (Spring MVC view) | `/surveillance-categories` | ✅ done |
| Applications | `WEB-INF/jsp/admin/applications.jsp` (Spring MVC view) | `/applications` | ✅ done |
| Monitoring Locations | `locations/index.jsp` | `/monitoring-locations` | ✅ done |
| Manage Minions | `minion/index.jsp` | `/minions` | ✅ done |

### Redirect-Only (Feather table SCSS remaining)

| Feature | Legacy JSP(s) | Vue route | Feather remaining | Status |
|---|---|---|---|---|
| Event Config | `admin/manageEvents.jsp` | `/event-config` | table-scss (`EventConfigSourceTable.vue`, `EventConfigEventTable.vue`) | 🔀 redirect-only |
| SNMP Collections Config | `admin/manageSnmpCollections.jsp` | `/snmp-collections-config` | table-scss (`ConfigurationTable.vue`) | 🔀 redirect-only |

### Legacy / Deferred

| Feature | Legacy JSP(s) | Vue route | Status | Notes |
|---|---|---|---|---|
| Manage/Unmanage Interfaces | `admin/manage.jsp` | — | ❌ legacy | Complex node/interface state; REST exists |
| SNMP Interface Collection | `admin/snmpInterfaces.jsp` | — | ❌ legacy | Spring MVC; per-interface SNMP collection toggle |
| Node Management | `admin/nodemanagement/index.jsp` | — | ❌ legacy | Manage/delete nodes per node |
| Provisioning Requisitions | `admin/ng-requisitions/index.jsp` | `/provision/requisitions` | ⏸ deferred | Embedded Angular app with internal hash router |
| On-Call Roles | `admin/userGroupView/roles/list.jsp` | — | ⏸ deferred | No REST endpoint (`/rest/roles` → 404) |
| Configure Path Outages | `admin/notification/noticeWizard/buildPathOutage.jsp` | — | ⏸ deferred | Complex FilterDao interaction; intentionally deferred |

---

## Deep Links (bookmarkable entity URLs)

| Feature | Legacy URL pattern | Redirect | Vue route | Status |
|---|---|---|---|---|
| Node Detail | `element/node.jsp?node=X` | ✅ JSP | `/node/:id` | ✅ done |
| Interface Detail | `element/interface.jsp?node=X&intf=Y` | ✅ JSP | `/interface/:nodeId/:ipAddress` | ✅ done |
| SNMP Interface Detail | `element/snmpinterface.jsp?node=X&ifindex=Y` | ✅ JSP | `/snmpinterface/:nodeId/:ifIndex` | ✅ done |
| Node Metadata | `element/node-metadata.jsp?node=X` | ✅ JSP | `/node/:id?tab=metadata` | ✅ done |
| Interface Metadata | `element/interface-metadata.jsp` | ✅ JSP | `/interface/:nodeId/:ipAddress` | ✅ done |
| Alarm Detail | `alarm/detail.htm?id=X` | ✅ Java (`AlarmDetailController`) | `/alarm/:id` | ✅ done |
| Event Detail | `event/detail.htm?id=X` | ❌ no redirect | `/event/:id` | 🏗 vue-no-redirect |
| Outage Detail | `outage/detail.htm?id=X` | ❌ no redirect | `/outage/:id` | 🏗 vue-no-redirect |
| Notification Detail | `notification/detail.jsp` | ❌ | — | ❌ legacy |

---

## Standalone / Reachable Pages

Pages reachable via URL but not in the primary sidebar menu.

| Feature | Legacy URL | Vue route | Status | Notes |
|---|---|---|---|---|
| Open API | — | `/open-api` | ✅ done | Vue-only |
| Usage Statistics | — | `/usage-statistics` | ✅ done | Vue-only |
| ZenithConnect | — | `/zenith-connect` | 🔀 redirect-only | table-scss (`ZenithConnectView.vue`, `ZenithConnectRegisterResult.vue`) |
| KSC Reports | `KSC/index.jsp` | — | ❌ legacy | No REST; complex custom graph config |
| Database Reports | `report/index.jsp` | — | ❌ legacy | No REST |
| Notifications (user-facing list) | `notification/index.jsp` | — | ❌ legacy | User notification history; distinct from admin notification config |
| Path Outage | `pathOutage/index.jsp` | — | ❌ legacy | |
| About | `about/index.jsp` | — | ❌ legacy | |
| Support | `support/index.jsp` | — | ❌ legacy | |
| Asset Records (per-node) | `asset/index.jsp` · `asset/modify.jsp` | — | ❌ legacy | Different from admin asset import/export |
| Heatmap | `heatmap/index.jsp` | — | ❌ legacy | |
| Site Status | `status/index.jsp` | — | ❌ legacy | |
| Login / Logoff | `login.jsp` · `logoff.jsp` | — | n/a | Infrastructure; not migrating |

---

## Feather Table SCSS — Full File List

These 20 components import `@featherds/table/scss/table` for plain `<table>` styling. They are not using Feather Vue components. Migration path: replace with PrimeVue `DataTable` or write scoped table CSS using design tokens.

| Component | Page / Feature |
|---|---|
| `Nodes/NodesTable.vue` | Nodes list |
| `Nodes/AlarmsTable.vue` | Node detail — Alarms tab |
| `Nodes/EventsTable.vue` | Node detail — Events tab |
| `Nodes/OutagesTable.vue` | Node detail — Outages tab |
| `Nodes/IpInterfacesTable.vue` | Node detail — Interfaces tab |
| `Nodes/SnmpInterfacesTable.vue` | Node detail — SNMP Interfaces tab |
| `Nodes/ColumnSelectionDrawer.vue` | Nodes list — column picker drawer |
| `Nodes/ColumnSelectionPanel.vue` | Nodes list — column picker panel |
| `Nodes/NodeAdvancedFiltersDrawer.vue` | Nodes list — filter drawer |
| `NodeDetail/NetworkTab.vue` | Node detail — Network tab |
| `Configuration/ConfigurationTable.vue` | SNMP Collections Config |
| `EventConfiguration/EventConfigSourceTable.vue` | Event Config |
| `EventConfigurationDetail/EventConfigEventTable.vue` | Event Config detail |
| `Map/MapAlarmsGrid.vue` | Map — alarms grid |
| `Map/MapNodesGrid.vue` | Map — nodes grid |
| `Resources/GraphDataTable.vue` | Metrics / Resource Graphs |
| `Device/DCBTable.vue` | Device Config Backup |
| `ZenithConnect/ZenithConnectView.vue` | ZenithConnect |
| `ZenithConnect/ZenithConnectRegisterResult.vue` | ZenithConnect |
| `ZenithConnect/ZenithConnectSuccess.vue` (container) | ZenithConnect |

**One remaining Feather Vue component:** `Common/EmptyList.vue` uses `FeatherButton`. Replace with PrimeVue `Button`.

---

## Known URL Issues Fixed

- `utils.ts` topology entry was `ui/index.html#/topology` → fixed to `ui/topology` (2026-05-01)

## Hash URL Audit

All remaining `#/` usage is intentional:
- `computePluginRelLink` in `utils.ts` — plugin extensions use `ui/#/plugins/...`; the router's legacy hash handler normalizes these to clean paths. Stays until all plugins adopt the new `extensionId` pattern.
- `AdminActionsBar.vue` links to `admin/ng-requisitions/index.jsp#/requisitions/...` — Angular app internal hash router; correct by design.

---

## Summary Counts

| Status | Count |
|---|---|
| ✅ done | 36 |
| 🔀 redirect-only (Feather table SCSS) | 7 |
| 🏗 vue-no-redirect | 5 (Alarms list, Nodes list, Events list, Event detail, Outage detail) |
| ❌ legacy (no Vue equivalent) | 13 |
| ⏸ deferred | 3 |

**Highest-value remaining work:**
1. Add redirects for `alarm/index.htm`, `element/nodeList.htm`, `event/index.htm` (Spring MVC controllers — add `sendRedirect` or a filter)
2. Add redirects for `event/detail.htm` and `outage/detail.htm` (same pattern as `AlarmDetailController`)
3. Migrate 20 components from Feather table SCSS to PrimeVue DataTable (or scoped CSS)
4. Fix `EmptyList.vue` — swap `FeatherButton` → PrimeVue `Button`
5. Decide priority order for 13 remaining legacy pages
