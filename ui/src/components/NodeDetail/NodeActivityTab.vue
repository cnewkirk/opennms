<template>
  <Tabs v-model:value="activeTabKey">
    <TabList>
      <Tab value="alarms">Alarms</Tab>
      <Tab value="events">Events</Tab>
      <Tab value="outages">Outages</Tab>
      <Tab value="links">Links</Tab>
    </TabList>
    <TabPanels>
      <TabPanel value="alarms">
        <AlarmsTable
          v-if="visited[0]"
          :nodeId="nodeId"
          :nodeLabel="nodeLabel"
          :extraFiql="perspectiveStore.isProblems ? 'severity!=CLEARED;ackTime==null' : undefined"
        />
      </TabPanel>
      <TabPanel value="events">
        <EventsTable v-if="visited[1]" :nodeId="nodeId" />
      </TabPanel>
      <TabPanel value="outages">
        <OutagesTable
          v-if="visited[2]"
          :nodeId="nodeId"
          :filterFiql="perspectiveStore.isProblems ? 'ifRegainedService==null' : undefined"
        />
      </TabPanel>
      <TabPanel value="links">
        <EnlinkdLinksTab v-if="visited[3]" :nodeId="nodeId" />
      </TabPanel>
    </TabPanels>
  </Tabs>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
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

const initialTabKey = (props.defaultSubTab && TAB_NAMES.includes(props.defaultSubTab as any))
  ? props.defaultSubTab
  : 'alarms'

const activeTabKey = ref(initialTabKey)

const visited = reactive([false, false, false, false])
const initialIdx = TAB_NAMES.indexOf(initialTabKey as typeof TAB_NAMES[number])
visited[Math.max(0, initialIdx)] = true

watch(activeTabKey, (key) => {
  const idx = TAB_NAMES.indexOf(key as typeof TAB_NAMES[number])
  if (idx >= 0) visited[idx] = true
  router.replace({ query: { ...route.query, subtab: key } })
})
</script>
