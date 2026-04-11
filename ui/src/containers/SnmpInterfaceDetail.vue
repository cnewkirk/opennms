<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>

  <template v-if="loading">
    <div class="feather-row">
      <div class="feather-col-12 snmp-iface-detail__skeleton headline3">Loading SNMP interface…</div>
    </div>
  </template>

  <template v-else-if="error">
    <div class="feather-row">
      <div class="feather-col-12 snmp-iface-detail__error">
        <p class="headline4">Error</p>
        <p class="subtitle1">{{ error }}</p>
      </div>
    </div>
  </template>

  <template v-else-if="snmpIface">
    <div class="feather-row">
      <div class="feather-col-12">
        <SnmpInterfaceHeader
          :snmpIface="snmpIface"
          :nodeLabel="nodeLabel"
          :nodeId="nodeId"
        />
      </div>
    </div>

    <div class="feather-row">
      <div class="feather-col-12 snmp-iface-detail__tab-wrap">
        <FeatherTabContainer v-model="activeTab">
          <template #tabs>
            <FeatherTab>Events</FeatherTab>
          </template>

          <!-- Events -->
          <FeatherTabPanel>
            <EventsTable
              v-if="tabVisited[0]"
              :nodeId="nodeId"
              :filterFiql="`ifIndex==${ifIndex}`"
            />
          </FeatherTabPanel>
        </FeatherTabContainer>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { FeatherTab, FeatherTabContainer, FeatherTabPanel } from '@featherds/tabs'
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

const activeTab  = ref(0)
const tabVisited = reactive([true])

watch(activeTab, (idx) => {
  tabVisited[idx] = true
})

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
@import "@featherds/styles/themes/variables";

.snmp-iface-detail {
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
