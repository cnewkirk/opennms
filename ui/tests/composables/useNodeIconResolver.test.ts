import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { useNodeIconResolver } from '@/composables/useNodeIconResolver'
import { useTopologyViewStore } from '@/stores/topologyViewStore'

// Stub iconRegistry so tests don't need actual SVG files and return inspectable strings
vi.mock('@/components/Topology/iconRegistry', () => ({
  getColoredIconDataUri: (key: string, color: string) => `data:uri:${key}:${color}`,
}))

const makeVertex = (label: string, nodeID?: string) => ({
  id: nodeID ?? '1', namespace: 'test', label, nodeID,
})

describe('useNodeIconResolver', () => {
  beforeEach(() => {
    createTestingPinia({ stubActions: false })
  })

  test('built-in pattern: spine label resolves to router', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('spine-01'), 'NORMAL')).toBe('data:uri:router:#4ade80')
  })

  test('built-in pattern: leaf label resolves to switch', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('leaf-02'), 'CRITICAL')).toBe('data:uri:switch:#ef4444')
  })

  test('built-in pattern: host label resolves to server', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('host-03'), 'NORMAL')).toBe('data:uri:server:#4ade80')
  })

  test('built-in pattern: IP prefix label resolves to cloud', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('10.88.0.0/16'), 'NORMAL')).toBe('data:uri:cloud:#4ade80')
  })

  test('built-in pattern: oob label resolves to console', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('oob-mgmt'), 'NORMAL')).toBe('data:uri:console:#4ade80')
  })

  test('built-in pattern: pdu label resolves to pdu', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('rack-pdu-01'), 'NORMAL')).toBe('data:uri:pdu:#4ade80')
  })

  test('built-in pattern: firewall label resolves to firewall', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('fw-edge-01'), 'NORMAL')).toBe('data:uri:firewall:#4ade80')
  })

  test('built-in pattern: load-balancer label resolves to load-balancer', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('lb-prod'), 'NORMAL')).toBe('data:uri:load-balancer:#4ade80')
  })

  test('built-in pattern: ups label resolves to ups', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('rack-ups-01'), 'NORMAL')).toBe('data:uri:ups:#4ade80')
  })

  test('fallback: unknown label resolves to server', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('xyzzy-unknown-42'), 'NORMAL')).toBe('data:uri:server:#4ade80')
  })

  test('category mapping overrides built-in pattern', () => {
    const store = useTopologyViewStore()
    store.categoryIconMap = [{ key: 'Routers', iconKey: 'router' }]
    const { resolveIconDataUri } = useNodeIconResolver()
    const uri = resolveIconDataUri(
      makeVertex('host-01', '10'),
      'NORMAL',
      [{ id: 1, name: 'Routers', authorizedGroups: [] }]
    )
    expect(uri).toBe('data:uri:router:#4ade80')
  })

  test('user pattern overrides category mapping', () => {
    const store = useTopologyViewStore()
    store.categoryIconMap = [{ key: 'Routers', iconKey: 'router' }]
    store.namePatternRules = [{ pattern: 'host.*', iconKey: 'firewall' }]
    const { resolveIconDataUri } = useNodeIconResolver()
    const uri = resolveIconDataUri(
      makeVertex('host-01', '10'),
      'NORMAL',
      [{ id: 1, name: 'Routers', authorizedGroups: [] }]
    )
    expect(uri).toBe('data:uri:firewall:#4ade80')
  })

  test('CRITICAL severity maps to red (#ef4444)', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('spine-01'), 'CRITICAL')).toContain('#ef4444')
  })

  test('MAJOR severity maps to orange (#f97316)', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('spine-01'), 'MAJOR')).toContain('#f97316')
  })

  test('MINOR severity maps to yellow (#eab308)', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('spine-01'), 'MINOR')).toContain('#eab308')
  })

  test('WARNING severity maps to amber (#f59e0b)', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('spine-01'), 'WARNING')).toContain('#f59e0b')
  })

  test('NORMAL severity maps to green (#4ade80)', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('spine-01'), 'NORMAL')).toContain('#4ade80')
  })

  test('INDETERMINATE severity maps to gray (#9ca3af)', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('spine-01'), 'INDETERMINATE')).toContain('#9ca3af')
  })

  test('null severity falls back to default cyan (#06b6d4)', () => {
    const { resolveIconDataUri } = useNodeIconResolver()
    expect(resolveIconDataUri(makeVertex('10.0.0.0/8'), null)).toContain('#06b6d4')
  })
})
