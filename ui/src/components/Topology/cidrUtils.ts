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

/** Returns true if ipStr falls within the CIDR block cidrStr (e.g. "10.0.0.0/8"). */
export function ipInCidr(ipStr: string, cidrStr: string): boolean {
  const [baseStr, prefixStr] = cidrStr.split('/')
  const prefix = parseInt(prefixStr, 10)
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false
  const ipNum = ipToNum(ipStr)
  const baseNum = ipToNum(baseStr)
  if (ipNum === null || baseNum === null) return false
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
  return (ipNum & mask) === (baseNum & mask)
}

function ipToNum(ip: string): number | null {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return null
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

/** Returns true if cidrStr is a syntactically valid CIDR notation. */
export function isValidCidr(cidrStr: string): boolean {
  const [ip, prefix] = cidrStr.split('/')
  if (!ip || !prefix) return false
  const p = parseInt(prefix, 10)
  if (isNaN(p) || p < 0 || p > 32) return false
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) &&
    ip.split('.').every(o => { const n = parseInt(o, 10); return n >= 0 && n <= 255 })
}
