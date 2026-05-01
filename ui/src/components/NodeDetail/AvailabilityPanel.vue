///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

<template>
  <div class="availability-panel card">
    <div class="headline4 availability-panel__title">Availability (last 24 hours)</div>

    <div v-if="loading" class="availability-panel__skeleton">Loading…</div>
    <div v-else-if="error" class="availability-panel__error subtitle2">{{ error }}</div>

    <template v-else-if="availability">
      <!-- Problems mode: all healthy -->
      <ClearSummary
        v-if="problemsOnly && allHealthy"
        message="All services healthy"
        :expandable="true"
        @expand="showAll = true"
      />

      <template v-else>
        <!-- Percentage cards grouped by IP interface -->
        <div class="availability-panel__cards">
          <div
            v-for="iface in displayedInterfaces"
            :key="iface.id"
            class="availability-panel__iface-group"
          >
            <div class="availability-panel__iface-header subtitle2">{{ iface.address }}</div>
            <div class="availability-panel__iface-cards">
              <template v-for="svc in iface.services" :key="svc.id">
                <ServiceGraphTooltip
                  v-if="nodeId"
                  :nodeId="nodeId"
                  :ip="iface.address"
                  :serviceName="svc.name"
                >
                  <div
                    class="avail-card"
                    :class="[severityClass(svc.availability), { 'avail-card--clickable': isClickable }]"
                    @click="isClickable && emit('go-graphs')"
                  >
                    <div class="avail-card__name subtitle2">{{ svc.name }}</div>
                    <div class="avail-card__pct headline3">{{ formatPct(svc.availability) }}%</div>
                  </div>
                </ServiceGraphTooltip>
                <div
                  v-else
                  class="avail-card"
                  :class="[severityClass(svc.availability), { 'avail-card--clickable': isClickable }]"
                  @click="isClickable && emit('go-graphs')"
                >
                  <div class="avail-card__name subtitle2">{{ svc.name }}</div>
                  <div class="avail-card__pct headline3">{{ formatPct(svc.availability) }}%</div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Per-service Perses response-time charts with outage bands -->
        <div v-if="nodeId" class="availability-panel__uptime-rows">
          <template v-for="iface in displayedInterfaces" :key="iface.id">
            <ServiceUptimeRow
              v-for="svc in iface.services"
              :key="`${iface.id}-${svc.id}`"
              :nodeId="nodeId"
              :ip="iface.address"
              :serviceName="svc.name"
              :availability="svc.availability"
              :outages="outages"
              :windowStart="windowStart"
              :windowEnd="windowEnd"
            />
          </template>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { NodeAvailability, Outage } from '@/types'
import { AvailabilityChartData, DownSegmentMeta } from '@/composables/useNodeAvailability'
import ClearSummary from '@/components/Common/ClearSummary.vue'
import ServiceGraphTooltip from './ServiceGraphTooltip.vue'
import ServiceUptimeRow from './ServiceUptimeRow.vue'

const emit = defineEmits<{ 'go-graphs': [] }>()

const props = defineProps<{
  availability: NodeAvailability | null
  chartData: AvailabilityChartData | null
  downSegmentMeta: DownSegmentMeta[]
  outages: Outage[]
  loading: boolean
  error: string | null
  problemsOnly?: boolean
  nodeId?: string
  clickable?: boolean
}>()

const isClickable = computed(() => props.clickable !== false)
const showAll = ref(false)

const now = Date.now()
const windowStart = now - 24 * 60 * 60 * 1000
const windowEnd = now

const allHealthy = computed(() => {
  if (!props.availability?.ipinterfaces?.length) return true
  return props.availability.ipinterfaces.every(iface =>
    iface.services.every(svc => svc.availability >= 100)
  )
})

const filteredInterfaces = computed(() => {
  if (!props.availability?.ipinterfaces) return []
  return props.availability.ipinterfaces
    .map(iface => ({
      ...iface,
      services: iface.services.filter(svc => svc.availability < 100)
    }))
    .filter(iface => iface.services.length > 0)
})

const displayedInterfaces = computed(() => {
  if (!props.availability?.ipinterfaces) return []
  if (props.problemsOnly && !showAll.value) return filteredInterfaces.value
  return props.availability.ipinterfaces
})

const formatPct = (v: number) => (Math.round(v * 100) / 100).toFixed(2)

const severityClass = (pct: number) => {
  if (pct >= 99) return 'avail-card--normal'
  if (pct >= 95) return 'avail-card--warning'
  return 'avail-card--critical'
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@use "@/styles/tokens" as fvars;
@use "@/styles/utils";
@import "@/styles/tokens";

.card { background: var($surface); padding: 16px; margin-bottom: 16px; }

.availability-panel {
  &__title   { margin-bottom: 12px; }
  &__skeleton, &__error { padding: 8px; color: var($secondary-text-on-surface); }
  &__cards        { margin-bottom: 12px; }
  &__iface-group  { margin-bottom: 16px; }
  &__iface-group:last-child { margin-bottom: 0; }
  &__iface-header { color: var($secondary-text-on-surface); margin-bottom: 6px; }
  &__iface-cards  { display: flex; flex-wrap: wrap; gap: 12px; }
  &__uptime-rows  { margin-top: 16px; }
}

.avail-card {
  border-radius: vars.$border-radius-surface;
  padding: 10px 16px;
  min-width: 120px;
  text-align: center;
  &__name { margin-bottom: 2px; }
  &__pct  { font-weight: 700; }
  &--normal   { background: utils.alpha(fvars.$success, 0.12); border: 1px solid utils.alpha(fvars.$success, 0.4); }
  &--warning  { background: utils.alpha(fvars.$warning, 0.12); border: 1px solid utils.alpha(fvars.$warning, 0.4); }
  &--critical { background: utils.alpha(fvars.$error, 0.12);   border: 1px solid utils.alpha(fvars.$error, 0.4); }
  &--clickable {
    cursor: pointer;
    transition: box-shadow 0.15s ease, filter 0.15s ease;
    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
      filter: brightness(1.04);
    }
  }
}
</style>
