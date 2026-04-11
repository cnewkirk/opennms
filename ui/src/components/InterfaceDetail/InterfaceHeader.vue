<template>
  <div class="interface-header card">
    <div class="interface-header__primary">
      <div class="headline3">{{ iface.ipAddress }}</div>
      <div v-if="iface.hostName" class="subtitle1 interface-header__hostname">{{ iface.hostName }}</div>
      <div class="interface-header__badges">
        <span :class="['badge', managedClass]">{{ managedLabel }}</span>
        <span v-if="iface.snmpPrimary === 'P'" class="badge badge--primary">Primary SNMP</span>
        <span v-if="iface.isDown" class="badge badge--down">Down</span>
      </div>
    </div>

    <div class="interface-header__meta">
      <dl class="interface-header__grid">
        <dt>Node</dt>
        <dd><router-link :to="`/node/${iface.nodeId}`">{{ nodeLabel }}</router-link></dd>
        <template v-if="iface.snmpInterface">
          <dt>ifIndex</dt>
          <dd>
            <router-link :to="`/snmpinterface/${iface.nodeId}/${iface.snmpInterface.ifIndex}`">
              {{ iface.snmpInterface.ifIndex }}
            </router-link>
          </dd>
          <dt>ifDescr</dt>
          <dd>{{ iface.snmpInterface.ifDescr || 'N/A' }}</dd>
        </template>
      </dl>
    </div>

    <div class="interface-header__actions">
      <a
        v-if="responseTimeResourceId"
        :href="`/opennms/ui/index.html#/resource-graphs/graphs/${encodeURIComponent(nodeLabel)}/${encodeURIComponent('all')}/${encodeURIComponent(responseTimeResourceId)}`"
        class="btn btn-secondary btn-sm"
      >Response Time Graphs</a>
      <button
        v-if="isAdmin"
        class="btn btn-danger btn-sm"
        @click="$emit('delete')"
      >Delete Interface</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IpInterface } from '@/types'
import useRole from '@/composables/useRole'

const props = defineProps<{
  iface: IpInterface
  nodeLabel: string
}>()

defineEmits<{ delete: [] }>()

const { adminRole: isAdmin } = useRole()

const managedClass = computed(() => {
  if (props.iface.isManaged === 'M') return 'badge--managed'
  if (props.iface.isManaged === 'U') return 'badge--unmanaged'
  return 'badge--unknown'
})

const managedLabel = computed(() => {
  if (props.iface.isManaged === 'M') return 'Managed'
  if (props.iface.isManaged === 'U') return 'Unmanaged'
  return props.iface.isManaged ?? 'Unknown'
})

// Response time resource ID format: node[nodeId].responseTime[ip_with_underscores]
const responseTimeResourceId = computed(() => {
  if (!props.iface.nodeId || !props.iface.ipAddress) return null
  const safeIp = props.iface.ipAddress.replace(/\./g, '_')
  return `node[${props.iface.nodeId}].responseTime[${safeIp}]`
})
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.interface-header {
  padding: 16px 20px;
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 16px;
  align-items: start;

  &__hostname { color: var($secondary-text-on-surface); margin-top: 4px; }

  &__badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  &__grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    dt { font-weight: 600; color: var($secondary-text-on-surface); }
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  }
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;

  &--managed   { background: var($success); color: var($primary-text-on-color); }
  &--unmanaged { background: var($shade-4); color: var($primary-text-on-surface); }
  &--unknown   { background: var($shade-4); color: var($primary-text-on-surface); }
  &--primary   { background: var($primary); color: var($primary-text-on-color); }
  &--down      { background: var($error);   color: var($primary-text-on-color); }
}
</style>
