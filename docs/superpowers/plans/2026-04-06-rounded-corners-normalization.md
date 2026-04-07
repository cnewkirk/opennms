# Rounded Corners Normalization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all hardcoded `border-radius` pixel values in the Vue SPA with the SCSS token system defined in `vars.scss`, and fix 4 components whose `.card` elements are missing `border-radius` entirely.

**Architecture:** Five category-first sweeps (surface, dialogs, badges, pills, circles). Each sweep targets one element type, producing logically organized diffs. Files touched in multiple sweeps (e.g., `TopologyDetailPanel.vue`) are noted per task — open the file once per sweep and make all changes for that sweep.

**Tech Stack:** Vue 3, SCSS, Vite (`@/` alias resolves to `ui/src/`). All style blocks use `<style lang="scss" scoped>`. The SCSS token file is `ui/src/styles/vars.scss`.

---

## Import pattern

Every component that references `vars.$border-radius-*` needs this at the **top** of its `<style>` block, before any other `@use` or `@import`:

```scss
@use '@/styles/vars' as vars;
```

If the file already has `@use '@featherds/styles/themes/variables' as fvars;`, add the vars line **before** it:
```scss
@use '@/styles/vars' as vars;
@use '@featherds/styles/themes/variables' as fvars;
```

For non-scoped style blocks that use `@import` (rare, only in menu components), add `@use '@/styles/vars' as vars;` as the **very first** line before the `@import`.

Components already importing vars (no import change needed):
- `Common/TableCard.vue` — already done, skip
- `Common/EmptyList.vue` — already done, skip

---

## Token reference

| Token | Value | Use for |
|---|---|---|
| `$border-radius-surface` | 4px | Cards, panels, form containers, table wrappers, section boxes |
| `$border-radius-sm` | 8px | Dialog/modal roots, floating tooltips, action buttons |
| `$border-radius-xs` | 3px | Badges, severity chips, inline code/tag spans |
| `$border-radius-pill` | 20px | *(new)* Pill badges, status chips, toggle buttons |
| `$border-radius-round` | 50% | Circles, avatars, dot indicators |

---

## Task 1: Add `$border-radius-pill` token to vars.scss

**Files:**
- Modify: `ui/src/styles/vars.scss`

- [ ] **Step 1: Add the pill token**

Open `ui/src/styles/vars.scss`. Current content (lines 1-8):
```scss
$border-radius: (
  xs: 3px,
  s: 5px,
  sm: 8px,
  m: 10px,
  round: 50%,
  surface: 4px
) !default;
```

Change to:
```scss
$border-radius: (
  xs: 3px,
  s: 5px,
  sm: 8px,
  m: 10px,
  round: 50%,
  surface: 4px,
  pill: 20px
) !default;
```

Then add the variable after line 17 (`$border-radius-surface`):
```scss
$border-radius-pill: map.get($border-radius, 'pill');
```

- [ ] **Step 2: Verify the token is exported**

```bash
grep 'border-radius-pill' ui/src/styles/vars.scss
```
Expected: two lines — the map entry and the variable assignment.

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms/ui && git add src/styles/vars.scss && git commit -m "feat(ui): add border-radius-pill token to vars.scss"
```

---

## Task 2: Sweep 1a — Fix 4 sharp cards (missing border-radius)

These four components have `.card` elements with `elevation()` shadow but **no `border-radius`**. They look like sharp squares.

**Files:**
- Modify: `ui/src/components/Nodes/EventsTable.vue`
- Modify: `ui/src/components/Nodes/InterfacesTabs.vue`
- Modify: `ui/src/components/Nodes/OutagesTable.vue`
- Modify: `ui/src/components/Nodes/NodeAvailabilityGraph.vue`

- [ ] **Step 1: Fix EventsTable.vue**

File has existing imports at lines 87-88:
```scss
@use '@featherds/styles/themes/variables' as fvars;
@use '@featherds/styles/themes/utils';
```

Add vars import before them:
```scss
@use '@/styles/vars' as vars;
@use '@featherds/styles/themes/variables' as fvars;
@use '@featherds/styles/themes/utils';
```

Find the `.card` rule (around line 91):
```scss
.card {
  @include elevation(2);
  padding: 15px;
  margin-bottom: 15px;
}
```

Change to:
```scss
.card {
  @include elevation(2);
  padding: 15px;
  margin-bottom: 15px;
  border-radius: vars.$border-radius-surface;
}
```

- [ ] **Step 2: Fix InterfacesTabs.vue**

Style block has no existing imports (line 27 is bare `<style lang="scss" scoped>`). Add:
```scss
@use '@/styles/vars' as vars;
```
as first line of style block.

Find `.card` rule and add `border-radius: vars.$border-radius-surface;`.

- [ ] **Step 3: Fix OutagesTable.vue**

Same pattern as EventsTable — has existing featherds imports. Add vars import before them. Add `border-radius: vars.$border-radius-surface;` to `.card`.

- [ ] **Step 4: Fix NodeAvailabilityGraph.vue**

Style block has no existing imports (line 68). Add `@use '@/styles/vars' as vars;` as first line. Add `border-radius: vars.$border-radius-surface;` to `.card`.

- [ ] **Step 5: Verify**

```bash
grep -A6 '\.card {' ui/src/components/Nodes/EventsTable.vue ui/src/components/Nodes/InterfacesTabs.vue ui/src/components/Nodes/OutagesTable.vue ui/src/components/Nodes/NodeAvailabilityGraph.vue
```
Expected: each `.card` block now contains `border-radius: vars.$border-radius-surface`.

- [ ] **Step 6: Commit**

```bash
cd /Users/chance/git/opennms/ui && git add src/components/Nodes/EventsTable.vue src/components/Nodes/InterfacesTabs.vue src/components/Nodes/OutagesTable.vue src/components/Nodes/NodeAvailabilityGraph.vue && git commit -m "fix(ui): add missing border-radius to sharp card elements in Nodes tab components"
```

---

## Task 3: Sweep 1b — Tokenize surface values in main containers

All containers use `border-radius: 4px` on `.card` or panel elements. Replace each with `vars.$border-radius-surface`.

**Files:**
- Modify: `ui/src/containers/Alarms.vue`
- Modify: `ui/src/containers/Outages.vue`
- Modify: `ui/src/containers/AlarmDetail.vue`
- Modify: `ui/src/containers/OutageDetail.vue`
- Modify: `ui/src/containers/NodeDetails.vue`
- Modify: `ui/src/containers/Dashboard.vue`
- Modify: `ui/src/containers/WallboardConfig.vue`
- Modify: `ui/src/containers/SurveillanceViewsConfig.vue`
- Modify: `ui/src/containers/MibCompiler.vue`
- Modify: `ui/src/containers/EventConfigurationDetail.vue`
- Modify: `ui/src/containers/BusinessServicesAdmin.vue`

- [ ] **Step 1: Alarms.vue and Outages.vue**

Both files have the same single-line `.card` rule. Neither has any `@use` imports. Add `@use '@/styles/vars' as vars;` as first line of `<style scoped lang="scss">` block.

`Alarms.vue` line 60 (after import added):
```scss
.card { background: var($surface); padding: 0; margin-bottom: 16px; border-radius: 4px; }
```
Change `border-radius: 4px` to `border-radius: vars.$border-radius-surface`.

Do the same for `Outages.vue` (identical rule at line 60).

- [ ] **Step 2: AlarmDetail.vue**

Has `@use '@featherds/styles/themes/variables' as fvars;` at line 586. Add vars import before it. Change `border-radius: 4px` at line 596 (`.card`) and line 693 (nested element) to `vars.$border-radius-surface`.

- [ ] **Step 3: OutageDetail.vue**

No existing imports. Add `@use '@/styles/vars' as vars;` as first line of style block. Change `border-radius: 4px` at line 171 (`.card`) to `vars.$border-radius-surface`.

- [ ] **Step 4: NodeDetails.vue**

No existing imports. Add `@use '@/styles/vars' as vars;` as first line of style block. Change `border-radius: 4px` at line 194 to `vars.$border-radius-surface`.

- [ ] **Step 5: Dashboard.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 4px` at line 159 to `vars.$border-radius-surface`.

- [ ] **Step 6: WallboardConfig.vue**

Has `@use "@featherds/styles/mixins/typography" as typo;` at line 153. Add vars import before it. Change `border-radius: 4px` at line 180 to `vars.$border-radius-surface`.

- [ ] **Step 7: SurveillanceViewsConfig.vue**

Has `@use "@featherds/styles/mixins/typography" as typo;` at line 168. Add vars import before it. Change `border-radius: 4px` at line 195 to `vars.$border-radius-surface`.

- [ ] **Step 8: MibCompiler.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 4px` at line 279 to `vars.$border-radius-surface`.

- [ ] **Step 9: EventConfigurationDetail.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 4px` at line 174 to `vars.$border-radius-surface`.

- [ ] **Step 10: BusinessServicesAdmin.vue**

Has `@use "@featherds/styles/mixins/typography" as typo;` at line 238. Add vars import before it.

Two changes:
- Line 275: `border-radius: 8px` (dashed empty-state container) → `vars.$border-radius-surface`
- Line 313: `border-radius: 4px` → `vars.$border-radius-surface`

- [ ] **Step 11: Verify**

```bash
grep 'border-radius' ui/src/containers/Alarms.vue ui/src/containers/Outages.vue ui/src/containers/AlarmDetail.vue ui/src/containers/OutageDetail.vue ui/src/containers/NodeDetails.vue ui/src/containers/Dashboard.vue ui/src/containers/WallboardConfig.vue ui/src/containers/SurveillanceViewsConfig.vue ui/src/containers/MibCompiler.vue ui/src/containers/EventConfigurationDetail.vue ui/src/containers/BusinessServicesAdmin.vue
```
Expected: no bare `border-radius: [0-9]` values — all should be `vars.$border-radius-surface`.

- [ ] **Step 12: Commit**

```bash
cd /Users/chance/git/opennms/ui && git add src/containers/Alarms.vue src/containers/Outages.vue src/containers/AlarmDetail.vue src/containers/OutageDetail.vue src/containers/NodeDetails.vue src/containers/Dashboard.vue src/containers/WallboardConfig.vue src/containers/SurveillanceViewsConfig.vue src/containers/MibCompiler.vue src/containers/EventConfigurationDetail.vue src/containers/BusinessServicesAdmin.vue && git commit -m "refactor(ui): tokenize border-radius in main container views (sweep 1b)"
```

---

## Task 4: Sweep 1c — Tokenize surface values in NodeDetail components

**Files:**
- Modify: `ui/src/components/NodeDetail/NodeInfoPanel.vue`
- Modify: `ui/src/components/NodeDetail/NodeHeader.vue` *(also touched in Task 8 for badge)*
- Modify: `ui/src/components/NodeDetail/CategoryPanel.vue` *(also touched in Task 8 for chip)*
- Modify: `ui/src/components/NodeDetail/AvailabilityPanel.vue`
- Modify: `ui/src/components/NodeDetail/ResourceTypeGroup.vue`
- Modify: `ui/src/components/NodeDetail/ResourceAccordion.vue`
- Modify: `ui/src/components/NodeDetail/ResourceGraphsPanel.vue` *(also touched in Task 7 for 3px values)*
- Modify: `ui/src/components/NodeDetail/ResourceQueryBuilder/QueryBuilder.vue`
- Modify: `ui/src/components/NodeDetail/ResourceQueryBuilder/CustomChart.vue` *(also touched in Task 7)*

- [ ] **Step 1: NodeInfoPanel.vue**

No existing imports. Add `@use '@/styles/vars' as vars;` as first line of style block. Change `border-radius: 4px` at line 72 to `vars.$border-radius-surface`.

- [ ] **Step 2: NodeHeader.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 4px` at line 55 to `vars.$border-radius-surface`. (The `border-radius: 12px` at line 78 on `.status-badge` is handled in Task 8.)

- [ ] **Step 3: CategoryPanel.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 4px` at line 56 to `vars.$border-radius-surface`. (The `border-radius: 16px` at line 87 on `.chip` is handled in Task 8.)

- [ ] **Step 4: AvailabilityPanel.vue**

Has `@use '@featherds/styles/themes/variables' as fvars;` at line 193. Add vars import before it. Change `border-radius: 8px` at line 209 (`.avail-card`) to `vars.$border-radius-surface`.

- [ ] **Step 5: ResourceTypeGroup.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 4px` at line 81 to `vars.$border-radius-surface`.

- [ ] **Step 6: ResourceAccordion.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 4px` at line 63 to `vars.$border-radius-surface`.

- [ ] **Step 7: ResourceGraphsPanel.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change **only** `border-radius: 4px` at line 169 to `vars.$border-radius-surface`. (The four `border-radius: 3px` values at lines 188, 199, 211, 244 are handled in Task 7.)

- [ ] **Step 8: QueryBuilder.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 4px` at lines 127 and 148 (both) to `vars.$border-radius-surface`.

- [ ] **Step 9: CustomChart.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 4px` at line 184 to `vars.$border-radius-surface`. (The `border-radius: 3px` values at lines 222, 283, 294, 333 are handled in Task 7.)

- [ ] **Step 10: Verify**

```bash
grep 'border-radius: [0-9]' ui/src/components/NodeDetail/NodeInfoPanel.vue ui/src/components/NodeDetail/NodeHeader.vue ui/src/components/NodeDetail/CategoryPanel.vue ui/src/components/NodeDetail/AvailabilityPanel.vue ui/src/components/NodeDetail/ResourceTypeGroup.vue ui/src/components/NodeDetail/ResourceAccordion.vue ui/src/components/NodeDetail/ResourceGraphsPanel.vue ui/src/components/NodeDetail/ResourceQueryBuilder/QueryBuilder.vue ui/src/components/NodeDetail/ResourceQueryBuilder/CustomChart.vue
```
Expected: only `3px` values remain (those are swept in Task 7). No bare `4px` or `8px`.

- [ ] **Step 11: Commit**

```bash
cd /Users/chance/git/opennms/ui && git add src/components/NodeDetail/NodeInfoPanel.vue src/components/NodeDetail/NodeHeader.vue src/components/NodeDetail/CategoryPanel.vue src/components/NodeDetail/AvailabilityPanel.vue src/components/NodeDetail/ResourceTypeGroup.vue src/components/NodeDetail/ResourceAccordion.vue src/components/NodeDetail/ResourceGraphsPanel.vue src/components/NodeDetail/ResourceQueryBuilder/QueryBuilder.vue src/components/NodeDetail/ResourceQueryBuilder/CustomChart.vue && git commit -m "refactor(ui): tokenize border-radius in NodeDetail components (sweep 1c)"
```

---

## Task 5: Sweep 1d — Tokenize surface values in remaining components

**Files:**
- Modify: `ui/src/components/Dashboard/WidgetFrame.vue`
- Modify: `ui/src/components/Dashboard/widgets/SummaryWidget.vue`
- Modify: `ui/src/components/Common/CollapsibleSection.vue`
- Modify: `ui/src/components/Nodes/ColumnSelectionDrawer.vue`
- Modify: `ui/src/components/SurveillanceDashboard/SurveillanceCellDetail.vue`
- Modify: `ui/src/components/BSM/AddEdgeForm.vue`
- Modify: `ui/src/components/BSM/BusinessServiceEditor.vue`
- Modify: `ui/src/components/JmxConfig/MBeanTree.vue`
- Modify: `ui/src/components/JmxConfig/ReviewSave.vue`
- Modify: `ui/src/components/MibCompiler/MibTree.vue`
- Modify: `ui/src/components/MibCompiler/GenerateEventsDialog.vue`
- Modify: `ui/src/components/MibCompiler/GenerateDataCollectionDialog.vue`
- Modify: `ui/src/components/MibCompiler/FileEditorDialog.vue`
- Modify: `ui/src/components/Resources/Graph.vue` *(also touched in Task 7 for 3px)*
- Modify: `ui/src/components/Resources/GraphDataTable.vue`
- Modify: `ui/src/components/Alarms/AlarmsListTable.vue` *(also touched in Task 7 for 3px)*
- Modify: `ui/src/components/Outages/OutagesListTable.vue`
- Modify: `ui/src/components/SnmpCollectionsConfig/SnmpCollectionForm.vue` *(also touched in Task 8 for 16px chip)*
- Modify: `ui/src/components/Topology/TopologyDetailPanel.vue` *(also touched in Tasks 7 and 8)*
- Modify: `ui/src/components/Topology/TopologyToolbar.vue` *(also touched in Task 8 for 16px pill)*
- Modify: `ui/src/components/Topology/CreateLinkModal.vue` *(also touched in Task 6 for modal root 8px)*
- Modify: `ui/src/components/Menu/UserSelfServiceMenuItem.vue`
- Modify: `ui/src/components/Menu/UserNotificationsMenuItem.vue`
- Modify: `ui/src/components/Layout/BreadCrumbs.vue`

For each file below, add `@use '@/styles/vars' as vars;` if not already present (see import pattern at top of plan), then apply the changes.

- [ ] **Step 1: WidgetFrame.vue**

No existing imports. Add import. Two `border-radius: 4px` values (lines 96 and 133) → both to `vars.$border-radius-surface`.

- [ ] **Step 2: SummaryWidget.vue**

No existing imports. Add import. Change `border-radius: 4px` at line 112 → `vars.$border-radius-surface`.

- [ ] **Step 3: CollapsibleSection.vue**

No existing imports. Add import. Change `border-radius: 4px` at line 26 → `vars.$border-radius-surface`.

- [ ] **Step 4: ColumnSelectionDrawer.vue**

No existing imports. Add import. Change `border-radius: 5px` at line 175 → `vars.$border-radius-surface`.

- [ ] **Step 5: SurveillanceCellDetail.vue**

No existing imports. Add import. Change `border-radius: 4px` at lines 105 and 153 → `vars.$border-radius-surface`. Leave `border-radius: 2px` at line 175 (legend color swatch) as-is.

- [ ] **Step 6: BSM/AddEdgeForm.vue**

Has `@use "@featherds/styles/mixins/typography" as typo;`. Add vars import before it. Change `border-radius: 8px` at line 242 (`.add-edge-form` container) → `vars.$border-radius-surface`. Change `border-radius: 4px` at line 258 → `vars.$border-radius-surface`.

- [ ] **Step 7: BSM/BusinessServiceEditor.vue**

Has `@use "@featherds/styles/mixins/typography" as typo;`. Add vars import before it. Change `border-radius: 4px` at line 430 → `vars.$border-radius-surface`.

- [ ] **Step 8: JmxConfig/MBeanTree.vue and ReviewSave.vue**

Both have `@use "@featherds/styles/mixins/typography" as typo;`. Add vars import before it in each. Change `border-radius: 4px` → `vars.$border-radius-surface` in both.

- [ ] **Step 9: MibCompiler/MibTree.vue, GenerateEventsDialog.vue, GenerateDataCollectionDialog.vue, FileEditorDialog.vue**

None have existing imports. Add `@use '@/styles/vars' as vars;` as first line of style block in each. Change all `border-radius: 4px` values → `vars.$border-radius-surface`.

`MibTree.vue` has two `4px` values (lines 191, 210) — change both.

- [ ] **Step 10: Resources/Graph.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 4px` at line 260 → `vars.$border-radius-surface`. Leave `border-radius: 3px` at line 301 and `border-radius: 2px` at line 382 for Task 7.

- [ ] **Step 11: Resources/GraphDataTable.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 4px` at line 244 → `vars.$border-radius-surface`.

- [ ] **Step 12: Alarms/AlarmsListTable.vue**

Has `@use '@featherds/styles/themes/variables' as fvars;`. Add vars import before it. Change **all** `border-radius: 4px` values → `vars.$border-radius-surface`. Leave `border-radius: 3px` values for Task 7. The 4px values are at lines 509, 533, 549, 564, 647, 650, 665, 816.

- [ ] **Step 13: Outages/OutagesListTable.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 4px` at lines 281, 305, 321, 339, 419 (all five) → `vars.$border-radius-surface`.

- [ ] **Step 14: SnmpCollectionsConfig/SnmpCollectionForm.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 4px` at line 172 → `vars.$border-radius-surface`. Leave `border-radius: 16px` at line 218 for Task 8.

- [ ] **Step 15: Topology/TopologyDetailPanel.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change **only** `border-radius: 4px` at line 496 → `vars.$border-radius-surface`. Leave `border-radius: 8px 0 0 8px` at line 469 as-is (intentional partial). Leave `12px` ×2, `10px`, and `3px` values for Tasks 7 and 8.

- [ ] **Step 16: Topology/TopologyToolbar.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 4px` at line 223 → `vars.$border-radius-surface`. Leave `border-radius: 16px` at line 155 for Task 8.

- [ ] **Step 17: Topology/CreateLinkModal.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 4px` at lines 217 and 258 → `vars.$border-radius-surface`. Leave `border-radius: 8px` at line 191 (`.create-link-modal` root) for Task 6.

- [ ] **Step 18: Menu/UserSelfServiceMenuItem.vue**

Has two `<style>` blocks. The second (non-scoped, line 223) has `border-radius: 4px` at line 228. Add `@use '@/styles/vars' as vars;` as first line of that style block. Change `border-radius: 4px` → `vars.$border-radius-surface`.

- [ ] **Step 19: Menu/UserNotificationsMenuItem.vue**

Has two `<style>` blocks. The second (non-scoped, line 432) has `@import "@featherds/styles/themes/variables"` and `border-radius: 4px` at line 437 (`.feather-menu-dropdown`). Add `@use '@/styles/vars' as vars;` before the `@import`. Change `border-radius: 4px` → `vars.$border-radius-surface`. Leave `border-radius: 1.5em` and `border-radius: .8rem` in the first (scoped) block as-is.

- [ ] **Step 20: Layout/BreadCrumbs.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 4px` at line 35 → `vars.$border-radius-surface`.

- [ ] **Step 21: Verify**

```bash
grep 'border-radius: [0-9]' \
  ui/src/components/Dashboard/WidgetFrame.vue \
  ui/src/components/Dashboard/widgets/SummaryWidget.vue \
  ui/src/components/Common/CollapsibleSection.vue \
  ui/src/components/Nodes/ColumnSelectionDrawer.vue \
  ui/src/components/SurveillanceDashboard/SurveillanceCellDetail.vue \
  ui/src/components/BSM/AddEdgeForm.vue \
  ui/src/components/BSM/BusinessServiceEditor.vue \
  ui/src/components/JmxConfig/MBeanTree.vue \
  ui/src/components/JmxConfig/ReviewSave.vue \
  ui/src/components/Resources/GraphDataTable.vue \
  ui/src/components/Outages/OutagesListTable.vue \
  ui/src/components/Topology/CreateLinkModal.vue \
  ui/src/components/Layout/BreadCrumbs.vue
```
Expected: no remaining hardcoded values in these files.

- [ ] **Step 22: Commit**

```bash
cd /Users/chance/git/opennms/ui && git add \
  src/components/Dashboard/WidgetFrame.vue \
  src/components/Dashboard/widgets/SummaryWidget.vue \
  src/components/Common/CollapsibleSection.vue \
  src/components/Nodes/ColumnSelectionDrawer.vue \
  src/components/SurveillanceDashboard/SurveillanceCellDetail.vue \
  src/components/BSM/AddEdgeForm.vue \
  src/components/BSM/BusinessServiceEditor.vue \
  src/components/JmxConfig/MBeanTree.vue \
  src/components/JmxConfig/ReviewSave.vue \
  src/components/MibCompiler/MibTree.vue \
  src/components/MibCompiler/GenerateEventsDialog.vue \
  src/components/MibCompiler/GenerateDataCollectionDialog.vue \
  src/components/MibCompiler/FileEditorDialog.vue \
  src/components/Resources/Graph.vue \
  src/components/Resources/GraphDataTable.vue \
  src/components/Alarms/AlarmsListTable.vue \
  src/components/Outages/OutagesListTable.vue \
  src/components/SnmpCollectionsConfig/SnmpCollectionForm.vue \
  src/components/Topology/TopologyDetailPanel.vue \
  src/components/Topology/TopologyToolbar.vue \
  src/components/Topology/CreateLinkModal.vue \
  src/components/Menu/UserSelfServiceMenuItem.vue \
  src/components/Menu/UserNotificationsMenuItem.vue \
  src/components/Layout/BreadCrumbs.vue && \
  git commit -m "refactor(ui): tokenize border-radius in remaining surface components (sweep 1d)"
```

---

## Task 6: Sweep 2 — Dialogs, modals, floating panels, action buttons (`$border-radius-sm: 8px`)

**Files:**
- Modify: `ui/src/components/Topology/CreateLinkModal.vue` *(partially done in Task 5 — only the 8px root remains)*
- Modify: `ui/src/components/EventConfiguration/Dialog/EventConfigFilesUploadReportDialog.vue`
- Modify: `ui/src/components/EventConfigEventCreate/BasicInformation.vue`
- Modify: `ui/src/components/NodeDetail/AdminActionsBar.vue`
- Modify: `ui/src/components/Topology/TopologyEdgeTooltip.vue`
- Modify: `ui/src/components/Topology/TopologyGraph.vue`

- [ ] **Step 1: CreateLinkModal.vue — modal root**

Import already added in Task 5. Change `border-radius: 8px` at line 191 (`.create-link-modal`) → `vars.$border-radius-sm`.

- [ ] **Step 2: EventConfigFilesUploadReportDialog.vue**

No existing vars import. Add `@use '@/styles/vars' as vars;`. The file has other `@use` statements — check and add before them. Change `border-radius: 8px` at line 90 → `vars.$border-radius-sm`.

- [ ] **Step 3: BasicInformation.vue**

Check for existing imports. Add `@use '@/styles/vars' as vars;` if needed. Change `border-radius: 8px` at lines 772 and 792 (both section containers) → `vars.$border-radius-sm`.

- [ ] **Step 4: AdminActionsBar.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 8px` at line 98 (`:deep(.btn)`) → `vars.$border-radius-sm`.

- [ ] **Step 5: TopologyEdgeTooltip.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 6px` at line 68 (tooltip container) → `vars.$border-radius-sm`. Leave `border-radius: 50%` at line 95 for Task 9.

- [ ] **Step 6: TopologyGraph.vue**

Check for existing imports. Add `@use '@/styles/vars' as vars;` if needed. Change `border-radius: 8px` at line 140 (graph info overlay) → `vars.$border-radius-sm`.

- [ ] **Step 7: Verify**

```bash
grep 'border-radius: [0-9]' \
  ui/src/components/Topology/CreateLinkModal.vue \
  ui/src/components/EventConfiguration/Dialog/EventConfigFilesUploadReportDialog.vue \
  ui/src/components/EventConfigEventCreate/BasicInformation.vue \
  ui/src/components/NodeDetail/AdminActionsBar.vue \
  ui/src/components/Topology/TopologyEdgeTooltip.vue \
  ui/src/components/Topology/TopologyGraph.vue
```
Expected: no bare numeric values remain (only `vars.$border-radius-sm`).

- [ ] **Step 8: Commit**

```bash
cd /Users/chance/git/opennms/ui && git add \
  src/components/Topology/CreateLinkModal.vue \
  src/components/EventConfiguration/Dialog/EventConfigFilesUploadReportDialog.vue \
  src/components/EventConfigEventCreate/BasicInformation.vue \
  src/components/NodeDetail/AdminActionsBar.vue \
  src/components/Topology/TopologyEdgeTooltip.vue \
  src/components/Topology/TopologyGraph.vue && \
  git commit -m "refactor(ui): tokenize border-radius in dialog and modal containers (sweep 2)"
```

---

## Task 7: Sweep 3 — Badges and inline chips (`$border-radius-xs: 3px`)

All values in this sweep (3px, 4px, 5px, 6px on small inline tag/chip elements) → `vars.$border-radius-xs`.

**Files:**
- Modify: `ui/src/components/Common/SeverityBadge.vue`
- Modify: `ui/src/components/Common/ClearSummary.vue`
- Modify: `ui/src/components/Device/DCBGroupFilters.vue`
- Modify: `ui/src/components/ZenithConnect/ZenithConnectView.vue`
- Modify: `ui/src/components/ZenithConnect/ZenithConnectRegisterResult.vue`
- Modify: `ui/src/components/EventConfiguration/EventConfigSourceTable.vue`
- Modify: `ui/src/components/EventConfiguration/EventConfigUploadFilesTab.vue`
- Modify: `ui/src/components/EventConfigurationDetail/EventConfigEventTable.vue`
- Modify: `ui/src/components/NodeDetail/NetworkTab.vue`
- Modify: `ui/src/components/NodeDetail/EnlinkdLinksTab.vue`
- Modify: `ui/src/components/Nodes/NodesTable.vue`
- Modify: `ui/src/components/Alarms/AlarmsListTable.vue` *(import already added in Task 5)*
- Modify: `ui/src/components/Resources/Graph.vue` *(import already added in Task 5)*
- Modify: `ui/src/components/NodeDetail/ResourceGraphsPanel.vue` *(import already added in Task 4)*
- Modify: `ui/src/components/NodeDetail/ResourceQueryBuilder/CustomChart.vue` *(import already added in Task 4)*
- Modify: `ui/src/components/NodeDetail/ResourceQueryBuilder/AttributeList.vue`
- Modify: `ui/src/components/Topology/TopologyDetailPanel.vue` *(import already added in Task 5)*

- [ ] **Step 1: SeverityBadge.vue**

Has `@use '@featherds/styles/themes/variables' as fvars;`. Add vars import before it. Change `border-radius: 3px` at line 19 → `vars.$border-radius-xs` (value stays 3px, just tokenized).

- [ ] **Step 2: ClearSummary.vue**

Has `@use '@featherds/styles/themes/variables' as fvars;`. Add vars import before it. Change `border-radius: 6px` at line 27 → `vars.$border-radius-xs`.

- [ ] **Step 3: DCBGroupFilters.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 5px` at line 90 → `vars.$border-radius-xs`.

- [ ] **Step 4: ZenithConnectView.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 5px` at lines 226 and 234 (both) → `vars.$border-radius-xs`.

- [ ] **Step 5: ZenithConnectRegisterResult.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 5px` at lines 269 and 277 (both) → `vars.$border-radius-xs`.

- [ ] **Step 6: EventConfigSourceTable.vue**

Has `@use '@/styles/_transitionDataTable'` and other `@use` statements. Add `@use '@/styles/vars' as vars;` as the **first** `@use` in the block. Change `border-radius: 5px` at line 264 → `vars.$border-radius-xs`.

- [ ] **Step 7: EventConfigUploadFilesTab.vue**

Has `@use "@featherds/styles/themes/variables"`. Add vars import before it. Change `border-radius: 5px` at lines 436 and 477 (both) → `vars.$border-radius-xs`.

- [ ] **Step 8: EventConfigEventTable.vue**

Has multiple `@use` statements including `@use '@/styles/_transitionDataTable'`. Add `@use '@/styles/vars' as vars;` as the **first** `@use`. Change `border-radius: 5px` at line 307 → `vars.$border-radius-xs`.

- [ ] **Step 9: NetworkTab.vue**

Has `@use '@featherds/styles/themes/variables' as fvars;`. Add vars import before it. Change `border-radius: 3px` at line 419 → `vars.$border-radius-xs`. Leave `border-radius: 50%` at line 359 for Task 9.

- [ ] **Step 10: EnlinkdLinksTab.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 3px` at line 111 → `vars.$border-radius-xs`.

- [ ] **Step 11: NodesTable.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 3px` at line 597 → `vars.$border-radius-xs`. Leave `border-radius: 100%` at line 652 for Task 9.

- [ ] **Step 12: AlarmsListTable.vue**

Import already added in Task 5. Change all `border-radius: 3px` values (lines 711, 754, 783, 829) → `vars.$border-radius-xs`. Leave `border-radius: 4px` values already tokenized in Task 5.

- [ ] **Step 13: Resources/Graph.vue**

Import already added in Task 5. Change `border-radius: 3px` at line 301 → `vars.$border-radius-xs`. Leave `border-radius: 2px` at line 382 (chart color swatch, intentional) as-is.

- [ ] **Step 14: ResourceGraphsPanel.vue**

Import already added in Task 4. Change `border-radius: 3px` at lines 188, 199, 211, 244 (all four) → `vars.$border-radius-xs`.

- [ ] **Step 15: ResourceQueryBuilder/CustomChart.vue**

Import already added in Task 4. Change `border-radius: 3px` at lines 222, 283, 294, 333 (all four) → `vars.$border-radius-xs`.

- [ ] **Step 16: ResourceQueryBuilder/AttributeList.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 3px` at line 123 → `vars.$border-radius-xs`.

- [ ] **Step 17: TopologyDetailPanel.vue**

Import already added in Task 5. Change `border-radius: 3px` at line 705 → `vars.$border-radius-xs`. Leave the 12px and 10px chip values for Task 8.

- [ ] **Step 18: Verify**

```bash
grep -rn 'border-radius: [356][px]' ui/src/components/ ui/src/containers/ --include="*.vue"
```
Expected: no matches (all 3px, 5px, 6px badge values are now tokenized).

- [ ] **Step 19: Commit**

```bash
cd /Users/chance/git/opennms/ui && git add \
  src/components/Common/SeverityBadge.vue \
  src/components/Common/ClearSummary.vue \
  src/components/Device/DCBGroupFilters.vue \
  src/components/ZenithConnect/ZenithConnectView.vue \
  src/components/ZenithConnect/ZenithConnectRegisterResult.vue \
  src/components/EventConfiguration/EventConfigSourceTable.vue \
  src/components/EventConfiguration/EventConfigUploadFilesTab.vue \
  src/components/EventConfigurationDetail/EventConfigEventTable.vue \
  src/components/NodeDetail/NetworkTab.vue \
  src/components/NodeDetail/EnlinkdLinksTab.vue \
  src/components/Nodes/NodesTable.vue \
  src/components/Alarms/AlarmsListTable.vue \
  src/components/Resources/Graph.vue \
  src/components/NodeDetail/ResourceGraphsPanel.vue \
  src/components/NodeDetail/ResourceQueryBuilder/CustomChart.vue \
  src/components/NodeDetail/ResourceQueryBuilder/AttributeList.vue \
  src/components/Topology/TopologyDetailPanel.vue && \
  git commit -m "refactor(ui): tokenize border-radius on badge and chip elements (sweep 3)"
```

---

## Task 8: Sweep 4 — Pills and large-radius chip shapes (`$border-radius-pill: 20px`)

These elements are pill-shaped — they use large radii (10px–20px / 1rem) that produce fully-rounded ends on small elements. Use the new `$border-radius-pill` token.

**Files:**
- Modify: `ui/src/components/Common/PerspectiveToggle.vue`
- Modify: `ui/src/components/Topology/TopologyToolbar.vue` *(import already added in Task 5)*
- Modify: `ui/src/containers/JmxConfigGenerator.vue`
- Modify: `ui/src/components/NodeDetail/NodeHeader.vue` *(import already added in Task 4)*
- Modify: `ui/src/components/NodeDetail/CategoryPanel.vue` *(import already added in Task 4)*
- Modify: `ui/src/components/SnmpCollectionsConfig/SnmpCollectionForm.vue` *(import already added in Task 5)*
- Modify: `ui/src/components/Dashboard/widgets/NodesWidget.vue`
- Modify: `ui/src/components/Nodes/AlarmsTable.vue` *(import already added in Task 2 or needs adding)*
- Modify: `ui/src/components/Topology/TopologyDetailPanel.vue` *(import already added in Task 5)*

- [ ] **Step 1: PerspectiveToggle.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 20px` at line 43 → `vars.$border-radius-pill`.

- [ ] **Step 2: TopologyToolbar.vue**

Import already added in Task 5. Change `border-radius: 16px` at line 155 → `vars.$border-radius-pill`.

- [ ] **Step 3: JmxConfigGenerator.vue**

Has `@use "@featherds/styles/mixins/typography" as typo;` at line 115. Add vars import before it. Change `border-radius: 1rem` at line 137 (`.step-chip`) → `vars.$border-radius-pill`.

- [ ] **Step 4: NodeHeader.vue**

Import already added in Task 4. Change `border-radius: 12px` at line 78 (`.status-badge`) → `vars.$border-radius-pill`.

- [ ] **Step 5: CategoryPanel.vue**

Import already added in Task 4. Change `border-radius: 16px` at line 87 (`.chip`) → `vars.$border-radius-pill`.

- [ ] **Step 6: SnmpCollectionForm.vue**

Import already added in Task 5. Change `border-radius: 16px` at line 218 (file type tag chip) → `vars.$border-radius-pill`.

- [ ] **Step 7: NodesWidget.vue**

No existing imports. Add `@use '@/styles/vars' as vars;`. Change `border-radius: 12px` at line 224 (inline badge) → `vars.$border-radius-pill`.

- [ ] **Step 8: Nodes/AlarmsTable.vue**

Has `@use '@featherds/styles/themes/variables' as fvars;`. Add vars import before it. Change `border-radius: 10px` at line 262 (chip element) → `vars.$border-radius-pill`.

- [ ] **Step 9: TopologyDetailPanel.vue**

Import already added in Task 5. Change `border-radius: 12px` at lines 586 (`__chip`) and 596 (`__cat-chip`) → `vars.$border-radius-pill`. Change `border-radius: 10px` at line 628 (`-badge`) → `vars.$border-radius-pill`.

- [ ] **Step 10: Verify**

```bash
grep -rn 'border-radius: 1[0-9]\|border-radius: 2[0-9]\|border-radius: 1rem\|border-radius: \.8rem' ui/src/components/ ui/src/containers/ --include="*.vue"
```
Expected: no bare large-radius values. The only large-radius values should now be `vars.$border-radius-pill` or intentional `rem`/`em` pill values (`1.5em`, `.8rem` in `UserNotificationsMenuItem.vue`).

- [ ] **Step 11: Commit**

```bash
cd /Users/chance/git/opennms/ui && git add \
  src/components/Common/PerspectiveToggle.vue \
  src/components/Topology/TopologyToolbar.vue \
  src/containers/JmxConfigGenerator.vue \
  src/components/NodeDetail/NodeHeader.vue \
  src/components/NodeDetail/CategoryPanel.vue \
  src/components/SnmpCollectionsConfig/SnmpCollectionForm.vue \
  src/components/Dashboard/widgets/NodesWidget.vue \
  src/components/Nodes/AlarmsTable.vue \
  src/components/Topology/TopologyDetailPanel.vue && \
  git commit -m "refactor(ui): tokenize border-radius on pill and large-chip elements (sweep 4)"
```

---

## Task 9: Sweep 5 — Circles (`$border-radius-round: 50%`)

**Files:**
- Modify: `ui/src/components/NodeDetail/NetworkTab.vue` *(import already added in Task 7)*
- Modify: `ui/src/components/Nodes/NodesTable.vue` *(import already added in Task 7)*
- Modify: `ui/src/components/SnmpCollectionsConfig/GroupFileList.vue`
- Modify: `ui/src/components/Topology/TopologyEdgeTooltip.vue` *(import already added in Task 6)*

- [ ] **Step 1: NetworkTab.vue**

Import already added in Task 7. Change `border-radius: 50%` at line 359 → `vars.$border-radius-round`.

- [ ] **Step 2: NodesTable.vue**

Import already added in Task 7. Change `border-radius: 100%` at line 652 → `vars.$border-radius-round`.

- [ ] **Step 3: GroupFileList.vue**

Check for existing imports. Add `@use '@/styles/vars' as vars;` if needed. Change `border-radius: 50%` → `vars.$border-radius-round`.

- [ ] **Step 4: TopologyEdgeTooltip.vue**

Import already added in Task 6. Change `border-radius: 50%` at line 95 → `vars.$border-radius-round`.

- [ ] **Step 5: Verify**

```bash
grep -rn 'border-radius: 50%\|border-radius: 100%' ui/src/components/ ui/src/containers/ --include="*.vue"
```
Expected: no bare percentage values remain.

- [ ] **Step 6: Commit**

```bash
cd /Users/chance/git/opennms/ui && git add \
  src/components/NodeDetail/NetworkTab.vue \
  src/components/Nodes/NodesTable.vue \
  src/components/SnmpCollectionsConfig/GroupFileList.vue \
  src/components/Topology/TopologyEdgeTooltip.vue && \
  git commit -m "refactor(ui): tokenize border-radius on circle elements (sweep 5)"
```

---

## Task 10: Build, verify, and deploy

- [ ] **Step 1: Run the full verification grep**

```bash
grep -rn 'border-radius: [0-9]' ui/src/components/ ui/src/containers/ --include="*.vue" | grep -v "dist/"
```
Expected output: only intentional exceptions remain:
- `SurveillanceCellDetail.vue` — `2px` legend swatch
- `Resources/Graph.vue` — `2px` chart color swatch
- `FileEditor/Console.vue` — `1px` accent (if present)
- `TopologyDetailPanel.vue` — `8px 0 0 8px` (partial radius)
- `UserNotificationsMenuItem.vue` — `.8rem` (rem-based pill)
- `Map/LeafletMap.vue` — `15px` (map cluster marker, not a UI surface)

Any other remaining values are bugs — fix them before proceeding.

- [ ] **Step 2: Build**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build 2>&1 | tail -20
```
Expected: build succeeds with no SCSS errors.

- [ ] **Step 3: Verify built CSS has no bare feather vars**

```bash
grep -c 'var(--feather' ui/src/main/dist/assets/index-*.css
```
This should produce a number (not zero — `var(--feather-*)` wrapped in `var()` is fine). The check is that we didn't introduce any bare `--feather-*` unwrapped values.

- [ ] **Step 4: Verify bundle hash**

```bash
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
```
Note the hash.

- [ ] **Step 5: Deploy to container**

```bash
cd /Users/chance/git/opennms/ui && ./deploy-to-container.sh test-opennms
```

- [ ] **Step 6: Verify live hash matches built hash**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
```
Must match hash from Step 4.

- [ ] **Step 7: Verify bundle is served**

```bash
HASH=$(grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html); curl -s -o /dev/null -w "%{http_code}" http://localhost:8980/opennms/ui/$HASH
```
Expected: `200`

- [ ] **Step 8: Spot-check visually**

Open in browser and check:
- Node detail page — panels/cards should have rounded corners
- Alarms list — table card, severity badges rounded
- Topology — perspective toggle pill shape, edge tooltip rounded
- Dashboard — widgets have rounded corners

Tell user to hard-refresh with `Cmd+Option+R` (Safari) or `Cmd+Shift+R` (Chrome/Firefox).

- [ ] **Step 9: Final commit if any fixes were needed**

If Step 1 found unexpected remaining values and you fixed them:
```bash
cd /Users/chance/git/opennms/ui && git add -p && git commit -m "fix(ui): clean up remaining hardcoded border-radius values"
```

---

## Intentionally unchanged values (do not touch)

| File | Value | Reason |
|---|---|---|
| `TopologyDetailPanel.vue` | `8px 0 0 8px` | Flush-right edge panel — partial radius is intentional |
| `SurveillanceCellDetail.vue` | `2px` | Legend color swatch |
| `Resources/Graph.vue` | `2px` | Chart legend color swatch |
| `UserNotificationsMenuItem.vue` | `1.5em`, `.8rem` | Relative-unit pill shapes, correct and intentional |
| `Menubar.vue` | `1.5em` | Relative-unit pill |
| `WallboardList.vue` | `0.75rem` | Decorative accent corner |
| `SurveillanceViewList.vue` | `0.75rem` | Decorative accent corner |
| `SurveillanceViewRowColumnEditor.vue` | `0.75rem` | Decorative accent corner |
| `WallboardConfig/DashletRow.vue` | `0.75rem` | Decorative accent corner |
| `Map/LeafletMap.vue` | `15px` | Leaflet cluster marker (not a UI surface) |
| `FileEditor/Console.vue` | `1px` | Tiny console border accent |
| `Menu/Search.vue` | `0 !important` | Intentional search input override |
