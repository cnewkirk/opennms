<template>
  <div class="main-wrapper">
    <table class="condensed">
      <thead>
        <tr class="tr">
          <th scope="col" class="onms-sort-header sortable" @click="nextSort(RequisitionData.ImportName)">
            Name<span class="sort-icon">{{ sortIndicator(RequisitionData.ImportName) }}</span>
          </th>
          <th scope="col" class="onms-sort-header sortable" @click="nextSort(RequisitionData.ImportURL)">
            URL<span class="sort-icon">{{ sortIndicator(RequisitionData.ImportURL) }}</span>
          </th>
          <th
            scope="col"
            class="onms-sort-header"
          >
            Schedule Frequency
          </th>
          <th scope="col" class="onms-sort-header sortable" @click="nextSort(RequisitionData.RescanExisting)">
            Rescan Behavior<span class="sort-icon">{{ sortIndicator(RequisitionData.RescanExisting) }}</span>
          </th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr
          v-bind:key="key"
          v-for="(item, key) in filteredItems"
        >
          <td>
            <ConfigurationCopyPasteDisplay :text="item[RequisitionData.ImportName]" />
          </td>
          <td>
            <ConfigurationCopyPasteDisplay :text="item[RequisitionData.ImportURL]" />
          </td>
          <td>
            <ConfigurationCopyPasteDisplay
              :showCopyBtn="false"
              :text="ConfigurationHelper.cronToEnglish(item[RequisitionData.CronSchedule])"
            />
          </td>
          <td>
            {{ rescanToEnglish(item[RequisitionData.RescanExisting]) }}
          </td>
          <td>
            <div class="flex">
              <Button
                text
                @click="() => props.editClicked(item.originalIndex)"
                :disabled="Boolean(item[RequisitionData.ImportURL].startsWith('requisition://'))"
                data-test="edit-btn"
                aria-label="Edit"
              >
                <i class="pi pi-pencil" />
              </Button>
              <Button
                text
                @click="() => props.deleteClicked(item.originalIndex)"
                aria-label="Delete"
              >
                <i class="pi pi-trash delete-icon" />
              </Button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <Paginator
      :totalRecords="pageVals.total"
      :rows="pageVals.pageSize"
      :first="(pageVals.page - 1) * pageVals.pageSize"
      @page="(e) => { pageUpdate(e.page + 1); pageSizeUpdate(e.rows) }"
    />
  </div>
</template>

<script
  setup
  lang="ts"
>
import { ComputedRef, PropType } from 'vue'
import Paginator from 'primevue/paginator'
import Button from 'primevue/button'

import { RequisitionData } from './copy/requisitionTypes'
import { ConfigurationHelper } from './ConfigurationHelper'
import ConfigurationCopyPasteDisplay from './ConfigurationCopyPasteDisplay.vue'
import { ConfigurationPageVals, ProvisionDServerConfiguration } from './configuration.types'
import { rescanCopy } from './copy/rescanItems'

/**
 * Props
 */
const props = defineProps({
  itemList: { required: true, type: Array as PropType<Array<ProvisionDServerConfiguration>> },
  editClicked: { type: Function, required: true },
  deleteClicked: { type: Function, required: true },
  setNewPage: { type: Function, required: true }
})

/**
 * Local State
 */
type SortDir = 'asc' | 'desc' | undefined
const sortField = ref<string | undefined>(undefined)
const sortDir = ref<SortDir>(undefined)

const nextSort = (field: string) => {
  if (sortField.value !== field) {
    sortField.value = field
    sortDir.value = 'asc'
  } else if (sortDir.value === 'asc') {
    sortDir.value = 'desc'
  } else {
    sortField.value = undefined
    sortDir.value = undefined
  }
}

const sortIndicator = (field: string) => {
  if (sortField.value !== field) return ''
  return sortDir.value === 'asc' ? ' ▲' : ' ▼'
}

const itemList = computed(() => props.itemList)

const pageVals: ComputedRef<ConfigurationPageVals> = computed(() => {
  return reactive({
    total: itemList?.value?.length || 0,
    page: pageVals?.value?.page || 1,
    pageSize: pageVals?.value?.pageSize || 10
  })
})

/**
 * Sorts and filters all of the given items by the current state of the table.
 */
const filteredItems = computed(() => {
  const currentTablePage = pageVals.value.pageSize * (pageVals.value.page - 1)
  const currentSortKey = sortField.value || ''

  let myItems: Array<ProvisionDServerConfiguration> = [...itemList.value]

  // obfuscate password
  myItems = myItems.map((item) => ({
    ...item,
    [RequisitionData.ImportURL]: ConfigurationHelper.obfuscatePassword(item[RequisitionData.ImportURL])
  }))

  // Determine Sort Order
  let sortOrderValues = [0, 0]
  if (sortDir.value === 'asc') {
    sortOrderValues = [-1, 1]
  } else if (sortDir.value === 'desc') {
    sortOrderValues = [1, -1]
  }

  // Sort the Items
  const sortedItemsTotal = myItems.sort((a, b) => {
    if (a[currentSortKey] > b[currentSortKey]) {
      return sortOrderValues[0]
    } else if (a[currentSortKey] < b[currentSortKey]) {
      return sortOrderValues[1]
    } else {
      return 0
    }
  })

  // Keep only the current page.
  return sortedItemsTotal?.slice(currentTablePage, currentTablePage + pageVals.value.pageSize)
})

/**
 * When the user changes the page number.
 */
const pageUpdate = (newPage: number) => {
  pageVals.value.page = newPage
  if (props.setNewPage) {
    props.setNewPage(newPage)
  }
}

/**
 * When the user updates the page size.
 */
const pageSizeUpdate = (newPageSize: number) => {
  pageVals.value.pageSize = newPageSize
}

/**
 * Convert our Rescan Existing value to something more understandable by Humans.
 */
const rescanToEnglish = (rescanVal: string) => {
  return rescanCopy[rescanVal]
}
</script>
<style lang="scss">
@use "@/styles/table" as *;

table {
  @include table();
  @include table-condensed();
}
</style>
<style
  lang="scss"
  scoped
>
@use "@/styles/table" as *;
@import "@/styles/tokens";

.main-wrapper {
  table.condensed {
    .onms-sort-header {
      text-align: left;
    }
  }
}
.sortable {
  cursor: pointer;
  user-select: none;
}
.sort-icon {
  margin-left: 4px;
}
.flex {
  display: flex;
}
.tr {
  background-color: var($background);
  .th {
    color: var($primary);
  }
}
.delete-icon {
  color: var($error);
}
.main-wrapper {
  padding: 16px 24px;
}
.cron {
  max-width: 260px;
}
</style>

