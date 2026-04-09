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

/**
 * Maps raw backend protocol/layer names to display-friendly strings.
 * Keys are lowercase with spaces and hyphens stripped.
 */
const PROTOCOL_DISPLAY_NAMES: Record<string, string> = {
  'isis':            'IS-IS',
  'iis':             'IS-IS',
  'ospf':            'OSPF',
  'ospfarea':        'OSPF',
  'bgp':             'BGP',
  'lldp':            'LLDP',
  'cdp':             'CDP',
  'cdpd':            'CDP',
  'mpls':            'MPLS',
  'arp':             'ARP',
  'networkrouter':   'IP Fwd',
  'userdefined':     'Custom',
  'layer3':          'L3',
  'layer2':          'L2',
  'layer1':          'L1',
  'layer0':          'L0',
}

export const prettifyProtocol = (protocol: string): string => {
  const key = protocol.toLowerCase().replace(/[-\s]+/g, '')
  return PROTOCOL_DISPLAY_NAMES[key] ?? protocol
}

/**
 * Fixed protocol → color palette for topology edge rendering.
 * Keys are lowercase, hyphenated protocol names.
 */
export const PROTOCOL_COLORS: Record<string, string> = {
  'lldp':         '#4C9BE8',
  'ospf':         '#48BB78',
  'is-is':        '#ED8936',
  'isis':         '#ED8936',
  'bgp':          '#9F7AEA',
  'mpls':         '#F6AD55',
  'arp':          '#68D391',
  'mac':          '#68D391',
  'cdp':          '#FC8181',
  'cdpd':         '#FC8181',
  'user-defined': '#A0AEC0'
}

export const FALLBACK_COLOR = '#718096'

/**
 * Layer-2 protocol keys (after lowercasing + stripping hyphens/spaces).
 * Used to detect edges that have no physical-layer confirmation.
 */
const L2_PROTOCOL_KEYS = new Set(['lldp', 'cdp', 'cdpd', 'arp', 'mac', 'layer2', 'layer1', 'layer0'])

/**
 * Returns true if the protocol name is a Layer-2 (physical/data-link) protocol.
 * An edge with at least one L2 protocol is physically confirmed.
 */
export const isL2Protocol = (protocol: string): boolean => {
  const key = protocol.toLowerCase().replace(/[-\s]+/g, '')
  return L2_PROTOCOL_KEYS.has(key)
}

/**
 * Returns the hex color for a given protocol name.
 * Case-insensitive. Falls back to neutral gray for unknown protocols.
 */
export const getProtocolColor = (protocol: string): string => {
  const key = protocol.toLowerCase().replace(/\s+/g, '-')
  return PROTOCOL_COLORS[key] ?? FALLBACK_COLOR
}

/**
 * Returns evenly-spaced, symmetric offsets for N parallel bezier edges.
 * n=1 → [0]  (straight)
 * n=2 → [-8, 8]
 * n=3 → [-8, 0, 8]
 */
export const parallelOffsets = (n: number): number[] => {
  if (n === 1) return [0]
  const spacing = 8
  return Array.from({ length: n }, (_, i) => Math.round((i - (n - 1) / 2) * spacing))
}

/**
 * Maps a utilization percentage (0-100) to a traffic-light color.
 */
export const utilizationColor = (pct: number): string => {
  if (pct === 0)  return '#4FD1C5'  // teal  — up, no load
  if (pct < 50)   return '#48BB78'  // green — low utilization
  if (pct < 75)   return '#ECC94B'  // yellow
  if (pct < 90)   return '#ED8936'  // orange
  return '#FC8181'                   // red   — near/over capacity
}

/**
 * Maps total throughput in bits/sec to a Cytoscape edge width in pixels.
 */
export const throughputWidth = (bitsPerSec: number): number => {
  if (bitsPerSec < 1_000_000)       return 2   // < 1 Mbps
  if (bitsPerSec < 10_000_000)      return 3   // 1–10 Mbps
  if (bitsPerSec < 100_000_000)     return 4   // 10–100 Mbps
  if (bitsPerSec < 1_000_000_000)   return 6   // 100 Mbps–1 Gbps
  return 8                                      // > 1 Gbps
}

/**
 * Formats a bits-per-second value as a short string: "230M", "1.5G", "45K", "500"
 */
export const formatBitsPerSec = (bps: number): string => {
  if (bps >= 1_000_000_000) return `${+(bps / 1_000_000_000).toPrecision(3)}G`
  if (bps >= 1_000_000)     return `${+(bps / 1_000_000).toPrecision(3)}M`
  if (bps >= 1_000)         return `${+(bps / 1_000).toPrecision(3)}K`
  return `${Math.round(bps)}`
}
