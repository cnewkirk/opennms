<!--
This file is part of OpenNMS(R).

Copyright (C) 2025 The OpenNMS Group, Inc.
OpenNMS(R) is Copyright (C) 1999-2025 The OpenNMS Group, Inc.

OpenNMS(R) is a registered trademark of The OpenNMS Group, Inc.

OpenNMS(R) is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

OpenNMS(R) is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with OpenNMS(R). If not, see:
https://www.gnu.org/licenses/agpl-3.0.html

For more information contact:
OpenNMS(R) Licensing <license@opennms.org>
https://www.opennms.org/
https://www.opennms.com/
-->

<template>
  <div class="info-panel card">
    <div class="headline4 info-panel__title">Node Information</div>
    <dl class="info-panel__list">
      <template v-if="node.sysName">
        <dt>Name</dt><dd>{{ node.sysName }}</dd>
      </template>
      <template v-if="node.sysObjectId">
        <dt>sysObjectID</dt><dd>{{ node.sysObjectId }}</dd>
      </template>
      <template v-if="node.sysLocation">
        <dt>Location</dt><dd>{{ node.sysLocation }}</dd>
      </template>
      <template v-if="node.sysContact">
        <dt>Contact</dt><dd>{{ node.sysContact }}</dd>
      </template>
      <template v-if="node.sysDescription">
        <dt>Description</dt><dd class="info-panel__desc">{{ node.sysDescription }}</dd>
      </template>
      <template v-if="node.assetRecord?.description">
        <dt>Asset</dt><dd class="info-panel__desc">{{ node.assetRecord.description }}</dd>
      </template>
    </dl>
    <p v-if="!hasSnmpInfo" class="subtitle2 info-panel__empty">No SNMP information available</p>
  </div>
</template>

<script setup lang="ts">
import { Node } from '@/types'
const props = defineProps<{ node: Node }>()
const hasSnmpInfo = computed(() =>
  !!(props.node.sysName || props.node.sysObjectId || props.node.sysLocation ||
     props.node.sysContact || props.node.sysDescription || props.node.assetRecord?.description)
)
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@/styles/tokens";
@import "@featherds/styles/mixins/elevation";
.card {
  @include elevation(2);
  padding: 16px;
  margin-bottom: 16px;
  border-radius: vars.$border-radius-surface;
}
.info-panel {
  &__title { margin-bottom: 12px; }
  &__list {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 16px;
    margin: 0;
    dt { color: var($secondary-text-on-surface); font-weight: 600; white-space: nowrap; }
    dd { margin: 0; word-break: break-word; }
  }
  &__desc  { font-style: italic; white-space: pre-wrap; overflow-wrap: break-word; }
  &__empty { color: var($secondary-text-on-surface); margin: 4px 0 0; }
}
</style>
