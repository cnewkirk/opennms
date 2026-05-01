<template>
  <div class="card">
    <div class="feather-row">
      <div class="feather-col-12 headline3">Recent Events</div>
    </div>
    <div class="feather-row">
      <div class="feather-col-12">
        <table
          class="tl1 tl2 tl3 tl4"
          summary="Recent Events"
        >
          <thead>
            <tr>
              <th scope="col">Id</th>
              <th scope="col">Created</th>
              <th scope="col">Severity</th>
              <th scope="col">Message</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="event in events"
              :key="event.id"
              :class="getRowClass(event)"
            >
              <td>
                <router-link :to="`/event/${event.id}`">{{ event.id }}</router-link>
              </td>
              <td v-date>{{ event.createTime }}</td>
              <td><SeverityBadge :severity="event.severity" /></td>
              <td>
                <span
                  v-html="event.logMessage"
                  class="log-message"
                ></span>
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
  </div>
</template>

<script
  setup
  lang="ts"
>
import Paginator from 'primevue/paginator'
import SeverityBadge from '../Common/SeverityBadge.vue'
import { useEventStore } from '@/stores/eventStore'
import { Event, QueryParameters } from '@/types'

const props = defineProps<{ nodeId: string; filterFiql?: string }>()

const eventStore = useEventStore()
const limit = ref(5)
const offset = ref(0)
const totalCount = computed(() => eventStore.totalCount)

const loadData = async (params: QueryParameters = { limit: limit.value, offset: offset.value }) => {
  const query: QueryParameters = { ...params }
  if (props.filterFiql) query._s = props.filterFiql
  else query._s = `node.id==${props.nodeId}`
  await eventStore.getEvents(query)
}

const onPage = (e: { first: number; rows: number }) => {
  limit.value = e.rows
  offset.value = e.first
  loadData({ limit: e.rows, offset: e.first })
}

onMounted(() => loadData())

const events = computed(() => eventStore.events)
const getRowClass = (data: Event) => `row--${data.severity.toLowerCase()}`
</script>

<style
  lang="scss"
  scoped
>
@use '@/styles/vars' as vars;
@use "@/styles/tokens" as fvars;
@use '@featherds/styles/themes/utils';
@import "@featherds/table/scss/table";
@import "@featherds/styles/mixins/elevation";
.card {
  @include elevation(2);
  padding: 15px;
  margin-bottom: 15px;
  border-radius: vars.$border-radius-surface;
}
table {
  @include table;
}
.log-message {
  p {
    margin: 0px;
  }
}
// border-left on <tr> is ignored in border-separate mode; target first td instead
$row-opacity: 0.15;
.row {
  &--critical      { background: utils.alpha(fvars.$error,         $row-opacity); td:first-child { border-left: 3px solid var(--feather-error); } }
  &--major         { background: utils.alpha(fvars.$major,         $row-opacity); td:first-child { border-left: 3px solid var(--feather-major); } }
  &--minor         { background: utils.alpha(fvars.$minor,         $row-opacity); td:first-child { border-left: 3px solid var(--feather-minor); } }
  &--warning       { background: utils.alpha(fvars.$warning,       $row-opacity); td:first-child { border-left: 3px solid var(--feather-warning); } }
  &--normal        { background: utils.alpha(fvars.$success,       $row-opacity); td:first-child { border-left: 3px solid var(--feather-success); } }
  &--cleared,
  &--unacknowledged { background: utils.alpha(fvars.$cleared,      $row-opacity); td:first-child { border-left: 3px solid var(--feather-cleared); } }
  &--indeterminate { background: utils.alpha(fvars.$indeterminate, $row-opacity); td:first-child { border-left: 3px solid var(--feather-indeterminate); } }
}
</style>
