<template>
  <div class="snmp-collections-config">
    <BreadCrumbs :items="breadcrumbs" />
    <h2 class="page-title">SNMP Collections Configuration</h2>

    <div class="tabs">
      <Tabs value="groups">
        <TabList>
          <Tab value="groups">Data Collection Groups</Tab>
          <Tab value="collections">SNMP Collections</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="groups" class="tab-panel">
            <DataCollectionGroupsTab />
          </TabPanel>
          <TabPanel value="collections" class="tab-panel">
            <SnmpCollectionsTab />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import DataCollectionGroupsTab from '@/components/SnmpCollectionsConfig/DataCollectionGroupsTab.vue'
import SnmpCollectionsTab from '@/components/SnmpCollectionsConfig/SnmpCollectionsTab.vue'
import type { BreadCrumb } from '@/types'

const breadcrumbs: BreadCrumb[] = [
  { label: 'Home', to: '/' },
  { label: 'Admin', to: '/admin' },
  { label: 'SNMP Collections Config', to: '/snmp-collections-config' }
]
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.snmp-collections-config {
  padding: 1.5rem;
  height: calc(100vh - var(--feather-header-height, 60px));
  display: flex;
  flex-direction: column;
}

.page-title {
  @include headline2;
  margin: 0.5rem 0 1rem;
}

.tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-panel {
  flex: 1;
  overflow: auto;
}
</style>
