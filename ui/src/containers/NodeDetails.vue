<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>

  <!-- Page controls: perspective toggle + view graphs shortcut -->
  <div class="feather-row">
    <div class="feather-col-12 node-detail__controls">
      <PerspectiveToggle />
      <button
        v-if="perspectiveStore.isProblems"
        class="node-detail__graphs-link"
        @click="perspectiveStore.setPerspective('all')"
      >View Graphs →</button>
    </div>
  </div>

  <!-- Full-page error if node not found -->
  <div v-if="nodeError && !nodeLoading" class="feather-row">
    <div class="feather-col-12 node-detail__error">
      <p class="headline4">Node not found</p>
      <p class="subtitle1">{{ nodeError }}</p>
    </div>
  </div>

  <template v-else>
    <!-- Header + admin bar -->
    <div class="feather-row">
      <div class="feather-col-12">
        <div v-if="nodeLoading" class="node-detail__skeleton headline3">Loading node…</div>
        <template v-else-if="node">
          <NodeHeader :node="node" />
          <AdminActionsBar
            :nodeId="id"
            :foreignSource="node.foreignSource"
          />
        </template>
      </div>
    </div>

    <!-- Info + categories — collapsible in problems mode -->
    <div v-if="node" class="feather-row">
      <div class="feather-col-12">
        <CollapsibleSection :title="infoSummary" :collapsed="perspectiveStore.isProblems">
          <div class="node-detail__info-row">
            <NodeInfoPanel :node="node" />
            <CategoryPanel :node="node" :isAdmin="adminRole" />
          </div>
        </CollapsibleSection>
      </div>
    </div>

    <!-- Availability -->
    <div class="feather-row">
      <div class="feather-col-12">
        <AvailabilityPanel
          :availability="availability"
          :chartData="chartData"
          :downSegmentMeta="downSegmentMeta"
          :loading="availLoading"
          :error="availError"
          :problemsOnly="perspectiveStore.isProblems"
        />
      </div>
    </div>

    <!-- Interfaces (NetworkTab) -->
    <div v-if="node" class="feather-row">
      <div class="feather-col-12 node-detail__card">
        <NetworkTab
          :nodeId="id"
          :nodeResourceKey="nodeResourceKey"
          :problemsOnly="perspectiveStore.isProblems"
          @go-graphs="perspectiveStore.setPerspective('all')"
          @go-activity="perspectiveStore.setPerspective('all')"
        />
      </div>
    </div>

    <!-- Alarms / Events / Outages -->
    <div v-if="node" class="feather-row">
      <div class="feather-col-12">
        <NodeActivityTab :nodeId="node.id" :nodeLabel="node.label" :defaultTab="defaultTab" />
      </div>
    </div>

    <!-- Resource Graphs — hidden in problems mode -->
    <div v-if="node && !perspectiveStore.isProblems" class="feather-row">
      <div class="feather-col-12">
        <ResourceGraphsPanel :nodeId="node.id" />
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import NodeHeader from '@/components/NodeDetail/NodeHeader.vue'
import AdminActionsBar from '@/components/NodeDetail/AdminActionsBar.vue'
import NodeInfoPanel from '@/components/NodeDetail/NodeInfoPanel.vue'
import CategoryPanel from '@/components/NodeDetail/CategoryPanel.vue'
import AvailabilityPanel from '@/components/NodeDetail/AvailabilityPanel.vue'
import NetworkTab from '@/components/NodeDetail/NetworkTab.vue'
import NodeActivityTab from '@/components/NodeDetail/NodeActivityTab.vue'
import ResourceGraphsPanel from '@/components/NodeDetail/ResourceGraphsPanel.vue'
import PerspectiveToggle from '@/components/Common/PerspectiveToggle.vue'
import CollapsibleSection from '@/components/Common/CollapsibleSection.vue'
import useNodeDetail from '@/composables/useNodeDetail'
import useNodeAvailability from '@/composables/useNodeAvailability'
import useRole from '@/composables/useRole'
import { usePerspectiveStore } from '@/stores/perspectiveStore'
import { useMenuStore } from '@/stores/menuStore'
import { BreadCrumb } from '@/types'

const route = useRoute()
const menuStore = useMenuStore()
const perspectiveStore = usePerspectiveStore()
const id = route.params.id as string
const defaultTab = computed(() => (route.query.tab as string) || 'alarms')

const { node, loading: nodeLoading, error: nodeError } = useNodeDetail(id)
const {
  availability, chartData, downSegmentMeta,
  loading: availLoading, error: availError
} = useNodeAvailability(id)
const { adminRole } = useRole()

const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Nodes', to: '/nodes' },
  { label: node.value?.label ?? id, to: '#', position: 'last' }
])

// Summary line shown as CollapsibleSection title in problems mode
const infoSummary = computed(() => {
  if (!node.value) return 'Node Information'
  const parts: string[] = []
  if (node.value.sysName) parts.push(node.value.sysName)
  else if (node.value.label) parts.push(node.value.label)
  if (node.value.sysLocation) parts.push(node.value.sysLocation)
  const catCount = node.value.categories?.length ?? 0
  if (catCount > 0) parts.push(`${catCount} ${catCount === 1 ? 'category' : 'categories'}`)
  return parts.join(' · ') || 'Node Information'
})

// nodeResourceKey for NetworkTab resource ID construction
const nodeResourceKey = computed(() => {
  if (!node.value) return id
  if (node.value.foreignSource && node.value.foreignId) {
    return `${node.value.foreignSource}:${node.value.foreignId}`
  }
  return id
})
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.node-detail {
  &__controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0 4px;
    padding-left: 15px;
    margin-bottom: 4px;
  }

  &__graphs-link {
    background: none;
    border: none;
    color: var($clickable-normal);
    cursor: pointer;
    font-size: 0.875rem;
    &:hover { text-decoration: underline; }
  }

  &__skeleton { padding: 16px; }
  &__error    { padding: 24px; text-align: center; }

  &__info-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 16px;

    @media (max-width: 700px) { grid-template-columns: 1fr; }
  }

  &__card {
    background: var($surface);
    border-radius: 4px;
    margin-bottom: 16px;
    padding: 16px;
  }
}

// Vertical breathing room between card rows on the node detail page.
// The Feather grid has horizontal gutter but no vertical gap by default.
.feather-row + .feather-row {
  margin-top: 12px;
}
</style>
