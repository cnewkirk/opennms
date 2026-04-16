import { describe, test, expect, vi, beforeEach } from 'vitest'
import { buildPersesTheme } from '@/theme/persesTheme'

describe('buildPersesTheme', () => {
  beforeEach(() => {
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (prop: string) => {
        const map: Record<string, string> = {
          '--feather-color-scheme': ' light',
          '--feather-primary-interactive-default': ' #6200ee',
          '--feather-background': ' #ffffff',
          '--feather-surface-fill': ' #f5f5f5',
          '--feather-text-color': ' #212121'
        }
        return map[prop] ?? ''
      }
    }))
  })

  test('builds light theme from Feather CSS vars', () => {
    const theme = buildPersesTheme()
    expect(theme.palette.mode).toBe('light')
    expect(theme.palette.primary?.main).toBe('#6200ee')
    expect(theme.palette.background?.default).toBe('#ffffff')
  })

  test('returns dark theme when --feather-color-scheme is dark', () => {
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (prop: string) => (prop === '--feather-color-scheme' ? ' dark' : ' #000000')
    }))
    const theme = buildPersesTheme()
    expect(theme.palette.mode).toBe('dark')
  })

  test('uses fallback values when CSS vars are absent', () => {
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: () => ''
    }))
    const theme = buildPersesTheme()
    expect(theme.palette.primary?.main).toBe('#1976d2')
    expect(theme.palette.background?.default).toBe('#ffffff')
  })
})
