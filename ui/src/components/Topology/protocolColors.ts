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
  'user-defined': '#A0AEC0',
}

export const FALLBACK_COLOR = '#718096'

/**
 * Returns a human-readable display name for a protocol key.
 * e.g. "is-is" → "IS-IS", "user-defined" → "User Defined"
 */
export const prettifyProtocol = (protocol: string): string => {
  if (!protocol) return ''
  const upper: Record<string, string> = { 'lldp': 'LLDP', 'ospf': 'OSPF', 'bgp': 'BGP', 'mpls': 'MPLS', 'arp': 'ARP', 'mac': 'MAC', 'cdp': 'CDP', 'cdpd': 'CDPd', 'is-is': 'IS-IS', 'isis': 'IS-IS' }
  const key = protocol.toLowerCase().replace(/\s+/g, '-')
  return upper[key] ?? protocol.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
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
 * Maps a utilization percentage (0-100) to a traffic-light color.
 * Thresholds are TCP-aware: microbursts start causing drops above ~80%,
 * so orange and red bands are intentionally early.
 */
export const utilizationColor = (pct: number): string => {
  if (pct === 0)  return '#4FD1C5'  // teal   — up, no load
  if (pct < 50)   return '#48BB78'  // green  — healthy
  if (pct < 70)   return '#ECC94B'  // yellow — moderate
  if (pct < 80)   return '#ED8936'  // orange — approaching congestion
  return '#FC8181'                   // red    — microburst territory (≥80%)
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

/**
 * Maps link capacity (ifSpeed in bits/sec) to a distinct tier color.
 * Uses categorical tiers — not a gradient — so each speed class is visually
 * identifiable at a glance (all 10G links are cyan, all 1G links are green, etc.).
 * Falls back to the neutral gray fallback color when ifSpeed is 0 or unknown.
 */
export const capacityColor = (ifSpeed: number): string => {
  if (ifSpeed >= 100_000_000_000) return '#a855f7'  // 100G+ — purple
  if (ifSpeed >= 40_000_000_000)  return '#3b82f6'  // 40G   — bright blue
  if (ifSpeed >= 10_000_000_000)  return '#06b6d4'  // 10G   — cyan
  if (ifSpeed >= 1_000_000_000)   return '#22c55e'  // 1G    — green
  if (ifSpeed >= 100_000_000)     return '#eab308'  // 100M  — yellow
  return FALLBACK_COLOR                              // <100M — gray
}
