<template>
  <div class="topology-toolbar">
    <div class="topology-toolbar__layers" ref="layersPanelRef">
      <button
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: layersPanelOpen }"
        :disabled="store.loading"
        @click="layersPanelOpen = !layersPanelOpen"
      >{{ layersButtonLabel }}</button>
      <div v-if="layersPanelOpen" class="topology-toolbar__layers-panel">
        <label class="topology-toolbar__layer-row">
          <input type="checkbox" :checked="allActive" :disabled="store.loading" @change="toggleAll"> All
        </label>
        <hr class="topology-toolbar__layer-divider">
        <label
          v-for="layer in store.protocolLayers"
          :key="layer.namespace"
          class="topology-toolbar__layer-row"
        >
          <input
            type="checkbox"
            :checked="store.activeLayers.includes(layer.namespace)"
            :disabled="store.loading || (store.activeLayers.includes(layer.namespace) && store.activeLayers.length === 1)"
            @change="store.toggleLayer(layer)"
          >
          <span class="topology-toolbar__layer-dot" :style="{ backgroundColor: getProtocolColor(layer.label) }"></span>
          {{ prettifyProtocol(layer.label) }}
        </label>
      </div>
    </div>

    <FeatherInput
      v-model="searchText"
      label="Search nodes"
      class="topology-toolbar__search"
      @update:modelValue="onSearch"
    />

    <div class="topology-toolbar__layout-actions">
      <FeatherButton text @click="emit('save-layout')" title="Save current node positions to this browser">
        Save Layout
      </FeatherButton>
      <FeatherButton text @click="emit('reset-layout')" title="Clear saved positions and re-run auto-layout">
        Reset Layout
      </FeatherButton>
      <FeatherButton text @click="emit('toggle-grid')" :title="viewStore.gridSnap.enabled ? 'Disable grid snap' : 'Enable grid snap'">
        {{ viewStore.gridSnap.enabled ? '⊞ Grid On' : '⊡ Grid Off' }}
      </FeatherButton>
      <FeatherButton text :disabled="!viewStore.gridSnap.enabled" @click="emit('align-to-grid')" title="Snap all nodes to grid">
        Align to Grid
      </FeatherButton>
    </div>

    <!-- Icons popover -->
    <div class="topology-toolbar__popover-wrap" ref="iconSettingsRef">
      <button
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: showIconSettings }"
        title="Node icon settings"
        @click="showIconSettings = !showIconSettings"
      >Icons</button>
      <div v-if="showIconSettings" class="topology-toolbar__popover">
        <TopologyIconSettings />
      </div>
    </div>

    <div class="topology-toolbar__weathermap">
      <button
        type="button"
        class="topology-toolbar__chip"
        :disabled="wmStore.loading"
        title="Refresh weathermap data"
        @click="wmStore.refresh()"
      >{{ wmStore.loading ? '…' : '↺' }} Weathermap</button>

      <select
        class="topology-toolbar__interval"
        v-model.number="intervalModel"
        title="Auto-refresh interval"
      >
        <option v-for="opt in INTERVAL_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>

      <span v-if="wmStatusText" class="topology-toolbar__wm-status" :class="{ error: !!wmStore.error }">
        {{ wmStatusText }}
      </span>
    </div>

    <!-- Filter Panel -->
    <div class="topology-toolbar__filters" ref="filterPanelRef">
      <button
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: filterPanelOpen, 'has-filters': activeFilterCount > 0 }"
        @click="filterPanelOpen = !filterPanelOpen"
      >
        Filter
        <span v-if="activeFilterCount > 0" class="topology-toolbar__filter-badge">{{ activeFilterCount }}</span>
      </button>
      <div v-if="filterPanelOpen" class="topology-toolbar__filter-panel">
        <div class="topology-toolbar__filter-section">
          <div class="topology-toolbar__filter-label">Category</div>
          <div class="topology-toolbar__category-chips">
            <label
              v-for="cat in availableCategories"
              :key="cat"
              class="topology-toolbar__category-chip"
              :class="{ active: viewStore.filters.surveillanceCategories.includes(cat) }"
            >
              <input
                type="checkbox"
                :checked="viewStore.filters.surveillanceCategories.includes(cat)"
                @change="toggleCategory(cat)"
              >
              {{ cat }}
            </label>
          </div>
        </div>

        <div class="topology-toolbar__filter-section">
          <div class="topology-toolbar__filter-label">CIDR</div>
          <div class="topology-toolbar__cidr-list">
            <span
              v-for="cidr in viewStore.filters.cidrs"
              :key="cidr"
              class="topology-toolbar__cidr-chip"
            >
              {{ cidr }}
              <button type="button" @click="removeCidr(cidr)">×</button>
            </span>
          </div>
          <div class="topology-toolbar__cidr-input">
            <input
              v-model="cidrInput"
              type="text"
              placeholder="e.g. 10.0.0.0/8"
              :class="{ invalid: cidrInput && !isCidrValid }"
              @keydown.enter.prevent="addCidr"
            >
            <button type="button" :disabled="!isCidrValid" @click="addCidr">Add</button>
          </div>
        </div>

        <div class="topology-toolbar__filter-section">
          <div class="topology-toolbar__filter-label">Name</div>
          <input
            v-model="viewStore.filters.namePattern"
            type="text"
            class="topology-toolbar__name-filter"
            placeholder="Search nodes... (prefix / for regex)"
            @input="viewStore.markDirty()"
          >
        </div>

        <div class="topology-toolbar__filter-actions">
          <button type="button" class="topology-toolbar__link" @click="clearAllFilters">Clear all</button>
          <button type="button" class="topology-toolbar__link" @click="saveFilterDefaults">Save as my defaults</button>
          <button type="button" class="topology-toolbar__link" @click="clearFilterDefaults">Clear my defaults</button>
        </div>
      </div>
    </div>

    <!-- Views Panel -->
    <div class="topology-toolbar__views" ref="viewsPanelRef">
      <button
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: viewsPanelOpen }"
        @click="viewsPanelOpen = !viewsPanelOpen"
      >Views</button>

      <div v-if="viewsPanelOpen" class="topology-toolbar__views-panel">
        <button type="button" class="topology-toolbar__views-action" @click="startSaveView">
          + Save current view…
        </button>
        <hr class="topology-toolbar__layer-divider">

        <div v-if="globalView" class="topology-toolbar__views-section-label">Global Default</div>
        <div v-if="globalView" class="topology-toolbar__views-item" @click="globalView && loadView(globalView)">
          {{ globalView.name }}
        </div>

        <div v-if="sharedViews.length > 0" class="topology-toolbar__views-section-label">Shared Views</div>
        <div
          v-for="view in sharedViews"
          :key="view.id"
          class="topology-toolbar__views-item"
          @click="loadView(view)"
        >
          {{ view.name }}
          <button v-if="canDelete(view)" type="button" class="topology-toolbar__views-delete" @click.stop="deleteViewById(view.id)">×</button>
        </div>

        <div v-if="userViews.length > 0 || viewStore.privateViews.length > 0" class="topology-toolbar__views-section-label">My Views</div>
        <div
          v-for="view in userViews"
          :key="view.id"
          class="topology-toolbar__views-item"
          @click="loadView(view)"
        >
          {{ view.name }}
          <button type="button" class="topology-toolbar__views-delete" @click.stop="deleteViewById(view.id)">×</button>
        </div>
        <div
          v-for="view in viewStore.privateViews"
          :key="view.id"
          class="topology-toolbar__views-item"
          @click="loadView(view)"
        >
          {{ view.name }}
          <button type="button" class="topology-toolbar__views-delete" @click.stop="deletePrivateView(view.id)">×</button>
        </div>
      </div>
    </div>

    <!-- Save View Modal -->
    <div v-if="saveViewOpen" class="topology-toolbar__modal-overlay" @click.self="saveViewOpen = false">
      <div class="topology-toolbar__modal">
        <h3>Save View</h3>
        <label>Name<input v-model="newViewName" type="text" placeholder="My view name"></label>
        <label>Description<input v-model="newViewDescription" type="text"></label>
        <label>
          Scope
          <select v-model="newViewScope">
            <option value="private">Private (this browser only)</option>
            <option value="user">My Account (all my browsers)</option>
            <option value="shared">Shared (all users)</option>
            <option v-if="authStore.whoAmI?.roles?.includes('ROLE_ADMIN')" value="global">Global Default</option>
          </select>
        </label>
        <div class="topology-toolbar__modal-actions">
          <button type="button" @click="saveViewOpen = false">Cancel</button>
          <button type="button" :disabled="!newViewName" @click="confirmSaveView">Save</button>
        </div>
      </div>
    </div>

    <!-- Edge Labels Panel -->
    <div class="topology-toolbar__edge-labels" ref="edgeLabelPanelRef">
      <button
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: edgeLabelPanelOpen }"
        @click="edgeLabelPanelOpen = !edgeLabelPanelOpen"
      >Edge Labels ▾</button>
      <div v-if="edgeLabelPanelOpen" class="topology-toolbar__edge-label-panel">
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showUtilization"> Utilization
        </label>
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showLocalPort"> Local Port
        </label>
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showRemotePort"> Remote Port
        </label>
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showIp"> IP Addresses
        </label>
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showMac"> MAC Address
        </label>
        <label class="topology-toolbar__edge-label-row">
          <input type="checkbox" v-model="elStore.showSpeed"> Speed
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherInput } from '@featherds/input'
import { FeatherButton } from '@featherds/button'
import { useTopologyStore } from '@/stores/topologyStore'
import { useWeathermapStore } from '@/stores/weathermapStore'
import { useEdgeLabelStore } from '@/stores/edgeLabelStore'
import { useDebounceFn, useNow, onClickOutside } from '@vueuse/core'
import { getProtocolColor, prettifyProtocol } from './protocolColors'
import { useTopologyViewStore } from '@/stores/topologyViewStore'
import { isValidCidr } from '@/components/Topology/cidrUtils'
import { getCategories } from '@/services/categoryService'
import { getSharedViews, getGlobalView, deleteView as deleteRemoteView } from '@/services/topologyViewService'
import { useAuthStore } from '@/stores/authStore'
import type { TopologyView } from '@/types/topology'
import TopologyIconSettings from './TopologyIconSettings.vue'

const emit = defineEmits<{
  'save-layout': []
  'reset-layout': []
  'toggle-grid': []
  'align-to-grid': []
  'save-view-requested': [{ name: string; description: string; scope: 'private' | 'user' | 'shared' | 'global' }]
  'restore-view': [TopologyView]
}>()

const store = useTopologyStore()
const wmStore = useWeathermapStore()
const elStore = useEdgeLabelStore()
const viewStore = useTopologyViewStore()
const authStore = useAuthStore()
const now = useNow({ interval: 5000 })

// Icon settings popover
const showIconSettings = ref(false)
const iconSettingsRef = ref<HTMLElement | null>(null)
onClickOutside(iconSettingsRef, () => { showIconSettings.value = false })

// Layers dropdown
const layersPanelOpen = ref(false)
const layersPanelRef = ref<HTMLElement | null>(null)
onClickOutside(layersPanelRef, () => { layersPanelOpen.value = false })

// Edge Labels dropdown
const edgeLabelPanelOpen = ref(false)
const edgeLabelPanelRef = ref<HTMLElement | null>(null)
onClickOutside(edgeLabelPanelRef, () => { edgeLabelPanelOpen.value = false })

// Views panel
const viewsPanelOpen = ref(false)
const viewsPanelRef = ref<HTMLElement | null>(null)
onClickOutside(viewsPanelRef, () => { viewsPanelOpen.value = false })
const saveViewOpen = ref(false)
const newViewName = ref('')
const newViewDescription = ref('')
const newViewScope = ref<'private' | 'user' | 'shared' | 'global'>('private')
const globalView = ref<TopologyView | null>(null)
const sharedViews = ref<TopologyView[]>([])
const userViews = ref<TopologyView[]>([])

const canDelete = (view: TopologyView) =>
  view.owner === authStore.whoAmI?.id || (authStore.whoAmI?.roles ?? []).includes('ROLE_ADMIN')

const refreshServerViews = async () => {
  try {
    const [gv, all] = await Promise.all([getGlobalView(), getSharedViews()])
    globalView.value = gv
    sharedViews.value = all.filter(v => v.scope === 'shared')
    userViews.value = all.filter(v => v.scope === 'user')
  } catch {
    console.warn('[topology] Failed to refresh server views')
  }
}

defineExpose({ refreshServerViews })

const INTERVAL_OPTIONS = [
  { label: '30s',  value: 30 },
  { label: '1m',   value: 60 },
  { label: '5m',   value: 300 },
  { label: 'Off',  value: 0 }
]

const wmStatusText = computed(() => {
  if (wmStore.error) return 'Weathermap unavailable'
  if (!wmStore.lastUpdated) return ''
  const secs = Math.round((now.value.getTime() - wmStore.lastUpdated.getTime()) / 1000)
  if (secs < 5) return 'Updated just now'
  if (secs < 120) return `Updated ${secs}s ago`
  return `Updated ${Math.round(secs / 60)}m ago`
})

const intervalModel = computed({
  get: () => wmStore.pollInterval,
  set: (v: number) => wmStore.setPollInterval(v)
})

const allActive = computed(() =>
  store.protocolLayers.length > 0 &&
  store.protocolLayers.every(l => store.activeLayers.includes(l.namespace))
)

const layersButtonLabel = computed(() => {
  if (allActive.value) return 'All Layers ▾'
  const n = store.activeLayers.length
  return `${n} Layer${n !== 1 ? 's' : ''} ▾`
})

const toggleAll = () => store.setAllLayers(!allActive.value)

const searchText = ref('')

const onSearch = useDebounceFn((val: string | number | undefined) => {
  store.setSearchQuery(String(val ?? ''))
}, 300)

// Filter panel state
const filterPanelOpen = ref(false)
const filterPanelRef = ref<HTMLElement | null>(null)
onClickOutside(filterPanelRef, () => { filterPanelOpen.value = false })
const cidrInput = ref('')
const availableCategories = ref<string[]>([])
const isCidrValid = computed(() => isValidCidr(cidrInput.value))

const activeFilterCount = computed(() =>
  viewStore.filters.surveillanceCategories.length +
  viewStore.filters.cidrs.length +
  (viewStore.filters.namePattern ? 1 : 0)
)

let _fetchCategorySeq = 0

const toggleCategory = async (cat: string) => {
  const cats = viewStore.filters.surveillanceCategories
  if (cats.includes(cat)) {
    viewStore.filters.surveillanceCategories = cats.filter(c => c !== cat)
  } else {
    viewStore.filters.surveillanceCategories = [...cats, cat]
  }
  const seq = ++_fetchCategorySeq
  viewStore.markDirty()
  if (seq !== _fetchCategorySeq) return
}

const addCidr = () => {
  if (!isCidrValid.value || viewStore.filters.cidrs.includes(cidrInput.value)) return
  viewStore.filters.cidrs = [...viewStore.filters.cidrs, cidrInput.value]
  cidrInput.value = ''
  viewStore.markDirty()
}

const removeCidr = (cidr: string) => {
  viewStore.filters.cidrs = viewStore.filters.cidrs.filter(c => c !== cidr)
  viewStore.markDirty()
}

const clearAllFilters = () => {
  viewStore.filters.surveillanceCategories = []
  viewStore.filters.cidrs = []
  viewStore.filters.namePattern = ''
  viewStore.markDirty()
}

const saveFilterDefaults = () => viewStore.saveFilterDefaults()
const clearFilterDefaults = () => viewStore.clearFilterDefaults()

// Views panel actions
const startSaveView = () => {
  newViewName.value = ''
  newViewDescription.value = ''
  newViewScope.value = 'private'
  saveViewOpen.value = true
}

const confirmSaveView = async () => {
  if (!newViewName.value) return
  emit('save-view-requested', { name: newViewName.value, description: newViewDescription.value, scope: newViewScope.value })
  saveViewOpen.value = false
}

const loadView = (view: TopologyView) => {
  if (viewStore.isDirty) {
    if (!window.confirm('You have unsaved changes. Load this view anyway?')) return
  }
  emit('restore-view', view)
  viewsPanelOpen.value = false
}

const deleteViewById = async (id: string) => {
  try {
    await deleteRemoteView(id)
    sharedViews.value = sharedViews.value.filter(v => v.id !== id)
    userViews.value = userViews.value.filter(v => v.id !== id)
    if (globalView.value?.id === id) globalView.value = null
  } catch (e) {
    console.error('[topology] Failed to delete view:', e)
    window.alert('Failed to delete view. Please try again.')
  }
}

const deletePrivateView = (id: string) => {
  viewStore.deletePrivateView(id)
}

onMounted(async () => {
  await refreshServerViews()
  try {
    const result = await getCategories()
    if (result) availableCategories.value = result.category.map((c: { name: string }) => c.name).sort()
  } catch {
    console.warn('[topology] Failed to load surveillance categories')
  }
})
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/themes/variables";

.topology-toolbar {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 8px 16px;
  flex-shrink: 0;

  &__layers {
    position: relative;
    padding-top: 8px;
  }

  &__layers-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 200;
    background: var($surface);
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-sm;
    padding: 8px 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    min-width: 160px;
  }

  &__layer-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: var($primary-text-on-surface);
    padding: 3px 0;
    cursor: pointer;
    white-space: nowrap;

    input[type='checkbox'] {
      cursor: pointer;
      &:disabled { cursor: not-allowed; opacity: 0.4; }
    }
  }

  &__layer-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__layer-divider {
    border: none;
    border-top: 1px solid var($border-on-surface);
    margin: 4px 0;
  }

  &__chip {
    padding: 4px 14px;
    border-radius: vars.$border-radius-pill;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    border: 2px solid var($primary);
    background: transparent;
    color: var($primary);
    transition: background 0.15s, color 0.15s;
    line-height: 1.4;

    &.active {
      background: var($primary);
      color: #fff;
    }

    &.has-filters {
      background: var($primary);
      color: #fff;
    }

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    &:not(:disabled):hover {
      opacity: 0.8;
    }
  }

  &__search {
    width: 220px;
  }

  &__layout-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    padding-top: 8px;
  }

  &__weathermap {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 8px;
    margin-left: 8px;
  }

  &__interval {
    padding: 4px 8px;
    border-radius: vars.$border-radius-surface;
    border: 1px solid var($border-on-surface);
    background: var($surface);
    color: var($primary-text-on-surface);
    font-size: 0.8rem;
    cursor: pointer;
  }

  &__wm-status {
    font-size: 0.72rem;
    color: var($secondary-text-on-surface);
    white-space: nowrap;

    &.error { color: var($error); }
  }

  &__edge-labels {
    position: relative;
    padding-top: 8px;
  }

  &__edge-label-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 200;
    background: var($surface);
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-sm;
    padding: 8px 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    min-width: 150px;
  }

  &__edge-label-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: var($primary-text-on-surface);
    padding: 3px 0;
    cursor: pointer;
    white-space: nowrap;

    input[type='checkbox'] {
      cursor: pointer;
    }
  }

  &__views {
    position: relative;
    padding-top: 8px;
  }

  &__views-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 200;
    background: var($surface);
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-sm;
    padding: 8px 0;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    min-width: 220px;
  }

  &__views-action {
    display: block;
    width: 100%;
    padding: 6px 14px;
    text-align: left;
    background: transparent;
    border: none;
    font-size: 0.8rem;
    color: var($primary);
    cursor: pointer;

    &:hover { background: var($border-on-surface); }
  }

  &__views-section-label {
    padding: 4px 14px 2px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var($secondary-text-on-surface);
  }

  &__views-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 14px;
    font-size: 0.8rem;
    color: var($primary-text-on-surface);
    cursor: pointer;

    &:hover { background: var($border-on-surface); }
  }

  &__views-delete {
    background: transparent;
    border: none;
    color: var($secondary-text-on-surface);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0 2px;

    &:hover { color: var($error); }
  }

  &__modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__modal {
    background: var($surface);
    border-radius: vars.$border-radius-sm;
    padding: 24px 28px;
    min-width: 320px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

    h3 {
      margin: 0 0 16px;
      font-size: 1rem;
      font-weight: 600;
      color: var($primary-text-on-surface);
    }

    label {
      display: block;
      font-size: 0.8rem;
      color: var($secondary-text-on-surface);
      margin-bottom: 12px;

      input, select {
        display: block;
        width: 100%;
        margin-top: 4px;
        padding: 6px 8px;
        border: 1px solid var($border-on-surface);
        border-radius: vars.$border-radius-surface;
        background: var($surface);
        color: var($primary-text-on-surface);
        font-size: 0.85rem;
      }
    }
  }

  &__modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;

    button {
      padding: 6px 16px;
      border-radius: vars.$border-radius-pill;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      border: 2px solid var($primary);

      &:first-child {
        background: transparent;
        color: var($primary);
      }

      &:last-child {
        background: var($primary);
        color: #fff;

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      }
    }
  }

  &__filter-section {
    margin-bottom: 12px;
  }

  &__filter-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var($secondary-text-on-surface);
    margin-bottom: 4px;
  }

  &__category-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__category-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: vars.$border-radius-pill;
    font-size: 0.75rem;
    cursor: pointer;
    border: 1px solid var($border-on-surface);
    background: transparent;
    color: var($primary-text-on-surface);

    &.active {
      background: var($primary);
      color: #fff;
      border-color: var($primary);
    }

    input[type='checkbox'] { display: none; }
  }

  &__cidr-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 4px;
  }

  &__cidr-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: vars.$border-radius-pill;
    font-size: 0.75rem;
    background: var($border-on-surface);
    color: var($primary-text-on-surface);

    button {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.9rem;
      line-height: 1;
      color: var($secondary-text-on-surface);
      padding: 0;
    }
  }

  &__cidr-input {
    display: flex;
    gap: 4px;

    input {
      flex: 1;
      padding: 4px 8px;
      font-size: 0.8rem;
      border: 1px solid var($border-on-surface);
      border-radius: vars.$border-radius-surface;
      background: var($surface);
      color: var($primary-text-on-surface);

      &.invalid { border-color: var($error); }
    }

    button {
      padding: 4px 10px;
      font-size: 0.8rem;
      border-radius: vars.$border-radius-surface;
      border: 1px solid var($primary);
      background: var($primary);
      color: #fff;
      cursor: pointer;

      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }
  }

  &__name-filter {
    width: 100%;
    padding: 4px 8px;
    font-size: 0.8rem;
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-surface;
    background: var($surface);
    color: var($primary-text-on-surface);
  }

  &__filter-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 4px;
  }

  &__link {
    background: none;
    border: none;
    color: var($primary);
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }

  &__filters {
    position: relative;
    padding-top: 8px;
  }

  &__filter-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 200;
    background: var($surface);
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-sm;
    padding: 12px 14px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    min-width: 260px;
  }

  &__filter-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    color: var($primary);
    font-size: 0.65rem;
    font-weight: 700;
    margin-left: 4px;
  }

  &__popover-wrap {
    position: relative;
    padding-top: 8px;
  }

  &__popover {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 200;
    background: var($surface);
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-sm;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    overflow-y: auto;
    max-height: 480px;
  }
}
</style>
