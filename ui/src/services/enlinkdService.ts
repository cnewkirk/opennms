///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

import { v2 } from './axiosInstances'

export interface LldpLink {
  lldpLocalPort: string
  lldpLocalPortUrl: string
  lldpRemChassisId: string
  lldpRemChassisIdUrl: string
  lldpRemInfo: string
  ldpRemPort: string      // API typo — missing leading 'l'
  lldpCreateTime: string
  lldpLastPollTime: string
}

export interface LldpElem {
  lldpChassisId: string
  lldpSysName: string
  lldpCreateTime: string
  lldpLastPollTime: string
}

export interface OspfLink {
  ospfLocalPort?: string
  ospfLocalPortUrl?: string
  ospfRemRouterId: string
  ospfRemRouterUrl: string
  ospfRemPort: string
  ospfRemPortUrl: string
  ospfLinkInfo: string
  ospfLinkCreateTime: string
  ospfLinkLastPollTime: string
}

export interface OspfElem {
  ospfRouterId: string
  ospfVersionNumber: number
  ospfAdminStat: string
  ospfCreateTime: string
  ospfLastPollTime: string
}

export interface IsisLink {
  isisCircIfIndex: number
  isisCircAdminState: string
  isisISAdjNeighSysID: string
  isisISAdjNeighSysType: string
  isisISAdjNeighSNPAAddress: string
  isisISAdjNeighPort: string
  isisISAdjState: string
  isisISAdjNbrExtendedCircID: number
  isisISAdjUrl: string
  isisLinkCreateTime: string
  isisLinkLastPollTime: string
}

export interface IsisElem {
  isisSysID: string
  isisSysAdminState: string
  isisCreateTime: string
  isisLastPollTime: string
}

export interface CdpLink {
  cdpLocalPort: string
  cdpLocalPortUrl: string
  cdpCacheDevice: string
  cdpCacheDeviceUrl: string
  cdpCacheDevicePort: string
  cdpCacheDevicePortUrl: string
  cdpCachePlatform: string
  cdpCreateTime: string
  cdpLastPollTime: string
}

export interface BridgeRemote {
  bridgeRemote: string
  bridgeRemoteUrl: string
  bridgeRemotePort: string
  bridgeRemotePortUrl: string
}

export interface BridgeLink {
  bridgeLocalPort: string
  bridgeLocalPortUrl: string
  bridgeLinkRemoteNodes: BridgeRemote[]
  bridgeInfo: string
  bridgeLinkCreateTime: string
  bridgeLinkLastPollTime: string
}

export interface NodeEnlinkdData {
  lldpLinkNodes: LldpLink[]
  ospfLinkNodes: OspfLink[]
  isisLinkNodes: IsisLink[]
  cdpLinkNodes: CdpLink[]
  bridgeLinkNodes: BridgeLink[]
  lldpElementNode: LldpElem | null
  ospfElementNode: OspfElem | null
  isisElementNode: IsisElem | null
}

export interface NormalizedLink {
  protocol: 'LLDP' | 'OSPF' | 'IS-IS' | 'CDP' | 'Bridge'
  localPort: string
  remoteNode: string
  remotePort: string
}

export interface GroupedLink {
  localPort: string
  remoteNode: string
  remotePort: string
  protocols: NormalizedLink['protocol'][]
}

const PROTOCOL_PRIORITY: NormalizedLink['protocol'][] = ['LLDP', 'CDP', 'OSPF', 'IS-IS', 'Bridge']

export const groupLinks = (links: NormalizedLink[]): GroupedLink[] => {
  const byPort = new Map<string, NormalizedLink[]>()
  for (const link of links) {
    const bucket = byPort.get(link.localPort) ?? []
    bucket.push(link)
    byPort.set(link.localPort, bucket)
  }
  return Array.from(byPort.values()).map(group => {
    const sorted = [...group].sort(
      (a, b) => PROTOCOL_PRIORITY.indexOf(a.protocol) - PROTOCOL_PRIORITY.indexOf(b.protocol)
    )
    const best = sorted[0]
    return {
      localPort: best.localPort,
      remoteNode: best.remoteNode,
      remotePort: best.remotePort,
      protocols: sorted.map(l => l.protocol)
    }
  })
}

export const normalizeLinks = (data: NodeEnlinkdData): NormalizedLink[] => {
  const out: NormalizedLink[] = []

  for (const l of data.lldpLinkNodes)
    out.push({ protocol: 'LLDP', localPort: l.lldpLocalPort, remoteNode: l.lldpRemInfo, remotePort: l.ldpRemPort })

  for (const l of data.cdpLinkNodes)
    out.push({ protocol: 'CDP', localPort: l.cdpLocalPort, remoteNode: l.cdpCacheDevice, remotePort: l.cdpCacheDevicePort })

  for (const l of data.ospfLinkNodes)
    out.push({ protocol: 'OSPF', localPort: l.ospfLocalPort ?? '—', remoteNode: l.ospfRemRouterId, remotePort: l.ospfRemPort })

  for (const l of data.isisLinkNodes)
    out.push({ protocol: 'IS-IS', localPort: String(l.isisCircIfIndex), remoteNode: l.isisISAdjNeighSysID, remotePort: l.isisISAdjNeighPort })

  for (const l of data.bridgeLinkNodes)
    for (const r of l.bridgeLinkRemoteNodes)
      out.push({ protocol: 'Bridge', localPort: l.bridgeLocalPort, remoteNode: r.bridgeRemote, remotePort: r.bridgeRemotePort })

  return out
}

export const getNodeEnlinkd = async (nodeId: number): Promise<NodeEnlinkdData | null> => {
  try {
    const resp = await v2.get(`/enlinkd/${nodeId}`)
    if (resp.status === 204) return null
    const d = resp.data
    return {
      lldpLinkNodes: d.lldpLinkNodes ?? [],
      ospfLinkNodes: d.ospfLinkNodes ?? [],
      isisLinkNodes: d.isisLinkNodes ?? [],
      cdpLinkNodes: d.cdpLinkNodes ?? [],
      bridgeLinkNodes: d.bridgeLinkNodes ?? [],
      lldpElementNode: d.lldpElementNode ?? null,
      ospfElementNode: d.ospfElementNode ?? null,
      isisElementNode: d.isisElementNode ?? null
    }
  } catch {
    return null
  }
}

/** Extract the `node=` value from an enlinkd href like "element/linkednode.jsp?node=6" */
export const extractNodeId = (url: string): string | null =>
  url.match(/node=(\d+)/)?.[1] ?? null
