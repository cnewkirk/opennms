<template>
  <div class="topology-graph">
    <div v-if="store.loading" class="topology-graph__loading">
      <FeatherSpinner />
      <span>Loading topology…</span>
    </div>
    <div v-else-if="store.error" class="topology-graph__error">
      {{ store.error }}
    </div>
    <div v-else-if="!store.loading && store.vertices.length === 0" class="topology-graph__empty">
      No nodes found for this layer.
    </div>

    <!-- Linking mode banner -->
    <div v-if="store.linkMode" class="topology-graph__link-banner">
      <span>Click a target node to link from <strong>{{ store.linkSourceVertex?.label }}</strong></span>
      <FeatherButton text @click="store.cancelLinkMode()">Cancel (Esc)</FeatherButton>
    </div>

    <div
      ref="graphContainer"
      class="topology-graph__canvas"
      :class="{ 'grid-snap-active': viewStore.gridSnap.enabled }"
      :style="viewStore.gridSnap.enabled
        ? { backgroundSize: `${viewStore.gridSnap.size}px ${viewStore.gridSnap.size}px` }
        : {}"
    />
    <TopologyDetailPanel />
    <TopologyEdgeTooltip :tooltip="edgeTooltip" />

    <CreateLinkModal
      :visible="showLinkModal"
      :sourceVertex="linkSourceForModal"
      :targetVertex="linkTargetForModal"
      @cancel="closeLinkModal"
      @create="onCreateLink"
    />
  </div>
</template>

<script setup lang="ts">
import { FeatherButton } from '@featherds/button'
import { FeatherSpinner } from '@featherds/progress'
import useTopology from '@/composables/useTopology'
import useSnackbar from '@/composables/useSnackbar'
import { useTopologyStore } from '@/stores/topologyStore'
import { useTopologyViewStore } from '@/stores/topologyViewStore'
import { TopologyVertex } from '@/types/topology'
import TopologyDetailPanel from './TopologyDetailPanel.vue'
import TopologyEdgeTooltip from './TopologyEdgeTooltip.vue'
import CreateLinkModal from './CreateLinkModal.vue'

const store = useTopologyStore()
const viewStore = useTopologyViewStore()
const { showSnackBar } = useSnackbar()
const graphContainer = ref<HTMLElement | null>(null)

const { saveLayout, resetLayout, getCy, alignToGrid, pendingLinkSource, pendingLinkTarget, edgeTooltip } = useTopology(graphContainer)

const capturePositions = (): Record<string, { x: number; y: number }> => {
  const cy = getCy()
  if (!cy) return {}
  const positions: Record<string, { x: number; y: number }> = {}
  cy.nodes().forEach(n => { positions[n.id()] = { ...n.position() } })
  return positions
}

const restorePositions = (positions: Record<string, { x: number; y: number }>) => {
  const cy = getCy()
  if (!cy) return
  cy.batch(() => {
    cy!.nodes().forEach(n => {
      const p = positions[n.id()]
      if (p) n.position(p)
    })
  })
  viewStore.saveNodePositions(store.layoutKey, positions)
}

// Modal state
const showLinkModal = ref(false)
const linkSourceForModal = ref<TopologyVertex | null>(null)
const linkTargetForModal = ref<TopologyVertex | null>(null)

watch(pendingLinkTarget, (target) => {
  if (target) {
    linkSourceForModal.value = pendingLinkSource.value
    linkTargetForModal.value = target
    showLinkModal.value = true
    pendingLinkSource.value = null
    pendingLinkTarget.value = null
  }
})

const closeLinkModal = () => {
  showLinkModal.value = false
  linkSourceForModal.value = null
  linkTargetForModal.value = null
}

const onCreateLink = async (
  nodeIdA: number, componentLabelA: string,
  nodeIdZ: number, componentLabelZ: string,
  linkLabel: string
) => {
  closeLinkModal()
  const ok = await store.addUserDefinedLink(nodeIdA, componentLabelA, nodeIdZ, componentLabelZ, linkLabel)
  if (ok) {
    showSnackBar({ msg: 'Link created successfully.' })
  } else {
    showSnackBar({ msg: 'Failed to create link.', error: true })
  }
}

// Escape key to cancel link mode
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && store.linkMode) {
    store.cancelLinkMode()
  }
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

defineExpose({ capturePositions, restorePositions, alignToGrid, saveLayout, resetLayout })
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.topology-graph {
  flex: 1;
  position: relative;
  min-height: 0;

  &__canvas {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
  }

  .grid-snap-active {
    background-image:
      linear-gradient(to right, var(--feather-shade-3, rgba(255,255,255,0.08)) 1px, transparent 1px),
      linear-gradient(to bottom, var(--feather-shade-3, rgba(255,255,255,0.08)) 1px, transparent 1px);
  }

  &__loading,
  &__error,
  &__empty {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    z-index: 1;
  }

  &__link-banner {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 20px;
    background: var($surface);
    border: 2px solid var($primary);
    border-radius: vars.$border-radius-sm;
    font-size: 0.9rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }
}
</style>
