<template>
  <td :class="ipInfo.label ? 'pointer' : ''">
    <a
      v-tooltip.top="tooltipTitle"
      :href="computeNodeIpInterfaceLink(node.id, ipInfo.label)"
    >
      {{ ipInfo.label }}
    </a>
  </td>
</template>

<script setup lang="ts">
import { IpInterface, Node } from '@/types'
import { PropType } from 'vue'
import { IpInterfaceInfo } from '@/types'
import { useIpInterfaceQuery } from '@/components/Nodes/hooks/useIpInterfaceQuery'

const { getBestIpInterfaceForNode } = useIpInterfaceQuery()

const props = defineProps({
  computeNodeIpInterfaceLink: {
    required: true,
    type: Function as PropType<(nodeId: number | string, ipAddress: string) => string>
  },
  node: {
    required: true,
    type: Object as PropType<Node>
  },
  nodeToIpInterfaceMap: {
    required: true,
    type: Object as PropType<Map<string, IpInterface[]>>
  }
})

const ipInfo = computed<IpInterfaceInfo>(() => getBestIpInterfaceForNode(props.node.id, props.nodeToIpInterfaceMap))

const tooltipTitle = computed<string>(() => {
  const managed = ipInfo.value.managed ? 'Managed' : 'Unmanaged'
  const primary = ipInfo.value.primaryLabel

  return [managed, primary].join(', ')
})
</script>
