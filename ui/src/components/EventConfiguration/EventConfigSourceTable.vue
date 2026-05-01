<template>
  <TableCard class="event-configuration-table">
    <div class="header">
      <div class="title-container">
        <!-- <span class="title"> SNMP Interfaces </span> -->
      </div>
      <div class="action-container">
        <div class="search-container">
          <span class="p-input-icon-left w-full">
            <i class="pi pi-search" />
            <InputText
              type="search"
              data-test="search-input"
              v-model.trim="store.sourcesSearchTerm"
              placeholder="Search by Source, Vendor, UEI or Label"
              class="w-full"
              @update:modelValue="((e: string) => onChangeSearchTerm(e))"
            />
          </span>
        </div>
        <div class="refresh">
          <Button
            icon="pi pi-refresh"
            data-test="refresh-button"
            @click="store.refreshSourcesFilters()"
          />
        </div>
      </div>
    </div>
    <div class="container">
      <table
        class="data-table"
        aria-label="Events Table"
        v-if="store.sources.length"
      >
        <thead>
          <tr>
            <th
              v-for="col of columns"
              :key="col.label"
              scope="col"
              class="sortable-header"
              @click="nextSort(col.id)"
            >
              {{ col.label }}<span>{{ sortIndicator(col.id) }}</span>
            </th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <TransitionGroup
          name="data-table"
          tag="tbody"
        >
          <tr
            v-for="config in store.sources"
            :key="config.id"
          >
            <td>{{ config.name }}</td>
            <td>{{ config.vendor }}</td>
            <td>{{ config.eventCount }}</td>
            <td>{{ config.enabled ? 'Enabled' : 'Disabled' }}</td>
            <td>
              <div class="action-container">
                <Button
                  icon="pi pi-eye"
                  text
                  v-tooltip.top="'View Details'"
                  data-test="view-button"
                  @click="onEventClick(config)"
                />
                <Button
                  icon="pi pi-download"
                  text
                  v-tooltip.top="'Download XML'"
                  data-test="download-button"
                  @click="downloadEventConfXmlBySourceId(config.id)"
                />
                <Button
                  icon="pi pi-ellipsis-v"
                  text
                  :aria-label="`More actions for ${config.name}`"
                  @click="(e) => toggleMenu(e, config)"
                />
                <Menu
                  :ref="(el) => setMenuRef(el, config.id)"
                  :model="getMenuItems(config)"
                  :popup="true"
                />
              </div>
            </td>
          </tr>
        </TransitionGroup>
      </table>
      <div
        class="alerts-pagination"
        v-if="store.sources.length"
      >
        <Paginator
          :first="(store.sourcesPagination.page - 1) * store.sourcesPagination.pageSize"
          :rows="store.sourcesPagination.pageSize"
          :totalRecords="store.sourcesPagination.total"
          :rowsPerPageOptions="[10, 20, 50, 100, 200]"
          data-test="FeatherPagination"
          @page="(e) => { store.onSourcePageChange(e.page + 1); store.onSourcePageSizeChange(e.rows) }"
        />
      </div>
      <div v-if="!store.sources.length">
        <EmptyList
          :content="emptyListContent"
          data-test="empty-list"
        />
      </div>
    </div>
    <DeleteEventConfigSourceDialog />
    <ChangeEventConfigSourceStatusDialog />
  </TableCard>
</template>

<script lang="ts" setup>
import { VENDOR_OPENNMS } from '@/lib/utils'
import { downloadEventConfXmlBySourceId } from '@/services/eventConfigService'
import { useEventConfigStore } from '@/stores/eventConfigStore'
import { EventConfigSource } from '@/types/eventConfig'
import Tooltip from 'primevue/tooltip'
const vTooltip = Tooltip
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Menu from 'primevue/menu'
import Paginator from 'primevue/paginator'
import { debounce } from 'lodash'
import EmptyList from '../Common/EmptyList.vue'
import TableCard from '../Common/TableCard.vue'
import ChangeEventConfigSourceStatusDialog from './Dialog/ChangeEventConfigSourceStatusDialog.vue'
import DeleteEventConfigSourceDialog from './Dialog/DeleteEventConfigSourceDialog.vue'

const router = useRouter()
const store = useEventConfigStore()
const emptyListContent = {
  msg: 'No results found.'
}

const columns = computed(() => [
  { id: 'name', label: 'Source' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'eventCount', label: 'Event Count' }
])

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
  if (sortField.value && sortDir.value) {
    store.onSourcesSortChange(sortField.value, sortDir.value)
  } else {
    store.onSourcesSortChange('createdTime', 'desc')
  }
}

const sortIndicator = (field: string) => {
  if (sortField.value !== field) return ''
  return sortDir.value === 'asc' ? ' ▲' : ' ▼'
}

const onEventClick = (source: EventConfigSource) => {
  router.push({
    name: 'Event Configuration Detail',
    params: { id: source.id }
  })
}

// Per-row Menu refs
const menuRefs = ref<Record<number, any>>({})
const setMenuRef = (el: any, id: number) => {
  if (el) menuRefs.value[id] = el
}
const toggleMenu = (event: Event, config: EventConfigSource) => {
  menuRefs.value[config.id]?.toggle(event)
}
const getMenuItems = (config: EventConfigSource) => {
  const items: any[] = [
    {
      label: config.enabled ? 'Disable Source' : 'Enable Source',
      command: () => store.showChangeEventConfigSourceStatusDialog(config),
      'data-test': 'change-status-button'
    }
  ]
  if (config.vendor !== VENDOR_OPENNMS) {
    items.push({
      label: 'Delete Source',
      command: () => store.showDeleteEventConfigSourceModal(config),
      'data-test': 'delete-source-button'
    })
  }
  return items
}

const onChangeSearchTerm = debounce(async (value: string) => {
  await store.onChangeSourcesSearchTerm(value)
}, 500)

onMounted(async () => {
  await store.fetchEventConfigs()
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use "@/styles/tokens" as variables;
@use '@featherds/styles/mixins/typography';
@use '@featherds/table/scss/table';
@use '@/styles/_transitionDataTable';

.sortable-header {
  cursor: pointer;
  user-select: none;
}

.event-configuration-table {
  margin-top: 10px;
  padding: 25px;

  .header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;

    .title-container {
      display: flex;
      align-items: center;

      .title {
        @include typography.headline3;
      }
    }

    .action-container {
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      gap: 5px;
      width: 30%;

      .search-container {
        width: 80%;
      }
    }
  }

  .container {
    table {
      width: 100%;
      @include table.table;

      thead {
        background: var(variables.$background);
        text-transform: uppercase;
      }

      td {
        white-space: nowrap;
        box-shadow: none;
        border-bottom: 1px solid var(variables.$border-on-surface);

        div {
          border-radius: vars.$border-radius-xs;
          padding: 0px 5px 0px 5px;
        }

        .action-container {
          display: flex;
          align-items: center;
          gap: 5px;

          button {
            margin: 0px;
          }

          :deep(.feather-menu-dropdown) {
            .feather-dropdown {
              li {
                a {
                  padding: 8px 16px !important;
                }
              }
            }
          }
        }
      }
    }

    .alerts-pagination {
      display: flex;
      justify-content: flex-end;
      padding: var(variables.$spacing-xxs);
      border-bottom: 1px solid var(--feather-border-on-surface);
      border-left: 1px solid var(--feather-border-on-surface);
      border-right: 1px solid var(--feather-border-on-surface);
    }

    .feather-pagination {
      border: none !important;
    }
  }
}
</style>

