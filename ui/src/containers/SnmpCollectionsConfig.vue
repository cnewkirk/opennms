<template>
  <div class="snmp-collections-config">
    <BreadCrumbs :items="breadcrumbs" />
    <h2 class="page-title">SNMP Collections Configuration</h2>

    <FeatherTabContainer class="tabs">
      <template #tabs>
        <FeatherTab>Data Collection Groups</FeatherTab>
        <FeatherTab>SNMP Collections</FeatherTab>
      </template>
      <FeatherTabPanel class="tab-panel">
        <DataCollectionGroupsTab />
      </FeatherTabPanel>
      <FeatherTabPanel class="tab-panel">
        <SnmpCollectionsTab />
      </FeatherTabPanel>
    </FeatherTabContainer>
  </div>
</template>

<script setup lang="ts">
import { FeatherTab, FeatherTabContainer, FeatherTabPanel } from '@featherds/tabs'
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
