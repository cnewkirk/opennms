import { describe, it, expect } from 'vitest'
import { humanize, FIELD_LABELS } from '@/components/Topology/fieldLabels'

describe('FIELD_LABELS', () => {
  it('maps known protocol namespace keys', () => {
    expect(FIELD_LABELS['lldp']).toBe('LLDP')
    expect(FIELD_LABELS['ospf']).toBe('OSPF')
    expect(FIELD_LABELS['isis']).toBe('IS-IS')
    expect(FIELD_LABELS['bgp']).toBe('BGP')
    expect(FIELD_LABELS['mpls']).toBe('MPLS')
    expect(FIELD_LABELS['cdp']).toBe('CDP')
  })

  it('maps known edge label field keys', () => {
    expect(FIELD_LABELS['ospfArea']).toBe('OSPF Area')
    expect(FIELD_LABELS['ifName']).toBe('Interface')
    expect(FIELD_LABELS['ifDescr']).toBe('Interface Description')
    expect(FIELD_LABELS['ifSpeed']).toBe('Speed')
    expect(FIELD_LABELS['ipAddress']).toBe('IP Address')
    expect(FIELD_LABELS['localIp']).toBe('Local IP')
    expect(FIELD_LABELS['remoteIp']).toBe('Remote IP')
    expect(FIELD_LABELS['localIfName']).toBe('Local Interface')
    expect(FIELD_LABELS['remotePortId']).toBe('Remote Port')
    expect(FIELD_LABELS['localMac']).toBe('MAC Address')
  })
})

describe('humanize()', () => {
  it('returns FIELD_LABELS value for known keys', () => {
    expect(humanize('ospfArea')).toBe('OSPF Area')
    expect(humanize('lldp')).toBe('LLDP')
    expect(humanize('localIp')).toBe('Local IP')
  })

  it('splits camelCase for unknown clean keys', () => {
    expect(humanize('nodeLabel')).toBe('Node Label')
    expect(humanize('sourceNode')).toBe('Source Node')
  })

  it('replaces hyphens and underscores with spaces', () => {
    expect(humanize('some-key')).toBe('Some Key')
    expect(humanize('some_key')).toBe('Some Key')
  })

  it('title-cases each word', () => {
    expect(humanize('foo bar')).toBe('Foo Bar')
  })

  it('uses FIELD_LABELS for acronym-heavy keys that would mangle in fallback', () => {
    // These MUST be in the map — the fallback would produce garbage
    expect(humanize('ospf')).toBe('OSPF')
    expect(humanize('bgp')).toBe('BGP')
    expect(humanize('isis')).toBe('IS-IS')
  })
})
