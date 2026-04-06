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
  <div class="surveillance-dashboard">
    <BreadCrumbs :items="breadcrumbs" />

    <div class="page-header">
      <h1 class="page-title">Surveillance Dashboard</h1>
      <div class="header-actions">
        <FeatherSelect
          v-if="allViews.length > 1"
          :options="viewOptions"
          :modelValue="selectedViewOption"
          label="View"
          class="view-picker"
          @update:modelValue="onViewChange"
        />
        <span v-if="lastUpdated" class="last-updated">
          Updated {{ lastUpdated }}
        </span>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <FeatherSpinner />
    </div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <p v-if="noViews">
        No surveillance views are configured.
        <router-link to="/surveillance-views-config">Configure views</router-link>
      </p>
    </div>

    <template v-else-if="data">
      <SurveillanceGrid
        :view="data.view"
        :grid="data.grid"
        :selectedRow="selectedRow"
        :selectedCol="selectedCol"
        @cellClick="onCellClick"
      />

      <SurveillanceCellDetail
        v-if="selectedRow !== null && selectedCol !== null"
        :rowLabel="data.view.rows[selectedRow].label"
        :colLabel="data.view.columns[selectedCol].label"
        :nodes="detailNodes"
        :alarms="detailAlarms"
        :outages="detailOutages"
        @close="clearSelection"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { FeatherSpinner } from '@featherds/progress'
import { FeatherSelect, ISelectItemType } from '@featherds/select'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import SurveillanceGrid from '@/components/SurveillanceDashboard/SurveillanceGrid.vue'
import SurveillanceCellDetail from '@/components/SurveillanceDashboard/SurveillanceCellDetail.vue'
import {
  fetchDashboardData,
  fetchConfig,
  type DashboardData,
  type SurveillanceNode,
  type SurveillanceAlarm,
  type SurveillanceOutage
} from '@/services/surveillanceDashboardService'
import useSnackbar from '@/composables/useSnackbar'

const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Home', to: '/' },
  { label: 'Surveillance Dashboard', to: '/surveillance-dashboard' }
]

// ─── State ───────────────────────────────────────────────────────────────────

const loading = ref(true)
const error = ref<string | null>(null)
const noViews = ref(false)
const data = ref<DashboardData | null>(null)
const lastUpdated = ref<string | null>(null)

const allViews = ref<string[]>([])
const activeViewName = ref<string | undefined>(undefined)

const selectedRow = ref<number | null>(null)
const selectedCol = ref<number | null>(null)

let refreshTimer: ReturnType<typeof setInterval> | null = null

// ─── Computed ────────────────────────────────────────────────────────────────

const viewOptions = computed<ISelectItemType[]>(() =>
  allViews.value.map(name => ({ value: name, label: name }))
)

const selectedViewOption = computed<ISelectItemType | undefined>(() =>
  viewOptions.value.find(o => o.value === activeViewName.value)
)

const detailNodes = computed<SurveillanceNode[]>(() => {
  if (selectedRow.value === null || selectedCol.value === null || !data.value) return []
  const nodeIds = new Set(data.value.grid[selectedRow.value][selectedCol.value].nodeIds)
  return data.value.nodes.filter(n => nodeIds.has(n.id))
})

const detailAlarms = computed<SurveillanceAlarm[]>(() => {
  if (selectedRow.value === null || selectedCol.value === null || !data.value) return []
  const nodeIds = new Set(data.value.grid[selectedRow.value][selectedCol.value].nodeIds)
  return data.value.alarms.filter(a => nodeIds.has(a.nodeId))
})

const detailOutages = computed<SurveillanceOutage[]>(() => {
  if (selectedRow.value === null || selectedCol.value === null || !data.value) return []
  const nodeIds = new Set(data.value.grid[selectedRow.value][selectedCol.value].nodeIds)
  return data.value.outages.filter(o => nodeIds.has(o.nodeId))
})

// ─── Methods ─────────────────────────────────────────────────────────────────

const load = async () => {
  try {
    const result = await fetchDashboardData(activeViewName.value)
    data.value = result
    lastUpdated.value = new Date().toLocaleTimeString()
    error.value = null
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to load surveillance data'
    noViews.value = (e?.message ?? '').includes('No surveillance views')
    showSnackBar({ msg: error.value ?? 'Error loading surveillance dashboard' })
  } finally {
    loading.value = false
  }
}

const startRefresh = () => {
  if (refreshTimer) clearInterval(refreshTimer)
  const seconds = Math.max(data.value?.view.refreshSeconds ?? 300, 30)
  refreshTimer = setInterval(load, seconds * 1000)
}

const onCellClick = (row: number, col: number) => {
  if (selectedRow.value === row && selectedCol.value === col) {
    clearSelection()
  } else {
    selectedRow.value = row
    selectedCol.value = col
  }
}

const clearSelection = () => {
  selectedRow.value = null
  selectedCol.value = null
}

const onViewChange = (option: ISelectItemType | undefined) => {
  if (!option) return
  activeViewName.value = String(option.value)
  clearSelection()
  loading.value = true
  load().then(startRefresh)
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    const config = await fetchConfig()
    allViews.value = config.views.map(v => v.name)
    activeViewName.value = config.defaultView || config.views[0]?.name
  } catch {
    // fetchDashboardData will handle the error
  }
  await load()
  startRefresh()
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped lang="scss">
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.surveillance-dashboard {
  padding: 1.5rem 2rem;
  max-width: 1400px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  @include headline4;
  margin: 0;
  color: var($primary-text-on-surface);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.view-picker {
  min-width: 160px;
}

.last-updated {
  @include body-small;
  color: var($secondary-text-on-surface);
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.error-state {
  padding: 2rem;
  color: var($error);
  @include body-large;

  a {
    color: var($clickable-normal);
  }
}
</style>
