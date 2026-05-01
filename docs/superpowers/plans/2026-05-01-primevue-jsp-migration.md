# PrimeVue Migration & JSP Redirect Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all remaining bookmark-breaking legacy URLs and remove every `@featherds` import from Vue source, leaving the codebase clean of Feather dependencies.

**Architecture:** Two independent tracks. Track A patches five Spring MVC Java controllers to issue HTTP 302 redirects to Vue SPA routes, following the existing pattern in `AlarmDetailController`. Track B moves the Feather table mixin stub into a proper project-owned SCSS partial and re-points all 20 component imports to it, then swaps the one remaining `FeatherButton` in `EmptyList.vue` for PrimeVue `Button`.

**Tech Stack:** Java 17, Spring MVC (`MultiActionController` / `AbstractController` / `@Controller`), Vue 3, PrimeVue 4, SCSS with `@use`/`@import`, pnpm, podman overlay container.

---

## Scope note — legacy pages NOT in this plan

The 13 `❌ legacy` pages (KSC Reports, Database Reports, user-facing Notifications, Path Outage, About, Support, per-node Asset Records, Heatmap, Site Status, Notification Detail, Manage/Unmanage Interfaces, SNMP Interface Collection, Node Management) each require a separate spec and plan. This plan only covers the **5 vue-no-redirect gaps** and **Feather import cleanup**.

---

## File Map

### Track A — Spring MVC controller redirects

| File | Change |
|---|---|
| `opennms-webapp/src/main/java/org/opennms/web/controller/alarm/AlarmFilterController.java` | Add redirect in `index` and `list` methods |
| `opennms-webapp/src/main/java/org/opennms/web/controller/node/NodeListController.java` | Add redirect in `handle` method |
| `opennms-webapp/src/main/java/org/opennms/web/controller/event/EventController.java` | Add redirect in `index`, `list`, and `detail` methods |
| `opennms-webapp/src/main/java/org/opennms/web/controller/outage/OutageDetailController.java` | Add redirect in `handleRequestInternal` |

### Track B — Feather SCSS cleanup

| File | Change |
|---|---|
| `ui/src/styles/_table.scss` | **Create** — extract stub mixins into project-owned partial |
| `ui/src/stubs/@featherds/table/scss/table.scss` | **Delete** after all imports are repointed |
| `ui/src/components/Common/EmptyList.vue` | Swap `FeatherButton` → PrimeVue `Button` |
| 20× `*.vue` files (listed in Task 5) | Change `@import "@featherds/table/scss/table"` → `@use "@/styles/table" as *` or `@use "@/styles/table"` |

---

## Track A — Redirect Fixes

### Task 1: Alarm list redirect (`AlarmFilterController`)

**Files:**
- Modify: `opennms-webapp/src/main/java/org/opennms/web/controller/alarm/AlarmFilterController.java`

The `alarm/index.htm` URL hits `AlarmFilterController.index()` by default. Both `index` and `list` need redirects so filtered bookmark URLs (`alarm/index.htm?filter=...`) also land in Vue.

- [ ] **Step 1: Add redirect to `index` method**

In `AlarmFilterController.java`, replace the `index` method body:

```java
// index view
public ModelAndView index(HttpServletRequest request, HttpServletResponse response) throws Exception {
    response.sendRedirect(request.getContextPath() + "/ui/alarms");
    return null;
}
```

- [ ] **Step 2: Add redirect to `list` method**

Replace the public `list` method (the one taking `HttpServletResponse`, not the private overload):

```java
public ModelAndView list(HttpServletRequest request, HttpServletResponse response) throws Exception {
    response.sendRedirect(request.getContextPath() + "/ui/alarms");
    return null;
}
```

- [ ] **Step 3: Build the webapp module**

```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home \
  ./maven/bin/mvn compile -DskipTests --projects :opennms-webapp
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: Patch the running container**

```bash
JAR=/opt/opennms/jetty-webapps/opennms/WEB-INF/lib/opennms-webapp-35.0.4.jar
CLASS=org/opennms/web/controller/alarm/AlarmFilterController.class
SRC=opennms-webapp/target/classes/$CLASS

podman cp test-opennms:$JAR /tmp/opennms-webapp.jar
jar uf /tmp/opennms-webapp.jar -C opennms-webapp/target/classes $CLASS
podman cp /tmp/opennms-webapp.jar test-opennms:$JAR
podman restart test-opennms
```

Wait ~20 seconds for restart, then:

```bash
curl -s -o /dev/null -w "%{http_code}" -L \
  -u admin:notdefault \
  http://localhost:8980/opennms/alarm/index.htm
```

Expected: `200` (redirected to Vue SPA) or `302` depending on curl follow behavior. If `302`, verify Location header:

```bash
curl -s -I -u admin:notdefault http://localhost:8980/opennms/alarm/index.htm | grep -i location
```

Expected: `Location: http://localhost:8980/opennms/ui/alarms`

- [ ] **Step 5: Commit**

```bash
git add opennms-webapp/src/main/java/org/opennms/web/controller/alarm/AlarmFilterController.java
git commit -m "fix: redirect alarm/index.htm bookmark to Vue alarms route"
```

---

### Task 2: Nodes list redirect (`NodeListController`)

**Files:**
- Modify: `opennms-webapp/src/main/java/org/opennms/web/controller/node/NodeListController.java`

This is a simple `@Controller` — `element/nodeList.htm` maps to `handle()`.

- [ ] **Step 1: Add redirect at top of `handle` method**

```java
@RequestMapping(method={ RequestMethod.GET, RequestMethod.POST })
public ModelAndView handle(@ModelAttribute("command") NodeListCommand command,
                           HttpServletRequest request, HttpServletResponse response) throws Exception {
    response.sendRedirect(request.getContextPath() + "/ui/nodes");
    return null;
}
```

Note: `HttpServletRequest` and `HttpServletResponse` must be added as method parameters. Spring MVC injects them automatically when declared.

Also add the import at the top of the file if not already present:

```java
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
```

- [ ] **Step 2: Build**

```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home \
  ./maven/bin/mvn compile -DskipTests --projects :opennms-webapp
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Patch container and verify**

```bash
JAR=/opt/opennms/jetty-webapps/opennms/WEB-INF/lib/opennms-webapp-35.0.4.jar
CLASS=org/opennms/web/controller/node/NodeListController.class
podman cp test-opennms:$JAR /tmp/opennms-webapp.jar
jar uf /tmp/opennms-webapp.jar -C opennms-webapp/target/classes $CLASS
podman cp /tmp/opennms-webapp.jar test-opennms:$JAR
podman restart test-opennms
```

```bash
curl -s -I -u admin:notdefault \
  http://localhost:8980/opennms/element/nodeList.htm | grep -i location
```

Expected: `Location: http://localhost:8980/opennms/ui/nodes`

- [ ] **Step 4: Commit**

```bash
git add opennms-webapp/src/main/java/org/opennms/web/controller/node/NodeListController.java
git commit -m "fix: redirect element/nodeList.htm bookmark to Vue nodes route"
```

---

### Task 3: Events list + detail redirects (`EventController`)

**Files:**
- Modify: `opennms-webapp/src/main/java/org/opennms/web/controller/event/EventController.java`

`EventController` is a `MultiActionController`. `event/index.htm` → `index()`, filtered list → `list()`, detail → `detail()`.

- [ ] **Step 1: Redirect `index` method**

```java
public ModelAndView index(HttpServletRequest request, HttpServletResponse response) throws Exception {
    response.sendRedirect(request.getContextPath() + "/ui/events");
    return null;
}
```

- [ ] **Step 2: Redirect `list` method**

```java
public ModelAndView list(HttpServletRequest request, HttpServletResponse response) throws Exception {
    response.sendRedirect(request.getContextPath() + "/ui/events");
    return null;
}
```

- [ ] **Step 3: Redirect `detail` method**

```java
public ModelAndView detail(HttpServletRequest request, HttpServletResponse response) throws Exception {
    String idString = request.getParameter("id");
    try {
        long eventId = WebSecurityUtils.safeParseLong(idString);
        response.sendRedirect(request.getContextPath() + "/ui/event/" + eventId);
        return null;
    } catch (NumberFormatException e) {
        throw new EventIdNotFoundException("Could not parse event ID '" + idString + "' to integer.", idString);
    }
}
```

- [ ] **Step 4: Build**

```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home \
  ./maven/bin/mvn compile -DskipTests --projects :opennms-webapp
```

Expected: `BUILD SUCCESS`

- [ ] **Step 5: Patch container and verify both endpoints**

```bash
JAR=/opt/opennms/jetty-webapps/opennms/WEB-INF/lib/opennms-webapp-35.0.4.jar
CLASS=org/opennms/web/controller/event/EventController.class
podman cp test-opennms:$JAR /tmp/opennms-webapp.jar
jar uf /tmp/opennms-webapp.jar -C opennms-webapp/target/classes $CLASS
podman cp /tmp/opennms-webapp.jar test-opennms:$JAR
podman restart test-opennms
```

```bash
# Events list
curl -s -I -u admin:notdefault \
  http://localhost:8980/opennms/event/index.htm | grep -i location
# Expected: Location: .../ui/events

# Event detail (use a real event ID from your instance, or 1)
curl -s -I -u admin:notdefault \
  "http://localhost:8980/opennms/event/detail.htm?id=1" | grep -i location
# Expected: Location: .../ui/event/1
```

- [ ] **Step 6: Commit**

```bash
git add opennms-webapp/src/main/java/org/opennms/web/controller/event/EventController.java
git commit -m "fix: redirect event/index.htm and event/detail.htm bookmarks to Vue routes"
```

---

### Task 4: Outage detail redirect (`OutageDetailController`)

**Files:**
- Modify: `opennms-webapp/src/main/java/org/opennms/web/controller/outage/OutageDetailController.java`

`OutageDetailController` extends `AbstractController`. The method is `handleRequestInternal`. Add redirect at the top, mirroring `AlarmDetailController.detail()`.

- [ ] **Step 1: Add redirect at top of `handleRequestInternal`**

Insert before the existing `outageIdString` parsing block:

```java
@Override
protected ModelAndView handleRequestInternal(HttpServletRequest request, HttpServletResponse response) throws Exception {
    String outageIdString = request.getParameter("id");
    if (outageIdString == null) {
        throw new MissingParameterException("id");
    }

    try {
        int outageId = WebSecurityUtils.safeParseInt(WebSecurityUtils.sanitizeString(outageIdString, false));
        response.sendRedirect(request.getContextPath() + "/ui/outage/" + outageId);
        return null;
    } catch (NumberFormatException e) {
        throw new OutageIdNotFoundException("The outage id must be an integer.", WebSecurityUtils.sanitizeString(outageIdString));
    }
}
```

This replaces the full method body — the legacy DB query and model building are no longer needed.

- [ ] **Step 2: Build**

```bash
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home \
  ./maven/bin/mvn compile -DskipTests --projects :opennms-webapp
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Patch container and verify**

```bash
JAR=/opt/opennms/jetty-webapps/opennms/WEB-INF/lib/opennms-webapp-35.0.4.jar
CLASS=org/opennms/web/controller/outage/OutageDetailController.class
podman cp test-opennms:$JAR /tmp/opennms-webapp.jar
jar uf /tmp/opennms-webapp.jar -C opennms-webapp/target/classes $CLASS
podman cp /tmp/opennms-webapp.jar test-opennms:$JAR
podman restart test-opennms
```

```bash
curl -s -I -u admin:notdefault \
  "http://localhost:8980/opennms/outage/detail.htm?id=1" | grep -i location
```

Expected: `Location: .../ui/outage/1`

- [ ] **Step 4: Commit**

```bash
git add opennms-webapp/src/main/java/org/opennms/web/controller/outage/OutageDetailController.java
git commit -m "fix: redirect outage/detail.htm bookmark to Vue outage route"
```

---

## Track B — Feather Import Cleanup

### Task 5: Create `_table.scss` partial and re-point all 20 imports

**Context:** The 20 components import `@featherds/table/scss/table` which resolves via Vite's `loadPaths: ['src/stubs']` to `ui/src/stubs/@featherds/table/scss/table.scss`. This is a stub providing SCSS mixins (`table`, `table-condensed`, `row-hover`, `row-select`, `row-striped`, `status-bar`). We move this to a project-owned partial so the Feather name disappears entirely.

**Files to modify (20 components):**

```
ui/src/components/Nodes/NodesTable.vue                    — @import + @include table; @include table-condensed;
ui/src/components/Nodes/AlarmsTable.vue                   — @import + @include table;
ui/src/components/Nodes/EventsTable.vue                   — @import + @include table;
ui/src/components/Nodes/OutagesTable.vue                  — @import + @include table;
ui/src/components/Nodes/IpInterfacesTable.vue             — @import + @include table;
ui/src/components/Nodes/SnmpInterfacesTable.vue           — @import + @include table;
ui/src/components/Nodes/ColumnSelectionDrawer.vue         — @import only (table mixins referenced via parent scope)
ui/src/components/Nodes/ColumnSelectionPanel.vue          — @import only
ui/src/components/Nodes/NodeAdvancedFiltersDrawer.vue     — @import only
ui/src/components/NodeDetail/NetworkTab.vue               — @import + @include table();
ui/src/components/Configuration/ConfigurationTable.vue    — @import + @include table(); @include table-condensed();
ui/src/components/EventConfiguration/EventConfigSourceTable.vue    — @use + @include table.table;
ui/src/components/EventConfigurationDetail/EventConfigEventTable.vue — @use + @include table.table;
ui/src/components/Map/MapAlarmsGrid.vue                   — @import only
ui/src/components/Map/MapNodesGrid.vue                    — @import only
ui/src/components/Resources/GraphDataTable.vue            — @import only
ui/src/components/Device/DCBTable.vue                     — @import only
ui/src/components/ZenithConnect/ZenithConnectView.vue     — @import only
ui/src/components/ZenithConnect/ZenithConnectRegisterResult.vue — @import only
ui/src/containers/ZenithConnectSuccess.vue                — @import only
```

- [ ] **Step 1: Create `ui/src/styles/_table.scss`**

```scss
@mixin table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  }
}

@mixin table-condensed {
  th, td {
    padding: 4px 8px;
  }
}

@mixin row-hover {
  tr:hover {
    background: rgba(0, 0, 0, 0.04);
  }
}

@mixin row-select {
  tr.selected {
    background: rgba(0, 0, 0, 0.08);
  }
}

@mixin row-striped {
  tr:nth-child(even) {
    background: rgba(0, 0, 0, 0.04);
  }
}

@mixin status-bar($color) {
  border-left: 4px solid #{$color};
}
```

- [ ] **Step 2: Update the 18 files that use `@import "@featherds/table/scss/table"`**

For each of these 18 files, replace:
```scss
@import "@featherds/table/scss/table";
```
with:
```scss
@use "@/styles/table" as *;
```

The `as *` puts all mixins in the global namespace, so existing `@include table;`, `@include table-condensed;` etc. continue to work without changes.

Files to update (the 18 using `@import`):
```
ui/src/components/Nodes/NodesTable.vue
ui/src/components/Nodes/AlarmsTable.vue
ui/src/components/Nodes/EventsTable.vue
ui/src/components/Nodes/OutagesTable.vue
ui/src/components/Nodes/IpInterfacesTable.vue
ui/src/components/Nodes/SnmpInterfacesTable.vue
ui/src/components/Nodes/ColumnSelectionDrawer.vue
ui/src/components/Nodes/ColumnSelectionPanel.vue
ui/src/components/Nodes/NodeAdvancedFiltersDrawer.vue
ui/src/components/NodeDetail/NetworkTab.vue
ui/src/components/Configuration/ConfigurationTable.vue
ui/src/components/Map/MapAlarmsGrid.vue
ui/src/components/Map/MapNodesGrid.vue
ui/src/components/Resources/GraphDataTable.vue
ui/src/components/Device/DCBTable.vue
ui/src/components/ZenithConnect/ZenithConnectView.vue
ui/src/components/ZenithConnect/ZenithConnectRegisterResult.vue
ui/src/containers/ZenithConnectSuccess.vue
```

- [ ] **Step 3: Update the 2 files that use `@use '@featherds/table/scss/table'`**

For `EventConfigSourceTable.vue` and `EventConfigEventTable.vue`, replace:
```scss
@use '@featherds/table/scss/table';
```
with:
```scss
@use "@/styles/table";
```

These files already use `@include table.table;` (namespace syntax) — this keeps working since `@use "@/styles/table"` assigns namespace `table` by default.

- [ ] **Step 4: Delete the stub**

```bash
rm ui/src/stubs/@featherds/table/scss/table.scss
```

Also remove the empty parent directories if they have no other contents:

```bash
rmdir ui/src/stubs/@featherds/table/scss 2>/dev/null
rmdir ui/src/stubs/@featherds/table 2>/dev/null
rmdir ui/src/stubs/@featherds 2>/dev/null
```

- [ ] **Step 5: Build and verify no Feather table references remain**

```bash
cd ui && ../target/node/pnpm build 2>&1 | grep -i "featherds/table\|error" | head -20
```

Expected: no output (no errors, no remaining feather table references).

Double-check:
```bash
grep -r "@featherds/table" ui/src --include="*.vue" --include="*.scss" --include="*.ts"
```

Expected: no output.

- [ ] **Step 6: Deploy and smoke-test tables visually**

```bash
./ui/deploy-to-container.sh test-opennms
```

Open these pages and verify tables render correctly (borders, padding, hover):
- `http://localhost:8980/opennms/ui/nodes` — Nodes table
- `http://localhost:8980/opennms/ui/node/1` (use a real node ID) — Alarms, Events, Outages, Interfaces tabs
- `http://localhost:8980/opennms/ui/event-config` — Event config table

- [ ] **Step 7: Commit**

```bash
git add ui/src/styles/_table.scss ui/src/components ui/src/containers
git status  # verify no stubs directory appears as deleted (git tracks files not dirs)
git rm ui/src/stubs/@featherds/table/scss/table.scss
git commit -m "refactor: move Feather table SCSS stub to project-owned partial, remove @featherds import from 20 components"
```

---

### Task 6: Replace `FeatherButton` in `EmptyList.vue`

**Files:**
- Modify: `ui/src/components/Common/EmptyList.vue`

- [ ] **Step 1: Replace template and script**

In `EmptyList.vue`, the current template uses:
```html
<FeatherButton v-if="content.btn" secondary @click="content.btn?.action" data-test="btn">{{ content.btn?.label }}
</FeatherButton>
```

Replace the entire `<template>` block with:
```html
<template>
  <div :class="['empty-list', bg ? 'bg' : '']">
    <h3 v-if="content.title" data-test="title">{{ content.title }}</h3>
    <div data-test="msg">{{ msg }}</div>
    <Button
      v-if="content.btn"
      outlined
      @click="content.btn?.action"
      data-test="btn"
    >{{ content.btn?.label }}</Button>
  </div>
</template>
```

And replace the `<script setup>` block with:
```html
<script setup lang="ts">
import Button from 'primevue/button'

type Content = {
  title?: string
  msg: string
  btn?: {
    label: string
    action: () => void
  }
}

const props = defineProps<{
  content: Content,
  bg?: boolean
}>()

const msg = computed(() => props.content.msg || '')
</script>
```

Note: `computed` is auto-imported via Vite's Vue plugin — no explicit import needed.

- [ ] **Step 2: Build**

```bash
cd ui && ../target/node/pnpm build 2>&1 | grep -i "error\|feather" | head -10
```

Expected: no errors. Confirm no remaining Feather imports:

```bash
grep -r "@featherds\|FeatherButton\|FeatherInput\|FeatherSelect" ui/src --include="*.vue" --include="*.ts" | grep -v "stubs\|ShimFeatherMegaMenu"
```

Expected: no output (Feather DS completely removed from non-shim production code).

- [ ] **Step 3: Deploy and verify EmptyList renders**

```bash
./ui/deploy-to-container.sh test-opennms
```

Navigate to a page that shows an empty state with a button — for example `http://localhost:8980/opennms/ui/nodes` with a filter that returns no results, or `http://localhost:8980/opennms/ui/alarms` when no alarms exist. Verify the button renders and is clickable.

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/Common/EmptyList.vue
git commit -m "refactor: replace FeatherButton with PrimeVue Button in EmptyList — final Feather component removed"
```

---

## Final Verification

- [ ] **Confirm all 5 redirect gaps are closed**

```bash
# Each should return 302 with a Location pointing to /ui/...
for url in \
  "alarm/index.htm" \
  "element/nodeList.htm" \
  "event/index.htm" \
  "event/detail.htm?id=1" \
  "outage/detail.htm?id=1"; do
  echo -n "$url → "
  curl -s -I -u admin:notdefault \
    "http://localhost:8980/opennms/$url" | grep -i "^location:" || echo "(no redirect)"
done
```

- [ ] **Confirm zero Feather imports remain in Vue source**

```bash
grep -r "@featherds" ui/src --include="*.vue" --include="*.ts" --include="*.scss" | grep -v "ShimFeatherMegaMenu\|stubs"
```

Expected: no output.

- [ ] **Confirm pnpm build is clean**

```bash
cd ui && ../target/node/pnpm build 2>&1 | tail -5
```

Expected: `✓ built in Xs` with no warnings about Feather.
