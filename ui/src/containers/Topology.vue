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
      @save-view-requested="onSaveView"
      @restore-view="onRestoreView"
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
import { BreadCrumb } from '@/types'
import type { TopologyView } from '@/types/topology'

const store = useTopologyStore()
const wmStore = useWeathermapStore()
const menuStore = useMenuStore()
const viewStore = useTopologyViewStore()

const graphRef = ref<InstanceType<typeof TopologyGraph> | null>(null)

const onSaveView = (_opts: { name: string; description: string; scope: 'private' | 'user' | 'shared' | 'global' }) => {
  // TODO: server-side save wired up in a future task
}

const onRestoreView = async (view: TopologyView) => {
  viewStore.applyView(view)
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
    store.loadUserDefinedLinks()
  ])
  // Start weathermap after topology has loaded vertices/edges
  await wmStore.start(store.vertices, store.edges)
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
  // 120px = FeatherAppLayout header (64px) + breadcrumb row (32px) + padding (24px)
  height: calc(100vh - 120px);
  overflow: hidden;
}
</style>
