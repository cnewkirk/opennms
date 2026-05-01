<template>
  <Paginator
    v-show="totalCount"
    class="pagination"
    :rows="pageSize"
    :totalRecords="totalCount"
    @page="onPage"
  />
</template>

<script setup lang="ts">
import Paginator from 'primevue/paginator'
import { PropType } from 'vue'
import { QueryParameters } from '@/types'

const props = defineProps({
  query: {
    required: true,
    type: Function as PropType<(params: QueryParameters) => void>
  },
  getTotalCount: {
    required: true,
    type: Function as PropType<() => number>
  },
  parameters: {
    type: Object,
    required: true
  },
  payload: {
    type: Object,
    required: false
  }
})

const pageSize = computed(() => props.parameters.limit ?? 25)

const totalCount = computed(() => {
  const count = props.getTotalCount()
  return count && !isNaN(count) ? count : 0
})

const onPage = (e: { first: number }) => {
  runQuery({ ...props.parameters, offset: e.first })
}

const runQuery = (params = props.parameters) => {
  if (props.payload) {
    props.query({ ...props.payload, queryParameters: params })
  } else {
    props.query(params)
  }
}

watch(() => props.parameters.limit, (newLimit, oldLimit) => {
  if (newLimit !== oldLimit) runQuery({ ...props.parameters, offset: 0 })
})

onMounted(() => runQuery())
</script>

<style scoped lang="scss">
@import "@/styles/tokens";
.pagination {
  background: var($surface);
  color: var($primary-text-on-surface);
}
</style>
