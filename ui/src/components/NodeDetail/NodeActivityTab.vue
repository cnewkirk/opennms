<template>
  <FeatherTabContainer v-model="activeSubTab">
    <template v-slot:tabs>
      <FeatherTab>Alarms</FeatherTab>
      <FeatherTab>Events</FeatherTab>
      <FeatherTab>Outages</FeatherTab>
      <FeatherTab>Links</FeatherTab>
    </template>

    <FeatherTabPanel>
      <AlarmsTable
        v-if="visited[0]"
        :nodeId="nodeId"
        :nodeLabel="nodeLabel"
        :extraFiql="perspectiveStore.isProblems ? 'severity!=CLEARED;ackTime==null' : undefined"
      />
    </FeatherTabPanel>

    <FeatherTabPanel>
      <EventsTable v-if="visited[1]" :nodeId="nodeId" />
    </FeatherTabPanel>

    <FeatherTabPanel>
      <OutagesTable
        v-if="visited[2]"
        :nodeId="nodeId"
        :filterFiql="perspectiveStore.isProblems ? 'ifRegainedService==null' : undefined"
      />
    </FeatherTabPanel>

    <FeatherTabPanel>
      <EnlinkdLinksTab v-if="visited[3]" :nodeId="nodeId" />
    </FeatherTabPanel>
  </FeatherTabContainer>
</template>

<script setup lang="ts">
import { FeatherTab, FeatherTabContainer, FeatherTabPanel } from '@featherds/tabs'
import AlarmsTable from '@/components/Nodes/AlarmsTable.vue'
import EventsTable from '@/components/Nodes/EventsTable.vue'
import OutagesTable from '@/components/Nodes/OutagesTable.vue'
import EnlinkdLinksTab from '@/components/NodeDetail/EnlinkdLinksTab.vue'
import { usePerspectiveStore } from '@/stores/perspectiveStore'

const TAB_NAMES = ['alarms', 'events', 'outages', 'links'] as const

const props = defineProps<{ nodeId: string; nodeLabel: string; defaultSubTab?: string }>()

const perspectiveStore = usePerspectiveStore()
const route = useRoute()
const router = useRouter()

const initialTab = props.defaultSubTab
  ? Math.max(0, TAB_NAMES.indexOf(props.defaultSubTab as typeof TAB_NAMES[number]))
  : 0
const activeSubTab = ref(initialTab)

const visited = reactive([false, false, false, false])
visited[initialTab] = true

watch(activeSubTab, (idx) => {
  visited[idx] = true
  router.replace({ query: { ...route.query, subtab: TAB_NAMES[idx] } })
})
</script>
