import { describe, test, expect } from 'vitest'
import { normalizeLinks } from '@/services/enlinkdService'
import type { NodeEnlinkdData } from '@/services/enlinkdService'

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
