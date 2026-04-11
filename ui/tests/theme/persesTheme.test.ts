import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildPersesTheme } from '@/theme/persesTheme'

describe('buildPersesTheme', () => {
  beforeEach(() => {
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (prop: string) => {
        const map: Record<string, string> = {
          '--feather-background': ' #ffffff',
          '--feather-surface': ' #f5f5f5',
          '--feather-primary-text-on-surface': ' #212121'
        }
        return map[prop] ?? ''
      }
    }))
  })

  afterEach(() => {
    document.documentElement.classList.remove('open-dark')
  })

  test('builds light theme from Feather CSS vars', () => {
    const theme = buildPersesTheme()
    expect(theme.palette.mode).toBe('light')
    expect(theme.palette.background?.default).toBe('#ffffff')
  })

  test('returns dark theme when open-dark class is set', () => {
    document.documentElement.classList.add('open-dark')
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (prop: string) => {
        const map: Record<string, string> = {
          '--feather-background': ' #0a0c1b',
          '--feather-surface': ' #15182b',
          '--feather-primary-text-on-surface': ' #ffffff'
        }
        return map[prop] ?? ''
      }
    }))
    const theme = buildPersesTheme()
    expect(theme.palette.mode).toBe('dark')
  })

  test('uses fallback values when CSS vars are absent', () => {
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: () => ''
    }))
    const theme = buildPersesTheme()
    expect(theme.palette.background?.default).toBe('#ffffff')
  })
})
