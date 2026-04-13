import { describe, it, expect } from 'vitest'
import { resolveVueRoute, legacyToVueRoutes } from '@/utils/legacyRoutes'

describe('resolveVueRoute', () => {
  it('resolves known alarm URL to Vue route', () => {
    expect(resolveVueRoute('alarm/index.htm')).toBe('/alarms')
  })

  it('resolves legacy topology entry', () => {
    expect(resolveVueRoute('topology')).toBe('/topology')
  })

  it('returns null for unknown URL', () => {
    expect(resolveVueRoute('some/unknown.jsp')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(resolveVueRoute('')).toBeNull()
  })

  it('all values start with /', () => {
    for (const [key, value] of Object.entries(legacyToVueRoutes)) {
      expect(value, `Route for "${key}" must start with /`).toMatch(/^\//)
    }
  })
})
