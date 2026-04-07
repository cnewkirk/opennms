<template>
  <div v-if="loading" class="links-loading">
    <FeatherSpinner />
  </div>

  <div v-else-if="links.length === 0" class="links-empty">
    No links discovered
  </div>

  <table v-else class="links-table">
    <thead>
      <tr>
        <th>Local Port</th>
        <th>Remote Node</th>
        <th>Remote Port</th>
        <th>Protocols</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(link, i) in links" :key="i">
        <td class="links-mono">{{ link.localPort || '—' }}</td>
        <td>{{ link.remoteNode || '—' }}</td>
        <td class="links-mono">{{ link.remotePort || '—' }}</td>
        <td class="links-protocols">
          <span
            v-for="p in link.protocols"
            :key="p"
            class="links-badge"
            :class="`links-badge--${p.toLowerCase().replace('-', '')}`"
          >{{ p }}</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { FeatherSpinner } from '@featherds/progress'
import { getNodeEnlinkd, normalizeLinks, groupLinks } from '@/services/enlinkdService'
import type { GroupedLink } from '@/services/enlinkdService'

const props = defineProps<{ nodeId: string }>()

const loading = ref(true)
const links = ref<GroupedLink[]>([])

onMounted(async () => {
  const data = await getNodeEnlinkd(Number(props.nodeId))
  links.value = data ? groupLinks(normalizeLinks(data)) : []
  loading.value = false
})
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";

.links-loading {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}

.links-empty {
  padding: 1.5rem 1rem;
  color: var($secondary-text-on-surface);
  font-size: 0.875rem;
}

.links-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;

  th {
    text-align: left;
    padding: 6px 12px 6px 0;
    font-size: 0.6875rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var($secondary-text-on-surface);
    border-bottom: 1px solid var($border-light-on-surface);
    white-space: nowrap;
  }

  td {
    padding: 6px 12px 6px 0;
    border-bottom: 1px solid var($border-light-on-surface);
    color: var($primary-text-on-surface);
    vertical-align: middle;
  }

  tr:last-child td { border-bottom: none; }
}

.links-mono {
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
  font-size: 0.75rem;
}

.links-protocols {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.links-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  background: var($border-light-on-surface);
  color: var($secondary-text-on-surface);

  &--lldp    { background: #dbeafe; color: #1d4ed8; }
  &--cdp     { background: #fef9c3; color: #854d0e; }
  &--ospf    { background: #dcfce7; color: #166534; }
  &--isis    { background: #fce7f3; color: #9d174d; }
  &--bridge  { background: #ede9fe; color: #5b21b6; }
}
</style>
