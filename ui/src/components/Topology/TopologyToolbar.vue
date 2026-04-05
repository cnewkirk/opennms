<template>
  <div class="topology-toolbar">
    <FeatherSelect
      v-model="selectedLayerItem"
      :options="(layerOptions as any)"
      text-prop="label"
      label="Layer"
      class="topology-toolbar__layer-select"
      @update:modelValue="onLayerChange"
    />
    <FeatherInput
      v-model="searchText"
      label="Search nodes"
      class="topology-toolbar__search"
      @update:modelValue="onSearch"
    />
  </div>
</template>

<script setup lang="ts">
import { FeatherSelect } from '@featherds/select'
import { FeatherInput } from '@featherds/input'
import { useTopologyStore } from '@/stores/topologyStore'
import { TopologyLayer } from '@/types/topology'
import { useDebounceFn } from '@vueuse/core'

const store = useTopologyStore()

interface LayerOption {
  id: string
  label: string
  layer: TopologyLayer
}

const layerOptions = computed<LayerOption[]>(() =>
  store.availableLayers.map(l => ({ id: `${l.containerId}/${l.namespace}`, label: l.label, layer: l }))
)

const selectedLayerItem = ref<LayerOption | undefined>(undefined)

watch(() => store.activeLayer, (layer) => {
  if (layer) {
    selectedLayerItem.value = layerOptions.value.find(o => o.id === `${layer.containerId}/${layer.namespace}`)
  }
})

watch(layerOptions, (opts) => {
  if (!selectedLayerItem.value && opts.length > 0) {
    selectedLayerItem.value = opts.find(o => o.id === 'nodes/nodes') ?? opts[0]
  }
})

const onLayerChange = (item: unknown) => {
  const opt = item as LayerOption | undefined
  if (opt?.layer) store.loadGraph(opt.layer)
}

const searchText = ref('')

const onSearch = useDebounceFn((val: string | number | undefined) => {
  store.setSearchQuery(String(val ?? ''))
}, 300)
</script>

<style lang="scss" scoped>
.topology-toolbar {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 8px 16px;
  flex-shrink: 0;

  &__layer-select {
    width: 220px;
  }

  &__search {
    width: 280px;
  }
}
</style>
