# Outage Pages — Vue Migration Design

**Date:** 2026-04-05  
**Branch:** feature/jmx-config-vue  
**Scope:** Standalone outage list and detail pages only (not box widgets)

---

## Goal

Replace the JSP-rendered outage list (`/outage/list.htm`) and outage detail (`/outage/detail.htm`) pages with Vue SPA equivalents, consistent with the existing Alarms, Events, and NodeDetails migrations. The outage index page (`/outage/index.jsp`) becomes redundant once the menu links directly to the Vue list.

---

## Approach

Approach A: new Vue routes, menu redirected. Legacy JSP URLs remain accessible but unlinked. No Spring/servlet changes. This is the same pattern used for every prior Vue migration in this project.

---

## New Files

```
ui/src/
  containers/
    Outages.vue             ← list page container
    OutageDetail.vue        ← detail page container
  components/
    Outages/
      OutagesListTable.vue  ← sortable, filterable, paginated table
```

---

## Router

Add to `ui/src/main/router/index.ts`:

```ts
{ path: '/outages', component: () => import('@/containers/Outages.vue') }
{ path: '/outage/:id', component: () => import('@/containers/OutageDetail.vue') }
```

---

## API & Service

Extend `ui/src/services/outageService.ts` with one new function:

```ts
const getOutage = async (id: number | string): Promise<Outage | false>
// GET /api/v2/outages/{id}
```

Existing `getOutages()` is used as-is for the list.

---

## Type Changes

Extend the `Outage` interface in `ui/src/types/index.ts` with fields needed by the detail view that are absent from the current definition:

- `lostServiceEventId?: number`
- `regainedServiceEventId?: number | null`
- `perspectiveLocation?: string | null`
- `foreignSource?: string | null`

---

## OutagesListTable.vue

**Columns** (matching the JSP exactly):  
ID · Requisition · Node · Monitoring Location · Interface · Service · Down Since · Restored · Perspective

**Sort:** Clickable column headers toggle `orderBy`/`order` query params sent to `getOutages()`.

**Filter toggle:** "Current" (active — `ifRegainedService==null`) vs "All outages". Default: Current, matching the legacy index page default.

**Pagination:** Uses the existing `Pagination` component.

**Row color:** Active outages (no regained time) receive a warning/danger CSS class. Resolved outages are neutral. Same status coloring as the JSP `OutageUtil.getStatusColor()` logic.

**Node/Interface/Service links:** Node links to `/node/:id` (Vue SPA). Interface links to the legacy `/element/interface.jsp` until that page is migrated. Service links similarly to legacy.

---

## Outages.vue (container)

Thin wrapper — breadcrumb + `OutagesListTable`. Mirrors `Alarms.vue`.

```
Breadcrumb: Outages
```

---

## OutageDetail.vue (container)

Fetches a single outage by ID from the route param. Mirrors `AlarmDetail.vue`.

**Breadcrumb:** Outages → Outage {id}

**Fields displayed:**
| Field | Value |
|---|---|
| Node | Link → `/node/:nodeId` |
| Interface | IP address, link → `/element/interface.jsp` |
| Service | Service name |
| Down Since | Formatted timestamp |
| Lost Service Event | Link → `/event/:lostServiceEventId` |
| Restored | Formatted timestamp, or status label if still active |
| Restored Event | Link → `/event/:regainedServiceEventId` (if present) |
| Perspective | Location label |
| Requisition | foreignSource value |

**States:**
- Loading: "Loading outage…" (same pattern as AlarmDetail)
- Not found / API error: "Outage not found" + link back to `/outages`

---

## Menu

Update the "Outages" menu entry href from `/opennms/outage/index.jsp` to `/opennms/ui/#/outages`.

---

## Testing

Add `getOutage(id)` unit test to `ui/tests/datasource/opennms-client.test.ts` alongside the existing outage service tests. No new test file needed.

---

## Out of Scope

- Box widgets (`nodeOutages-box`, `interfaceOutages-box`, etc.)
- Path outage pages
- Scheduled outage admin pages
- Advanced filter UI (zoom-in/discard filter links from the JSP) — pagination + active/all toggle is sufficient for v1
