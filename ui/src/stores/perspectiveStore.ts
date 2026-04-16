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
import { useMenuStore } from '@/stores/menuStore'

export type Perspective = 'problems' | 'all'

const STORAGE_KEY = 'onms.perspective'

/** Migrate legacy 'full' value stored by previous versions. */
const migrateStoredValue = (stored: string | null): Perspective | null => {
  if (stored === 'full') return 'all'   // one-time migration
  if (stored === 'problems' || stored === 'all') return stored
  return null
}

export const usePerspectiveStore = defineStore('perspectiveStore', () => {
  const menuStore = useMenuStore()

  // Has the user ever explicitly chosen a perspective in this browser?
  const stored = migrateStoredValue(localStorage.getItem(STORAGE_KEY))

  // Resolve the initial value:
  //   1. explicit user preference (localStorage)
  //   2. server-configured default (mainMenu.defaultPerspective, loaded async)
  //   3. hard fallback: 'problems'
  const perspective = ref<Perspective>(stored ?? 'problems')

  // Once the menu loads, apply the server default if the user has no stored preference.
  // Uses a one-shot watcher so it doesn't override explicit user choices later.
  const _applied = ref(false)
  watch(
    () => menuStore.mainMenu?.defaultPerspective,
    (serverDefault) => {
      if (_applied.value) return
      if (!stored && serverDefault) {
        perspective.value = serverDefault === 'all' ? 'all' : 'problems'
      }
      _applied.value = true
    }
  )

  const isProblems = computed(() => perspective.value === 'problems')

  function setPerspective(value: Perspective) {
    perspective.value = value
    localStorage.setItem(STORAGE_KEY, value)
  }

  return { perspective, isProblems, setPerspective }
})
