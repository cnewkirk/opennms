# Rounded Corners Normalization — Design Spec

**Date:** 2026-04-06 (revised)
**Branch:** feature/jmx-config-vue
**Scope:** Full token normalization across all Vue SPA components

---

## Goal

Eliminate all hardcoded `border-radius` pixel values in the Vue SPA and replace them with the existing SCSS token system. Additionally fix 4 components whose `.card` elements have no `border-radius` at all (sharp squares). The result: a single source of truth in `vars.scss` — changing global corner rounding is a one-line edit.

---

## Token System

`ui/src/styles/vars.scss` already defines these tokens. One new token (`$border-radius-pill`) is added:

| Token | Value | Element category |
|---|---|---|
| `$border-radius-xs` | 3px | Badges, severity chips, inline highlight spans |
| `$border-radius-s` | 5px | *(defined, not used — retained for compatibility)* |
| `$border-radius-sm` | 8px | Dialogs, modals, floating tooltips, dropdown panels |
| `$border-radius-m` | 10px | *(defined, not used — retained for compatibility)* |
| `$border-radius-surface` | 4px | Cards, panels, table wrappers, sections, drawers |
| `$border-radius-pill` | 20px | *(new)* Toggle buttons, perspective switchers, pill nav |
| `$border-radius-round` | 50% | Circles, avatars, dot indicators |

`$border-radius-s` and `$border-radius-m` are left defined but no component should reference them after this work.

---

## Approach

**Category-first sweeps.** Five passes through the codebase, each targeting one element category. This produces logically organized, reviewable diffs rather than one massive alphabetical sweep.

---

## Sweep 1 — Cards & Panels (`$border-radius-surface: 4px`)

**What:** `.card`, `.panel`, table wrapper containers, section boxes, widget frames, collapsible sections, drawer containers.

**Sharp cards to fix (missing `border-radius` entirely):**
- `ui/src/components/Nodes/EventsTable.vue`
- `ui/src/components/Nodes/InterfacesTabs.vue`
- `ui/src/components/Nodes/OutagesTable.vue`
- `ui/src/components/Nodes/NodeAvailabilityGraph.vue`

**Existing hardcoded `4px` to tokenize:** All containers currently using `border-radius: 4px` on card/panel/section wrappers across containers and components.

**Files in scope (non-exhaustive, identify via grep during implementation):**
`Alarms.vue`, `Outages.vue`, `AlarmDetail.vue`, `OutageDetail.vue`, `NodeDetails.vue`, `Dashboard.vue`, `WallboardConfig.vue`, `SurveillanceViewsConfig.vue`, `MibCompiler.vue`, `JmxConfigGenerator.vue` (container `.card` rule), `EventConfigurationDetail.vue`, `BusinessServicesAdmin.vue`, `WidgetFrame.vue`, `CollapsibleSection.vue`, `ColumnSelectionDrawer.vue`, `TableCard.vue`, `SurveillanceCellDetail.vue`, `SnmpCollectionForm.vue`, `BSM/BusinessServiceEditor.vue`, `BSM/AddEdgeForm.vue`, `JmxConfig/MBeanTree.vue`, `JmxConfig/ReviewSave.vue`, `MibCompiler/MibTree.vue`, `MibCompiler/GenerateEventsDialog.vue`, `MibCompiler/GenerateDataCollectionDialog.vue`, `MibCompiler/FileEditorDialog.vue`, `NodeDetail/NodeInfoPanel.vue`, `NodeDetail/NodeHeader.vue`, `NodeDetail/ResourceTypeGroup.vue`, `NodeDetail/ResourceAccordion.vue`, `NodeDetail/ResourceGraphsPanel.vue`, `NodeDetail/ResourceQueryBuilder/QueryBuilder.vue`, `NodeDetail/ResourceQueryBuilder/CustomChart.vue`, `NodeDetail/ResourceQueryBuilder/AttributeList.vue`, `Resources/Graph.vue`, `Resources/GraphDataTable.vue`.

---

## Sweep 2 — Dialogs & Modals (`$border-radius-sm: 8px`)

**What:** Dialog root containers, modal root elements, floating tooltip boxes, upload report dialogs, dropdown panels.

**Files in scope:**
`Topology/CreateLinkModal.vue` (`.modal-container`), `EventConfiguration/Dialog/EventConfigFilesUploadReportDialog.vue`, `Topology/TopologyDetailPanel.vue` (panel root — `8px 0 0 8px` partial radius is intentional, leave as-is), `EventConfigEventCreate/BasicInformation.vue` (dialog container), `AdminActionsBar.vue` (popover).

**Note:** `Topology/TopologyDetailPanel.vue` has `border-radius: 8px 0 0 8px` on the panel edge — this is intentional (flush to right viewport edge). Leave it as a hardcoded partial radius. Other 4px and 12px values inside that file get tokenized normally.

---

## Sweep 3 — Badges & Chips (`$border-radius-xs: 3px`)

**What:** `SeverityBadge`, inline severity/status chips, small tag-like highlight spans. Values currently at 5-6px get normalized down to 3px — still visibly rounded.

**Files in scope:**
`Common/SeverityBadge.vue`, `Common/ClearSummary.vue` (6px → 3px), `Alarms/AlarmsListTable.vue` (inline chip spans), `Outages/OutagesListTable.vue` (inline chip spans), `Layout/BreadCrumbs.vue` (4px tag badge), `Device/DCBGroupFilters.vue` (5px → 3px), `ZenithConnect/ZenithConnectView.vue` (5px tags), `ZenithConnect/ZenithConnectRegisterResult.vue` (5px tags), `EventConfiguration/EventConfigSourceTable.vue` (5px inline), `EventConfiguration/EventConfigUploadFilesTab.vue` (5px inline), `EventConfigurationDetail/EventConfigEventTable.vue` (5px inline), `Menu/UserNotificationsMenuItem.vue` (4px notification item), `Menu/UserSelfServiceMenuItem.vue` (4px), `NodeDetail/NodeHeader.vue` (12px status badge), `NodeDetail/CategoryPanel.vue` (16px chip), `Nodes/AlarmsTable.vue` (10px chip), `SnmpCollectionsConfig/SnmpCollectionForm.vue` (16px chip), `Dashboard/widgets/NodesWidget.vue` (12px badge).

**Note on WallboardList/SurveillanceViewList 0.75rem values:** These are decorative large-radius accent corners on list item headers — intentional design, not surface elements. Leave as-is.

---

## Sweep 4 — Pills & Toggles (`$border-radius-pill: 20px`)

**What:** Toggle buttons, perspective switchers, pill-shaped nav items. The new `$border-radius-pill: 20px` token is added to `vars.scss`.

**Files in scope:**
`Common/PerspectiveToggle.vue` (20px), `Topology/TopologyToolbar.vue` (16px → 20px), `Menu/Menubar.vue` (1.5em — leave as-is, already using relative units and working correctly).

**Intentional `rem`/`em` pill values left unchanged:** `UserNotificationsMenuItem.vue` (1.5em large notification pill), `WallboardConfig/WallboardList.vue` (0.75rem card accent — reassess in Sweep 1 context).

---

## Sweep 5 — Circles (`$border-radius-round: 50%`)

**What:** Circular elements currently using hardcoded `50%` or `100%`.

**Files in scope:**
`NodeDetail/NetworkTab.vue` (50% dot), `Nodes/NodesTable.vue` (100% → 50%), `Nodes/AlarmsTable.vue` (if any), `SnmpCollectionsConfig/GroupFileList.vue` (50% icon circle), `Topology/TopologyEdgeTooltip.vue` (50% dot).

---

## Out of Scope

- Partial radii used for intentional edge-flush design (e.g., `8px 0 0 8px` on the topology side panel)
- Graph/canvas legend color swatches (2-3px, visually imperceptible, in deeply nested chart code)
- Compiled `dist/` assets — these are build artifacts, not source
- `Menu/Search.vue` `border-radius: 0 !important` — intentional search input override, leave as-is

---

## SCSS Import Requirement

Any component that references `vars.$border-radius-*` must have this at the top of its `<style lang="scss">` block:

```scss
@use '@/styles/vars' as vars;
```

Many components already have this. Add it where missing during each sweep.

---

## Verification

After each sweep, run the yarn build and verify:
1. No bare `--feather-*` values in built CSS (existing check)
2. `grep -r "border-radius: [0-9]" ui/src/components ui/src/containers --include="*.vue"` — should shrink toward zero after all sweeps
3. Visual spot-check of the affected pages in the live container

---

## Files Modified Summary

| Sweep | Token | Approx. component count |
|---|---|---|
| 1 — Cards/panels | `$border-radius-surface` | ~35 |
| 2 — Dialogs/modals | `$border-radius-sm` | ~5 |
| 3 — Badges/chips | `$border-radius-xs` | ~12 |
| 4 — Pills/toggles | `$border-radius-pill` | ~3 |
| 5 — Circles | `$border-radius-round` | ~5 |
| `vars.scss` | Add `$border-radius-pill` | 1 |
