<template>
  <div class="delete-nodes-page">
    <BreadCrumbs :items="breadcrumbs" />

    <div class="delete-nodes-panel">
      <div class="delete-nodes-panel__header">
        <span class="delete-nodes-panel__title">Delete Nodes</span>
      </div>
      <div class="delete-nodes-panel__warning">
        <i class="pi pi-exclamation-triangle" />
        Deleting a node permanently removes it and all associated data.
      </div>

      <div class="delete-nodes-panel__search">
        <InputText v-model="searchQuery" placeholder="Filter by node label…" @input="debounceSearch" />
      </div>

      <DataTable
        :value="nodes"
        :loading="loading"
        v-model:selection="selectedNodes"
        dataKey="id"
        stripedRows
        rowHover
      >
        <Column selectionMode="multiple" style="width: 40px" />
        <Column field="id" header="ID" style="width: 70px" />
        <Column field="label" header="Node Label" />
        <Column field="foreignSource" header="Foreign Source">
          <template #body="{ data }">{{ data.foreignSource || '—' }}</template>
        </Column>
        <Column field="foreignId" header="Foreign ID">
          <template #body="{ data }">{{ data.foreignId || '—' }}</template>
        </Column>
        <template #empty>{{ loading ? '' : 'No nodes found.' }}</template>
      </DataTable>

      <div class="delete-nodes-panel__footer">
        <span class="delete-nodes-panel__count">
          {{ selectedNodes.length }} node{{ selectedNodes.length === 1 ? '' : 's' }} selected
        </span>
        <Button
          label="Delete Selected"
          severity="danger"
          :disabled="selectedNodes.length === 0"
          :loading="deleting"
          @click="confirmDelete"
        />
      </div>
    </div>

    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { searchNodes, deleteNode, type NodeSummary } from '@/services/deleteNodesService'
import useSnackbar from '@/composables/useSnackbar'
import { useMenuStore } from '@/stores/menuStore'
import type { BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()
const confirm = useConfirm()

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'Delete Nodes', to: '#', position: 'last' },
])

const nodes = ref<NodeSummary[]>([])
const loading = ref(false)
const deleting = ref(false)
const searchQuery = ref('')
const selectedNodes = ref<NodeSummary[]>([])
let debounceTimer: ReturnType<typeof setTimeout>

const load = async (query = '') => {
  loading.value = true
  const result = await searchNodes(query)
  if (result !== false) nodes.value = result
  else showSnackBar({ msg: 'Failed to load nodes.' })
  loading.value = false
}

const debounceSearch = () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => load(searchQuery.value), 300)
}

const confirmDelete = () => {
  const labels = selectedNodes.value.map(n => n.label).join(', ')
  confirm.require({
    message: `Permanently delete ${selectedNodes.value.length} node(s): ${labels}?`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    accept: async () => {
      deleting.value = true
      const results = await Promise.all(selectedNodes.value.map(n => deleteNode(n.id)))
      const failed = results.filter(r => !r).length
      if (failed === 0) showSnackBar({ msg: `${selectedNodes.value.length} node(s) deleted.` })
      else showSnackBar({ msg: `${failed} deletion(s) failed.` })
      selectedNodes.value = []
      deleting.value = false
      load(searchQuery.value)
    },
  })
}

onMounted(() => load())
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.delete-nodes-page { padding: 16px 20px; }

.delete-nodes-panel {
  background: var($surface);
  border-radius: 6px;

  &__header {
    padding: 14px 16px;
    border-bottom: 1px solid var($border-light-on-surface);
  }

  &__title { font-size: 16px; font-weight: 600; }

  &__warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    color: var(--feather-warning);
    font-size: 13px;
    background: var($background);
    border-bottom: 1px solid var($border-light-on-surface);
  }

  &__search { padding: 12px 16px; }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-top: 1px solid var($border-light-on-surface);
  }

  &__count { font-size: 13px; color: var($secondary-text-on-surface); }
}
</style>
