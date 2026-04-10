# Linkification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make entity references (node labels, alarm IDs, event IDs) clickable `router-link`s everywhere they appear as plain text in the Vue SPA.

**Architecture:** Pure template changes — replace plain `<td>` text and legacy `<a href>` elements with Vue `<router-link>` components pointing to existing routes (`/node/:id`, `/alarm/:id`, `/event/:id`). No new routes, stores, or APIs needed.

**Tech Stack:** Vue 3, Vue Router, TypeScript

---

### Task 1: Convert NodesTable node ID and label from legacy links to router-links

**Files:**
- Modify: `ui/src/components/Nodes/NodesTable.vue:185-202`

Currently, node ID and label columns use `<a :href="computeNodeLink(node.id)">` which navigates to the legacy JSP page via `window.location.assign`. Convert these to `<router-link>` pointing to the Vue node detail page.

- [ ] **Step 1: Replace the node ID link**

In `ui/src/components/Nodes/NodesTable.vue`, replace:

```html
<td v-if="isSelectedColumn(column, 'id')">
  <a
    :href="computeNodeLink(node.id)"
    @click="onNodeLinkClick(node.id)"
    target="_blank"
  >
    {{ node.id }}
  </a>
</td>
```

With:

```html
<td v-if="isSelectedColumn(column, 'id')">
  <router-link :to="`/node/${node.id}`">{{ node.id }}</router-link>
</td>
```

- [ ] **Step 2: Replace the node label link**

In the same file, replace:

```html
<td v-if="isSelectedColumn(column, 'label')">
  <a
    :href="computeNodeLink(node.id)"
    @click="onNodeLinkClick(node.id)"
    target="_blank"
  >
    {{ node.label }}
  </a>
</td>
```

With:

```html
<td v-if="isSelectedColumn(column, 'label')">
  <router-link :to="`/node/${node.id}`">{{ node.label }}</router-link>
</td>
```

- [ ] **Step 3: Remove dead code**

Remove the now-unused `computeNodeLink` and `onNodeLinkClick` functions from the `<script>` section (lines ~480-489). Also remove the `NodeDetailsDialog` import/template if it was only used by the legacy flow — but check first; `onNodeInfo` is still used by the actions dropdown, so `NodeDetailsDialog` stays.

Only remove `computeNodeLink` if no other template references use it. Check: `NodeDetailsDialog` receives `:computeNodeLink` as a prop. If so, leave `computeNodeLink` and only remove `onNodeLinkClick`.

- [ ] **Step 4: Build and verify**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build
```

- [ ] **Step 5: Deploy and verify**

```bash
./deploy-to-container.sh test-opennms
```

Verify built hash matches container hash. Tell user to hard-refresh. Confirm node ID and label in the Node List page navigate to `/node/:id` within the SPA.

- [ ] **Step 6: Commit**

```bash
git add ui/src/components/Nodes/NodesTable.vue
git commit -m "feat(ui): convert NodesTable node links to router-links"
```

---

### Task 2: Add router-links to MapAlarmsGrid (alarm ID, node label)

**Files:**
- Modify: `ui/src/components/Map/MapAlarmsGrid.vue:80-83`

Currently alarm ID, node label, and other fields are plain `<td>{{ alarm.id }}</td>`. The `Alarm` type has both `id` and `nodeId` fields available.

- [ ] **Step 1: Link alarm ID to alarm detail**

In `ui/src/components/Map/MapAlarmsGrid.vue`, replace:

```html
<td>{{ alarm.id }}</td>
```

With:

```html
<td><router-link :to="`/alarm/${alarm.id}`">{{ alarm.id }}</router-link></td>
```

- [ ] **Step 2: Link node label to node detail**

In the same file, replace:

```html
<td>{{ alarm.nodeLabel }}</td>
```

With:

```html
<td><router-link :to="`/node/${alarm.nodeId}`">{{ alarm.nodeLabel }}</router-link></td>
```

- [ ] **Step 3: Build and verify**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build
```

- [ ] **Step 4: Deploy and verify**

```bash
./deploy-to-container.sh test-opennms
```

Verify on the Map page → Alarms tab that alarm IDs link to `/alarm/:id` and node labels link to `/node/:id`.

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/Map/MapAlarmsGrid.vue
git commit -m "feat(ui): linkify alarm ID and node label in MapAlarmsGrid"
```

---

### Task 3: Add router-link for node ID in MapNodesGrid

**Files:**
- Modify: `ui/src/components/Map/MapNodesGrid.vue:93-99`

Currently node ID uses `<a href="#" @click.prevent="onNodeIdClick(node.id)">` which sets a search filter instead of navigating. Node label uses a similar pattern for search. We want to add a `router-link` to the node detail page while preserving the existing click-to-filter behavior.

The node ID column should become a router-link. The node label click-to-filter behavior is map-specific and useful, so keep it as-is but add a separate small link icon or make the ID the navigation point.

- [ ] **Step 1: Convert node ID to router-link**

In `ui/src/components/Map/MapNodesGrid.vue`, replace:

```html
<td class="first-td" :class="nodeLabelAlarmSeverityMap[node.label]">
  <a href="#" @click.prevent="onNodeIdClick(node.id)">{{ node.id }}</a>
</td>
```

With:

```html
<td class="first-td" :class="nodeLabelAlarmSeverityMap[node.label]">
  <router-link :to="`/node/${node.id}`">{{ node.id }}</router-link>
</td>
```

- [ ] **Step 2: Convert node label to router-link**

Replace:

```html
<td>
  <a href="#" @click.prevent="onNodeLabelClick(node.label)">{{ node.label }}</a>
</td>
```

With:

```html
<td>
  <router-link :to="`/node/${node.id}`">{{ node.label }}</router-link>
</td>
```

- [ ] **Step 3: Remove dead code**

Remove the now-unused `onNodeIdClick` and `onNodeLabelClick` functions from the `<script>` section (lines ~152-159).

- [ ] **Step 4: Build and verify**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build
```

- [ ] **Step 5: Deploy and verify**

```bash
./deploy-to-container.sh test-opennms
```

Verify on the Map page → Nodes tab that node IDs and labels link to `/node/:id`.

- [ ] **Step 6: Commit**

```bash
git add ui/src/components/Map/MapNodesGrid.vue
git commit -m "feat(ui): linkify node ID and label in MapNodesGrid"
```

---

### Task 4: Final build, deploy, and end-to-end verification

- [ ] **Step 1: Full build**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build
```

- [ ] **Step 2: Deploy**

```bash
./deploy-to-container.sh test-opennms
```

- [ ] **Step 3: Verify container bundle hash**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
```

Both must match.

- [ ] **Step 4: Verify all linkified entities**

Navigate through the live UI and confirm:
1. **Node List** (`/nodes`): node ID and label columns are `router-link`s to `/node/:id`
2. **Map → Alarms tab**: alarm ID links to `/alarm/:id`, node label links to `/node/:id`
3. **Map → Nodes tab**: node ID and label link to `/node/:id`
4. All links navigate within the SPA (no full page reload)
5. Existing links (alarm detail → node, event detail → node, etc.) still work

- [ ] **Step 5: Tell user to hard-refresh**

---

## Future Work (TODO)

- **UEI include/exclude filter toggle**: Legacy UI had +/- indicators next to UEIs for filtering events by including/excluding a specific UEI. Needs its own design pass.
