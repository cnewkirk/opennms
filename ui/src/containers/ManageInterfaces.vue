<template>
  <div class="manage-interfaces">
    <BreadCrumbs :items="breadcrumbs" />

    <div class="manage-interfaces__search-row">
      <AutoComplete
        v-model="selectedNode"
        :suggestions="nodeSuggestions"
        option-label="label"
        placeholder="Search for a node…"
        @complete="onNodeSearch"
        @option-select="onNodeSelected"
        class="manage-interfaces__node-search"
      />
    </div>

    <Message v-if="saveWarning" severity="warn" :closable="false" class="manage-interfaces__warning">
      Changing managed state may take several minutes to take effect. A rescan will revert unmanaged interfaces back to managed.
    </Message>

    <div v-if="loadingIfaces" class="manage-interfaces__loading">Loading interfaces…</div>

    <template v-else-if="interfaces.length">
      <DataTable :value="interfaces" size="small" striped-rows class="manage-interfaces__table">
        <Column header="IP Address" field="ipAddress" />
        <Column header="Managed">
          <template #body="{ data }">
            <ToggleSwitch
              :model-value="data._managed"
              @update:model-value="val => toggleInterface(data, val)"
            />
          </template>
        </Column>
        <Column header="Services">
          <template #body="{ data }">
            <div v-if="data.services" class="manage-interfaces__services">
              <div
                v-for="svc in data.services"
                :key="svc.id"
                class="manage-interfaces__svc-row"
              >
                <span class="manage-interfaces__svc-name">{{ svc.serviceType.name }}</span>
                <ToggleSwitch
                  :model-value="svc._managed"
                  @update:model-value="val => toggleService(data, svc, val)"
                />
              </div>
            </div>
            <span v-else class="manage-interfaces__svc-loading">loading…</span>
          </template>
        </Column>
      </DataTable>

      <div class="manage-interfaces__actions">
        <Button
          label="Apply Changes"
          :loading="saving"
          @click="applyChanges"
        />
      </div>
    </template>

    <div v-else-if="selectedNode" class="manage-interfaces__empty">
      No interfaces found for this node.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import AutoComplete from 'primevue/autocomplete'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Message from 'primevue/message'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { BreadCrumb } from '@/types'
import { useMenuStore } from '@/stores/menuStore'
import useSnackbar from '@/composables/useSnackbar'
import {
  searchNodes,
  getInterfacesForNode,
  getServicesForInterface,
  setInterfaceManaged,
  setServiceManaged,
  type ManagedNode,
  type ManagedInterface,
  type ManagedService
} from '@/services/manageInterfacesService'

const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: menuStore.mainMenu.homeUrl, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'Manage Interfaces', to: '#', position: 'last' }
])

type SvcRow = ManagedService & { _managed: boolean }
type IfaceRow = ManagedInterface & { services?: SvcRow[]; _managed: boolean }

const selectedNode = ref<ManagedNode | null>(null)
const nodeSuggestions = ref<ManagedNode[]>([])
const interfaces = ref<IfaceRow[]>([])
const loadingIfaces = ref(false)
const saving = ref(false)
const saveWarning = ref(false)

const pendingIfaceChanges = new Map<string, boolean>()
const pendingSvcChanges = new Map<string, boolean>()

const onNodeSearch = async (event: { query: string }) => {
  nodeSuggestions.value = await searchNodes(event.query)
}

const onNodeSelected = async (event: { value: ManagedNode }) => {
  selectedNode.value = event.value
  pendingIfaceChanges.clear()
  pendingSvcChanges.clear()
  saveWarning.value = false
  loadingIfaces.value = true
  try {
    const ifaces = await getInterfacesForNode(event.value.id)
    interfaces.value = ifaces.map(i => ({ ...i, _managed: i.isManaged === 'M', services: undefined }))
    await Promise.all(interfaces.value.map(async iface => {
      const svcs = await getServicesForInterface(event.value.id, iface.ipAddress)
      iface.services = svcs.map(s => ({ ...s, _managed: s.status === 'A' }))
    }))
  } catch {
    showSnackBar({ msg: 'Failed to load interfaces.' })
  } finally {
    loadingIfaces.value = false
  }
}

const toggleInterface = (iface: IfaceRow, managed: boolean) => {
  iface._managed = managed
  pendingIfaceChanges.set(iface.ipAddress, managed)
  saveWarning.value = true
}

const toggleService = (iface: IfaceRow, svc: SvcRow, managed: boolean) => {
  svc._managed = managed
  pendingSvcChanges.set(`${iface.ipAddress}:${svc.serviceType.name}`, managed)
  saveWarning.value = true
}

const applyChanges = async () => {
  if (!selectedNode.value) return
  saving.value = true
  try {
    await Promise.all(
      Array.from(pendingIfaceChanges.entries()).map(([ip, managed]) =>
        setInterfaceManaged(selectedNode.value!.id, ip, managed)
      )
    )
    await Promise.all(
      [...pendingSvcChanges.entries()].map(([key, managed]) => {
        const colonIdx = key.indexOf(':')
        const ip = key.slice(0, colonIdx)
        const serviceName = key.slice(colonIdx + 1)
        return setServiceManaged(ip, serviceName, managed)
      })
    )
    pendingIfaceChanges.clear()
    pendingSvcChanges.clear()
    saveWarning.value = false
    showSnackBar({ msg: 'Changes applied. May take several minutes to update.' })
  } catch {
    showSnackBar({ msg: 'Failed to apply changes.' })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.manage-interfaces {
  padding: 1.5rem;
  max-width: 1200px;

  &__search-row { margin-bottom: 16px; }
  &__node-search { width: 320px; }
  &__warning { margin-bottom: 16px; }
  &__loading, &__empty { padding: 16px; opacity: 0.6; }
  &__table { margin-bottom: 16px; }
  &__services { display: flex; flex-direction: column; gap: 6px; }
  &__svc-row { display: flex; align-items: center; gap: 8px; }
  &__svc-name { min-width: 120px; }
  &__svc-loading { opacity: 0.5; font-style: italic; }
  &__actions { display: flex; justify-content: flex-end; }
}
</style>
