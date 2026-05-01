<template>
  <div class="scv-list">
    <div class="title">Aliases</div>
    <div
      v-for="alias of aliases"
      :key="alias"
      class="scv-list__item"
      :class="{ 'scv-list__item--selected': selectedAlias === alias && isEditing }"
      @click="onAliasClick(alias)"
    >
      {{ alias }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useScvStore } from '@/stores/scvStore'

const scvStore = useScvStore()
const selectedAlias = ref()
const aliases = computed<string[]>(() => scvStore.aliases)
const isEditing = computed<boolean>(() => scvStore.isEditing)

const onAliasClick = (alias: string) => {
  selectedAlias.value = alias
  scvStore.getCredentialsByAlias(alias)
}
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";
@import "@featherds/styles/mixins/elevation";
@import "@featherds/styles/mixins/typography";

.scv-list {
  @include elevation(2);
  background: var($surface);
  height: calc(100vh - 150px);
  overflow-y: auto;

  .title {
    @include headline3;
    padding: 16px;
    color: var($primary-text-on-surface);
  }

  &__item {
    padding: 12px 16px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var($primary-text-on-surface);

    &:hover {
      background: var($shade-2);
    }

    &--selected {
      background: var($primary);
      color: var($primary-text-on-color);
    }
  }
}
</style>
