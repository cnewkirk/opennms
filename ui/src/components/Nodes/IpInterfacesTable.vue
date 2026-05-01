<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <table
        class="tl1 tl2 tl3"
        summary="IP Interfaces"
      >
        <thead>
          <tr>
            <th scope="col">IP Address</th>
            <th scope="col">IP Host Name</th>
            <th scope="col">SNMP ifIndex</th>
            <th scope="col">Managed</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="ipInterface in ipInterfaces"
            :key="ipInterface.id"
          >
            <td>{{ ipInterface.ipAddress }}</td>
            <td>{{ ipInterface.hostName || 'N/A' }}</td>
            <td>{{ ipInterface.ifIndex || 'N/A' }}</td>
            <td>{{ ipInterface.isManaged || 'N/A' }}</td>
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

const nodeStore = useNodeStore()
const route = useRoute()
const limit = ref(5)
const offset = ref(0)
const totalCount = computed(() => nodeStore.ipInterfacesTotalCount)

const loadData = async (params: QueryParameters = { limit: limit.value, offset: offset.value, _s: 'isManaged==U,isManaged==P,isManaged==N,isManaged==M' }) => {
  nodeStore.getNodeIpInterfaces({ id: route.params.id as string, queryParameters: params })
}

const onPage = (e: { first: number; rows: number }) => {
  limit.value = e.rows
  offset.value = e.first
  loadData({ limit: e.rows, offset: e.first, _s: 'isManaged==U,isManaged==P,isManaged==N,isManaged==M' })
}

onMounted(() => loadData())

const ipInterfaces = computed(() => nodeStore.ipInterfaces)
</script>

<style lang="scss">
@import "@featherds/table/scss/table";
table {
  @include table;
}
</style>
