<template>
  <div id="wrap">
    <table class="tl1 tl2 tl3" summary="Nodes">
      <thead>
        <tr>
          <th scope="col" class="sortable-th" @click="nextSort('id')">
            ID <i :class="sortIndicator('id')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('foreignSource')">
            FOREIGN SOURCE <i :class="sortIndicator('foreignSource')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('foreignId')">
            FOREIGN ID <i :class="sortIndicator('foreignId')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('label')">
            LABEL <i :class="sortIndicator('label')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('labelSource')">
            LABEL SOURCE <i :class="sortIndicator('labelSource')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('lastCapabilitiesScan')">
            LAST CAP SCAN <i :class="sortIndicator('lastCapabilitiesScan')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('primaryInterface')">
            PRIMARY INTERFACE <i :class="sortIndicator('primaryInterface')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('sysObjectId')">
            SYSOBJECTID <i :class="sortIndicator('sysObjectId')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('sysName')">
            SYSNAME <i :class="sortIndicator('sysName')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('sysDescription')">
            SYSDESCRIPTION <i :class="sortIndicator('sysDescription')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('sysContact')">
            SYSCONTACT <i :class="sortIndicator('sysContact')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('sysLocation')">
            SYSLOCATION <i :class="sortIndicator('sysLocation')" />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="node in nodes" :key="node.id" @dblclick="doubleClickHandler(node)">
          <td class="first-td" :class="nodeLabelAlarmSeverityMap[node.label]">
            <router-link :to="`/node/${node.id}`">{{ node.id }}</router-link>
          </td>
          <td>{{ node.foreignSource }}</td>
          <td>{{ node.foreignId }}</td>
          <td>
            <router-link :to="`/node/${node.id}`">{{ node.label }}</router-link>
          </td>
          <td>{{ node.labelSource }}</td>
          <td v-date>{{ node.lastCapabilitiesScan }}</td>
          <td>{{ node.primaryInterface }}</td>
          <td>{{ node.sysObjectId }}</td>
          <td>{{ node.sysName }}</td>
          <td>{{ node.sysDescription }}</td>
          <td>{{ node.sysContact }}</td>
          <td>{{ node.sysLocation }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<script setup lang="ts">
import { useMapStore } from '@/stores/mapStore'
import { Coordinates, Node } from '@/types'

const mapStore = useMapStore()
const nodes = computed<Node[]>(() => mapStore.getNodes())
const nodeLabelAlarmSeverityMap = computed(() => mapStore.getNodeAlarmSeverityMap())

const doubleClickHandler = (node: Node) => {
  const coordinate: Coordinates = { latitude: node.assetRecord.latitude, longitude: node.assetRecord.longitude }
  mapStore.setMapCenter(coordinate)
}

type SortDir = 'asc' | 'desc' | 'none'
const sortStates = reactive<Record<string, SortDir>>({
  label: 'asc',
  id: 'none',
  foreignSource: 'none',
  foreignId: 'none',
  labelSource: 'none',
  lastCapabilitiesScan: 'none',
  primaryInterface: 'none',
  sysObjectId: 'none',
  sysName: 'none',
  sysDescription: 'none',
  sysContact: 'none',
  sysLocation: 'none'
})

const nextSort = (property: string) => {
  const cur = sortStates[property]
  for (const key in sortStates) sortStates[key] = 'none'
  sortStates[property] = cur === 'asc' ? 'desc' : 'asc'
  mapStore.setNodeSortObject({ property, value: sortStates[property] })
}

const sortIndicator = (property: string) => {
  const s = sortStates[property]
  if (s === 'asc') return 'pi pi-sort-alpha-down'
  if (s === 'desc') return 'pi pi-sort-alpha-up-alt'
  return 'pi pi-sort-alt sort-inactive'
}

onMounted(() => {
  const wrap = document.getElementById('wrap')
  const thead = document.querySelector('thead')

  if (wrap && thead) {
    wrap.addEventListener('scroll', function () {
      const translate = `translate(0, ${this.scrollTop}px)`
      thead.style.transform = translate
    })
  }
})
</script>

<style lang="scss" scoped>
@import "@featherds/table/scss/table";
@import "@featherds/styles/themes/variables";

#wrap {
  height: calc(100% - 29px);
  overflow: auto;
  background: var($surface);
}
table {
  @include table;
  @include table-condensed;
  background: var($surface);
  color: var($primary-text-on-surface);
  padding-top: 4px;
  margin-top: 15px;
}
thead {
  z-index: 2;
  position: relative;
  background: var($surface);
}
.sortable-th {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;

  &:hover { background: var($surface-dark); }

  .sort-inactive { opacity: 0.3; }
}
.first-td {
  padding-left: 12px;
  border-left: 4px solid var($success);
}
.WARNING,
.MINOR,
.MAJOR {
  border-left: 4px solid var($warning);
}

.CRITICAL {
  border-left: 4px solid var($error);
}
</style>
