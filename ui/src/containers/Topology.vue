<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>

  <div class="topology-page">
    <TopologyToolbar
      ref="toolbarRef"
      @save-layout="graphRef?.saveLayout()"
      @reset-layout="graphRef?.resetLayout()"
      @toggle-grid="viewStore.toggleGridSnap()"
      @align-to-grid="graphRef?.alignToGrid()"
      @save-view-requested="handleSaveViewRequested"
      @restore-view="handleRestoreView"
    />
    <TopologyGraph ref="graphRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import TopologyToolbar from '@/components/Topology/TopologyToolbar.vue'
import TopologyGraph from '@/components/Topology/TopologyGraph.vue'
import { useTopologyStore } from '@/stores/topologyStore'
import { useWeathermapStore } from '@/stores/weathermapStore'
import { useMenuStore } from '@/stores/menuStore'
import { useTopologyViewStore } from '@/stores/topologyViewStore'
import { useAuthStore } from '@/stores/authStore'
import { createView, getGlobalView } from '@/services/topologyViewService'
import { BreadCrumb } from '@/types'
import { TopologyView } from '@/types/topology'

const store = useTopologyStore()
const wmStore = useWeathermapStore()
const menuStore = useMenuStore()
const viewStore = useTopologyViewStore()
const authStore = useAuthStore()

const graphRef = ref<InstanceType<typeof TopologyGraph> | null>(null)
const toolbarRef = ref<InstanceType<typeof TopologyToolbar> | null>(null)

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl ?? '/opennms')
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Network Topology', to: '#', position: 'last' }
])

const handleSaveViewRequested = async (opts: { name: string; description: string; scope: 'private' | 'user' | 'shared' | 'global' }) => {
  const positions = graphRef.value?.capturePositions() ?? {}
  const state = viewStore.captureCurrentState(store.activeLayers, positions)
  const now = new Date().toISOString()
  const view: TopologyView = {
    id: crypto.randomUUID(),
    name: opts.name,
    description: opts.description || undefined,
    scope: opts.scope,
    owner: authStore.whoAmI?.id ?? 'unknown',
    state,
    createdAt: now,
    updatedAt: now
  }
  if (view.scope === 'private') {
    viewStore.savePrivateView(view)
    viewStore.clearDirty()
  } else {
    try {
      await createView(view)
      viewStore.clearDirty()
      // Refresh the toolbar's server view lists so the new view appears immediately
      await toolbarRef.value?.refreshServerViews()
    } catch (e) {
      console.error('[topology] Failed to save view:', e)
      window.alert('Failed to save view. Please try again.')
    }
  }
}

const handleRestoreView = async (view: TopologyView) => {
  // Save positions to store BEFORE setActiveLayers so runLayout() picks them up via preset path
  if (Object.keys(view.state.nodePositions).length > 0) {
    const sorted = [...view.state.activeLayers].sort()
    const futureLayoutKey = `enlinkd-${sorted.join('+')}`
    viewStore.saveNodePositions(futureLayoutKey, view.state.nodePositions)
  }
  viewStore.applyViewState(view.state)
  await store.setActiveLayers(view.state.activeLayers)
  // Position restore happens via runLayout's preset path — graphRef.restorePositions no longer needed here
}

onMounted(async () => {
  await Promise.all([
    store.loadContainers(),
    store.loadAlarmSeverities(),
    store.loadUserDefinedLinks()
  ])
  // Start weathermap after topology has loaded vertices/edges
  await wmStore.start(store.vertices, store.edges)

  // Apply global default + personal filter defaults in parallel — don't block graph render
  Promise.all([
    getGlobalView().catch((e) => { console.warn('[topology] Could not fetch global view:', e); return null }),
    viewStore.loadFilterDefaults()
  ]).then(async ([globalView, filterDefaults]) => {
    if (globalView) {
      viewStore.applyViewState(globalView.state)

      // Apply activeLayers from the global view if they differ from defaults set by loadContainers
      const currentLayers = [...store.activeLayers].sort().join('+')
      const viewLayers = [...globalView.state.activeLayers].sort().join('+')
      if (currentLayers !== viewLayers) {
        await store.setActiveLayers(globalView.state.activeLayers)
      }

      // Only restore positions from global view if user has no local saved positions for this layout
      if (store.layoutKey && !viewStore.loadNodePositions(store.layoutKey)) {
        graphRef.value?.restorePositions(globalView.state.nodePositions)
      }
    }
    if (filterDefaults) {
      Object.assign(viewStore.filters, filterDefaults)
    }
    // clearDirty() again: applyViewState() clears dirty internally, but this covers the no-globalView path
    viewStore.clearDirty()
  }).catch((e) => {
    console.error('[topology] Failed to apply startup defaults:', e)
  })
})

// Re-start weathermap when topology layer selection changes
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
  height: calc(100vh - 120px);
  overflow: hidden;
}
</style>
