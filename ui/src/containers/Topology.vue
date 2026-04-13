<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>

  <div class="topology-page">
    <TopologyToolbar
      @save-layout="graphRef?.saveLayout()"
      @reset-layout="graphRef?.resetLayout()"
      @toggle-grid="graphRef?.toggleGrid()"
      @align-to-grid="graphRef?.alignToGrid()"
      @open-load-view="openLoadModal"
      @save-view="onSaveView"
      @save-new-view="showSaveModal = true"
    />
    <TopologyGraph ref="graphRef" @save-view="onSaveView" />

    <LoadViewModal
      :visible="showLoadModal"
      @close="showLoadModal = false"
      @load="onLoadView"
    />
    <SaveViewModal
      :visible="showSaveModal"
      @cancel="showSaveModal = false"
      @save="onSaveNewView"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import TopologyToolbar from '@/components/Topology/TopologyToolbar.vue'
import TopologyGraph from '@/components/Topology/TopologyGraph.vue'
import LoadViewModal from '@/components/Topology/LoadViewModal.vue'
import SaveViewModal from '@/components/Topology/SaveViewModal.vue'
import { useTopologyStore } from '@/stores/topologyStore'
import { useWeathermapStore } from '@/stores/weathermapStore'
import { useEdgeLabelStore } from '@/stores/edgeLabelStore'
import { useMenuStore } from '@/stores/menuStore'
import { useTopologyViewStore } from '@/stores/topologyViewStore'
import type { TopologyView, TopologyViewState } from '@/types/topology'
import { BreadCrumb } from '@/types'

const store     = useTopologyStore()
const wmStore   = useWeathermapStore()
const elStore   = useEdgeLabelStore()
const menuStore = useMenuStore()
const viewStore = useTopologyViewStore()

const graphRef = ref<InstanceType<typeof TopologyGraph> | null>(null)

const showLoadModal = ref(false)
const showSaveModal = ref(false)

const openLoadModal = async () => {
  await viewStore.fetchServerViews()
  showLoadModal.value = true
}

/** Capture current topology state into a TopologyViewState object. */
const captureViewState = (): TopologyViewState => {
  const layout: Record<string, { x: number; y: number }> = graphRef.value?.getPositions() ?? {}
  return {
    layers: [...store.activeLayers],
    filters: {
      surveillanceCategories: [...viewStore.filters.surveillanceCategories],
      cidrs: [...viewStore.filters.cidrs],
      namePattern: viewStore.filters.namePattern,
    },
    layout,
    suppressed: {
      vertices: viewStore.editMode
        ? [...viewStore.editPendingVertices]
        : [...viewStore.suppressedVertices],
      edges: viewStore.editMode
        ? [...viewStore.editPendingEdges]
        : [...viewStore.suppressedEdges],
    },
    edgeColorMode: elStore.colorMode,
    edgeLabels: {
      showUtilization: elStore.showUtilization,
      showLocalPort:   elStore.showLocalPort,
      showRemotePort:  elStore.showRemotePort,
      showIp:          elStore.showIp,
      showMac:         elStore.showMac,
      showSpeed:       elStore.showSpeed,
    }
  }
}

const onSaveView = async () => {
  if (!viewStore.activeView) return
  await viewStore.saveView(captureViewState())
}

const onSaveNewView = async (
  name: string,
  scope: 'private' | 'shared' | 'global',
  description: string
) => {
  showSaveModal.value = false
  await viewStore.saveNewView(name, scope, captureViewState(), description)
}

const onLoadView = (view: TopologyView) => {
  showLoadModal.value = false
  viewStore.applyView(view)
  // Apply layers
  store.activeLayers = [...view.state.layers]
  // Apply filters
  viewStore.filters.surveillanceCategories = [...view.state.filters.surveillanceCategories]
  viewStore.filters.cidrs                  = [...view.state.filters.cidrs]
  viewStore.filters.namePattern            = view.state.filters.namePattern
  // Apply edge settings
  elStore.colorMode       = view.state.edgeColorMode
  elStore.showUtilization = view.state.edgeLabels.showUtilization
  elStore.showLocalPort   = view.state.edgeLabels.showLocalPort
  elStore.showRemotePort  = view.state.edgeLabels.showRemotePort
  elStore.showIp          = view.state.edgeLabels.showIp
  elStore.showMac         = view.state.edgeLabels.showMac
  elStore.showSpeed       = view.state.edgeLabels.showSpeed
}

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl ?? '/opennms')
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Network Topology', to: '#', position: 'last' }
])

onMounted(async () => {
  await Promise.all([
    store.loadContainers(),
    store.loadAlarmSeverities(),
    store.loadUserDefinedLinks(),
    viewStore.fetchServerViews(),
  ])
  await wmStore.start(store.vertices, store.edges)
})

watch(() => store.edges, async (edges) => {
  await wmStore.start(store.vertices, edges)
}, { deep: false })

onBeforeUnmount(() => {
  wmStore.stop()
})
</script>

<style lang="scss" scoped>
.topology-page {
  display: flex;
  flex-direction: column;
  // 120px = FeatherAppLayout header (64px) + breadcrumb row (32px) + padding (24px)
  height: calc(100vh - 120px);
  overflow: hidden;
}
</style>
