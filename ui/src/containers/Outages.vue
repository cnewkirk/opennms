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
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>
  <div class="feather-row">
    <div class="feather-col-12 outages-page__controls">
      <PerspectiveToggle />
    </div>
  </div>
  <div class="feather-row">
    <div class="feather-col-12">
      <div class="card">
        <OutagesListTable />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import OutagesListTable from '@/components/Outages/OutagesListTable.vue'
import PerspectiveToggle from '@/components/Common/PerspectiveToggle.vue'
import { useMenuStore } from '@/stores/menuStore'
import { type BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Outages', to: '#', position: 'last' }
])
</script>

<style scoped lang="scss">
@use '@/styles/vars' as vars;
@import "@/styles/tokens";
.card { background: var($surface); padding: 0; margin-bottom: 16px; border-radius: vars.$border-radius-surface; }
.outages-page__controls { padding: 8px 15px 8px; }
</style>
