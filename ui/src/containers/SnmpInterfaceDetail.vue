<template>
  <div class="snmp-iface-detail-page">
    <BreadCrumbs :items="breadcrumbs" />

    <template v-if="loading">
      <div class="snmp-iface-detail__skeleton headline3">Loading SNMP interface…</div>
    </template>

    <template v-else-if="error">
      <div class="snmp-iface-detail__error">
        <p class="headline4">Error</p>
        <p class="subtitle1">{{ error }}</p>
      </div>
    </template>

    <template v-else-if="snmpIface">
      <SnmpInterfaceHeader
        :snmpIface="snmpIface"
        :nodeLabel="nodeLabel"
        :nodeId="nodeId"
      />

      <div class="snmp-iface-detail__tab-wrap">
        <Tabs value="events">
          <TabList>
            <Tab value="events">Events</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="events">
              <EventsTable :nodeId="nodeId" :filterFiql="`ifIndex==${ifIndex}`" />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import SnmpInterfaceHeader from '@/components/SnmpInterfaceDetail/SnmpInterfaceHeader.vue'
import EventsTable from '@/components/Nodes/EventsTable.vue'
import { useMenuStore } from '@/stores/menuStore'
import { getNodeById, getNodeSnmpInterfaceByIfIndex } from '@/services/nodeService'
import { SnmpInterface, BreadCrumb, Node } from '@/types'

const route = useRoute()
const menuStore = useMenuStore()

const nodeId  = route.params.nodeId  as string
const ifIndex = route.params.ifIndex as string

const loading   = ref(true)
const error     = ref('')
const snmpIface = ref<SnmpInterface | null>(null)
const node      = ref<Node | null>(null)

const nodeLabel = computed(() => node.value?.label ?? nodeId)

const ifaceLabel = computed(() =>
  snmpIface.value?.ifDescr || snmpIface.value?.ifName || `ifIndex ${ifIndex}`
)

const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Nodes', to: '/nodes' },
  { label: nodeLabel.value, to: `/node/${nodeId}` },
  { label: `SNMP Interface: ${ifaceLabel.value}`, to: '#', position: 'last' }
])

onMounted(async () => {
  const [nodeResult, ifaceResult] = await Promise.all([
    getNodeById(nodeId),
    getNodeSnmpInterfaceByIfIndex(nodeId, ifIndex)
  ])

  if (!nodeResult) {
    error.value = 'Node not found'
  } else {
    node.value = nodeResult as Node
  }

  if (!ifaceResult) {
    const msg = 'SNMP interface not found'
    error.value = error.value ? `${error.value}; ${msg}` : msg
  } else {
    snmpIface.value = ifaceResult
  }

  loading.value = false
})
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.snmp-iface-detail-page {
  padding: 16px 20px;
}

.snmp-iface-detail {
  &__error {
    padding: 24px;
    text-align: center;
  }

  &__skeleton {
    padding: 16px;
  }

  &__tab-wrap {
    margin-top: 12px;
  }
}
</style>
