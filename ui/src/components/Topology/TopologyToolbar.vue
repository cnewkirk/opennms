<template>
  <div class="topology-toolbar">
    <div class="topology-toolbar__layers">
      <button
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: allActive }"
        :disabled="store.loading"
        @click="toggleAll"
      >All</button>
      <button
        v-for="layer in store.protocolLayers"
        :key="layer.namespace"
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: store.activeLayers.includes(layer.namespace) }"
        :disabled="store.loading || (store.activeLayers.includes(layer.namespace) && store.activeLayers.length === 1)"
        @click="store.toggleLayer(layer)"
      >{{ layer.label }}</button>
    </div>

    <FeatherInput
      v-model="searchText"
      label="Search nodes"
      class="topology-toolbar__search"
      @update:modelValue="onSearch"
    />

    <div class="topology-toolbar__layout-actions">
      <FeatherButton text @click="emit('save-layout')" title="Save current node positions to this browser">
        Save Layout
      </FeatherButton>
      <FeatherButton text @click="emit('reset-layout')" title="Clear saved positions and re-run auto-layout">
        Reset Layout
      </FeatherButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherInput } from '@featherds/input'
import { FeatherButton } from '@featherds/button'
import { useTopologyStore } from '@/stores/topologyStore'
import { useDebounceFn } from '@vueuse/core'

const emit = defineEmits<{
  'save-layout': []
  'reset-layout': []
}>()

const store = useTopologyStore()

const allActive = computed(() =>
  store.protocolLayers.length > 0 &&
  store.protocolLayers.every(l => store.activeLayers.includes(l.namespace))
)

const toggleAll = () => store.setAllLayers(!allActive.value)

const searchText = ref('')

const onSearch = useDebounceFn((val: string | number | undefined) => {
  store.setSearchQuery(String(val ?? ''))
}, 300)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.topology-toolbar {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 8px 16px;
  flex-shrink: 0;

  &__layers {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding-top: 6px;
  }

  &__chip {
    padding: 4px 14px;
    border-radius: 16px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    border: 2px solid var($primary);
    background: transparent;
    color: var($primary);
    transition: background 0.15s, color 0.15s;
    line-height: 1.4;

    &.active {
      background: var($primary);
      color: #fff;
    }

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    &:not(:disabled):hover {
      opacity: 0.8;
    }
  }

  &__search {
    width: 260px;
  }

  &__layout-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    padding-top: 8px;
  }
}
</style>
