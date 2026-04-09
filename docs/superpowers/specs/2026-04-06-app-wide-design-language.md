# App-Wide Design Language — Problem-First Perspective

**Date:** 2026-04-06
**Branch:** `feature/jmx-config-vue`
**Scope:** Node Detail density reduction + global perspective toggle applied across all status-aware pages

---

## Problem

The node detail page requires 2+ pages of scroll to reach actionable content (graphs, alarms, interface details). Every section — healthy or not — is rendered at full weight. The operator's primary question ("is something wrong?") competes with walls of green/neutral information.

The same density problem exists across the Nodes list, Alarms list, Outages list, and Surveillance Dashboard.

---

## Core Principle: Problem-First by Default

Healthy state is the expected state. It doesn't need to be shown — it needs to be *confirmed* quietly. Degraded state is the exception. It needs to be surfaced immediately and completely.

The design gives operators a **perspective toggle** to switch between these two orientations globally, with problem-first as the default.

---

## The Perspective Toggle

### Component

A two-segment pill button: `Problems | Full`

- **Placement:** Top-right of page content area, below breadcrumbs, above page content. Consistent position on every applicable page.
- **Not** in the nav bar — it's page-scoped visually even though state is global.
- **Visual:** Active segment uses brand blue (`#0081ad`). Inactive segment is muted. Small — a preference control, not a primary action.

### State

- New `usePerspectiveStore` (Pinia)
- Single field: `perspective: 'problems' | 'full'`
- Persisted to `localStorage` key `onms.perspective`
- Default: `'problems'`

### Applicability

Toggle is rendered on:
- Node Detail
- Nodes list
- Alarms list
- Outages list
- Surveillance Dashboard

Toggle is **not** rendered on:
- AlarmDetail, EventDetail, OutageDetail (single-item pages — already showing one problem)
- Dashboard, ResourceGraphs, Topology, config pages (operational/exploratory tools)

---

## Node Detail — Per-Mode Behavior

### Problems mode (default)

Each section applies a "silence the green" rule. The page is short when things are healthy; full when something is wrong.

| Section | Problems mode |
|---|---|
| NodeHeader | Always visible. Answers: is the node up or down? |
| AdminActionsBar | Always visible (admin needs these regardless of state). |
| Availability | Show only service cards below 100%. If all healthy: replace entire section with `✓ All services healthy` (ClearSummary). No cards, no chart. |
| NodeInfo / CategoryPanel | Collapsed to a one-line summary (`sysName · Location · N categories`). Expandable via chevron (CollapsibleSection). |
| Interfaces | Show only DOWN interfaces. If all up: `✓ All X interfaces up` with chevron to expand. |
| Activity (Alarms/Events/Outages) | Show only active/unresolved items. If none: `✓ No active alarms` quietly. No empty tables rendered. |
| Resource Graphs | Not rendered inline. A `View Graphs →` link in the header area next to the toggle. |

**Net effect:** A fully healthy node in Problems mode is 3–4 lines. A node with active problems fills the page with exactly what matters.

### Full mode

Renders all sections as currently designed, normalized to the shared card structure described below.

---

## Other Status-Aware Pages — Per-Mode Behavior

### Nodes list (`/nodes`)

| Mode | Behavior |
|---|---|
| Problems | Filter table to only nodes with active alarms or outages. Show `Showing X of Y nodes with active problems` above the table (StatusSummaryLine). |
| Full | Show all nodes as today. |

### Alarms list (`/alarms`)

| Mode | Behavior |
|---|---|
| Problems | Pre-apply active-only filter: severity not CLEARED, not acknowledged. Replaces current manual filter step. |
| Full | Show all alarms including cleared/acknowledged. |

### Outages list (`/outages`)

| Mode | Behavior |
|---|---|
| Problems | Show only unresolved outages (`ifRegainedService == null`). |
| Full | Show all outages including resolved. |

### Surveillance Dashboard

| Mode | Behavior |
|---|---|
| Problems | Dim 100%-green cells: reduce opacity, remove hover affordance. Problem cells dominate. Grid structure (rows/columns) unchanged. |
| Full | All cells at full opacity as today. |

---

## Shared Components

### `ClearSummary.vue`

Reusable "all clear" line used wherever Problems mode collapses a healthy section.

```
✓  All services healthy          [expand ›]
```

- Subtle green checkmark icon
- Muted secondary text color
- Optional expand chevron (when the section is collapsible)
- Same visual treatment everywhere — not celebratory, just quiet

**Props:** `message: string`, `expandable?: boolean`
**Emits:** `expand`

### `CollapsibleSection.vue`

Wrapper for sections that aren't operationally urgent.

- Title + chevron toggle
- Slot for content
- `collapsed` prop: true in Problems mode, false in Full mode
- Collapse state is **not** persisted — resets on page navigation

**Props:** `title: string`, `collapsed: boolean`

### `StatusSummaryLine.vue`

Muted count line for list pages.

```
Showing 4 of 312 nodes with active problems
```

- Used on Nodes list, Alarms list, Outages list
- Same component, different noun/count passed as props

**Props:** `shown: number`, `total: number`, `noun: string`

---

## Card Structure Normalization

AlarmDetail already has the canonical card pattern:
- `elevation(2)` mixin
- `border-radius: 4px`
- `padding: 16px`
- `headline4` section titles with `margin-bottom: 12px`

Node Detail panels (NodeInfoPanel, CategoryPanel, AvailabilityPanel, NodeActivityTab, ResourceGraphsPanel) do not fully match this. Part of this work is normalizing them so every panel on every detail page uses the same card structure. One visual rhythm app-wide.

---

## Implementation Order

1. `usePerspectiveStore` + localStorage persistence
2. `PerspectiveToggle.vue` component
3. `ClearSummary.vue`, `CollapsibleSection.vue`, `StatusSummaryLine.vue`
4. Node Detail — Problems mode behavior (highest value, most complex)
5. Card structure normalization on Node Detail panels
6. Nodes list — Problems mode filter
7. Alarms list — Problems mode pre-filter
8. Outages list — Problems mode pre-filter
9. Surveillance Dashboard — dim green cells

---

## Non-Goals

- No changes to AlarmDetail, EventDetail, OutageDetail structure (separate density cleanup if needed)
- No changes to Dashboard, ResourceGraphs, Topology, or config pages
- Collapse state is not persisted per-node or per-session
- No "custom" third perspective mode (YAGNI)
- No animation on section collapse/expand (keep it snappy)
