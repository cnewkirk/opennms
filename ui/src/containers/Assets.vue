<template>
  <div class="assets-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="card__toolbar">
            <InputText
              v-model="searchText"
              placeholder="Search by node label…"
              class="card__search"
              @input="debouncedSearch"
            />
          </div>

          <DataTable
            :value="nodes"
            :loading="loading"
            size="small"
            striped-rows
          >
            <template #empty>
              <span v-if="!loading">No nodes found.</span>
            </template>
            <Column field="label" header="Node Label" sortable />
            <Column header="Category">
              <template #body="{ data }">
                {{ assetMap[data.id]?.category ?? '—' }}
              </template>
            </Column>
            <Column header="Building">
              <template #body="{ data }">
                {{ assetMap[data.id]?.building ?? '—' }}
              </template>
            </Column>
            <Column header="OS">
              <template #body="{ data }">
                {{ assetMap[data.id]?.operatingSystem ?? '—' }}
              </template>
            </Column>
            <Column header="Actions">
              <template #body="{ data }">
                <router-link :to="`/asset/${data.id}/edit`">
                  <Button label="Edit Assets" size="small" text />
                </router-link>
              </template>
            </Column>
          </DataTable>
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
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useMenuStore } from '@/stores/menuStore'
import { v2 } from '@/services/axiosInstances'
import { getAssetRecord, type AssetRecord } from '@/services/assetService'
import { type BreadCrumb } from '@/types'

const menuStore = useMenuStore()

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Assets', to: '#', position: 'last' }
])

interface NodeSummary {
  id: number
  label: string
}

const nodes = ref<NodeSummary[]>([])
const loading = ref(true)
const searchText = ref('')
const assetMap = ref<Record<number, AssetRecord>>({})

let debounceTimer: ReturnType<typeof setTimeout> | null = null

const loadNodes = async (search?: string) => {
  loading.value = true
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
    loading.value = false
  }
}

const debouncedSearch = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => loadNodes(searchText.value), 350)
}

onMounted(async () => {
  await loadNodes()
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";

.assets-page {
  padding: 0 0 40px;
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
    display: flex;
    gap: 12px;
  }

  &__search {
    width: 280px;
  }
}
</style>
