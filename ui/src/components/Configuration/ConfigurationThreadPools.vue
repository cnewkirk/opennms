<template>
  <Accordion
    id="thread-pool-expansion"
    class="expansion-panel"
    :value="threadPoolsActive ? 'panel' : null"
    @update:value="(v) => { threadPoolsActive = !!v }"
  >
    <AccordionPanel value="panel">
      <AccordionHeader>
        <div class="title-flex">
          <div class="title">Thread Pools</div>
          <div v-if="!threadPoolsActive">
            <div class="chip-list">
              <Chip v-if="unTouchedThreadPoolData.importThreads" :label="`${unTouchedThreadPoolData.importThreads} Import Threads`" />
              <Chip v-if="unTouchedThreadPoolData.scanThreads" :label="`${unTouchedThreadPoolData.scanThreads} Scan Threads`" />
              <Chip v-if="unTouchedThreadPoolData.rescanThreads" :label="`${unTouchedThreadPoolData.rescanThreads} Rescan Threads`" />
              <Chip v-if="unTouchedThreadPoolData.writeThreads" :label="`${unTouchedThreadPoolData.writeThreads} Write Threads`" />
            </div>
          </div>
        </div>
      </AccordionHeader>
      <AccordionContent>
    <div>
      <p class="pb-xl">
        Thread pool sizes impact the performance of the provisioning subsystem. Larger systems may require larger
        values. To adjust them, type a new number in the field or use the up/down arrows to select a value.
      </p>
      <div class="p-float-label mb-m">
        <InputText
          id="import-threads"
          :invalid="!!getError('importThreads')"
          type="number"
          v-model="threadPoolData.importThreads"
          @keypress="enterCheck"
        />
        <label for="import-threads">Import</label>
        <small v-if="getError('importThreads')" class="p-error">{{ getError('importThreads') }}</small>
        <small v-else class="p-hint">Number of threads to allocate for requisition import tasks.</small>
      </div>
      <div class="p-float-label mb-m">
        <InputText
          id="scan-threads"
          :invalid="!!getError('scanThreads')"
          type="number"
          v-model="threadPoolData.scanThreads"
          @keypress="enterCheck"
        />
        <label for="scan-threads">Scan</label>
        <small v-if="getError('scanThreads')" class="p-error">{{ getError('scanThreads') }}</small>
        <small v-else class="p-hint">Number of threads to allocate for manual scanning tasks.</small>
      </div>
      <div class="p-float-label mb-m">
        <InputText
          id="rescan-threads"
          :invalid="!!getError('rescanThreads')"
          type="number"
          v-model="threadPoolData.rescanThreads"
          @keypress="enterCheck"
        />
        <label for="rescan-threads">Rescan</label>
        <small v-if="getError('rescanThreads')" class="p-error">{{ getError('rescanThreads') }}</small>
        <small v-else class="p-hint">Number of threads to allocate for scheduled rescanning tasks.</small>
      </div>
      <div class="p-float-label last-input mb-m">
        <InputText
          id="write-threads"
          :invalid="!!getError('writeThreads')"
          type="number"
          v-model="threadPoolData.writeThreads"
          @keypress="enterCheck"
        />
        <label for="write-threads">Write</label>
        <small v-if="getError('writeThreads')" class="p-error">{{ getError('writeThreads') }}</small>
        <small v-else class="p-hint">Number of threads to allocate for writing to the database.</small>
      </div>
      <Button
        @click="updateThreadpools"
        :disabled="loading"
        :loading="loading"
        label="Update Thread Pools"
      />
    </div>
      </AccordionContent>
    </AccordionPanel>
  </Accordion>
</template>

<script
  setup
  lang="ts"
>
import { useConfigurationStore } from '@/stores/configurationStore'

import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import { isEqual as _isEqual } from 'lodash'

import { putProvisionDService } from '@/services/configurationService'
import useSnackbar from '@/composables/useSnackbar'
import { threadPoolKeys } from './copy/threadPoolKeys'
import { ConfigurationHelper } from './ConfigurationHelper'

const configurationStore = useConfigurationStore()
const { showSnackBar } = useSnackbar()

const threadPoolsErrors = ref<Record<string, boolean>>({})
const threadPoolsActive = ref(false)
const loading = ref(false)

const getUpperBound = (key: string) => ['importThreads', 'writeThreads'].includes(key) ? 100 : 2000
const upperBoundErrorMessage = (upperBound: number) => `Thread pool values have to be between 1 and ${upperBound}.`
const snackbarErrorMessage = 'Thread pool values are outside of supported range.'

const threadPoolData = computed(() => {
  const localThreads: Record<string, string> = {}
  threadPoolKeys.forEach((key) => (localThreads[key] = configurationStore.provisionDService?.[key]))

  return reactive(localThreads)
})

const unTouchedThreadPoolData = computed(() => {
  const localThreads: Record<string, string> = {}
  threadPoolKeys.forEach((key) => (localThreads[key] = configurationStore.provisionDService?.[key]))

  return reactive(localThreads)
})

/** User has opted to update threadpool data.  */
const updateThreadpools = async () => {
  loading.value = true
  // Clear Errors
  threadPoolsErrors.value = {}

  // Set Current Threadpool state.
  const currentThreadpoolState = threadPoolData.value
  const updatedProvisionDData = configurationStore.provisionDService

  // Validate Threadpool Data
  threadPoolKeys.forEach((key) => {
    const val = parseInt(currentThreadpoolState?.[key])
    if (val < 1 || val > getUpperBound(key)) {
      threadPoolsErrors.value[key] = true
    }
  })

  // If there are no errors.
  if (Object.keys(threadPoolsErrors.value).length === 0) {
    try {
      // reduce provisionD data object to thread pool sizes, in order to determine whether thread pool sizes value has changed, upon update button clicked
      const reducedUpdatedProvisionDData = threadPoolKeys.reduce((acc, key) => {
        const obj: Record<string, string> = {}

        for(let elem in updatedProvisionDData) {
          if(elem === key){
            obj[elem] = updatedProvisionDData[elem]
            break
          }
        }

        return {...acc, ...obj}
      },{})
      const haveThreadPoolValuesChanged = !_isEqual(currentThreadpoolState, reducedUpdatedProvisionDData)

      // Set Update State
      threadPoolKeys.forEach((key) => {
        if (updatedProvisionDData?.[key]) {
          updatedProvisionDData[key] = parseInt(currentThreadpoolState?.[key])
        }
      })
      if (updatedProvisionDData) {
        updatedProvisionDData['requisition-def'] = ConfigurationHelper.stripOriginalIndexes(updatedProvisionDData['requisition-def'])
      }
      // Push Updates to Server
      await putProvisionDService(updatedProvisionDData)
      // Redownload + Populate Data.
      await configurationStore.getProvisionDService()

      let messageUpdateSuccess = 'Thread pool data saved.'

      if(!haveThreadPoolValuesChanged) {
        showSnackBar({
          msg: messageUpdateSuccess
        })
      } else {
        messageUpdateSuccess += ' Restart OpenNMS for this change to take effect.'

        showSnackBar({
          msg: messageUpdateSuccess,
          timeout: 10000
        })
      }
    } catch (err) {
      showSnackBar({
        msg: `Thread pool data not saved. (${err})`,
        error: true
      })
    }
  } else {
    showSnackBar({
      msg: snackbarErrorMessage,
      error: true
    })
  }

  loading.value = false
}

/**
 * Check if User has hit enter in a Threadpool box.
 * @param key They key that has been pressed.
 */
const enterCheck = (key: { key: string }) => {
  if (key.key === 'Enter') {
    updateThreadpools()
  }
}

/**
 * Determine is error is set for a key, and if so, return generic error message.
 */
const getError = (key: string) => {
  return threadPoolsErrors.value[key] ? upperBoundErrorMessage(getUpperBound(key)) : ''
}
</script>

<style
  lang="scss"
  scoped
>
@import "@featherds/styles/mixins/typography";

.expansion-panel{
  :deep(.feather-expansion-header-button) {
    height: 72px;
  }
}
.title {
  @include headline3();
  margin-right: 16px;
}
.title-flex {
  display: flex;
  align-items: center;
}
.last-input {
  margin-bottom: 10px;
}
.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.mb-m {
  margin-bottom: 1rem;
}
</style>
