<template>
  <div class="snmp-interfaces">
    <BreadCrumbs :items="breadcrumbs" />

    <div class="snmp-interfaces__search-row">
      <AutoComplete
        v-model="selectedNode"
        :suggestions="nodeSuggestions"
        option-label="label"
        placeholder="Search for a node…"
        @complete="onNodeSearch"
        @option-select="onNodeSelected"
        class="snmp-interfaces__node-search"
      />
    </div>

    <div v-if="loading" class="snmp-interfaces__loading">Loading SNMP interfaces…</div>

    <DataTable
      v-else-if="interfaces.length"
      :value="interfaces"
      size="small"
      striped-rows
      class="snmp-interfaces__table"
    >
      <Column field="ifIndex" header="ifIndex" sortable />
      <Column header="Name / Desc">
        <template #body="{ data }">
          {{ data.ifName || data.ifDescr || '—' }}
          <span v-if="data.ifAlias" class="snmp-interfaces__alias">({{ data.ifAlias }})</span>
        </template>
      </Column>
      <Column field="ifSpeed" header="Speed" sortable>
        <template #body="{ data }">{{ data.ifSpeed ? (data.ifSpeed / 1_000_000).toFixed(0) + ' Mbps' : '—' }}</template>
      </Column>
      <Column header="Collect">
        <template #body="{ data }">
          <ToggleSwitch
            :model-value="data.collect"
            :disabled="data._saving"
            @update:model-value="val => toggleCollect(data, val)"
          />
        </template>
      </Column>
    </DataTable>

    <div v-else-if="selectedNode" class="snmp-interfaces__empty">
      No SNMP interfaces found for this node.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import AutoComplete from 'primevue/autocomplete'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ToggleSwitch from 'primevue/toggleswitch'
import { BreadCrumb } from '@/types'
import { useMenuStore } from '@/stores/menuStore'
import useSnackbar from '@/composables/useSnackbar'
import { searchNodes, type ManagedNode } from '@/services/manageInterfacesService'
import {
  getSnmpInterfaces,
  setSnmpCollect,
  type SnmpInterface
} from '@/services/snmpInterfacesService'

const menuStore = useMenuStore()
const { showSnackBar } = useSnackbar()

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: menuStore.mainMenu.homeUrl, isAbsoluteLink: true },
  { label: 'Admin', to: '/admin' },
  { label: 'SNMP Interfaces', to: '#', position: 'last' }
])

type SnmpRow = SnmpInterface & { _saving: boolean }

const selectedNode = ref<ManagedNode | null>(null)
const nodeSuggestions = ref<ManagedNode[]>([])
const interfaces = ref<SnmpRow[]>([])
const loading = ref(false)

const onNodeSearch = async (event: { query: string }) => {
  nodeSuggestions.value = await searchNodes(event.query)
}

const onNodeSelected = async (event: { value: ManagedNode }) => {
  selectedNode.value = event.value
  loading.value = true
  try {
    const ifaces = await getSnmpInterfaces(event.value.id)
    interfaces.value = ifaces.map(i => ({ ...i, _saving: false }))
  } catch {
    showSnackBar({ msg: 'Failed to load SNMP interfaces.' })
  } finally {
    loading.value = false
  }
}

const toggleCollect = async (iface: SnmpRow, collect: boolean) => {
  if (!selectedNode.value) return
  iface._saving = true
  try {
    await setSnmpCollect(selectedNode.value.id, iface.ifIndex, collect)
    iface.collect = collect
    showSnackBar({ msg: `Collection ${collect ? 'enabled' : 'disabled'} for ${iface.ifName || iface.ifIndex}.` })
  } catch {
    showSnackBar({ msg: 'Failed to update SNMP collection setting.' })
  } finally {
    iface._saving = false
  }
}
</script>

<style scoped lang="scss">
.snmp-interfaces {
  padding: 1.5rem;
  max-width: 1200px;

  &__search-row { margin-bottom: 16px; }
  &__node-search { width: 320px; }
  &__loading, &__empty { padding: 16px; opacity: 0.6; }
  &__alias { opacity: 0.6; font-size: 0.85em; margin-left: 4px; }
  &__table { margin-bottom: 16px; }
}
</style>
