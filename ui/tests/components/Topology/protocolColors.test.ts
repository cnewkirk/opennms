import { describe, it, expect } from 'vitest'
import { getProtocolColor, parallelOffsets, utilizationColor, throughputWidth, formatBitsPerSec, PROTOCOL_COLORS, FALLBACK_COLOR } from '@/components/Topology/protocolColors'

describe('getProtocolColor', () => {
  it('returns the correct hex for known protocols (case-insensitive)', () => {
    expect(getProtocolColor('LLDP')).toBe(PROTOCOL_COLORS['lldp'])
    expect(getProtocolColor('lldp')).toBe(PROTOCOL_COLORS['lldp'])
    expect(getProtocolColor('OSPF')).toBe(PROTOCOL_COLORS['ospf'])
    expect(getProtocolColor('BGP')).toBe(PROTOCOL_COLORS['bgp'])
    expect(getProtocolColor('IS-IS')).toBe(PROTOCOL_COLORS['is-is'])
  })

  it('returns fallback color for unknown protocols', () => {
    expect(getProtocolColor('unknown-protocol')).toBe(FALLBACK_COLOR)
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

describe('utilizationColor', () => {
  it('returns green for low utilization (0-50%)', () => {
    expect(utilizationColor(0)).toBe('#48BB78')
    expect(utilizationColor(25)).toBe('#48BB78')
    expect(utilizationColor(49.9)).toBe('#48BB78')
  })
  it('returns yellow for medium utilization (50-75%)', () => {
    expect(utilizationColor(50)).toBe('#ECC94B')
    expect(utilizationColor(60)).toBe('#ECC94B')
    expect(utilizationColor(74.9)).toBe('#ECC94B')
  })
  it('returns orange for high utilization (75-90%)', () => {
    expect(utilizationColor(75)).toBe('#ED8936')
    expect(utilizationColor(80)).toBe('#ED8936')
    expect(utilizationColor(89.9)).toBe('#ED8936')
  })
  it('returns red for critical utilization (90-100%)', () => {
    expect(utilizationColor(90)).toBe('#FC8181')
    expect(utilizationColor(100)).toBe('#FC8181')
  })
})

describe('throughputWidth', () => {
  it('returns 2 for sub-1Mbps', () => {
    expect(throughputWidth(0)).toBe(2)
    expect(throughputWidth(500_000)).toBe(2)
    expect(throughputWidth(999_999)).toBe(2)
  })
  it('returns 3 for 1-10 Mbps', () => {
    expect(throughputWidth(1_000_000)).toBe(3)
    expect(throughputWidth(5_000_000)).toBe(3)
    expect(throughputWidth(9_999_999)).toBe(3)
  })
  it('returns 4 for 10-100 Mbps', () => {
    expect(throughputWidth(10_000_000)).toBe(4)
    expect(throughputWidth(50_000_000)).toBe(4)
  })
  it('returns 6 for 100 Mbps-1 Gbps', () => {
    expect(throughputWidth(100_000_000)).toBe(6)
    expect(throughputWidth(500_000_000)).toBe(6)
  })
  it('returns 8 for over 1 Gbps', () => {
    expect(throughputWidth(1_000_000_000)).toBe(8)
    expect(throughputWidth(10_000_000_000)).toBe(8)
  })
})

describe('formatBitsPerSec', () => {
  it('formats values under 1000 as whole number', () => {
    expect(formatBitsPerSec(500)).toBe('500')
  })
  it('formats kilobits with K suffix', () => {
    expect(formatBitsPerSec(1_500)).toBe('1.5K')
    expect(formatBitsPerSec(10_000)).toBe('10K')
  })
  it('formats megabits with M suffix', () => {
    expect(formatBitsPerSec(1_500_000)).toBe('1.5M')
    expect(formatBitsPerSec(230_000_000)).toBe('230M')
  })
  it('formats gigabits with G suffix', () => {
    expect(formatBitsPerSec(1_500_000_000)).toBe('1.5G')
  })
  it('formats exactly 1000 bps as K', () => {
    expect(formatBitsPerSec(1_000)).toBe('1K')
  })
  it('formats exactly 1000000 bps as M', () => {
    expect(formatBitsPerSec(1_000_000)).toBe('1M')
  })
  it('formats exactly 1000000000 bps as G', () => {
    expect(formatBitsPerSec(1_000_000_000)).toBe('1G')
  })
})
