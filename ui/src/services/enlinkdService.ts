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

export interface NodeEnlinkdData {
  lldpLinkNodes: LldpLink[]
  ospfLinkNodes: OspfLink[]
  isisLinkNodes: IsisLink[]
  lldpElementNode: LldpElem | null
  ospfElementNode: OspfElem | null
  isisElementNode: IsisElem | null
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
