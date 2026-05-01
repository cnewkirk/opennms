<template>
  <div
    v-if="hasIngressFlow(node) || hasEgressFlow(node)"
    v-tooltip.top="flowTooltipTitle(node)"
    class="pointer"
  >
    <i v-if="hasIngressFlow(node)" class="pi pi-arrow-left flow-icon" />
    <br v-if="hasIngressFlow(node) && hasEgressFlow(node)" style="height: 40px" />
    <i v-if="hasEgressFlow(node)" class="pi pi-arrow-right flow-icon egress" />
  </div>
</template>

<script setup lang="ts">
import { PropType } from 'vue'
import { hasIngressFlow, hasEgressFlow } from './utils'
import { Node } from '@/types'

defineProps({
  node: {
    required: true,
    type: Object as PropType<Node>
  }
})

const flowTooltipTitle = (node: Node) => {
  if (hasIngressFlow(node) && hasEgressFlow(node)) {
    return 'Has Ingress/Egress Flows'
  } else if (hasIngressFlow(node)) {
    return 'Has Ingress Flows'
  } else if (hasEgressFlow(node)) {
    return 'Has Egress Flows'
  }

  return ''
}
</script>

<style lang="scss" scoped>
.flow-icon {
  font-size: 1.5em;
}
</style>
