<template>
  <Select
    class="select-ack"
    v-model="alarmOption"
    :disabled="disableAckSelect"
    :options="alarmOptions"
    optionLabel="option"
    @update:modelValue="selectAlarmAck"
    placeholder="Alarm Action"
  />
  <div id="wrap">
    <table class="tl1 tl2 tl3" summary="Alarms">
      <thead>
        <tr>
          <th class="first-th">
            <label class="checkbox-label">
              <Checkbox v-model="all" binary label="All" />
            </label>
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('id')">
            ID <i :class="sortIndicator('id')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('severity')">
            SEVERITY <i :class="sortIndicator('severity')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('nodeLabel')">
            NODE LABEL <i :class="sortIndicator('nodeLabel')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('uei')">
            UEI <i :class="sortIndicator('uei')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('count')">
            COUNT <i :class="sortIndicator('count')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('lastEventTime')">
            LAST EVENT <i :class="sortIndicator('lastEventTime')" />
          </th>
          <th scope="col" class="sortable-th" @click="nextSort('logMessage')">
            LOG MESSAGE <i :class="sortIndicator('logMessage')" />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="alarm in alarms" :key="alarm.id">
          <td :class="alarm.severity" class="first-td">
            <label class="checkbox-label">
              <Checkbox
                :modelValue="all || alarmCheckboxes[alarm.id]"
                binary
                @change="selectCheckbox(alarm)"
              />
            </label>
          </td>
          <td><router-link :to="`/alarm/${alarm.id}`">{{ alarm.id }}</router-link></td>
          <td>{{ alarm.severity }}</td>
          <td><router-link :to="`/node/${alarm.nodeId}`">{{ alarm.nodeLabel }}</router-link></td>
          <td>{{ alarm.uei }}</td>
          <td>{{ alarm.count }}</td>
          <td v-date>{{ alarm.lastEventTime }}</td>
          <td>{{ alarm.logMessage }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<script setup lang="ts">
import { Alarm, AlarmQueryParameters } from '@/types'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import { useMapStore } from '@/stores/mapStore'

const mapStore = useMapStore()
const alarms = computed<Alarm[]>(() => mapStore.getAlarms())
const alarmOptions = [
  { id: 1, option: 'Not Selected' },
  { id: 2, option: 'Acknowledge' },
  { id: 3, option: 'Unacknowledge' },
  { id: 4, option: 'Escalate' },
  { id: 5, option: 'Clear' }
]
const alarmOption = ref(alarmOptions[0])
const all = ref(false)
const alarmCheckboxes = ref<{ [x: string]: boolean }>({})

const disableAckSelect = computed(() => {
  let hasSelectedCheckbox = false

  for (const key in alarmCheckboxes.value) {
    if (alarmCheckboxes.value[key]) {
      hasSelectedCheckbox = true
      break
    }
  }
  return !all.value && !hasSelectedCheckbox
})

const selectCheckbox = (alarm: Alarm) => {
  alarmCheckboxes.value[alarm.id] = !alarmCheckboxes.value[alarm.id]
}

const selectAlarmAck = async () => {
  let alarmQueryParameters: AlarmQueryParameters = {} as AlarmQueryParameters

  switch (alarmOption.value.option) {
    case alarmOptions[0].option:
      break
    case alarmOptions[1].option: { // "Acknowledge"
      alarmQueryParameters = { ack: true }
      break
    }
    case alarmOptions[2].option: { // "Unacknowledge"
      alarmQueryParameters = { ack: false }
      break
    }
    case alarmOptions[3].option: { // "Escalate"
      alarmQueryParameters = { escalate: true }
      break
    }
    case alarmOptions[4].option: { // "Clear"
      alarmQueryParameters = { clear: true }
      break
    }
    default:
      break
  }

  const selectedAlarms = alarms.value.filter((alarm) => all.value || alarmCheckboxes.value[alarm.id])

  let numFail = 0
  const respCollection: any = []

  for (const alarm of selectedAlarms) {
    const resp = await mapStore.modifyAlarm({
      pathVariable: alarm.id, queryParameters: alarmQueryParameters
    })

    respCollection.push(resp)
  }

  const result = await Promise.all(respCollection)
  result.forEach(r => {
    if (r === false) {
      numFail = numFail + 1
    }
  })

  // update and reset selections
  mapStore.getAlarms()
  all.value = false
  alarmCheckboxes.value = {}
}

type SortDir = 'asc' | 'desc' | 'none'
const sortStates = reactive<Record<string, SortDir>>({
  id: 'desc',
  severity: 'none',
  nodeLabel: 'none',
  uei: 'none',
  count: 'none',
  lastEventTime: 'none',
  logMessage: 'none'
})

const nextSort = (property: string) => {
  const cur = sortStates[property]
  for (const key in sortStates) sortStates[key] = 'none'
  sortStates[property] = cur === 'asc' ? 'desc' : 'asc'
  mapStore.setAlarmSortObject({ property, value: sortStates[property] })
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
      let translate = 'translate(0,' + this.scrollTop + 'px)'
      thead.style.transform = translate
    })
  }
})
</script>

<style lang="scss" scoped>
@use "@/styles/table" as *;
@import "@/styles/tokens";
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
.select-ack {
  z-index: var($zindex-dropdown);
  width: 300px;
  position: absolute;
  right: 30px;
  top: 7px;
}
.first-th {
  padding-left: 20px;
}
.sortable-th {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;

  &:hover { background: var($surface-dark); }

  .sort-inactive { opacity: 0.3; }
}
.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
}
.first-td {
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
