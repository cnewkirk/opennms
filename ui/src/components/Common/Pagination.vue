<template>
  <Paginator
    v-if="totalCount"
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
  const updatedParameters = { ...props.parameters, offset: e.first }
  if (props.payload) {
    props.query({ ...props.payload, queryParameters: updatedParameters })
    return
  }
  props.query(updatedParameters)
}

onMounted(() => props.query(props.payload || props.parameters))
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
.pagination {
  background: var($surface);
  color: var($primary-text-on-surface);
}
</style>
