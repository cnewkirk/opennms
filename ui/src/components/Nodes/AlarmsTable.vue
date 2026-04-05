<template>
  <div class="card">
    <div class="feather-row alarms-table__header">
      <div class="feather-col-12 headline3">Alarms</div>
    </div>

    <!-- Toggle controls -->
    <div class="alarms-table__toggles">
      <label class="alarms-table__toggle">
        <input type="checkbox" v-model="showEnlinkd" />
        <span>Adjacent nodes (EnLinkd)</span>
      </label>
      <label class="alarms-table__toggle">
        <input type="checkbox" v-model="showIfAlias" />
        <span>ifAlias-referenced nodes</span>
      </label>
      <span v-if="relatedLoading" class="alarms-table__related-loading caption">Searching…</span>
    </div>

    <!-- Alarm table -->
    <div class="feather-row">
      <div class="feather-col-12">
        <table class="tl1 tl2 tl3 tl4 tl5" summary="Node Alarms">
          <thead>
            <tr>
              <th scope="col">Severity</th>
              <th scope="col">Node</th>
              <th scope="col">Count</th>
              <th scope="col">Last Event</th>
              <th scope="col">Message</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="alarm in alarms"
              :key="alarm.id"
              :class="rowClass(alarm)"
            >
              <td>
                <SeverityBadge :severity="alarm.severity" />
              </td>
              <td>
                <span v-if="alarm.nodeId !== numericNodeId" class="alarms-table__related-badge" title="Alarm from a related node">
                  ↗
                </span>
                <router-link :to="`/node/${alarm.nodeId}`">{{ alarm.nodeLabel }}</router-link>
              </td>
              <td>{{ alarm.count }}</td>
              <td v-date>{{ alarm.lastEventTime }}</td>
              <td>
                <router-link :to="`/alarm/${alarm.id}`">
                  <span v-html="alarm.logMessage" class="log-message" />
                </router-link>
              </td>
            </tr>
            <tr v-if="alarms.length === 0 && !loading">
              <td colspan="5" class="alarms-table__empty caption">No alarms found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Pagination
      :parameters="queryParameters"
      @update-query-parameters="updateQueryParameters"
      :query="fetchAlarms"
      :getTotalCount="getTotalCount"
    />
  </div>
</template>

<script setup lang="ts">
import Pagination from '../Common/Pagination.vue'
import SeverityBadge from '../Common/SeverityBadge.vue'
import { getAlarms } from '@/services/alarmService'
import { getNodes, getNodeSnmpInterfaces } from '@/services/nodeService'
import { getNodeEnlinkd, extractNodeId } from '@/services/enlinkdService'
import useQueryParameters from '@/composables/useQueryParams'
import { Alarm, QueryParameters, Node } from '@/types'

const props = defineProps<{ nodeId: string; nodeLabel: string }>()

const numericNodeId = computed(() => Number(props.nodeId))

// Toggles — persisted to localStorage per node
const storageKey = computed(() => `alarms-table-opts:${props.nodeId}`)
const storedOpts = () => {
  try { return JSON.parse(localStorage.getItem(storageKey.value) || '{}') } catch { return {} }
}
const showEnlinkd = ref<boolean>(storedOpts().showEnlinkd ?? false)
const showIfAlias = ref<boolean>(storedOpts().showIfAlias ?? false)

watch([showEnlinkd, showIfAlias], () => {
  localStorage.setItem(storageKey.value, JSON.stringify({
    showEnlinkd: showEnlinkd.value,
    showIfAlias: showIfAlias.value
  }))
})

// Related node IDs resolved from toggles
const enlinkdNodeIds = ref<number[]>([])
const ifAliasNodeIds = ref<number[]>([])
const relatedLoading = ref(false)

const relatedNodeIds = computed<number[]>(() => {
  const ids = new Set<number>()
  if (showEnlinkd.value) enlinkdNodeIds.value.forEach(id => ids.add(id))
  if (showIfAlias.value) ifAliasNodeIds.value.forEach(id => ids.add(id))
  ids.delete(numericNodeId.value) // never include self
  return Array.from(ids)
})

// EnLinkd adjacent node lookup
const loadEnlinkdNodes = async () => {
  const data = await getNodeEnlinkd(numericNodeId.value)
  if (!data) return
  const ids = new Set<number>()
  const addFromUrl = (url: string | undefined) => {
    if (!url) return
    const id = extractNodeId(url)
    if (id) ids.add(Number(id))
  }
  data.lldpLinkNodes.forEach(l => addFromUrl(l.lldpRemChassisIdUrl))
  data.ospfLinkNodes.forEach(l => addFromUrl(l.ospfRemRouterUrl))
  data.isisLinkNodes.forEach(l => addFromUrl(l.isisISAdjUrl))
  enlinkdNodeIds.value = Array.from(ids)
}

// ifAlias lookup — fetches all nodes, checks snmpInterfaces for matching ifAlias
const loadIfAliasNodes = async () => {
  const nodesResp = await getNodes({ limit: 500, offset: 0 })
  if (!nodesResp) return
  const nodeList = nodesResp.node ?? []
  const label = props.nodeLabel.toLowerCase()
  const ids = new Set<number>()

  await Promise.all(
    nodeList
      .filter((n: Node) => String(n.id) !== props.nodeId)
      .map(async (n: Node) => {
        const ifacesResp = await getNodeSnmpInterfaces(String(n.id), { limit: 100, offset: 0 })
        if (!ifacesResp) return
        const matches = ifacesResp.snmpInterface.some(
          iface => iface.ifAlias && String(iface.ifAlias).toLowerCase().includes(label)
        )
        if (matches) ids.add(Number(n.id))
      })
  )
  ifAliasNodeIds.value = Array.from(ids)
}

watch(showEnlinkd, async (on) => {
  if (on && enlinkdNodeIds.value.length === 0) {
    relatedLoading.value = true
    await loadEnlinkdNodes()
    relatedLoading.value = false
  }
}, { immediate: true })

watch(showIfAlias, async (on) => {
  if (on && ifAliasNodeIds.value.length === 0) {
    relatedLoading.value = true
    await loadIfAliasNodes()
    relatedLoading.value = false
  }
}, { immediate: true })

// Alarm data
const loading = ref(false)
const alarms = ref<Alarm[]>([])
const totalCount = ref(0)

const buildFiql = () => {
  const ids = [numericNodeId.value, ...relatedNodeIds.value]
  return ids.map(id => `node.id==${id}`).join(',')
}

const fetchAlarms = async (params: QueryParameters) => {
  loading.value = true
  const resp = await getAlarms({ ...params, _s: buildFiql() })
  if (resp) {
    alarms.value = resp.alarm
    totalCount.value = resp.totalCount
  }
  loading.value = false
}

const getTotalCount = () => totalCount.value

const { queryParameters, updateQueryParameters } = useQueryParameters(
  { limit: 10, offset: 0 },
  fetchAlarms
)

// Re-fetch when related node IDs change
watch(relatedNodeIds, () => {
  updateQueryParameters({ ...queryParameters.value, offset: 0 })
})

const rowClass = (alarm: Alarm) => {
  const base = `row--${alarm.severity.toLowerCase()}`
  return alarm.nodeId !== numericNodeId.value ? `${base} row--related` : base
}
</script>

<style lang="scss" scoped>
@use '@featherds/styles/themes/variables' as fvars;
@use '@featherds/styles/themes/utils';
@import "@featherds/table/scss/table";
@import "@featherds/styles/mixins/elevation";
@import "@featherds/styles/themes/variables";

.card {
  @include elevation(2);
  padding: 15px;
  margin-bottom: 15px;
}
table {
  @include table;
}

.alarms-table {
  &__header { margin-bottom: 4px; }

  &__toggles {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 0 12px;
    flex-wrap: wrap;
  }

  &__toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    user-select: none;
    input { cursor: pointer; }
  }

  &__related-loading {
    color: var($secondary-text-on-surface);
    font-style: italic;
  }

  &__related-badge {
    display: inline-block;
    font-size: 0.75rem;
    margin-right: 4px;
    color: var($secondary-text-on-surface);
    vertical-align: middle;
  }

  &__empty {
    text-align: center;
    padding: 16px;
    color: var($secondary-text-on-surface);
  }
}

.log-message :deep(p) { margin: 0; }

$row-opacity: 0.15;
.row {
  &--critical      { background: utils.alpha(fvars.$error,         $row-opacity); td:first-child { border-left: 3px solid var(--feather-error); } }
  &--major         { background: utils.alpha(fvars.$major,         $row-opacity); td:first-child { border-left: 3px solid var(--feather-major); } }
  &--minor         { background: utils.alpha(fvars.$minor,         $row-opacity); td:first-child { border-left: 3px solid var(--feather-minor); } }
  &--warning       { background: utils.alpha(fvars.$warning,       $row-opacity); td:first-child { border-left: 3px solid var(--feather-warning); } }
  &--normal        { background: utils.alpha(fvars.$success,       $row-opacity); td:first-child { border-left: 3px solid var(--feather-success); } }
  &--cleared,
  &--unacknowledged { background: utils.alpha(fvars.$cleared,      $row-opacity); td:first-child { border-left: 3px solid var(--feather-cleared); } }
  &--indeterminate { background: utils.alpha(fvars.$indeterminate, $row-opacity); td:first-child { border-left: 3px solid var(--feather-indeterminate); } }

  // Related alarms (from other nodes) get a dashed left border to distinguish them
  &--related td:first-child {
    border-left-style: dashed !important;
    opacity: 0.9;
  }
}
</style>
