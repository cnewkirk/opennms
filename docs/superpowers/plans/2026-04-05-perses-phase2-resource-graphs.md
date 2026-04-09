# Perses Phase 2 — Resource Graphs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Chart.js rendering in the Vue SPA Resource Graphs page with Perses `TimeSeriesChart` panels by updating `RrdGraphConverter` to emit `PersesGraphSpec` and replacing `Graph.vue`'s canvas+Chart.js setup with `<PersesPanel>`.

**Architecture:** `RrdGraphConverter` gains a second output type (`PersesGraphSpec`) alongside the existing `ConvertedGraphData`. `Graph.vue` is refactored to use `<PersesPanel>` with the converted spec. `HtmlLegendPlugin`, `LegendFormatter`, and `chartjs-plugin-zoom` are removed. The `GraphDataTable` tab is retained as-is.

**Prerequisites:** Phase 1 complete (`PersesPanel.vue` and the OpenNMS datasource plugin are in place).

**Tech Stack:** Vue 3, TypeScript, `@perses-dev/panels-plugin`, Vitest

---

## File Map

**Modified:**
- `ui/src/components/Resources/utils/RrdGraphConverter.class.ts` — add `PersesGraphSpec` output
- `ui/src/components/Resources/Graph.vue` — replace Chart.js with `<PersesPanel>`
- `ui/package.json` — remove `chart.js`, `chartjs-plugin-zoom` from dependencies

**Deleted:**
- `ui/src/components/Resources/plugins/HtmlLegendPlugin.ts`
- `ui/src/components/Resources/utils/LegendFormatter.ts`

**New tests:**
- `ui/tests/components/Resources/RrdGraphConverter.perses.test.ts`

---

## Task 1: Add PersesGraphSpec Types

**Files:**
- Modify: `ui/src/types/index.ts` (or wherever `ConvertedGraphData` is defined — check `ui/src/types/`)

- [ ] **Step 1: Find where graph types are defined**

```bash
grep -rn "ConvertedGraphData\|PrintStatement\|Series" ui/src/types/ | head -10
```

Note the file path (likely `ui/src/types/index.ts`).

- [ ] **Step 2: Add PersesGraphSpec to the types file**

In `ui/src/types/index.ts` (or wherever `ConvertedGraphData` is defined), add:

```typescript
import type { OpenNMSQuerySpec } from '@/datasource/opennms'

/** Visual config for a single series in a Perses TimeSeriesChart */
export interface PersesSeriesOverride {
  /** Matches the query label */
  name: string
  color?: string
  type?: 'line' | 'area' | 'stack'
}

/**
 * Output of RrdGraphConverter when targeting Perses rendering.
 * Replaces the old ConvertedGraphData → Chart.js pipeline.
 */
export interface PersesGraphSpec {
  /** Panel title */
  title: string
  /** Y-axis label (from VERTICAL_LABEL in graph def) */
  yAxisLabel: string
  /** One query per DEF/CDEF metric */
  queries: OpenNMSQuerySpec[]
  /** Per-series visual overrides (color, type) */
  seriesOverrides: PersesSeriesOverride[]
  /** Legend text items rendered below the panel */
  printStatements: PrintStatement[]
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd ui && yarn vue-tsc --noEmit 2>&1 | grep "PersesGraphSpec" || echo "OK"
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add ui/src/types/
git commit -m "feat(types): add PersesGraphSpec for Perses panel output"
```

---

## Task 2: Extend RrdGraphConverter to Emit PersesGraphSpec

**Files:**
- Modify: `ui/src/components/Resources/utils/RrdGraphConverter.class.ts`
- Create: `ui/tests/components/Resources/RrdGraphConverter.perses.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// ui/tests/components/Resources/RrdGraphConverter.perses.test.ts
import { describe, test, expect } from 'vitest'
import RrdGraphConverter from '@/components/Resources/utils/RrdGraphConverter.class'

// Minimal graph definition as returned by /rest/graphs/<name>
const sampleGraphDef = {
  title: 'Interface Throughput',
  verticalLabel: 'Bytes/s',
  propertiesValues: [],
  columns: ['ifInOctets', 'ifOutOctets'],
  command: '--start {rrdstart} --end {rrdend} '
    + 'DEF:a={rrd1}:ifInOctets:AVERAGE '
    + 'DEF:b={rrd2}:ifOutOctets:AVERAGE '
    + 'LINE1:a#0000ff:"In" '
    + 'LINE1:b#ff0000:"Out"'
}

const resourceId = 'node[1].interfaceSnmp[eth0-000000000000]'

describe('RrdGraphConverter.toPersesGraphSpec()', () => {
  test('produces one OpenNMSQuery per DEF', () => {
    const converter = new RrdGraphConverter({ graphDef: sampleGraphDef, resourceId })
    const spec = converter.toPersesGraphSpec()

    expect(spec.queries).toHaveLength(2)
    expect(spec.queries[0].attribute).toBe('ifInOctets')
    expect(spec.queries[0].resourceId).toBe(resourceId)
    expect(spec.queries[0].aggregation).toBe('AVERAGE')
    expect(spec.queries[1].attribute).toBe('ifOutOctets')
  })

  test('maps LINE series to seriesOverrides with type=line and color', () => {
    const converter = new RrdGraphConverter({ graphDef: sampleGraphDef, resourceId })
    const spec = converter.toPersesGraphSpec()

    expect(spec.seriesOverrides).toHaveLength(2)
    expect(spec.seriesOverrides[0]).toMatchObject({ name: 'In', color: '#0000ff', type: 'line' })
    expect(spec.seriesOverrides[1]).toMatchObject({ name: 'Out', color: '#ff0000', type: 'line' })
  })

  test('sets title and yAxisLabel from graph definition', () => {
    const converter = new RrdGraphConverter({ graphDef: sampleGraphDef, resourceId })
    const spec = converter.toPersesGraphSpec()

    expect(spec.title).toBe('Interface Throughput')
    expect(spec.yAxisLabel).toBe('Bytes/s')
  })

  test('marks CDEF metrics as expression queries', () => {
    const cdefGraphDef = {
      ...sampleGraphDef,
      columns: ['ifInOctets'],
      command: '--start {rrdstart} --end {rrdend} '
        + 'DEF:a={rrd1}:ifInOctets:AVERAGE '
        + 'CDEF:bps=a,8,* '
        + 'LINE1:bps#0000ff:"In bps"'
    }
    const converter = new RrdGraphConverter({ graphDef: cdefGraphDef, resourceId })
    const spec = converter.toPersesGraphSpec()

    const cdefQuery = spec.queries.find(q => q.expression)
    expect(cdefQuery).toBeDefined()
    expect(cdefQuery?.expression).toContain('a')
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
cd ui && yarn test tests/components/Resources/RrdGraphConverter.perses.test.ts
```

Expected: FAIL — `toPersesGraphSpec` method does not exist

- [ ] **Step 3: Add `toPersesGraphSpec()` to RrdGraphConverter**

In `ui/src/components/Resources/utils/RrdGraphConverter.class.ts`, add the following import at the top and method to the class:

Add import:
```typescript
import type { PersesGraphSpec, PersesSeriesOverride } from '@/types'
import type { OpenNMSQuerySpec } from '@/datasource/opennms'
```

Add method to the `RrdGraphConverter` class (after the constructor):

```typescript
  /**
   * Produces a PersesGraphSpec suitable for rendering with <PersesPanel>.
   * This is the Perses equivalent of `this.model` (the Chart.js output).
   */
  toPersesGraphSpec(): PersesGraphSpec {
    // Build one OpenNMSQuery per metric in this.model.metrics
    const queries: OpenNMSQuerySpec[] = this.model.metrics.map(metric => {
      if (metric.expression) {
        return {
          resourceId: this.resourceId as string,
          attribute: metric.name as string,
          aggregation: 'AVERAGE',
          label: metric.name as string,
          expression: metric.expression as string,
          transient: metric.transient as boolean
        } satisfies OpenNMSQuerySpec
      }
      return {
        resourceId: this.resourceId as string,
        attribute: metric.attribute as string,
        aggregation: (metric.aggregation as OpenNMSQuerySpec['aggregation']) ?? 'AVERAGE',
        label: metric.name as string,
        transient: metric.transient as boolean
      } satisfies OpenNMSQuerySpec
    })

    // Map series to per-series visual overrides
    const seriesOverrides: PersesSeriesOverride[] = this.model.series
      .filter(s => s.name && s.type !== 'hidden')
      .map(s => ({
        name: s.name as string,
        color: s.color as string | undefined,
        type: (s.type === 'stack' ? 'stack' : s.type === 'area' ? 'area' : 'line') as PersesSeriesOverride['type']
      }))

    return {
      title: this.model.title as string,
      yAxisLabel: this.model.verticalLabel as string,
      queries,
      seriesOverrides,
      printStatements: this.model.printStatements
    }
  }
```

- [ ] **Step 4: Run passing test**

```bash
cd ui && yarn test tests/components/Resources/RrdGraphConverter.perses.test.ts
```

Expected: PASS

- [ ] **Step 5: Run all frontend tests to catch regressions**

```bash
cd ui && yarn test
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add ui/src/components/Resources/utils/RrdGraphConverter.class.ts \
        ui/tests/components/Resources/RrdGraphConverter.perses.test.ts
git commit -m "feat(converter): add toPersesGraphSpec() to RrdGraphConverter"
```

---

## Task 3: Refactor Graph.vue to Use PersesPanel

**Files:**
- Modify: `ui/src/components/Resources/Graph.vue`

- [ ] **Step 1: Read the current Graph.vue**

Read `ui/src/components/Resources/Graph.vue` (already done in prior context — 337 lines). The file uses `<canvas>`, Chart.js, `HtmlLegendPlugin`, and `LegendFormatter`.

- [ ] **Step 2: Replace Graph.vue**

Replace the entire file with:

```vue
<!-- ui/src/components/Resources/Graph.vue -->
<template>
  <div class="feather-row">
    <div class="feather-col-12 container">
      <router-link
        v-if="!isSingleGraph"
        :to="`/resource-graphs/graphs/${label}/${definition}/${resourceId}`"
        target="_blank"
      >
        <FeatherButton secondary class="single-graph-btn">Open</FeatherButton>
      </router-link>
      <FeatherTabContainer class="graph-data-tabs">
        <template v-slot:tabs>
          <FeatherTab>Graph</FeatherTab>
          <FeatherTab>Data</FeatherTab>
        </template>
        <FeatherTabPanel>
          <div class="panel-wrapper">
            <PersesPanel
              v-if="persesSpec"
              :title="persesSpec.title"
              :queries="persesSpec.queries"
              :y-axis-label="persesSpec.yAxisLabel"
              :series-overrides="persesSpec.seriesOverrides"
            />
            <div v-else class="panel-error">No graph data available</div>
          </div>
        </FeatherTabPanel>
        <FeatherTabPanel>
          <div class="panel-wrapper" v-if="rawGraphData">
            <GraphDataTable
              :id="`${label}-${definition}`"
              :convertedGraphData="legacyModel"
              :graphData="rawGraphData"
            />
          </div>
        </FeatherTabPanel>
      </FeatherTabContainer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import type { PropType } from 'vue'
import RrdGraphConverter from './utils/RrdGraphConverter.class'
import GraphDataTable from './GraphDataTable.vue'
import PersesPanel from '@/components/Perses/PersesPanel.vue'
import { useGraphStore } from '@/stores/graphStore'
import type { PersesGraphSpec, ConvertedGraphData, GraphMetricsResponse, PreFabGraph, StartEndTime } from '@/types'
import { FeatherButton } from '@featherds/button'
import {
  FeatherTab,
  FeatherTabContainer,
  FeatherTabPanel
} from '@featherds/tabs'

const props = defineProps({
  definition: { required: true, type: String },
  resourceId:  { required: true, type: String },
  time:        { required: true, type: Object as PropType<StartEndTime> },
  label:       { required: true, type: String },
  isSingleGraph: { required: true, type: Boolean }
})

const emit = defineEmits(['addGraphDefinition'])

const graphStore = useGraphStore()
const persesSpec  = ref<PersesGraphSpec | null>(null)
const rawGraphData = ref<GraphMetricsResponse | null>(null)
// Retain the legacy model for GraphDataTable (it expects ConvertedGraphData shape)
const legacyModel  = ref<ConvertedGraphData>({
  title: '', verticalLabel: '', series: [], values: [],
  metrics: [], printStatements: [], properties: {}
})

const render = async () => {
  const definitionData: PreFabGraph | null = await graphStore.getDefinitionData(props.definition)
  if (!definitionData) {
    emit('addGraphDefinition')
    return
  }

  try {
    const converter = new RrdGraphConverter({
      graphDef: definitionData,
      resourceId: props.resourceId
    })

    persesSpec.value = converter.toPersesGraphSpec()
    legacyModel.value = converter.model

    // Still fetch raw measurements for the Data tab
    const metrics = converter.model.metrics.map(m => ({
      aggregation: m.aggregation,
      attribute: m.attribute,
      label: m.name,
      resourceId: m.resourceId,
      transient: m.transient,
      expression: m.expression
    }))

    const start = (props.time.startTime as number) * 1000
    const end   = (props.time.endTime as number) * 1000
    const step  = Math.floor((end - start) / 1000)

    rawGraphData.value = await graphStore.getGraphMetrics({ start, end, step, source: metrics })
  } catch (error) {
    console.error('Could not render graph for', props.definition, error)
    emit('addGraphDefinition')
  }
}

watch(() => props.time, render)
onMounted(render)
</script>

<style scoped lang="scss">
.container {
  position: relative;
}
.panel-wrapper {
  height: 370px;
}
.graph-data-tabs {
  margin-top: 50px;
}
.single-graph-btn {
  position: absolute;
  top: 12px;
  right: 70px;
  z-index: 1;
}
.panel-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: var(--feather-disabled-text-on-surface);
}
</style>

<style lang="scss">
.graph-data-tabs {
  ul {
    margin-left: 37px !important;
  }
}
</style>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd ui && yarn vue-tsc --noEmit 2>&1 | grep -E "Graph\.vue|error" | head -20
```

Expected: no errors for `Graph.vue`

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/Resources/Graph.vue
git commit -m "feat(graph): replace Chart.js with PersesPanel in Graph.vue"
```

---

## Task 4: Delete Removed Files

**Files:**
- Delete: `ui/src/components/Resources/plugins/HtmlLegendPlugin.ts`
- Delete: `ui/src/components/Resources/utils/LegendFormatter.ts`

- [ ] **Step 1: Verify nothing else imports these files**

```bash
grep -rn "HtmlLegendPlugin\|LegendFormatter" ui/src/ --include="*.ts" --include="*.vue"
```

Expected: no results (Graph.vue was the only consumer)

- [ ] **Step 2: Delete the files**

```bash
rm ui/src/components/Resources/plugins/HtmlLegendPlugin.ts
rm ui/src/components/Resources/utils/LegendFormatter.ts
```

- [ ] **Step 3: Verify TypeScript still compiles**

```bash
cd ui && yarn vue-tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add -A ui/src/components/Resources/plugins/ \
           ui/src/components/Resources/utils/
git commit -m "chore(cleanup): remove HtmlLegendPlugin and LegendFormatter (replaced by Perses)"
```

---

## Task 5: Remove Chart.js Dependencies

**Files:**
- Modify: `ui/package.json`

- [ ] **Step 1: Verify nothing else uses chart.js**

```bash
grep -rn "chart\.js\|chartjs\|from 'chart" ui/src/ --include="*.ts" --include="*.vue" --include="*.tsx"
```

Expected: no results

- [ ] **Step 2: Remove from package.json**

In `ui/package.json` dependencies, remove:
```
"chart.js": "^3.9.1",
"chartjs-plugin-zoom": "^2.0.1",
```

- [ ] **Step 3: Install to update lockfile**

```bash
cd ui && yarn install
```

Expected: packages removed from lockfile

- [ ] **Step 4: Full build to confirm no broken imports**

```bash
cd ui && yarn build 2>&1 | tail -5
```

Expected: build completes with no errors

- [ ] **Step 5: Run all tests**

```bash
cd ui && yarn test
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add ui/package.json ui/yarn.lock
git commit -m "chore(deps): remove chart.js and chartjs-plugin-zoom"
```

---

## Phase 2 Complete

At this point:
- `RrdGraphConverter.toPersesGraphSpec()` converts prefab graph definitions to Perses panel specs
- `Graph.vue` renders all Resource Graphs via Perses `TimeSeriesChart` panels
- `HtmlLegendPlugin`, `LegendFormatter`, `chart.js`, `chartjs-plugin-zoom` are gone
- The Data tab still works (raw measurements still fetched for `GraphDataTable`)

Proceed to `2026-04-05-perses-phase3-dashboards.md`.
