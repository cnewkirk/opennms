<template>
  <div class="iface-detail-page">
    <BreadCrumbs :items="breadcrumbs" />

    <template v-if="loading">
      <div class="iface-detail__skeleton headline3">Loading interface…</div>
    </template>

    <template v-else-if="error">
      <div class="iface-detail__error">
        <p class="headline4">Error</p>
        <p class="subtitle1">{{ error }}</p>
      </div>
    </template>

    <template v-else-if="iface">
      <InterfaceHeader
        :iface="iface"
        :nodeLabel="nodeLabel"
        @delete="handleDelete"
      />

      <div class="iface-detail__tab-wrap">
        <Tabs v-model:value="activeTab">
          <TabList>
            <Tab value="services">Services</Tab>
            <Tab value="events">Events</Tab>
            <Tab value="outages">Outages</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="services">
              <ServicesTable :services="services" :loading="servicesLoading" />
            </TabPanel>
            <TabPanel value="events">
              <EventsTable v-if="tabVisited.events" :nodeId="nodeId" :filterFiql="`ipAddress==${ipAddress}`" />
            </TabPanel>
            <TabPanel value="outages">
              <OutagesTable v-if="tabVisited.outages" :nodeId="nodeId" :filterFiql="outagesFiql" />
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
import InterfaceHeader from '@/components/InterfaceDetail/InterfaceHeader.vue'
import ServicesTable from '@/components/InterfaceDetail/ServicesTable.vue'
import EventsTable from '@/components/Nodes/EventsTable.vue'
import OutagesTable from '@/components/Nodes/OutagesTable.vue'
import { useMenuStore } from '@/stores/menuStore'
import useRole from '@/composables/useRole'
import { getNodeById, getNodeIpInterface, getNodeIpInterfaceServices, deleteNodeIpInterface } from '@/services/nodeService'
import { IpInterface, NodeIfService, BreadCrumb, Node } from '@/types'

const route = useRoute()
const router = useRouter()
const menuStore = useMenuStore()
const { adminRole } = useRole()

const nodeId = route.params.nodeId as string
const ipAddress = route.params.ipAddress as string

const loading = ref(true)
const error = ref('')
const iface = ref<IpInterface | null>(null)
const node = ref<Node | null>(null)
const services = ref<NodeIfService[]>([])
const servicesLoading = ref(true)

const activeTab = ref('services')
const tabVisited = reactive<Record<string, boolean>>({ services: true, events: false, outages: false })

watch(activeTab, (name) => {
  tabVisited[name] = true
})

const nodeLabel = computed(() => node.value?.label ?? nodeId)
const outagesFiql = computed(() => `ipInterface.ipAddress==${ipAddress}`)
const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Nodes', to: '/nodes' },
  { label: nodeLabel.value, to: `/node/${nodeId}` },
  { label: ipAddress, to: '#', position: 'last' }
])

const handleDelete = async () => {
  await deleteNodeIpInterface(nodeId, ipAddress)
  router.push('/node/' + nodeId)
}

onMounted(async () => {
  const [nodeResult, ifaceResult] = await Promise.all([
    getNodeById(nodeId),
    getNodeIpInterface(nodeId, ipAddress)
  ])

  if (!nodeResult) {
    error.value = 'Node not found'
  } else {
    node.value = nodeResult as Node
  }

  if (!ifaceResult) {
    error.value = error.value ? error.value + '; Interface not found' : 'Interface not found'
  } else {
    iface.value = ifaceResult
  }

  loading.value = false

  getNodeIpInterfaceServices(nodeId, ipAddress).then((result) => {
    if (result) services.value = result.service
    servicesLoading.value = false
  })
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.iface-detail-page {
  padding: 16px 20px;
}

.iface-detail {
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
