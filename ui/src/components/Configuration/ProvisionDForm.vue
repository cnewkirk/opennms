<template>
  <div>
    <div class="p-float-label side-input mb-m">
      <InputText
        ref="firstInput"
        id="req-name"
        :invalid="!!errors.name"
        :modelValue="config.name"
        @update:modelValue="(val: any) => updateFormValue('name', val)"
      />
      <label for="req-name">Name</label>
      <small v-if="errors.name" class="p-error">{{ errors.name }}</small>
      <small v-else class="p-hint">Human-friendly name. Must be unique.</small>
    </div>
    <div class="flex-center">
      <div class="side-input full-width mb-m p-float-label">
        <Select
          data-test="external-source-select"
          optionLabel="name"
          :options="requisitionTypeList"
          :invalid="!!errors.type"
          :modelValue="config.type"
          @update:modelValue="updateExternalSource"
          inputId="external-source-select"
        />
        <label for="external-source-select">External Source</label>
        <small v-if="errors.type" class="p-error">{{ errors.type }}</small>
      </div>
      <div class="icon">
        <Button
          text
          @click="() => props.toggleHelp()"
          aria-label="Help"
        >
          <i class="pi pi-question-circle help-icon" />
        </Button>
      </div>
    </div>
    <div v-if="RequsitionTypesUsingHost.includes(config.type.name)">
      <div class="p-float-label side-input host-update mb-m">
        <InputText
          id="req-host"
          :invalid="!!errors.host"
          :modelValue="config.host"
          @update:modelValue="(val: any) => updateFormValue('host', val)"
        />
        <label for="req-host">Host</label>
        <small v-if="errors.host" class="p-error">{{ errors.host }}</small>
        <small v-else class="p-hint">{{ hostHint || 'vCenter server host or IP address' }}</small>
      </div>
    </div>
    <div v-if="RequisitionHTTPTypes.includes(config.type.name)">
      <div class="p-float-label side-input mb-m">
        <InputText
          id="req-url-path"
          :invalid="!!errors.urlPath"
          :modelValue="config.urlPath"
          @update:modelValue="(val: any) => updateFormValue('urlPath', val)"
        />
        <label for="req-url-path">Path</label>
        <small v-if="errors.urlPath" class="p-error">{{ errors.urlPath }}</small>
        <small v-else class="p-hint">URL path starting with a /</small>
      </div>
    </div>
    <div v-if="[RequisitionTypes.RequisitionPlugin].includes(config.type.name)">
      <div class="p-float-label side-input mb-m">
        <Select
          optionLabel="name"
          :options="requisitionSubTypes"
          @update:modelValue="(val: any) => updateFormValue('subType', val)"
          :modelValue="config.subType"
          inputId="req-plugin"
        />
        <label for="req-plugin">Requisition Plugin</label>
      </div>
    </div>
    <div v-if="[RequisitionTypes.DNS].includes(config.type.name)">
      <div class="p-float-label side-input mb-m">
        <InputText
          id="req-zone"
          :invalid="!!errors.zone"
          :modelValue="config.zone"
          @update:modelValue="(val: any) => updateFormValue('zone', val)"
        />
        <label for="req-zone">Zone</label>
        <small v-if="errors.zone" class="p-error">{{ errors.zone }}</small>
        <small v-else class="p-hint">DNS zone to use as basis for this definition</small>
      </div>
    </div>
    <div v-if="[RequisitionTypes.DNS].includes(config.type.name) || [RequisitionTypes.VMWare].includes(config.type.name)">
      <div class="p-float-label side-input mb-m">
        <InputText
          id="req-foreign-source"
          :invalid="!!errors.foreignSource"
          :modelValue="config.foreignSource"
          @update:modelValue="(val: any) => updateFormValue('foreignSource', val)"
        />
        <label for="req-foreign-source">Requisition Name</label>
        <small v-if="errors.foreignSource" class="p-error">{{ errors.foreignSource }}</small>
        <small v-else class="p-hint">Name to use for resulting requisition</small>
      </div>
    </div>
    <div v-if="[RequisitionTypes.VMWare].includes(config.type.name)">
      <div class="flex-center side-input">
        <div class="p-float-label side-input full-width mr-m mb-m">
          <InputText
            id="req-username"
            :invalid="!!errors.username"
            :modelValue="config.username"
            @update:modelValue="(val: any) => updateFormValue('username', val)"
          />
          <label for="req-username">Username</label>
          <small v-if="errors.username" class="p-error">{{ errors.username }}</small>
          <small v-else class="p-hint">vSphere username (optional)</small>
        </div>
        <div class="p-float-label side-input full-width mb-m">
          <InputText
            id="req-password"
            type="password"
            :invalid="!!errors.password"
            :modelValue="config.password"
            @update:modelValue="(val: any) => updateFormValue('password', val)"
          />
          <label for="req-password">Password</label>
          <small v-if="errors.password" class="p-error">{{ errors.password }}</small>
          <small v-else class="p-hint">vSphere password (optional)</small>
        </div>
      </div>
    </div>
    <div v-if="[RequisitionTypes.File].includes(config.type.name)">
      <div class="p-float-label side-input mb-m">
        <InputText
          id="req-file-path"
          :invalid="!!errors.path"
          :modelValue="config.path"
          @update:modelValue="(val: any) => updateFormValue('path', val)"
        />
        <label for="req-file-path">Path</label>
        <small v-if="errors.path" class="p-error">{{ errors.path }}</small>
        <small v-else class="p-hint">File path starting with a /</small>
      </div>
    </div>
    <ConfigurationCronSelector
      :config="config"
      :errors="errors"
      :updateValue="updateCronValue"
    />
    <div>
      <div class="side-label radio-group-wrap">
        <label class="radio-group-label">Rescan Behavior</label>
        <div class="radio-group">
          <div
            v-for="({value, name}) in rescanItems"
            :key="name"
            class="radio-item"
          >
            <RadioButton
              :inputId="`rescan-${value}`"
              name="rescanBehavior"
              :value="value"
              :modelValue="config.rescanBehavior"
              @update:modelValue="(val: any) => updateFormValue('rescanBehavior', val)"
            />
            <label :for="`rescan-${value}`">{{ name }}</label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script
  lang="ts"
  setup
>
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import RadioButton from 'primevue/radiobutton'
import { requisitionSubTypes, RequsitionTypesUsingHost, RequisitionTypes, requisitionTypeList, RequisitionHTTPTypes } from './copy/requisitionTypes'
import { rescanItems } from './copy/rescanItems'
import { PropType } from 'vue'
import { LocalConfigurationWrapper } from './configuration.types'
import { ConfigurationHelper } from './ConfigurationHelper'
import ConfigurationCronSelector from './ConfigurationCronSelector.vue'
import { UpdateModelFunction } from '@/types'
const firstInput = ref<HTMLInputElement | null>(null)

const props = defineProps({
  item: { type: Object as PropType<LocalConfigurationWrapper>, required: true },
  helpState: { type: Boolean, required: true },
  toggleHelp: { type: Function, required: true },
  updateFormValue: { type: Function, required: true },
  formActive: { type: Boolean, required: true }
})

const config = computed(() => props.item.config)
const errors = computed(() => props.item.errors)
const formActive = computed(() => props.formActive)
const hostHint = computed(() => {
  return ConfigurationHelper.getHostHint(props.item.config.type.name)
})

// Focus the first field in the drawer when opened.
watch(formActive, () => {
  if (formActive.value && firstInput.value) {
    firstInput.value.focus()
  }
})

const updateExternalSource: UpdateModelFunction = (val: {name:string}) => {
  props.updateFormValue('type', val)
  updateHint(val.name)
}

const updateCronValue = (type:string, val:string) => {
  props.updateFormValue(type, val)
}

/**
 * The following function is related to getting the Hint Text to update properly in the FeatherInput component. Currently if you update the Hint Text after the initial render, FeatherInput does not react to the untracked attribute.
 * We could forcibly mount + unmount the component as an alternative which would also render the correct text, but I felt like these easily removable two lines of code is preferable than a forced re-render.
 * In the case that FeatherInput properly updates when the Hint Text is updated, just remove the two proceeding lines of code (getHostHint and forceSetHint)
 **/
const updateHint = (val:string) => {
  const hint = ConfigurationHelper.getHostHint(val)
  ConfigurationHelper.forceSetHint({hint}, 0,'.host-update')
}
</script>
<style
  lang="scss"
  scoped
>
.side-input {
    padding-bottom: 0;
}
.occurance {
    width: 100%;
}
.flex-center {
    display: flex;
}
.full-width {
    width: 100%;
}
</style>

