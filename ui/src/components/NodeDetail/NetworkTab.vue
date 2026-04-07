<template>
  <div class="network-tab">
    <div v-if="loading" class="network-tab__loading caption">Loading interfaces…</div>
    <div v-else-if="!endpoints.length" class="network-tab__empty caption">No interfaces found.</div>
    <ClearSummary
      v-else-if="props.problemsOnly && allUp && !showAll"
      :message="`All ${endpoints.length} interfaces up`"
      :expandable="true"
      @expand="showAll = true"
    />
    <table v-else class="network-table">
      <thead>
        <tr>
          <th class="network-table__expand-col"></th>
          <th>Name</th>
          <th>Address</th>
          <th>Speed</th>
          <th>Status</th>
          <th>Services</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="ep in displayedEndpoints" :key="ep.key">
          <!-- Main row -->
          <tr
            class="network-table__row"
            :class="{ 'network-table__row--down': ep.isDown }"
            @click="toggle(ep.key)"
          >
            <td class="network-table__expand-col">
              <span class="network-table__chevron" :class="{ 'network-table__chevron--open': expanded[ep.key] }">&#9654;</span>
            </td>
            <td>
              <div class="network-table__name">{{ ep.displayName }}</div>
              <div v-if="ep.alias" class="network-table__alias caption">{{ ep.alias }}</div>
            </td>
            <td>
              <span class="network-table__ip">{{ ep.ipAddress || '—' }}</span>
              <span v-if="ep.hostname && ep.hostname !== ep.ipAddress" class="network-table__host caption">{{ ep.hostname }}</span>
            </td>
            <td>{{ ep.speed || '—' }}</td>
            <td>
              <span class="status-dot" :class="ep.isDown ? 'status-dot--down' : 'status-dot--up'"></span>
              {{ ep.statusLabel }}
            </td>
            <td>{{ ep.serviceCount > 0 ? ep.serviceCount : '—' }}</td>
          </tr>

          <!-- Expanded detail -->
          <tr v-if="expanded[ep.key]" class="network-table__detail">
            <td></td>
            <td colspan="5">
              <div class="detail-panel">
                <!-- SNMP details -->
                <div v-if="ep.hasSnmp" class="detail-panel__section">
                  <div class="detail-panel__heading caption">Interface Details</div>
                  <dl class="detail-panel__props">
                    <template v-if="ep.ifIndex"><dt>ifIndex</dt><dd>{{ ep.ifIndex }}</dd></template>
                    <template v-if="ep.ifDescr"><dt>ifDescr</dt><dd>{{ ep.ifDescr }}</dd></template>
                    <template v-if="ep.ifType"><dt>ifType</dt><dd>{{ ep.ifType }}</dd></template>
                    <template v-if="ep.adminStatus"><dt>Admin</dt><dd>{{ ep.adminStatus }}</dd></template>
                    <template v-if="ep.operStatus"><dt>Oper</dt><dd>{{ ep.operStatus }}</dd></template>
                    <dt>Collection</dt><dd>{{ ep.collecting ? 'Enabled' : 'Disabled' }}</dd>
                  </dl>
                </div>

                <!-- Services -->
                <div v-if="ep.services.length" class="detail-panel__section">
                  <div class="detail-panel__heading caption">Monitored Services</div>
                  <div class="detail-panel__services">
                    <span
                      v-for="svc in ep.services"
                      :key="svc.name"
                      class="svc-chip"
                      :class="svc.isDown ? 'svc-chip--down' : 'svc-chip--up'"
                    >{{ svc.name }}</span>
                  </div>
                </div>

                <!-- Drill-down links -->
                <div class="detail-panel__actions">
                  <button
                    v-if="ep.snmpResourceId"
                    class="detail-panel__link"
                    @click="emit('go-graphs')"
                  >Interface Metrics</button>
                  <button
                    v-if="ep.ipAddress"
                    class="detail-panel__link"
                    @click="emit('go-graphs')"
                  >Response Time</button>
                  <button
                    v-if="ep.ipAddress"
                    class="detail-panel__link"
                    @click="emit('go-activity', ep.ipAddress)"
                  >Event History</button>
                </div>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { getNodeIpInterfaces, getNodeSnmpInterfaces } from '@/services/nodeService'
import type { IpInterface, SnmpInterface } from '@/types'
import ClearSummary from '@/components/Common/ClearSummary.vue'

const props = defineProps<{
  nodeId: string
  /** foreignSource:foreignId or just numeric ID — needed for building resource IDs */
  nodeResourceKey: string
  problemsOnly?: boolean
}>()

const emit = defineEmits<{
  'go-activity': [ipAddress: string]
  'go-graphs': []
}>()

interface ServiceInfo { name: string; isDown: boolean }

interface Endpoint {
  key: string
  displayName: string
  alias: string
  ipAddress: string
  hostname: string
  speed: string
  isDown: boolean
  statusLabel: string
  serviceCount: number
  services: ServiceInfo[]
  hasSnmp: boolean
  ifIndex: number | null
  ifDescr: string
  ifType: number | null
  adminStatus: string
  operStatus: string
  collecting: boolean
  snmpResourceId: string
  responseTimeResourceId: string
}

const loading = ref(true)
const endpoints = ref<Endpoint[]>([])
const expanded = reactive<Record<string, boolean>>({})

const showAll = ref(false)

const allUp = computed(() => endpoints.value.every(ep => !ep.isDown))

const displayedEndpoints = computed(() => {
  if (props.problemsOnly && !showAll.value) {
    return endpoints.value.filter(ep => ep.isDown)
  }
  return endpoints.value
})

const toggle = (key: string) => { expanded[key] = !expanded[key] }

const formatSpeed = (bps: number | null | undefined): string => {
  if (!bps || bps <= 0) return ''
  if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(bps % 1_000_000_000 === 0 ? 0 : 1)} Gbps`
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(0)} Mbps`
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} Kbps`
  return `${bps} bps`
}

const adminStatusLabel = (v: number) => ({ 1: 'Up', 2: 'Down', 3: 'Testing' }[v] || `${v}`)
const operStatusLabel = (v: number) => ({ 1: 'Up', 2: 'Down', 3: 'Testing', 4: 'Unknown', 5: 'Dormant', 6: 'Not Present', 7: 'Lower Layer Down' }[v] || `${v}`)

const buildSnmpResourceId = (ifName: string, physAddr: string | null): string => {
  const suffix = physAddr ? `${ifName}-${physAddr}` : ifName
  return `node[${props.nodeResourceKey}].interfaceSnmp[${suffix}]`
}

const buildResponseTimeResourceId = (ipAddress: string): string => {
  return `node[${props.nodeResourceKey}].responseTime[${ipAddress}]`
}

const fetchServices = async (ipAddress: string): Promise<ServiceInfo[]> => {
  try {
    const resp = await fetch(`/opennms/api/v2/nodes/${props.nodeId}/ipinterfaces/${ipAddress}/services`, {
      headers: { Accept: 'application/json' }
    })
    if (!resp.ok) return []
    const data = await resp.json()
    return (data.service ?? []).map((s: any) => ({
      name: s.serviceType?.name ?? 'Unknown',
      isDown: s.isDown === true || s.status !== 'A'
    }))
  } catch { return [] }
}

onMounted(async () => {
  // Fetch IP interfaces (includes nested SNMP data) and standalone SNMP interfaces
  const [ipResp, snmpResp] = await Promise.all([
    getNodeIpInterfaces(props.nodeId, { limit: 500, offset: 0, _s: 'isManaged==U,isManaged==P,isManaged==N,isManaged==M' }),
    getNodeSnmpInterfaces(props.nodeId, { limit: 500, offset: 0 })
  ])

  const ipInterfaces: IpInterface[] = ipResp ? ipResp.ipInterface : []
  const snmpInterfaces: SnmpInterface[] = snmpResp ? snmpResp.snmpInterface : []

  // Index SNMP interfaces by ifIndex for merging
  const snmpByIfIndex = new Map<number, SnmpInterface>()
  for (const s of snmpInterfaces) {
    snmpByIfIndex.set(s.ifIndex, s)
  }

  // Track which SNMP ifIndexes are covered by IP interfaces
  const coveredIfIndexes = new Set<number>()

  const results: Endpoint[] = []

  // Build endpoints from IP interfaces (primary source)
  for (const ip of ipInterfaces) {
    const snmp = ip.snmpInterface || (ip.ifIndex ? snmpByIfIndex.get(Number(ip.ifIndex)) : null)
    const ifIdx = snmp?.ifIndex ?? (ip.ifIndex ? Number(ip.ifIndex) : null)
    if (ifIdx) coveredIfIndexes.add(ifIdx)

    const hasSnmp = !!snmp
    const displayName = snmp?.ifName || snmp?.ifDescr || ip.ipAddress
    const ipDown = ip.isDown === true

    results.push({
      key: `ip-${ip.id}`,
      displayName,
      alias: snmp?.ifAlias || '',
      ipAddress: ip.ipAddress,
      hostname: ip.hostName || '',
      speed: formatSpeed(snmp?.ifSpeed),
      isDown: ipDown || (snmp ? snmp.ifOperStatus !== 1 : false),
      statusLabel: ipDown ? 'Down' : (snmp ? operStatusLabel(snmp.ifOperStatus) : 'Managed'),
      serviceCount: ip.monitoredServiceCount ?? 0,
      services: [], // loaded on expand
      hasSnmp,
      ifIndex: ifIdx,
      ifDescr: snmp?.ifDescr || '',
      ifType: snmp?.ifType ?? null,
      adminStatus: snmp ? adminStatusLabel(snmp.ifAdminStatus) : '',
      operStatus: snmp ? operStatusLabel(snmp.ifOperStatus) : '',
      collecting: snmp?.collect === true,
      snmpResourceId: hasSnmp ? buildSnmpResourceId(snmp!.ifName || snmp!.ifDescr || '', snmp?.physAddr ?? null) : '',
      responseTimeResourceId: ip.ipAddress ? buildResponseTimeResourceId(ip.ipAddress) : ''
    })
  }

  // Add SNMP-only interfaces (no IP address)
  for (const snmp of snmpInterfaces) {
    if (coveredIfIndexes.has(snmp.ifIndex)) continue

    results.push({
      key: `snmp-${snmp.id}`,
      displayName: snmp.ifName || snmp.ifDescr || `ifIndex ${snmp.ifIndex}`,
      alias: snmp.ifAlias || '',
      ipAddress: '',
      hostname: '',
      speed: formatSpeed(snmp.ifSpeed),
      isDown: snmp.ifOperStatus !== 1,
      statusLabel: operStatusLabel(snmp.ifOperStatus),
      serviceCount: 0,
      services: [],
      hasSnmp: true,
      ifIndex: snmp.ifIndex,
      ifDescr: snmp.ifDescr || '',
      ifType: snmp.ifType ?? null,
      adminStatus: adminStatusLabel(snmp.ifAdminStatus),
      operStatus: operStatusLabel(snmp.ifOperStatus),
      collecting: snmp.collect === true,
      snmpResourceId: buildSnmpResourceId(snmp.ifName || snmp.ifDescr || '', snmp?.physAddr ?? null),
      responseTimeResourceId: ''
    })
  }

  // Sort: primary interface first, then by name
  results.sort((a, b) => {
    const aIsPrimary = ipInterfaces.find(ip => ip.id === a.key.replace('ip-', ''))?.snmpPrimary === 'P'
    const bIsPrimary = ipInterfaces.find(ip => ip.id === b.key.replace('ip-', ''))?.snmpPrimary === 'P'
    if (aIsPrimary && !bIsPrimary) return -1
    if (!aIsPrimary && bIsPrimary) return 1
    return a.displayName.localeCompare(b.displayName)
  })

  endpoints.value = results
  loading.value = false

  // Auto-expand problem rows; green rows stay collapsed by default
  for (const ep of results) {
    if (ep.isDown) expanded[ep.key] = true
  }

  // Lazy-load services for each IP endpoint
  for (const ep of results) {
    if (ep.ipAddress) {
      fetchServices(ep.ipAddress).then(svcs => { ep.services = svcs })
    }
  }
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use '@featherds/styles/themes/variables' as fvars;
@use '@featherds/styles/themes/utils';
@import "@featherds/styles/themes/variables";
@import "@featherds/table/scss/table";

.network-tab {
  padding: 8px 0;

  &__loading, &__empty {
    padding: 24px;
    text-align: center;
    color: var($secondary-text-on-surface);
  }
}

.network-table {
  @include table();
  width: 100%;

  &__expand-col { width: 28px; padding: 0 4px !important; }

  &__chevron {
    display: inline-block;
    font-size: 0.6rem;
    color: var($secondary-text-on-surface);
    transition: transform 0.15s;
    &--open { transform: rotate(90deg); }
  }

  &__row {
    cursor: pointer;
    &:hover td { background: var($shade-4); }
    &--down td { background: utils.alpha(fvars.$error, 0.06); }
  }

  &__name { font-weight: 500; }
  &__alias { color: var($secondary-text-on-surface); margin-top: 1px; }

  &__ip { font-family: monospace; font-size: 0.85rem; }
  &__host { display: block; color: var($secondary-text-on-surface); }

  &__detail td {
    padding-top: 0 !important;
    padding-bottom: 12px !important;
    border-top: none !important;
  }
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;

  &--up { background: var(--feather-success); }
  &--down { background: var(--feather-error); }
}

.detail-panel {
  padding: 8px 0 4px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__heading {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var($secondary-text-on-surface);
    margin-bottom: 4px;
  }

  &__props {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 2px 14px;
    margin: 0;
    font-size: 0.85rem;
    dt { color: var($secondary-text-on-surface); white-space: nowrap; }
    dd { margin: 0; }
  }

  &__services {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    padding-top: 4px;
  }

  &__link {
    color: var($clickable-normal);
    text-decoration: none;
    font-size: 0.85rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    &:hover { text-decoration: underline; }
  }
}

.svc-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: vars.$border-radius-xs;
  font-size: 0.8rem;
  font-weight: 500;

  &--up {
    background: utils.alpha(fvars.$success, 0.1);
    border: 1px solid utils.alpha(fvars.$success, 0.3);
  }
  &--down {
    background: utils.alpha(fvars.$error, 0.1);
    border: 1px solid utils.alpha(fvars.$error, 0.3);
  }
}
</style>
