<template>
  <FeatherDrawer
    v-model="isVisible"
    :labels="{ close: 'Close', title: panelTitle }"
    width="340px"
  >
    <div class="detail-panel">
      <template v-if="vertex">
        <div class="detail-panel__row">
          <span class="detail-panel__key">Label</span>
          <span class="detail-panel__val">{{ vertex.label }}</span>
        </div>
        <div v-if="vertex.ipAddress" class="detail-panel__row">
          <span class="detail-panel__key">IP Address</span>
          <span class="detail-panel__val">{{ vertex.ipAddress }}</span>
        </div>
        <div v-if="vertex.id" class="detail-panel__row">
          <span class="detail-panel__key">Node ID</span>
          <span class="detail-panel__val">{{ vertex.id }}</span>
        </div>
        <div v-if="vertex.namespace" class="detail-panel__row">
          <span class="detail-panel__key">Namespace</span>
          <span class="detail-panel__val">{{ vertex.namespace }}</span>
        </div>
        <div v-if="vertex.tooltipText" class="detail-panel__row">
          <span class="detail-panel__key">Info</span>
          <span class="detail-panel__val detail-panel__val--html" v-html="vertex.tooltipText" />
        </div>

        <template v-if="nodeAlarms.length">
          <div class="detail-panel__section-header">Active Alarms</div>
          <div v-for="alarm in nodeAlarms" :key="alarm.id" class="detail-panel__alarm">
            <span :class="['detail-panel__badge', alarm.severity.toLowerCase()]">
              {{ alarm.severity }}
            </span>
            <span class="detail-panel__alarm-msg">{{ alarm.logMessage }}</span>
          </div>
        </template>
        <div v-else-if="severityBadge" class="detail-panel__row">
          <span class="detail-panel__key">Alarm Severity</span>
          <span :class="['detail-panel__badge', severityBadge.toLowerCase()]">
            {{ severityBadge }}
          </span>
        </div>

        <div class="detail-panel__actions">
          <FeatherButton text @click="goToNodeDetail">View Node Detail</FeatherButton>
        </div>
      </template>

      <template v-else-if="edge">
        <div class="detail-panel__row">
          <span class="detail-panel__key">Source Node</span>
          <span class="detail-panel__val">{{ sourceLabel }}</span>
        </div>
        <div class="detail-panel__row">
          <span class="detail-panel__key">Target Node</span>
          <span class="detail-panel__val">{{ targetLabel }}</span>
        </div>
        <div class="detail-panel__row">
          <span class="detail-panel__key">Protocols Detected</span>
          <div v-if="edgeProtocols.length" class="detail-panel__chips">
            <span v-for="p in edgeProtocols" :key="p" class="detail-panel__chip">{{ p }}</span>
          </div>
          <span v-else class="detail-panel__val">{{ store.activeLayer?.label ?? 'Unknown' }}</span>
        </div>
      </template>
    </div>
  </FeatherDrawer>
</template>

<script setup lang="ts">
import { FeatherDrawer } from '@featherds/drawer'
import { FeatherButton } from '@featherds/button'
import { useTopologyStore } from '@/stores/topologyStore'
import { isVertex } from '@/types/topology'

const store = useTopologyStore()
const router = useRouter()

const isVisible = computed({
  get: () => store.selectedElement !== null,
  set: (val) => { if (!val) store.selectElement(null) }
})

const vertex = computed(() => {
  const el = store.selectedElement
  return el && isVertex(el) ? el : null
})

const edge = computed(() => {
  const el = store.selectedElement
  return el && !isVertex(el) ? el : null
})

const panelTitle = computed(() => {
  if (vertex.value) return vertex.value.label ?? 'Node Detail'
  if (edge.value) return 'Link Detail'
  return ''
})

const severityBadge = computed(() => {
  if (!vertex.value?.id) return null
  const sev = store.alarmSeverity[parseInt(vertex.value.id, 10)]
  return sev ?? null
})

const nodeId = computed(() => {
  if (!vertex.value?.id) return null
  const id = parseInt(vertex.value.id, 10)
  return isNaN(id) ? null : id
})

const nodeAlarms = computed(() => {
  if (!nodeId.value) return []
  return store.nodeAlarmDetails[nodeId.value] ?? []
})

watch(nodeId, (id) => {
  if (id !== null && store.alarmSeverity[id]) {
    store.loadNodeAlarmDetails(id)
  }
}, { immediate: true })

const edgeProtocols = computed(() => {
  if (!edge.value) return []
  const src = edge.value.source.id
  const tgt = edge.value.target.id
  const key = `${Math.min(src, tgt)}-${Math.max(src, tgt)}`
  return store.edgeProtocols[key] ?? []
})

const sourceLabel = computed(() => {
  if (!edge.value) return ''
  const v = store.vertices.find(v => v.id === String(edge.value!.source.id))
  return v?.label ?? String(edge.value.source.id)
})

const targetLabel = computed(() => {
  if (!edge.value) return ''
  const v = store.vertices.find(v => v.id === String(edge.value!.target.id))
  return v?.label ?? String(edge.value.target.id)
})

const goToNodeDetail = () => {
  if (vertex.value?.id) {
    router.push(`/node/${vertex.value.id}`)
  }
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@/styles/severities";

.detail-panel {
  padding: 16px;

  &__row {
    display: flex;
    flex-direction: column;
    margin-bottom: 12px;
  }

  &__key {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var($secondary-text-on-surface);
    margin-bottom: 2px;
  }

  &__val {
    font-size: 0.9rem;
    word-break: break-all;

    &--html :deep(p) {
      margin: 0 0 4px;

      &:last-child { margin-bottom: 0; }
    }
  }

  &__badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: bold;
  }

  &__section-header {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var($secondary-text-on-surface);
    margin: 4px 0 8px;
  }

  &__alarm {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 10px;
  }

  &__alarm-msg {
    font-size: 0.85rem;
    line-height: 1.4;
    flex: 1;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }

  &__chip {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    background-color: var($primary);
    color: #fff;
  }

  &__actions {
    margin-top: 16px;
  }
}
</style>
