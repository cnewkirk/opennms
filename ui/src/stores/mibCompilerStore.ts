///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

import { defineStore } from 'pinia'

export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
  timestamp: string
}

export type DialogType =
  | 'edit'
  | 'view'
  | 'eventUei'
  | 'generateEvents'
  | 'generateDataCollection'
  | null

export const useMibCompilerStore = defineStore('mibCompilerStore', () => {
  const pendingMibs = ref<string[]>([])
  const compiledMibs = ref<string[]>([])
  const logEntries = ref<LogEntry[]>([])

  // Dialog state
  const activeDialog = ref<DialogType>(null)
  const activeFile = ref<{ folder: string; filename: string } | null>(null)

  // Job state (compile / generate)
  const jobId = ref<string | null>(null)
  const jobStatus = ref<'idle' | 'pending' | 'running' | 'done' | 'error'>('idle')
  const jobError = ref<string | null>(null)
  const missingDependencies = ref<string[] | null>(null)

  // Generation results
  const generatedEventsXml = ref<string | null>(null)
  const generatedEventCount = ref(0)
  const generatedDataCollectionXml = ref<string | null>(null)
  const generatedGroupCount = ref(0)
  const generatedGraphTemplates = ref<string | null>(null)
  const suggestedFileName = ref<string | null>(null)
  const mibName = ref<string | null>(null)

  const log = (level: LogEntry['level'], message: string) => {
    logEntries.value.push({
      level,
      message,
      timestamp: new Date().toLocaleTimeString()
    })
  }

  const clearLog = () => {
    logEntries.value = []
  }

  const openDialog = (type: DialogType, file?: { folder: string; filename: string }) => {
    activeDialog.value = type
    activeFile.value = file ?? null
  }

  const closeDialog = () => {
    activeDialog.value = null
    activeFile.value = null
  }

  const resetJob = () => {
    jobId.value = null
    jobStatus.value = 'idle'
    jobError.value = null
    missingDependencies.value = null
    generatedEventsXml.value = null
    generatedEventCount.value = 0
    generatedDataCollectionXml.value = null
    generatedGroupCount.value = 0
    generatedGraphTemplates.value = null
    suggestedFileName.value = null
    mibName.value = null
  }

  return {
    pendingMibs,
    compiledMibs,
    logEntries,
    activeDialog,
    activeFile,
    jobId,
    jobStatus,
    jobError,
    missingDependencies,
    generatedEventsXml,
    generatedEventCount,
    generatedDataCollectionXml,
    generatedGroupCount,
    generatedGraphTemplates,
    suggestedFileName,
    mibName,
    log,
    clearLog,
    openDialog,
    closeDialog,
    resetJob
  }
})
