<template>
  <TableCard class="event-config-event-table">
    <div class="header">
      <div class="title-container">
        <span class="title"> Event Configurations </span>
      </div>
      <div class="action-container">
        <div class="search-container">
          <span class="p-input-icon-left w-full">
            <i class="pi pi-search" />
            <InputText
              type="search"
              data-test="search-input"
              v-model.trim="store.eventsSearchTerm"
              placeholder="Search by Event UEI or Event Label"
              class="w-full"
              @update:modelValue="((e: string) => onChangeSearchTerm(e))"
            />
          </span>
        </div>
        <div class="refresh">
          <Button
            icon="pi pi-refresh"
            @click="store.refreshEventConfigEvents()"
          />
        </div>
      </div>
    </div>
    <div class="container">
      <table
        class="data-table"
        aria-label="Events Table"
        v-if="store.events.length"
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
            <th>Actions</th>
          </tr>
        </thead>
        <TransitionGroup
          name="data-table"
          tag="tbody"
        >
          <template
            v-for="event in store.events"
            :key="event.id"
          >
            <tr>
              <td>{{ event.uei }}</td>
              <td>{{ event.eventLabel }}</td>
              <td>
                <SeverityBadge :severity="event.severity" />
              </td>
              <td>{{ event.enabled ? 'Enabled' : 'Disabled' }}</td>
              <td>
                <div class="action-container">
                  <Button
                    icon="pi pi-pencil"
                    text
                    :aria-label="`Edit ${event.eventLabel}`"
                    data-test="edit-button"
                    @click="onEditEvent(event)"
                  />
                  <Button
                    icon="pi pi-ellipsis-v"
                    text
                    aria-label="More Options"
                    @click="(e) => toggleEventMenu(e, event)"
                  />
                  <Menu
                    :ref="(el) => setEventMenuRef(el, event.id)"
                    :model="getEventMenuItems(event)"
                    :popup="true"
                  />
                  <Button
                    :icon="expandedRows.includes(event.id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                    text
                    @click="toggleExpand(event.id)"
                  />
                </div>
              </td>
            </tr>
            <tr
              v-if="expandedRows.includes(event.id)"
              class="expanded-content"
            >
              <td :colspan="5">
                <h6>Description:</h6>
                <p
                  class="description"
                  v-html="event.description"
                ></p>
              </td>
            </tr>
          </template>
        </TransitionGroup>
      </table>
      <div
        class="alerts-pagination"
        v-if="store.events.length"
      >
        <Paginator
          :first="(store.eventsPagination.page - 1) * store.eventsPagination.pageSize"
          :rows="store.eventsPagination.pageSize"
          :totalRecords="store.eventsPagination.total"
          :rowsPerPageOptions="[10, 20, 50]"
          data-test="FeatherPagination"
          @page="(e) => { store.onEventsPageChange(e.page + 1); store.onEventsPageSizeChange(e.rows) }"
        />
      </div>
      <div v-if="!store.events.length">
        <EmptyList
          :content="emptyListContent"
          data-test="empty-list"
        />
      </div>
    </div>
    <DeleteEventConfigEventDialog />
    <ChangeEventConfigEventStatusDialog />
  </TableCard>
</template>

<script setup lang="ts">
import { VENDOR_OPENNMS } from '@/lib/utils'
import { useEventConfigDetailStore } from '@/stores/eventConfigDetailStore'
import { useEventModificationStore } from '@/stores/eventModificationStore'
import { CreateEditMode } from '@/types'
import { EventConfigEvent } from '@/types/eventConfig'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Menu from 'primevue/menu'
import Paginator from 'primevue/paginator'
import { debounce } from 'lodash'
import SeverityBadge from '../Common/SeverityBadge.vue'
import EmptyList from '../Common/EmptyList.vue'
import TableCard from '../Common/TableCard.vue'
import ChangeEventConfigEventStatusDialog from './Dialog/ChangeEventConfigEventStatusDialog.vue'
import DeleteEventConfigEventDialog from './Dialog/DeleteEventConfigEventDialog.vue'

const store = useEventConfigDetailStore()
const router = useRouter()
const emptyListContent = {
  msg: 'No results found.'
}

const expandedRows = ref<number[]>([])
const columns = computed(() => [
  { id: 'uei', label: 'Event UEI' },
  { id: 'eventLabel', label: 'Event Label' },
  { id: 'severity', label: 'Severity' },
  { id: 'enabled', label: 'Status' }
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
    store.onEventsSortChange(sortField.value, sortDir.value)
  } else {
    store.onEventsSortChange('createdTime', 'desc')
  }
}

const sortIndicator = (field: string) => {
  if (sortField.value !== field) return ''
  return sortDir.value === 'asc' ? ' ▲' : ' ▼'
}

// Per-row Menu refs
const eventMenuRefs = ref<Record<number, any>>({})
const setEventMenuRef = (el: any, id: number) => {
  if (el) eventMenuRefs.value[id] = el
}
const toggleEventMenu = (event: Event, row: EventConfigEvent) => {
  eventMenuRefs.value[row.id]?.toggle(event)
}
const getEventMenuItems = (event: EventConfigEvent) => {
  const items: any[] = [
    {
      label: event.enabled ? 'Disable Event' : 'Enable Event',
      command: () => store.showChangeEventConfigEventStatusDialog(event),
      'data-test': 'change-status-button'
    }
  ]
  if (store.selectedSource?.vendor !== VENDOR_OPENNMS) {
    items.push({
      label: 'Delete Event',
      command: () => store.showDeleteEventConfigEventDialog(event),
      'data-test': 'delete-event-button'
    })
  }
  return items
}

const toggleExpand = (id: number) => {
  const index = expandedRows.value.indexOf(id)
  if (index === -1) {
    expandedRows.value.push(id)
  } else {
    expandedRows.value.splice(index, 1)
  }
}

const onEditEvent = (event: EventConfigEvent) => {
  if (store.selectedSource) {
    const modificationStore = useEventModificationStore()
    modificationStore.setSelectedEventConfigSource(store.selectedSource, CreateEditMode.Edit, event)
    router.push({
      name: 'Event Configuration Create'
    })
  }
}

const onChangeSearchTerm = debounce(async (value: string) => {
  await store.onChangeEventsSearchTerm(value)
}, 500)
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use "@/styles/tokens" as variables;
@use "@/styles/typography";
@use '@featherds/table/scss/table';
@use '@/styles/_transitionDataTable';
@use '@/styles/_severities';

.sortable-header {
  cursor: pointer;
  user-select: none;
}

.event-config-event-table {
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
        box-shadow: none;
        border-bottom: 1px solid var(variables.$border-on-surface);

        .severity {
          @include typography.caption;
          margin: 0 !important;
        }

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

        .description {
          margin: 0;
          white-space: normal;
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

