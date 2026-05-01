// Vitest runs through the full Vite pipeline, so ?raw imports work natively —
// no mocking needed as long as the SVG files exist (created in Task 1).
import { describe, test, expect } from 'vitest'
import { getColoredIconDataUri } from '@/components/Topology/iconRegistry'

describe('iconRegistry — getColoredIconDataUri', () => {
  test('substitutes currentColor with the provided hex color', () => {
    const uri = getColoredIconDataUri('router', '#ef4444')
    const svg = decodeURIComponent(uri.split(',')[1])
    expect(uri).toMatch(/^data:image\/svg\+xml,/)
    expect(svg).toContain('#ef4444')
    expect(svg).not.toContain('currentColor')
  })

  test('falls back to server icon for an unknown key', () => {
    const uri = getColoredIconDataUri('does-not-exist', '#fff')
    expect(uri).toMatch(/^data:image\/svg\+xml,/)
  })

  test('produces a valid data URI for console', () => {
    const uri = getColoredIconDataUri('console', '#f59e0b')
    expect(uri).toMatch(/^data:image\/svg\+xml,/)
    const svg = decodeURIComponent(uri.split(',')[1])
    expect(svg).toContain('#f59e0b')
  })

  test('produces a valid data URI for pdu', () => {
    const uri = getColoredIconDataUri('pdu', '#f59e0b')
    expect(uri).toMatch(/^data:image\/svg\+xml,/)
  })
})
