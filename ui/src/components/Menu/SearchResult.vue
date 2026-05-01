<template>
    <button class="search-result-button" @click="() => itemClicked(item)" :tabIndex="0" @mouseover="() => onItemHover()" @mouseout="() => onItemOut()">
        <div class="label-wrapper">
            <div :style="{ paddingRight: '0.25em' }">
                <div :style="{ display: 'flex', alignItems: 'center' }">
                    <!-- We have removed font-awesome. Need to map any icons we get from the Search service to Feather icons. -->
                    <!-- <font-awesome-icon v-if="item.icon" :icon="item.icon" :style="{ paddingRight: '6px' }" /> -->
                    <div>
                        {{ item.label }}
                    </div>
                </div>
            </div>
            <span :class="iconClass">
                <i class="pi pi-arrow-right" style="font-size: 0.75em;" />
            </span>
        </div>
    </button>
    <div class="search-item-details" v-if="showDetails && contextLabel === 'Node'">
        <div>
            <div v-for="match in validMatches" :key="match.value">
              <span><strong>{{ match.label }}:</strong> {{ match.value }}</span>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { PropType } from 'vue'
import { SearchResultItem } from '@/types'

const props = defineProps({
  // TODO: SearchResult:item in components/Layout/Search.vue should be a SearchResultItem but may not be,
  // that's why we are using "| any" here. Need to make sure we are passing correct objects and types
  contextLabel: { type: String, default: '' },
  item: { type: Object as PropType<SearchResultItem | any>, default: () => { return } },
  itemClicked: { type: Function as PropType<(item: SearchResultItem) => void>, default: () => { return } },
  iconClass: { type: String, default: '' }
})

const showDetails = ref(false)

const validMatches = computed(() => {
  const matches = []

  const itemMatches = (props.item as SearchResultItem)?.matches

  if (itemMatches) {
    itemMatches.forEach(m => {
      matches.push({ label: m.label, value: m.value })
    })
  }

  if (props.item.properties?.foreignSource && props.item.properties?.foreignId) {
    matches.push({ label: 'FS:FID', value: `${props.item.properties?.foreignSource}:${props.item.properties?.foreignId}` })
  }

  return matches
})

const onItemHover = () => {
  showDetails.value = true
}

const onItemOut = () => {
  showDetails.value = false
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";

.label-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: '#e9ecef';
    color: '#495057';
    font-weight: 500;
    white-space: break-spaces;
    padding: 0 3px;

    .visible {
        display: block;
    }

    .short {
        font-size: 0.8em;
        margin-left: 3px;
    }

    span {
        opacity: 0;
    }

    &:hover {
        span {
            opacity: 1;
        }
    }
}
/** 
    These styles are a bit wild, but they were take from a diff done
    between this component as a div vs a button. Initially coded using the div
    we had to move to the button to get better accessibility. But then the styles were off.
    These styles below make the button in the header look significantly better.
 */
.search-result-button {
    background: transparent;
    border: none;
    appearance: none;
    block-size: 24px;
    caret-color: var($secondary-text-on-surface);
    color: var($secondary-text-on-surface);
    column-rule-color: var($secondary-text-on-surface);
    cursor: pointer;
    display: block;
    font-family: OpenSans, Helvetica, Arial, sans-serif;
    font-size: 14px;
    height: 24px;
    inline-size: 266px;
    letter-spacing: 0.25px;
    line-height: 24px;
    min-width: 30em;
    outline-color: var($secondary-text-on-surface);
    padding: 0;
    perspective-origin: 133px 12px;
    text-align: left;
    text-decoration-color: var($secondary-text-on-surface);
    text-emphasis-color: var($secondary-text-on-surface);
    transform-origin: 133px 12px;
    unicode-bidi: isolate;
    user-select: auto;
}

.search-item-details {
  margin-left: 1em;
  z-index: 1100;
  color: var($primary-text-on-surface);
  padding: 0.25em;
}
</style>
