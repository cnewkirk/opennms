import { describe, it, expect } from 'vitest'
import { buildSnmpResourceId, pickBestInterface } from '@/services/measurementsService'
import { SnmpInterface } from '@/types'

const makeIface = (overrides: Partial<SnmpInterface>): SnmpInterface => ({
  collect: true, collectFlag: 'C', collectionUserSpecified: false,
  hasEgressFlows: false, hasFlows: false, hasIngressFlows: false,
  id: 1, ifAdminStatus: 1, ifAlias: null, ifDescr: 'eth0', ifIndex: 1,
  ifName: 'eth0', ifOperStatus: 1, ifSpeed: 1_000_000_000,
  ifType: 6, lastCapsdPoll: 0, lastEgressFlow: null,
  lastIngressFlow: null, lastSnmpPoll: 0, physAddr: null, poll: true,
  ...overrides
})

describe('buildSnmpResourceId', () => {
  it('uses ifName-physAddr when physAddr is present', () => {
    const iface = makeIface({ ifName: 'eth0', physAddr: 'aabbccddeeff' })
    expect(buildSnmpResourceId(42, iface)).toBe('node[42].interfaceSnmp[eth0-aabbccddeeff]')
  })
  it('uses just ifName when physAddr is null', () => {
    const iface = makeIface({ ifName: 'eth0', physAddr: null })
    expect(buildSnmpResourceId(42, iface)).toBe('node[42].interfaceSnmp[eth0]')
  })
  it('falls back to ifDescr when ifName is null', () => {
    const iface = makeIface({ ifName: null, ifDescr: 'GigabitEthernet0', physAddr: null })
    expect(buildSnmpResourceId(42, iface)).toBe('node[42].interfaceSnmp[GigabitEthernet0]')
  })
})

describe('pickBestInterface', () => {
  it('returns null for empty list', () => {
    expect(pickBestInterface([])).toBeNull()
  })
  it('skips loopback interfaces (ifType 24)', () => {
    const loopback = makeIface({ ifType: 24, ifSpeed: 10_000_000_000 })
    const eth = makeIface({ ifType: 6, ifSpeed: 1_000_000_000 })
    expect(pickBestInterface([loopback, eth])).toBe(eth)
  })
  it('skips operationally down interfaces (ifOperStatus != 1)', () => {
    const down = makeIface({ ifOperStatus: 2, ifSpeed: 10_000_000_000 })
    const up = makeIface({ ifOperStatus: 1, ifSpeed: 1_000_000 })
    expect(pickBestInterface([down, up])).toBe(up)
  })
  it('returns the highest-speed interface', () => {
    const slow = makeIface({ ifSpeed: 100_000_000 })
    const fast = makeIface({ ifSpeed: 10_000_000_000 })
    expect(pickBestInterface([slow, fast])).toBe(fast)
  })
  it('returns null if all interfaces are loopback or down', () => {
    const loopback = makeIface({ ifType: 24 })
    const down = makeIface({ ifOperStatus: 2 })
    expect(pickBestInterface([loopback, down])).toBeNull()
  })
})
