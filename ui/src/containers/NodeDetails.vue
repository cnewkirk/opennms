<template>
  <div class="feather-row">
    <div class="feather-col-12">
      <BreadCrumbs :items="breadcrumbs" />
    </div>
  </div>

  <div v-if="nodeError && !nodeLoading" class="feather-row">
    <div class="feather-col-12 node-detail__error">
      <p class="headline4">Node not found</p>
      <p class="subtitle1">{{ nodeError }}</p>
    </div>
  </div>

  <template v-else>
    <div class="feather-row">
      <div class="feather-col-12">
        <div v-if="nodeLoading" class="node-detail__skeleton headline3">Loading node…</div>
        <template v-else-if="node">
          <NodeHeader :node="node" />
          <AdminActionsBar :nodeId="id" :foreignSource="node.foreignSource" />
        </template>
      </div>
    </div>

    <div v-if="node" class="feather-row">
      <div class="feather-col-12 node-detail__tab-wrap">
        <div class="node-detail__tab-header-row">
          <FeatherTabContainer v-model="activeTab">
            <template #tabs>
              <FeatherTab>Overview</FeatherTab>
              <FeatherTab>Activity</FeatherTab>
              <FeatherTab>Resource Graphs</FeatherTab>
              <FeatherTab>Network</FeatherTab>
              <FeatherTab>Metadata</FeatherTab>
            </template>

            <!-- Overview -->
            <FeatherTabPanel>
              <CollapsibleSection :title="infoSummary" :collapsed="perspectiveStore.isProblems">
                <div class="node-detail__info-row">
                  <NodeInfoPanel :node="node" />
                  <CategoryPanel :node="node" :isAdmin="adminRole" />
                </div>
              </CollapsibleSection>
              <AvailabilityPanel
                :availability="availability"
                :chartData="chartData"
                :downSegmentMeta="downSegmentMeta"
                :loading="availLoading"
                :error="availError"
                :problemsOnly="perspectiveStore.isProblems"
                :nodeId="nodeResourceKey"
                @go-graphs="goToTab('graphs')"
              />
            </FeatherTabPanel>

            <!-- Activity -->
            <FeatherTabPanel>
              <NodeActivityTab
                v-if="tabVisited[1]"
                :nodeId="node.id"
                :nodeLabel="node.label"
                :defaultSubTab="activitySubTab"
              />
            </FeatherTabPanel>

            <!-- Resource Graphs -->
            <FeatherTabPanel>
              <ResourceGraphsPanel v-if="tabVisited[2]" :nodeId="node.id" />
            </FeatherTabPanel>

            <!-- Network -->
            <FeatherTabPanel>
              <NetworkTab
                v-if="tabVisited[3]"
                :nodeId="id"
                :nodeResourceKey="nodeResourceKey"
                @go-graphs="goToTab('graphs')"
                @go-activity="goToTab('activity')"
              />
            </FeatherTabPanel>

            <!-- Metadata -->
            <FeatherTabPanel>
              <NodeMetadataPanel v-if="tabVisited[4]" :nodeId="id" />
            </FeatherTabPanel>
          </FeatherTabContainer>

          <div class="node-detail__perspective-wrap">
            <PerspectiveToggle />
          </div>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { FeatherTab, FeatherTabContainer, FeatherTabPanel } from '@featherds/tabs'
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
  availability, chartData, downSegmentMeta,
  loading: availLoading, error: availError
} = useNodeAvailability(id)
const { adminRole } = useRole()

// ── Tab routing ──────────────────────────────────────────────────────────────

const TAB_KEYS = ['overview', 'activity', 'graphs', 'network', 'metadata'] as const
type TopTabKey = typeof TAB_KEYS[number]
const ACTIVITY_SUB_KEYS = ['alarms', 'events', 'outages', 'links'] as const

const activeTab = ref(0)
const tabVisited = reactive([true, false, false, false, false])

const goToTab = (key: TopTabKey) => {
  const idx = TAB_KEYS.indexOf(key)
  activeTab.value = idx
}

// Initialize from URL on mount
onMounted(() => {
  const tabParam = route.query.tab as string

  // Backwards compat: old ?tab=alarms|events|outages|links navigate to Activity with that sub-tab
  if (ACTIVITY_SUB_KEYS.includes(tabParam as any)) {
    activeTab.value = 1
    router.replace({ query: { tab: 'activity', subtab: tabParam } })
    return
  }

  const idx = TAB_KEYS.indexOf(tabParam as TopTabKey)
  if (idx >= 0) activeTab.value = idx
})

// Mark tab visited (lazy-loads heavy panels) and sync URL
watch(activeTab, (idx) => {
  tabVisited[idx] = true
  const key = TAB_KEYS[idx]
  if (key !== 'activity') {
    // Remove subtab when leaving Activity tab
    const { subtab, ...rest } = route.query
    router.replace({ query: { ...rest, tab: key } })
  } else {
    router.replace({ query: { ...route.query, tab: key } })
  }
})

// Sub-tab for NodeActivityTab (reads ?subtab=)
const activitySubTab = computed(() => {
  const subtab = route.query.subtab as string
  return ACTIVITY_SUB_KEYS.includes(subtab as any) ? subtab : 'alarms'
})

// ── Breadcrumbs / info ───────────────────────────────────────────────────────

const homeUrl = computed<string>(() => menuStore.mainMenu.homeUrl)
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
@import "@featherds/styles/themes/variables";

.node-detail {
  &__error    { padding: 24px; text-align: center; }
  &__skeleton { padding: 16px; }

  &__tab-wrap { position: relative; }

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

.feather-row + .feather-row {
  margin-top: 12px;
}
</style>
