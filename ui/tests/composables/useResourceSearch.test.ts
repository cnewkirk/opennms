import { describe, test, expect } from 'vitest'
import { searchResources } from '@/composables/useResourceSearch'
import type { ResourceGroup } from '@/types/resourceGraphs'

const groups: ResourceGroup[] = [
  {
    typeLabel: 'SNMP Interface Data',
    resources: [
      { resourceId: 'node[1].interfaceSnmp[eth0]', label: 'eth0', definitions: ['ifOctets', 'ifErrors'] },
      { resourceId: 'node[1].interfaceSnmp[lo]',   label: 'lo',   definitions: ['ifOctets'] }
    ]
  },
  {
    typeLabel: 'Response Time',
    resources: [
      { resourceId: 'node[1].responseTime[192.168.1.1]', label: '192.168.1.1', definitions: ['icmp'] }
    ]
  }
]

describe('searchResources', () => {
  test('returns empty array for empty query', () => {
    expect(searchResources(groups, '')).toEqual([])
    expect(searchResources(groups, '  ')).toEqual([])
  })

  test('matches on resource label — returns all definitions for that resource', () => {
    const r = searchResources(groups, 'eth0')
    expect(r).toHaveLength(2)
    expect(r.every(x => x.resourceLabel === 'eth0')).toBe(true)
    expect(r.map(x => x.definition)).toEqual(['ifOctets', 'ifErrors'])
  })

  test('matches on definition name — returns only the matching definition', () => {
    const r = searchResources(groups, 'ifErrors')
    expect(r).toHaveLength(1)
    expect(r[0].definition).toBe('ifErrors')
    expect(r[0].resourceLabel).toBe('eth0')
  })

  test('matches on type label — returns all definitions for all resources in that type', () => {
    const r = searchResources(groups, 'snmp interface')
    expect(r).toHaveLength(3) // eth0/ifOctets, eth0/ifErrors, lo/ifOctets
  })

  test('is case-insensitive', () => {
    expect(searchResources(groups, 'ETH0')).toHaveLength(2)
    expect(searchResources(groups, 'ICMP')).toHaveLength(1)
  })

  test('returns empty array when nothing matches', () => {
    expect(searchResources(groups, 'xyzzy')).toEqual([])
  })

  test('caps results at 50', () => {
    const big: ResourceGroup[] = [{
      typeLabel: 'Big',
      resources: [{
        resourceId: 'r1',
        label: 'r1',
        definitions: Array.from({ length: 100 }, (_, i) => `def${i}`)
      }]
    }]
    expect(searchResources(big, 'def')).toHaveLength(50)
  })
})
