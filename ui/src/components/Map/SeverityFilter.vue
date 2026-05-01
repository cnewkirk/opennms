<template>
  <div class="severity-select">
    <label class="severity-label">Show Severity &gt;=</label>
    <Select
      v-model="selectedSeverity"
      :options="options"
      optionLabel="option"
      @update:modelValue="onSeveritySelect"
      class="severity-dropdown"
    />
  </div>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import { useMapStore } from '@/stores/mapStore'

const mapStore = useMapStore()

const options = [
  { id: 'NORMAL', option: 'Normal' },
  { id: 'WARNING', option: 'Warning' },
  { id: 'MINOR', option: 'Minor' },
  { id: 'MAJOR', option: 'Major' },
  { id: 'CRITICAL', option: 'Critical' }
]
const selectedSeverity = ref(options[0])

const onSeveritySelect = () => mapStore.setSelectedSeverity(selectedSeverity.value.id)
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.severity-select {
  position: absolute;
  width: 250px;
  right: 60px;
  top: 80px;
  z-index: var($zindex-sticky);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.severity-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var($secondary-text-on-surface);
}

.severity-dropdown {
  width: 100%;
}
</style>
