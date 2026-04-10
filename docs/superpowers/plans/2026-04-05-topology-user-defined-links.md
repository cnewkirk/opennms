# Topology User-Defined Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create and delete user-defined links between specific interfaces directly from the topology map via right-click context menu.

**Architecture:** Right-click a node opens a radial context menu (cytoscape-cxtmenu). Selecting "Create Link" enters linking mode. Clicking a target node opens a modal where the user picks interfaces on both ends and enters a link label. The link is optimistically rendered as a dashed edge and POST'd to `/api/v2/userdefinedlinks`. User-defined edges can be deleted from the detail panel. User-defined links appear as their own topology layer.

**Tech Stack:** Vue 3, Cytoscape.js, cytoscape-cxtmenu, Pinia, Feather Design System, OpenNMS REST v2 API

---

### Task 1: Add cytoscape-cxtmenu dependency and types

**Files:**
- Modify: `ui/package.json:79`

- [ ] **Step 1: Install cytoscape-cxtmenu**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn add cytoscape-cxtmenu@^3.5.0
```

- [ ] **Step 2: Create type declaration for cytoscape-cxtmenu**

Create `ui/src/types/cytoscape-cxtmenu.d.ts`:

```typescript
declare module 'cytoscape-cxtmenu' {
  import cytoscape from 'cytoscape'
  const register: (cy: typeof cytoscape) => void
  export default register
}
```

- [ ] **Step 3: Verify import resolves**

Open a test file or run the build to make sure TypeScript can find the module:

```bash
cd /Users/chance/git/opennms/ui && npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add ui/package.json ui/yarn.lock ui/src/types/cytoscape-cxtmenu.d.ts
git commit -m "feat(topology): add cytoscape-cxtmenu dependency for context menu"
```

---

### Task 2: Create user-defined link API service

**Files:**
- Create: `ui/src/services/userDefinedLinkService.ts`

- [ ] **Step 1: Create the service file**

Create `ui/src/services/userDefinedLinkService.ts`:

```typescript
import { v2 } from './axiosInstances'

export interface UserDefinedLinkPayload {
  'node-id-a': number
  'component-label-a': string
  'node-id-z': number
  'component-label-z': string
  'link-id': string
  'link-label': string
  'owner': string
}

export interface UserDefinedLinkResponse extends UserDefinedLinkPayload {
  'db-id': number
}

const endpoint = '/userdefinedlinks'

const getUserDefinedLinks = async (): Promise<UserDefinedLinkResponse[]> => {
  try {
    const resp = await v2.get(endpoint)
    if (resp.status === 204) return []
    return resp.data?.['user_defined_link'] ?? []
  } catch {
    return []
  }
}

const createUserDefinedLink = async (link: UserDefinedLinkPayload): Promise<number | null> => {
  try {
    const resp = await v2.post(endpoint, link)
    // Location header: .../userdefinedlinks/{id}
    const loc = resp.headers?.location ?? ''
    const id = parseInt(loc.substring(loc.lastIndexOf('/') + 1), 10)
    return isNaN(id) ? null : id
  } catch {
    return null
  }
}

const deleteUserDefinedLink = async (dbId: number): Promise<boolean> => {
  try {
    await v2.delete(`${endpoint}/${dbId}`)
    return true
  } catch {
    return false
  }
}

export { getUserDefinedLinks, createUserDefinedLink, deleteUserDefinedLink }
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/chance/git/opennms/ui && npx tsc --noEmit --pretty 2>&1 | grep userDefinedLink
```

Expected: no errors referencing this file.

- [ ] **Step 3: Commit**

```bash
git add ui/src/services/userDefinedLinkService.ts
git commit -m "feat(topology): add user-defined link API service"
```

---

### Task 3: Add types and link mode state to topology store

**Files:**
- Modify: `ui/src/types/topology.ts:37-41`
- Modify: `ui/src/stores/topologyStore.ts:47-276`

- [ ] **Step 1: Extend TopologyEdge and add UserDefinedLink type**

In `ui/src/types/topology.ts`, replace the `TopologyEdge` interface and add a new type after it:

Replace the existing `TopologyEdge` interface (lines 37-41):

```typescript
export interface TopologyEdge {
  source: { namespace: string; id: number }
  target: { namespace: string; id: number }
  protocols?: string[]
  userDefined?: boolean
  dbId?: number
  linkLabel?: string
  componentLabelA?: string
  componentLabelZ?: string
  owner?: string
}
```

- [ ] **Step 2: Add link mode state and UDL actions to the topology store**

In `ui/src/stores/topologyStore.ts`, add these imports at the top (after the existing imports):

```typescript
import { getUserDefinedLinks, createUserDefinedLink, deleteUserDefinedLink, UserDefinedLinkPayload } from '@/services/userDefinedLinkService'
import { useAuthStore } from '@/stores/authStore'
```

Then add these state refs inside the `defineStore` callback, after the `searchQuery` ref (around line 62):

```typescript
  // Link creation mode
  const linkMode = ref(false)
  const linkSourceVertex = ref<TopologyVertex | null>(null)

  // User-defined links (stored separately, merged into edges computed)
  const userDefinedEdges = ref<TopologyEdge[]>([])
```

- [ ] **Step 3: Update the edges computed to include user-defined edges**

Replace the existing `edges` computed (lines 84-101) with:

```typescript
  // Merged, deduplicated edges — one per physical pair, with protocols[] attached
  const edges = computed<TopologyEdge[]>(() => {
    const map = new Map<string, TopologyEdge & { protocols: string[] }>()
    for (const ns of activeLayers.value) {
      const g = layerCache.value[ns]
      if (!g) continue
      const label = availableLayers.value.find(l => l.namespace === ns)?.label ?? ns
      for (const e of g.edges) {
        const key = `${Math.min(e.source.id, e.target.id)}-${Math.max(e.source.id, e.target.id)}`
        const existing = map.get(key)
        if (!existing) {
          map.set(key, { source: e.source, target: e.target, protocols: [label] })
        } else if (!existing.protocols.includes(label)) {
          existing.protocols.push(label)
        }
      }
    }

    // Merge user-defined edges
    for (const ude of userDefinedEdges.value) {
      const key = `${Math.min(ude.source.id, ude.target.id)}-${Math.max(ude.source.id, ude.target.id)}`
      const existing = map.get(key)
      if (!existing) {
        map.set(key, { ...ude, protocols: ['User Defined'] })
      } else if (!existing.protocols.includes('User Defined')) {
        existing.protocols.push('User Defined')
        existing.userDefined = true
        existing.dbId = ude.dbId
        existing.linkLabel = ude.linkLabel
        existing.componentLabelA = ude.componentLabelA
        existing.componentLabelZ = ude.componentLabelZ
        existing.owner = ude.owner
      }
    }

    return Array.from(map.values())
  })
```

- [ ] **Step 4: Add link mode actions and CRUD methods**

Add these methods inside the store, before the `return` statement:

```typescript
  const startLinkMode = (sourceVertex: TopologyVertex) => {
    linkMode.value = true
    linkSourceVertex.value = sourceVertex
    selectedElement.value = null
  }

  const cancelLinkMode = () => {
    linkMode.value = false
    linkSourceVertex.value = null
  }

  const loadUserDefinedLinks = async () => {
    const links = await getUserDefinedLinks()
    userDefinedEdges.value = links.map(l => ({
      source: { namespace: 'nodes', id: l['node-id-a'] },
      target: { namespace: 'nodes', id: l['node-id-z'] },
      userDefined: true,
      dbId: l['db-id'],
      linkLabel: l['link-label'],
      componentLabelA: l['component-label-a'],
      componentLabelZ: l['component-label-z'],
      owner: l['owner']
    }))
  }

  const addUserDefinedLink = async (
    nodeIdA: number, componentLabelA: string,
    nodeIdZ: number, componentLabelZ: string,
    linkLabel: string
  ): Promise<boolean> => {
    const authStore = useAuthStore()
    const owner = authStore.whoAmI?.id ?? 'unknown'
    const linkId = `udl-${nodeIdA}-${nodeIdZ}-${Date.now()}`

    // Optimistic: add edge immediately
    const tempEdge: TopologyEdge = {
      source: { namespace: 'nodes', id: nodeIdA },
      target: { namespace: 'nodes', id: nodeIdZ },
      userDefined: true,
      linkLabel,
      componentLabelA,
      componentLabelZ,
      owner
    }
    userDefinedEdges.value = [...userDefinedEdges.value, tempEdge]

    const payload: UserDefinedLinkPayload = {
      'node-id-a': nodeIdA,
      'component-label-a': componentLabelA,
      'node-id-z': nodeIdZ,
      'component-label-z': componentLabelZ,
      'link-id': linkId,
      'link-label': linkLabel,
      'owner': owner
    }

    const dbId = await createUserDefinedLink(payload)
    if (dbId !== null) {
      // Update with real dbId
      const idx = userDefinedEdges.value.indexOf(tempEdge)
      if (idx >= 0) {
        const updated = { ...tempEdge, dbId }
        userDefinedEdges.value = [
          ...userDefinedEdges.value.slice(0, idx),
          updated,
          ...userDefinedEdges.value.slice(idx + 1)
        ]
      }
      return true
    } else {
      // Rollback
      userDefinedEdges.value = userDefinedEdges.value.filter(e => e !== tempEdge)
      return false
    }
  }

  const removeUserDefinedLink = async (dbId: number): Promise<boolean> => {
    const edge = userDefinedEdges.value.find(e => e.dbId === dbId)
    if (!edge) return false

    // Optimistic: remove immediately
    userDefinedEdges.value = userDefinedEdges.value.filter(e => e.dbId !== dbId)
    selectedElement.value = null

    const ok = await deleteUserDefinedLink(dbId)
    if (!ok) {
      // Rollback
      userDefinedEdges.value = [...userDefinedEdges.value, edge]
      return false
    }
    return true
  }
```

- [ ] **Step 5: Update the return statement to expose new state and actions**

Add to the return object in the store:

```typescript
    linkMode,
    linkSourceVertex,
    userDefinedEdges,
    startLinkMode,
    cancelLinkMode,
    loadUserDefinedLinks,
    addUserDefinedLink,
    removeUserDefinedLink
```

- [ ] **Step 6: Verify it compiles**

```bash
cd /Users/chance/git/opennms/ui && npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add ui/src/types/topology.ts ui/src/stores/topologyStore.ts
git commit -m "feat(topology): add link mode state and UDL CRUD to topology store"
```

---

### Task 4: Add context menu and linking mode to useTopology composable

**Files:**
- Modify: `ui/src/composables/useTopology.ts`

- [ ] **Step 1: Register cxtmenu and add user-defined edge styles**

At the top of `ui/src/composables/useTopology.ts`, add the cxtmenu import after the existing cytoscape import (line 23):

```typescript
import cxtmenu from 'cytoscape-cxtmenu'

cytoscape.use(cxtmenu)
```

- [ ] **Step 2: Add user-defined edge style to the stylesheet**

In the `buildStylesheet()` function, add this entry after the `edge:selected` block (after line 118):

```typescript
    // User-defined edges — dashed, distinct color
    {
      selector: 'edge.user-defined',
      css: {
        'line-style': 'dashed',
        'line-dash-pattern': [8, 4],
        'line-color': cssVar('--feather-primary') || '#1f78c1',
        'opacity': 0.8
      }
    },
    // Linking mode — highlight candidate target nodes
    {
      selector: 'node.link-target-candidate',
      css: {
        'border-width': 3,
        'border-color': cssVar('--feather-primary') || '#1f78c1',
        'border-style': 'dashed'
      }
    }
```

- [ ] **Step 3: Initialize the context menu in initCytoscape**

In the `initCytoscape()` function, after the `cy.on('dragfree', ...)` handler (after line 243), add:

```typescript
    // Context menu for nodes (right-click)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(cy as any).cxtmenu({
      selector: 'node',
      commands: [
        {
          content: 'Create Link',
          select: (ele: cytoscape.SingularElementReturnValue) => {
            const vertex = store.vertices.find(v => v.id === ele.id())
            if (vertex) store.startLinkMode(vertex)
          }
        }
      ],
      fillColor: cssVar('--feather-surface') || '#1e1e2e',
      activeFillColor: cssVar('--feather-primary') || '#1f78c1',
      activePadding: 10,
      indicatorSize: 14,
      separatorWidth: 3,
      spotlightPadding: 4,
      adaptativeNodeSpotlightRadius: true,
      minSpotlightRadius: 20,
      maxSpotlightRadius: 38,
      itemTextShadowColor: 'transparent'
    })
```

- [ ] **Step 4: Add linking mode click handler**

In the `initCytoscape()` function, inside the existing `cy.on('tap', 'node', ...)` handler (line 222-226), wrap the existing logic so linking mode takes priority:

Replace the existing `cy.on('tap', 'node', ...)` handler:

```typescript
    cy.on('tap', 'node', (evt) => {
      if (store.linkMode) {
        // In link mode, this node is the target
        const targetId = evt.target.id()
        const sourceId = store.linkSourceVertex?.id
        if (targetId && sourceId && targetId !== sourceId) {
          const targetVertex = store.vertices.find(v => v.id === targetId)
          if (targetVertex) {
            store.cancelLinkMode()
            // Emit event for the modal to open — store the pair temporarily
            pendingLinkTarget.value = targetVertex
          }
        }
        return
      }
      const nodeData = evt.target.data()
      const vertex = store.vertices.find(v => v.id === nodeData.id)
      if (vertex) store.selectElement(vertex)
    })
```

Also replace the existing `cy.on('tap', ...)` (background tap) handler:

```typescript
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        if (store.linkMode) {
          store.cancelLinkMode()
          return
        }
        store.selectElement(null)
      }
    })
```

- [ ] **Step 5: Add link mode visual state tracking**

Before the `initCytoscape` function, add:

```typescript
  const pendingLinkTarget = ref<import('@/types/topology').TopologyVertex | null>(null)
```

After the `initCytoscape` function, add a watcher for link mode visuals:

```typescript
  // When link mode activates/deactivates, update node styling
  watch(() => store.linkMode, (active) => {
    if (!cy) return
    if (active) {
      const sourceId = store.linkSourceVertex?.id
      cy.nodes().forEach(n => {
        if (n.id() !== sourceId) n.addClass('link-target-candidate')
      })
    } else {
      cy.nodes().removeClass('link-target-candidate')
    }
  })
```

- [ ] **Step 6: Apply user-defined class in syncElements**

In the `syncElements()` function, after the existing multi-protocol class application (after line 287), add:

```typescript
    // Apply user-defined class for dashed styling
    cy.edges().forEach(edge => {
      const key = edge.data('edgeKey')
      const storeEdge = store.edges.find(e => {
        const s = e.source.id; const t = e.target.id
        return `${Math.min(s, t)}-${Math.max(s, t)}` === key
      })
      if (storeEdge?.userDefined) edge.addClass('user-defined')
    })
```

- [ ] **Step 7: Expose pendingLinkTarget in the return**

Update the return statement to include the new ref:

```typescript
  return { getCy: () => cy, saveLayout, resetLayout, pendingLinkTarget }
```

- [ ] **Step 8: Verify it compiles**

```bash
cd /Users/chance/git/opennms/ui && npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 9: Commit**

```bash
git add ui/src/composables/useTopology.ts
git commit -m "feat(topology): add cxtmenu context menu and linking mode"
```

---

### Task 5: Create the Create Link modal component

**Files:**
- Create: `ui/src/components/Topology/CreateLinkModal.vue`

- [ ] **Step 1: Create the modal component**

Create `ui/src/components/Topology/CreateLinkModal.vue`:

```vue
<template>
  <Teleport to="body">
    <div v-if="visible" class="create-link-overlay" @click.self="cancel">
      <div class="create-link-modal">
        <div class="create-link-modal__header">
          <span class="create-link-modal__title">Create Link</span>
          <button type="button" class="create-link-modal__close" @click="cancel">&times;</button>
        </div>

        <div v-if="loadingInterfaces" class="create-link-modal__loading">
          <FeatherSpinner />
          <span>Loading interfaces…</span>
        </div>

        <form v-else class="create-link-modal__body" @submit.prevent="submit">
          <!-- Source node -->
          <div class="create-link-modal__node-section">
            <span class="create-link-modal__node-label">{{ sourceLabel }}</span>
            <FeatherSelect
              label="Interface"
              :options="sourceInterfaces"
              v-model="sourceInterface"
              text-prop="label"
            />
          </div>

          <!-- Target node -->
          <div class="create-link-modal__node-section">
            <span class="create-link-modal__node-label">{{ targetLabel }}</span>
            <FeatherSelect
              label="Interface"
              :options="targetInterfaces"
              v-model="targetInterface"
              text-prop="label"
            />
          </div>

          <!-- Link label -->
          <FeatherInput
            v-model="linkLabel"
            label="Link Label"
            class="create-link-modal__input"
          />

          <div class="create-link-modal__actions">
            <FeatherButton secondary @click="cancel">Cancel</FeatherButton>
            <FeatherButton
              primary
              type="submit"
              :disabled="!canSubmit"
            >Create</FeatherButton>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherInput } from '@featherds/input'
import { FeatherSelect } from '@featherds/select'
import { FeatherSpinner } from '@featherds/progress'
import { getNodeIpInterfaces, getNodeSnmpInterfaces } from '@/services/nodeService'
import { TopologyVertex } from '@/types/topology'
import { IpInterface, SnmpInterface } from '@/types'

interface InterfaceOption {
  label: string
  _value: string // used as componentLabel
}

const props = defineProps<{
  visible: boolean
  sourceVertex: TopologyVertex | null
  targetVertex: TopologyVertex | null
}>()

const emit = defineEmits<{
  cancel: []
  create: [nodeIdA: number, componentLabelA: string, nodeIdZ: number, componentLabelZ: string, linkLabel: string]
}>()

const sourceInterface = ref<InterfaceOption | null>(null)
const targetInterface = ref<InterfaceOption | null>(null)
const linkLabel = ref('')
const loadingInterfaces = ref(false)
const sourceInterfaces = ref<InterfaceOption[]>([])
const targetInterfaces = ref<InterfaceOption[]>([])

const sourceLabel = computed(() => props.sourceVertex?.label ?? 'Source')
const targetLabel = computed(() => props.targetVertex?.label ?? 'Target')

const canSubmit = computed(() =>
  sourceInterface.value !== null &&
  targetInterface.value !== null &&
  linkLabel.value.trim().length > 0
)

const buildInterfaceList = async (nodeId: string): Promise<InterfaceOption[]> => {
  const [ipResp, snmpResp] = await Promise.all([
    getNodeIpInterfaces(nodeId, { limit: 100, offset: 0 }),
    getNodeSnmpInterfaces(nodeId, { limit: 100, offset: 0 })
  ])

  const ipInterfaces: IpInterface[] = ipResp ? ipResp.ipInterface : []
  const snmpInterfaces: SnmpInterface[] = snmpResp ? snmpResp.snmpInterface : []

  // Build a map of ifIndex -> IP addresses for joining
  const ifIndexToIp = new Map<number, string>()
  for (const ip of ipInterfaces) {
    const idx = parseInt(ip.ifIndex, 10)
    if (!isNaN(idx) && idx > 0) ifIndexToIp.set(idx, ip.ipAddress)
  }

  const options: InterfaceOption[] = []
  const coveredIfIndices = new Set<number>()

  // SNMP interfaces first — these are the physical/logical ports
  for (const snmp of snmpInterfaces) {
    const name = snmp.ifName || snmp.ifDescr || `ifIndex ${snmp.ifIndex}`
    const ip = ifIndexToIp.get(snmp.ifIndex)
    const label = ip ? `${name} (${ip})` : name
    options.push({ label, _value: name })
    coveredIfIndices.add(snmp.ifIndex)
  }

  // IP-only interfaces (no matching SNMP record)
  for (const ip of ipInterfaces) {
    const idx = parseInt(ip.ifIndex, 10)
    if (!isNaN(idx) && coveredIfIndices.has(idx)) continue
    const label = ip.hostName && ip.hostName !== ip.ipAddress
      ? `${ip.ipAddress} (${ip.hostName})`
      : ip.ipAddress
    options.push({ label, _value: ip.ipAddress })
  }

  options.sort((a, b) => a.label.localeCompare(b.label))
  return options
}

watch(() => [props.visible, props.sourceVertex, props.targetVertex], async ([vis]) => {
  if (!vis || !props.sourceVertex?.id || !props.targetVertex?.id) return

  sourceInterface.value = null
  targetInterface.value = null
  linkLabel.value = ''
  loadingInterfaces.value = true

  const [srcList, tgtList] = await Promise.all([
    buildInterfaceList(props.sourceVertex.id),
    buildInterfaceList(props.targetVertex.id)
  ])

  sourceInterfaces.value = srcList
  targetInterfaces.value = tgtList
  loadingInterfaces.value = false
}, { immediate: true })

const cancel = () => emit('cancel')

const submit = () => {
  if (!canSubmit.value || !props.sourceVertex || !props.targetVertex) return

  const nodeIdA = parseInt(props.sourceVertex.id, 10)
  const nodeIdZ = parseInt(props.targetVertex.id, 10)
  if (isNaN(nodeIdA) || isNaN(nodeIdZ)) return

  emit('create',
    nodeIdA, sourceInterface.value!._value,
    nodeIdZ, targetInterface.value!._value,
    linkLabel.value.trim()
  )
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.create-link-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.create-link-modal {
  background: var($surface);
  border-radius: 8px;
  width: 440px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var($border-on-surface);
  }

  &__title {
    font-weight: 600;
    font-size: 1.1rem;
  }

  &__close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.4rem;
    color: var($secondary-text-on-surface);
    padding: 2px 8px;
    border-radius: 4px;
    line-height: 1;

    &:hover {
      background: var($shade-2);
    }
  }

  &__body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  &__loading {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 32px 20px;
    font-size: 0.9rem;
    color: var($secondary-text-on-surface);
  }

  &__node-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__node-label {
    font-weight: 600;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var($secondary-text-on-surface);
  }

  &__input {
    width: 100%;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 8px;
  }
}
</style>
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/chance/git/opennms/ui && npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/Topology/CreateLinkModal.vue
git commit -m "feat(topology): add CreateLinkModal component with interface merge"
```

---

### Task 6: Wire context menu, modal, and linking mode into TopologyGraph

**Files:**
- Modify: `ui/src/components/Topology/TopologyGraph.vue`

- [ ] **Step 1: Add the linking banner, modal, and snackbar integration**

Replace the full content of `ui/src/components/Topology/TopologyGraph.vue`:

```vue
<template>
  <div class="topology-graph">
    <div v-if="store.loading" class="topology-graph__loading">
      <FeatherSpinner />
      <span>Loading topology…</span>
    </div>
    <div v-else-if="store.error" class="topology-graph__error">
      {{ store.error }}
    </div>
    <div v-else-if="!store.loading && store.vertices.length === 0" class="topology-graph__empty">
      No nodes found for this layer.
    </div>

    <!-- Linking mode banner -->
    <div v-if="store.linkMode" class="topology-graph__link-banner">
      <span>Click a target node to link from <strong>{{ store.linkSourceVertex?.label }}</strong></span>
      <FeatherButton text @click="store.cancelLinkMode()">Cancel (Esc)</FeatherButton>
    </div>

    <div ref="graphContainer" class="topology-graph__canvas" />
    <TopologyDetailPanel />

    <CreateLinkModal
      :visible="showLinkModal"
      :sourceVertex="linkSourceForModal"
      :targetVertex="linkTargetForModal"
      @cancel="closeLinkModal"
      @create="onCreateLink"
    />
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherSpinner } from '@featherds/progress'
import useTopology from '@/composables/useTopology'
import useSnackbar from '@/composables/useSnackbar'
import { useTopologyStore } from '@/stores/topologyStore'
import TopologyDetailPanel from './TopologyDetailPanel.vue'
import CreateLinkModal from './CreateLinkModal.vue'

const store = useTopologyStore()
const { showSnackBar } = useSnackbar()
const graphContainer = ref<HTMLElement | null>(null)

const { saveLayout, resetLayout, pendingLinkTarget } = useTopology(graphContainer)

// Modal state
const showLinkModal = ref(false)
const linkSourceForModal = ref(store.linkSourceVertex)
const linkTargetForModal = ref(pendingLinkTarget.value)

watch(pendingLinkTarget, (target) => {
  if (target) {
    linkSourceForModal.value = store.linkSourceVertex
    linkTargetForModal.value = target
    showLinkModal.value = true
    pendingLinkTarget.value = null
  }
})

const closeLinkModal = () => {
  showLinkModal.value = false
  linkSourceForModal.value = null
  linkTargetForModal.value = null
}

const onCreateLink = async (
  nodeIdA: number, componentLabelA: string,
  nodeIdZ: number, componentLabelZ: string,
  linkLabel: string
) => {
  closeLinkModal()
  const ok = await store.addUserDefinedLink(nodeIdA, componentLabelA, nodeIdZ, componentLabelZ, linkLabel)
  if (ok) {
    showSnackBar({ msg: 'Link created successfully.' })
  } else {
    showSnackBar({ msg: 'Failed to create link.', error: true })
  }
}

// Escape key to cancel link mode
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && store.linkMode) {
    store.cancelLinkMode()
  }
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

defineExpose({ saveLayout, resetLayout })
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.topology-graph {
  flex: 1;
  position: relative;
  min-height: 0;

  &__canvas {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
  }

  &__loading,
  &__error,
  &__empty {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    z-index: 1;
  }

  &__link-banner {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 20px;
    background: var($surface);
    border: 2px solid var($primary);
    border-radius: 8px;
    font-size: 0.9rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }
}
</style>
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/chance/git/opennms/ui && npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/Topology/TopologyGraph.vue
git commit -m "feat(topology): wire CreateLinkModal and link-mode banner into TopologyGraph"
```

---

### Task 7: Add delete button to detail panel for user-defined edges

**Files:**
- Modify: `ui/src/components/Topology/TopologyDetailPanel.vue:119-199`

- [ ] **Step 1: Add snackbar import and delete handler**

In `TopologyDetailPanel.vue`, add this import after the existing imports (around line 212):

```typescript
import useSnackbar from '@/composables/useSnackbar'
```

Then add the snackbar and delete handler after the `const store = useTopologyStore()` line:

```typescript
const { showSnackBar } = useSnackbar()

const isUserDefinedEdge = computed(() => edge.value?.userDefined === true)

const deletingLink = ref(false)
const onDeleteLink = async () => {
  if (!edge.value?.dbId) return
  deletingLink.value = true
  const ok = await store.removeUserDefinedLink(edge.value.dbId)
  if (ok) {
    showSnackBar({ msg: 'Link deleted.' })
  } else {
    showSnackBar({ msg: 'Failed to delete link.', error: true })
  }
  deletingLink.value = false
}
```

- [ ] **Step 2: Add user-defined link detail section and delete button to the template**

In the template, find the edge detail section. After the protocols chips (line 133), add a user-defined link detail block:

Replace this section (lines 131-133):

```html
          <div v-if="edgeProtocols.length" class="topo-panel__chips">
            <span v-for="p in edgeProtocols" :key="p" class="topo-panel__chip">{{ p }}</span>
          </div>
```

With:

```html
          <div v-if="edgeProtocols.length" class="topo-panel__chips">
            <span v-for="p in edgeProtocols" :key="p" class="topo-panel__chip">{{ p }}</span>
          </div>

          <!-- User-defined link details -->
          <template v-if="isUserDefinedEdge">
            <div class="topo-panel__section">User Defined Link</div>
            <div v-if="edge?.linkLabel" class="topo-panel__row">
              <span class="topo-panel__key">Label</span>
              <span class="topo-panel__val">{{ edge.linkLabel }}</span>
            </div>
            <div v-if="edge?.componentLabelA" class="topo-panel__row">
              <span class="topo-panel__key">{{ sourceLabel }} Port</span>
              <span class="topo-panel__val topo-panel__val--mono">{{ edge.componentLabelA }}</span>
            </div>
            <div v-if="edge?.componentLabelZ" class="topo-panel__row">
              <span class="topo-panel__key">{{ targetLabel }} Port</span>
              <span class="topo-panel__val topo-panel__val--mono">{{ edge.componentLabelZ }}</span>
            </div>
            <div v-if="edge?.owner" class="topo-panel__row">
              <span class="topo-panel__key">Created by</span>
              <span class="topo-panel__val">{{ edge.owner }}</span>
            </div>
            <div class="topo-panel__actions">
              <FeatherButton text :disabled="deletingLink" @click="onDeleteLink">
                {{ deletingLink ? 'Deleting…' : 'Delete Link' }}
              </FeatherButton>
            </div>
          </template>
```

- [ ] **Step 3: Verify it compiles**

```bash
cd /Users/chance/git/opennms/ui && npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/Topology/TopologyDetailPanel.vue
git commit -m "feat(topology): add user-defined link details and delete button to detail panel"
```

---

### Task 8: Add User Defined layer toggle to toolbar

**Files:**
- Modify: `ui/src/stores/topologyStore.ts`
- Modify: `ui/src/containers/Topology.vue`

- [ ] **Step 1: Load user-defined links on page mount**

In `ui/src/containers/Topology.vue`, update the `onMounted` block to also load user-defined links:

Replace:

```typescript
onMounted(async () => {
  await Promise.all([
    store.loadContainers(),
    store.loadAlarmSeverities()
  ])
})
```

With:

```typescript
onMounted(async () => {
  await Promise.all([
    store.loadContainers(),
    store.loadAlarmSeverities(),
    store.loadUserDefinedLinks()
  ])
})
```

- [ ] **Step 2: Verify it compiles and build**

```bash
cd /Users/chance/git/opennms/ui && npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/containers/Topology.vue
git commit -m "feat(topology): load user-defined links on topology page mount"
```

---

### Task 9: Build, deploy, and verify end-to-end

**Files:** None (verification only)

- [ ] **Step 1: Build the UI**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build
```

- [ ] **Step 2: Verify build output**

Check `src/main/dist/index.html` has `src="/opennms/ui/assets/index-*.js"` paths.

```bash
grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html
```

- [ ] **Step 3: Deploy to container**

```bash
cd /Users/chance/git/opennms/ui && ./deploy-to-container.sh test-opennms
```

- [ ] **Step 4: Verify deployed bundle hash matches**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html
```

Both must match.

- [ ] **Step 5: Verify bundle serves**

```bash
curl -s -o /dev/null -w "%{http_code}" -L http://localhost:8980/opennms/ui/assets/index-*.js
```

Must return 200.

- [ ] **Step 6: Test the user-defined links REST API directly**

```bash
# Create a test link
curl -s -u admin:notdefault -X POST \
  -H 'Content-Type: application/json' \
  -d '{"node-id-a":1,"component-label-a":"lo","node-id-z":1,"component-label-z":"lo","link-id":"test-1","link-label":"Test Link","owner":"admin"}' \
  http://localhost:8980/opennms/api/v2/userdefinedlinks -w "\n%{http_code}"

# List links
curl -s -u admin:notdefault http://localhost:8980/opennms/api/v2/userdefinedlinks | python3 -m json.tool

# Delete the test link (replace {id} with the db-id from the list response)
# curl -s -u admin:notdefault -X DELETE http://localhost:8980/opennms/api/v2/userdefinedlinks/{id} -w "%{http_code}"
```

- [ ] **Step 7: Verify in browser**

Navigate to the topology page, right-click a node, verify the context menu appears with "Create Link" option. Test the full flow: right-click source, click "Create Link", click target node, fill in the modal, submit. Verify dashed edge appears. Click the edge, verify detail panel shows user-defined link info with delete button. Delete and verify edge disappears.

- [ ] **Step 8: Commit**

No code changes in this task — verification only.
