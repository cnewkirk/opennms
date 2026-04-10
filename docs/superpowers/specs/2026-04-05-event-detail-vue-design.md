# Event Detail Vue SPA — Design Spec

**Date:** 2026-04-05
**Branch:** feature/jmx-config-vue

## Overview

Replace the legacy `event/detail.jsp` page with a Vue 3 SPA event detail page, following the same pattern established by the node detail replacement. The JSP becomes a thin redirect. Acknowledge/unacknowledge is intentionally excluded (events are not ack'd; only alarms/situations are).

---

## Data Layer

### `Event` type (`ui/src/types/index.ts`)

Add optional fields currently missing from the type but returned by the v2 API and shown in the legacy JSP:

```ts
ipAddress?: string
serviceName?: string
serviceId?: number
alarmId?: number
operatorInstruction?: string
systemId?: string
nodeLocation?: string
```

### `eventService.ts`

Add a single-record fetch:

```ts
const getEventById = async (id: string | number): Promise<Event | false>
// GET /api/v2/events/{id}
```

### `useEventDetail.ts` composable

Mirrors `useNodeDetail`. Fetches on mount, returns `{ event, loading, error }`.

```ts
const useEventDetail = (id: string) => {
  const event = ref<Event | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  // fetch on mount, set error on 404/failure
  return { event, loading, error }
}
```

---

## Routing & Redirect

### Vue router (`ui/src/main/router/index.ts`)

Add route:

```ts
{
  path: '/event/:id',
  name: 'Event Detail',
  component: () => import('@/containers/EventDetail.vue')
}
```

### JSP redirect (`opennms-webapp/.../event/detail.jsp`)

Replace the existing JSP body with a thin redirect (same pattern as `element/node.jsp`):

```jsp
<%
  String eventId = request.getParameter("id");
  if (eventId == null || eventId.isEmpty()) {
    response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing id parameter");
  } else {
    response.sendRedirect(request.getContextPath() + "/ui/index.html#/event/" + eventId);
  }
%>
```

### `EventsTable.vue`

Change the event ID link from a plain `<a href="/opennms/event/detail.jsp?id=...">` to a `<router-link :to="\`/event/${event.id}\`">` so navigation stays within the SPA.

---

## UI — `EventDetail.vue`

Single container, no sub-components. Feather DS cards and the `v-date` directive for timestamps, severity class on the header card for color coding.

### Layout

**Breadcrumbs:** Home → Events (`/opennms/event/index`) → Event {id}

**Header card** (severity-colored):
- Title: `Event {id}`
- Severity badge

**Details table** (key/value, two columns where it reads naturally):

| Field | Notes |
|---|---|
| Time | `v-date` formatted |
| Node | Link → `/node/:nodeId` (Vue SPA). Blank if no node. |
| Interface | IP address. Link → `/opennms/element/interface.jsp?node=...&intf=...` if node present. TODO: Vue interface detail. |
| Service | Link → `/opennms/element/service.jsp?...` if node+interface present. TODO: Vue service detail. |
| Source Location | `location (systemId)` |
| Node Location | Raw string |
| UEI | Raw string |
| Alarm ID | Link → `/opennms/alarm/detail.htm?id=...`. TODO: Vue alarm detail. |

**Log Message card** — always shown.

**Description card** — always shown.

**Operator Instructions card** — hidden (`v-if`) when null/empty.

**Parameters card** — hidden when empty. Key/value table. Always shown when present (system property gate from legacy JSP is dropped).

### Error state

If event not found or fetch fails, show full-page error message (same pattern as NodeDetails.vue).

---

## TODOs (in-code comments)

These pages remain on the legacy JSP and should be converted in follow-on work:

- Alarm detail → `/opennms/alarm/detail.htm?id=...`
- Interface detail → `/opennms/element/interface.jsp?...`
- Service detail → `/opennms/element/service.jsp?...`

---

## Files Changed / Created

| File | Change |
|---|---|
| `ui/src/types/index.ts` | Extend `Event` interface with 7 optional fields |
| `ui/src/services/eventService.ts` | Add `getEventById` |
| `ui/src/composables/useEventDetail.ts` | New composable |
| `ui/src/containers/EventDetail.vue` | New container |
| `ui/src/main/router/index.ts` | Add `/event/:id` route |
| `ui/src/components/Nodes/EventsTable.vue` | Change `<a>` back to `<router-link>` |
| `opennms-webapp/.../event/detail.jsp` | Replace with redirect |
