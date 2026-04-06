<template>
  <FeatherTabContainer v-model="activeSubTab">
    <template v-slot:tabs>
      <FeatherTab>Alarms</FeatherTab>
      <FeatherTab>Events</FeatherTab>
      <FeatherTab>Outages</FeatherTab>
    </template>

    <FeatherTabPanel>
      <AlarmsTable v-if="visited[0]" :nodeId="nodeId" :nodeLabel="nodeLabel" />
    </FeatherTabPanel>

    <FeatherTabPanel>
      <EventsTable v-if="visited[1]" :nodeId="nodeId" />
    </FeatherTabPanel>

    <FeatherTabPanel>
      <OutagesTable v-if="visited[2]" :nodeId="nodeId" />
    </FeatherTabPanel>
  </FeatherTabContainer>
</template>

<script setup lang="ts">
import { FeatherTab, FeatherTabContainer, FeatherTabPanel } from '@featherds/tabs'
import AlarmsTable from '@/components/Nodes/AlarmsTable.vue'
import EventsTable from '@/components/Nodes/EventsTable.vue'
import OutagesTable from '@/components/Nodes/OutagesTable.vue'

const TAB_NAMES = ['alarms', 'events', 'outages'] as const

const props = defineProps<{ nodeId: string; nodeLabel: string; defaultTab?: string }>()

const initialTab = props.defaultTab ? Math.max(0, TAB_NAMES.indexOf(props.defaultTab as typeof TAB_NAMES[number])) : 0
const activeSubTab = ref(initialTab)

// Track which sub-tabs have been visited (lazy mount, never unmount)
const visited = reactive([false, false, false])
visited[initialTab] = true
watch(activeSubTab, (idx) => { visited[idx] = true })
</script>
