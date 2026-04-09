# Alarms List Page Design

**Date:** 2026-04-05
**Branch:** feature/jmx-config-vue

## Context

This is the first of two specs replacing legacy JSP list pages with full-featured Vue SPA pages. The second spec covers the Outages list page. After both are built, the summary widget KPI cards will link to the new Vue routes.

## Goal

Build a full-featured `/alarms` Vue SPA page that replaces `/opennms/alarm/list.htm`, with filtering, sorting, pagination, and row-level actions (ack/unack/escalate/clear). Also wire the Summary widget's "Active Alarms" KPI card to link to `/alarms` and "Total Nodes" to `/nodes`.

## Files

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/containers/Alarms.vue` | Page shell: breadcrumbs, layout |
| Create | `src/components/Alarms/AlarmsListTable.vue` | Filter bar, table, pagination, row actions |
| Modify | `src/main/router/index.ts` | Add `/alarms` route |
| Modify | `src/components/Dashboard/widgets/SummaryWidget.vue` | Wire KPI card links |

No new services or types required. Uses `getAlarms`, `modifyAlarm` from `alarmService.ts` and the existing `Alarm`, `AlarmQueryParameters` types.

## Architecture

Mirrors the `Nodes.vue` / `NodesTable.vue` pattern. `Alarms.vue` owns the page shell (breadcrumbs, feather grid layout). `AlarmsListTable.vue` owns all data-fetching, filter state, sort state, pagination, and row actions. The existing `AlarmsWidget` is unchanged — it remains focused on the dashboard use case.

## Table Design

**Columns:** Severity · ID · Node · Service · IP Address · Count · Last Event Time · Ack Status

**Default sort:** `lastEventTime DESC`

**Sortable columns:** `severity`, `id`, `count`, `lastEventTime` — clicking a header toggles ASC/DESC.

**Row click:** navigates to `/alarm/:id` (existing alarm detail page).

**Row actions (icon-only, appear on hover):**
- Ack / Unack — toggled by presence of `alarm.ackTime`. Calls `modifyAlarm(id, { ack: true })` or `modifyAlarm(id, { ack: false })`.
- Escalate — calls `modifyAlarm(id, { escalate: true })`.
- Clear — calls `modifyAlarm(id, { clear: true })`.

Action behavior: optimistic disable on click, re-enable + snackbar on failure, row refresh on success. Uses `useSnackbar` composable.

## Filter Bar

Displayed above the table. All filters combine as FIQL AND clauses.

| Filter | Type | Default | FIQL |
|--------|------|---------|------|
| Severity | Multi-select (CRITICAL, MAJOR, MINOR, WARNING, NORMAL, CLEARED) | All except CLEARED | `(severity==X,severity==Y)` |
| Ack status | Toggle: All / Unacknowledged / Acknowledged | Unacknowledged | `ackTime==null` or `ackTime!=null` |
| Node search | Text input (debounced 300ms) | — | `nodeLabel==*foo*` |
| Time range | Preset: 24h / 7d / 30d / All | All | `lastEventTime>={timestamp}` |

## Pagination

25 rows per page. Limit/offset against the v2 API. Footer shows "Showing X–Y of Z alarms". Previous/Next buttons disabled at boundaries.

## Empty & Error States

- **Loading:** 3 skeleton rows (gray bars) while first fetch is in flight.
- **Empty with active filters:** "No alarms match your filters" message + "Reset filters" link.
- **Empty with no filters:** "No alarms" message with check-circle icon (matches dashboard widget style).
- **Error:** Inline error message with a Retry button. No full-page takeover.

## Summary Widget Card Wiring

`SummaryWidget.vue` KPI cards become `<router-link>` wrappers. Cards keep existing styling; the link adds `cursor: pointer` and makes the whole card clickable.

| Card | Destination |
|------|-------------|
| Active Outages | `/outages` (built in the follow-on spec) |
| Active Alarms | `/alarms` |
| Total Nodes | `/nodes` |

The "Active Outages" link will be added in this spec as a `<router-link to="/outages">` even though the `/outages` route does not yet exist — it will resolve once the follow-on spec is implemented.

## Out of Scope

- Bulk selection / bulk actions (follow-on)
- Outages list page (separate spec)
- JSP redirect configuration (separate concern, handled server-side)
