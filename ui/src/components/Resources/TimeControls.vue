<template>
  <div class="feather-row">
    <div class="feather-col-12 wrapper">
      <Button
        text
        class="time-trigger"
        @click="toggle"
        :aria-label="`Time range: ${selectedTime}`"
      >
        {{ selectedTime }} &nbsp;
        <i class="pi pi-chevron-down" />
      </Button>

      <Popover ref="popover" class="time-popover">
        <div class="time-panel">
          <ul class="time-option-list">
            <li
              v-for="option in options"
              :key="option.label"
              class="time-option-item"
              @click="selectOption(option)"
            >{{ option.label }}</li>
          </ul>

          <div class="time-custom">
            <div class="date-field">
              <label class="field-label">Start Date</label>
              <input type="date" class="date-native-input" v-model="startDateRef" />
            </div>
            <Select
              :options="times"
              v-model="startTimeRef"
              optionLabel="label"
              placeholder="Start Time"
              class="time-select"
            />
            <div class="date-field">
              <label class="field-label">End Date</label>
              <input type="date" class="date-native-input" v-model="endDateRef" />
            </div>
            <Select
              :options="times"
              v-model="endTimeRef"
              optionLabel="label"
              placeholder="End Time"
              class="time-select"
            />
            <Button
              :disabled="disableCustomTimeBtn"
              text
              label="Apply custom time"
              @click="applyCustomTime"
            />
          </div>
        </div>
      </Popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import Select from 'primevue/select'
import { add, sub, getUnixTime, differenceInHours } from 'date-fns'

interface TimeOption {
  label: string
  time: Record<string, unknown>
}

const emit = defineEmits(['updateTime'])

const popover = ref()
const startDateRef = ref()
const startTimeRef = ref<TimeOption>({ label: '1 PM', time: { hours: '1' } })
const endDateRef = ref()
const endTimeRef = ref<TimeOption>({ label: '1 PM', time: { hours: '1' } })
const selectedTime = ref('Last Day')

const toggle = (event: Event) => popover.value?.toggle(event)

const options = [
  { label: 'Last hour',         time: { minutes: '60' } },
  { label: 'Last 2 hours',      time: { hours: '2'    } },
  { label: 'Last 4 hours',      time: { hours: '4'    } },
  { label: 'Last 8 hours',      time: { hours: '5'    } },
  { label: 'Last 12 hours',     time: { hours: '12'   } },
  { label: 'Last day',          time: { hours: '24'   } },
  { label: 'Last two days',     time: { hours: '48'   } },
  { label: 'Last week',         time: { days: '7'     } },
  { label: 'Last month',        time: { months: '1'   } },
  { label: 'Last three months', time: { months: '3'   } },
  { label: 'Last six months',   time: { months: '6'   } },
  { label: 'Last year',         time: { years: '1'    } }
]

const times = [
  { label: '12 AM', time: { hours: '0'  } },
  { label: '1 AM',  time: { hours: '1'  } },
  { label: '2 AM',  time: { hours: '2'  } },
  { label: '3 AM',  time: { hours: '3'  } },
  { label: '4 AM',  time: { hours: '4'  } },
  { label: '5 AM',  time: { hours: '5'  } },
  { label: '6 AM',  time: { hours: '6'  } },
  { label: '7 AM',  time: { hours: '7'  } },
  { label: '8 AM',  time: { hours: '8'  } },
  { label: '9 AM',  time: { hours: '9'  } },
  { label: '10 AM', time: { hours: '10' } },
  { label: '11 AM', time: { hours: '11' } },
  { label: '12 PM', time: { hours: '12' } },
  { label: '1 PM',  time: { hours: '13' } },
  { label: '2 PM',  time: { hours: '14' } },
  { label: '3 PM',  time: { hours: '15' } },
  { label: '4 PM',  time: { hours: '16' } },
  { label: '5 PM',  time: { hours: '17' } },
  { label: '6 PM',  time: { hours: '18' } },
  { label: '7 PM',  time: { hours: '19' } },
  { label: '8 PM',  time: { hours: '20' } },
  { label: '9 PM',  time: { hours: '21' } },
  { label: '10 PM', time: { hours: '22' } },
  { label: '11 PM', time: { hours: '23' } }
]

const disableCustomTimeBtn = computed(() =>
  !startDateRef.value || !startTimeRef.value || !endDateRef.value || !endTimeRef.value
)

const selectOption = (option: TimeOption) => {
  selectedTime.value = option.label
  const now = new Date()
  emit('updateTime', {
    startTime: getUnixTime(sub(now, option.time)),
    endTime: getUnixTime(now),
    format: Object.keys(option.time)[0]
  })
  popover.value?.hide()
}

const applyCustomTime = () => {
  const startDate = startDateRef.value ? new Date(startDateRef.value) : new Date()
  const endDate   = endDateRef.value   ? new Date(endDateRef.value)   : new Date()
  const startTime = getUnixTime(add(startDate, startTimeRef.value.time))
  const endTime   = getUnixTime(add(endDate,   endTimeRef.value.time))
  const diff      = differenceInHours(startTime, endTime)
  const format    = diff < 1 ? 'minutes' : diff > 8766 ? 'years' : diff > 24 ? 'days' : 'hours'

  emit('updateTime', { startTime, endTime, format })
  selectedTime.value = 'Custom Time'
  popover.value?.hide()
}
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.wrapper {
  height: 70px;
  display: flex;
  align-items: center;
}

.time-trigger {
  font-size: 0.875rem;
}

.time-panel {
  display: flex;
  gap: 16px;
  padding: 4px;
  min-width: 460px;
}

.time-option-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex-shrink: 0;
}

.time-option-item {
  padding: 7px 12px;
  cursor: pointer;
  border-radius: 4px;
  color: var($primary-text-on-surface);
  white-space: nowrap;
  font-size: 0.875rem;

  &:hover {
    background: var($shade-4);
  }
}

.time-custom {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.date-field {
  display: flex;
  flex-direction: column;

  .field-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var($secondary-text-on-surface);
    margin-bottom: 3px;
  }

  .date-native-input {
    padding: 6px 10px;
    border: 1px solid var($border-on-surface);
    border-radius: 4px;
    background: var($surface);
    color: var($primary-text-on-surface);
    font-size: 0.875rem;
    width: 100%;
    box-sizing: border-box;
  }
}

.time-select {
  width: 100%;
}
</style>
