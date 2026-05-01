<template>
  <div>
    <div
      ref="tableWrap"
      id="wrap"
      class="usage-stats-table"
    >
      <table summary="Usage Statistics Sharing">
        <thead>
          <tr>
            <th scope="col" class="sortable-col" @click="sortByColumnHandler({ property: 'name', value: nextSort('name') })">
              Name<span class="sort-indicator">{{ sortIndicator('name') }}</span>
            </th>
            <th scope="col" class="sortable-col" @click="sortByColumnHandler({ property: 'key', value: nextSort('key') })">
              Key name<span class="sort-indicator">{{ sortIndicator('key') }}</span>
            </th>
            <th scope="col" class="sortable-col" @click="sortByColumnHandler({ property: 'description', value: nextSort('description') })">
              Description<span class="sort-indicator">{{ sortIndicator('description') }}</span>
            </th>
            <th scope="col" class="sortable-col" @click="sortByColumnHandler({ property: 'latestValue', value: nextSort('latestValue') })">
              Latest value<span class="sort-indicator">{{ sortIndicator('latestValue') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in filteredData"
            :key="row.key"
          >
            <td>{{ row.name }}</td>
            <td>{{ row.key }}</td>
            <td>{{ row.description }}</td>
            <td v-if="row.isLink">
              <a href="#" @click.prevent="() => showFullValue(row)">See full value</a>
            </td>
            <td v-else-if="shouldClipValue(row)">
              {{ getClippedValue(row) }}
              <a href="#" @click.prevent="() => showFullValue(row)">See full value</a>
            </td>
            <td v-else>{{ row.latestValue }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <UsageStatisticsModal
    @close="showValueModalVisible = false"
    :subtitle="showValueModalSubtitle"
    :visible="showValueModalVisible"
  >
    <template v-slot:content>
      <div v-if="showValueModalVisible">
        <div class="full-value-wrapper">
          <div class="full-value-contents">
            {{ showValueModalContent }}
          </div>
        </div>
      </div>
    </template>
  </UsageStatisticsModal>
</template>

<script setup lang="ts">
import { isNumber, isString } from '@/lib/utils'
import { useUsageStatisticsStore } from '@/stores/usageStatisticsStore'
import { FeatherSortObject } from '@/types'
import {
  UsageStatisticsData,
  UsageStatisticsMetadata,
  UsageStatisticsMetadataItem
} from '@/types/usageStatistics'
import UsageStatisticsModal from './UsageStatisticsModal.vue'

const SORT = {
  NONE: 'none' as const,
  ASCENDING: 'ascending' as const,
  DESCENDING: 'descending' as const
}
type SortValue = typeof SORT[keyof typeof SORT]

interface StatisticsItem {
  // this is just for sorting
  [b: string]: string | boolean
  key: string
  name: string
  description: string
  isLink: boolean
  latestValue: string
}

const STRING_CLIP_LENGTH = 100

const usageStatisticsStore = useUsageStatisticsStore()

const sortStates: Record<string, SortValue> = reactive({
  name: SORT.NONE,
  key: SORT.ASCENDING,
  description: SORT.NONE,
  latestValue: SORT.NONE
})

const showValueModalContent = ref('')
const showValueModalSubtitle = ref('')
const showValueModalVisible = ref(false)

const currentSort = ref<{ property: string; value: SortValue }>({ property: 'key', value: SORT.ASCENDING })
const statistics = computed<UsageStatisticsData>(() => usageStatisticsStore.statistics )
const metadata = computed<UsageStatisticsMetadata>(() => usageStatisticsStore.metadata )

const metadataMap = computed<Map<string,UsageStatisticsMetadataItem>>(() => {
  const map = new Map<string,UsageStatisticsMetadataItem>()

  for (const obj of metadata.value.metadata) {
    const item = {
      key: obj.key,
      name: obj.name || '',
      description: obj.description || '',
      datatype: obj.datatype || 'string'
    } as UsageStatisticsMetadataItem

    map.set(obj.key, item)
  }

  return map
})

const filteredData = computed<StatisticsItem[]>(() => {
  const items = [] as StatisticsItem[]

  if (statistics.value && metadata.value) {
    for (const key of Object.keys(statistics.value)) {
      const statsValue = statistics.value[key]
      const metaItem = metadataMap.value.get(key)

      const { isLink, latestValue } = getLatestValue(statsValue, metaItem)

      const statsItem = {
        key,
        name: metaItem?.name || '',
        description: metaItem?.description || '',
        isLink,
        latestValue
      } as StatisticsItem

      items.push(statsItem)
    }
  }

  // Determine Sort Order
  let sortOrderValues = [0, 0]
  if (currentSort.value.value === SORT.ASCENDING) {
    sortOrderValues = [-1, 1]
  } else if (currentSort.value.value === SORT.DESCENDING) {
    sortOrderValues = [1, -1]
  }


  // Sort the Items
  const currentSortKey = currentSort.value.property

  const sortedItems = items.sort((a, b) => {
    if (a[currentSortKey] > b[currentSortKey]) {
      return sortOrderValues[0]
    } else if (a[currentSortKey] < b[currentSortKey]) {
      return sortOrderValues[1]
    } else {
      return 0
    }
  })

  return sortedItems
})

const getLatestValue = (statsValue: any, metaItem: UsageStatisticsMetadataItem | undefined) => {
  let latestValue = ''
  let isLink = false
  const datatype = metaItem?.datatype || ''

  // use hints from metadata if possible
  if (datatype) {
    if (datatype === 'string') {
      latestValue = (statsValue as string) || '--'
    } else if (datatype === 'boolean') {
      latestValue = statsValue && statsValue === true ? 'Yes' : 'No'
    } else if (datatype === 'number') {
      latestValue = new Intl.NumberFormat().format(statsValue as number)
    } else if (datatype === 'object') {
      isLink = true
    }
  } else {
    // fallback if metadata entry not found
    if (isString(statsValue)) {
      latestValue = (statsValue as string) || '--'
    } else if (isNumber(statsValue)) {
      latestValue = new Intl.NumberFormat().format(statsValue as number)
    } else {
      isLink = true
    }
  }

  return {
    isLink,
    latestValue
  }
}

const shouldClipValue = (row: StatisticsItem) => {
  return !row.isLink && row.latestValue && row.latestValue.length > STRING_CLIP_LENGTH
}

const getClippedValue = (row: StatisticsItem) => {
  return `${row.latestValue.substring(0, STRING_CLIP_LENGTH)}...`
}

const nextSort = (property: string): SortValue => {
  if (sortStates[property] === SORT.NONE || sortStates[property] === SORT.DESCENDING) {
    return SORT.ASCENDING
  }
  return SORT.DESCENDING
}

const sortIndicator = (property: string): string => {
  if (sortStates[property] === SORT.ASCENDING) return ' ▴'
  if (sortStates[property] === SORT.DESCENDING) return ' ▾'
  return ''
}

const sortByColumnHandler = (sortObj: { property: string; value: SortValue }) => {
  for (const key in sortStates) {
    sortStates[key] = SORT.NONE
  }

  sortStates[`${sortObj.property}`] = sortObj.value
  currentSort.value = sortObj
}

const showFullValue = (item: StatisticsItem) => {
  const obj = statistics.value[item.key] || {}

  const value = {
    [item.key]: obj
  }

  const json = JSON.stringify(value, null, 2)

  // show and populate modal
  showValueModalSubtitle.value = item.name || item.key || ''
  showValueModalContent.value = json
  showValueModalVisible.value = true
}

onMounted(() => {
  const wrap = document.getElementById('wrap')
  const thead = document.querySelector('div.usage-stats-table table thead') as HTMLElement

  if (wrap && thead) {
    wrap.addEventListener('scroll', function () {
      const translate = `translate(0, ${this.scrollTop}px)`
      thead.style.transform = translate
    })
  }
})
</script>

<style lang="scss" scoped>
@import "@featherds/styles/mixins/elevation";
@import "@featherds/styles/mixins/typography";
@import "@/styles/tokens";

#wrap {
  height: calc(100vh - 310px);
  overflow: auto;
  white-space: nowrap;

  table {
    margin-top: 0px !important;
    font-size: 12px !important;
    width: 100%;
    border-collapse: collapse;

    th, td {
      padding: 4px 12px;
      text-align: left;
      border-bottom: 1px solid var($border-on-surface);
    }

    tbody tr:nth-child(odd) {
      background: var($shade-4);
    }

    .option {
      margin-left: 8px;
      height: 43px;
      line-height: 3.5;
      padding-left: 15px;
      text-transform: capitalize;
    }
  }

  thead {
    z-index: 2;
    position: relative;
    background: var($surface);
  }

  .sortable-col {
    cursor: pointer;
    user-select: none;
    font-weight: 600;

    &:hover {
      background: var($shade-3);
    }
  }

  .sort-indicator {
    color: var($primary);
  }
}

.full-value-wrapper {
  min-height: 300px;
  min-width: 550px;
  max-width: 660px;
}

.full-value-contents {
  display: block;
  font-family: monospace;
  white-space: pre;
  margin: 0;
}
</style>
