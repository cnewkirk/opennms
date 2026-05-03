<template>
  <div class="hardware-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <!-- Node selector -->
    <div class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="card__toolbar">
            <InputText
              v-model="searchText"
              placeholder="Search nodes by label…"
              class="card__search"
              @input="debouncedSearch"
            />
          </div>

          <DataTable
            :value="nodes"
            :loading="nodesLoading"
            size="small"
            striped-rows
            selection-mode="single"
            :meta-key-selection="false"
            v-model:selection="selectedNode"
            @row-select="onNodeSelect"
          >
            <template #empty>
              <span v-if="!nodesLoading">No nodes found.</span>
            </template>
            <Column field="label" header="Node Label" sortable />
            <Column field="id" header="ID" style="width:80px" />
          </DataTable>
        </div>
      </div>
    </div>

    <!-- Hardware inventory result -->
    <div v-if="selectedNode" class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="card__header">
            <span class="card__title">Hardware Inventory: {{ selectedNode.label }}</span>
          </div>
          <div class="card__body">
            <div v-if="hwLoading" class="hardware-page__status">Loading hardware inventory…</div>
            <div v-else-if="!hwData" class="hardware-page__status">
              No hardware inventory data for this node.
            </div>
            <pre v-else class="hardware-page__json">{{ JSON.stringify(hwData, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import { useMenuStore } from '@/stores/menuStore'
import { v2 } from '@/services/axiosInstances'
import { getHardwareInventory } from '@/services/assetService'
import { type BreadCrumb } from '@/types'

const menuStore = useMenuStore()

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Hardware Inventory', to: '#', position: 'last' }
])

interface NodeSummary {
  id: number
  label: string
}

const nodes = ref<NodeSummary[]>([])
const nodesLoading = ref(true)
const searchText = ref('')
const selectedNode = ref<NodeSummary | null>(null)
const hwData = ref<any>(null)
const hwLoading = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

const loadNodes = async (search?: string) => {
  nodesLoading.value = true
  try {
    const params: Record<string, unknown> = { limit: 25, orderBy: 'label' }
    if (search?.trim()) {
      params._s = `label==*${search.trim()}*`
    }
    const resp = await v2.get('/nodes', { params })
    const raw = resp.data?.node
    nodes.value = Array.isArray(raw) ? raw : raw ? [raw] : []
  } catch {
    nodes.value = []
  } finally {
    nodesLoading.value = false
  }
}

const debouncedSearch = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => loadNodes(searchText.value), 350)
}

const onNodeSelect = async (event: any) => {
  const node = event.data as NodeSummary
  hwLoading.value = true
  hwData.value = null
  try {
    hwData.value = await getHardwareInventory(node.id)
  } finally {
    hwLoading.value = false
  }
}

onMounted(() => loadNodes())
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";

.hardware-page {
  padding: 0 0 40px;

  &__status {
    padding: 16px;
    color: var($secondary-text-on-surface);
    font-size: 14px;
  }

  &__json {
    background: var($shade-4);
    border: 1px solid var($shade-3);
    border-radius: 4px;
    padding: 12px 16px;
    font-size: 12px;
    font-family: monospace;
    overflow: auto;
    max-height: 600px;
    margin: 0;
    color: var($primary-text-on-surface);
  }
}

.card {
  background: var($surface);
  border: 1px solid var($shade-3);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 16px;

  &__toolbar {
    padding: 12px 16px;
    border-bottom: 1px solid var($shade-3);
    background: var($shade-4);
  }

  &__search {
    width: 280px;
  }

  &__header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var($shade-3);
    background: var($shade-4);
  }

  &__title {
    font-weight: 600;
    font-size: 14px;
  }

  &__body {
    padding: 16px;
  }
}
</style>
