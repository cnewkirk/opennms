<template>
  <div class="topology-toolbar">

    <!-- Layers -->
    <div class="topology-toolbar__dd" ref="layersPanelRef">
      <button
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: layersPanelOpen }"
        :disabled="store.loading"
        @click="layersPanelOpen = !layersPanelOpen"
      >{{ layersButtonLabel }}</button>
      <div v-if="layersPanelOpen" class="topology-toolbar__panel">
        <label class="topology-toolbar__row">
          <input type="checkbox" :checked="allActive" :disabled="store.loading" @change="toggleAll"> All
        </label>
        <hr class="topology-toolbar__divider">
        <label
          v-for="layer in store.protocolLayers"
          :key="layer.namespace"
          class="topology-toolbar__row"
        >
          <input
            type="checkbox"
            :checked="store.activeLayers.includes(layer.namespace)"
            :disabled="store.loading || (store.activeLayers.includes(layer.namespace) && store.activeLayers.length === 1)"
            @change="store.toggleLayer(layer)"
          >
          <span class="topology-toolbar__dot" :style="{ backgroundColor: getProtocolColor(layer.label) }"></span>
          {{ prettifyProtocol(layer.label) }}
        </label>
      </div>
    </div>

    <!-- Search -->
    <FeatherInput
      v-model="searchText"
      label="Search nodes"
      class="topology-toolbar__search"
      @update:modelValue="onSearch"
    />

    <!-- Layout dropdown -->
    <div class="topology-toolbar__dd" ref="layoutPanelRef">
      <button
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: layoutPanelOpen }"
        @click="layoutPanelOpen = !layoutPanelOpen"
      >Layout ▾</button>
      <div v-if="layoutPanelOpen" class="topology-toolbar__panel topology-toolbar__panel--sm">
        <button class="topology-toolbar__menu-item" @click="emit('save-layout'); layoutPanelOpen = false">
          Save Layout
        </button>
        <button class="topology-toolbar__menu-item" @click="emit('reset-layout'); layoutPanelOpen = false">
          Reset Layout
        </button>
        <hr class="topology-toolbar__divider">
        <button class="topology-toolbar__menu-item" @click="emit('toggle-grid'); layoutPanelOpen = false">
          {{ viewStore.gridSnap.enabled ? '⊞ Grid On' : '⊡ Grid Off' }}
        </button>
        <button
          class="topology-toolbar__menu-item"
          :class="{ disabled: !viewStore.gridSnap.enabled }"
          :disabled="!viewStore.gridSnap.enabled"
          @click="emit('align-to-grid'); layoutPanelOpen = false"
        >Align to Grid</button>
      </div>
    </div>

    <!-- Weathermap -->
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

    <!-- Filter -->
    <div class="topology-toolbar__dd" ref="filterPanelRef">
      <button
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: filterPanelOpen, 'has-filters': activeFilterCount > 0 }"
        @click="filterPanelOpen = !filterPanelOpen"
      >
        Filter
        <span v-if="activeFilterCount > 0" class="topology-toolbar__badge">{{ activeFilterCount }}</span>
      </button>
      <div v-if="filterPanelOpen" class="topology-toolbar__panel topology-toolbar__panel--filter">
        <div class="topology-toolbar__section">
          <div class="topology-toolbar__section-label">Category</div>
          <div class="topology-toolbar__chips-wrap">
            <label
              v-for="cat in availableCategories"
              :key="cat"
              class="topology-toolbar__cat-chip"
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
        <div class="topology-toolbar__section">
          <div class="topology-toolbar__section-label">CIDR</div>
          <div class="topology-toolbar__tags">
            <span v-for="cidr in viewStore.filters.cidrs" :key="cidr" class="topology-toolbar__tag">
              {{ cidr }}
              <button type="button" @click="removeCidr(cidr)">×</button>
            </span>
          </div>
          <div class="topology-toolbar__inline-input">
            <input v-model="cidrInput" type="text" placeholder="10.0.0.0/8"
              :class="{ invalid: cidrInput && !isCidrValid }"
              @keydown.enter.prevent="addCidr">
            <button type="button" :disabled="!isCidrValid" @click="addCidr">Add</button>
          </div>
        </div>
        <div class="topology-toolbar__section">
          <div class="topology-toolbar__section-label">Name</div>
          <input v-model="viewStore.filters.namePattern" type="text"
            class="topology-toolbar__text-input"
            placeholder="prefix / for regex"
            @input="viewStore.markDirty()">
        </div>
        <div class="topology-toolbar__link-row">
          <button type="button" class="topology-toolbar__link" @click="clearAllFilters">Clear all</button>
          <button type="button" class="topology-toolbar__link" @click="saveFilterDefaults">Save defaults</button>
          <button type="button" class="topology-toolbar__link" @click="clearFilterDefaults">Clear defaults</button>
        </div>
      </div>
    </div>

    <!-- Views -->
    <div class="topology-toolbar__dd" ref="viewsPanelRef">
      <button
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: viewsPanelOpen }"
        @click="viewsPanelOpen = !viewsPanelOpen"
      >Views</button>
      <div v-if="viewsPanelOpen" class="topology-toolbar__panel topology-toolbar__panel--views">
        <button type="button" class="topology-toolbar__menu-item topology-toolbar__menu-item--primary" @click="startSaveView">
          + Save current view…
        </button>
        <hr class="topology-toolbar__divider">
        <div v-if="globalView" class="topology-toolbar__section-label topology-toolbar__section-label--padded">Global Default</div>
        <div v-if="globalView" class="topology-toolbar__menu-item" @click="globalView && loadView(globalView)">{{ globalView.name }}</div>
        <div v-if="sharedViews.length > 0" class="topology-toolbar__section-label topology-toolbar__section-label--padded">Shared</div>
        <div v-for="view in sharedViews" :key="view.id" class="topology-toolbar__menu-item topology-toolbar__menu-item--row" @click="loadView(view)">
          {{ view.name }}
          <button v-if="canDelete(view)" type="button" class="topology-toolbar__del-btn" @click.stop="deleteViewById(view.id)">×</button>
        </div>
        <div v-if="userViews.length > 0 || viewStore.privateViews.length > 0" class="topology-toolbar__section-label topology-toolbar__section-label--padded">My Views</div>
        <div v-for="view in userViews" :key="view.id" class="topology-toolbar__menu-item topology-toolbar__menu-item--row" @click="loadView(view)">
          {{ view.name }}
          <button type="button" class="topology-toolbar__del-btn" @click.stop="deleteViewById(view.id)">×</button>
        </div>
        <div v-for="view in viewStore.privateViews" :key="view.id" class="topology-toolbar__menu-item topology-toolbar__menu-item--row" @click="loadView(view)">
          {{ view.name }}
          <button type="button" class="topology-toolbar__del-btn" @click.stop="deletePrivateView(view.id)">×</button>
        </div>
        <div v-if="!globalView && sharedViews.length === 0 && userViews.length === 0 && viewStore.privateViews.length === 0"
          class="topology-toolbar__empty">No saved views</div>
      </div>
    </div>

    <!-- Display: Icons + Edge Labels merged -->
    <div class="topology-toolbar__dd" ref="displayPanelRef">
      <button
        type="button"
        class="topology-toolbar__chip"
        :class="{ active: displayPanelOpen }"
        @click="displayPanelOpen = !displayPanelOpen"
      >Display ▾</button>
      <div v-if="displayPanelOpen" class="topology-toolbar__panel topology-toolbar__panel--display">
        <!-- Icon settings inline -->
        <div class="topology-toolbar__section-label">Node Icons</div>
        <TopologyIconSettings />
        <hr class="topology-toolbar__divider">
        <!-- Edge labels -->
        <div class="topology-toolbar__section-label">Edge Labels</div>
        <label class="topology-toolbar__row"><input type="checkbox" v-model="elStore.showUtilization"> Utilization</label>
        <label class="topology-toolbar__row"><input type="checkbox" v-model="elStore.showLocalPort"> Local Port</label>
        <label class="topology-toolbar__row"><input type="checkbox" v-model="elStore.showRemotePort"> Remote Port</label>
        <label class="topology-toolbar__row"><input type="checkbox" v-model="elStore.showIp"> IP Addresses</label>
        <label class="topology-toolbar__row"><input type="checkbox" v-model="elStore.showMac"> MAC Address</label>
        <label class="topology-toolbar__row"><input type="checkbox" v-model="elStore.showSpeed"> Speed</label>
      </div>
    </div>

  </div>

  <!-- Save View Modal (teleported to body to avoid clipping) -->
  <Teleport to="body">
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
  </Teleport>
</template>

<script setup lang="ts">
import { FeatherInput } from '@featherds/input'
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

// Dropdown open/close refs
const layersPanelOpen = ref(false)
const layersPanelRef  = ref<HTMLElement | null>(null)
onClickOutside(layersPanelRef, () => { layersPanelOpen.value = false })

const layoutPanelOpen = ref(false)
const layoutPanelRef  = ref<HTMLElement | null>(null)
onClickOutside(layoutPanelRef, () => { layoutPanelOpen.value = false })

const filterPanelOpen = ref(false)
const filterPanelRef  = ref<HTMLElement | null>(null)
onClickOutside(filterPanelRef, () => { filterPanelOpen.value = false })

const viewsPanelOpen = ref(false)
const viewsPanelRef  = ref<HTMLElement | null>(null)
onClickOutside(viewsPanelRef, () => { viewsPanelOpen.value = false })

const displayPanelOpen = ref(false)
const displayPanelRef  = ref<HTMLElement | null>(null)
onClickOutside(displayPanelRef, () => { displayPanelOpen.value = false })

// Views state
const saveViewOpen      = ref(false)
const newViewName       = ref('')
const newViewDescription = ref('')
const newViewScope      = ref<'private' | 'user' | 'shared' | 'global'>('private')
const globalView        = ref<TopologyView | null>(null)
const sharedViews       = ref<TopologyView[]>([])
const userViews         = ref<TopologyView[]>([])

const canDelete = (view: TopologyView) =>
  view.owner === authStore.whoAmI?.id || (authStore.whoAmI?.roles ?? []).includes('ROLE_ADMIN')

const refreshServerViews = async () => {
  try {
    const [gv, all] = await Promise.all([getGlobalView(), getSharedViews()])
    globalView.value = gv
    sharedViews.value = all.filter(v => v.scope === 'shared')
    userViews.value   = all.filter(v => v.scope === 'user')
  } catch {
    console.warn('[topology] Failed to refresh server views')
  }
}

defineExpose({ refreshServerViews })

const INTERVAL_OPTIONS = [
  { label: '30s', value: 30  },
  { label: '1m',  value: 60  },
  { label: '5m',  value: 300 },
  { label: 'Off', value: 0   },
]

const wmStatusText = computed(() => {
  if (wmStore.error) return 'Weathermap unavailable'
  if (!wmStore.lastUpdated) return ''
  const secs = Math.round((now.value.getTime() - wmStore.lastUpdated.getTime()) / 1000)
  if (secs < 5)   return 'Updated just now'
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

// Filter
const cidrInput          = ref('')
const availableCategories = ref<string[]>([])
const isCidrValid        = computed(() => isValidCidr(cidrInput.value))

const activeFilterCount = computed(() =>
  viewStore.filters.surveillanceCategories.length +
  viewStore.filters.cidrs.length +
  (viewStore.filters.namePattern ? 1 : 0)
)

const toggleCategory = (cat: string) => {
  const cats = viewStore.filters.surveillanceCategories
  viewStore.filters.surveillanceCategories = cats.includes(cat)
    ? cats.filter(c => c !== cat)
    : [...cats, cat]
  viewStore.markDirty()
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

const saveFilterDefaults  = () => viewStore.saveFilterDefaults()
const clearFilterDefaults = () => viewStore.clearFilterDefaults()

// Views
const startSaveView = () => {
  newViewName.value = ''
  newViewDescription.value = ''
  newViewScope.value = 'private'
  saveViewOpen.value = true
  viewsPanelOpen.value = false
}

const confirmSaveView = () => {
  if (!newViewName.value) return
  emit('save-view-requested', { name: newViewName.value, description: newViewDescription.value, scope: newViewScope.value })
  saveViewOpen.value = false
}

const loadView = (view: TopologyView) => {
  if (viewStore.isDirty && !window.confirm('You have unsaved changes. Load this view anyway?')) return
  emit('restore-view', view)
  viewsPanelOpen.value = false
}

const deleteViewById = async (id: string) => {
  try {
    await deleteRemoteView(id)
    sharedViews.value = sharedViews.value.filter(v => v.id !== id)
    userViews.value   = userViews.value.filter(v => v.id !== id)
    if (globalView.value?.id === id) globalView.value = null
  } catch {
    window.alert('Failed to delete view.')
  }
}

const deletePrivateView = (id: string) => viewStore.deletePrivateView(id)

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
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  flex-shrink: 0;

  // Every direct dropdown host
  &__dd {
    position: relative;
  }

  // Shared panel base
  &__panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 300;
    background: var($surface);
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-sm;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    min-width: 160px;
    padding: 6px 0;

    &--sm   { min-width: 160px; }
    &--filter { min-width: 260px; padding: 10px 12px; }
    &--views  { min-width: 220px; }
    &--display {
      min-width: 360px;
      max-height: 520px;
      overflow-y: auto;
      padding: 10px 12px;
      // Anchor to right edge when near right side of viewport
      left: auto;
      right: 0;
    }
  }

  // Chip button (pill shape, primary-bordered)
  &__chip {
    padding: 4px 12px;
    border-radius: vars.$border-radius-pill;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var($primary);
    background: transparent;
    color: var($primary);
    transition: background 0.15s, color 0.15s;
    line-height: 1.5;
    white-space: nowrap;

    &.active, &.has-filters {
      background: var($primary);
      color: #fff;
    }

    &:disabled { opacity: 0.35; cursor: not-allowed; }
    &:not(:disabled):hover { opacity: 0.8; }
  }

  // Plain menu items inside panels
  &__menu-item {
    display: block;
    width: 100%;
    padding: 6px 14px;
    text-align: left;
    background: transparent;
    border: none;
    font-size: 0.8rem;
    color: var($primary-text-on-surface);
    cursor: pointer;
    white-space: nowrap;

    &:hover:not(:disabled) { background: var($border-on-surface); }
    &:disabled, &.disabled { opacity: 0.4; cursor: not-allowed; }

    &--primary { color: var($primary); }
    &--row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  }

  &__del-btn {
    background: transparent;
    border: none;
    color: var($secondary-text-on-surface);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0 2px;
    &:hover { color: var($error); }
  }

  &__divider {
    border: none;
    border-top: 1px solid var($border-on-surface);
    margin: 4px 0;
  }

  // Checkbox rows
  &__row {
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

  &__dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  // Search input
  &__search {
    width: 180px;
    flex-shrink: 0;
  }

  // Weathermap inline group
  &__weathermap {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__interval {
    padding: 3px 6px;
    border-radius: vars.$border-radius-surface;
    border: 1px solid var($border-on-surface);
    background: var($surface);
    color: var($primary-text-on-surface);
    font-size: 0.78rem;
    cursor: pointer;
  }

  &__wm-status {
    font-size: 0.7rem;
    color: var($secondary-text-on-surface);
    white-space: nowrap;
    &.error { color: var($error); }
  }

  // Filter panel internals
  &__section {
    margin-bottom: 10px;
    &:last-child { margin-bottom: 0; }
  }

  &__section-label {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var($secondary-text-on-surface);
    margin-bottom: 4px;

    &--padded { padding: 4px 14px 2px; }
  }

  &__chips-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__cat-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: vars.$border-radius-pill;
    font-size: 0.73rem;
    cursor: pointer;
    border: 1px solid var($border-on-surface);
    background: transparent;
    color: var($primary-text-on-surface);

    &.active { background: var($primary); color: #fff; border-color: var($primary); }
    input[type='checkbox'] { display: none; }
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 4px;
  }

  &__tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px;
    border-radius: vars.$border-radius-pill;
    font-size: 0.73rem;
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

  &__inline-input {
    display: flex;
    gap: 4px;

    input {
      flex: 1;
      padding: 3px 7px;
      font-size: 0.78rem;
      border: 1px solid var($border-on-surface);
      border-radius: vars.$border-radius-surface;
      background: var($surface);
      color: var($primary-text-on-surface);
      &.invalid { border-color: var($error); }
    }

    button {
      padding: 3px 9px;
      font-size: 0.78rem;
      border-radius: vars.$border-radius-surface;
      border: 1px solid var($primary);
      background: var($primary);
      color: #fff;
      cursor: pointer;
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }
  }

  &__text-input {
    width: 100%;
    padding: 3px 7px;
    font-size: 0.78rem;
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-surface;
    background: var($surface);
    color: var($primary-text-on-surface);
  }

  &__link-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 6px;
  }

  &__link {
    background: none;
    border: none;
    color: var($primary);
    font-size: 0.73rem;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: #fff;
    color: var($primary);
    font-size: 0.6rem;
    font-weight: 700;
    margin-left: 3px;
  }

  &__empty {
    padding: 8px 14px;
    font-size: 0.78rem;
    color: var($secondary-text-on-surface);
  }
}

// Modal — outside scoped tree so it renders in teleport
.topology-toolbar__modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.topology-toolbar__modal {
  background: var(--feather-surface);
  border-radius: 6px;
  padding: 24px 28px;
  min-width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

  h3 {
    margin: 0 0 16px;
    font-size: 1rem;
    font-weight: 600;
    color: var(--feather-primary-text-on-surface);
  }

  label {
    display: block;
    font-size: 0.8rem;
    color: var(--feather-secondary-text-on-surface);
    margin-bottom: 12px;

    input, select {
      display: block;
      width: 100%;
      margin-top: 4px;
      padding: 6px 8px;
      border: 1px solid var(--feather-border-on-surface);
      border-radius: 4px;
      background: var(--feather-surface);
      color: var(--feather-primary-text-on-surface);
      font-size: 0.85rem;
    }
  }
}

.topology-toolbar__modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;

  button {
    padding: 6px 16px;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    border: 2px solid var(--feather-primary);

    &:first-child { background: transparent; color: var(--feather-primary); }
    &:last-child {
      background: var(--feather-primary);
      color: #fff;
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }
  }
}
</style>
