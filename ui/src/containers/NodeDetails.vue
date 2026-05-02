<template>
  <div class="node-detail-page">
    <BreadCrumbs :items="breadcrumbs" />

    <div v-if="nodeError && !nodeLoading" class="node-detail__error">
      <p class="headline4">Node not found</p>
      <p class="subtitle1">{{ nodeError }}</p>
    </div>

    <template v-else>
      <div v-if="nodeLoading" class="node-detail__skeleton headline3">Loading node…</div>
      <template v-else-if="node">
        <NodeHeader :node="node" />
        <AdminActionsBar :nodeId="id" :foreignSource="node.foreignSource" />
      </template>

      <div v-if="node" class="node-detail__tab-wrap">
        <div class="node-detail__tab-header-row">
          <Tabs v-model:value="activeTab">
            <TabList>
              <Tab value="overview">Overview</Tab>
              <Tab value="activity">Activity</Tab>
              <Tab value="graphs">Resource Graphs</Tab>
              <Tab value="network">Network</Tab>
              <Tab value="metadata">Metadata</Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="overview">
                <CollapsibleSection :title="infoSummary" :collapsed="perspectiveStore.isProblems">
                  <div class="node-detail__info-row">
                    <NodeInfoPanel :node="node" />
                    <CategoryPanel :node="node" :isAdmin="adminRole" />
                  </div>
                </CollapsibleSection>
                <AvailabilityPanel
                  :availability="availability"
                  :outages="outages"
                  :windowStart="windowStartMs"
                  :windowEnd="windowEndMs"
                  :loading="availLoading"
                  :error="availError"
                  :problemsOnly="perspectiveStore.isProblems"
                  :nodeId="nodeResourceKey"
                  @go-graphs="goToTab('graphs')"
                />
              </TabPanel>
              <TabPanel value="activity">
                <NodeActivityTab
                  v-if="tabVisited.activity"
                  :nodeId="node.id"
                  :nodeLabel="node.label"
                  :defaultSubTab="activitySubTab"
                />
              </TabPanel>
              <TabPanel value="graphs">
                <ResourceGraphsPanel v-if="tabVisited.graphs" :nodeId="node.id" />
              </TabPanel>
              <TabPanel value="network">
                <NetworkTab
                  v-if="tabVisited.network"
                  :nodeId="id"
                  :nodeResourceKey="nodeResourceKey"
                  :sshUsername="node?.assetRecord?.username || null"
                  @go-graphs="goToTab('graphs')"
                  @go-activity="goToTab('activity')"
                />
              </TabPanel>
              <TabPanel value="metadata">
                <NodeMetadataPanel v-if="tabVisited.metadata" :nodeId="id" />
              </TabPanel>
            </TabPanels>
          </Tabs>

          <div class="node-detail__perspective-wrap">
            <PerspectiveToggle />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import NodeHeader from '@/components/NodeDetail/NodeHeader.vue'
import AdminActionsBar from '@/components/NodeDetail/AdminActionsBar.vue'
import NodeInfoPanel from '@/components/NodeDetail/NodeInfoPanel.vue'
import CategoryPanel from '@/components/NodeDetail/CategoryPanel.vue'
import AvailabilityPanel from '@/components/NodeDetail/AvailabilityPanel.vue'
import NetworkTab from '@/components/NodeDetail/NetworkTab.vue'
import NodeActivityTab from '@/components/NodeDetail/NodeActivityTab.vue'
import ResourceGraphsPanel from '@/components/NodeDetail/ResourceGraphsPanel.vue'
import NodeMetadataPanel from '@/components/NodeDetail/NodeMetadataPanel.vue'
import PerspectiveToggle from '@/components/Common/PerspectiveToggle.vue'
import CollapsibleSection from '@/components/Common/CollapsibleSection.vue'
import useNodeDetail from '@/composables/useNodeDetail'
import useNodeAvailability from '@/composables/useNodeAvailability'
import useRole from '@/composables/useRole'
import { usePerspectiveStore } from '@/stores/perspectiveStore'
import { useMenuStore } from '@/stores/menuStore'
import { BreadCrumb } from '@/types'

const route = useRoute()
const router = useRouter()
const menuStore = useMenuStore()
const perspectiveStore = usePerspectiveStore()
const id = route.params.id as string

const { node, loading: nodeLoading, error: nodeError } = useNodeDetail(id)
const {
  availability, outages, windowStartMs, windowEndMs,
  loading: availLoading, error: availError
} = useNodeAvailability(id)
const { adminRole } = useRole()

// ── Tab routing ──────────────────────────────────────────────────────────────

const TAB_KEYS = ['overview', 'activity', 'graphs', 'network', 'metadata'] as const
type TopTabKey = typeof TAB_KEYS[number]
const ACTIVITY_SUB_KEYS = ['alarms', 'events', 'outages', 'links'] as const

const activeTab = ref<TopTabKey>('overview')
const tabVisited = reactive<Record<TopTabKey, boolean>>({
  overview: true,
  activity: false,
  graphs: false,
  network: false,
  metadata: false,
})
let _tabMounted = false

const goToTab = (key: TopTabKey) => {
  activeTab.value = key
}

onMounted(() => {
  const tabParam = route.query.tab as string

  // Backwards compat: old ?tab=alarms|events|outages|links navigate to Activity with that sub-tab
  if (ACTIVITY_SUB_KEYS.includes(tabParam as any)) {
    activeTab.value = 'activity'
    router.replace({ query: { tab: 'activity', subtab: tabParam } })
    _tabMounted = true
    return
  }

  if (TAB_KEYS.includes(tabParam as TopTabKey)) {
    activeTab.value = tabParam as TopTabKey
  }
  _tabMounted = true
})

watch(activeTab, (key) => {
  if (!_tabMounted) return
  tabVisited[key] = true
  if (key !== 'activity') {
    const { subtab, ...rest } = route.query
    router.replace({ query: { ...rest, tab: key } })
  } else {
    router.replace({ query: { ...route.query, tab: key } })
  }
})

const activitySubTab = computed(() => {
  const subtab = route.query.subtab as string
  return ACTIVITY_SUB_KEYS.includes(subtab as any) ? subtab : 'alarms'
})

// ── Breadcrumbs / info ───────────────────────────────────────────────────────

const homeUrl = computed<string>(() => menuStore.mainMenu?.homeUrl)
const breadcrumbs = computed<BreadCrumb[]>(() => [
  { label: 'Home', to: homeUrl.value, isAbsoluteLink: true },
  { label: 'Nodes', to: '/nodes' },
  { label: node.value?.label ?? id, to: '#', position: 'last' }
])

const infoSummary = computed(() => {
  if (!node.value) return 'Node Information'
  const parts: string[] = []
  if (node.value.sysName) parts.push(node.value.sysName)
  else if (node.value.label) parts.push(node.value.label)
  if (node.value.sysLocation) parts.push(node.value.sysLocation)
  const catCount = node.value.categories?.length ?? 0
  if (catCount > 0) parts.push(`${catCount} ${catCount === 1 ? 'category' : 'categories'}`)
  return parts.join(' · ') || 'Node Information'
})

const nodeResourceKey = computed(() => {
  if (!node.value) return id
  if (node.value.foreignSource && node.value.foreignId) {
    return `${node.value.foreignSource}:${node.value.foreignId}`
  }
  return id
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";

.node-detail-page {
  padding: 16px 20px;
}

.node-detail {
  &__error    { padding: 24px; text-align: center; }
  &__skeleton { padding: 16px; }

  &__tab-wrap { position: relative; margin-top: 12px; }

  &__tab-header-row {
    position: relative;
  }

  &__perspective-wrap {
    position: absolute;
    top: 8px;
    right: 0;
    z-index: 1;
  }

  &__info-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 16px;
    @media (max-width: 700px) { grid-template-columns: 1fr; }
  }
}
</style>
