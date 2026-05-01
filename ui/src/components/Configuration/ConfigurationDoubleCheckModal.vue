<template>
  <Dialog
    :visible="visible"
    :header="labels.title"
    :closable="false"
    modal
  >
    <p class="my-content">This will delete the definition titled: {{ title }}</p>
    <template #footer>
      <Button
        label="No"
        @click="props?.doubleCheckSelected(false)"
      />
      <Button
        label="Yes"
        severity="danger"
        @click="props?.doubleCheckSelected(true)"
      />
    </template>
  </Dialog>
</template>

<script
  lang="ts"
  setup
>
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'

/**
 * Props
 */
const props = defineProps({
  title: String,
  optionSelected: Object,
  doubleCheckSelected: {
    type: Function,
    required: true
  }
})

/**
 * Local State
 */
const visible = computed(() => props?.optionSelected?.active)
const title = computed(() => props?.optionSelected?.title)
const labels = computed(() => ({ title: 'Are you sure?', close: 'Close' }))
</script>
