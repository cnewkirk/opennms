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
      <FeatherIcon
        :icon="InfoIcon"
        class="empty-icon"
      />
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
      <colgroup>
        <col style="width: 40%" />
        <col style="width: 25%" />
        <col style="width: 35%" />
      </colgroup>
      <thead>
        <tr>
          <th>Node</th>
          <th>Location</th>
          <th>Categories</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="node in nodes"
          :key="node.id"
        >
          <td>
            <router-link :to="`/node/${getNodeCriteria(node)}`">{{ node.label }}</router-link>
          </td>
          <td>{{ node.location || '—' }}</td>
          <td>
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
import { FeatherIcon } from '@featherds/icon'
import InfoIcon from '@featherds/icon/action/Info'
import API from '@/services'
import { type WidgetConfig } from '@/services/dashboardConfigService'
import { type Node, type QueryParameters } from '@/types'
import { getNodeCriteria } from '@/components/Nodes/utils'

const props = defineProps<{
  config: WidgetConfig
}>()

const nodes = ref<Node[]>([])
const totalCount = ref(0)

const load = async () => {
  const params: QueryParameters = { limit: props.config.limit, orderBy: 'label' }

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
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

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
    padding: 8px 16px;
    text-align: left;
    border-bottom: 1px solid var($border-light-on-surface);
  }

  th {
    @include subtitle2;
    color: var($secondary-text-on-surface);
    font-weight: 600;
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
  border-radius: 12px;
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
