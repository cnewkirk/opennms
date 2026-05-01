<template>
  <Menu ref="menu" :model="menuItems" popup />
  <Button
    text
    severity="secondary"
    @click="(e: Event) => menu?.toggle(e)"
    class="node-actions-btn"
    aria-label="Node Actions"
  >
    <i class="pi pi-ellipsis-v node-actions-icon" />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import { PropType, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Node } from '@/types'
import { v2, rest } from '@/services/axiosInstances'
import useSnackbar from '@/composables/useSnackbar'

const props = defineProps({
  baseHref: {
    required: true,
    type: String
  },
  node: {
    required: true,
    type: Object as PropType<Node>
  },
  triggerNodeInfo: {
    required: true,
    type: Function as PropType<(node: Node) => void>
  }
})

const router = useRouter()
const menu = ref()
const { showSnackBar } = useSnackbar()

const linkItems = [
  { name: 'events', label: 'Events' },
  { name: 'alarms', label: 'Alarms' },
  { name: 'view-outages', label: 'Outages' },
  { name: 'assets', label: 'Assets' },
  { name: 'metadata', label: 'Metadata' },
  { name: 'hardware', label: 'Hardware Inventory' },
  { name: 'availability', label: 'Availability' },
  { name: 'graphs', label: 'Resource Graphs' },
  { name: 'rescan', label: 'Node Rescan' },
  { name: 'admin', label: 'Admin / Node Management' },
  { name: 'updateSnmp', label: 'Update SNMP Information' },
  { name: 'schedule-outage', label: 'Schedule an Outage' },
  { name: 'topology', label: 'View Topology Map' }
]

const menuItems = computed(() => [
  {
    label: 'Info...',
    command: () => props.triggerNodeInfo(props.node)
  },
  ...linkItems.map(item => ({
    label: item.label,
    command: () => onNodeLink(item.name, props.node)
  }))
])

const onNodeLink = (name: string, node: Node) => {
  if (name === 'graphs') {
    router.push(`/node/${node.id}`)
    return
  }
  if (name === 'events' || name === 'alarms' || name === 'view-outages') {
    const tab = name === 'view-outages' ? 'outages' : name
    router.push(`/node/${node.id}?tab=${tab}`)
    return
  }
  if (name === 'updateSnmp') {
    triggerSnmpReinit(node)
    return
  }
  const link = mapLink(name, node)
  window.location.assign(`${props.baseHref}${link}`)
}

const triggerSnmpReinit = async (node: Node) => {
  try {
    const resp = await v2.get(`/nodes/${node.id}/ipinterfaces`, { params: { _s: 'snmpPrimary==P', limit: 1 } })
    const ifaces = resp.data?.ipInterface ?? []
    const ip = ifaces.length > 0 ? ifaces[0].ipAddress : null
    await rest.post('/events', {
      uei: 'uei.opennms.org/nodes/reinitializePrimarySnmpInterface',
      nodeId: node.id,
      ...(ip ? { interface: ip } : {}),
      source: 'web ui',
      time: new Date().toISOString()
    }, { headers: { 'Content-Type': 'application/json' } })
    showSnackBar({ msg: 'SNMP information update triggered.' })
  } catch {
    showSnackBar({ msg: 'Failed to trigger SNMP update.', error: true })
  }
}

const mapLink = (name: string, node: Node) => {
  switch (name) {
    case 'events':
      return `event/list?filter=node%3D${node.id}`
    case 'alarms':
      return `alarm/list.htm?filter=node%3D${node.id}`
    case 'view-outages':
      return `outage/list.htm?filter=node%3D${node.id}`
    case 'assets':
      return `asset/modify.jsp?node=${node.id}`
    case 'metadata':
      return `element/node-metadata.jsp?node=${node.id}`
    case 'hardware':
      return `hardware/list.jsp?node=${node.id}`
    case 'availability':
      return `element/availability.jsp?node=${node.id}`
    case 'graphs':
      return `graph/chooseresource.jsp?node=${node.id}&reports=all`
    case 'rescan':
      return `element/rescan.jsp?node=${node.id}`
    case 'admin':
      return `admin/nodemanagement/index.jsp?node=${node.id}`
    case 'schedule-outage':
      return `admin/sched-outages/editoutage.jsp?newName=${node.label}&addNew=true&nodeID=${node.id}`
    case 'topology':
      return `topology?provider=Enhanced+Linkd&szl=1&focus-vertices=${node.id}`
    default: return ''
  }
}
</script>

<style lang="scss" scoped>
.node-actions-btn {
  padding: 0.25rem;
}
.node-actions-icon {
  font-size: 1.1rem;
}
</style>
