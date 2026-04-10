# Node Detail Page — Vue SPA Replacement Design

**Date:** 2026-04-05
**Phase:** Modern UI Phase 2b
**Branch:** `feature/jmx-config-vue`

## Summary

Replace `opennms-webapp/src/main/webapp/element/node.jsp` with a Vue 3 SPA page at `/#/node/:id`. The existing JSP is redirected to the Vue route via `sendRedirect`. All data is fetched via REST — no server-rendered HTML fragments, no server-generated PNG images.

This is a **core panels** replacement. Discovery protocol panels (LLDP, CDP, OSPF, IS-IS, Bridge) are deferred to Phase 3 (topology work).

---

## Scope

### In scope
- Node header (label, status badge, location, foreign source)
- SNMP attributes + asset description panel
- Surveillance category chips (with admin edit link)
- IP and SNMP interfaces tabs (reusing existing components)
- Availability panel: per-service percentage cards + expandable Chart.js timeline
- Recent events panel (last 5, link to full list)
- Recent outages panel (last 24h, link to full list)
- Admin actions bar: Rescan (REST), Update SNMP / Schedule Outage / Edit in Requisition (links)
- `node.jsp` → Vue route redirect
- Update internal Vue SPA links (dashboard widgets, etc.) to use `/#/node/:id`

### Out of scope (deferred)
- Enlinkd discovery panels (LLDP, CDP, OSPF, IS-IS, Bridge) — Phase 3 topology work
- Path outage / critical path panel
- Notifications box
- Hardware inventory tab
- Measurements/bandwidth graphs on SNMP interfaces (natural follow-on after this lands)

---

## Architecture

### Component structure

```
ui/src/
├── containers/
│   └── NodeDetail.vue                  ← page shell, breadcrumbs, route param extraction
├── components/NodeDetail/
│   ├── NodeHeader.vue                  ← label, status badge, location, foreign source
│   ├── NodeInfoPanel.vue               ← SNMP attrs + asset description
│   ├── CategoryPanel.vue               ← category chips, admin edit link
│   ├── AvailabilityPanel.vue           ← percentage cards + expandable Chart.js timeline
│   ├── RecentEventsPanel.vue           ← wraps existing EventsTable.vue
│   ├── RecentOutagesPanel.vue          ← wraps existing OutagesTable.vue
│   └── AdminActionsBar.vue             ← admin-gated; Rescan button + navigation links
├── composables/
│   ├── useNodeDetail.ts                ← GET /api/v2/nodes/{id}
│   ├── useNodeAvailability.ts          ← GET /rest/availability/nodes/{id} + GET /api/v2/outages (FIQL)
│   ├── useNodeEvents.ts                ← GET /api/v2/events?_s=nodeId=={id}&limit=5
│   └── useNodeOutages.ts              ← GET /api/v2/outages?_s=...node.id=={id}&limit=5
└── (no new service file — composables call nodeService.ts, outageService.ts,
    and eventService.ts directly)
```

### Reused existing components (no rebuild needed)
- `ui/src/components/Nodes/IpInterfacesTable.vue`
- `ui/src/components/Nodes/SnmpInterfacesTable.vue`
- `ui/src/components/Nodes/EventsTable.vue`
- `ui/src/components/Nodes/OutagesTable.vue`
- `ui/src/components/Nodes/InterfacesTabs.vue`
- `ui/src/components/Resources/Graph.vue` (Chart.js wrapper — reference for availability timeline impl)

### Existing services to extend/reuse
- `ui/src/services/nodeService.ts` — already wraps node detail, interfaces, availability
- `ui/src/services/outageService.ts` — already wraps outages with FIQL support
- `ui/src/services/eventService.ts` — already wraps events with FIQL support

---

## Page Layout

Single scrollable column. Panels load independently — each shows a skeleton until its composable resolves. A failed panel shows an inline error without affecting other panels.

```
┌─────────────────────────────────────────────────────┐
│  BreadCrumbs: Nodes > {label}                       │
├─────────────────────────────────────────────────────┤
│  NodeHeader                                         │
│  {label}  [UP/DOWN badge]  Location  Foreign source │
│  AdminActionsBar (admin role only):                 │
│  [Rescan] [Update SNMP] [Schedule Outage] [Requisition] │
├───────────────────────┬─────────────────────────────┤
│  NodeInfoPanel        │  CategoryPanel              │
│  sysName, sysObjectID │  Category chips             │
│  sysLocation          │  [Edit categories] (admin)  │
│  sysContact           │                             │
│  sysDescription       │                             │
│  Asset description    │                             │
├───────────────────────┴─────────────────────────────┤
│  AvailabilityPanel                                  │
│  [ICMP 99.8%] [HTTP 100%] [SNMP 97.2%]  ← cards    │
│  [▼ Show timeline]  ← expands Chart.js chart        │
├─────────────────────────────────────────────────────┤
│  InterfacesTabs                                     │
│  [IP Interfaces tab] [SNMP Interfaces tab]          │
├─────────────────────────────────────────────────────┤
│  RecentEventsPanel    (last 5 · View all events →)  │
├─────────────────────────────────────────────────────┤
│  RecentOutagesPanel   (last 24h · View all outages →)│
└─────────────────────────────────────────────────────┘
```

---

## Data Flow

| Composable | Endpoint | Notes |
|---|---|---|
| `useNodeDetail` | `GET /api/v2/nodes/{id}` | Blocks NodeHeader. Accepts numeric ID or `foreignSource:foreignId`. |
| `useNodeAvailability` | `GET /rest/availability/nodes/{id}` + `GET /api/v2/outages?_s=monitoredService.ipInterface.node.id=={id}` | Two parallel calls; merged in composable. |
| `useNodeEvents` | `GET /api/v2/events?_s=nodeId=={id}&limit=5&orderBy=id&order=DESC` | FIQL filter. |
| `useNodeOutages` | `GET /api/v2/outages?_s=monitoredService.ipInterface.node.id=={id}&limit=5&orderBy=ifLostService&order=DESC` | FIQL filter, active + resolved. |
| Interfaces | Internal to `IpInterfacesTable` / `SnmpInterfacesTable` | Self-fetching; no new composable needed. |

---

## Availability Visualization

### Percentage cards (always visible)
Data source: `GET /rest/availability/nodes/{id}` → per-service availability percentages.

Each monitored service gets a compact card: service name, IP address, availability %, colored status ring.

Thresholds:
- ≥ 99% → green
- ≥ 95% → amber
- < 95% → red

Cards arranged in a responsive flex row.

### Expandable timeline (lazy-fetched on expand)
Data source: `GET /api/v2/outages?_s=monitoredService.ipInterface.node.id=={id}` filtered to the last 24 hours.

Rendered as a **horizontal stacked bar chart** using Chart.js (already installed at `^3.9.1`):
- Y axis: one row per service (label = `{serviceName} @ {ipAddress}`)
- X axis: last 24 hours (Unix timestamps)
- Green dataset: uptime segments (full window minus outage intervals)
- Red dataset: outage segments (from `ifLostService` to `ifRegainedService` or now if still active)
- Clicking a red segment navigates to `/opennms/outage/detail.htm?id={outageId}` via Chart.js `onClick`
- Outage IDs stored in dataset metadata alongside segment bounds

**Why not the measurements API?** Availability state is in the outage table, not in RRD/TSS. The measurements API (`POST /rest/measurements`) is the right tool for performance time-series (bandwidth, CPU, latency) — a natural follow-on for the SNMP interfaces tab.

Implementation uses Chart.js bar chart in horizontal mode with stacked datasets — no custom plugin required; compatible with the existing `HtmlLegendPlugin.ts`.

---

## Routing & Redirect

### Vue router entry (`ui/src/main/router/index.ts`)
```ts
{
  path: '/node/:id',
  component: () => import('@/containers/NodeDetail.vue'),
  // no adminRole guard — all authenticated users can view
}
```

### node.jsp redirect (`opennms-webapp/src/main/webapp/element/node.jsp`)
```jsp
<%@ page import="org.opennms.web.element.ElementUtil" %>
<% response.sendRedirect(request.getContextPath()
   + "/ui/index.html#/node/" + ElementUtil.getNodeId(request)); %>
```

`ElementUtil.getNodeId()` already handles both `?node=123` (numeric) and `?node=foreignSource:foreignId` formats. The v2 API accepts both natively.

---

## Admin Actions

Rendered only when the session has `ROLE_ADMIN`.

| Action | Implementation |
|---|---|
| Rescan | `PUT /api/v2/nodes/{id}/rescan` — FeatherButton, spinner while in-flight, success/error toast on completion |
| Update SNMP | Link → `/opennms/admin/snmpConfig.htm?node={id}` — shown only if node has SNMP primary interface |
| Schedule Outage | Link → `/opennms/admin/sched-outages/editoutage.jsp` |
| Edit in Requisition | Link → `/opennms/admin/editForeignSource.jsp?foreignSource={foreignSource}` — shown only if node has a foreign source |

---

## Feather DS Conventions (from established patterns)

- Component backgrounds: `var($surface)` — adapts light/dark
- Hover states and chips: `var($shade-4)` — alpha-based, works on any background
- Active/selected: `var($primary)` + `var($primary-text-on-color)`
- Page background / breadcrumbs: `var($background)`
- FeatherCheckbox labels: slot content, not `label` prop
- Import both `open-light.css` and `open-dark.css` in `main.ts` (already done)
- Never hardcode colors in component SCSS

---

## Verification

1. Deploy overlay: `./build-dark-mode-overlay.sh` + restart container
2. Navigate to an existing node via `/opennms/element/node.jsp?node=1` — confirm redirect to `/#/node/1`
3. Confirm NodeHeader renders with correct label, status badge, location
4. Confirm SNMP attributes and categories load independently
5. Confirm availability cards show correct percentages per service
6. Expand timeline — confirm Chart.js renders green/red segments over 24h window
7. Click a red outage segment — confirm navigation to outage detail page
8. Confirm IP and SNMP interfaces tabs load
9. Confirm recent events and outages panels load
10. As admin: confirm Rescan button fires `PUT /api/v2/nodes/{id}/rescan` and shows toast
11. As admin: confirm Update SNMP / Schedule Outage / Edit in Requisition links are present
12. As non-admin: confirm admin bar is hidden
13. Test in both light and dark mode — no hardcoded colors, no broken contrast
14. Test with a node that has no SNMP primary interface — Update SNMP link hidden
15. Test with a node not in a requisition — Edit in Requisition link hidden
