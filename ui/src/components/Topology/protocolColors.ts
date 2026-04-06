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

const FALLBACK_COLOR = '#718096'

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
