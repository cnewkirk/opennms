<template>
  <div class="attribute-container" id="scv-attribute">
    <div class="input">
      <InputText
        data-test="attr-key"
        ref="keyRef"
        placeholder="key"
        @update:modelValue="updateAttributeKey"
        :modelValue="attributeKey"
        :class="{ 'p-invalid': keyError }"
      />
      <small v-if="keyError" class="p-error">{{ keyError }}</small>
    </div>
    <div class="input">
      <InputText
        data-test="attr-value"
        placeholder="value"
        @update:modelValue="updateAttributeValue"
        :modelValue="attributeValue"
      />
    </div>

    <Button icon="pi pi-minus" text title="Remove attribute" @click="removeAttribute" data-test="rm-attr-btn" />
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { useScvStore } from '@/stores/scvStore'
import { SCVCredentials } from '@/types/scv'
import { UpdateModelFunction } from '@/types'

const scvStore = useScvStore()
const emit = defineEmits(['set-key-error'])

const props = defineProps({
  attributeKey: {
    type: String,
    required: true
  },
  attributeValue: {
    type: String,
    required: true
  },
  attributeIndex: ({
    type: Number,
    required: true
  })
})

const keyRef = ref()
const keyError = ref()
const credentials = computed<SCVCredentials>(() => scvStore.credentials)

const isDuplicateKey = (key: string) => {
  // check to see if the key already exists in another prop
  const entries = Object.entries(credentials.value.attributes)

  for (const [index, [attributeKey]] of entries.entries()) {
    if (key === attributeKey && index !== props.attributeIndex) {
      keyError.value = 'Duplicate keys not allowed.'
      emit('set-key-error', true)
      return true
    }
  }

  // if not, clear errors
  keyError.value = null
  emit('set-key-error', false)
  return false
}

const updateAttributeKey: UpdateModelFunction = (key: string) => {
  if (!isDuplicateKey(key)) {
    scvStore.updateAttribute({ key: props.attributeKey, keyVal: { key, value: props.attributeValue} })
  }
}

const updateAttributeValue: UpdateModelFunction = (value: string) =>
  scvStore.updateAttribute({ key: props.attributeKey, keyVal: { key: props.attributeKey, value }})

const removeAttribute = () => scvStore.removeAttribute(props.attributeKey)

onMounted(() => (keyRef.value?.$el ?? keyRef.value)?.focus())
</script>

<style lang="scss" scoped>
.attribute-container {
  display: flex;
  gap: 10px;
  .input {
    width: 50%;
  }
}
</style>
