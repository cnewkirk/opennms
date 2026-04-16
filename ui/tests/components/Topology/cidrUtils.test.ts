import { describe, it, expect } from 'vitest'
import { ipInCidr, isValidCidr } from '@/components/Topology/cidrUtils'

describe('ipInCidr', () => {
  it('matches an IP in range', () => {
    expect(ipInCidr('10.0.1.5', '10.0.0.0/8')).toBe(true)
  })
  it('rejects an IP out of range', () => {
    expect(ipInCidr('192.168.1.1', '10.0.0.0/8')).toBe(false)
  })
  it('handles /24', () => {
    expect(ipInCidr('10.0.1.200', '10.0.1.0/24')).toBe(true)
    expect(ipInCidr('10.0.2.1', '10.0.1.0/24')).toBe(false)
  })
  it('handles /32 exact match', () => {
    expect(ipInCidr('10.0.0.1', '10.0.0.1/32')).toBe(true)
    expect(ipInCidr('10.0.0.2', '10.0.0.1/32')).toBe(false)
  })
  it('handles /0 (matches everything)', () => {
    expect(ipInCidr('1.2.3.4', '0.0.0.0/0')).toBe(true)
  })
  it('returns false for invalid IP', () => {
    expect(ipInCidr('not-an-ip', '10.0.0.0/8')).toBe(false)
  })
  it('returns false for invalid CIDR', () => {
    expect(ipInCidr('10.0.0.1', 'not-a-cidr')).toBe(false)
  })
})

describe('isValidCidr', () => {
  it('accepts valid CIDR', () => expect(isValidCidr('10.0.0.0/8')).toBe(true))
  it('rejects missing prefix', () => expect(isValidCidr('10.0.0.0')).toBe(false))
  it('rejects out-of-range prefix', () => expect(isValidCidr('10.0.0.0/33')).toBe(false))
  it('rejects invalid IP', () => expect(isValidCidr('256.0.0.0/8')).toBe(false))
})
