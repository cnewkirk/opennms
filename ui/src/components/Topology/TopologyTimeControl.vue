<template>
  <div class="time-control">
    <div class="time-control__range">
      <button
        v-for="r in RANGES"
        :key="r.key"
        type="button"
        class="time-control__range-btn"
        :class="{ active: currentRange === r.key }"
        @click="selectRange(r.key)"
      >{{ r.label }}</button>
    </div>

    <input
      type="range"
      class="time-control__slider"
      :min="0"
      :max="currentRangeMs"
      :value="sliderPos"
      @input="onInput"
    />

    <span class="time-control__timestamp">
      {{ isLive ? '' : formatTimestamp(previewDate) }}
    </span>

    <button
      type="button"
      class="time-control__live-btn"
      :class="{ 'is-live': isLive }"
      @click="snapToLive"
    >
      <span v-if="isLive" class="time-control__live-dot"></span>
      LIVE
    </button>
  </div>
</template>

<script setup lang="ts">
import { debounce } from 'lodash'

const RANGES: { key: '24h' | '7d' | '30d'; label: string; ms: number }[] = [
  { key: '24h', label: '24h', ms: 24 * 60 * 60 * 1_000 },
  { key: '7d',  label: '7d',  ms: 7 * 24 * 60 * 60 * 1_000 },
  { key: '30d', label: '30d', ms: 30 * 24 * 60 * 60 * 1_000 }
]

const props = defineProps<{ modelValue: Date | null }>()
const emit  = defineEmits<{ 'update:modelValue': [Date | null] }>()

const currentRange   = ref<'24h' | '7d' | '30d'>('24h')
const currentRangeMs = computed(() => RANGES.find(r => r.key === currentRange.value)!.ms)

// sliderPos: ms offset from range start. 0 = oldest, currentRangeMs = now (LIVE).
const sliderPos  = ref(currentRangeMs.value)
const previewDate = ref<Date>(new Date())
const isLive     = computed(() => sliderPos.value >= currentRangeMs.value)

const formatTimestamp = (d: Date): string =>
  d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const debouncedEmit = debounce((pos: number, rangeMs: number) => {
  if (pos >= rangeMs) {
    emit('update:modelValue', null)
  } else {
    emit('update:modelValue', new Date(Date.now() - (rangeMs - pos)))
  }
}, 400)

onBeforeUnmount(() => debouncedEmit.cancel())

const onInput = (e: Event) => {
  const val = Number((e.target as HTMLInputElement).value)
  sliderPos.value = val
  previewDate.value = val >= currentRangeMs.value
    ? new Date()
    : new Date(Date.now() - (currentRangeMs.value - val))
  debouncedEmit(val, currentRangeMs.value)
}

const snapToLive = () => {
  sliderPos.value = currentRangeMs.value
  debouncedEmit.cancel()
  emit('update:modelValue', null)
}

const selectRange = (key: '24h' | '7d' | '30d') => {
  currentRange.value = key
  sliderPos.value = currentRangeMs.value
  debouncedEmit.cancel()
  emit('update:modelValue', null)
}

// Sync slider to LIVE when parent sets modelValue to null externally
watch(() => props.modelValue, (val) => {
  if (val === null) sliderPos.value = currentRangeMs.value
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.time-control {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 16px;
  background: var($surface);
  border-top: 1px solid var($border-on-surface);
  height: 40px;
  flex-shrink: 0;

  &__range {
    display: flex;
    gap: 4px;
  }

  &__range-btn {
    padding: 2px 8px;
    border-radius: vars.$border-radius-pill;
    border: 1px solid var($border-on-surface);
    background: transparent;
    color: var($secondary-text-on-surface);
    font-size: 0.72rem;
    cursor: pointer;

    &.active {
      background: var($primary);
      border-color: var($primary);
      color: #fff;
    }
  }

  &__slider {
    flex: 1;
    min-width: 0;
    accent-color: var($primary);
  }

  &__timestamp {
    font-size: 0.75rem;
    color: var($secondary-text-on-surface);
    white-space: nowrap;
    min-width: 120px;
    text-align: right;
  }

  &__live-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: vars.$border-radius-pill;
    border: 1px solid var($border-on-surface);
    background: transparent;
    color: var($secondary-text-on-surface);
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;

    &.is-live {
      border-color: #48BB78;
      color: #48BB78;
    }
  }

  &__live-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #48BB78;
    animation: pulse 1.5s ease-in-out infinite;
    flex-shrink: 0;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}
</style>
