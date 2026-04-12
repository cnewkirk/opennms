# Topology Edge Label Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split topology edge labels so each endpoint's interface/IP info floats near its vertex rather than everything piling up at the edge midpoint.

**Architecture:** Cytoscape natively supports three label slots per edge — `label` (midpoint), `source-label` (near source vertex), `target-label` (near target vertex). We refactor `composeEdgeLabel` to return three separate strings and wire them up in the stylesheet. All changes are in one file.

**Tech Stack:** Cytoscape.js, Vue 3, TypeScript, Pinia

---

## File Map

| File | Change |
|------|--------|
| `ui/src/composables/useTopology.ts` | Refactor `composeEdgeLabel`, update `applyEdgeLabels`, extend `buildStylesheet` |

No other files change.

---

### Task 1: Refactor `composeEdgeLabel` to return three label slots

**Files:**
- Modify: `ui/src/composables/useTopology.ts` — `composeEdgeLabel` function (~line 519)

- [ ] **Step 1: Replace `composeEdgeLabel` with the three-slot version**

Find the existing function (starts around line 519):

```ts
const composeEdgeLabel = (key: string, protocols: string[]): string => {
```

Replace the entire function with:

```ts
const composeEdgeLabel = (
  key: string,
  protocols: string[]
): { center: string; sourceEnd: string; targetEnd: string } => {
  const centerParts: string[] = []
  const srcParts:    string[] = []
  const tgtParts:    string[] = []

  // Center: protocol list when multiple protocols share this edge
  if (protocols.length > 1) {
    centerParts.push(protocols.join(' · '))
  }

  // Center: utilization
  const util = wmStore.edgeUtilMap[key]
  if (elStore.showUtilization && util) {
    centerParts.push(`${Math.round(util.utilPct)}% · ↑${formatBitsPerSec(util.inBps)} ↓${formatBitsPerSec(util.outBps)}`)
  }

  const d = wmStore.edgeLabelData[key]
  if (d) {
    // Source-end: local interface name
    if (elStore.showLocalPort && d.localIfName) srcParts.push(d.localIfName)

    // Target-end: remote port string
    if (elStore.showRemotePort && d.remotePortId) tgtParts.push(d.remotePortId)

    // Source-end: local IP address
    if (elStore.showIp && d.localIp) srcParts.push(d.localIp)

    // Target-end: remote IP address
    if (elStore.showIp && d.remoteIp) tgtParts.push(d.remoteIp)

    // Source-end: MAC address
    if (elStore.showMac && d.localMac) srcParts.push(d.localMac)

    // Center: link speed
    if (elStore.showSpeed && d.ifSpeed) centerParts.push(`${formatBitsPerSec(d.ifSpeed)}bps`)
  }

  return {
    center:    centerParts.join('\n'),
    sourceEnd: srcParts.join('\n'),
    targetEnd: tgtParts.join('\n'),
  }
}
```

- [ ] **Step 2: Update `applyEdgeLabels` to stamp all three slots**

Find the existing `applyEdgeLabels` function (starts around line 563):

```ts
const applyEdgeLabels = () => {
  if (!cy) return
  cy.batch(() => {
    cy!.edges().forEach(edge => {
      const key = edge.data('edgeKey') as string
      const protocols = (edge.data('protocols') as string[]) ?? []
      const label = composeEdgeLabel(key, protocols)
      if (label) {
        edge.data('wmLabel', label)
        edge.addClass('weathermap')
      } else {
        edge.data('wmLabel', '')
        edge.removeClass('weathermap')
      }
    })
  })
}
```

Replace with:

```ts
const applyEdgeLabels = () => {
  if (!cy) return
  cy.batch(() => {
    cy!.edges().forEach(edge => {
      const key = edge.data('edgeKey') as string
      const protocols = (edge.data('protocols') as string[]) ?? []
      const label = composeEdgeLabel(key, protocols)
      const hasAny = label.center || label.sourceEnd || label.targetEnd
      if (hasAny) {
        edge.data('wmLabel',    label.center)
        edge.data('wmLabelSrc', label.sourceEnd)
        edge.data('wmLabelTgt', label.targetEnd)
        edge.addClass('weathermap')
      } else {
        edge.data('wmLabel',    '')
        edge.data('wmLabelSrc', '')
        edge.data('wmLabelTgt', '')
        edge.removeClass('weathermap')
      }
    })
  })
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/composables/useTopology.ts
git commit -m "refactor(topology): split edge label into center/source-end/target-end slots"
```

---

### Task 2: Wire the new label slots into the Cytoscape stylesheet

**Files:**
- Modify: `ui/src/composables/useTopology.ts` — `buildStylesheet` function, `edge.weathermap` rule (~line 143)

- [ ] **Step 1: Replace the `edge.weathermap` stylesheet rule**

Find the existing rule (around line 143):

```ts
{
  selector: 'edge.weathermap',
  css: {
    'label': 'data(wmLabel)',
    'font-size': 9,
    'color': cssVar('--feather-primary-text-on-surface') || '#e8eaed',
    'text-outline-width': 3,
    'text-outline-color': cssVar('--feather-background') || '#0a0c1b',
    'text-outline-opacity': 1,
    'text-background-opacity': 0,
    'text-rotation': 'autorotate',
    'text-margin-y': -8,
  }
},
```

Replace with:

```ts
{
  selector: 'edge.weathermap',
  css: {
    // Center label — utilization, protocols, speed
    'label':                   'data(wmLabel)',
    'text-rotation':           'autorotate',
    'text-margin-y':           -8,

    // Endpoint labels — interface name / IP near each vertex
    'source-label':            'data(wmLabelSrc)',
    'target-label':            'data(wmLabelTgt)',
    'source-text-offset':      45,
    'target-text-offset':      45,
    'source-text-rotation':    'autorotate',
    'target-text-rotation':    'autorotate',
    'source-text-margin-y':    -6,
    'target-text-margin-y':    -6,

    // Shared text styling for all three slots
    'font-size':               9,
    'color':                   cssVar('--feather-primary-text-on-surface') || '#e8eaed',
    'text-outline-width':      3,
    'text-outline-color':      cssVar('--feather-background') || '#0a0c1b',
    'text-outline-opacity':    1,
    'text-background-opacity': 0,
  }
},
```

> **Note on TypeScript:** If the compiler rejects `source-text-offset`, `target-text-offset`, etc. (Cytoscape's TS types don't always include the endpoint-label properties), cast the entire css block:
> ```ts
> css: {
>   ...
> } as cytoscape.Css.Edge
> ```
> The properties are valid at runtime — this is purely a type gap.

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/composables/useTopology.ts
git commit -m "feat(topology): position edge endpoint labels near their vertex"
```

---

### Task 3: Build, deploy, and verify

**Files:** None — verification only

- [ ] **Step 1: Build the Vue SPA**

```bash
cd /Users/chance/git/opennms/ui && ./target/node/yarn/dist/bin/yarn build
```

Expected: build completes with no errors. Output in `ui/src/main/dist/`.

- [ ] **Step 2: Verify the built index.html references hashed assets**

```bash
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
```

Expected: one line like `assets/index-AbC123xY.js`.

- [ ] **Step 3: Ensure the container is running**

```bash
podman ps --filter name=test-opennms --format '{{.Status}}'
```

If not running, start it:

```bash
podman start test-opennms
```

Wait ~15s then confirm health:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8980/opennms/rest/info
```

Expected: `200`.

- [ ] **Step 4: Deploy to container**

```bash
cd /Users/chance/git/opennms
./ui/deploy-to-container.sh test-opennms
```

- [ ] **Step 5: Verify bundle hashes match**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html
```

Both lines must be identical.

- [ ] **Step 6: Verify asset is served**

```bash
HASH=$(grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html)
curl -s -o /dev/null -w "%{http_code}" http://localhost:8980/opennms/ui/$HASH
```

Expected: `200`.

- [ ] **Step 7: Manual visual verification**

1. Hard-refresh: `Cmd+Option+R` in Safari, Shift+Reload in Chrome.
2. Navigate to the Topology view.
3. Open the edge label config panel and enable **Local Port**, **IP**, **Remote Port**.
4. Confirm:
   - Interface name + IP appear **near the source vertex** (one endpoint of the edge), following the edge angle.
   - Remote port + remote IP appear **near the target vertex** (other endpoint), following the edge angle.
   - Utilization (if weathermap data is live) appears at the **edge midpoint**.
   - Labels rotate when edges are at different angles.
   - Disabling a toggle (e.g. IP) immediately removes those labels from both endpoints.
