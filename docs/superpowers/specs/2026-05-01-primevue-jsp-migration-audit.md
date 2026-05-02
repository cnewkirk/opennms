# PrimeVue Migration & JSP Replacement Audit

**Date:** 2026-05-01 (updated 2026-05-01 after Domain A session)  
**Branch:** `feat/ui-refactor-omnibus`  
**Spec:** `docs/superpowers/specs/2026-05-01-reverse-snowball-design.md`

## Session Log

| Date | Work done |
|---|---|
| 2026-05-01 | Initial audit written; Domain E brainstorm + spec + plan |
| 2026-05-01 | **Domain E complete:** `PathOutageRestService` + `OnCallRoleRestService` at `/api/v2/`; Vue pages `/path-outages`, `/on-call-roles`, `/on-call-role/:name`; 6 Domain E JSPs redirected |
| 2026-05-01 | **Domain H complete:** 6 redirect-only JSPs converted — active after next overlay rebuild |
| 2026-05-01 | **Domain A complete:** `GET /api/v2/instrumentation-log`; Vue pages `/manage-interfaces`, `/snmp-interfaces`, `/instrumentation-log`; 3 JSPs redirected (dormant) |

## Reverse Snowball Progress

| Track | Status | Notes |
|---|---|---|
| **A — Admin Ops** | ✅ COMPLETE (2026-05-01) | 3 Vue pages + new REST + 3 JSP redirects (dormant) |
| **G — System Pages** | ❌ next | `rtc/category`, `help`, `support`, `status`, `about`, `account`; needs 2 new REST endpoints |
| **Perses Service Uptime** | ❌ | Plan at `docs/superpowers/plans/2026-04-30-service-uptime-perses.md` |
| **D — KSC Reports** | ❌ | REST exists at `/rest/ksc` |
| **F — Reports & Stats** | ❌ | REST exists |
| **C — Notifications** | ❌ | REST exists |
| **B — Assets & Hardware** | ❌ | REST exists |
| **Feather SCSS sweep** | ❌ | 20 components + `EmptyList.vue` |
| **Spring MVC redirects** | ❌ | 5 controller edits |
| **E — Path Outages + On-Call** | ✅ COMPLETE (2026-05-01) | |
| **H — Legacy Redirects** | ✅ COMPLETE (2026-05-01) | |

## Dormant JSP Redirects (need overlay rebuild to activate)

15 redirects committed, dormant until `./build-dark-mode-overlay.sh`:
- Domain A (3): `admin/manage.jsp`, `admin/snmpInterfaces.jsp`, `admin/nodemanagement/instrumentationLogReader.jsp`
- Domain E (6): path outage + on-call role JSPs
- Domain H (6): charts, heatmap, geomap, alarm/advsearch, event/advsearch, frontPage

---

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

---

## Main Menu

| Feature | Legacy URL(s) | Vue route | Feather remaining | Status |
|---|---|---|---|---|
| Dashboard (widgets) | — (Vue-only) | `/dashboard` | none | ✅ done |
| Alarms | `alarm/index.htm` (no redirect) | `/alarms` | table-scss | 🏗 vue-no-redirect |
| Nodes | `element/nodeList.htm` (no redirect) | `/nodes` | table-scss | 🏗 vue-no-redirect |
| Events | `event/index.htm` (no redirect) | `/events` | none | 🏗 vue-no-redirect |
| Outages | `outage/index.jsp` | `/outages` | table-scss | 🔀 redirect-only |
| Metrics | `graph/index.jsp` | `/resource-graphs` | table-scss | 🔀 redirect-only |
| Topology | `topology` (utils.ts shim) | `/topology` | none | ✅ done |
| Surveillance Dashboard | `dashboard.jsp` | `/surveillance-dashboard` | none | ✅ done |
| Map | — (Vue-only) | `/map` | table-scss | 🔀 redirect-only |
| Device Config Backup | — (Vue-only) | `/device-config-backup` | table-scss | 🔀 redirect-only |

---

## Admin Hub — All Done

| Feature | Legacy JSP(s) | Vue route | Status |
|---|---|---|---|
| Admin Hub (landing) | `admin/index.jsp` | `/admin` | ✅ |
| System Config | `admin/sysconfig.jsp` | `/system-config` | ✅ |
| Scheduled Outages | `admin/sched-outages/index.jsp` | `/scheduled-outages` | ✅ |
| Users & Groups | `admin/userGroupView/index.jsp` | `/users-groups` | ✅ |
| Discovery Config | `admin/discovery/index.jsp` | `/discovery-config` | ✅ |
| Discovery Scan | `admin/discovery/edit-scan.jsp` | `/discovery-scan` | ✅ |
| SNMP Config | `admin/snmpConfig.jsp` | `/snmp-config` | ✅ |
| Threshold Config | `admin/thresholds/index.jsp` | `/threshold-config` | ✅ |
| Notification Config | `admin/notification/index.jsp` | `/notification-config` | ✅ |
| JMX Config Generator | `admin/jmxConfigGenerator.jsp` | `/jmx-config-generator` | ✅ |
| MIB Compiler | `admin/mibCompiler.jsp` | `/mib-compiler` | ✅ |
| Wallboard Config | `admin/wallboardConfig.jsp` | `/wallboard-config` | ✅ |
| Surveillance Views Config | `admin/surveillanceViewsConfig.jsp` | `/surveillance-views-config` | ✅ |
| BSM Admin | `admin/bsm/adminpage.jsp` | `/bsm-admin` | ✅ |
| Flow Classification | `admin/classification/index.jsp` | `/flow-classification` | ✅ |
| Geocoder Config | `admin/geoservice/index.jsp` | `/geocoder-config` | ✅ |
| Grafana Endpoints | `admin/endpoint/index.jsp` | `/grafana-endpoints` | ✅ |
| Asset Management | `admin/asset/index.jsp` | `/asset-management` | ✅ |
| Add Interface | `admin/newInterface.jsp` | `/add-interface` | ✅ |
| Delete Nodes | `admin/delete.jsp` | `/delete-nodes` | ✅ |
| Send Event | `WEB-INF/jsp/admin/sendevent.jsp` | `/send-event` | ✅ |
| Surveillance Categories | `WEB-INF/jsp/admin/categories.jsp` | `/surveillance-categories` | ✅ |
| Applications | `WEB-INF/jsp/admin/applications.jsp` | `/applications` | ✅ |
| Monitoring Locations | `locations/index.jsp` | `/monitoring-locations` | ✅ |
| Manage Minions | `minion/index.jsp` | `/minions` | ✅ |
| Manage/Unmanage Interfaces | `admin/manage.jsp` | `/manage-interfaces` | ✅ done (2026-05-01) — redirect dormant |
| SNMP Interface Collection | `admin/snmpInterfaces.jsp` | `/snmp-interfaces` | ✅ done (2026-05-01) — redirect dormant |
| Instrumentation Log Reader | `admin/nodemanagement/instrumentationLogReader.jsp` | `/instrumentation-log` | ✅ done (2026-05-01) — redirect dormant |
| On-Call Roles | `admin/userGroupView/roles/list.jsp` | `/on-call-roles` | ✅ done (2026-05-01) — redirects dormant |
| Configure Path Outages | `pathOutage/index.jsp` | `/path-outages` | ✅ done (2026-05-01) — redirects dormant |
| Event Config | `admin/manageEvents.jsp` | `/event-config` | 🔀 Feather table-scss remains |
| SNMP Collections Config | `admin/manageSnmpCollections.jsp` | `/snmp-collections-config` | 🔀 Feather table-scss remains |
| Provisioning Requisitions | `admin/ng-requisitions/index.jsp` | `/provision/requisitions` | ⏸ Angular embed — deferred |

---

## Remaining Legacy Pages (Domain G and below)

| Feature | Legacy URL | Domain | REST gap | Notes |
|---|---|---|---|---|
| RTC Category | `rtc/category.jsp` | G | none (`/rest/categories/{name}`) | |
| Help | `help/index.jsp` | G | none (static) | |
| Support | `support/index.jsp` | G | none (static) | |
| Site Status | `status/index.jsp` | G | none (`/rest/info`) | |
| About | `about/index.jsp` | G | new `GET /api/v2/system/about` | version + DB info |
| Account Self-Service | `account/selfService/*` | G | new `PUT /api/v2/account/password` | |
| KSC Reports | `KSC/index.jsp` | D | none (`/rest/ksc`) | |
| Database Reports | `report/index.jsp` | F | none | |
| Statistics Reports | `WEB-INF/jsp/statisticsReports/*` | F | none | |
| Notifications (user) | `notification/index.jsp` · `detail.jsp` | C | none | |
| Asset Records | `asset/index.jsp` · `modify.jsp` · `nodelist.jsp` | B | none | |
| Hardware Inventory | `hardware/list.jsp` | B | none | |

---

## Feather Table SCSS — 20 Components

`NodesTable`, `AlarmsTable`, `EventsTable`, `OutagesTable`, `IpInterfacesTable`, `SnmpInterfacesTable`, `ColumnSelectionDrawer`, `ColumnSelectionPanel`, `NodeAdvancedFiltersDrawer`, `NetworkTab`, `ConfigurationTable`, `EventConfigSourceTable`, `EventConfigEventTable`, `MapAlarmsGrid`, `MapNodesGrid`, `GraphDataTable`, `DCBTable`, `ZenithConnectView`, `ZenithConnectRegisterResult`, `ZenithConnectSuccess`

**One remaining Feather Vue component:** `Common/EmptyList.vue` uses `FeatherButton` → replace with PrimeVue `Button`.

---

## Known URL Issues Fixed

- `utils.ts` topology entry was `ui/index.html#/topology` → fixed to `ui/topology` (2026-05-01)
