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
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>

  <!-- Full-page error if node not found -->
  <div v-if="nodeError && !nodeLoading" class="feather-row">
    <div class="feather-col-12 node-detail__error">
      <p class="headline4">Node not found</p>
      <p class="subtitle1">{{ nodeError }}</p>
    </div>
  </div>

  <template v-else>
    <!-- Header + admin bar -->
    <div class="feather-row">
      <div class="feather-col-12">
        <div v-if="nodeLoading" class="node-detail__skeleton headline3">Loading node…</div>
        <template v-else-if="node">
          <NodeHeader :node="node" />
          <AdminActionsBar
            :nodeId="id"
            :hasSNMPPrimary="true"
            :foreignSource="node.foreignSource"
          />
        </template>
      </div>
    </div>

    <!-- Info + categories (two-column) -->
    <div v-if="node" class="feather-row">
      <div class="feather-col-6">
        <NodeInfoPanel :node="node" />
      </div>
      <div class="feather-col-6">
        <CategoryPanel :node="node" :isAdmin="adminRole" />
      </div>
    </div>

    <!-- Availability -->
    <div class="feather-row">
      <div class="feather-col-12">
        <AvailabilityPanel
          :availability="availability"
          :chartData="chartData as any"
          :downSegmentMeta="downSegmentMeta"
          :loading="availLoading"
          :error="availError"
        />
      </div>
    </div>

    <!-- Interfaces -->
    <div class="feather-row">
      <div class="feather-col-12">
        <InterfacesTabs />
      </div>
    </div>

    <!-- Events -->
    <div v-if="node" class="feather-row">
      <div class="feather-col-12">
        <EventsTable :nodeId="node.id" />
      </div>
    </div>

    <!-- Outages -->
    <div v-if="node" class="feather-row">
      <div class="feather-col-12">
        <OutagesTable :nodeId="node.id" />
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import NodeHeader from '@/components/NodeDetail/NodeHeader.vue'
import AdminActionsBar from '@/components/NodeDetail/AdminActionsBar.vue'
import NodeInfoPanel from '@/components/NodeDetail/NodeInfoPanel.vue'
import CategoryPanel from '@/components/NodeDetail/CategoryPanel.vue'
import AvailabilityPanel from '@/components/NodeDetail/AvailabilityPanel.vue'
import InterfacesTabs from '@/components/Nodes/InterfacesTabs.vue'
import EventsTable from '@/components/Nodes/EventsTable.vue'
import OutagesTable from '@/components/Nodes/OutagesTable.vue'
import useNodeDetail from '@/composables/useNodeDetail'
import useNodeAvailability from '@/composables/useNodeAvailability'
import useRole from '@/composables/useRole'
import { useMenuStore } from '@/stores/menuStore'
import { BreadCrumb } from '@/types'

const route = useRoute()
const menuStore = useMenuStore()
const id = route.params.id as string

const { node, loading: nodeLoading, error: nodeError } = useNodeDetail(id)
const {
  availability, chartData, downSegmentMeta,
  loading: availLoading, error: availError
} = useNodeAvailability(id)
const { adminRole } = useRole()

const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Nodes', to: '/nodes' },
  { label: node.value?.label ?? id, to: '#', position: 'last' }
])
</script>

<style lang="scss" scoped>
.node-detail {
  &__skeleton { padding: 16px; }
  &__error    { padding: 24px; text-align: center; }
}
</style>
