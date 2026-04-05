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

    <a v-if="hasSNMPPrimary" :href="updateSnmpUrl" class="admin-bar__link">
      Update SNMP
    </a>
    <a :href="scheduleOutageUrl" class="admin-bar__link">Schedule Outage</a>
    <a v-if="foreignSource" :href="editRequisitionUrl" class="admin-bar__link">
      Edit in Requisition
    </a>
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import useRole from '@/composables/useRole'
import useSnackbar from '@/composables/useSnackbar'
import { v2 } from '@/services/axiosInstances'

const props = defineProps<{
  nodeId: string
  hasSNMPPrimary: boolean
  foreignSource?: string
}>()

const { adminRole } = useRole()
const { showSnackBar } = useSnackbar()

const rescanning = ref(false)

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

const updateSnmpUrl = computed(() => `/opennms/admin/snmpConfig.htm?node=${props.nodeId}`)
const scheduleOutageUrl = computed(() => `/opennms/admin/sched-outages/editoutage.jsp`)
const editRequisitionUrl = computed(
  () => `/opennms/admin/editForeignSource.jsp?foreignSource=${props.foreignSource}`
)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.admin-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  flex-wrap: wrap;

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
