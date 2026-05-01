<template>
  <div class="icon-settings">
    <div class="icon-settings__section">
      <div class="icon-settings__heading">Category → Icon</div>
      <div class="icon-settings__hint">Map OpenNMS node category names to icon types.</div>
      <div v-for="(row, i) in categoryRows" :key="i" class="icon-settings__row">
        <input
          v-model="row.key"
          class="icon-settings__input"
          placeholder="Category name (e.g. Routers)"
          @change="emitCategoryMap"
        />
        <select v-model="row.iconKey" class="icon-settings__select" @change="emitCategoryMap">
          <option value="">— none —</option>
          <option v-for="k in ICON_KEYS" :key="k" :value="k">{{ k }}</option>
        </select>
        <button class="icon-settings__del" @click="removeCategory(i)">✕</button>
      </div>
      <button class="icon-settings__add" @click="addCategory">+ Add mapping</button>
    </div>

    <div class="icon-settings__divider"></div>

    <div class="icon-settings__section">
      <div class="icon-settings__heading">sysOID Prefix → Icon</div>
      <div class="icon-settings__hint">Prefix match — longest matching prefix wins.</div>
      <div class="icon-settings__hint icon-settings__hint--coming-soon">OID matching is not yet active — entries will be applied in a future release.</div>
      <div v-for="(row, i) in oidRows" :key="i" class="icon-settings__row">
        <input
          v-model="row.key"
          class="icon-settings__input"
          placeholder="OID prefix (e.g. .1.3.6.1.4.1.9.)"
          @change="emitOidMap"
        />
        <select v-model="row.iconKey" class="icon-settings__select" @change="emitOidMap">
          <option value="">— none —</option>
          <option v-for="k in ICON_KEYS" :key="k" :value="k">{{ k }}</option>
        </select>
        <button class="icon-settings__del" @click="removeOid(i)">✕</button>
      </div>
      <button class="icon-settings__add" @click="addOid">+ Add mapping</button>
    </div>

    <div class="icon-settings__divider"></div>

    <div class="icon-settings__section">
      <div class="icon-settings__heading">Name Pattern → Icon</div>
      <div class="icon-settings__hint">
        Regex matched against node label (case-insensitive). Evaluated top-to-bottom — first match wins.
        Takes priority over category and built-in patterns.
      </div>
      <div
        v-for="(row, i) in patternRows"
        :key="i"
        class="icon-settings__row"
        draggable="true"
        @dragstart="dragStart(i)"
        @dragover.prevent
        @drop="dragDrop(i)"
      >
        <span class="icon-settings__drag-handle">⠿</span>
        <input
          v-model="row.pattern"
          class="icon-settings__input"
          placeholder="Regex (e.g. opennms.*)"
          @change="emitPatternRules"
        />
        <select v-model="row.iconKey" class="icon-settings__select" @change="emitPatternRules">
          <option value="">— none —</option>
          <option v-for="k in ICON_KEYS" :key="k" :value="k">{{ k }}</option>
        </select>
        <button class="icon-settings__del" @click="removePattern(i)">✕</button>
      </div>
      <button class="icon-settings__add" @click="addPattern">+ Add pattern</button>
    </div>

    <div class="icon-settings__divider"></div>

    <div class="icon-settings__section">
      <div class="icon-settings__heading">LAG Prefix Fallbacks</div>
      <div class="icon-settings__hint">Interface name prefixes used as LAG fallback (ifType=161 and LLDP are checked first).</div>
      <div class="icon-settings__tags">
        <span v-for="(p, i) in lagPrefixes" :key="i" class="icon-settings__tag">
          {{ p }}
          <button class="icon-settings__tag-del" @click="removePrefix(i)">✕</button>
        </span>
      </div>
      <div class="icon-settings__row">
        <input v-model="newPrefix" class="icon-settings__input" placeholder="e.g. Po, ae, bond" @keydown.enter="addPrefix" />
        <button class="icon-settings__add" @click="addPrefix">Add</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ICON_KEYS } from '@/components/Topology/iconRegistry'
import { useTopologyViewStore } from '@/stores/topologyViewStore'

const viewStore = useTopologyViewStore()

interface Row { key: string; iconKey: string }

const categoryRows = ref<Row[]>(viewStore.categoryIconMap.map(m => ({ ...m })))
const oidRows      = ref<Row[]>(viewStore.oidIconMap.map(m => ({ ...m })))
const patternRows  = ref<Array<{ pattern: string; iconKey: string }>>(
  viewStore.namePatternRules.map(r => ({ ...r }))
)
const lagPrefixes  = ref<string[]>([...viewStore.lagPrefixPatterns])
const newPrefix    = ref('')

const toMappings = (rows: Row[]) =>
  rows.filter(r => r.key.trim() && r.iconKey).map(r => ({ key: r.key.trim(), iconKey: r.iconKey }))

const emitCategoryMap = () => { viewStore.categoryIconMap = toMappings(categoryRows.value); viewStore.markDirty(); viewStore.saveIconSettings() }
const emitOidMap      = () => { viewStore.oidIconMap      = toMappings(oidRows.value);      viewStore.markDirty(); viewStore.saveIconSettings() }
const emitPrefixes    = () => { viewStore.lagPrefixPatterns = [...lagPrefixes.value];        viewStore.markDirty(); viewStore.saveIconSettings() }

const addCategory    = () => { categoryRows.value.push({ key: '', iconKey: '' }) }
const removeCategory = (i: number) => { categoryRows.value.splice(i, 1); emitCategoryMap() }
const addOid         = () => { oidRows.value.push({ key: '', iconKey: '' }) }
const removeOid      = (i: number) => { oidRows.value.splice(i, 1); emitOidMap() }

let dragIndex = -1
const dragStart = (i: number) => { dragIndex = i }
const dragDrop = (i: number) => {
  if (dragIndex < 0 || dragIndex === i) return
  const moved = patternRows.value.splice(dragIndex, 1)[0]
  patternRows.value.splice(i, 0, moved)
  dragIndex = -1
  emitPatternRules()
}

const emitPatternRules = () => {
  viewStore.namePatternRules = patternRows.value
    .filter(r => r.pattern.trim() && r.iconKey)
    .map(r => ({ pattern: r.pattern.trim(), iconKey: r.iconKey }))
  viewStore.markDirty()
  viewStore.saveIconSettings()
}

const addPattern = () => {
  patternRows.value.unshift({ pattern: '', iconKey: '' })
}

const removePattern = (i: number) => {
  patternRows.value.splice(i, 1)
  emitPatternRules()
}

const addPrefix    = () => {
  const p = newPrefix.value.trim()
  if (p && !lagPrefixes.value.includes(p)) {
    lagPrefixes.value.push(p)
    emitPrefixes()
  }
  newPrefix.value = ''
}
const removePrefix = (i: number) => { lagPrefixes.value.splice(i, 1); emitPrefixes() }
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";

.icon-settings {
  padding: 10px 12px;
  min-width: 340px;

  &__section { margin-bottom: 12px; }

  &__heading {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var($primary-text-on-surface);
    margin-bottom: 3px;
  }

  &__hint {
    font-size: 0.62rem;
    color: var($secondary-text-on-surface);
    margin-bottom: 6px;

    &--coming-soon {
      font-style: italic;
      opacity: 0.7;
    }
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  &__input {
    flex: 1;
    font-size: 0.7rem;
    padding: 2px 4px;
    background: var($surface);
    border: 1px solid var($border-on-surface);
    border-radius: 3px;
    color: var($primary-text-on-surface);
    &:focus { outline: none; border-color: var($primary); }
  }

  &__select {
    font-size: 0.7rem;
    padding: 2px 4px;
    background: var($surface);
    border: 1px solid var($border-on-surface);
    border-radius: 3px;
    color: var($primary-text-on-surface);
    cursor: pointer;
    &:focus { outline: none; border-color: var($primary); }
  }

  &__del {
    background: none;
    border: none;
    color: var($secondary-text-on-surface);
    cursor: pointer;
    font-size: 0.7rem;
    padding: 1px 4px;
    border-radius: 2px;
    &:hover { color: var($error, #FC8181); }
  }

  &__add {
    font-size: 0.68rem;
    color: var($primary);
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 0;
    &:hover { text-decoration: underline; }
  }

  &__drag-handle {
    cursor: grab;
    color: var($secondary-text-on-surface);
    font-size: 0.8rem;
    padding: 0 2px;
    user-select: none;
  }

  &__divider {
    height: 1px;
    background: var($border-on-surface);
    margin: 8px 0;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 6px;
  }

  &__tag {
    display: flex;
    align-items: center;
    gap: 3px;
    background: var($surface);
    border: 1px solid var($border-on-surface);
    border-radius: vars.$border-radius-pill;
    font-size: 0.65rem;
    padding: 1px 6px;
    color: var($primary-text-on-surface);
  }

  &__tag-del {
    background: none;
    border: none;
    color: var($secondary-text-on-surface);
    cursor: pointer;
    font-size: 0.6rem;
    padding: 0;
    line-height: 1;
    &:hover { color: var($error, #FC8181); }
  }
}
</style>
