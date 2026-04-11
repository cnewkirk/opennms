<template>
  <div class="node-metadata-panel">
    <div v-if="loading" class="node-metadata-panel__loading">Loading metadata…</div>
    <div v-else-if="error" class="node-metadata-panel__empty">Failed to load metadata.</div>
    <div v-else-if="!entries.length" class="node-metadata-panel__empty">No metadata entries.</div>
    <template v-else>
      <template v-for="group in groupedEntries" :key="group.context">
        <div class="node-metadata-panel__context-header">{{ group.context }}</div>
        <table class="node-metadata-panel__table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in group.entries" :key="entry.key">
              <td>{{ entry.key }}</td>
              <td>{{ entry.value }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { getNodeMetaData } from '@/services/nodeService'
import { OnmsMetaData } from '@/types'

const props = defineProps<{ nodeId: string }>()

const loading = ref(true)
const error = ref(false)
const entries = ref<OnmsMetaData[]>([])

onMounted(async () => {
  const result = await getNodeMetaData(props.nodeId)
  if (result === false) error.value = true
  else entries.value = result.metaData ?? []
  loading.value = false
})

const groupedEntries = computed(() => {
  const groups: Record<string, OnmsMetaData[]> = {}
  for (const e of entries.value) {
    if (!groups[e.context]) groups[e.context] = []
    groups[e.context].push(e)
  }
  return Object.entries(groups).map(([context, items]) => ({ context, entries: items }))
})
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.node-metadata-panel {
  padding: 16px 0;

  &__loading,
  &__empty {
    color: var($secondary-text-on-surface);
    padding: 24px 0;
  }

  &__context-header {
    font-weight: 600;
    font-size: 1rem;
    margin-top: 24px;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid var($border-on-surface);
    color: var($primary-text-on-surface);

    &:first-of-type {
      margin-top: 0;
    }
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;

    th {
      text-align: left;
      font-weight: 600;
      font-size: 0.85rem;
      padding: 6px 12px;
      color: var($secondary-text-on-surface);
      background-color: var($surface);
    }

    td {
      padding: 6px 12px;
      font-size: 0.9rem;
      color: var($primary-text-on-surface);
      word-break: break-word;
    }

    tbody tr:nth-child(odd) {
      background-color: var($background);
    }

    tbody tr:nth-child(even) {
      background-color: var($surface);
    }
  }
}
</style>
