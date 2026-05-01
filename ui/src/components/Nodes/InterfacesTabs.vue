<template>
  <div class="card">
    <div class="feather-col-12 title headline3">Node Interfaces</div>
    <Tabs value="ip">
      <TabList>
        <Tab value="ip">IP Interfaces</Tab>
        <Tab value="snmp">SNMP Interfaces</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="ip">
          <IpInterfacesTable />
        </TabPanel>
        <TabPanel value="snmp">
          <SnmpInterfacesTable />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<script setup lang="ts">
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import SnmpInterfacesTable from './SnmpInterfacesTable.vue'
import IpInterfacesTable from './IpInterfacesTable.vue'
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/elevation";
.card {
  @include elevation(2);
  padding: 15px;
  margin-bottom: 15px;
  border-radius: vars.$border-radius-surface;
  .title {
    margin-bottom: 15px;
  }
}
</style>
