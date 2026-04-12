<template>
  <div class="admin-hub-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div v-if="!adminRole" class="feather-row">
      <div class="feather-col-12 admin-hub__denied">
        <p class="headline4">Access Denied</p>
        <p class="subtitle1">You must be an administrator to access this page.</p>
      </div>
    </div>

    <div v-else class="admin-hub">
      <div class="admin-hub__grid">
        <AdminCard
          v-for="card in adminCards"
          :key="card.title"
          :title="card.title"
          :links="card.links"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AdminCard from '@/components/Admin/AdminCard.vue'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import { useMenuStore } from '@/stores/menuStore'
import useRole from '@/composables/useRole'
import { BreadCrumb } from '@/types'

const menuStore = useMenuStore()
const { adminRole } = useRole()

const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)
const baseHref = computed<string>(() => menuStore.mainMenu.baseHref ?? '/opennms/')
const zenithEnabled = computed<boolean>(() => menuStore.mainMenu.zenithConnectEnabled ?? false)

const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Admin', to: '#', position: 'last' }
])

const adminCards = computed(() => {
  type AdminLink = { label: string; href?: string; to?: string; external?: boolean }
  const openNMSSystemLinks: AdminLink[] = [
    { label: 'System Configuration', to: '/system-config' },
    { label: 'Configure Users, Groups and On-Call Roles', to: '/users-groups' },
  ]
  if (zenithEnabled.value) {
    openNMSSystemLinks.push({ label: 'Connect to Zenith', to: '/zenith-connect' })
  }

  return [
    {
      title: 'OpenNMS System',
      links: openNMSSystemLinks
    },
    {
      title: 'Provisioning',
      links: [
        { label: 'Manage Provisioning Requisitions', href: baseHref.value + 'admin/ng-requisitions/index.jsp' },
        { label: 'Import and Export Asset Information', href: baseHref.value + 'admin/asset/index.jsp' },
        { label: 'Manage Surveillance Categories', href: baseHref.value + 'admin/categories.htm' },
        { label: 'Configure Discovery', to: '/discovery-config' },
        { label: 'Run Single Discovery Scan', href: baseHref.value + 'admin/discovery/edit-scan.jsp' },
        { label: 'Configure SNMP Community Names by IP Address', to: '/snmp-config' },
        { label: 'Manually Add an Interface', href: baseHref.value + 'admin/newInterface.jsp' },
        { label: 'Delete Nodes', href: baseHref.value + 'admin/delete.jsp' },
        { label: 'Configure External Requisitions', to: '/configuration' },
        { label: 'Configure Geocoder Service', href: baseHref.value + 'admin/geoservice/index.jsp' },
        { label: 'Secure Credentials Vault', to: '/scv' },
      ]
    },
    {
      title: 'Event Management',
      links: [
        { label: 'Manually Send an Event', href: baseHref.value + 'admin/sendevent.htm' },
        { label: 'Configure Notifications', to: '/notification-config' },
        { label: 'Configure Destination Paths', to: '/notification-config/paths' },
        { label: 'Manage Event Configurations', to: '/event-config' },
        { label: 'Configure Path Outages (legacy)', href: baseHref.value + 'admin/notification/noticeWizard/buildPathOutage.jsp' },
      ]
    },
    {
      title: 'Flow Management',
      links: [
        { label: 'Manage Flow Classification', href: baseHref.value + 'admin/classification/index.jsp' },
      ]
    },
    {
      title: 'Service Monitoring',
      links: [
        { label: 'Configure Scheduled Outages', to: '/scheduled-outages' },
        { label: 'Manage and Unmanage Interfaces and Services', href: baseHref.value + 'admin/manage.jsp' },
      ]
    },
    {
      title: 'Performance Measurement',
      links: [
        { label: 'Configure SNMP Collections and Data Collection Groups', to: '/snmp-collections-config' },
        { label: 'Configure SNMP Data Collection per Interface', href: baseHref.value + 'admin/snmpInterfaces.jsp' },
        { label: 'Configure Thresholds', to: '/threshold-config' },
      ]
    },
    {
      title: 'Distributed Monitoring',
      links: [
        { label: 'Manage Monitoring Locations', to: '/monitoring-locations' },
        { label: 'Manage Applications', href: baseHref.value + 'admin/applications.htm' },
        { label: 'Manage Minions', to: '/minions' },
      ]
    },
    {
      title: 'Additional Tools',
      links: [
        { label: 'Configure Grafana Endpoints (Reports only)', href: baseHref.value + 'admin/endpoint/index.jsp' },
        { label: 'Instrumentation Log Reader', href: baseHref.value + 'admin/nodemanagement/instrumentationLogReader.jsp' },
        { label: 'JMX Config Generator', to: '/jmx-config-generator' },
        { label: 'SNMP MIB Compiler', to: '/mib-compiler' },
        { label: 'Business Service Administration', to: '/bsm-admin' },
        { label: 'Wallboard Configuration', to: '/wallboard-config' },
        { label: 'Surveillance Views Configuration', to: '/surveillance-views-config' },
      ]
    },
  ]
})
</script>

<style lang="scss" scoped>
@import "@featherds/styles/mixins/typography";
@import "@featherds/styles/themes/variables";

.admin-hub-page {
  padding: 0 20px 20px;
  background: var($surface);
  min-height: 100%;
}

.admin-hub {
  &__denied {
    padding: 24px 0;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    padding-top: 16px;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }
}
</style>
