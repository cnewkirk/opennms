<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->

<template>
  <div class="mib-compiler">
    <BreadCrumbs :items="breadcrumbs" />
    <h1 class="page-title">SNMP MIB Compiler</h1>

    <div class="split-panel">
      <div class="left-panel">
        <MibUploadButton />
        <MibTree
          @edit="onEdit"
          @view="onView"
          @compile="onCompile"
          @delete="onDelete"
          @generate-events="onGenerateEvents"
          @generate-datacollection="onGenerateDataCollection"
        />
      </div>
      <div class="right-panel">
        <MibConsole />
      </div>
    </div>

    <!-- Dialogs -->
    <FileEditorDialog
      v-if="store.activeDialog === 'edit' && store.activeFile"
      :folder="store.activeFile.folder"
      :filename="store.activeFile.filename"
      :readOnly="false"
      @close="store.closeDialog()"
    />

    <FileEditorDialog
      v-if="store.activeDialog === 'view' && store.activeFile"
      :folder="store.activeFile.folder"
      :filename="store.activeFile.filename"
      :readOnly="true"
      @close="store.closeDialog()"
    />

    <EventUeiDialog
      v-if="store.activeDialog === 'eventUei' && store.activeFile"
      :filename="store.activeFile.filename"
      @confirm="onUeiConfirmed"
      @close="store.closeDialog()"
    />

    <GenerateEventsDialog
      v-if="store.activeDialog === 'generateEvents'"
      @close="store.closeDialog(); store.resetJob()"
    />

    <GenerateDataCollectionDialog
      v-if="store.activeDialog === 'generateDataCollection'"
      @close="store.closeDialog(); store.resetJob()"
    />
  </div>
</template>

<script setup lang="ts">
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import MibUploadButton from '@/components/MibCompiler/MibUploadButton.vue'
import MibTree from '@/components/MibCompiler/MibTree.vue'
import MibConsole from '@/components/MibCompiler/MibConsole.vue'
import FileEditorDialog from '@/components/MibCompiler/FileEditorDialog.vue'
import EventUeiDialog from '@/components/MibCompiler/EventUeiDialog.vue'
import GenerateEventsDialog from '@/components/MibCompiler/GenerateEventsDialog.vue'
import GenerateDataCollectionDialog from '@/components/MibCompiler/GenerateDataCollectionDialog.vue'
import { useMibCompilerStore } from '@/stores/mibCompilerStore'
import {
  listMibs,
  deleteMib,
  startCompile,
  pollCompile,
  startGenerateEvents,
  pollGenerateEvents,
  startGenerateDataCollection,
  pollGenerateDataCollection
} from '@/services/mibCompilerService'
import type { MibJobStatus } from '@/services/mibCompilerService'

const store = useMibCompilerStore()

const breadcrumbs = [
  { label: 'Admin', to: '/' },
  { label: 'SNMP MIB Compiler', to: '/mib-compiler' }
]

// Load MIB list on mount
onMounted(async () => {
  try {
    const mibs = await listMibs()
    store.pendingMibs = mibs.pending
    store.compiledMibs = mibs.compiled
    store.log('info', `Reading MIBs: ${mibs.pending.length} pending, ${mibs.compiled.length} compiled`)
  } catch (e: any) {
    store.log('error', `Failed to load MIB list: ${e?.message ?? 'Unknown error'}`)
  }
})

const refreshMibs = async () => {
  try {
    const mibs = await listMibs()
    store.pendingMibs = mibs.pending
    store.compiledMibs = mibs.compiled
  } catch { /* ignore */ }
}

const onEdit = (folder: string, filename: string) => {
  store.openDialog('edit', { folder, filename })
}

const onView = (filename: string) => {
  store.openDialog('view', { folder: 'compiled', filename })
}

const onDelete = async (folder: string, filename: string) => {
  if (!confirm(`Delete ${filename}? This cannot be undone.`)) return

  try {
    await deleteMib(folder, filename)
    store.log('info', `MIB ${filename} deleted from ${folder}`)
    await refreshMibs()
  } catch (e: any) {
    store.log('error', `Delete failed: ${e?.response?.data?.error ?? e?.message}`)
  }
}

const onCompile = async (filename: string) => {
  store.log('info', `Compiling MIB ${filename}...`)
  try {
    const jobId = await startCompile(filename)
    await pollUntilDone(jobId, pollCompile, (status) => {
      if (status.status === 'DONE') {
        store.log('info', `MIB compiled successfully as ${status.suggestedFileName}`)
        refreshMibs()
      } else if (status.status === 'ERROR') {
        if (status.missingDependencies?.length) {
          store.log('error', `Dependencies required: <b>${status.missingDependencies.join(', ')}</b>`)
        } else {
          store.log('error', `Compilation failed: ${status.error}`)
        }
      }
    })
  } catch (e: any) {
    store.log('error', `Compile request failed: ${e?.message}`)
  }
}

const onGenerateEvents = (filename: string) => {
  store.openDialog('eventUei', { folder: 'compiled', filename })
}

const onUeiConfirmed = async (ueiBase: string) => {
  const filename = store.activeFile?.filename
  if (!filename) return

  store.closeDialog()
  store.log('info', `Generating events from ${filename} with UEI base ${ueiBase}...`)

  try {
    const jobId = await startGenerateEvents(filename, ueiBase)
    await pollUntilDone(jobId, pollGenerateEvents, (status) => {
      if (status.status === 'DONE') {
        store.log('info', `Found ${status.eventCount} events`)
        store.generatedEventsXml = status.eventsXml
        store.generatedEventCount = status.eventCount
        store.suggestedFileName = status.suggestedFileName
        store.mibName = status.mibName
        store.openDialog('generateEvents')
      } else if (status.status === 'ERROR') {
        store.log('error', `Event generation failed: ${status.error}`)
      }
    })
  } catch (e: any) {
    store.log('error', `Generate events request failed: ${e?.message}`)
  }
}

const onGenerateDataCollection = async (filename: string) => {
  store.log('info', `Generating data collection from ${filename}...`)

  try {
    const jobId = await startGenerateDataCollection(filename)
    await pollUntilDone(jobId, pollGenerateDataCollection, (status) => {
      if (status.status === 'DONE') {
        store.log('info', `Found ${status.groupCount} data collection groups`)
        store.generatedDataCollectionXml = status.datacollectionXml
        store.generatedGroupCount = status.groupCount
        store.generatedGraphTemplates = status.graphTemplates
        store.suggestedFileName = status.suggestedFileName
        store.mibName = status.mibName
        store.openDialog('generateDataCollection')
      } else if (status.status === 'ERROR') {
        store.log('error', `Data collection generation failed: ${status.error}`)
      }
    })
  } catch (e: any) {
    store.log('error', `Generate data collection request failed: ${e?.message}`)
  }
}

/** Poll a job endpoint every 2s with 3x silent retry on network failure. */
const pollUntilDone = async (
  jobId: string,
  pollFn: (id: string) => Promise<MibJobStatus>,
  onComplete: (status: MibJobStatus) => void
) => {
  let failures = 0
  const maxFailures = 3

  const poll = async () => {
    try {
      const status = await pollFn(jobId)
      failures = 0

      if (status.status === 'DONE' || status.status === 'ERROR') {
        onComplete(status)
        return
      }

      setTimeout(poll, 2000)
    } catch (e) {
      failures++
      if (failures >= maxFailures) {
        store.log('error', 'Lost connection to server after multiple retries')
        return
      }
      setTimeout(poll, 2000)
    }
  }

  poll()
}
</script>

<style lang="scss" scoped>
@use '@/styles/vars' as vars;
@import "@featherds/styles/mixins/typography";
@import "@/styles/tokens";

.mib-compiler {
  padding: 1.5rem;
  height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
}

.page-title {
  @include headline1();
  margin-bottom: 1rem;
}

.split-panel {
  display: flex;
  flex: 1;
  min-height: 0;
  border: 1px solid var($border-on-surface);
  border-radius: vars.$border-radius-surface;
  overflow: hidden;
}

.left-panel {
  width: 25%;
  min-width: 200px;
  max-width: 350px;
  border-right: 1px solid var($border-on-surface);
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
}

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
