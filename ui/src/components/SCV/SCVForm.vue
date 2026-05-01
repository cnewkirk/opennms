<template>
  <div class="form-container" id="scv">
    <p class="title">{{ isEditing ? 'Update' : 'Add' }} Credentials</p>
    <div class="alias-input">
      <InputText
        data-test="alias-input"
        :disabled="isEditing"
        placeholder="Alias"
        @update:modelValue="updateAlias"
        :modelValue="scvStore.credentials.alias"
        :class="{ 'p-invalid': aliasError }"
      />
      <small v-if="aliasError" class="p-error">{{ aliasError }}</small>
    </div>

    <form autocomplete="off" class="row">
      <div class="input">
        <InputText
          data-test="username-input"
          autocomplete="new-username"
          placeholder="Username"
          @update:modelValue="updateUsername"
          :modelValue="scvStore.credentials.username"
        />
      </div>

      <div class="input">
        <InputText
          data-test="password-input"
          autocomplete="new-password"
          placeholder="Password"
          type="password"
          @update:modelValue="updatePassword"
          :modelValue="scvStore.credentials.password"
          :class="{ 'p-invalid': passwordError }"
        />
        <small v-if="passwordError" class="p-error">{{ passwordError }}</small>
      </div>
    </form>

    <div class="add-btn" @click="addAttribute" data-test="add-attr-btn">
      <i class="pi pi-plus" aria-hidden="true" />
      Add attribute
    </div>

    <SCVAttribute
      v-for="(value, key, index) in scvStore.credentials.attributes" 
      :key="key" :attributeKey="key" 
      :attributeValue="value" 
      :attributeIndex="index"
      @set-key-error="setKeyError"
    />

    <div class="btns">
      <Button
        v-if="!isEditing"
        data-test="add-creds-btn"
        label="Add Credentials"
        :disabled="disabled"
        @click="addCredentials"
      />

      <Button
        v-if="isEditing"
        data-test="update-creds-btn"
        label="Update Credentials"
        :disabled="disabled"
        @click="updateCredentials"
      />

      <Button
        data-test="clear-btn"
        label="Clear Form"
        @click="clearCredentials"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { useScvStore } from '@/stores/scvStore'
import { SCVCredentials } from '@/types/scv'
import { UpdateModelFunction } from '@/types'
import SCVAttribute from './SCVAttribute.vue'

const scvStore = useScvStore()
const keyError = ref(false)
const dbCredentials = computed<SCVCredentials>(() => scvStore.dbCredentials)
const aliases = computed<string[]>(() => scvStore.aliases)
const isEditing = computed<boolean>(() => scvStore.isEditing)
const disabled = computed<boolean>(() => Boolean(!scvStore.credentials.alias || aliasError.value || passwordError.value || keyError.value))

const isMasked = (password: string) => {
  for (const char of password) {
    if (char !== '*') return false
  }

  return true
}

// if the username has changed and the password is masked
// warn the user that the password must also be updated
const passwordError = computed<string | undefined>(() => {
  if (
    dbCredentials.value.username && scvStore.credentials.password &&
    scvStore.credentials.username !== dbCredentials.value.username && 
    isMasked(scvStore.credentials.password)) {

    return 'Password cannot be masked with updated usernames.'  
  }
  return undefined
})

// Error if alias name is not unique.
const aliasError = computed<string | undefined>(() => {
  if (
    !isEditing.value && 
    scvStore.credentials.alias && 
    aliases.value.includes(scvStore.credentials.alias.toLowerCase())) {
    return 'Alias already in use.'
  }
  return undefined
})

const setKeyError = (val: boolean) => keyError.value = val

const updateAlias: UpdateModelFunction = (val: string) => {
  scvStore.setValue({ alias: val.toLowerCase() })
} 

const updateUsername: UpdateModelFunction = (val: string) => scvStore.setValue({ username: val })
const updatePassword: UpdateModelFunction = (val: string) => scvStore.setValue({ password: val }) 
const addCredentials = () => scvStore.addCredentials()
const updateCredentials = () => scvStore.updateCredentials()
const clearCredentials = () => scvStore.clearCredentials()
const addAttribute = () => scvStore.addAttribute()
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";
@import "@/styles/elevation";
@import "@/styles/typography";

.form-container {
  @include elevation(1);
  background: var($surface);
  height: calc(100vh - 149px);
  display: flex;
  flex-direction: column;
  padding: 0px 15px 15px 15px;
  overflow-y: auto;

  .title {
    @include headline3;
    margin-top: 11px;
    margin-bottom: 9px;
  }

  .row {
    display: flex;
    flex-direction: row;
    gap: 10px;
  }

  .alias-input {
    width: calc(50% - 5px);
  }
  .input {
    width: 50%;
  }

  .add-btn {
    cursor: pointer;
    @include body-small;
    margin-bottom: 10px;
  }

  .btns {
    display: flex;
    flex-direction: row;
  }
}
</style>

