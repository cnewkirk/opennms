<template>
  <div
    class="svc-tooltip-trigger"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <slot />
    <Teleport to="body">
      <div
        v-if="visible"
        class="svc-tooltip"
        :style="floatStyle"
        @mouseenter="cancelHide"
        @mouseleave="onLeave"
      >
        <div class="svc-tooltip__header caption">
          {{ serviceName }} · {{ ip }} · last 6h
        </div>
        <div class="svc-tooltip__chart">
          <PersesPanel
            :title="`${serviceName} response time`"
            :queries="[query]"
            :time-range="timeRange"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { AbsoluteTimeRange } from '@perses-dev/core'
import type { OpenNMSQuerySpec } from '@/datasource/opennms/types'
import PersesPanel from '@/components/Perses/PersesPanel.vue'
import API from '@/services'

const props = defineProps<{
  nodeId: string
  ip: string
  serviceName: string
}>()

// ── Resource existence cache ─────────────────────────────────────────────────
// null = unknown, true = exists, false = no response-time resource for this IP
const resourceExists = ref<boolean | null>(null)

const resourceId = computed(
  () => `node[${props.nodeId}].responseTime[${props.ip}]`
)

// ── Tooltip state ────────────────────────────────────────────────────────────
const visible = ref(false)
const floatStyle = ref<Record<string, string>>({})
let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

const query = computed<OpenNMSQuerySpec>(() => ({
  resourceId: resourceId.value,
  attribute: props.serviceName.toLowerCase(),
  aggregation: 'AVERAGE',
  label: 'Response Time (ms)'
}))

const timeRange = ref<AbsoluteTimeRange>({
  start: new Date(Date.now() - 6 * 60 * 60 * 1000),
  end: new Date()
})

// ── Hover handlers ───────────────────────────────────────────────────────────
const onEnter = (e: MouseEvent) => {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  if (visible.value) return

  const triggerEl = e.currentTarget as HTMLElement  // capture before async gap

  showTimer = setTimeout(async () => {
    // Check resource existence (cached after first lookup)
    if (resourceExists.value === null) {
      const result = await API.getResourceById(resourceId.value)
      resourceExists.value = result !== null
    }
    if (!resourceExists.value) return

    // Position below the trigger element
    const rect = triggerEl.getBoundingClientRect()
    floatStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 8}px`,
      left: `${Math.min(window.innerWidth - 348, Math.max(8, rect.left))}px`,
      zIndex: '9999'
    }
    // Refresh time range to "now"
    timeRange.value = {
      start: new Date(Date.now() - 6 * 60 * 60 * 1000),
      end: new Date()
    }
    visible.value = true
  }, 300)
}

const cancelHide = () => {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

const onLeave = () => {
  if (showTimer) { clearTimeout(showTimer); showTimer = null }
  hideTimer = setTimeout(() => { visible.value = false }, 150)
}

onUnmounted(() => {
  if (showTimer) clearTimeout(showTimer)
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<style lang="scss">
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/elevation";

.svc-tooltip-trigger {
  display: contents; // transparent wrapper — doesn't affect layout
}

.svc-tooltip {
  @include elevation(4);
  background: var($surface);
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-surface;
  padding: 10px 12px 12px;
  width: 340px;
  pointer-events: auto;

  &__header {
    color: var($secondary-text-on-surface);
    margin-bottom: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__chart {
    width: 316px;
    height: 160px;
  }
}
</style>
