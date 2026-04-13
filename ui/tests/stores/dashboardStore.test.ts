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

describe('dashboardStore', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  test('updateLayout merges x/y/w/h onto matching widgets', async () => {
    const { useDashboardStore } = await import('@/stores/dashboardStore')
    const dashStore = useDashboardStore()
    // simulate gridstack reporting new positions
    dashStore.updateLayout([
      { id: 'widget-summary', x: 0, y: 0, w: 12, h: 3 },
      { id: 'widget-outages', x: 0, y: 3, w: 4, h: 2 }
    ])
    const summary = dashStore.widgets.find(w => w.id === 'widget-summary')
    expect(summary?.h).toBe(3)
    const outages = dashStore.widgets.find(w => w.id === 'widget-outages')
    expect(outages?.w).toBe(4)
    expect(outages?.y).toBe(3)
  })

  test('updateLayout ignores unknown ids', async () => {
    const { useDashboardStore } = await import('@/stores/dashboardStore')
    const dashStore = useDashboardStore()
    const before = dashStore.widgets.length
    dashStore.updateLayout([{ id: 'nonexistent', x: 0, y: 0, w: 6, h: 2 }])
    expect(dashStore.widgets.length).toBe(before)
  })

  test('reset restores default widget count', async () => {
    const { useDashboardStore } = await import('@/stores/dashboardStore')
    const dashStore = useDashboardStore()
    dashStore.removeWidget('widget-summary')
    dashStore.reset()
    expect(dashStore.widgets.length).toBe(4)
  })
})

describe('dashboardStore timeRange', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  test('initial timeRange is relative 24h', async () => {
    const { useDashboardStore } = await import('@/stores/dashboardStore')
    const s = useDashboardStore()
    expect(s.timeRange.mode).toBe('relative')
    expect(s.timeRange.relativeWindow).toBe('24h')
  })

  test('updateTimeRange persists change', async () => {
    const { useDashboardStore } = await import('@/stores/dashboardStore')
    const s = useDashboardStore()
    s.updateTimeRange({ mode: 'relative', relativeWindow: '7d' })
    expect(s.timeRange.relativeWindow).toBe('7d')
    // localStorage should be updated
    const saved = JSON.parse(store['opennms.dashboard.config'] ?? '{}')
    expect(saved.timeRange?.relativeWindow).toBe('7d')
  })
})
