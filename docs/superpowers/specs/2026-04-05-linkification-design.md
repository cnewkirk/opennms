# Linkification — Consistent Cross-Reference Links

**Date:** 2026-04-05
**Branch:** feature/jmx-config-vue
**Status:** Approved

## Objective

Make entity references (node labels, alarm IDs, event IDs, outage IDs) clickable `router-link`s everywhere they appear in the Vue SPA. Currently some components display these as plain text even though Vue routes exist for their detail pages.

## Scope

### In Scope

Link the following entities wherever they appear as plain text, using existing Vue routes:

| Entity | Components with plain text | Target route |
|---|---|---|
| Node label / node ID | EventsTable, MapNodesGrid, MapAlarmsGrid, NodesTable (legacy href) | `/node/${nodeId}` or `/node/${foreignSource}:${foreignId}` |
| Alarm ID | MapAlarmsGrid | `/alarm/${alarmId}` |
| Event node label | EventsTable | `/node/${nodeId}` |

### Out of Scope

- IP addresses, service names, monitoring locations, categories, foreign source/ID, SNMP interfaces — no Vue detail pages exist yet; leave as plain text
- UEI include/exclude filter toggle — separate future task (requires its own design for the +/- filter pattern)
- Creating new Vue detail pages or routes
- Changing any existing links that already work

## Implementation Pattern

Follow the existing `<router-link>` pattern already used throughout the codebase:

```vue
<router-link :to="`/node/${node.id}`">{{ node.label }}</router-link>
```

Use `getNodeCriteria(node)` from `components/Nodes/utils.ts` when the full node object is available (prefers `foreignSource:foreignId` format).

Use `@click.stop` on links inside clickable table rows to prevent double navigation (pattern already established in AlarmsListTable).

## Files to Modify

1. **ui/src/components/Nodes/EventsTable.vue** — link nodeLabel column to node detail
2. **ui/src/components/Map/MapNodesGrid.vue** — link node label/ID to node detail
3. **ui/src/components/Map/MapAlarmsGrid.vue** — link alarm ID to alarm detail, node label to node detail
4. **ui/src/components/Nodes/NodesTable.vue** — convert legacy `<a href>` to `router-link`

## Future Work (TODO)

- UEI include/exclude filter toggle: the legacy UI had +/- indicators next to UEIs that let users filter events by including or excluding a specific UEI. This pattern should be designed and implemented as a separate task.
