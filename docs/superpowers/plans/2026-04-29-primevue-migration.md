# PrimeVue Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all Feather DS Vue component imports with PrimeVue 4 equivalents across all containers and component files, establishing PrimeVue + Aura preset as the sole component library.

**Architecture:** Feather *SCSS design tokens* (`--feather-*` CSS custom properties) remain the source of truth for colors, surfaces, and text. Only Feather *Vue components* (FeatherButton, FeatherInput, FeatherTable, etc.) are replaced. The `primevue-theme-bridge.scss` file already maps PrimeVue design tokens to `--feather-*` vars — do not change that bridge. Feather SCSS variable imports inside `<style>` blocks (e.g. `@import "@featherds/styles/themes/variables"`) may stay — they simply give SCSS access to `$surface`, `$background`, etc., which resolve to the same `--feather-*` vars.

**Tech Stack:** Vue 3 Composition API, PrimeVue 4 (Aura preset, `OpenNMSPreset`), TypeScript, SCSS

**Branch:** `feat/ui-refactor-omnibus`

---

## The Feather → PrimeVue Component Map

Use this mapping throughout all tasks. PrimeVue import paths are exact.

| Feather Component | PrimeVue Replacement | Import |
|---|---|---|
| `FeatherButton` | `Button` | `import Button from 'primevue/button'` |
| `FeatherInput` | `InputText` | `import InputText from 'primevue/inputtext'` |
| `FeatherSelect` | `Select` | `import Select from 'primevue/select'` |
| `FeatherCheckbox` | `Checkbox` | `import Checkbox from 'primevue/checkbox'` |
| `FeatherDialog` | `Dialog` | `import Dialog from 'primevue/dialog'` |
| `FeatherDrawer` | `Drawer` | `import Drawer from 'primevue/drawer'` |
| `FeatherTable` + `FeatherSortHeader` | `DataTable` + `Column` | `import DataTable from 'primevue/datatable'; import Column from 'primevue/column'` |
| `FeatherPagination` | built into `DataTable` (`paginator` prop) | — |
| `FeatherIcon` | `<i class="pi pi-XXX" />` or inline SVG | — |
| `FeatherChip` | `Chip` | `import Chip from 'primevue/chip'` |
| `FeatherChipList` | `InputChips` | `import InputChips from 'primevue/inputchips'` |
| `FeatherTabContainer` + `FeatherTab` + `FeatherTabPanel` | `Tabs` + `TabList` + `Tab` + `TabPanels` + `TabPanel` | `import Tabs from 'primevue/tabs'; import TabList from 'primevue/tablist'; import Tab from 'primevue/tab'; import TabPanels from 'primevue/tabpanels'; import TabPanel from 'primevue/tabpanel'` |
| `FeatherTooltip` | `Tooltip` directive | `import Tooltip from 'primevue/tooltip'` — register as `v-tooltip` |
| `FeatherAutocomplete` | `AutoComplete` | `import AutoComplete from 'primevue/autocomplete'` |
| `FeatherDropdown` + `FeatherDropdownItem` | `Menu` (overlay menu) | `import Menu from 'primevue/menu'` |
| `FeatherExpansionPanel` | `Panel` | `import Panel from 'primevue/panel'` |
| `FeatherList` + `FeatherListItem` | native `<ul>`/`<li>` with CSS, or `Listbox` | `import Listbox from 'primevue/listbox'` |
| `FeatherSortObject` | `{ field, order }` in DataTable | — |
| `FeatherSwitch` | `ToggleSwitch` | `import ToggleSwitch from 'primevue/toggleswitch'` |
| `FeatherDateInput` | `DatePicker` | `import DatePicker from 'primevue/datepicker'` |
| `FeatherTextarea` | `Textarea` | `import Textarea from 'primevue/textarea'` |

### PrimeVue 4 Gotchas

- **DataTable lazy paginator**: needs `@page="onPage"` handler. `onPage` receives `{ first: number }`. Offset = `event.first`. Example: `const onPage = (e: { first: number }) => loadData(e.first)`.
- **DataTable `dataKey`**: use `dataKey="id"`, not `data-key` (the `data-*` prefix bypasses Vue prop binding).
- **Select** (was Dropdown in PrimeVue 3): `v-model` binds to the selected value, `:options` is an array of strings or objects. For object arrays: also set `optionLabel` and `optionValue`.
- **Button icons**: use PrimeIcons CSS class: `icon="pi pi-trash"`. PrimeIcons is already loaded.
- **Dialog**: `v-model:visible` controls open/close. `modal` prop for backdrop. `header` prop for title.
- **Textarea**: named `Textarea` not `TextArea`.
- **FeatherIcon mapping**: look up icons at https://primevue.org/icons/ — PrimeIcons has equivalents for most Feather icons. `pi-pencil`, `pi-trash`, `pi-plus`, `pi-check`, `pi-times`, `pi-search`, `pi-filter`, `pi-download`, `pi-chevron-down`, `pi-chevron-up`, `pi-ellipsis-v`, `pi-arrow-left`, `pi-arrow-right`, `pi-x`, `pi-circle`, `pi-exclamation-triangle`.
- **`FeatherSortHeader` / `FeatherSortObject`**: remove entirely. DataTable handles sorting: add `sortable` prop to `<Column>` and `v-model:sortField` + `v-model:sortOrder` to `<DataTable>`.

### SCSS Pattern Post-Migration

After removing Feather Vue component imports, `<style>` blocks can often keep their Feather SCSS variable imports unchanged since those are just CSS variable accessors:
```scss
@import "@featherds/styles/themes/variables";
// Use $surface → var(--feather-surface), $background → var(--feather-background), etc.
```
This is intentional — the `--feather-*` CSS vars are the design token source of truth.

---

## Build & Verify Sequence (run after every task)

```bash
cd ui && ../target/node/pnpm build
./ui/deploy-to-container.sh test-opennms
# Verify hash:
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
# Hard refresh browser: Cmd+Option+R (Safari) or hold Shift + click reload (Chrome)
```

---

## Task 1: BreadCrumbs Component

**Files:**
- Modify: `ui/src/components/Layout/BreadCrumbs.vue`

BreadCrumbs.vue does not use Feather Vue *components* — it uses Feather SCSS variables and custom markup. The migration here is small: replace the Feather elevation mixin with a direct CSS border, and confirm the component renders correctly with PrimeVue theming active.

Current BreadCrumbs uses:
- `@import "@featherds/styles/mixins/elevation"` — for a border-like look (may or may not be used)
- `@import "@featherds/styles/themes/variables"` — for `$surface`, `$border-light-on-surface`, `$clickable-normal`, `$secondary-text-on-surface`

These SCSS imports are fine to keep. The only change needed is to remove any `@include elevation-*` mixins and replace with direct CSS.

- [ ] **Step 1: Check if elevation mixin is actually used**

```bash
grep -n "elevation" ui/src/components/Layout/BreadCrumbs.vue
```
If no matches, no change is needed — skip to Step 3.

- [ ] **Step 2: If elevation mixin is found, replace with border**

Open `ui/src/components/Layout/BreadCrumbs.vue`. Find any `@include elevation-*` and replace with:
```scss
border: 1px solid var($border-light-on-surface);
```

- [ ] **Step 3: Build and verify BreadCrumbs renders on all main pages**

```bash
cd ui && ../target/node/pnpm build
./ui/deploy-to-container.sh test-opennms
```
Navigate to `/alarms`, `/nodes`, `/outages` — confirm breadcrumb strip renders correctly in both light and dark mode.

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/Layout/BreadCrumbs.vue
git commit -m "chore(ui): clean up BreadCrumbs SCSS — remove unused Feather elevation mixin"
```

---

## Task 2: Alarms Page — AlarmsListTable.vue

**Files:**
- Modify: `ui/src/components/Alarms/AlarmsListTable.vue` (857 lines)
- Modify: `ui/src/containers/Alarms.vue`

Current: uses `@featherds/table` for the table, `FeatherIcon` for status icons, Feather SCSS for typography.

Strategy: replace `@featherds/table` rendering with PrimeVue `DataTable` + `Column`. Keep `FeatherIcon` inline SVG replacements as PrimeIcons where possible.

- [ ] **Step 1: Read the file and identify all Feather component usages**

```bash
grep -n "Feather\|featherds" ui/src/components/Alarms/AlarmsListTable.vue | head -40
```

Note every Feather component used and where in the template it appears.

- [ ] **Step 2: Check what the Feather table renders to understand the column structure**

```bash
grep -n "th\|td\|header\|sort\|column\|FeatherSort" ui/src/components/Alarms/AlarmsListTable.vue | head -30
```

This tells you the column structure to replicate in `<Column>` elements.

- [ ] **Step 3: Replace Feather table imports**

In the `<script setup>` block, remove:
```typescript
import { FeatherSortHeader, FeatherSortObject } from '@featherds/table'
// or any other @featherds/table imports
```

Add:
```typescript
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
```

Remove `FeatherIcon` imports and use `<i class="pi pi-XXX" />` inline in the template.

- [ ] **Step 4: Rewrite the table template section**

Replace whatever renders the alarms rows/columns with PrimeVue DataTable. Use Events.vue as the canonical reference pattern (it has the full lazy paginator pattern):

```vue
<DataTable
  :value="alarms"
  :loading="loading"
  :rows="pageSize"
  :total-records="totalCount"
  lazy
  paginator
  @page="onPage"
  stripedRows
  rowHover
  dataKey="id"
  @row-click="onRowClick"
>
  <Column field="severity" header="Severity" sortable :style="{ width: '110px' }">
    <template #body="{ data }">
      <SeverityBadge :severity="data.severity" />
    </template>
  </Column>
  <!-- Add remaining columns to match the previous Feather table columns -->
</DataTable>
```

The existing columns (check the file) typically include: Severity, ID, Count, Node, Service, Time, UEI/Description. Replicate them exactly.

- [ ] **Step 5: Remove Feather SCSS imports that are no longer needed**

After the template rewrite, check `<style>` for:
```scss
@import "@featherds/table/scss/table";
```
If found and no longer needed, remove it. Keep `@import "@featherds/styles/themes/variables"` and `@import "@featherds/styles/mixins/typography"` — those provide CSS var access.

- [ ] **Step 6: Update Alarms.vue container**

In `ui/src/containers/Alarms.vue`, remove the `@import "@featherds/styles/themes/variables"` from `<style>` if it's only there to support Feather component scoping. If it's used for `var($surface)` etc., keep it.

Also remove the outer `feather-row`/`feather-col-12` wrappers and use direct layout:
```vue
<template>
  <div class="alarms-page">
    <BreadCrumbs :items="breadcrumbs" />
    <PerspectiveToggle />
    <AlarmsListTable />
  </div>
</template>
```
```scss
.alarms-page {
  padding: 0 20px 20px;
}
```

- [ ] **Step 7: Build, deploy, verify**

```bash
cd ui && ../target/node/pnpm build
./ui/deploy-to-container.sh test-opennms
```
Navigate to `http://localhost:8980/opennms/ui/alarms`. Confirm:
- Table renders with alarms data
- Sorting works
- Pagination works (click next page)
- Row click navigates to alarm detail
- Severity badges render with correct colors
- No console errors

- [ ] **Step 8: Commit**

```bash
git add ui/src/components/Alarms/AlarmsListTable.vue ui/src/containers/Alarms.vue
git commit -m "feat(ui): migrate Alarms list to PrimeVue DataTable"
```

---

## Task 3: Outages Page — OutagesListTable.vue

**Files:**
- Modify: `ui/src/components/Outages/OutagesListTable.vue` (435 lines)
- Modify: `ui/src/containers/Outages.vue`

Same strategy as Task 2. Outages uses only Feather table SCSS — no Feather Vue components in the container.

- [ ] **Step 1: Identify Feather usages**

```bash
grep -n "Feather\|featherds\|@featherds" ui/src/components/Outages/OutagesListTable.vue | head -20
```

- [ ] **Step 2: Replace Feather table with DataTable**

Check the existing column structure and replicate it. Typical outage columns: Node, IP Interface, Service, Lost, Regained, Duration.

Remove `@featherds/table` import and replace the table section with:
```vue
<DataTable
  :value="outages"
  :loading="loading"
  :rows="pageSize"
  :total-records="totalCount"
  lazy
  paginator
  @page="onPage"
  stripedRows
  rowHover
  dataKey="id"
>
  <!-- Columns matching the current Feather table columns -->
</DataTable>
```

- [ ] **Step 3: Update Outages.vue container**

Remove `feather-row`/`feather-col-12` wrappers. Match the flat layout pattern used in Events.vue:
```vue
<template>
  <div class="outages-page">
    <BreadCrumbs :items="breadcrumbs" />
    <OutagesListTable />
  </div>
</template>
```

- [ ] **Step 4: Build, deploy, verify**

```bash
cd ui && ../target/node/pnpm build
./ui/deploy-to-container.sh test-opennms
```
Navigate to `http://localhost:8980/opennms/ui/outages`. Confirm table loads, pagination works, rows are clickable.

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Outages/OutagesListTable.vue ui/src/containers/Outages.vue
git commit -m "feat(ui): migrate Outages list to PrimeVue DataTable"
```

---

## Task 4: InterfaceDetail Tabs

**Files:**
- Modify: `ui/src/containers/InterfaceDetail.vue`

InterfaceDetail uses `FeatherTabContainer`, `FeatherTab`, and `FeatherTabPanel`. These map to PrimeVue 4's `Tabs` / `TabList` / `Tab` / `TabPanels` / `TabPanel`.

- [ ] **Step 1: Read the current tab structure**

```bash
grep -n "FeatherTab\|feather-tab\|TabContainer\|TabPanel" ui/src/containers/InterfaceDetail.vue
```

Note the tab labels and what each panel contains.

- [ ] **Step 2: Replace Feather tab imports**

Remove:
```typescript
import { FeatherTabContainer, FeatherTab, FeatherTabPanel } from '@featherds/tabs'
```

Add:
```typescript
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
```

- [ ] **Step 3: Replace tab template**

PrimeVue 4 tab structure (note: `value` prop uses string IDs):
```vue
<Tabs value="overview">
  <TabList>
    <Tab value="overview">Overview</Tab>
    <Tab value="events">Events</Tab>
    <Tab value="outages">Outages</Tab>
    <!-- Add more tabs matching the current Feather tab structure -->
  </TabList>
  <TabPanels>
    <TabPanel value="overview">
      <!-- content that was in first FeatherTabPanel -->
    </TabPanel>
    <TabPanel value="events">
      <!-- content that was in second FeatherTabPanel -->
    </TabPanel>
    <!-- etc. -->
  </TabPanels>
</Tabs>
```

If the active tab was stored in a `ref`, keep it and bind: `<Tabs v-model:value="activeTab">`.

- [ ] **Step 4: Remove Feather tab SCSS**

In `<style>`, remove any `@import "@featherds/tabs/..."` imports.

- [ ] **Step 5: Build, deploy, verify**

```bash
cd ui && ../target/node/pnpm build
./ui/deploy-to-container.sh test-opennms
```
Navigate to a node with an interface at `http://localhost:8980/opennms/ui/interface/{nodeId}/{ip}`. Click each tab. Confirm content loads and active tab highlights correctly.

- [ ] **Step 6: Commit**

```bash
git add ui/src/containers/InterfaceDetail.vue
git commit -m "feat(ui): migrate InterfaceDetail tabs to PrimeVue Tabs"
```

---

## Task 5: Nodes Page — Wave 1 (NodesTable core)

The Nodes page is the most complex with 18 sub-components and 20+ Feather component types. Migrate the core table first, then sub-components incrementally.

**Files (Wave 1):**
- Modify: `ui/src/components/Nodes/NodesTable.vue` (657 lines — core table)
- Modify: `ui/src/containers/Nodes.vue`

- [ ] **Step 1: Inventory all Feather component types in NodesTable.vue**

```bash
grep -o "Feather[A-Z][A-Za-z]*" ui/src/components/Nodes/NodesTable.vue | sort -u
```

Map each to its PrimeVue equivalent using the component map at the top of this plan.

- [ ] **Step 2: Handle FeatherSortHeader removal**

`FeatherSortHeader` / `FeatherSortObject` are Feather-specific sorting primitives. Replace with DataTable's built-in sorting:

Remove:
```typescript
import { FeatherSortHeader, FeatherSortObject } from '@featherds/table'
const sort = ref<FeatherSortObject | null>(null)
```

Replace the sort handler pattern with DataTable props:
```vue
<DataTable
  :value="nodes"
  v-model:sortField="sortField"
  v-model:sortOrder="sortOrder"
  @sort="onSort"
  ...
>
  <Column field="label" header="Node Label" sortable />
</DataTable>
```

```typescript
const sortField = ref('label')
const sortOrder = ref(1)  // 1 = ASC, -1 = DESC
const onSort = (e: { sortField: string; sortOrder: number }) => {
  sortField.value = e.sortField
  sortOrder.value = e.sortOrder
  loadNodes()
}
```

- [ ] **Step 3: Replace FeatherPagination with DataTable paginator**

Remove:
```typescript
import { FeatherPagination } from '@featherds/pagination'
const currentPage = ref(0)
const pageSize = ref(25)
```

Move pagination into DataTable props:
```vue
<DataTable
  :rows="pageSize"
  :total-records="totalCount"
  lazy
  paginator
  @page="onPage"
  ...
>
```
```typescript
const onPage = (e: { first: number }) => { loadNodes(e.first) }
```

- [ ] **Step 4: Replace FeatherButton with Button**

Find every `<FeatherButton>` (or `<feather-button>`) and replace:
- `<FeatherButton primary>Label</FeatherButton>` → `<Button label="Label" />`
- `<FeatherButton text>Label</FeatherButton>` → `<Button label="Label" text />`
- Icon-only buttons: `<Button icon="pi pi-filter" text size="small" />`

- [ ] **Step 5: Replace FeatherInput with InputText**

`<FeatherInput v-model="search" label="Search" />` → `<InputText v-model="search" placeholder="Search…" />`

- [ ] **Step 6: Replace FeatherCheckbox**

`<FeatherCheckbox v-model="selected" />` → `<Checkbox v-model="selected" binary />` (for boolean)  
For array-bound checkboxes: `<Checkbox v-model="selectedItems" :value="item" />`

- [ ] **Step 7: Replace FeatherSelect / FeatherDropdown**

`<FeatherSelect v-model="selected" :options="opts" />` → `<Select v-model="selected" :options="opts" />`  
For object options: `<Select v-model="selected" :options="opts" optionLabel="label" optionValue="value" />`

- [ ] **Step 8: Build and verify**

```bash
cd ui && ../target/node/pnpm build
./ui/deploy-to-container.sh test-opennms
```
Navigate to `http://localhost:8980/opennms/ui/nodes`. Confirm table loads, sorting, filtering, and pagination all work. Check for console errors.

- [ ] **Step 9: Commit**

```bash
git add ui/src/components/Nodes/NodesTable.vue ui/src/containers/Nodes.vue
git commit -m "feat(ui): migrate NodesTable core to PrimeVue (DataTable, Button, InputText, Select)"
```

---

## Task 6: Nodes Page — Wave 2 (Sub-components)

**Files:**
- `ui/src/components/Nodes/ColumnSelectionDrawer.vue`
- `ui/src/components/Nodes/NodeAdvancedFiltersDrawer.vue`
- `ui/src/components/Nodes/NodeActionsDropdown.vue`
- `ui/src/components/Nodes/NodeDownloadDropdown.vue`
- `ui/src/components/Nodes/NodePreferencesDialog.vue`
- `ui/src/components/Nodes/NodeDetailsDialog.vue`
- `ui/src/components/Nodes/ExtendedSearchPanel.vue`
- `ui/src/components/Nodes/NodeStructurePanel.vue`

For each file:

- [ ] **Step 1: Inventory Feather usage per file**

```bash
for f in ui/src/components/Nodes/*.vue; do
  feather_count=$(grep -c "Feather[A-Z]" "$f" 2>/dev/null || echo 0)
  echo "$feather_count  $f"
done | sort -rn
```

Process files in order of most Feather usages first.

- [ ] **Step 2: Migrate ColumnSelectionDrawer.vue**

This likely uses `FeatherDrawer`, `FeatherCheckbox`, `FeatherButton`. Replace:
- `FeatherDrawer` → `Drawer` (PrimeVue). Note: Drawer replaces the Feather sidebar component.
  ```vue
  <Drawer v-model:visible="open" header="Column Selection" position="right" style="width: 320px">
    <!-- content -->
  </Drawer>
  ```
- Checkboxes for column selection → PrimeVue `Checkbox`

- [ ] **Step 3: Migrate NodeAdvancedFiltersDrawer.vue**

Uses `FeatherDrawer`, `FeatherInput`, `FeatherSelect`, `FeatherButton`. Follow the same Drawer pattern. Advanced filter inputs use `InputText` and `Select`.

- [ ] **Step 4: Migrate NodeActionsDropdown.vue + NodeDownloadDropdown.vue**

These use `FeatherDropdown` / `FeatherDropdownItem` (overlay menu). Replace with PrimeVue `Menu`:

```vue
<template>
  <Button icon="pi pi-ellipsis-v" text @click="toggle" aria-haspopup="true" />
  <Menu ref="menu" :model="items" popup />
</template>
<script setup>
import Menu from 'primevue/menu'
import Button from 'primevue/button'
const menu = ref()
const toggle = (e: Event) => menu.value.toggle(e)
const items = [
  { label: 'Action 1', command: () => { /* ... */ } },
  { label: 'Action 2', command: () => { /* ... */ } },
]
</script>
```

- [ ] **Step 5: Migrate dialogs (NodePreferencesDialog, NodeDetailsDialog)**

Uses `FeatherDialog`. Replace with PrimeVue `Dialog`:
```vue
<Dialog v-model:visible="visible" header="Node Preferences" modal style="width: 480px">
  <!-- content -->
  <template #footer>
    <Button label="Cancel" text @click="visible = false" />
    <Button label="Save" @click="save" />
  </template>
</Dialog>
```

- [ ] **Step 6: Build, deploy, verify all Nodes sub-features**

```bash
cd ui && ../target/node/pnpm build
./ui/deploy-to-container.sh test-opennms
```
Test: column selection drawer opens/closes, filter drawer works, actions dropdown works, preferences dialog opens. Check for console errors.

- [ ] **Step 7: Commit**

```bash
git add ui/src/components/Nodes/
git commit -m "feat(ui): migrate Nodes sub-components to PrimeVue (Drawer, Menu, Dialog, Checkbox)"
```

---

## Task 7: Admin Form Pages — Wave 1

These admin pages use Feather form components. Migrate the highest-traffic ones first.

**Files (one commit per page):**
- `ui/src/containers/DiscoveryConfig.vue` + `ui/src/components/DiscoveryConfig/*.vue`
- `ui/src/containers/SnmpConfig.vue`
- `ui/src/containers/UsersGroups.vue` + `ui/src/components/UsersGroups/*.vue`

### Sub-task A: DiscoveryConfig page

- [ ] **Step 1: Inventory Feather usages**

```bash
grep -rn "Feather[A-Z]\|@featherds" ui/src/containers/DiscoveryConfig.vue ui/src/components/DiscoveryConfig/
```

Typical: `FeatherButton`, `FeatherInput`, `FeatherDialog`, `FeatherTable`.

- [ ] **Step 2: Replace FeatherButton → Button, FeatherInput → InputText, FeatherTable → DataTable**

Follow the component map at the top of this plan.

- [ ] **Step 3: Build, deploy, navigate to `/discovery-config`, verify CRUD works**

- [ ] **Step 4: Commit**

```bash
git add ui/src/containers/DiscoveryConfig.vue ui/src/components/DiscoveryConfig/
git commit -m "feat(ui): migrate DiscoveryConfig to PrimeVue"
```

### Sub-task B: SnmpConfig page

- [ ] **Step 1: Inventory**

```bash
grep -n "Feather[A-Z]\|@featherds" ui/src/containers/SnmpConfig.vue | head -20
```

- [ ] **Step 2: Replace components using the map**

The SnmpConfig page has lookup by IP, form inputs, and a submit button. Replace all Feather form components.

- [ ] **Step 3: Build, deploy, verify at `/snmp-config`**

- [ ] **Step 4: Commit**

```bash
git add ui/src/containers/SnmpConfig.vue
git commit -m "feat(ui): migrate SnmpConfig to PrimeVue"
```

### Sub-task C: UsersGroups page

- [ ] **Step 1: Inventory**

```bash
grep -rn "Feather[A-Z]\|@featherds" ui/src/containers/UsersGroups.vue ui/src/components/UsersGroups/
```

- [ ] **Step 2: Replace components**

UsersGroups likely uses `FeatherButton`, `FeatherTable`, possibly `FeatherDialog`. Apply the map.

- [ ] **Step 3: Build, deploy, verify at `/users-groups`**

- [ ] **Step 4: Commit**

```bash
git add ui/src/containers/UsersGroups.vue ui/src/components/UsersGroups/
git commit -m "feat(ui): migrate UsersGroups to PrimeVue"
```

---

## Task 8: Admin Form Pages — Wave 2

**Files:**
- `ui/src/containers/ThresholdConfig.vue` + `ui/src/containers/ThresholdGroupEdit.vue`
- `ui/src/containers/NotificationConfig.vue` + `ui/src/containers/NotificationRules.vue` + `ui/src/containers/NotificationRuleEdit.vue` + `ui/src/containers/DestinationPaths.vue` + `ui/src/containers/DestinationPathEdit.vue`
- `ui/src/containers/ScheduledOutages.vue`

For each page, follow the same pattern as Task 7:
1. `grep -rn "Feather[A-Z]"` to inventory
2. Replace using the component map
3. Build, deploy, verify the page in browser
4. Commit per page with `feat(ui): migrate {PageName} to PrimeVue`

---

## Task 9: Remaining Container Sweep

Identify any remaining Feather Vue *component* usages (not just SCSS) across containers and components:

- [ ] **Step 1: Find remaining Feather Vue component imports**

```bash
grep -rl "from '@featherds/button\|from '@featherds/input\|from '@featherds/table\|from '@featherds/dialog\|from '@featherds/drawer\|from '@featherds/select\|from '@featherds/checkbox\|from '@featherds/tabs\|from '@featherds/pagination\|from '@featherds/dropdown\|from '@featherds/expansion\|from '@featherds/tooltip\|from '@featherds/autocomplete\|from '@featherds/switch\|from '@featherds/chips" \
  ui/src/containers/ ui/src/components/ 2>/dev/null
```

- [ ] **Step 2: For each file found, apply the component map**

Check the file, identify Feather component usages, replace with PrimeVue equivalents. Build and verify after each file or group of related files.

- [ ] **Step 3: Verify no Feather Vue component imports remain**

```bash
# This should return no results when migration is complete:
grep -rl "from '@featherds/button\|from '@featherds/input\|from '@featherds/table\|from '@featherds/dialog\|from '@featherds/drawer\|from '@featherds/select\|from '@featherds/checkbox\|from '@featherds/tabs\|from '@featherds/pagination\|from '@featherds/dropdown\|from '@featherds/expansion\|from '@featherds/tooltip\|from '@featherds/autocomplete\|from '@featherds/switch\|from '@featherds/chips" \
  ui/src/containers/ ui/src/components/ 2>/dev/null
```

Expected output: empty (no files).

Note: `@featherds/styles` imports in `<style>` blocks are intentionally kept — they access `--feather-*` CSS design tokens which remain the source of truth.

- [ ] **Step 4: Commit any remaining migrations**

---

## Task 10: Remove Feather DS Package Dependency (Final Step)

Only do this task after Task 9 confirms zero Feather Vue component imports remain.

- [ ] **Step 1: Verify nothing in the JS/TS side imports Feather components**

```bash
grep -r "from '@featherds" ui/src --include="*.ts" --include="*.vue" | grep -v "<style\|<template" | grep -v "@featherds/styles\|@featherds/icon/icons"
```

Any remaining hits need to be migrated before continuing.

- [ ] **Step 2: Check package.json for Feather dependencies**

```bash
grep "@featherds" ui/package.json
```

- [ ] **Step 3: Identify which Feather packages are still needed for SCSS**

The `@featherds/styles` package must stay — it provides the `--feather-*` CSS custom property definitions that are the design token source of truth. Do NOT remove it.

Other packages like `@featherds/button`, `@featherds/input`, etc. can be removed once no Vue component imports reference them.

- [ ] **Step 4: Remove unused Feather component packages**

```bash
cd ui && ../target/node/pnpm remove @featherds/button @featherds/input @featherds/table \
  @featherds/dialog @featherds/drawer @featherds/select @featherds/checkbox @featherds/tabs \
  @featherds/pagination @featherds/dropdown @featherds/expansion @featherds/tooltip \
  @featherds/autocomplete @featherds/switch @featherds/chips @featherds/list @featherds/ripple
```

Do NOT remove: `@featherds/styles`, `@featherds/icon` (unless all icon usage has been replaced).

- [ ] **Step 5: Build and verify the full app still works**

```bash
cd ui && ../target/node/pnpm build
./ui/deploy-to-container.sh test-opennms
```

Walk through: alarms, nodes, outages, topology, events, admin hub and several admin pages. No broken imports, no missing components.

- [ ] **Step 6: Commit**

```bash
git add ui/package.json ui/pnpm-lock.yaml
git commit -m "chore(deps): remove Feather DS Vue component packages — PrimeVue migration complete"
```
