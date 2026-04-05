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
    />
    <TopologyGraph ref="graphRef" />
    <TopologyDetailPanel />
  </div>
</template>

<script setup lang="ts">
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import TopologyToolbar from '@/components/Topology/TopologyToolbar.vue'
import TopologyGraph from '@/components/Topology/TopologyGraph.vue'
import TopologyDetailPanel from '@/components/Topology/TopologyDetailPanel.vue'
import { useTopologyStore } from '@/stores/topologyStore'
import { useMenuStore } from '@/stores/menuStore'
import { BreadCrumb } from '@/types'

const store = useTopologyStore()
const menuStore = useMenuStore()

const graphRef = ref<InstanceType<typeof TopologyGraph> | null>(null)

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl ?? '/opennms')
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Network Topology', to: '#', position: 'last' }
])

onMounted(async () => {
  await Promise.all([
    store.loadContainers(),
    store.loadAlarmSeverities()
  ])
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
