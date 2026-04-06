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
  <div class="category-panel card">
    <div class="category-panel__header headline4">
      Categories
      <a v-if="isAdmin" :href="editCategoriesUrl" class="category-panel__edit subtitle2">Edit</a>
    </div>
    <div class="category-panel__chips">
      <span v-for="cat in node.categories" :key="cat.id" class="chip">{{ cat.name }}</span>
      <span v-if="!node.categories?.length" class="subtitle2" style="color: var(--feather-secondary-text-on-surface)">
        No categories assigned
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Node } from '@/types'

const props = defineProps<{ node: Node; isAdmin: boolean }>()
const editCategoriesUrl = computed(
  () => `/opennms/admin/categories.htm?node=${props.node.id}`
)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.card {
  background: var(--feather-surface);
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 8px;
}

.category-panel {
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  &__edit {
    font-size: 0.85rem;
    color: var(--feather-clickable-normal);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
}

.chip {
  background: var(--feather-shade-4);
  border-radius: 16px;
  padding: 2px 12px;
  font-size: 0.85rem;
}
</style>
