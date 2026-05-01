<template>
  <div class="varbinds-decode-info">
    <div class="section-content">
      <div class="varbinds-decode-header">
        <div class="varbinds-decode-title">
          <h3>Varbinds Decoding</h3>
          <p>
            Convert the following numeric values for the varbind parm to the decoded string value when displaying the
            event description:
          </p>
        </div>
        <Button
          severity="secondary"
          @click="$emit('setVarbindsDecode', 'addVarbindDecodeRow', null, -1, -1)"
          data-test="add-varbind-row-button"
        >
          <i class="pi pi-plus" />
          Add
        </Button>
      </div>
      <div
        v-for="(row, index) in varbindsDecodeElements"
        :key="index"
        class="form-row"
      >
        <div class="parm-field">
          <div class="input-field p-float-label">
            <InputText
              :id="`parm-id-${index}`"
              :model-value="row.parmId"
              @update:model-value="$emit('setVarbindsDecode', 'setParmId', $event, index, -1)"
              data-test="varbind-index-input"
              :invalid="!!errors.varbindsDecode?.[index]?.parmId"
            />
            <label :for="`parm-id-${index}`">Parm ID</label>
            <small v-if="errors.varbindsDecode?.[index]?.parmId" class="p-error">{{ errors.varbindsDecode[index].parmId }}</small>
          </div>
          <div class="action-btns">
            <Button
              class="remove"
              severity="secondary"
              data-test="remove-varbind-row-button"
              @click="$emit('setVarbindsDecode', 'removeVarbindDecodeRow', null, index, -1)"
            >
              <i class="pi pi-trash" style="color: #a5021f" />
            </Button>
            <Button
              severity="secondary"
              data-test="add-varbind-row-button"
              @click="$emit('setVarbindsDecode', 'addDecodeRow', null, index, -1)"
            >
              <i class="pi pi-plus" />
              Add Decode
            </Button>
          </div>
        </div>
        <div
          v-for="(decodeRow, decodeIndex) in row.decode"
          :key="decodeIndex"
          class="decode-field"
        >
          <div class="input-field p-float-label">
            <InputText
              :id="`decode-value-${index}-${decodeIndex}`"
              type="number"
              min="0"
              :model-value="decodeRow.value"
              @update:model-value="$emit('setVarbindsDecode', 'setDecodeValue', $event, index, decodeIndex)"
              data-test="varbind-value-input"
              :invalid="!!errors.varbindsDecode?.[index]?.decode?.[decodeIndex]?.value"
            />
            <label :for="`decode-value-${index}-${decodeIndex}`">Varbind Value</label>
            <small v-if="errors.varbindsDecode?.[index]?.decode?.[decodeIndex]?.value" class="p-error">{{ errors.varbindsDecode?.[index]?.decode?.[decodeIndex]?.value }}</small>
          </div>
          <div class="value-field">
            <div class="input-field p-float-label">
              <InputText
                :id="`decode-key-${index}-${decodeIndex}`"
                :model-value="decodeRow.key"
                @update:model-value="$emit('setVarbindsDecode', 'setDecodeKey', $event, index, decodeIndex)"
                data-test="varbind-value-input"
                :invalid="!!errors.varbindsDecode?.[index]?.decode?.[decodeIndex]?.key"
              />
              <label :for="`decode-key-${index}-${decodeIndex}`">Decoded String</label>
              <small v-if="errors.varbindsDecode?.[index]?.decode?.[decodeIndex]?.key" class="p-error">{{ errors.varbindsDecode?.[index]?.decode?.[decodeIndex]?.key }}</small>
            </div>
            <Button
              class="remove"
              severity="secondary"
              data-test="remove-varbind-row-button"
              @click="$emit('setVarbindsDecode', 'removeDecodeRow', null, index, decodeIndex)"
            >
              <i class="pi pi-trash" style="color: #a5021f" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { EventFormErrors } from '@/types/eventConfig'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'

const props = defineProps<{
  varbindsDecode: Array<{ parmId: string; decode: Array<{ key: string; value: string }> }>
  errors: EventFormErrors
}>()
defineEmits<{
  (e: 'setVarbindsDecode', key: string, value: any, index: number, decodeIndex: number): void
}>()

const { varbindsDecode, errors } = toRefs(props)
const varbindsDecodeElements = ref<Array<{ parmId: string; decode: Array<{ key: string; value: string }> }>>([])

watch(varbindsDecode, (newVarbindsDecode) => {
  varbindsDecodeElements.value = [...newVarbindsDecode]
}, { deep: true, immediate: true })
</script>

<style lang="scss" scoped>
.varbinds-decode-info {
  .varbinds-decode-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    gap: 20px;

    .varbinds-decode-title {
      flex: 1;
    }
  }

  .form-row {
    display: flex;
    align-items: flex-start;
    gap: 20px;
    flex-wrap: wrap;
    margin-bottom: 10px;

    .parm-field {
      width: 100%;
      display: flex;
      align-items: flex-start;
      gap: 10px;

      .input-field {
        width: 100%;
      }

      .action-btns {
        display: flex;
        align-items: center;
        gap: 10px;

        button {
          margin: 0px;
        }

        .remove {
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

    .decode-field {
      width: 100%;
      display: flex;
      align-items: flex-start;
      gap: 10px;

      .input-field,
      .value-field {
        flex: 1;
      }

      .value-field {
        display: flex;
        align-items: flex-start;
        gap: 10px;

        .input-field {
          width: 100%;
        }

        .remove {
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
}
</style>
