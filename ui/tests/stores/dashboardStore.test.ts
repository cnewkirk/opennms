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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// mock localStorage
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] }
})

import { loadConfig, defaultConfig, saveConfig } from '@/services/dashboardConfigService'

describe('dashboardConfigService', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    setActivePinia(createPinia())
  })

  test('default config widgets have x, y, w, h fields', () => {
    const config = defaultConfig()
    for (const w of config.widgets) {
      expect(typeof w.x).toBe('number')
      expect(typeof w.y).toBe('number')
      expect(typeof w.w).toBe('number')
      expect(typeof w.h).toBe('number')
    }
  })

  test('loadConfig discards old colSpan-only config and returns defaults', () => {
    // simulate old v1 config without x/y/h
    store['opennms.dashboard.config'] = JSON.stringify({
      version: 1,
      widgets: [{ id: 'w1', type: 'summary', title: 'S', colSpan: 12, categories: [], limit: 0, refreshInterval: 60, severities: [] }]
    })
    const config = loadConfig()
    // should fall back to defaults since no x/y/h fields
    expect(config.widgets[0].x).toBe(0)
    expect(config.widgets[0].y).toBe(0)
  })

  test('loadConfig restores valid config from localStorage', () => {
    const saved = defaultConfig()
    saveConfig(saved)
    const loaded = loadConfig()
    expect(loaded.widgets).toHaveLength(saved.widgets.length)
    expect(loaded.widgets[0].x).toBe(saved.widgets[0].x)
  })
})
