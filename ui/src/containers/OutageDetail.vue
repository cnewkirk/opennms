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

  <!-- Error state -->
  <div v-if="error && !loading" class="feather-row">
    <div class="feather-col-12 outage-detail__error">
      <p class="headline4">Outage not found</p>
      <p class="subtitle1">{{ error }}</p>
      <router-link to="/outages">← Back to Outages</router-link>
    </div>
  </div>

  <!-- Loading state -->
  <div v-else-if="loading" class="feather-row">
    <div class="feather-col-12 outage-detail__skeleton headline3">Loading outage…</div>
  </div>

  <template v-else-if="outage">
    <div class="feather-row">
      <div class="feather-col-12">
        <div :class="['card', 'outage-detail__header', outage.ifRegainedService == null ? 'outage-detail__header--active' : 'outage-detail__header--resolved']">
          <div class="headline3">Outage {{ outage.id }}</div>
          <div class="subtitle1">{{ outage.ifRegainedService == null ? 'Active' : 'Resolved' }}</div>
        </div>
      </div>
    </div>

    <div class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Details</div>
          <dl class="outage-detail__grid">
            <dt>Node</dt>
            <dd>
              <router-link v-if="outage.nodeId" :to="`/node/${outage.nodeId}`">{{ outage.nodeLabel }}</router-link>
              <span v-else>—</span>
            </dd>

            <dt>Requisition</dt>
            <dd>{{ outage.foreignSource ?? '—' }}</dd>

            <dt>Interface</dt>
            <dd>
              <router-link
                v-if="outage.ipAddress && outage.nodeId"
                :to="`/interface/${outage.nodeId}/${outage.ipAddress}`"
              >{{ outage.ipAddress }}</router-link>
              <span v-else-if="outage.ipAddress">{{ outage.ipAddress }}</span>
              <span v-else>—</span>
            </dd>

            <dt>Service</dt>
            <dd>
              <a
                v-if="outage.serviceName && outage.nodeId && outage.ipAddress"
                :href="`/opennms/element/service.jsp?node=${outage.nodeId}&intf=${outage.ipAddress}&service=${outage.serviceId}`"
              >{{ outage.serviceName }}</a>
              <span v-else-if="outage.serviceName">{{ outage.serviceName }}</span>
              <span v-else>—</span>
            </dd>

            <dt>Down Since</dt>
            <dd v-date>{{ outage.ifLostService }}</dd>

            <dt>Lost Service Event</dt>
            <dd>
              <router-link v-if="outage.lostServiceEventId" :to="`/event/${outage.lostServiceEventId}`">
                {{ outage.lostServiceEventId }}
              </router-link>
              <span v-else>—</span>
            </dd>

            <dt>Restored</dt>
            <dd>
              <span v-if="outage.ifRegainedService != null" v-date>{{ outage.ifRegainedService }}</span>
              <span v-else class="outage-detail__status-active">Active</span>
            </dd>

            <dt>Restored Event</dt>
            <dd>
              <router-link v-if="outage.regainedServiceEventId" :to="`/event/${outage.regainedServiceEventId}`">
                {{ outage.regainedServiceEventId }}
              </router-link>
              <span v-else>—</span>
            </dd>

            <template v-if="outage.perspectiveLocation">
              <dt>Perspective</dt>
              <dd>{{ outage.perspectiveLocation }}</dd>
            </template>

            <template v-if="outage.location">
              <dt>Monitoring Location</dt>
              <dd>{{ outage.location }}</dd>
            </template>
          </dl>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { getOutage } from '@/services/outageService'
import { useMenuStore } from '@/stores/menuStore'
import { type Outage, type BreadCrumb } from '@/types'

const route = useRoute()
const menuStore = useMenuStore()
const id = route.params.id as string

const outage  = ref<Outage | null>(null)
const loading = ref(true)
const error   = ref<string | null>(null)

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home',    to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Outages', to: '/outages' },
  { label: `Outage ${id}`, to: '#', position: 'last' }
])

onMounted(async () => {
  const result = await getOutage(id)
  loading.value = false
  if (!result) {
    error.value = `No outage found with ID ${id}.`
  } else {
    outage.value = result
  }
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";
@import "@/styles/typography";
@import "@featherds/styles/mixins/elevation";

.card {
  @include elevation(2);
  padding: 16px;
  margin-bottom: 16px;
  border-radius: vars.$border-radius-surface;

  &__section-title { margin-bottom: 12px; }
}

.outage-detail {
  &__skeleton { padding: 16px; }
  &__error    { padding: 24px; text-align: center; }

  &__header {
    margin-bottom: 16px;
    border-left: 4px solid transparent;

    &--active   { border-left-color: var($error); }
    &--resolved { border-left-color: var($success); }
  }

  &__grid {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 16px;
    margin: 0;

    dt {
      color: var($secondary-text-on-surface);
      font-weight: 600;
      white-space: nowrap;
    }

    dd {
      margin: 0;
      word-break: break-word;

      a {
        color: var($clickable-normal);
        text-decoration: none;
        &:hover { text-decoration: underline; }
      }
    }
  }

  &__status-active {
    color: var($error);
    font-weight: 600;
  }
}
</style>
