import { describe, it, expect } from 'vitest'
import { getProtocolColor, parallelOffsets, PROTOCOL_COLORS } from '@/components/Topology/protocolColors'

describe('getProtocolColor', () => {
  it('returns the correct hex for known protocols (case-insensitive)', () => {
    expect(getProtocolColor('LLDP')).toBe(PROTOCOL_COLORS['lldp'])
    expect(getProtocolColor('lldp')).toBe(PROTOCOL_COLORS['lldp'])
    expect(getProtocolColor('OSPF')).toBe(PROTOCOL_COLORS['ospf'])
    expect(getProtocolColor('BGP')).toBe(PROTOCOL_COLORS['bgp'])
    expect(getProtocolColor('IS-IS')).toBe(PROTOCOL_COLORS['is-is'])
  })

  it('returns fallback color for unknown protocols', () => {
    expect(getProtocolColor('unknown-protocol')).toBe('#718096')
  })

  it('handles "User Defined" as a known protocol', () => {
    expect(getProtocolColor('User Defined')).toBe(PROTOCOL_COLORS['user-defined'])
  })
})

describe('parallelOffsets', () => {
  it('returns [0] for a single protocol', () => {
    expect(parallelOffsets(1)).toEqual([0])
  })

  it('returns symmetric offsets for 2 protocols', () => {
    const offsets = parallelOffsets(2)
    expect(offsets).toHaveLength(2)
    expect(offsets[0]).toBeLessThan(0)
    expect(offsets[1]).toBeGreaterThan(0)
    expect(offsets[0]).toBe(-offsets[1])
  })

  it('returns symmetric offsets centered on 0 for 3 protocols', () => {
    const offsets = parallelOffsets(3)
    expect(offsets).toHaveLength(3)
    expect(offsets[1]).toBe(0)
    expect(offsets[0]).toBe(-offsets[2])
  })

  it('always returns n offsets for n protocols', () => {
    for (let n = 1; n <= 7; n++) {
      expect(parallelOffsets(n)).toHaveLength(n)
    }
  })
})
