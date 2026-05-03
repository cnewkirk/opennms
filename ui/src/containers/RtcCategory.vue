<template>
  <div class="rtc-category-page">
    <div class="breadcrumbs-row">
      <BreadCrumbs :items="breadcrumbs" />
    </div>

    <div class="page-header">
      <h1 class="page-title">
        <span v-if="categoryName">Category: {{ categoryName }}</span>
        <span v-else>Service Level Management</span>
      </h1>
    </div>

    <div v-if="!categoryName" class="empty-state">
      <i class="pi pi-exclamation-circle" />
      No category specified. Please supply a <code>?category=</code> query parameter.
    </div>

    <template v-else>
      <div v-if="loading" class="loading-state">
        <PanelLoader :size="40" />
      </div>

      <div v-else-if="error" class="error-state">
        <i class="pi pi-exclamation-triangle" />
        {{ error }}
      </div>

      <div v-else class="category-card">
        <div class="category-card__header">
          <i class="pi pi-sitemap" />
          Nodes in Category
          <span class="node-count">({{ nodes.length }})</span>
        </div>

        <div v-if="nodes.length === 0" class="no-nodes">
          No nodes found in category <strong>{{ categoryName }}</strong>.
        </div>

        <div v-else class="table-wrap">
          <table class="nodes-table">
            <thead>
              <tr>
                <th>Node Label</th>
                <th class="col-outages">Active Outages</th>
                <th class="col-status">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="node in nodes" :key="node.id">
                <td>
                  <router-link :to="`/node-detail/${node.id}`" class="node-link">
                    {{ node.label }}
                  </router-link>
                </td>
                <td class="col-outages">
                  <span v-if="outageCountFor(node.id) > 0" class="outage-count">
                    {{ outageCountFor(node.id) }}
                  </span>
                  <span v-else class="no-outages">—</span>
                </td>
                <td class="col-status">
                  <span
                    class="status-badge"
                    :class="outageCountFor(node.id) > 0 ? 'status-badge--down' : 'status-badge--ok'"
                  >
                    <i
                      class="pi"
                      :class="outageCountFor(node.id) > 0 ? 'pi-times-circle' : 'pi-check-circle'"
                    />
                    {{ outageCountFor(node.id) > 0 ? 'Down' : 'OK' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import PanelLoader from '@/components/Common/PanelLoader.vue'
import { v2 } from '@/services/axiosInstances'
import { useMenuStore } from '@/stores/menuStore'
import type { BreadCrumb } from '@/types'

const route = useRoute()
const menuStore = useMenuStore()
const homeUrl = computed(() => menuStore.mainMenu.homeUrl)

const categoryName = computed(() => (route.query.category as string) || '')

const breadcrumbs = computed<BreadCrumb[]>(() => {
  const crumbs: BreadCrumb[] = [
    { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
    { label: 'Service Level Management', to: '/rtc/category' }
  ]
  if (categoryName.value) {
    crumbs.push({ label: `Category: ${categoryName.value}`, to: '#', position: 'last' })
  } else {
    crumbs[crumbs.length - 1] = { ...crumbs[crumbs.length - 1], position: 'last' }
  }
  return crumbs
})

interface NodeItem {
  id: number
  label: string
  foreignSource?: string
  foreignId?: string
}

interface OutageItem {
  id?: number
  outageId?: number
  nodeId: number
  ipAddress?: string
  serviceName?: string
}

const loading = ref(false)
const error = ref<string | null>(null)
const nodes = ref<NodeItem[]>([])
const outages = ref<OutageItem[]>([])

const outageCountFor = (nodeId: number): number =>
  outages.value.filter(o => o.nodeId === nodeId).length

const load = async () => {
  if (!categoryName.value) return

  loading.value = true
  error.value = null
  nodes.value = []
  outages.value = []

  try {
    const filter = `category.name==${categoryName.value}`
    const outageFilter = `ifRegainedService==null;node.categories.name==${categoryName.value}`
    const [nodeResp, outageResp] = await Promise.all([
      v2.get('/nodes', { params: { '_s': filter, limit: 0, orderBy: 'label' } }),
      v2.get('/outages', { params: { '_s': outageFilter, limit: 0 } })
    ])

    const rawNodes = nodeResp.data.node
    nodes.value = Array.isArray(rawNodes) ? rawNodes : rawNodes ? [rawNodes] : []

    const rawOutages = outageResp.data.outage
    outages.value = Array.isArray(rawOutages) ? rawOutages : rawOutages ? [rawOutages] : []
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to load category data.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(categoryName, load)
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";
@import "@/styles/typography";

.rtc-category-page {
  padding: 0 20px 20px;
  min-height: 100%;
}

.breadcrumbs-row {
  padding-bottom: 4px;
}

.page-header {
  padding: 8px 0 16px;
}

.page-title {
  @include headline4;
  margin: 0;
  color: var($primary-text-on-surface);
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.error-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  color: var($error);
  @include body-large;

  .pi { font-size: 18px; }
}

.empty-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  color: var($secondary-text-on-surface);
  @include body-small;

  .pi { font-size: 18px; }

  code {
    background: var($shade-1);
    padding: 1px 6px;
    border-radius: 3px;
    font-family: monospace;
    font-size: 0.8125rem;
  }
}

.category-card {
  background: var($surface);
  border-radius: 6px;
  border: 1px solid var($border-light-on-surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
  overflow: hidden;

  &__header {
    background: var($primary);
    padding: 12px 16px;
    @include subtitle1;
    color: var($primary-text-on-color);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;

    .pi { font-size: 16px; }
  }
}

.node-count {
  font-weight: 400;
  opacity: 0.85;
  font-size: 0.875rem;
}

.no-nodes {
  padding: 20px 16px;
  @include body-small;
  color: var($secondary-text-on-surface);
}

.table-wrap {
  overflow-x: auto;
}

.nodes-table {
  width: 100%;
  border-collapse: collapse;

  thead tr {
    border-bottom: 2px solid var($border-on-surface);
  }

  th {
    padding: 10px 16px;
    text-align: left;
    @include body-small;
    font-weight: 600;
    color: var($secondary-text-on-surface);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  tbody tr {
    border-bottom: 1px solid var($border-light-on-surface);

    &:last-child { border-bottom: none; }

    &:hover {
      background: rgba(0, 0, 0, 0.03);
    }
  }

  td {
    padding: 10px 16px;
    @include body-small;
    color: var($primary-text-on-surface);
  }
}

.col-outages,
.col-status {
  text-align: center;
  width: 140px;
}

.node-link {
  color: var($clickable-normal);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.outage-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border-radius: 12px;
  background: rgba(183, 28, 28, 0.12);
  color: #b71c1c;
  font-weight: 700;
  font-size: 0.75rem;
}

.no-outages {
  color: var($secondary-text-on-surface);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px;
  border-radius: 10px;
  @include body-small;
  font-weight: 600;

  &--ok {
    background: rgba(22, 101, 52, 0.1);
    color: #166534;
  }

  &--down {
    background: rgba(183, 28, 28, 0.1);
    color: #b71c1c;
  }

  .pi { font-size: 12px; }
}

:global(html.open-dark) .nodes-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.04);
}

:global(html.open-dark) .status-badge--ok {
  background: rgba(110, 231, 183, 0.15);
  color: #6ee7b7;
}

:global(html.open-dark) .status-badge--down {
  background: rgba(252, 165, 165, 0.15);
  color: #fca5a5;
}

:global(html.open-dark) .outage-count {
  background: rgba(252, 165, 165, 0.15);
  color: #fca5a5;
}
</style>
