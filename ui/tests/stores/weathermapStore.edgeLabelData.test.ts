import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWeathermapStore, edgeKey } from '@/stores/weathermapStore'
import type { TopologyVertex, TopologyEdge } from '@/types/topology'
import * as measurementsService from '@/services/measurementsService'
import * as enlinkdService from '@/services/enlinkdService'

vi.mock('@/services/measurementsService', () => ({
  fetchNodeSnmpIfaces: vi.fn(),
  fetchNodeType: vi.fn(),
  fetchNodeIpInterfaces: vi.fn(),
  fetchInterfaceUtilization: vi.fn(),
  pickBestInterface: vi.fn()
}))

// Provide a real cleanName implementation so LLDP correlation logic is testable.
vi.mock('@/services/enlinkdService', () => ({
  getNodeEnlinkd: vi.fn(),
  cleanName: (s: string) => s.split('(')[0].trim() || s
}))
vi.mock('@/services/intervalService', () => ({
  getIntervals: vi.fn().mockResolvedValue({
    collection: { SNMP: 30_000 }, rrdStep: 300,
    enlinkd: { lldp: 7_200_000, ospf: 7_200_000, isis: 7_200_000, cdp: 7_200_000, bridge: 7_200_000, topology: 30_000 }
  }),
  getSnmpInterval: vi.fn().mockResolvedValue(30_000)
}))

const EMPTY_ENLINKD = {
  lldpLinkNodes: [], ospfLinkNodes: [], isisLinkNodes: [],
  cdpLinkNodes: [], bridgeLinkNodes: [],
  lldpElementNode: null, ospfElementNode: null, isisElementNode: null
}

const makeSnmpIface = (overrides = {}) => ({
  ifName: 'eth0', ifDescr: 'eth0', ifIndex: 1,
  ifOperStatus: 1, ifType: 6, ifSpeed: 1_000_000_000,
  physAddr: null, collect: true, collectFlag: 'C', collectionUserSpecified: false,
  hasEgressFlows: false, hasFlows: false, hasIngressFlows: false,
  id: 1, ifAdminStatus: 1, ifAlias: null, lastCapsdPoll: 0,
  lastEgressFlow: null, lastIngressFlow: null, lastSnmpPoll: 0, poll: true,
  ...overrides
})

const VERTICES: TopologyVertex[] = [
  { id: '10', label: 'node-a', namespace: 'test' },
  { id: '20', label: 'node-b', namespace: 'test' }
]
const EDGES: TopologyEdge[] = [
  { source: { id: 10, namespace: 'test' }, target: { id: 20, namespace: 'test' } }
]

describe('weathermapStore — edgeLabelData', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('exposes edgeLabelData as empty object initially', () => {
    const store = useWeathermapStore()
    expect(store.edgeLabelData).toEqual({})
  })

  it('populates localIp and remoteIp from primary IP interfaces', async () => {
    const iface = makeSnmpIface()
    vi.mocked(measurementsService.fetchNodeSnmpIfaces).mockResolvedValue([iface])
    vi.mocked(measurementsService.pickBestInterface).mockReturnValue(iface)
    vi.mocked(measurementsService.fetchNodeType).mockResolvedValue('A')
    vi.mocked(measurementsService.fetchInterfaceUtilization).mockResolvedValue(null)
    vi.mocked(enlinkdService.getNodeEnlinkd).mockResolvedValue(EMPTY_ENLINKD)
    vi.mocked(measurementsService.fetchNodeIpInterfaces)
      .mockResolvedValueOnce([{ ipAddress: '10.0.0.1', snmpPrimary: 'P' } as any])
      .mockResolvedValueOnce([{ ipAddress: '10.0.0.2', snmpPrimary: 'P' } as any])

    const store = useWeathermapStore()
    await store.start(VERTICES, EDGES)

    const key = edgeKey(10, 20)
    expect(store.edgeLabelData[key].localIp).toBe('10.0.0.1')
    expect(store.edgeLabelData[key].remoteIp).toBe('10.0.0.2')
  })

  it('localIp is undefined when no primary IP interface exists', async () => {
    const iface = makeSnmpIface()
    vi.mocked(measurementsService.fetchNodeSnmpIfaces).mockResolvedValue([iface])
    vi.mocked(measurementsService.pickBestInterface).mockReturnValue(iface)
    vi.mocked(measurementsService.fetchNodeType).mockResolvedValue('A')
    vi.mocked(measurementsService.fetchInterfaceUtilization).mockResolvedValue(null)
    vi.mocked(enlinkdService.getNodeEnlinkd).mockResolvedValue(EMPTY_ENLINKD)
    // No primary IP for node 10 — snmpPrimary is 'N'
    vi.mocked(measurementsService.fetchNodeIpInterfaces)
      .mockResolvedValueOnce([{ ipAddress: '10.0.0.5', snmpPrimary: 'N' } as any])
      .mockResolvedValueOnce([])

    const store = useWeathermapStore()
    await store.start(VERTICES, EDGES)

    expect(store.edgeLabelData[edgeKey(10, 20)].localIp).toBeUndefined()
  })

  it('populates localIfName and remotePortId from LLDP correlation', async () => {
    const iface = makeSnmpIface({ ifIndex: 1, ifName: 'eth0', physAddr: '001122334455' })
    vi.mocked(measurementsService.fetchNodeSnmpIfaces).mockResolvedValue([iface])
    vi.mocked(measurementsService.pickBestInterface).mockReturnValue(iface)
    vi.mocked(measurementsService.fetchNodeType).mockResolvedValue('A')
    vi.mocked(measurementsService.fetchNodeIpInterfaces).mockResolvedValue([])
    vi.mocked(measurementsService.fetchInterfaceUtilization).mockResolvedValue(null)
    vi.mocked(enlinkdService.getNodeEnlinkd).mockImplementation(async (nodeId: number) => {
      if (nodeId !== 10) return EMPTY_ENLINKD
      return {
        ...EMPTY_ENLINKD,
        lldpLinkNodes: [{
          lldpLocalPort: 'eth0 (ifindex:1)(macAddress:001122334455)',
          lldpLocalPortUrl: '',
          lldpRemChassisId: '',
          lldpRemChassisIdUrl: '',
          lldpRemInfo: 'node-b',
          ldpRemPort: 'GigEth0/1',
          lldpCreateTime: '',
          lldpLastPollTime: ''
        }]
      }
    })

    const store = useWeathermapStore()
    await store.start(VERTICES, EDGES)

    const key = edgeKey(10, 20)
    expect(store.edgeLabelData[key].localIfName).toBe('eth0')
    expect(store.edgeLabelData[key].remotePortId).toBe('GigEth0/1')
    expect(store.edgeLabelData[key].localMac).toBe('001122334455')
    expect(store.edgeLabelData[key].ifSpeed).toBe(1_000_000_000)
  })

  it('falls back to best interface when no LLDP match for the target node', async () => {
    const iface = makeSnmpIface({ ifIndex: 1, ifName: 'eth0', physAddr: 'aabbccddeeff' })
    vi.mocked(measurementsService.fetchNodeSnmpIfaces).mockResolvedValue([iface])
    vi.mocked(measurementsService.pickBestInterface).mockReturnValue(iface)
    vi.mocked(measurementsService.fetchNodeType).mockResolvedValue('A')
    vi.mocked(measurementsService.fetchNodeIpInterfaces).mockResolvedValue([])
    vi.mocked(measurementsService.fetchInterfaceUtilization).mockResolvedValue(null)
    vi.mocked(enlinkdService.getNodeEnlinkd).mockResolvedValue({
      ...EMPTY_ENLINKD,
      lldpLinkNodes: [{
        lldpLocalPort: 'eth0 (ifindex:1)',
        lldpLocalPortUrl: '',
        lldpRemChassisId: '',
        lldpRemChassisIdUrl: '',
        lldpRemInfo: 'some-other-node',  // doesn't match 'node-b'
        ldpRemPort: 'remote-port',
        lldpCreateTime: '',
        lldpLastPollTime: ''
      }]
    })

    const store = useWeathermapStore()
    await store.start(VERTICES, EDGES)

    const key = edgeKey(10, 20)
    expect(store.edgeLabelData[key].localIfName).toBe('eth0')
    expect(store.edgeLabelData[key].localMac).toBe('aabbccddeeff')
    expect(store.edgeLabelData[key].remotePortId).toBeUndefined()
  })
})
