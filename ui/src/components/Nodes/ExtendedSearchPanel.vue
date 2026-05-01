<template>
  <div class="extended-search-container">
    <Select
      v-model="currentSelection"
      :options="searchOptions"
      optionLabel="title"
      placeholder="Search Type"
      class="extended-search-select"
      @update:modelValue="onSearchTypeSelectionUpdated"
    />

    <InputText
      v-model="searchTerm"
      placeholder="Search Term"
      class="extended-search-input"
      @update:modelValue="onCurrentSearchUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import { isIP } from 'is-ip'
import { useNodeStructureStore } from '@/stores/nodeStructureStore'
import { NodeQueryFilter } from '@/types'

interface SearchOption {
  title: string
  value: string
}

const searchOptions: SearchOption[] = [
  { title: 'Foreign Source', value: 'foreignSource' },
  { title: 'Foreign ID', value: 'foreignId' },
  { title: 'Foreign Source:Foreign ID', value: 'foreignSourceId' },
  { title: 'IP Address', value: 'ipAddress' },
  { title: 'Sys Contact', value: 'sysContact' },
  { title: 'Sys Description', value: 'sysDescription' },
  { title: 'Sys Location', value: 'sysLocation' },
  { title: 'Sys Name', value: 'sysName' },
  { title: 'Sys Object ID', value: 'sysObjectId' },
  { title: 'SNMP Alias', value: 'snmpIfAlias' },
  { title: 'SNMP Description', value: 'snmpIfDescription' },
  { title: 'SNMP Index', value: 'snmpIfIndex' },
  { title: 'SNMP Name', value: 'snmpIfName' },
  { title: 'SNMP Type', value: 'snmpIfType' }
]

const foreignSourceKeys = ['foreignSource', 'foreignId', 'foreignSourceId']
const snmpKeys = ['snmpIfAlias', 'snmpIfDescription', 'snmpIfIndex', 'snmpIfName', 'snmpIfType']
const sysKeys = ['sysContact', 'sysDescription', 'sysLocation', 'sysName', 'sysObjectId']

const nodeStructureStore = useNodeStructureStore()
const searchTerm = ref('')
const currentSelection = ref<SearchOption | undefined>(undefined)

const onCurrentSearchUpdated = (updatedValue: any) => {
  const item = (updatedValue as string) ?? ''
  const searchType = currentSelection.value?.value as string || ''

  if (searchType === 'ipAddress') {
    if ((item === '' || isIP(item)) && item !== nodeStructureStore.queryFilter.extendedSearch.ipAddress) {
      nodeStructureStore.setFilterWithIpAddress(item)
    }
  } else if (searchType.startsWith('foreign')) {
    const params = nodeStructureStore.queryFilter.extendedSearch.foreignSourceParams
    const storeItem = (params && (params as any)[searchType]) ?? ''

    if (item !== storeItem) {
      nodeStructureStore.setFilterWithForeignSourceParams(searchType, item)
    }
  } else if (searchType.startsWith('snmp')) {
    const params = nodeStructureStore.queryFilter.extendedSearch.snmpParams
    const storeItem = (params && (params as any)[searchType]) ?? ''

    if (item !== storeItem) {
      nodeStructureStore.setFilterWithSnmpParams(searchType, item)
    }
  } else if (searchType.startsWith('sys')) {
    const params = nodeStructureStore.queryFilter.extendedSearch.sysParams
    const storeItem = (params && (params as any)[searchType]) ?? ''

    if (item !== storeItem) {
      nodeStructureStore.setFilterWithSysParams(searchType, item)
    }
  }
}

const onSearchTypeSelectionUpdated = (selected: SearchOption | undefined) => {
  if (!selected) return
  if (selected.value === 'ipAddress') {
    nodeStructureStore.setFilterWithIpAddress(searchTerm.value)
  } else if ((selected.value as string || '').startsWith('foreign')) {
    nodeStructureStore.setFilterWithForeignSourceParams(selected.value, searchTerm.value)
  } else if ((selected.value as string || '').startsWith('sys')) {
    nodeStructureStore.setFilterWithSysParams(selected.value, searchTerm.value)
  } else if ((selected.value as string || '').startsWith('snmp')) {
    nodeStructureStore.setFilterWithSnmpParams(selected.value, searchTerm.value)
  }
}

// helper used in getOptionFromFilter
const getAnySearchOptionFromObj = (obj: any, keys: string[]) => {
  for (let key of keys) {
    if (obj[key]) {
      return {
        value: obj[key],
        searchOption: searchOptions.find(x => x.value === key)
      }
    }
  }

  return undefined
}

/**
 * Get an option object and search term based on the given filter.
 * This prioritizes which search item is used.
*/
const getOptionFromFilter = (queryFilter: NodeQueryFilter) => {
  if (queryFilter.extendedSearch.ipAddress) {
    return getAnySearchOptionFromObj(queryFilter.extendedSearch, ['ipAddress'])
  }

  if (queryFilter.extendedSearch.foreignSourceParams) {
    const o = getAnySearchOptionFromObj(queryFilter.extendedSearch.foreignSourceParams, foreignSourceKeys)
    if (o) {
      return o
    }
  }

  if (queryFilter.extendedSearch.snmpParams) {
    const o = getAnySearchOptionFromObj(queryFilter.extendedSearch.snmpParams, snmpKeys)
    if (o) {
      return o
    }
  }

  if (queryFilter.extendedSearch.sysParams) {
    const o = getAnySearchOptionFromObj(queryFilter.extendedSearch.sysParams, sysKeys)
    if (o) {
      return o
    }
  }

  return undefined
}

const updateFromStore = () => {
  const option = getOptionFromFilter(nodeStructureStore.queryFilter)

  if (option) {
    if (option.value !== searchTerm.value) {
      searchTerm.value = option.value
    }

    if (currentSelection.value !== option.searchOption) {
      currentSelection.value = option.searchOption
    }
  } else {
    if (searchTerm.value !== '') {
      searchTerm.value = ''
    }
  }
}

watch([() => nodeStructureStore.queryFilter], () => {
  updateFromStore()
})

onMounted(() => {
  updateFromStore()
})
</script>

<style lang="scss" scoped>
.extended-search-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.extended-search-select,
.extended-search-input {
  width: 100%;
}
</style>
