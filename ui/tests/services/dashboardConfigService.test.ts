import { describe, test, expect, beforeEach, vi } from 'vitest'

const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] }
})

import {
  loadConfig,
  defaultConfig,
  saveConfig,
  resolveTimeRange
} from '@/services/dashboardConfigService'

describe('dashboardConfigService v3', () => {
  beforeEach(() => { Object.keys(store).forEach(k => delete store[k]) })

  test('defaultConfig has version 3', () => {
    expect(defaultConfig().version).toBe(3)
  })

  test('defaultConfig has timeRange with relative 24h', () => {
    const cfg = defaultConfig()
    expect(cfg.timeRange.mode).toBe('relative')
    expect(cfg.timeRange.relativeWindow).toBe('24h')
  })

  test('v2 config is migrated to v3 on load', () => {
    const v2: any = {
      version: 2,
      widgets: [
        { id: 'w1', type: 'summary', title: 'S', x: 0, y: 0, w: 12, h: 2,
          categories: [], limit: 0, refreshInterval: 60, severities: [] }
      ]
    }
    store['opennms.dashboard.config'] = JSON.stringify(v2)
    const loaded = loadConfig()
    expect(loaded.version).toBe(3)
    expect(loaded.timeRange).toBeDefined()
    expect(loaded.timeRange.relativeWindow).toBe('24h')
    expect(loaded.widgets[0].type).toBe('summary')
  })

  test('v3 config round-trips through save/load', () => {
    const cfg = defaultConfig()
    saveConfig(cfg)
    const loaded = loadConfig()
    expect(loaded.version).toBe(3)
    expect(loaded.widgets).toHaveLength(cfg.widgets.length)
  })
})

describe('resolveTimeRange', () => {
  test('relative 1h returns ~1h window', () => {
    const now = Date.now()
    const { start, end } = resolveTimeRange({ mode: 'relative', relativeWindow: '1h' })
    expect(end.getTime()).toBeGreaterThanOrEqual(now - 100)
    expect(now - start.getTime()).toBeCloseTo(3600 * 1000, -3)
  })

  test('relative 24h returns ~24h window', () => {
    const { start, end } = resolveTimeRange({ mode: 'relative', relativeWindow: '24h' })
    expect(end.getTime() - start.getTime()).toBeCloseTo(86400 * 1000, -3)
  })

  test('relative 7d returns ~7d window', () => {
    const { start, end } = resolveTimeRange({ mode: 'relative', relativeWindow: '7d' })
    expect(end.getTime() - start.getTime()).toBeCloseTo(7 * 86400 * 1000, -3)
  })

  test('absolute mode uses from/to directly', () => {
    const from = '2026-01-01T00:00:00.000Z'
    const to   = '2026-01-02T00:00:00.000Z'
    const { start, end } = resolveTimeRange({ mode: 'absolute', relativeWindow: '1h', from, to })
    expect(start.toISOString()).toBe(from)
    expect(end.toISOString()).toBe(to)
  })
})
