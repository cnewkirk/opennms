import { describe, test, expect } from 'vitest'
import { normalizeLinks, groupLinks, cleanName } from '@/services/enlinkdService'
import type { NodeEnlinkdData, NormalizedLink } from '@/services/enlinkdService'

describe('normalizeLinks', () => {
  test('returns empty array when no links exist', () => {
    const data: NodeEnlinkdData = {
      lldpLinkNodes: [], ospfLinkNodes: [], isisLinkNodes: [],
      cdpLinkNodes: [], bridgeLinkNodes: [],
      lldpElementNode: null, ospfElementNode: null, isisElementNode: null
    }
    expect(normalizeLinks(data)).toEqual([])
  })

  test('normalizes an LLDP link', () => {
    const data: NodeEnlinkdData = {
      lldpLinkNodes: [{
        lldpLocalPort: 'eth0', lldpLocalPortUrl: '',
        lldpRemChassisId: 'aa:bb', lldpRemChassisIdUrl: '',
        lldpRemInfo: 'switch-a', ldpRemPort: 'gi0/1',
        lldpCreateTime: '', lldpLastPollTime: ''
      }],
      ospfLinkNodes: [], isisLinkNodes: [], cdpLinkNodes: [], bridgeLinkNodes: [],
      lldpElementNode: null, ospfElementNode: null, isisElementNode: null
    }
    expect(normalizeLinks(data)).toEqual([
      { protocol: 'LLDP', localPort: 'eth0', remoteNode: 'switch-a', remotePort: 'gi0/1' }
    ])
  })

  test('normalizes a CDP link', () => {
    const data: NodeEnlinkdData = {
      lldpLinkNodes: [], ospfLinkNodes: [], isisLinkNodes: [],
      cdpLinkNodes: [{
        cdpLocalPort: 'fa0/1', cdpLocalPortUrl: '',
        cdpCacheDevice: 'router-b', cdpCacheDeviceUrl: '',
        cdpCacheDevicePort: 'fa0/2', cdpCacheDevicePortUrl: '',
        cdpCachePlatform: '', cdpCreateTime: '', cdpLastPollTime: ''
      }],
      bridgeLinkNodes: [],
      lldpElementNode: null, ospfElementNode: null, isisElementNode: null
    }
    expect(normalizeLinks(data)).toEqual([
      { protocol: 'CDP', localPort: 'fa0/1', remoteNode: 'router-b', remotePort: 'fa0/2' }
    ])
  })

  test('normalizes an OSPF link', () => {
    const data: NodeEnlinkdData = {
      lldpLinkNodes: [], isisLinkNodes: [], cdpLinkNodes: [], bridgeLinkNodes: [],
      ospfLinkNodes: [{
        ospfLocalPort: 'eth1', ospfLocalPortUrl: '',
        ospfRemRouterId: '10.0.0.1', ospfRemRouterUrl: '',
        ospfRemPort: 'eth0', ospfRemPortUrl: '',
        ospfLinkInfo: '', ospfLinkCreateTime: '', ospfLinkLastPollTime: ''
      }],
      lldpElementNode: null, ospfElementNode: null, isisElementNode: null
    }
    expect(normalizeLinks(data)).toEqual([
      { protocol: 'OSPF', localPort: 'eth1', remoteNode: '10.0.0.1', remotePort: 'eth0' }
    ])
  })

  test('normalizes an IS-IS link', () => {
    const data: NodeEnlinkdData = {
      lldpLinkNodes: [], ospfLinkNodes: [], cdpLinkNodes: [], bridgeLinkNodes: [],
      isisLinkNodes: [{
        isisCircIfIndex: 3, isisCircAdminState: 'on',
        isisISAdjNeighSysID: '0000.0000.0003', isisISAdjNeighSysType: 'l1',
        isisISAdjNeighSNPAAddress: '', isisISAdjNeighPort: 'Serial0',
        isisISAdjState: 'up', isisISAdjNbrExtendedCircID: 0,
        isisISAdjUrl: '', isisLinkCreateTime: '', isisLinkLastPollTime: ''
      }],
      lldpElementNode: null, ospfElementNode: null, isisElementNode: null
    }
    expect(normalizeLinks(data)).toEqual([
      { protocol: 'IS-IS', localPort: '3', remoteNode: '0000.0000.0003', remotePort: 'Serial0' }
    ])
  })

  test('normalizes bridge links — one row per remote', () => {
    const data: NodeEnlinkdData = {
      lldpLinkNodes: [], ospfLinkNodes: [], isisLinkNodes: [], cdpLinkNodes: [],
      bridgeLinkNodes: [{
        bridgeLocalPort: 'br0', bridgeLocalPortUrl: '',
        bridgeLinkRemoteNodes: [
          { bridgeRemote: 'sw-core', bridgeRemoteUrl: '', bridgeRemotePort: 'gi1', bridgeRemotePortUrl: '' }
        ],
        bridgeInfo: '', bridgeLinkCreateTime: '', bridgeLinkLastPollTime: ''
      }],
      lldpElementNode: null, ospfElementNode: null, isisElementNode: null
    }
    expect(normalizeLinks(data)).toEqual([
      { protocol: 'Bridge', localPort: 'br0', remoteNode: 'sw-core', remotePort: 'gi1' }
    ])
  })

  test('collects links from all protocols into one list', () => {
    const data: NodeEnlinkdData = {
      lldpLinkNodes: [{
        lldpLocalPort: 'eth0', lldpLocalPortUrl: '',
        lldpRemChassisId: '', lldpRemChassisIdUrl: '',
        lldpRemInfo: 'sw-a', ldpRemPort: 'gi1',
        lldpCreateTime: '', lldpLastPollTime: ''
      }],
      cdpLinkNodes: [{
        cdpLocalPort: 'eth1', cdpLocalPortUrl: '',
        cdpCacheDevice: 'rtr-b', cdpCacheDeviceUrl: '',
        cdpCacheDevicePort: 'gi2', cdpCacheDevicePortUrl: '',
        cdpCachePlatform: '', cdpCreateTime: '', cdpLastPollTime: ''
      }],
      ospfLinkNodes: [], isisLinkNodes: [], bridgeLinkNodes: [],
      lldpElementNode: null, ospfElementNode: null, isisElementNode: null
    }
    const result = normalizeLinks(data)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.protocol)).toEqual(['LLDP', 'CDP'])
  })
})

describe('groupLinks', () => {
  test('single protocol link passes through unchanged', () => {
    const links: NormalizedLink[] = [
      { protocol: 'LLDP', localPort: 'eth0', remoteNode: 'switch-a', remotePort: 'gi0/1' }
    ]
    expect(groupLinks(links)).toEqual([
      { localPort: 'eth0', remoteNode: 'switch-a', remotePort: 'gi0/1', protocols: ['LLDP'] }
    ])
  })

  test('LLDP and CDP on same port collapse to one row with two badges', () => {
    const links: NormalizedLink[] = [
      { protocol: 'LLDP', localPort: 'eth0', remoteNode: 'switch-a', remotePort: 'gi0/1' },
      { protocol: 'CDP',  localPort: 'eth0', remoteNode: 'switch-a', remotePort: 'gi0/1' }
    ]
    expect(groupLinks(links)).toEqual([
      { localPort: 'eth0', remoteNode: 'switch-a', remotePort: 'gi0/1', protocols: ['LLDP', 'CDP'] }
    ])
  })

  test('different ports stay as separate rows', () => {
    const links: NormalizedLink[] = [
      { protocol: 'LLDP', localPort: 'eth0', remoteNode: 'sw-a', remotePort: 'gi0/1' },
      { protocol: 'LLDP', localPort: 'eth1', remoteNode: 'sw-b', remotePort: 'gi0/2' }
    ]
    const result = groupLinks(links)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.localPort)).toEqual(['eth0', 'eth1'])
  })

  test('LLDP label is preferred over OSPF for same port', () => {
    const links: NormalizedLink[] = [
      { protocol: 'OSPF',  localPort: 'eth0', remoteNode: '10.0.0.1', remotePort: 'eth0' },
      { protocol: 'LLDP',  localPort: 'eth0', remoteNode: 'router-b', remotePort: 'gi1' }
    ]
    const result = groupLinks(links)
    expect(result).toHaveLength(1)
    expect(result[0].remoteNode).toBe('router-b')
    expect(result[0].protocols).toContain('LLDP')
    expect(result[0].protocols).toContain('OSPF')
  })

  test('protocols appear in priority order: LLDP CDP OSPF IS-IS Bridge', () => {
    const links: NormalizedLink[] = [
      { protocol: 'Bridge', localPort: 'eth0', remoteNode: 'x', remotePort: 'y' },
      { protocol: 'OSPF',   localPort: 'eth0', remoteNode: 'x', remotePort: 'y' },
      { protocol: 'LLDP',   localPort: 'eth0', remoteNode: 'x', remotePort: 'y' }
    ]
    expect(groupLinks(links)[0].protocols).toEqual(['LLDP', 'OSPF', 'Bridge'])
  })

  test('returns empty array for no links', () => {
    expect(groupLinks([])).toEqual([])
  })
})

describe('cleanName', () => {
  test('strips ifindex and macAddress suffixes', () => {
    expect(cleanName('eth0(ifindex:4)(macAddress:72dd31972111)')).toBe('eth0')
  })

  test('strips router id suffix', () => {
    expect(cleanName('spine-02(router id:10.255.0.12)')).toBe('spine-02')
  })

  test('strips IS-IS SysID suffix', () => {
    expect(cleanName('spine-01(ISSysID:00010aff000b)')).toBe('spine-01')
  })

  test('strips OSPF interface metadata', () => {
    expect(cleanName('eth1()(ifindex:2)(10.101.1.2)')).toBe('eth1')
  })

  test('leaves plain names unchanged', () => {
    expect(cleanName('eth0')).toBe('eth0')
    expect(cleanName('leaf-03')).toBe('leaf-03')
  })

  test('returns original if entirely parenthesized (e.g. IS-IS index)', () => {
    expect(cleanName('2')).toBe('2')
  })
})

describe('groupLinks deduplication', () => {
  test('multiple records for same port and protocol collapse to one badge', () => {
    const links: NormalizedLink[] = [
      { protocol: 'LLDP', localPort: 'eth0', remoteNode: 'leaf-03', remotePort: 'eth0' },
      { protocol: 'LLDP', localPort: 'eth0', remoteNode: 'leaf-03', remotePort: 'eth0' },
      { protocol: 'LLDP', localPort: 'eth0', remoteNode: 'leaf-03', remotePort: 'eth0' },
    ]
    const result = groupLinks(links)
    expect(result).toHaveLength(1)
    expect(result[0].protocols).toEqual(['LLDP'])
  })
})

describe('IS-IS ifindex resolution', () => {
  test('IS-IS link resolves interface index to name from LLDP data', () => {
    const data: NodeEnlinkdData = {
      lldpLinkNodes: [{
        lldpLocalPort: 'eth1(ifindex:2)(macAddress:9a36b76e31bd)', lldpLocalPortUrl: '',
        lldpRemChassisId: '', lldpRemChassisIdUrl: '',
        lldpRemInfo: 'spine-01', ldpRemPort: 'eth1',
        lldpCreateTime: '', lldpLastPollTime: ''
      }],
      isisLinkNodes: [{
        isisCircIfIndex: 2, isisCircAdminState: 'on',
        isisISAdjNeighSysID: 'spine-01', isisISAdjNeighSysType: 'l1',
        isisISAdjNeighSNPAAddress: '', isisISAdjNeighPort: 'eth1',
        isisISAdjState: 'up', isisISAdjNbrExtendedCircID: 0,
        isisISAdjUrl: '', isisLinkCreateTime: '', isisLinkLastPollTime: ''
      }],
      ospfLinkNodes: [], cdpLinkNodes: [], bridgeLinkNodes: [],
      lldpElementNode: null, ospfElementNode: null, isisElementNode: null
    }
    const grouped = groupLinks(normalizeLinks(data))
    expect(grouped).toHaveLength(1)
    expect(grouped[0].localPort).toBe('eth1')
    expect(grouped[0].protocols).toContain('LLDP')
    expect(grouped[0].protocols).toContain('IS-IS')
  })

  test('IS-IS link falls back to index string when no ifindex map entry exists', () => {
    const data: NodeEnlinkdData = {
      lldpLinkNodes: [],
      isisLinkNodes: [{
        isisCircIfIndex: 5, isisCircAdminState: 'on',
        isisISAdjNeighSysID: 'router-x', isisISAdjNeighSysType: 'l1',
        isisISAdjNeighSNPAAddress: '', isisISAdjNeighPort: 'eth0',
        isisISAdjState: 'up', isisISAdjNbrExtendedCircID: 0,
        isisISAdjUrl: '', isisLinkCreateTime: '', isisLinkLastPollTime: ''
      }],
      ospfLinkNodes: [], cdpLinkNodes: [], bridgeLinkNodes: [],
      lldpElementNode: null, ospfElementNode: null, isisElementNode: null
    }
    const result = normalizeLinks(data)
    expect(result[0].localPort).toBe('5')
  })
})
