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
import type { DetectRequest, MBeanDto, GenerateResponse } from '@/services/jmxConfigService'

export const useJmxConfigStore = defineStore('jmxConfigStore', () => {
  const currentStep = ref<1 | 2 | 3 | 4>(1)

  const connectionConfig = ref<DetectRequest>({
    serviceName: 'anyservice',
    connection: 'service:jmx:rmi://localhost:18980',
    authenticate: false,
    user: null,
    password: null,
    skipDefaultVM: true,
    skipNonNumber: false
  })

  const jobId = ref<string | null>(null)
  const jobStatus = ref<'idle' | 'pending' | 'running' | 'done' | 'error'>('idle')
  const jobError = ref<string | null>(null)

  const mbeans = ref<MBeanDto[]>([])
  const outputFileName = ref<string>('')
  const generatedXml = ref<string | null>(null)
  const savedPath = ref<string | null>(null)
  const generateError = ref<string | null>(null)

  const setDetectionResult = (detected: MBeanDto[]) => {
    mbeans.value = detected
    outputFileName.value = `${connectionConfig.value.serviceName}-jmx.xml`
  }

  const setGenerateResult = (result: GenerateResponse) => {
    generatedXml.value = result.xml
    savedPath.value = result.savedPath
  }

  const reset = () => {
    currentStep.value = 1
    jobId.value = null
    jobStatus.value = 'idle'
    jobError.value = null
    mbeans.value = []
    generatedXml.value = null
    savedPath.value = null
    generateError.value = null
  }

  return {
    currentStep,
    connectionConfig,
    jobId,
    jobStatus,
    jobError,
    mbeans,
    outputFileName,
    generatedXml,
    savedPath,
    generateError,
    setDetectionResult,
    setGenerateResult,
    reset
  }
})
