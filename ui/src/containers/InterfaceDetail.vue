<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>

  <template v-if="loading">
    <div class="feather-row">
      <div class="feather-col-12 iface-detail__skeleton headline3">Loading interface…</div>
    </div>
  </template>

  <template v-else-if="error">
    <div class="feather-row">
      <div class="feather-col-12 iface-detail__error">
        <p class="headline4">Error</p>
        <p class="subtitle1">{{ error }}</p>
      </div>
    </div>
  </template>

  <template v-else-if="iface">
    <div class="feather-row">
      <div class="feather-col-12">
        <InterfaceHeader
          :iface="iface"
          :nodeLabel="nodeLabel"
          @delete="handleDelete"
        />
      </div>
    </div>

    <div class="feather-row">
      <div class="feather-col-12 iface-detail__tab-wrap">
        <FeatherTabContainer v-model="activeTab">
          <template #tabs>
            <FeatherTab>Services</FeatherTab>
            <FeatherTab>Events</FeatherTab>
            <FeatherTab>Outages</FeatherTab>
          </template>

          <!-- Services -->
          <FeatherTabPanel>
            <ServicesTable :services="services" :loading="servicesLoading" />
          </FeatherTabPanel>

          <!-- Events -->
          <FeatherTabPanel>
            <EventsTable v-if="tabVisited[1]" :nodeId="nodeId" :filterFiql="`ipAddress==${ipAddress}`" />
          </FeatherTabPanel>

          <!-- Outages -->
          <FeatherTabPanel>
            <OutagesTable v-if="tabVisited[2]" :nodeId="nodeId" :filterFiql="outagesFiql" />
          </FeatherTabPanel>
        </FeatherTabContainer>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { FeatherTab, FeatherTabContainer, FeatherTabPanel } from '@featherds/tabs'
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

const activeTab = ref(0)
const tabVisited = reactive([true, false, false])

watch(activeTab, (idx) => {
  tabVisited[idx] = true
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
    if (result) {
      services.value = result.service
    }
    servicesLoading.value = false
  })
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.iface-detail {
  &__error {
    padding: 24px;
    text-align: center;
  }

  &__skeleton {
    padding: 16px;
  }

  &__tab-wrap {
    position: relative;
  }
}

.feather-row + .feather-row {
  margin-top: 12px;
}
</style>
