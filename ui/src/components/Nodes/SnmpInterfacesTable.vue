<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <table
        class="tl1 tl2 tl3, tl4, tl5"
        summary="SNMP Interfaces"
      >
        <thead>
          <tr>
            <th scope="col">SNMP ifIndex</th>
            <th scope="col">SNMP ifDescr</th>
            <th scope="col">SNMP ifName</th>
            <th scope="col">SNMP ifAlias</th>
            <th scope="col">SNMP ifSpeed</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="snmpInterface in snmpInterfaces"
            :key="snmpInterface.id"
          >
            <td>{{ snmpInterface.ifIndex }}</td>
            <td>{{ snmpInterface.ifDescr || 'N/A' }}</td>
            <td>{{ snmpInterface.ifName || 'N/A' }}</td>
            <td>{{ snmpInterface.ifAlias || 'N/A' }}</td>
            <td>
              <span v-html="snmpInterface.ifSpeed"></span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <Paginator
    v-if="totalCount > 0"
    :rows="limit"
    :rowsPerPageOptions="[5, 10, 25, 50]"
    :totalRecords="totalCount"
    @page="onPage"
  />
</template>

<script
  setup
  lang="ts"
>
import Paginator from 'primevue/paginator'
import { useNodeStore } from '@/stores/nodeStore'
import { QueryParameters } from '@/types'

const route = useRoute()
const nodeStore = useNodeStore()
const limit = ref(5)
const offset = ref(0)
const totalCount = computed(() => nodeStore.snmpInterfacesTotalCount)

const loadData = async (params: QueryParameters = { limit: limit.value, offset: offset.value }) => {
  nodeStore.getNodeSnmpInterfaces({ id: route.params.id as string, queryParameters: params })
}

const onPage = (e: { first: number; rows: number }) => {
  limit.value = e.rows
  offset.value = e.first
  loadData({ limit: e.rows, offset: e.first })
}

onMounted(() => loadData())

const snmpInterfaces = computed(() => nodeStore.snmpInterfaces)
</script>

<style lang="scss">
table {
  @include table;
}
</style>
