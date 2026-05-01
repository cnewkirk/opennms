<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->
<template>
  <div class="nodes-widget">
    <div
      v-if="!nodes.length"
      class="empty-state"
    >
      <i class="pi pi-info-circle empty-icon" />
      <div class="empty-title">No nodes found</div>
      <div
        v-if="config.categories.length"
        class="empty-subtitle"
      >Filtered by: {{ config.categories.join(', ') }}</div>
      <div
        v-else
        class="empty-subtitle"
      >No nodes have been provisioned yet</div>
    </div>
    <table
      v-else
      class="node-table"
    >
      <thead>
        <tr>
          <th
            v-if="col('node')"
            :class="sortClass('node')"
            @click="toggleSort('node')"
          >Node</th>
          <th
            v-if="col('location')"
            :class="sortClass('location')"
            @click="toggleSort('location')"
          >Location</th>
          <th v-if="col('categories')">Categories</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="node in nodes"
          :key="node.id"
        >
          <td v-if="col('node')">
            <router-link :to="`/node/${getNodeCriteria(node)}`">{{ node.label }}</router-link>
          </td>
          <td v-if="col('location')">{{ node.location || '—' }}</td>
          <td v-if="col('categories')">
            <span
              v-for="cat in node.categories"
              :key="cat.id"
              class="category-chip"
            >{{ cat.name }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <div
      v-if="totalCount > nodes.length"
      class="more-hint body2"
    >
      Showing {{ nodes.length }} of {{ totalCount }} nodes
    </div>
  </div>
</template>

<script setup lang="ts">
import API from '@/services'
import { type TableWidgetConfig, WIDGET_COLUMNS } from '@/services/dashboardConfigService'
import { type Node, type QueryParameters } from '@/types'
import { getNodeCriteria } from '@/components/Nodes/utils'
import { useDashboardStore } from '@/stores/dashboardStore'

const props = defineProps<{
  config: TableWidgetConfig
}>()

const store = useDashboardStore()
const nodes = ref<Node[]>([])
const totalCount = ref(0)

const col = (key: string) => !props.config.columns?.length || props.config.columns.includes(key)

const sortClass = (key: string) => {
  const def = WIDGET_COLUMNS.nodes.find(c => c.key === key)
  if (!def?.sortField) return ''
  if (props.config.sortBy !== key) return 'sortable'
  return props.config.sortDir === 'desc' ? 'sort-desc' : 'sort-asc'
}

const toggleSort = (key: string) => {
  const def = WIDGET_COLUMNS.nodes.find(c => c.key === key)
  if (!def?.sortField) return
  const newDir: 'asc' | 'desc' =
    props.config.sortBy === key && props.config.sortDir === 'asc' ? 'desc' : 'asc'
  store.updateWidget({ ...props.config, sortBy: key, sortDir: newDir })
}

const load = async () => {
  const sortByKey = props.config.sortBy
  const sortDef = sortByKey ? WIDGET_COLUMNS.nodes.find(c => c.key === sortByKey) : null
  const params: QueryParameters = {
    limit: props.config.limit,
    orderBy: sortDef?.sortField ?? 'label',
    order: (props.config.sortDir ?? 'asc') as QueryParameters['order']
  }

  if (props.config.categories.length === 1) {
    params._s = `categories.name==${props.config.categories[0]}`
  } else if (props.config.categories.length > 1) {
    params._s = `(${props.config.categories.map(c => `categories.name==${c}`).join(',')})`
  }

  const resp = await API.getNodes(params)
  if (resp) {
    nodes.value = resp.node
    totalCount.value = resp.totalCount
  }
}

onMounted(load)
watch(() => props.config, load, { deep: true })
defineExpose({ refresh: load })
</script>

<style scoped lang="scss">
@use '@/styles/vars' as vars;
@import "@/styles/tokens";
@import "@/styles/typography";

.nodes-widget {
  padding: 0 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  gap: 6px;
}

.empty-icon {
  font-size: 36px;
  color: var($secondary-text-on-surface);
  margin-bottom: 4px;
  display: block;
}

.empty-title {
  @include subtitle2;
  color: var($primary-text-on-surface);
  font-weight: 600;
}

.empty-subtitle {
  @include body-small;
  color: var($secondary-text-on-surface);
  font-style: italic;
}

.node-table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    @include body-small;
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid var($border-light-on-surface);
  }

  th {
    @include subtitle2;
    color: var($secondary-text-on-surface);
    font-weight: 600;
    user-select: none;

    &.sortable { cursor: pointer; }
    &.sort-asc, &.sort-desc { cursor: pointer; color: var($primary-text-on-surface); }
    &.sort-asc::after  { content: ' ▴'; }
    &.sort-desc::after { content: ' ▾'; }
  }

  tbody tr:hover {
    background: var($shade-4);
  }

  a {
    color: var($clickable-normal);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
}

.category-chip {
  @include body-small;
  display: inline-block;
  background: var($shade-4);
  border: 1px solid var($border-light-on-surface);
  border-radius: vars.$border-radius-pill;
  padding: 1px 8px;
  margin: 1px 2px;
  font-size: 11px;
}

.more-hint {
  @include body-small;
  color: var($secondary-text-on-surface);
  padding: 8px 16px;
  text-align: right;
  font-style: italic;
}
</style>
