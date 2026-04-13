# UI Glitch Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address accumulated minor visual glitches across the Vue SPA — hardcoded hex colors that break in one theme, divergent severity color palettes, and a dead CSS class on the AlarmDetail header card.

**Architecture:** All fixes are pure CSS/SCSS changes — no logic, no API calls, no new components. Each task touches one or two files. Tokens come from `@featherds/styles/themes/variables` (`$primary`, `$border-on-surface`, `$primary-text-on-color`, `$secondary-text-on-surface`, etc.) and severity-specific vars (`$error`, `$major`, `$minor`, `$warning`, `$success`, `$cleared`, `$indeterminate`). For warning/minor solid-fill badges, dark text (`#1a1a2e`) is required because yellow/orange backgrounds fail contrast with white text — this matches the convention already established in `opennms-feather-styles.scss`.

**Tech Stack:** Vue 3 SPA, SCSS, Feather DS CSS custom properties, Vite build (`cd ui && ./target/node/yarn/dist/bin/yarn build`), `./ui/deploy-to-container.sh test-opennms`

---

## Files Modified

| File | What changes |
|---|---|
| `ui/src/components/Configuration/ConfigurationHeader.vue` | `color: #4b5ad6` → `var($primary)`; add variables import |
| `ui/src/components/Configuration/ConfigurationDrawer.vue` | 4 hardcoded colors → `var($primary)` / `var($border-on-surface)` |
| `ui/src/components/Nodes/NodeStructurePanel.vue` | `color: #4b5ad6` → `var($primary)` |
| `ui/src/components/Nodes/ColumnSelectionDrawer.vue` | `background-color: #1d2f75; color: white` → token equivalents |
| `ui/src/components/Common/PerspectiveToggle.vue` | active-state `#0081ad/#fff` → `var($primary)/var($primary-text-on-color)` |
| `ui/src/components/Menu/SearchResult.vue` | `rgba(10,12,27,0.7)` text colors → `var($secondary-text-on-surface)`; add import |
| `ui/src/components/BSM/BusinessServiceEditor.vue` | Hand-picked severity hex → Feather DS severity tokens |
| `ui/src/components/SurveillanceDashboard/SurveillanceGrid.vue` | Hand-picked severity hex → Feather DS severity tokens |
| `ui/src/components/SurveillanceDashboard/SurveillanceCellDetail.vue` | Hand-picked severity hex → Feather DS severity tokens |
| `ui/src/styles/_severities.scss` | `.minor`/`.warning`/`.minor-color`/`.warning-color` text → severity token (not gray) |
| `ui/src/containers/AlarmDetail.vue` | Add scoped severity-color styles so the header card actually gets tinted |

---

### Task 1: Configuration — hardcoded blues and borders

**Files:**
- Modify: `ui/src/components/Configuration/ConfigurationHeader.vue:28-36`
- Modify: `ui/src/components/Configuration/ConfigurationDrawer.vue:185,203,287-288,316`

`ConfigurationHeader.vue` has no variables import at all. The `.title` class uses a hardcoded indigo that's invisible in dark mode. `ConfigurationDrawer.vue` uses a dark navy for expansion headers and hardcoded gray for horizontal/vertical dividers that disappear in dark mode.

- [ ] **Step 1: Fix ConfigurationHeader.vue**

Add the variables import and replace the hardcoded color:

```scss
// ui/src/components/Configuration/ConfigurationHeader.vue <style> block
// Change this:
@import "@featherds/styles/mixins/typography";
@import "@featherds/styles/mixins/elevation";

.title {
  @include overline();
  color: #4b5ad6;

// To this:
@import "@featherds/styles/mixins/typography";
@import "@featherds/styles/mixins/elevation";
@import "@featherds/styles/themes/variables";

.title {
  @include overline();
  color: var($primary);
```

- [ ] **Step 2: Fix ConfigurationDrawer.vue — 4 hardcoded values**

In `ui/src/components/Configuration/ConfigurationDrawer.vue`, make these four replacements (file already imports variables):

```scss
// line ~203: expansion panel header text
.expansion-panel {
  .feather-expansion-header-button-text {
    color: var($primary);  // was #273180
  }
}
```

```scss
// lines ~287-288: horizontal rule above/below the config drawer tabs
border-top: 1px solid var($border-on-surface);    // was #d7d7dc
border-bottom: 1px solid var($border-on-surface);  // was #d7d7dc
```

```scss
// line ~316: right edge of the slide-in side panel
border-left: 1px solid var($border-on-surface);  // was #b2b2b2
```

- [ ] **Step 3: Build and verify no hardcoded values leaked**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -5
```
Expected: `✓ built in ...`

```bash
grep -r "#4b5ad6\|#273180\|#d7d7dc\|#b2b2b2" ui/src/main/dist/assets/*.css
```
Expected: no matches (the values should not appear in built CSS).

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/Configuration/ConfigurationHeader.vue \
        ui/src/components/Configuration/ConfigurationDrawer.vue
git commit -m "fix(ui): replace hardcoded indigo/gray in Configuration components with Feather tokens"
```

---

### Task 2: Node components — hardcoded navy

**Files:**
- Modify: `ui/src/components/Nodes/NodeStructurePanel.vue:212-215`
- Modify: `ui/src/components/Nodes/ColumnSelectionDrawer.vue:184-190`

Both files already import `@featherds/styles/themes/variables`.

- [ ] **Step 1: Fix NodeStructurePanel.vue**

```scss
// ui/src/components/Nodes/NodeStructurePanel.vue — .title class
.title {
  @include overline();
  color: var($primary);  // was #4b5ad6
  margin-bottom: 8px;
}
```

- [ ] **Step 2: Fix ColumnSelectionDrawer.vue**

```scss
// ui/src/components/Nodes/ColumnSelectionDrawer.vue — button.primary
button.primary {
  margin-top: 2rem;
  background-color: var($primary);          // was #1d2f75
  color: var($primary-text-on-color);       // was white (hardcoded string)
  padding: 0.5em 1.5em;
  border: none;
}
```

- [ ] **Step 3: Build and verify**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -5
```

```bash
grep -r "#4b5ad6\|#1d2f75" ui/src/main/dist/assets/*.css
```
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/Nodes/NodeStructurePanel.vue \
        ui/src/components/Nodes/ColumnSelectionDrawer.vue
git commit -m "fix(ui): replace hardcoded navy in NodeStructurePanel and ColumnSelectionDrawer with Feather tokens"
```

---

### Task 3: PerspectiveToggle + SearchResult — dark text on dark backgrounds

**Files:**
- Modify: `ui/src/components/Common/PerspectiveToggle.vue:59-63`
- Modify: `ui/src/components/Menu/SearchResult.vue` (style block)

`PerspectiveToggle` already imports variables. `SearchResult.vue` has no Feather import — add one.

- [ ] **Step 1: Fix PerspectiveToggle.vue active state**

```scss
// ui/src/components/Common/PerspectiveToggle.vue — &--active modifier
&--active {
  background: var($primary);              // was #0081ad
  color: var($primary-text-on-color);    // was #fff
}
```

- [ ] **Step 2: Fix SearchResult.vue — add import and replace dark-navy text**

At the top of the `<style lang="scss">` block, add the import:

```scss
@import "@featherds/styles/themes/variables";
```

Then in `.search-result-button`, replace all the hardcoded dark-navy values:

```scss
.search-result-button {
    background: transparent;
    border: none;
    appearance: none;
    block-size: 24px;
    caret-color: var($secondary-text-on-surface);          // was rgb(10,12,27,0.7)
    color: var($secondary-text-on-surface);                // was rgba(10,12,27,0.7)
    column-rule-color: var($secondary-text-on-surface);    // was rgba(10,12,27,0.7)
    cursor: pointer;
    display: block;
    font-family: OpenSans, Helvetica, Arial, sans-serif;
    font-size: 14px;
    height: 24px;
    inline-size: 266px;
    letter-spacing: 0.25px;
    line-height: 24px;
    min-width: 30em;
    outline-color: var($secondary-text-on-surface);        // was rgba(10,12,27,0.7)
    padding: 0;
    perspective-origin: 133px 12px;
    text-align: left;
    text-decoration-color: var($secondary-text-on-surface);  // was rgba(10,12,27,0.7)
    text-emphasis-color: var($secondary-text-on-surface);    // was rgba(10,12,27,0.7)
    transform-origin: 133px 12px;
    unicode-bidi: isolate;
    user-select: auto;
}
```

Also fix `.search-item-details`:
```scss
.search-item-details {
  margin-left: 1em;
  z-index: 1100;
  color: var($primary-text-on-surface);   // was black
  padding: 0.25em;
}
```

- [ ] **Step 3: Build and verify**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -5
```

```bash
grep -r "rgba(10, 12, 27\|rgb(10,12,27" ui/src/main/dist/assets/*.css
```
Expected: no matches (all dark-navy text replaced with tokens in SearchResult).

```bash
grep -r "color: black" ui/src/main/dist/assets/*.css
```
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/Common/PerspectiveToggle.vue \
        ui/src/components/Menu/SearchResult.vue
git commit -m "fix(ui): replace hardcoded nav colors in PerspectiveToggle and SearchResult with Feather tokens"
```

---

### Task 4: BSM severity palette — unify with system tokens

**Files:**
- Modify: `ui/src/components/BSM/BusinessServiceEditor.vue:437-442`

BSM's `.status-*` badges use a completely custom color palette (including blue for warning — wrong). Replace with the same Feather DS severity tokens the rest of the SPA uses. File already imports `@featherds/styles/themes/variables`.

- [ ] **Step 1: Replace BSM status badge colors**

```scss
// ui/src/components/BSM/BusinessServiceEditor.vue — .status-badge modifier classes
&.status-critical      { background: var($error);         color: var($primary-text-on-color); }
&.status-major         { background: var($major);         color: var($primary-text-on-color); }
&.status-minor         { background: var($minor);         color: var($primary-text-on-color); }
&.status-warning       { background: var($warning);       color: #1a1a2e; }  // yellow needs dark text
&.status-normal        { background: var($success);       color: var($primary-text-on-color); }
&.status-indeterminate { background: var($indeterminate); color: var($primary-text-on-color); }
```

Note: `#1a1a2e` on warning matches the convention in `opennms-feather-styles.scss` where all solid-fill warning chips use that value to ensure contrast on the yellow background.

- [ ] **Step 2: Build and verify**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -5
```

```bash
grep -r "#c0392b\|#e67e22\|#f1c40f\|#3498db\|#27ae60\|#95a5a6" ui/src/main/dist/assets/*.css
```
Expected: no matches (all six BSM colors replaced).

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/BSM/BusinessServiceEditor.vue
git commit -m "fix(bsm): replace custom severity hex palette with Feather DS severity tokens"
```

---

### Task 5: Surveillance Dashboard severity palette — unify with system tokens

**Files:**
- Modify: `ui/src/components/SurveillanceDashboard/SurveillanceGrid.vue:174-179`
- Modify: `ui/src/components/SurveillanceDashboard/SurveillanceCellDetail.vue:179-184`

Both files already import variables. `SurveillanceGrid` uses non-standard colors (purple for critical instead of red). `SurveillanceCellDetail` has the same issue plus a `.down` class that duplicates major's color.

- [ ] **Step 1: Fix SurveillanceGrid.vue**

```scss
// ui/src/components/SurveillanceDashboard/SurveillanceGrid.vue
// Severity background colors — solid fills for the status grid
.sev-normal   { background: var($success);  color: var($primary-text-on-color); }
.sev-warning  { background: var($warning);  color: #1a1a2e; }
.sev-minor    { background: var($minor);    color: var($primary-text-on-color); }
.sev-major    { background: var($major);    color: var($primary-text-on-color); }
.sev-critical { background: var($error);    color: var($primary-text-on-color); }
```

- [ ] **Step 2: Fix SurveillanceCellDetail.vue**

```scss
// ui/src/components/SurveillanceDashboard/SurveillanceCellDetail.vue
&.down     { background: var($major);    color: var($primary-text-on-color); }  // node down = major
&.critical { background: var($error);    color: var($primary-text-on-color); }
&.major    { background: var($major);    color: var($primary-text-on-color); }
&.minor    { background: var($minor);    color: var($primary-text-on-color); }
&.warning  { background: var($warning);  color: #1a1a2e; }
&.normal   { background: var($success);  color: var($primary-text-on-color); }
```

- [ ] **Step 3: Build and verify**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -5
```

```bash
grep -r "#2e7d32\|#f9a825\|#ef6c00\|#c62828\|#6a1b9a" ui/src/main/dist/assets/*.css
```
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/SurveillanceDashboard/SurveillanceGrid.vue \
        ui/src/components/SurveillanceDashboard/SurveillanceCellDetail.vue
git commit -m "fix(surveillance): replace custom severity hex palette with Feather DS severity tokens"
```

---

### Task 6: `_severities.scss` — fix minor/warning text color inconsistency

**Files:**
- Modify: `ui/src/styles/_severities.scss:33-39,75-83`

`.critical-color` and `.major-color` use the severity color for their text (`color: var(variables.$error)` etc.). But `.minor-color` and `.warning-color` silently fall back to `$secondary-text-on-surface` (gray). This makes the pattern inconsistent — on a tinted orange/yellow background, gray text loses the severity signal. Fix by using the severity token directly, matching the pattern every other severity class already uses.

- [ ] **Step 1: Fix `.minor` and `.warning` solid classes**

```scss
// ui/src/styles/_severities.scss — solid-opacity block (lines 22-57)
.minor {
  background-color: utils.alpha(variables.$minor, $solid);
  color: var(variables.$minor) !important;  // was $secondary-text-on-surface
}

.warning {
  background-color: utils.alpha(variables.$warning, $solid);
  color: var(variables.$warning) !important;  // was $secondary-text-on-surface
}
```

- [ ] **Step 2: Fix `.minor-color` and `.warning-color` tinted classes**

```scss
// ui/src/styles/_severities.scss — opacity block (lines 64-100)
.minor-color {
  background-color: utils.alpha(variables.$minor, $opacity);
  color: var(variables.$minor) !important;  // was $secondary-text-on-surface
}

.warning-color {
  background-color: utils.alpha(variables.$warning, $opacity);
  color: var(variables.$warning) !important;  // was $secondary-text-on-surface
}
```

- [ ] **Step 3: Build**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -5
```
Expected: `✓ built in ...`

- [ ] **Step 4: Commit**

```bash
git add ui/src/styles/_severities.scss
git commit -m "fix(ui): minor/warning severity classes now use severity token for text color, matching critical/major pattern"
```

---

### Task 7: AlarmDetail header — fix dead severity-color class

**Files:**
- Modify: `ui/src/containers/AlarmDetail.vue` (scoped `<style>` block)

`AlarmDetail.vue` computes `severityClass` as `${severity.toLowerCase()}-color` (e.g. `"warning-color"`) and applies it to the header card. But `_severities.scss` is only locally `@use`'d in `EventConfigEventTable.vue` — it is not a global stylesheet. So the class has no CSS effect: every alarm's header card looks the same regardless of severity.

Fix: add scoped severity-color styles directly in `AlarmDetail.vue`. Use 20% opacity alpha backgrounds (same as `$row-opacity` pattern) plus a prominent left border, so the header card clearly signals severity without being overwhelming.

- [ ] **Step 1: Add severity-color header styles to AlarmDetail.vue**

`AlarmDetail.vue` already imports:
```scss
@use '@featherds/styles/themes/utils';
@use '@featherds/styles/themes/variables' as fvars;
@import "@featherds/styles/themes/variables";
```

Append the following block just before the closing `</style>` tag in the scoped style section (after the `.row--*` block, around line 734):

```scss
// Severity header card tinting — {severity}-color applied to alarm-detail__header.
// These must live here because _severities.scss is not a global stylesheet.
$header-opacity: 0.2;
.critical-color      { background: utils.alpha(fvars.$error,         $header-opacity); border-left: 4px solid var(--feather-error); }
.major-color         { background: utils.alpha(fvars.$major,         $header-opacity); border-left: 4px solid var(--feather-major); }
.minor-color         { background: utils.alpha(fvars.$minor,         $header-opacity); border-left: 4px solid var(--feather-minor); }
.warning-color       { background: utils.alpha(fvars.$warning,       $header-opacity); border-left: 4px solid var(--feather-warning); }
.normal-color        { background: utils.alpha(fvars.$success,       $header-opacity); border-left: 4px solid var(--feather-success); }
.cleared-color,
.unacknowledged-color { background: utils.alpha(fvars.$cleared,      $header-opacity); border-left: 4px solid var(--feather-cleared); }
.indeterminate-color { background: utils.alpha(fvars.$indeterminate, $header-opacity); border-left: 4px solid var(--feather-indeterminate); }
```

- [ ] **Step 2: Build**

```bash
cd ui && ./target/node/yarn/dist/bin/yarn build 2>&1 | tail -5
```
Expected: `✓ built in ...`

- [ ] **Step 3: Commit**

```bash
git add ui/src/containers/AlarmDetail.vue
git commit -m "fix(alarms): add scoped severity-color styles to AlarmDetail header card — class was previously a no-op"
```

---

### Task 8: Deploy and verify

**Files:** (none — deploy only)

- [ ] **Step 1: Verify container is running**

```bash
podman ps --filter name=test-opennms --format '{{.Status}} {{.Image}}'
```
Expected: `Up ...`

If not running: `podman start test-opennms` and wait 15-20 seconds before proceeding.

- [ ] **Step 2: Deploy**

```bash
./ui/deploy-to-container.sh test-opennms
```

- [ ] **Step 3: Verify bundle hash matches**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
```
Both lines must print the same hash.

- [ ] **Step 4: Spot-check in browser**

Manual checks — navigate to each affected area and confirm:

1. **Configuration drawer** (`/opennms/ui/#/config`) — section title overline text uses primary blue, dividers are visible in both light and dark mode
2. **Node detail page** (`/opennms/ui/#/nodes`, click any node) — "Structure" panel title uses primary blue not indigo
3. **Column selection drawer** (Nodes page → Columns button) — "Apply" button uses primary blue, not dark navy
4. **Alarms page** (`/opennms/ui/#/alarms`) — Perspective toggle "Problems" active button uses primary blue token; severity filter chips still work
5. **Alarm detail** (`/opennms/ui/#/alarm/{id}`) — header card has a colored left border + subtle tinted background matching the alarm's severity
6. **BSM editor** (`/opennms/ui/#/bsm`) — status badges show correct severity colors (warning = amber not blue; critical = red not purple)
7. **Surveillance dashboard** (`/opennms/ui/#/surveillance-dashboard`) — severity cells use correct system colors (critical = red, not purple)

- [ ] **Step 5: Tell user to hard-refresh**

Cmd+Option+R in Safari, or Shift+click reload in Chrome/Firefox.
