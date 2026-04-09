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
  software distributed under the LICENSE is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->

<template>
  <div v-if="adminRole" class="admin-bar">
    <FeatherButton primary :disabled="rescanning" @click="rescan">
      {{ rescanning ? 'Rescanning…' : 'Rescan' }}
    </FeatherButton>

    <FeatherButton v-if="resolvedSnmpIp" secondary as-anchor :href="updateSnmpUrl">
      Update SNMP
    </FeatherButton>
    <FeatherButton secondary as-anchor :href="scheduleOutageUrl">
      Schedule Outage
    </FeatherButton>
    <FeatherButton v-if="foreignSource" secondary as-anchor :href="editRequisitionUrl">
      Edit in Requisition
    </FeatherButton>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import useRole from '@/composables/useRole'
import useSnackbar from '@/composables/useSnackbar'
import { v2 } from '@/services/axiosInstances'

const props = defineProps<{
  nodeId: string
  foreignSource?: string
}>()

const { adminRole } = useRole()
const { showSnackBar } = useSnackbar()

const rescanning = ref(false)
const resolvedSnmpIp = ref<string | null>(null)

onMounted(async () => {
  try {
    const resp = await v2.get(`/nodes/${props.nodeId}/ipinterfaces`, {
      params: { _s: 'snmpPrimary==P', limit: 1 }
    })
    const ifaces = resp.data?.ipInterface ?? []
    if (ifaces.length > 0) resolvedSnmpIp.value = ifaces[0].ipAddress ?? null
  } catch { /* non-critical, button just won't show */ }
})

const rescan = async () => {
  rescanning.value = true
  try {
    await v2.put(`/nodes/${props.nodeId}/rescan`)
    showSnackBar({ msg: 'Node rescan triggered successfully.' })
  } catch {
    showSnackBar({ msg: 'Failed to trigger rescan.', error: true })
  } finally {
    rescanning.value = false
  }
}

const updateSnmpUrl = computed(() => `/opennms/admin/updateSnmp.jsp?node=${props.nodeId}&ipaddr=${resolvedSnmpIp.value}`)
const scheduleOutageUrl = computed(() => '/opennms/admin/sched-outages/editoutage.jsp')
const editRequisitionUrl = computed(
  () => `/opennms/admin/ng-requisitions/index.jsp#/requisitions/${props.foreignSource}`
)
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.admin-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  flex-wrap: wrap;

  :deep(.btn) {
    border-radius: vars.$border-radius-sm;
  }

  &__link {
    color: var($clickable-normal);
    text-decoration: none;
    font-size: 0.9rem;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
