<template>
  <Dialog v-model:visible="open" :header="dialogLabels.title" modal :closable="true" @hide="handleCancel">
    <div class="sched-outage-dialog">
      <div class="sched-outage-dialog__field">
        <span class="p-float-label">
          <InputText id="outage-name" v-model="form.name" :disabled="!isNew" style="width:100%" />
          <label for="outage-name">Name</label>
        </span>
      </div>

      <div class="sched-outage-dialog__field">
        <label class="sched-outage-dialog__label body2">Type</label>
        <select class="sched-outage-dialog__select" v-model="form.type" @change="onTypeChange">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="specific">Specific</option>
        </select>
      </div>

      <!-- Time Windows -->
      <div class="sched-outage-dialog__section">
        <div class="sched-outage-dialog__section-header">
          <span class="subtitle2">Time Windows</span>
          <Button text label="Add Time" @click="addTime" />
        </div>

        <div
          v-for="(t, i) in form.time"
          :key="i"
          class="sched-outage-dialog__time-entry"
        >
          <!-- Day selector for weekly -->
          <div v-if="form.type === 'weekly'" class="sched-outage-dialog__inline-field">
            <label class="sched-outage-dialog__label body2">Day</label>
            <select class="sched-outage-dialog__select" v-model="t.day">
              <option value="sunday">Sunday</option>
              <option value="monday">Monday</option>
              <option value="tuesday">Tuesday</option>
              <option value="wednesday">Wednesday</option>
              <option value="thursday">Thursday</option>
              <option value="friday">Friday</option>
              <option value="saturday">Saturday</option>
            </select>
          </div>

          <!-- Day input for monthly (1-31) -->
          <div v-else-if="form.type === 'monthly'" class="sched-outage-dialog__inline-field">
            <span class="p-float-label">
              <InputText :id="`day-${i}`" v-model="t.day" style="width:100%" />
              <label :for="`day-${i}`">Day of Month (1–31)</label>
            </span>
          </div>

          <!-- Begins/Ends -->
          <div class="sched-outage-dialog__inline-field">
            <span class="p-float-label">
              <InputText :id="`begins-${i}`" v-model="t.begins" :placeholder="form.type === 'specific' ? '01-Jan-2024 08:00:00' : '08:00:00'" style="width:100%" />
              <label :for="`begins-${i}`">{{ form.type === 'specific' ? 'Begins (dd-MMM-yyyy HH:mm:ss)' : 'Begins (HH:mm:ss)' }}</label>
            </span>
          </div>
          <div class="sched-outage-dialog__inline-field">
            <span class="p-float-label">
              <InputText :id="`ends-${i}`" v-model="t.ends" :placeholder="form.type === 'specific' ? '01-Jan-2024 09:00:00' : '09:00:00'" style="width:100%" />
              <label :for="`ends-${i}`">{{ form.type === 'specific' ? 'Ends (dd-MMM-yyyy HH:mm:ss)' : 'Ends (HH:mm:ss)' }}</label>
            </span>
          </div>

          <Button text label="Remove" @click="removeTime(i)" />
        </div>

        <p v-if="!form.time.length" class="body2 sched-outage-dialog__empty">No time windows defined.</p>
      </div>

      <!-- Nodes -->
      <div class="sched-outage-dialog__section">
        <div class="sched-outage-dialog__section-header">
          <span class="subtitle2">Nodes</span>
        </div>
        <div class="sched-outage-dialog__add-row">
          <span class="p-float-label">
            <InputText id="node-id-input" v-model="newNodeId" style="width:100%" />
            <label for="node-id-input">Node ID</label>
          </span>
          <Button text label="Add" @click="addNode" />
        </div>
        <div
          v-for="(n, i) in form.node"
          :key="i"
          class="sched-outage-dialog__item-row"
        >
          <span class="body2">Node {{ n.id }}</span>
          <Button text label="Remove" @click="removeNode(i)" />
        </div>
        <p v-if="!form.node.length" class="body2 sched-outage-dialog__empty">No nodes assigned.</p>
      </div>

      <!-- Interfaces -->
      <div class="sched-outage-dialog__section">
        <div class="sched-outage-dialog__section-header">
          <span class="subtitle2">Interfaces</span>
        </div>
        <div class="sched-outage-dialog__add-row">
          <span class="p-float-label">
            <InputText id="iface-input" v-model="newIfaceAddress" style="width:100%" />
            <label for="iface-input">IP Address or match-any</label>
          </span>
          <Button text label="Add" @click="addInterface" />
        </div>
        <div
          v-for="(iface, i) in form.interface"
          :key="i"
          class="sched-outage-dialog__item-row"
        >
          <span class="body2">{{ iface.address }}</span>
          <Button text label="Remove" @click="removeInterface(i)" />
        </div>
        <p v-if="!form.interface.length" class="body2 sched-outage-dialog__empty">No interfaces assigned.</p>
      </div>
    </div>

    <template #footer>
      <Button text label="Cancel" @click="handleCancel" />
      <Button :disabled="saving" @click="handleSave" :label="saving ? 'Saving…' : 'Save'" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { SchedOutage, SchedOutageTime } from '@/types'
import { saveSchedOutage } from '@/services/schedOutageService'
import useSnackbar from '@/composables/useSnackbar'

const props = defineProps<{
  modelValue: boolean
  outage: SchedOutage | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'saved'): void
}>()

const { showSnackBar } = useSnackbar()

const open = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const isNew = computed(() => props.outage === null)

const dialogLabels = computed(() => ({
  title: isNew.value ? 'New Scheduled Outage' : `Edit: ${props.outage?.name ?? ''}`,
  close: 'Close'
}))

const makeDefaultForm = (): SchedOutage => ({
  name: '',
  type: 'daily',
  time: [],
  node: [],
  interface: []
})

const form = ref<SchedOutage>(makeDefaultForm())
const saving = ref(false)
const newNodeId = ref('')
const newIfaceAddress = ref('')

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      if (props.outage) {
        form.value = JSON.parse(JSON.stringify(props.outage))
      } else {
        form.value = makeDefaultForm()
      }
      newNodeId.value = ''
      newIfaceAddress.value = ''
    }
  }
)

const onTypeChange = () => {
  // Clear day field from existing time entries when switching types
  form.value.time.forEach(t => {
    if (form.value.type === 'daily' || form.value.type === 'specific') {
      delete t.day
    } else if (form.value.type === 'weekly') {
      t.day = t.day ?? 'monday'
    } else if (form.value.type === 'monthly') {
      t.day = t.day ?? '1'
    }
  })
}

const addTime = () => {
  const entry: SchedOutageTime = {
    id: null,
    begins: '',
    ends: ''
  }
  if (form.value.type === 'weekly') entry.day = 'monday'
  else if (form.value.type === 'monthly') entry.day = '1'
  form.value.time.push(entry)
}

const removeTime = (i: number) => {
  form.value.time.splice(i, 1)
}

const addNode = () => {
  const id = parseInt(newNodeId.value.trim(), 10)
  if (!isNaN(id) && id > 0) {
    form.value.node.push({ id })
    newNodeId.value = ''
  }
}

const removeNode = (i: number) => {
  form.value.node.splice(i, 1)
}

const addInterface = () => {
  const addr = newIfaceAddress.value.trim()
  if (addr) {
    form.value.interface.push({ address: addr })
    newIfaceAddress.value = ''
  }
}

const removeInterface = (i: number) => {
  form.value.interface.splice(i, 1)
}

const handleSave = async () => {
  if (!form.value.name.trim()) {
    showSnackBar({ msg: 'Outage name is required.', error: true })
    return
  }
  saving.value = true
  const ok = await saveSchedOutage(form.value, isNew.value)
  saving.value = false
  if (ok) {
    emit('saved')
    open.value = false
  } else {
    showSnackBar({ msg: 'Failed to save scheduled outage.', error: true })
  }
}

const handleCancel = () => {
  open.value = false
}
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";
@import "@/styles/typography";

.sched-outage-dialog {
  min-width: 480px;
  max-width: 600px;

  &__field {
    margin-bottom: 16px;
  }

  &__label {
    display: block;
    margin-bottom: 4px;
    color: var($secondary-text-on-surface);
  }

  &__select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var($border-on-surface);
    border-radius: 4px;
    background: var($surface);
    color: var($primary-text-on-surface);
    font-size: 14px;
  }

  &__section {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var($border-on-surface);
  }

  &__section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  &__time-entry {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: flex-end;
    padding: 8px 0;
    border-bottom: 1px solid var($border-on-surface);

    &:last-of-type {
      border-bottom: none;
    }
  }

  &__inline-field {
    flex: 1;
    min-width: 140px;
  }

  &__add-row {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    margin-bottom: 8px;

    > * {
      flex: 1;
    }

    > :last-child {
      flex: 0 0 auto;
    }
  }

  &__item-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    border-bottom: 1px solid var($border-on-surface);

    &:last-of-type {
      border-bottom: none;
    }
  }

  &__empty {
    color: var($secondary-text-on-surface);
    font-style: italic;
    margin: 4px 0 0;
  }
}
</style>
