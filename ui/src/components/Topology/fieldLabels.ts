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
 * Explicit label overrides for known API property names and protocol namespace identifiers.
 *
 * IMPORTANT: The regex fallback in humanize() only works for clean camelCase English words.
 * Any key containing acronyms (OSPF, BGP, IS-IS), abbreviations, or non-English terms
 * MUST be added here — the fallback will mangle them.
 * Convention: when adding a new field to the topology UI, add its label here at the same time.
 */
export const FIELD_LABELS: Record<string, string> = {
  // Protocol namespace identifiers
  lldp: 'LLDP',
  ospf: 'OSPF',
  isis: 'IS-IS',
  bgp: 'BGP',
  mpls: 'MPLS',
  cdp: 'CDP',
  // Edge label fields from weathermap/enlinkd data
  ospfArea: 'OSPF Area',
  ifName: 'Interface',
  ifDescr: 'Interface Description',
  ifSpeed: 'Speed',
  ipAddress: 'IP Address',
  localIp: 'Local IP',
  remoteIp: 'Remote IP',
  localIfName: 'Local Interface',
  remotePortId: 'Remote Port',
  localMac: 'MAC Address'
}

/**
 * Return a human-readable label for an API property name or protocol key.
 * Checks FIELD_LABELS first; falls back to splitting camelCase/kebab/snake.
 * The fallback is a last resort — always prefer adding entries to FIELD_LABELS.
 */
export function humanize(key: string): string {
  return FIELD_LABELS[key]
    ?? key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
}
