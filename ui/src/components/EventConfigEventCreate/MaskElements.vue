<template>
  <div class="mask-elements">
    <div class="section-content">
      <div class="mask-elements-header">
        <h3>Mask Elements</h3>
        <Button
          severity="secondary"
          @click="$emit('setMaskElements', 'addMaskRow', null, -1)"
          data-test="add-mask-row-button"
        >
          <i class="pi pi-plus" />
          Add
        </Button>
      </div>
      <div
        v-for="(row, index) in maskElements"
        :key="index"
        class="form-row"
      >
        <div class="dropdown p-float-label">
          <Select
            :inputId="`mask-element-name-${index}`"
            :options="availableMaskOptions(index)"
            optionLabel="_text"
            :invalid="!!errors.maskElements?.[index]?.name"
            :modelValue="MaskElementNameOptions.find(
              (o: ISelectItemType) => o._value === row.name._value
            )"
            @update:modelValue="$emit('setMaskElements', 'setName', $event, index)"
            data-test="mask-element-name"
          />
          <label :for="`mask-element-name-${index}`">Element Name</label>
          <small v-if="errors.maskElements?.[index]?.name" class="p-error">{{ errors.maskElements[index].name }}</small>
        </div>
        <div class="input-field">
          <div class="p-float-label">
            <InputText
              :id="`mask-element-value-${index}`"
              :model-value="row.value"
              :invalid="!!errors.maskElements?.[index]?.value"
              @update:model-value="$emit('setMaskElements', 'setValue', $event, index)"
              data-test="mask-element-value"
            />
            <label :for="`mask-element-value-${index}`">Element Value</label>
            <small v-if="errors.maskElements?.[index]?.value" class="p-error">{{ errors.maskElements[index].value }}</small>
          </div>
          <Button
            severity="secondary"
            data-test="remove-mask-row-button"
            @click="$emit('setMaskElements', 'removeMaskRow', null, index)"
          >
            <i class="pi pi-trash" style="color: #a5021f" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { EventFormErrors } from '@/types/eventConfig'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { ISelectItemType, MaskElementNameOptions } from './constants'

defineEmits<{
  (e: 'setMaskElements', key: string, value: any, index: number): void
}>()

const props = defineProps<{
  maskElements: Array<{ name: ISelectItemType; value: string }>
  errors: EventFormErrors
}>()

const elements = ref<Array<{ name: ISelectItemType; value: string }>>([
  { name: { _text: '', _value: '' }, value: '' }
])

const availableMaskOptions = (index: number): ISelectItemType[] => {
  const selectedNames = elements.value.map(r => r.name._value)
  return MaskElementNameOptions.filter(option => {
    const value = option._value as string
    return (
      !selectedNames.includes(value) ||
      elements.value[index].name._value === value
    )
  })
}

watch(() => props, () => {
  elements.value = props.maskElements
}, { immediate: true, deep: true })
</script>

<style scoped lang="scss">
@use "@/styles/tokens";
@use '@featherds/styles/mixins/typography';

.mask-elements {
  .mask-elements-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .form-row {
    display: flex;
    align-items: flex-start;
    gap: 20px;
    flex-wrap: wrap;
    margin-bottom: 10px;

    .dropdown,
    .input-field {
      flex: 1;
    }

    .input-field {
      display: flex;
      align-items: flex-start;
      gap: 10px;

      >div {
        flex: 1;
      }

      >button {
        min-width: 40px !important;
        height: 40px !important;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 0px;

        span {
          svg {
            fill: #a5021f;
            font-size: 22px;
          }
        }
      }
    }
  }

}
</style>

