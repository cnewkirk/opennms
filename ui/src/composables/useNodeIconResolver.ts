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

import { getColoredIconDataUri } from '@/components/Topology/iconRegistry'
import { useTopologyViewStore } from '@/stores/topologyViewStore'
import type { TopologyVertex } from '@/types/topology'
import type { Category } from '@/types/index'

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL:      '#ef4444',
  MAJOR:         '#f97316',
  MINOR:         '#eab308',
  WARNING:       '#f59e0b',
  NORMAL:        '#f59e0b',
  INDETERMINATE: '#6b7280',
}
const DEFAULT_COLOR = '#06b6d4'

const BUILTIN_PATTERNS: Array<{ pattern: RegExp; iconKey: string }> = [
  { pattern: /spine/i,              iconKey: 'router'        },
  { pattern: /leaf/i,               iconKey: 'switch'        },
  { pattern: /fw|fire(wall)?/i,     iconKey: 'firewall'      },
  { pattern: /lb|load.?bal/i,       iconKey: 'load-balancer' },
  { pattern: /console|oob/i,        iconKey: 'console'       },
  { pattern: /\bpdu\b/i,            iconKey: 'pdu'           },
  { pattern: /\bups\b/i,            iconKey: 'ups'           },
  { pattern: /host/i,               iconKey: 'server'        },
  { pattern: /\d+\.\d+\.\d+/,      iconKey: 'cloud'         },
]

export const useNodeIconResolver = () => {
  const viewStore = useTopologyViewStore()

  const resolveIconKey = (
    vertex: TopologyVertex,
    categories?: Category[]
  ): string => {
    const label = vertex.label ?? ''

    // Priority 1: user-defined name pattern rules
    for (const rule of viewStore.namePatternRules) {
      try {
        if (new RegExp(rule.pattern, 'i').test(label)) return rule.iconKey
      } catch {
        // invalid regex — skip
      }
    }

    // Priority 2: OpenNMS category mapping
    if (categories?.length) {
      for (const cat of categories) {
        const mapping = viewStore.categoryIconMap.find(m => m.key === cat.name)
        if (mapping?.iconKey) return mapping.iconKey
      }
    }

    // Priority 3: built-in name patterns
    for (const { pattern, iconKey } of BUILTIN_PATTERNS) {
      if (pattern.test(label)) return iconKey
    }

    // Priority 4: server as bare-metal-host fallback
    return 'server'
  }

  const resolveIconDataUri = (
    vertex: TopologyVertex,
    severity: string | null,
    categories?: Category[]
  ): string => {
    const color = severity ? (SEVERITY_COLORS[severity] ?? DEFAULT_COLOR) : DEFAULT_COLOR
    const iconKey = resolveIconKey(vertex, categories)
    return getColoredIconDataUri(iconKey, color)
  }

  return { resolveIconDataUri }
}
