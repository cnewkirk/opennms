# Rounded Corners Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize all card/panel surface containers to `border-radius: 4px` by adding a single global rule and fixing one outlier.

**Architecture:** One line added to the global `opennms-feather-styles.scss` using the existing `$border-radius-surface` token fixes all sharp surfaces at once. One additional change in `TableCard.vue` corrects a `5px` outlier. No per-component changes needed.

**Tech Stack:** Vue 3 SFC, SCSS, Feather DS tokens (`vars.scss`)

---

## File Map

| File | Change |
|------|--------|
| `ui/src/styles/opennms-feather-styles.scss` | Add `.card { border-radius: vars.$border-radius-surface; }` |
| `ui/src/components/Common/TableCard.vue` | Change `border-radius: 5px` → `vars.$border-radius-surface` on `.table-card` |

---

### Task 1: Add global `.card` border-radius rule

**Files:**
- Modify: `ui/src/styles/opennms-feather-styles.scss`

The file currently has this content:

```scss
@use "@featherds/styles/mixins/_typography.scss" as typo;
@use "@featherds/styles/themes/variables";

input, label, li, select, span, td, text, th {
  @include typo.body-small();
  color: inherit;
  letter-spacing: normal;
  line-height: 1.3rem;
}

a:visited {
  color: var(--feather-clickable-normal);
}
```

It does NOT yet `@use` the project's own `vars.scss`. We need to add that import, then add the `.card` rule.

- [ ] **Step 1: Add the `@use` for vars and the `.card` rule**

The full updated file should be:

```scss
@use "@featherds/styles/mixins/_typography.scss" as typo;
@use "@featherds/styles/themes/variables";
@use "src/styles/vars";

/**
* Add some additional base styles that weren't included in the base Feather typography.
* These help override legacy OpenNMS Bootstrap styles so that all text on legacy pages
* has a Feather font style.
*/
input,
label,
li,
select,
span,
td,
text,
th {
  @include typo.body-small();
  color: inherit;
  // Feather has the following, which seem a little too much. Legacy OpenNMS fonts were a bit narrower,
  // so we adjust these a bit below.
  // letter-spacing: var(--feather-body-small-letter-spacing);  // .25004px
  // line-height: var(--feather-body-small-line-height);        // 1.5rem or 24px
  //
  // For p, we leave it alone as the slightly larger spacing is more readable for paragraphs of text.
  letter-spacing: normal;
  line-height: 1.3rem;
}

// Do not want the Feather behavior of changing the color of links when visited.
a:visited {
  color: var(--feather-clickable-normal);
}

// Normalize surface containers to consistent rounded corners.
.card {
  border-radius: vars.$border-radius-surface;
}
```

Note: The `@use "src/styles/vars"` path is relative to the Vite root (`ui/src/main`). Check whether other files in this codebase use `@use "src/styles/vars"` or `@use "../styles/vars"` — use whichever pattern is already established. Run:

```bash
grep -r '@use.*vars' /Users/chance/git/opennms/ui/src --include="*.vue" --include="*.scss" | head -5
```

Expected output will show the exact import path pattern in use (e.g., `@use "@/styles/vars"` or `@use "../styles/vars"`). Use that same path.

- [ ] **Step 2: Verify the build compiles without errors**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build 2>&1 | tail -5
```

Expected: `✓ built in ...` with no SCSS errors. If the `@use` path is wrong you will see a `Can't find stylesheet to import` error — fix the path using the pattern from Step 1.

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/styles/opennms-feather-styles.scss
git commit -m "feat(ui): normalize .card border-radius via global rule"
```

---

### Task 2: Fix TableCard.vue outlier

**Files:**
- Modify: `ui/src/components/Common/TableCard.vue`

The file currently has `border-radius: 5px` hardcoded on `.table-card`. Change it to use the `vars` token for consistency.

- [ ] **Step 1: Update the `.table-card` rule**

The full updated `<style>` block (lines 7–17):

```scss
<style lang="scss" scoped>
@use "@featherds/styles/themes/variables";
@use "src/styles/vars";

.table-card {
  background: var(variables.$surface);
  width: 100%;
  padding: 25px 0px;
  border-radius: vars.$border-radius-surface;
  display: inline-block;
}
</style>
```

Use the same `@use` path pattern confirmed in Task 1 Step 1.

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/Common/TableCard.vue
git commit -m "fix(ui): align TableCard border-radius with $border-radius-surface token"
```

---

### Task 3: Build, deploy, verify

**Files:** none — build + verification only

- [ ] **Step 1: Build**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build 2>&1 | tail -5
```

Expected: `✓ built in ...` with no errors.

- [ ] **Step 2: Verify no bare `--feather-*` vars in built CSS**

```bash
grep -o '\-\-feather-[a-z\-]*[^;)"]' /Users/chance/git/opennms/ui/src/main/dist/assets/*.css | grep -v 'var(' | head -20
```

Expected: no output.

- [ ] **Step 3: Verify built index.html asset paths**

```bash
grep -o 'src="/opennms/ui/assets/index-[^"]*\.js"' /Users/chance/git/opennms/ui/src/main/dist/index.html
```

Expected: one match.

- [ ] **Step 4: Ensure container is running, then deploy**

```bash
podman ps --filter name=test-opennms --format "{{.Status}}"
```

If stopped: `podman start test-opennms` then wait ~20s and confirm `curl -s -o /dev/null -w "%{http_code}" http://localhost:8980/opennms/login.jsp` returns `200`.

```bash
cd /Users/chance/git/opennms/ui && ./deploy-to-container.sh test-opennms
```

- [ ] **Step 5: Verify hash match**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html
```

Both lines must match.

- [ ] **Step 6: Visual verification**

Hard refresh (`Cmd+Shift+R`). Check the following pages and confirm all card surfaces have rounded corners:

- `/opennms/ui/#/dashboard` — Dashboard widgets
- `/opennms/ui/#/node/5` — NodeDetail availability and category panels
- `/opennms/ui/#/logs` — Logs card
- `/opennms/ui/#/alarms` — Alarms card

All `.card` surfaces should show `4px` rounded corners. No sharp-edged containers.
