<template>
  <div class="card">
    <div>
      <div class="feather-row title-bar">
        <span class="title">Node List</span>
        <div class="action-buttons-container">
          <NodeDownloadDropdown
            :onCsvDownload="onCsvDownload"
            :onJsonDownload="onJsonDownload"
          />
          <Button
            @click="() => nodeStructureStore.openColumnsDrawerModal()"
          >
            Customize Columns
          </Button>
          <Button
            severity="secondary"
            outlined
            @click="() => nodeStructureStore.clearAllFiltersAndSelections()"
          >
            Clear Filters
          </Button>
        </div>
      </div>
      <div class="spacer-large"></div>
      <div class="spacer-large"></div>
      <div class="search-container feather-col-12">
        <div class="feather-row">
          <div class="filter">
            <div class="search-filter-column">
              <span class="p-input-icon-left search-input-wrap">
                <i class="pi pi-search search-prefix-icon" />
                <InputText
                  v-model="currentSearch"
                  @update:modelValue="searchFilterHandler"
                  placeholder="Search node label or full IP address"
                  class="search-input"
                />
              </span>
            </div>
            <div>
              <Button
                text
                severity="secondary"
                class="filter-btn"
                @click="() => nodeStructureStore.openInstancesDrawerModal()"
                aria-label="Advanced Filters"
              >
                <i class="pi pi-filter" />
              </Button>
            </div>
          </div>
          <div class="chip-container">
            <Chip
              v-for="(cat, index) in nodeStructureStore.selectedCategories"
              :key="`cat-${index}`"
              :label="`Category: ${cat._text}`"
              removable
              @remove="removeItem(cat, FilterTypeEnum.Category)"
              class="filter-chip"
            />

            <Chip
              v-for="(flow, index) in nodeStructureStore.selectedFlows"
              :key="`flow-${index}`"
              :label="`Flow: ${flow._text}`"
              removable
              @remove="removeItem(flow, FilterTypeEnum.Flow)"
              class="filter-chip"
            />

            <Chip
              v-for="loc in nodeStructureStore.queryFilter.selectedMonitoringLocations"
              :key="loc.name"
              :label="`Location: ${loc.name}`"
              removable
              @remove="removeItem(loc, FilterTypeEnum.MonitoringLocation)"
              class="filter-chip"
            />

            <Chip
              v-if="hasExtendedSearchParams"
              label="Extended Search"
              removable
              @remove="removeExtendedSearchItem"
              class="filter-chip"
            />
          </div>
        </div>
      </div>
    </div>
    <div class="feather-row">
      <div class="feather-col-12">
        <div
          id="wrap"
          class="node-table"
        >
          <table
            :class="tableCssClasses"
            summary="Nodes"
            v-if="nodes.length > 0"
          >
            <thead>
              <tr>
                <th
                  v-if="canNavigateLeft"
                  class="navigation-cell"
                >
                  <div @click="navigateColumns(Direction.Left)">
                    <Button text severity="secondary" aria-label="Shift Left" class="nav-btn">
                      <i class="pi pi-chevron-left navigation-icon" />
                    </Button>
                  </div>
                </th>

                <template
                  v-for="column in visibleColumns.sort((a: NodeColumnSelectionItem, b: NodeColumnSelectionItem) => a.order - b.order)"
                  :key="column.id"
                >
                  <th
                    v-if="column.id !== 'ipaddress'"
                    scope="col"
                    class="sortable-header"
                    @click="toggleSort(column.id)"
                  >
                    <span>{{ column.label }}</span>
                    <i
                      v-if="sortStates[column.id] === 'asc'"
                      class="pi pi-sort-up sort-icon"
                    />
                    <i
                      v-else-if="sortStates[column.id] === 'desc'"
                      class="pi pi-sort-down sort-icon"
                    />
                    <i
                      v-else
                      class="pi pi-sort-alt sort-icon sort-icon--none"
                    />
                  </th>
                  <th v-else>{{ column.label }}</th>
                </template>

                <th
                  v-if="canNavigateRight"
                  class="navigation-cell"
                >
                  <div
                    class="icon-container"
                    @click="navigateColumns(Direction.Right)"
                  >
                    <Button text severity="secondary" aria-label="Shift Right" class="nav-btn">
                      <i class="pi pi-chevron-right navigation-icon" />
                    </Button>
                  </div>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="node in nodes"
                :key="node.id"
              >
                <td
                  v-if="canNavigateLeft"
                  class="navigation-cell"
                ></td>
                <template
                  v-for="column in visibleColumns.sort((a: NodeColumnSelectionItem, b: NodeColumnSelectionItem) => a.order - b.order)"
                  :key="column.id"
                >
                  <td v-if="isSelectedColumn(column, 'id')">
                    <router-link :to="`/node/${node.id}`">{{ node.id }}</router-link>
                  </td>
                  <td v-if="isSelectedColumn(column, 'label')">
                    <router-link :to="`/node/${node.id}`">{{ node.label }}</router-link>
                  </td>

                  <ManagementIPTooltipCell
                    v-if="isSelectedColumn(column, 'ipaddress')"
                    :computeNodeIpInterfaceLink="computeNodeIpInterfaceLink"
                    :node="node"
                    :nodeToIpInterfaceMap="nodeStore.nodeToIpInterfaceMap"
                  />

                  <td v-if="isSelectedColumn(column, 'location')">{{ node.location }}</td>

                  <NodeTooltipCell
                    v-if="isSelectedColumn(column, 'foreignSource')"
                    :text="node.foreignSource"
                  />
                  <NodeTooltipCell
                    v-if="isSelectedColumn(column, 'foreignId')"
                    :text="node.foreignId"
                  />
                  <NodeTooltipCell
                    v-if="isSelectedColumn(column, 'sysContact')"
                    :text="node.sysContact"
                  />
                  <NodeTooltipCell
                    v-if="isSelectedColumn(column, 'sysLocation')"
                    :text="node.sysLocation"
                  />
                  <NodeTooltipCell
                    v-if="isSelectedColumn(column, 'sysDescription')"
                    :text="node.sysDescription"
                  />

                  <td v-if="isSelectedColumn(column, 'flows')">
                    <FlowTooltipCell :node="node" />
                  </td>
                </template>

                <td
                  v-if="canNavigateRight"
                  class="navigation-cell"
                ></td>
                <td class="actions-cell">
                  <Button
                    text
                    severity="secondary"
                    class="edit-icon"
                    @click="() => $router.push(`/node/${node.id}`)"
                    aria-label="Edit"
                  >
                    <i class="pi pi-pencil" />
                  </Button>

                  <NodeActionsDropdown
                    :baseHref="mainMenu.baseHref"
                    :node="node"
                    :triggerNodeInfo="onNodeInfo"
                    class="triple-icon"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <EmptyList
            v-else
            :content="emptyListContent"
            data-test="empty-list"
          />
        </div>
      </div>
    </div>
    <Paginator
      v-if="nodeStore.totalCount > 0"
      :rows="queryParameters.limit || 25"
      :rowsPerPageOptions="[10, 20, 50, 100, 200]"
      :totalRecords="nodeStore.totalCount"
      @page="onPaginatorPage"
      class="nodes-paginator"
    />
  </div>
  <NodeDetailsDialog
    :computeNodeLink="computeNodeLink"
    :computeNodeIpInterfaceLink="computeNodeIpInterfaceLink"
    @close="dialogVisible = false"
    :visible="dialogVisible"
    :node="dialogNode"
  >
  </NodeDetailsDialog>
  <NodeAdvancedFiltersDrawer />
  <ColumnSelectionDrawer />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Chip from 'primevue/chip'
import Paginator from 'primevue/paginator'
import useSnackbar from '@/composables/useSnackbar'
import { useMenuStore } from '@/stores/menuStore'
import { useNodeStore } from '@/stores/nodeStore'
import { useNodeStructureStore } from '@/stores/nodeStructureStore'
import {
  Direction,
  FilterTypeEnum,
  Node,
  NodeColumnSelectionItem,
  QueryParameters,
  UpdateModelFunction
} from '@/types'
import { MainMenu } from '@/types/mainMenu'
type IAutocompleteItemType = { [k: string]: unknown }
import { computed, nextTick, reactive, ref, watch } from 'vue'
import ColumnSelectionDrawer from './ColumnSelectionDrawer.vue'
import FlowTooltipCell from './FlowTooltipCell.vue'
import ManagementIPTooltipCell from './ManagementIPTooltipCell.vue'
import NodeActionsDropdown from './NodeActionsDropdown.vue'
import NodeAdvancedFiltersDrawer from './NodeAdvancedFiltersDrawer.vue'
import NodeDetailsDialog from './NodeDetailsDialog.vue'
import NodeDownloadDropdown from './NodeDownloadDropdown.vue'
import NodeTooltipCell from './NodeTooltipCell.vue'
import { useNodeExport } from './hooks/useNodeExport'
import { useNodeQuery } from './hooks/useNodeQuery'
import { getTableCssClasses } from './utils'
import EmptyList from '../Common/EmptyList.vue'

const menuStore = useMenuStore()
const nodeStructureStore = useNodeStructureStore()
const nodeStore = useNodeStore()
const { showSnackBar } = useSnackbar()
const { generateBlob, generateDownload, getExportData } = useNodeExport()
const { buildUpdatedNodeStructureQueryParameters, hasAnyExtendedSearchValues } = useNodeQuery()
const visibleColumnStart = ref(0)
const visibleColumnsCount = 5

const visibleColumns = computed(() => {
  return nodeStructureStore.columns
    .filter(col => col.selected)
    .slice(visibleColumnStart.value, visibleColumnStart.value + visibleColumnsCount)
})

const canNavigateLeft = computed(() => visibleColumnStart.value > 0)
const canNavigateRight = computed(() =>
  visibleColumnStart.value + visibleColumnsCount <
  nodeStructureStore.columns.filter(col => col.selected).length
)

const navigateColumns = (direction: Direction) => {
  if (direction === Direction.Left && canNavigateLeft.value) {
    visibleColumnStart.value -= visibleColumnsCount
  } else if (direction === Direction.Right && canNavigateRight.value) {
    visibleColumnStart.value += visibleColumnsCount
  }
}

// Sort state: 'asc' | 'desc' | undefined
type SortDir = 'asc' | 'desc' | undefined

const sortStates: Record<string, SortDir> = reactive({
  id: undefined,
  label: 'asc',
  ipaddress: undefined,
  location: undefined,
  foreignSource: undefined,
  foreignId: undefined,
  sysContact: undefined,
  sysLocation: undefined,
  sysDescription: undefined,
  flows: undefined
})

const toggleSort = (columnId: string) => {
  if (columnId === 'ipaddress') return

  const current = sortStates[columnId]
  const next: SortDir = current === undefined ? 'asc' : current === 'asc' ? 'desc' : undefined

  // Reset all columns
  for (const key in sortStates) {
    sortStates[key] = undefined
  }

  sortStates[columnId] = next

  if (next !== undefined) {
    updateQuery({ orderBy: columnId, order: next })
  } else {
    updateQuery()
  }
}

const currentSearch = ref(nodeStructureStore.queryFilter.searchTerm || '')
const nodes = computed(() => nodeStore.nodes)
const mainMenu = computed<MainMenu>(() => menuStore.mainMenu)

const dialogVisible = ref(false)
const dialogNode = ref<Node>()
const tableCssClasses = computed<string[]>(() => getTableCssClasses(nodeStructureStore.columns))
const queryParameters = ref<QueryParameters>(nodeStore.nodeQueryParameters)

const isSelectedColumn = (column: NodeColumnSelectionItem, id: string) => {
  return column.selected && column.id === id
}

const onPaginatorPage = (event: { first: number; rows: number; page: number }) => {
  queryParameters.value = {
    ...queryParameters.value,
    limit: event.rows,
    offset: event.first
  }
  nodeStore.setNodeQueryParameters(queryParameters.value)
  updateQuery()
}

const searchFilterHandler: UpdateModelFunction = (val = '') => {
  if (val !== nodeStructureStore.queryFilter.searchTerm) {
    nodeStructureStore.setSearchTerm(val)
  }
}

const onDownload = async (format: string) => {
  const updatedParams = buildUpdatedNodeStructureQueryParameters(queryParameters.value, nodeStructureStore.queryFilter)
  const data = await getExportData(format, updatedParams, nodeStructureStore.columns)

  if (!data) {
    showSnackBar({
      msg: `No data found for '${format}' download with the given search and filter configuration`,
      error: true
    })

    return
  }

  const contentType = format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : ''

  const blob = generateBlob(data, contentType)
  generateDownload(blob, `Nodes.${format}`)
}

const onCsvDownload = async () => { return onDownload('csv') }
const onJsonDownload = async () => { return onDownload('json') }

const onNodeInfo = (node: Node) => {
  dialogNode.value = node
  dialogVisible.value = true
}

const computeNodeLink = (nodeId: number | string) => {
  return `${mainMenu.value.baseHref}${mainMenu.value.baseNodeUrl}${nodeId}`
}

const computeNodeIpInterfaceLink = (nodeId: number | string, ipAddress: string) => {
  return `${mainMenu.value.baseHref}ui/interface/${nodeId}/${encodeURIComponent(ipAddress)}`
}

const hasExtendedSearchParams = computed(() => {
  return hasAnyExtendedSearchValues(nodeStructureStore.queryFilter.extendedSearch)
})

const removeItem = (item: IAutocompleteItemType, type: FilterTypeEnum) => {
  switch (type) {
    case FilterTypeEnum.Category:
      nodeStructureStore.removeCategory(item)
      break
    case FilterTypeEnum.Flow:
      nodeStructureStore.removeFlow(item)
      break
    case FilterTypeEnum.MonitoringLocation:
      nodeStructureStore.removeMonitoringLocation(item)
      break
    default:
      console.warn(`Unknown filter type: ${type}`)
  }
}

const removeExtendedSearchItem = () => {
  nodeStructureStore.removeExtendedSearch()
}

const updateQuery = (options?: { orderBy?: string, order?: SortDir }) => {
  nextTick()

  const queryParamsToUse =
    options?.orderBy ?
      {
        ...nodeStore.nodeQueryParameters,
        orderBy: options.orderBy,
        order: options.order || 'asc'
      }
      : nodeStore.nodeQueryParameters

  const updatedParams = buildUpdatedNodeStructureQueryParameters(queryParamsToUse, nodeStructureStore.queryFilter)
  queryParameters.value = updatedParams

  nodeStore.getNodes(updatedParams, true)
}

const emptyListContent = {
  msg: 'No results found.'
}

watch([() => nodeStructureStore.queryFilter], () => {
  if (nodeStructureStore.queryFilter.searchTerm !== currentSearch.value) {
    currentSearch.value = nodeStructureStore.queryFilter.searchTerm
  }

  updateQuery()
},
{ deep: true }
)
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/table/scss/table";
@import "@/styles/elevation";
@import "@/styles/typography";
@import "@/styles/tokens";

.node-table {
  margin-top: 1rem;
}

#wrap {
  overflow: auto;
  white-space: nowrap;
}

.card {
  @include elevation(2);
  background: var($surface);
  padding: 30px;
}

table {
  @include table;
  @include table-condensed;
  @include row-select();
  @include row-hover();

  tbody {
    tr {
      td {
        padding: 12px 1rem;
      }
    }
  }
}

.sortable-header {
  cursor: pointer;
  user-select: none;

  span {
    vertical-align: middle;
  }

  .sort-icon {
    margin-left: 4px;
    font-size: 0.75rem;
    vertical-align: middle;

    &--none {
      opacity: 0.3;
    }
  }

  &:hover .sort-icon--none {
    opacity: 0.6;
  }
}

.title {
  @include headline1;
  display: block;
}

.filter {
  display: flex;
  align-items: center;
  gap: 10px;

  .search-filter-column {
    position: relative;
  }

  .search-input-wrap {
    display: inline-flex;
    align-items: center;
    position: relative;
  }

  .search-prefix-icon {
    position: absolute;
    left: 0.75rem;
    z-index: 1;
    color: var($secondary-text-on-surface);
  }

  .search-input {
    width: 450px;
    padding-left: 2.25rem !important;
  }

  .filter-btn {
    border: 2px solid var($border-on-surface);
    border-radius: vars.$border-radius-xs;
    padding: 0 0.5rem;
    height: 3rem;
    width: 3rem;
  }
}

.chip-container {
  padding-left: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.25rem;

  .filter-chip {
    font-size: 0.8125rem;
  }
}

.spacer-large {
  margin-bottom: 2rem;
}

.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-right: 1rem;
  padding-left: 1rem;
}

.action-buttons-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.actions-cell {
  .edit-icon {
    padding: 0.25rem;
  }
}

.triple-icon {
  margin-left: 7px;
}

.navigation-cell {
  width: 10px;
}

.nav-btn {
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border-radius: vars.$border-radius-round;
}

.nodes-paginator {
  margin-top: 0.5rem;
}
</style>
