<template>
  <div class="event-config-tab-container">
    <Tabs class="tabs" v-model:value="activeTabKey">
      <TabList>
        <Tab value="view">View</Tab>
        <Tab value="upload">Upload Files</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="view">
          <EventConfigSourceTable />
        </TabPanel>
        <TabPanel value="upload">
          <EventConfigUploadFilesTab />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useEventConfigStore } from '@/stores/eventConfigStore'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import EventConfigSourceTable from './EventConfigSourceTable.vue'
import EventConfigUploadFilesTab from './EventConfigUploadFilesTab.vue'

const store = useEventConfigStore()

// Store uses numeric index (0 = view, 1 = upload); PrimeVue Tabs needs string values
const activeTabKey = computed({
  get: () => store.activeTab === 1 ? 'upload' : 'view',
  set: (val: string) => { store.activeTab = val === 'upload' ? 1 : 0 }
})
</script>

<style lang="scss" scoped></style>

