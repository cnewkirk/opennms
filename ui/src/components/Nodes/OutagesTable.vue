<template>
  <div class="card">
    <div class="feather-row">
      <div class="feather-col-12 headline3">Recent Outages</div>
    </div>
    <div class="feather-row">
      <div class="feather-col-12">
        <table
          class="tl1 tl2 tl3"
          summary="Outages"
        >
          <thead>
            <tr>
              <th scope="col">IP Address</th>
              <th scope="col">Host Name</th>
              <th scope="col">Service Name</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="outage in outages"
              :key="outage.outageId"
            >
              <td>{{ outage.ipAddress }}</td>
              <td>{{ outage.hostname }}</td>
              <td>{{ outage.serviceName }}</td>
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
  </div>
</template>

<script
  setup
  lang="ts"
>
import Paginator from 'primevue/paginator'
import { useNodeStore } from '@/stores/nodeStore'
import { QueryParameters } from '@/types'

const props = defineProps<{ nodeId: string; filterFiql?: string }>()

const nodeStore = useNodeStore()
const limit = ref(10)
const offset = ref(0)
const totalCount = computed(() => nodeStore.outagesTotalCount)

const loadData = async (params: QueryParameters = { limit: limit.value, offset: offset.value }) => {
  const query: QueryParameters = { ...params }
  if (props.filterFiql) query._s = props.filterFiql
  nodeStore.getNodeOutages({ id: props.nodeId, queryParameters: query })
}

const onPage = (e: { first: number; rows: number }) => {
  limit.value = e.rows
  offset.value = e.first
  loadData({ limit: e.rows, offset: e.first })
}

onMounted(() => loadData())

const outages = computed(() => nodeStore.outages)
</script>

<style
  lang="scss"
  scoped
>
@use '@/styles/vars' as vars;
@import "@featherds/table/scss/table";
@import "@/styles/elevation";
.card {
  @include elevation(2);
  padding: 15px;
  margin-bottom: 15px;
  border-radius: vars.$border-radius-surface;
}
table {
  @include table;
}
</style>
