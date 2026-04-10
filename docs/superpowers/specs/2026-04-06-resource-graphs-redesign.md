# Resource Graphs Panel Redesign: Pinned + Grouped Accordion

## Problem

The current `ResourceHighlights` component flatmaps every graph definition from every child resource into a single list. For nodes with many SNMP interfaces, JMX MBeans, or other resource types, this produces 100-200+ graphs. The UX is either too sparse (4 truncated) or overwhelming (show-all dumps everything).

## Solution

Replace the flat highlight list with two sections:

1. **Pinned Graphs** — user-configurable top section with explicitly chosen graphs
2. **Resource Categories** — two-level accordion grouped by `typeLabel`, drilling from type → resource → graphs

## Data Layer

### Grouped resource structure

`useResourceGraphs` currently returns a flat `highlights: HighlightItem[]`. Change it to return grouped data:

```ts
interface ResourceWithDefinitions {
  resourceId: string
  label: string
  definitions: string[]    // pre-fab graph names
}

interface ResourceGroup {
  typeLabel: string
  resources: ResourceWithDefinitions[]
}
```

The composable fetches all resources and definitions as today, but groups results by `resource.typeLabel` instead of flatmapping.

### Pin state management

New composable: `usePinnedGraphs(nodeId: string)`

**Storage keys:**
- `pinned-graphs:defaults` — user-level default pins (applied to any node)
- `pinned-graphs:{nodeId}` — per-node overrides

**Pin identifier:** `{ resourceId: string, definition: string }` — minimal tuple that uniquely identifies a graph.

**Resolution logic:** Per-node pins take full priority. If a node has no per-node pins, fall back to user-level defaults. The composable resolves pin identifiers against the current resource groups to produce renderable `HighlightItem[]` (with labels).

**API:**
```ts
interface UsePinnedGraphs {
  pinnedItems: ComputedRef<HighlightItem[]>
  isPinned: (resourceId: string, definition: string) => boolean
  togglePin: (item: HighlightItem) => void
  setAsDefault: () => void   // copies current node pins to user-level defaults
  hasPerNodePins: ComputedRef<boolean>
}
```

## Pinned Graphs Section

New component: `PinnedGraphs.vue` — replaces `ResourceHighlights`.

- **Layout:** 2-column grid of `Graph` cards (1-column below 800px), same as current
- **Pin icon:** Each card shows a filled pin icon in the title area. Clicking unpins the graph.
- **Empty state:** Single line of muted text: "Pin graphs from the categories below to keep them here."
- **Default toggle:** When pinning, an inline checkbox appears: "Use as default for all nodes." This writes to `pinned-graphs:defaults`.
- **No truncation** — user explicitly chose these, show all of them

## Resource Categories Accordion

New components: `ResourceAccordion.vue` and `ResourceTypeGroup.vue`.

### Accordion behavior

- One collapsible section per `typeLabel`
- Header shows type name + resource count, e.g., "SNMP Interface Data (24)"
- **All collapsed by default**
- Search/filter input above the accordion — filters across type names and resource labels

### Two-level drill-down

Expanding a type section reveals a list of resource names (compact rows, not graphs). Each row shows:
- Resource label
- Number of available graph definitions (subtle count)

Expanding a resource within the type renders its graphs in a 2-column grid inline. Each graph card shows an outline (unfilled) pin icon — clicking pins it to the top section.

This ensures the user never sees more than one resource's worth of graphs at a time (~3-6 graphs typically).

## Graph Card Changes

`Graph.vue` receives two new optional props:
- `pinnable: boolean` (default false) — whether to show the pin icon
- `pinned: boolean` (default false) — filled vs outline icon state

Emits: `@toggle-pin` — parent handles the actual pin logic.

## Component Structure

```
ResourceGraphsPanel.vue        (updated)
├── PinnedGraphs.vue            (new)
├── ResourceAccordion.vue       (new)
│   ├── search/filter input
│   └── ResourceTypeGroup.vue   (new, one per typeLabel)
│       ├── resource name rows
│       └── Graph.vue cards      (existing, with pin icon)
├── Saved Charts section         (unchanged)
└── QueryBuilder                 (unchanged)

Composables:
├── useResourceGraphs.ts        (updated — returns ResourceGroup[])
└── usePinnedGraphs.ts          (new)
```

## Scope Boundaries

- **In scope:** `ResourceGraphsPanel` on the node detail page only
- **Out of scope:** Full-page `/resource-graphs/graphs` route, `ResourceList`, `NodeResourceList`
- **Unchanged:** Time range picker, saved charts, query builder, `Graph.vue` rendering logic

## localStorage Schema

```
pinned-graphs:defaults → PinIdentifier[]
pinned-graphs:{nodeId} → PinIdentifier[]

type PinIdentifier = { resourceId: string; definition: string }
```
