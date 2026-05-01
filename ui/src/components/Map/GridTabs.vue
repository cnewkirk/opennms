<template>
  <Tabs :value="activeTab" class="tabs">
    <TabList>
      <Tab value="alarms" @click="goToAlarms">Alarms({{ alarms.length }})</Tab>
      <Tab value="nodes" @click="goToNodes">Nodes({{ nodes.length }})</Tab>
    </TabList>
  </Tabs>
  <router-view />
</template>
<script setup lang="ts">
import { useMapStore } from '@/stores/mapStore'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import { Alarm, Node } from '@/types'

const mapStore = useMapStore()
const router = useRouter()
const route = useRoute()
const nodes = computed<Node[]>(() => mapStore.getNodes())
const alarms = computed<Alarm[]>(() => mapStore.getAlarms())

const activeTab = computed(() =>
  router.currentRoute.value.name === 'MapAlarms' ? 'alarms' : 'nodes'
)

const goToAlarms = () => router.push(`/map${route.query.nodeid ? '?nodeid=' + route.query.nodeid : ''}`)
const goToNodes = () => router.push('/map/nodes')
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
.tabs {
  z-index: 2;
  padding-bottom: 10px;
  margin-bottom: -29px;
  background: var($surface);
}
</style>
