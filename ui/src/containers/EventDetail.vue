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
    <div class="feather-col-12 event-detail__error">
      <p class="headline4">Event not found</p>
      <p class="subtitle1">{{ error }}</p>
    </div>
  </div>

  <!-- Loading state -->
  <div v-else-if="loading" class="feather-row">
    <div class="feather-col-12 event-detail__skeleton headline3">Loading event…</div>
  </div>

  <template v-else-if="event">
    <!-- Header card — severity colored -->
    <div class="feather-row">
      <div class="feather-col-12">
        <div :class="['card', 'event-detail__header', severityClass]">
          <div class="headline3">Event {{ event.id }}</div>
          <div class="subtitle1 event-detail__severity">{{ event.severity }}</div>
        </div>
      </div>
    </div>

    <!-- Details grid -->
    <div class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Details</div>
          <dl class="event-detail__grid">
            <dt>Time</dt>
            <dd v-date>{{ event.time }}</dd>

            <dt>Node</dt>
            <dd>
              <router-link v-if="event.nodeId" :to="`/node/${event.nodeId}`">{{ event.nodeLabel }}</router-link>
              <span v-else>&mdash;</span>
            </dd>

            <template v-if="event.ipAddress">
              <dt>Interface</dt>
              <dd>
                <!-- TODO: link to Vue interface detail once available -->
                <a
                  v-if="event.nodeId"
                  :href="`/opennms/element/interface.jsp?node=${event.nodeId}&intf=${event.ipAddress}`"
                >{{ event.ipAddress }}</a>
                <span v-else>{{ event.ipAddress }}</span>
              </dd>
            </template>

            <template v-if="event.serviceName">
              <dt>Service</dt>
              <dd>
                <!-- TODO: link to Vue service detail once available -->
                <a
                  v-if="event.nodeId && event.ipAddress && event.serviceId"
                  :href="`/opennms/element/service.jsp?node=${event.nodeId}&intf=${event.ipAddress}&service=${event.serviceId}`"
                >{{ event.serviceName }}</a>
                <span v-else>{{ event.serviceName }}</span>
              </dd>
            </template>

            <template v-if="event.location">
              <dt>Source Location</dt>
              <dd>{{ event.location }}{{ event.systemId ? ` (${event.systemId})` : '' }}</dd>
            </template>

            <template v-if="event.nodeLocation">
              <dt>Node Location</dt>
              <dd>{{ event.nodeLocation }}</dd>
            </template>

            <template v-if="event.uei">
              <dt>UEI</dt>
              <dd class="event-detail__uei">{{ event.uei }}</dd>
            </template>

            <template v-if="event.alarmId">
              <dt>Alarm</dt>
              <dd>
                <router-link :to="`/alarm/${event.alarmId}`">{{ event.alarmId }}</router-link>
              </dd>
            </template>
          </dl>
        </div>
      </div>
    </div>

    <!-- Log Message -->
    <div v-if="event.logMessage" class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Log Message</div>
          <div v-html="event.logMessage" class="card__body"></div>
        </div>
      </div>
    </div>

    <!-- Description -->
    <div v-if="event.description" class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Description</div>
          <div v-html="event.description" class="card__body"></div>
        </div>
      </div>
    </div>

    <!-- Operator Instructions — only when present -->
    <div v-if="event.operatorInstruction" class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Operator Instructions</div>
          <div v-html="event.operatorInstruction" class="card__body"></div>
        </div>
      </div>
    </div>

    <!-- Parameters — only when present. System property gate dropped intentionally. -->
    <div v-if="event.parameters?.length" class="feather-row">
      <div class="feather-col-12">
        <div class="card">
          <div class="headline4 card__section-title">Parameters</div>
          <dl class="event-detail__grid">
            <template v-for="(param, index) in event.parameters" :key="`${param.name}_${index}`">
              <dt>{{ param.name }}</dt>
              <dd>{{ param.value }}</dd>
            </template>
          </dl>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import useEventDetail from '@/composables/useEventDetail'
import { useMenuStore } from '@/stores/menuStore'
import { BreadCrumb } from '@/types'

const route = useRoute()
const menuStore = useMenuStore()
const id = route.params.id as string

const { event, loading, error } = useEventDetail(id)

const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Events', to: '/opennms/event/index', isAbsoluteLink: true },
  { label: event.value ? `Event ${event.value.id}` : `Event ${id}`, to: '#', position: 'last' }
])

const severityClass = computed<string>(() =>
  event.value ? `${event.value.severity.toLowerCase()}-color` : ''
)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/elevation";

.card {
  @include elevation(2);
  padding: 16px;
  margin-bottom: 16px;

  &__section-title {
    margin-bottom: 12px;
  }

  &__body {
    :deep(p) { margin: 0; }
  }
}

.event-detail {
  &__skeleton { padding: 16px; }
  &__error    { padding: 24px; text-align: center; }

  &__header {
    padding: 16px;
    margin-bottom: 16px;
  }

  &__severity {
    margin-top: 4px;
    text-transform: capitalize;
  }

  &__uei {
    word-break: break-all;
    font-family: monospace;
    font-size: 0.875rem;
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
    }
  }
}

@import "@/styles/severities";
</style>
