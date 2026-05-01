<template>
  <div class="path-edit-page">
    <div class="feather-row">
      <div class="feather-col-12">
        <BreadCrumbs :items="breadcrumbs" />
      </div>
    </div>

    <div class="path-edit-page__header feather-row">
      <div class="feather-col-8">
        <h2 class="headline4">{{ isNew ? 'New Destination Path' : `Edit: ${pathName}` }}</h2>
      </div>
      <div class="feather-col-4 path-edit-page__header-actions">
        <Button severity="secondary" label="Cancel" @click="router.push('/notification-config/paths')" />
        <Button :disabled="saving" @click="save" :label="saving ? 'Saving…' : 'Save'" />
      </div>
    </div>

    <div v-if="loading" class="path-edit-page__status">Loading…</div>
    <div v-else-if="loadError" class="path-edit-page__status path-edit-page__status--error">
      Failed to load destination path.
    </div>

    <template v-if="!loading && !loadError">
      <!-- Card 1: Basic Info -->
      <div class="notif-card">
        <div class="notif-card__header">Path Settings</div>
        <div class="notif-card__body">
          <div class="form-row">
            <label class="form-label">Name <span class="required">*</span></label>
            <input v-model="path.name" class="form-input" :disabled="!isNew" placeholder="Path name" />
          </div>
          <div class="form-row">
            <label class="form-label">Initial Delay</label>
            <input v-model="path.initialDelay" class="form-input" placeholder="e.g. 0s, 5m" />
          </div>
        </div>
      </div>

      <!-- Card 2: Initial Targets -->
      <div class="notif-card">
        <div class="notif-card__header">
          Initial Targets
          <Button text label="+ Add Target" class="notif-card__header-btn" @click="addTarget(path.targets)" />
        </div>
        <div class="notif-card__body">
          <div v-if="path.targets.length === 0" class="notif-empty">No targets defined.</div>
          <div v-for="(target, ti) in path.targets" :key="ti" class="target-block">
            <div class="target-block__header">
              Target {{ ti + 1 }}
              <button class="btn-remove" @click="path.targets.splice(ti, 1)">✕ Remove</button>
            </div>
            <div class="target-block__body">
              <div class="form-row">
                <label class="form-label">Name / Email Address <span class="required">*</span></label>
                <input v-model="target.name" class="form-input" placeholder="username or email@example.com" />
              </div>
              <div class="form-row">
                <label class="form-label">Interval</label>
                <input v-model="target.interval" class="form-input" placeholder="e.g. 0s, 5m" />
              </div>
              <div class="form-row">
                <label class="form-label">Auto Notify</label>
                <select v-model="target.autoNotify" class="form-select">
                  <option value="">Default</option>
                  <option value="Y">Always (Y)</option>
                  <option value="N">Never (N)</option>
                  <option value="C">Off (C)</option>
                </select>
              </div>
              <div class="form-row">
                <label class="form-label">Commands</label>
                <div class="commands-list">
                  <label v-for="cmd in availableCommands" :key="cmd" class="cmd-checkbox">
                    <input
                      type="checkbox"
                      :value="cmd"
                      :checked="target.commands.includes(cmd)"
                      @change="toggleCommand(target, cmd)"
                    />
                    {{ cmd }}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Escalation cards -->
      <div v-for="(esc, ei) in path.escalates" :key="ei" class="notif-card">
        <div class="notif-card__header">
          Escalation Level {{ ei + 1 }}
          <div class="notif-card__header-actions">
            <Button text label="+ Add Target" class="notif-card__header-btn" @click="addTarget(esc.targets)" />
            <button class="btn-remove" @click="path.escalates!.splice(ei, 1)">✕ Remove Escalation</button>
          </div>
        </div>
        <div class="notif-card__body">
          <div class="form-row">
            <label class="form-label">Delay</label>
            <input v-model="esc.delay" class="form-input" placeholder="e.g. 0s, 15m" />
          </div>
          <div v-if="esc.targets.length === 0" class="notif-empty">No targets defined.</div>
          <div v-for="(target, ti) in esc.targets" :key="ti" class="target-block">
            <div class="target-block__header">
              Target {{ ti + 1 }}
              <button class="btn-remove" @click="esc.targets.splice(ti, 1)">✕ Remove</button>
            </div>
            <div class="target-block__body">
              <div class="form-row">
                <label class="form-label">Name / Email Address <span class="required">*</span></label>
                <input v-model="target.name" class="form-input" placeholder="username or email@example.com" />
              </div>
              <div class="form-row">
                <label class="form-label">Interval</label>
                <input v-model="target.interval" class="form-input" placeholder="e.g. 0s, 5m" />
              </div>
              <div class="form-row">
                <label class="form-label">Auto Notify</label>
                <select v-model="target.autoNotify" class="form-select">
                  <option value="">Default</option>
                  <option value="Y">Always (Y)</option>
                  <option value="N">Never (N)</option>
                  <option value="C">Off (C)</option>
                </select>
              </div>
              <div class="form-row">
                <label class="form-label">Commands</label>
                <div class="commands-list">
                  <label v-for="cmd in availableCommands" :key="cmd" class="cmd-checkbox">
                    <input
                      type="checkbox"
                      :value="cmd"
                      :checked="target.commands.includes(cmd)"
                      @change="toggleCommand(target, cmd)"
                    />
                    {{ cmd }}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="notif-add-escalation">
        <Button severity="secondary" label="+ Add Escalation Level" @click="addEscalation" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import Button from 'primevue/button'
import useSnackbar from '@/composables/useSnackbar'
import destinationPathService, { DestinationPathDTO, TargetDTO, EscalateDTO } from '@/services/destinationPathService'
import { v2 } from '@/services/axiosInstances'
import { BreadCrumb } from '@/types'

const router = useRouter()
const route = useRoute()
const { showSnackBar } = useSnackbar()

const pathName = route.params.name as string | undefined
const isNew = !pathName

const breadcrumbs: BreadCrumb[] = [
  { label: 'Home', to: '/' },
  { label: 'Admin', to: '/admin' },
  { label: 'Notification Configuration', to: '/notification-config' },
  { label: 'Destination Paths', to: '/notification-config/paths' },
  { label: isNew ? 'New Path' : (pathName ?? ''), to: '#', position: 'last' }
]

const path = ref<DestinationPathDTO>({
  name: '',
  initialDelay: null,
  targets: [],
  escalates: []
})
const loading = ref(!isNew)
const loadError = ref(false)
const saving = ref(false)
const availableCommands = ref<string[]>([])

onMounted(async () => {
  const [cmdsResp] = await Promise.all([
    v2.get<{ commands: { name: string }[] | { name: string } }>('/notificationCommands').catch(() => null)
  ])
  if (cmdsResp) {
    const raw = cmdsResp.data.commands
    const list = Array.isArray(raw) ? raw : raw ? [raw] : []
    availableCommands.value = list.map(c => c.name).sort()
  }

  if (!isNew && pathName) {
    const existing = await destinationPathService.getDestinationPath(pathName)
    if (existing) {
      path.value = existing
    } else {
      loadError.value = true
    }
    loading.value = false
  }
})

function newTarget(): TargetDTO {
  return { name: '', interval: null, autoNotify: null, commands: [] }
}

function addTarget(targets: TargetDTO[]) {
  targets.push(newTarget())
}

function addEscalation() {
  if (!path.value.escalates) path.value.escalates = []
  path.value.escalates.push({ delay: '0s', targets: [] })
}

function toggleCommand(target: TargetDTO, cmd: string) {
  const idx = target.commands.indexOf(cmd)
  if (idx >= 0) {
    target.commands.splice(idx, 1)
  } else {
    target.commands.push(cmd)
  }
}

async function save() {
  if (!path.value.name?.trim()) {
    showSnackBar({ msg: 'Path name is required.' })
    return
  }

  saving.value = true
  let ok: boolean
  if (isNew) {
    ok = await destinationPathService.createDestinationPath(path.value)
  } else {
    ok = await destinationPathService.saveDestinationPath(pathName!, path.value)
  }

  if (ok) {
    showSnackBar({ msg: `Path "${path.value.name}" saved.` })
    router.push('/notification-config/paths')
  } else {
    showSnackBar({ msg: 'Failed to save path.' })
  }
  saving.value = false
}
</script>

<style lang="scss" scoped>
.path-edit-page {
  padding: 1.5rem;

  &__header {
    align-items: center;
    margin-bottom: 1.5rem;
  }

  &__header-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.5rem;
  }

  &__status {
    color: var(--feather-secondary-text-on-surface);
    padding: 1rem 0;

    &--error {
      color: var(--feather-error);
    }
  }
}

.notif-card {
  background: var(--feather-surface);
  border-radius: 6px;
  border: 1px solid var(--feather-border-on-surface);
  margin-bottom: 1.5rem;

  &__header {
    font-weight: 600;
    font-size: 1rem;
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid var(--feather-border-on-surface);
    color: var(--feather-primary-text-on-surface);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__header-btn {
    font-size: 0.85rem;
  }

  &__header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__body {
    padding: 1.25rem;
  }
}

.notif-empty {
  color: var(--feather-secondary-text-on-surface);
  font-style: italic;
  font-size: 0.875rem;
  padding: 0.5rem 0;
}

.notif-add-escalation {
  margin-bottom: 1.5rem;
}

.target-block {
  border: 1px solid var(--feather-border-on-surface);
  border-radius: 4px;
  margin-bottom: 1rem;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: var(--feather-background);
    border-bottom: 1px solid var(--feather-border-on-surface);
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--feather-secondary-text-on-surface);
    border-radius: 4px 4px 0 0;
  }

  &__body {
    padding: 0.75rem;
  }
}

.form-row {
  margin-bottom: 0.875rem;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--feather-secondary-text-on-surface);
  margin-bottom: 0.35rem;
}

.form-input,
.form-select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--feather-border-on-surface);
  border-radius: 4px;
  background: var(--feather-surface);
  color: var(--feather-primary-text-on-surface);
  font-size: 0.9rem;
  box-sizing: border-box;

  &:focus {
    outline: 2px solid var(--feather-primary);
    outline-offset: -1px;
  }
}

.commands-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  margin-top: 0.25rem;
}

.cmd-checkbox {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.875rem;
  color: var(--feather-primary-text-on-surface);
  cursor: pointer;

  input[type='checkbox'] {
    cursor: pointer;
  }
}

.btn-remove {
  background: none;
  border: none;
  color: var(--feather-error);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;

  &:hover {
    opacity: 0.7;
  }
}

.required {
  color: var(--feather-error);
}
</style>
