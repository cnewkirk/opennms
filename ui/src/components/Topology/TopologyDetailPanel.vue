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
        <div v-if="severityBadge" class="detail-panel__row">
          <span class="detail-panel__key">Alarm Severity</span>
          <span :class="['detail-panel__badge', severityBadge.toLowerCase()]">
            {{ severityBadge }}
          </span>
        </div>
        <div v-if="vertex.namespace" class="detail-panel__row">
          <span class="detail-panel__key">Namespace</span>
          <span class="detail-panel__val">{{ vertex.namespace }}</span>
        </div>
        <div v-if="vertex.tooltipText" class="detail-panel__row">
          <span class="detail-panel__key">Info</span>
          <span class="detail-panel__val">{{ vertex.tooltipText }}</span>
        </div>
        <div v-if="vertex.id" class="detail-panel__actions">
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
        <div v-if="store.activeLayer" class="detail-panel__row">
          <span class="detail-panel__key">Protocol</span>
          <span class="detail-panel__val">{{ store.activeLayer.label }}</span>
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
  }

  &__badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: bold;
  }

  &__actions {
    margin-top: 16px;
  }
}
</style>
