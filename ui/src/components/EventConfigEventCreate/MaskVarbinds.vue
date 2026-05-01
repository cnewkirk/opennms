<template>
  <div class="mask-varbinds">
    <div class="section-content">
      <div class="mask-varbinds-header">
        <h3>Mask Varbinds</h3>
        <Button
          severity="secondary"
          @click="$emit('setVarbinds', 'addVarbindRow', null, -1)"
          data-test="add-varbind-row-button"
          :disabled="!hasMaskElements"
        >
          <i class="pi pi-plus" />
          Add
        </Button>
      </div>
      <div
        v-for="(row, index) in maskVarbinds"
        :key="index"
        class="form-row"
      >
        <div class="dropdown p-float-label">
          <Select
            :inputId="`varbind-type-${index}`"
            :options="MaskVarbindsTypeOptions"
            optionLabel="_text"
            :modelValue="MaskVarbindsTypeOptions.find(
              (o: ISelectItemType) => o._value === row.type._value
            )"
            @update:modelValue="$emit('setVarbinds', 'setVarbindType', $event, index)"
            :invalid="!!errors.varbinds?.[index]?.type"
            data-test="varbind-type-select"
          />
          <label :for="`varbind-type-${index}`">Varbind Type</label>
          <small v-if="errors.varbinds?.[index]?.type" class="p-error">{{ errors.varbinds[index].type }}</small>
        </div>
        <div
          v-if="row.type._value === MaskVarbindsTypeValue.vbNumber"
          class="dropdown p-float-label"
        >
          <InputText
            :id="`varbind-number-${index}`"
            type="number"
            min="0"
            :model-value="row.index"
            @update:model-value="$emit('setVarbinds', 'setVarbindNumber', $event, index)"
            data-test="varbind-number-input"
            :invalid="!!errors.varbinds?.[index]?.index"
          />
          <label :for="`varbind-number-${index}`">Varbind Number</label>
          <small v-if="errors.varbinds?.[index]?.index" class="p-error">{{ errors.varbinds[index].index }}</small>
        </div>
        <div
          v-if="row.type._value === MaskVarbindsTypeValue.vbOid"
          class="dropdown p-float-label"
        >
          <InputText
            :id="`varbind-oid-${index}`"
            :model-value="row.index"
            @update:model-value="$emit('setVarbinds', 'setVarbindOid', $event, index)"
            data-test="varbind-oid-input"
            :invalid="!!errors.varbinds?.[index]?.index"
          />
          <label :for="`varbind-oid-${index}`">Varbind OID</label>
          <small v-if="errors.varbinds?.[index]?.index" class="p-error">{{ errors.varbinds[index].index }}</small>
        </div>
        <div class="input-field">
          <div class="p-float-label">
            <InputText
              :id="`varbind-value-${index}`"
              :model-value="row.value"
              @update:model-value="$emit('setVarbinds', 'setValue', $event, index)"
              data-test="varbind-value-input"
              :invalid="!!errors.varbinds?.[index]?.value"
            />
            <label :for="`varbind-value-${index}`">Varbind Value</label>
            <small v-if="errors.varbinds?.[index]?.value" class="p-error">{{ errors.varbinds[index].value }}</small>
          </div>
          <Button
            severity="secondary"
            data-test="remove-varbind-row-button"
            @click="$emit('setVarbinds', 'removeVarbindRow', null, index)"
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
import { ISelectItemType, MaskVarbindsTypeOptions, MaskVarbindsTypeValue } from './constants'

const emit = defineEmits<{
  (e: 'setVarbinds', key: string, value: any, index: number): void
}>()

const props = defineProps<{
  varbinds: Array<{ index: string; value: string, type: ISelectItemType }>
  maskElements: Array<{ name: ISelectItemType; value: string }>
  errors: EventFormErrors
}>()

const { varbinds, maskElements, errors } = toRefs(props)
const maskVarbinds = ref<Array<{ index: string; value: string, type: ISelectItemType }>>([])
const hasMaskElements = computed(() => maskElements.value.length > 0)

watch(varbinds, () => {
  maskVarbinds.value = [...props.varbinds]
}, { deep: true, immediate: true })

watch(maskElements, () => {
  if (props.maskElements.length === 0) {
    emit('setVarbinds', 'clearAllVarbinds', null, -1)
  }
}, { deep: true, immediate: true })
</script>

<style scoped lang="scss">
@use "@/styles/tokens";
@use '@featherds/styles/mixins/typography';

.mask-varbinds {
  .mask-varbinds-header {
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

