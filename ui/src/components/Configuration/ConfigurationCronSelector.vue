<template>
  <div>
    <div
      class="flex"
      v-if="!props.config.advancedCrontab"
    >
      <div class="occurance p-float-label">
        <Select
          data-test="schedule-type-select"
          optionLabel="name"
          :options="scheduleTypes"
          :invalid="!!props.errors.occurance"
          @update:modelValue="(val: unknown) => updateFormValue('occurance', val as string)"
          :modelValue="props.config.occurance"
          inputId="schedule-type-select"
        />
        <label for="schedule-type-select">Schedule Type</label>
        <small v-if="props.errors.occurance" class="p-error">{{ props.errors.occurance }}</small>
      </div>
      <div v-if="props.config.occurance.name === 'Monthly'" class="occurance-day p-float-label">
        <Select
          optionLabel="name"
          :options="dayTypes"
          :invalid="!!props.errors.occuranceDay"
          @update:modelValue="(val: unknown) => updateFormValue('occuranceDay', val as string)"
          :modelValue="props.config.occuranceDay"
          inputId="day-of-month-select"
        />
        <label for="day-of-month-select">Day of Month</label>
        <small v-if="props.errors.occuranceDay" class="p-error">{{ props.errors.occuranceDay }}</small>
      </div>
      <div v-if="props.config.occurance.name === 'Weekly'" class="occurance-week p-float-label">
        <Select
          optionLabel="name"
          :options="weekTypes"
          :invalid="!!props.errors.occuranceWeek"
          @update:modelValue="(val: unknown) => updateFormValue('occuranceWeek', val as string)"
          :modelValue="props.config.occuranceWeek"
          inputId="day-of-week-select"
        />
        <label for="day-of-week-select">Day of Week</label>
        <small v-if="props.errors.occuranceWeek" class="p-error">{{ props.errors.occuranceWeek }}</small>
      </div>
      <div class="time p-float-label">
        <InputText
          type="time"
          @update:modelValue="(val: unknown) => updateFormValue('time', val as string)"
          :modelValue="props.config.time"
          inputId="schedule-time"
        />
        <label for="schedule-time">Schedule Time</label>
      </div>
    </div>

    <div
      class="flex"
      v-if="props.config.advancedCrontab"
    >
      <div class="advanced-entry p-float-label">
        <InputText
          :invalid="!!props.errors.occuranceAdvanced"
          @update:modelValue="(val: unknown) => updateFormValue('occuranceAdvanced', val as string)"
          :modelValue="props.config.occuranceAdvanced"
          inputId="advanced-cron"
        />
        <label for="advanced-cron">Advanced (Cron) Schedule</label>
        <small v-if="props.errors.occuranceAdvanced" class="p-error">{{ props.errors.occuranceAdvanced }}</small>
      </div>
    </div>
    <div
      :class="`feather-input-hint-custom
      ${advancedCronTabHasErrorInHint}`"
    >
      {{ !hasCronValidationError ? scheduledTime : '' }}
    </div>
    <div class="flex">
      <div>
        <div class="flex align-items-center gap-2">
          <Checkbox
            :modelValue="props.config.advancedCrontab"
            @update:modelValue="(val: unknown) => updateFormValue('advancedCrontab', val as string)"
            binary
            inputId="advanced-crontab"
          />
          <label for="advanced-crontab">Advanced (Cron) Schedule</label>
        </div>
      </div>
    </div>
    <div v-if="props.config.advancedCrontab">
      <a
        target="_blank"
        class="link mb-m"
        href="http://www.quartz-scheduler.org/documentation/quartz-2.3.0/tutorials/crontrigger.html"
        >Quartz Scheduler Documentation</a
      >
    </div>
  </div>
</template>
<script
  lang="ts"
  setup
>
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import { scheduleTypes, weekTypes, dayTypes } from './copy/scheduleTypes'
import { PropType } from 'vue'
import { LocalConfiguration, LocalErrors } from './configuration.types'
import { ErrorStrings } from './copy/requisitionTypes'
import { ConfigurationHelper } from './ConfigurationHelper'
import cronstrue from 'cronstrue'

const updateFormValue = (type: string, value: string) => {
  props.updateValue(type, value)
}

const props = defineProps({
  config: { type: Object as PropType<LocalConfiguration>, required: true },
  errors: { type: Object as PropType<LocalErrors>, required: true },
  updateValue: { type: Function, required: true }
})

const scheduledTime = computed(() => {
  let ret = ''

  if (props.config.advancedCrontab) {
    ret = ConfigurationHelper.cronToEnglish(props.config.occuranceAdvanced)
  } else {
    try {
      ret = cronstrue.toString(ConfigurationHelper.convertLocalToCronTab(props.config), { dayOfWeekStartIndexZero: false })
    } catch (e) {
      // custom error instead of cronstrue lib's error message
      if (String(e).match(/^(Error: DOM)/g)) {
        ret = ErrorStrings.Required('Day of the month')
      } else if (String(e).match(/^(Error: DOW)/g)) {
        ret = ErrorStrings.Required('Day of the week')
      }
    }
  }

  return ret
})

const errorRegex = /^Error/
const advancedCronTabHasErrorInHint = computed(() => {
  if(!props.config.advancedCrontab || !errorRegex.test(ConfigurationHelper.cronToEnglish(props.config.occuranceAdvanced))) return ''

  return 'error'
})

const hasCronValidationError = computed(() => props.errors.occuranceAdvanced || props.errors.occuranceDay || props.errors.occuranceWeek)
</script>
<style lang="scss">
.advanced-entry {
    .feather-input-sub-text {
        padding-right: 0;
        .feather-input-hint {
            text-align: right;
        }
    }
}
</style>
<style
  lang="scss"
  scoped
>
@import "@featherds/styles/themes/variables";
@import "@featherds/styles/mixins/typography";

.feather-input-hint-custom {
    flex: 1;
    @include caption();
    color: var($secondary-text-on-surface);
    margin-top: -24px;
    display: flex;
    justify-content: flex-end;
    min-height: var($spacing-xl);
    padding: var($spacing-xxs) 0 var($spacing-xxs) var($spacing-m);
    &.error {
      color: var($error)
    }
}
div a.link {
    color: var($clickable-normal);
    display: inline-block;
    text-decoration: underline;
    &:hover {
        text-decoration: none;
    }
}
.flex {
    display: flex;
    width: 100%;
    flex-wrap: wrap;
    > div {
        margin-right: 16px;
        width: calc(33.33% - 16px);
        flex-grow: 1;
        &:last-child {
            width: calc(33.33%);
            margin-right: 0;
        }
        &.advanced-entry {
            flex: 0 0 100%;
        }
    }
}
</style>

