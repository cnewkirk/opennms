<template>
  <Dialog
    :visible="visible"
    modal
    header="Node Preferences"
    :closable="true"
    @update:visible="$emit('close')"
  >
    <div class="content">
      <Tabs value="columns">
        <TabList>
          <Tab value="columns">Columns</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="columns">
            <ColumnSelectionPanel />
          </TabPanel>
        </TabPanels>
      </Tabs>
      <div class="button-panel">
        <Button severity="primary" @click="savePreferences">Save and Close</Button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Button from 'primevue/button'
import ColumnSelectionPanel from './ColumnSelectionPanel.vue'
import { saveNodePreferences } from '@/services/localStorageService'
import { useNodeStructureStore } from '@/stores/nodeStructureStore'

defineProps({
  visible: {
    required: true,
    type: Boolean
  }
})

const emit = defineEmits(['close'])

const nodeStructureStore = useNodeStructureStore()

const savePreferences = async () => {
  const nodePrefs = await nodeStructureStore.getNodePreferences()
  saveNodePreferences(nodePrefs)
  emit('close', true)
}
</script>

<style scoped lang="scss">
.content {
  min-height: 300px;
  max-height: 600px;
  min-width: 550px;
  overflow-x: hidden;
  overflow-y: auto;
  position: relative;
}

.button-panel {
  margin-top: 0.5em;
}
</style>
