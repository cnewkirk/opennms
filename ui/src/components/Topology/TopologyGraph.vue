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

    <div ref="graphContainer" class="topology-graph__canvas" />
    <TopologyDetailPanel />
    <TopologyEdgeTooltip :tooltip="edgeTooltip" />
    <TopologyNodeTooltip :tooltip="nodeTooltip" />

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
import { TopologyVertex } from '@/types/topology'
import TopologyDetailPanel from './TopologyDetailPanel.vue'
import TopologyEdgeTooltip from './TopologyEdgeTooltip.vue'
import TopologyNodeTooltip from './TopologyNodeTooltip.vue'
import CreateLinkModal from './CreateLinkModal.vue'

const store = useTopologyStore()
const { showSnackBar } = useSnackbar()
const graphContainer = ref<HTMLElement | null>(null)

const { saveLayout, resetLayout, pendingLinkSource, pendingLinkTarget, edgeTooltip, nodeTooltip } = useTopology(graphContainer)

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

defineExpose({ saveLayout, resetLayout })
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
