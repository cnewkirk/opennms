<template>
  <div class="alarm-data-info">
    <div>
      <h3>Alarm Information</h3>
    </div>
    <div class="spacer"></div>
    <div class="alarm-check flex align-items-center gap-2">
      <Checkbox
        :model-value="enableAlarmData"
        @update:model-value="$emit('setAlarmData', 'addAlarmData', $event)"
        binary
        inputId="add-alarm-data"
      />
      <label for="add-alarm-data">Add Alarm Data</label>
    </div>
    <div class="spacer"></div>
    <div v-if="enableAlarmData">
      <div class="dropdown">
        <label class="label">Alarm Type:</label>
        <div class="spacer"></div>
        <div class="p-float-label">
          <Select
            inputId="alarm-type-select"
            data-test="alarm-type"
            :invalid="!!errors.alarmType"
            :options="AlarmTypeOptions"
            optionLabel="_text"
            :model-value="selectedEventAlarmType"
            @update:model-value="$emit('setAlarmData', 'alarmType', $event)"
          />
          <label for="alarm-type-select">Alarm Type</label>
          <small v-if="errors.alarmType" class="p-error">{{ errors.alarmType }}</small>
          <small v-else class="p-hint">Select the alarm type.</small>
        </div>
      </div>
      <div class="spacer"></div>
      <div class="flex align-items-center gap-2">
        <Checkbox
          :model-value="autoClean"
          @update:model-value="$emit('setAlarmData', 'autoClean', $event)"
          binary
          inputId="auto-clean"
        />
        <label for="auto-clean">Auto Clean</label>
      </div>
      <div class="spacer"></div>
      <div class="label">Alarm Reduction Key:</div>
      <div class="spacer"></div>
      <div class="p-float-label">
        <InputText
          id="alarm-reduction-key"
          data-test="alarm-reduction-key"
          :model-value="alarmReductionKey"
          :invalid="!!errors?.reductionKey"
          @update:model-value="$emit('setAlarmData', 'reductionKey', $event)"
        />
        <label for="alarm-reduction-key">Alarm Reduction Key</label>
        <small v-if="errors?.reductionKey" class="p-error">{{ errors.reductionKey }}</small>
        <small v-else class="p-hint">Provide the reduction key for the alarm.</small>
      </div>
      <div class="spacer"></div>
      <div class="label">Alarm Clear Key:</div>
      <div class="spacer"></div>
      <div class="p-float-label">
        <InputText
          id="alarm-clear-key"
          data-test="alarm-clear-key"
          :model-value="alarmClearKey"
          :invalid="!!errors.clearKey"
          @update:model-value="$emit('setAlarmData', 'clearKey', $event)"
        />
        <label for="alarm-clear-key">Alarm Clear Key</label>
        <small v-if="errors.clearKey" class="p-error">{{ errors.clearKey }}</small>
        <small v-else class="p-hint">Provide the clear key for the alarm.</small>
      </div>
      <div class="spacer"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { EventFormErrors } from '@/types/eventConfig'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { AlarmTypeOptions, ISelectItemType } from './constants'

defineEmits<{ (e: 'setAlarmData', key: string, value: any): void }>()
const props = defineProps<{
  addAlarmData: boolean,
  reductionKey: string,
  alarmType: ISelectItemType
  autoClean: boolean,
  clearKey: string,
  errors: EventFormErrors
}>()
const enableAlarmData = ref(false)
const enableAutoClean = ref(false)
const alarmReductionKey = ref('')
const alarmClearKey = ref('')
const selectedEventAlarmType = ref<ISelectItemType>({ _text: '', _value: '' })

watch(() => props, (newVal) => {
  enableAlarmData.value = newVal.addAlarmData
  alarmReductionKey.value = newVal.reductionKey
  enableAutoClean.value = newVal.autoClean
  alarmClearKey.value = newVal.clearKey
  selectedEventAlarmType.value = {
    _text: newVal.alarmType._text,
    _value: newVal.alarmType._value
  }
}, { immediate: true, deep: true })
</script>

<style scoped lang="scss">
.alarm-data-info {
  .label {
    font-weight: 600;
  }

  .spacer {
    min-height: 0.5em;
  }

  .dropdown {
    width: 50%;
  }
}
</style>

