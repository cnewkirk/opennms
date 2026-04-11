<template>
  <div class="snmp-interface-header card">
    <div class="snmp-interface-header__primary">
      <div class="headline3">{{ iface.ifDescr || iface.ifName || `ifIndex ${iface.ifIndex}` }}</div>
      <div v-if="iface.ifName && iface.ifName !== iface.ifDescr" class="subtitle1 snmp-interface-header__ifname">
        {{ iface.ifName }}
      </div>
      <div v-if="iface.ifAlias" class="subtitle2 snmp-interface-header__ifalias">{{ iface.ifAlias }}</div>
      <div class="snmp-interface-header__badges">
        <span :class="['badge', adminStatusClass]">Admin: {{ adminStatusLabel }}</span>
        <span :class="['badge', operStatusClass]">Oper: {{ operStatusLabel }}</span>
      </div>
    </div>

    <div class="snmp-interface-header__meta">
      <dl class="snmp-interface-header__grid">
        <dt>Node</dt>
        <dd><router-link :to="`/node/${nodeId}`">{{ nodeLabel }}</router-link></dd>
        <dt>ifIndex</dt>
        <dd>{{ iface.ifIndex }}</dd>
        <dt>Interface Type</dt>
        <dd>{{ iface.ifType || 'N/A' }}</dd>
        <dt>Speed</dt>
        <dd>{{ formatSpeed(iface.ifSpeed) }}</dd>
        <dt>Physical Address</dt>
        <dd>{{ physAddr }}</dd>
      </dl>
    </div>

    <div class="snmp-interface-header__actions">
      <router-link
        :to="graphsRoute"
        class="btn btn-secondary btn-sm"
      >SNMP Interface Data Graphs</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SnmpInterface } from '@/types'

const props = defineProps<{
  snmpIface: SnmpInterface
  nodeLabel: string
  nodeId: string
}>()

// Alias for brevity in template
const iface = computed(() => props.snmpIface)

const statusMap: Record<number, { label: string; cls: string }> = {
  1: { label: 'Up',              cls: 'badge--up' },
  2: { label: 'Down',            cls: 'badge--down' },
  3: { label: 'Testing',         cls: 'badge--testing' },
  4: { label: 'Unknown',         cls: 'badge--unknown' },
  5: { label: 'Dormant',         cls: 'badge--unknown' },
  6: { label: 'Not Present',     cls: 'badge--down' },
  7: { label: 'Lower Layer Down', cls: 'badge--down' }
}

const adminStatusLabel = computed(() => statusMap[props.snmpIface.ifAdminStatus]?.label ?? 'Unknown')
const adminStatusClass = computed(() => statusMap[props.snmpIface.ifAdminStatus]?.cls ?? 'badge--unknown')
const operStatusLabel  = computed(() => statusMap[props.snmpIface.ifOperStatus]?.label ?? 'Unknown')
const operStatusClass  = computed(() => statusMap[props.snmpIface.ifOperStatus]?.cls ?? 'badge--unknown')

const physAddr = computed(() => {
  const addr = props.snmpIface.physAddr
  if (!addr || addr === '000000000000') return 'N/A'
  return addr
})

const formatSpeed = (speed: number | null) => {
  if (!speed) return 'Unknown'
  if (speed >= 1_000_000_000) return `${(speed / 1_000_000_000).toFixed(1)} Gbps`
  if (speed >= 1_000_000)     return `${(speed / 1_000_000).toFixed(0)} Mbps`
  if (speed >= 1_000)         return `${(speed / 1_000).toFixed(0)} Kbps`
  return `${speed} bps`
}

const graphsRoute = computed(() => {
  const ifLabel = props.snmpIface.ifName || props.snmpIface.ifDescr || String(props.snmpIface.ifIndex)
  const resourceId = `node[${props.nodeId}].interfaceSnmp[${ifLabel}]`
  const label = props.snmpIface.ifDescr || ifLabel
  return `/resource-graphs/graphs?resourceId=${encodeURIComponent(resourceId)}&label=${encodeURIComponent(label)}`
})
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.snmp-interface-header {
  padding: 16px 20px;
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 16px;
  align-items: start;
  border-radius: 4px;

  &__ifname  { color: var($secondary-text-on-surface); margin-top: 4px; }
  &__ifalias { color: var($secondary-text-on-surface); margin-top: 2px; font-style: italic; }

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

  &--up      { background: var($success); color: var($primary-text-on-color); }
  &--down    { background: var($error);   color: var($primary-text-on-color); }
  &--testing { background: var($warning); color: var($primary-text-on-surface); }
  &--unknown { background: var($shade-4); color: var($primary-text-on-surface); }
}
</style>
