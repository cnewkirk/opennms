import { describe, test, expect } from 'vitest'
import RrdGraphConverter from '@/components/Resources/utils/RrdGraphConverter.class'

const resourceId = 'node[1].interfaceSnmp[eth0-000000000000]'

// Minimal graph definition as returned by /rest/graphs/<name>
// Title and vertical-label come from the command string, not the top-level fields
const defOnlyGraphDef = {
  propertiesValues: [],
  columns: ['ifInOctets', 'ifOutOctets'],
  command:
    '--start {rrdstart} --end {rrdend} ' +
    '--title="Interface Throughput" ' +
    '--vertical-label=Bytes/s ' +
    'DEF:a={rrd1}:ifInOctets:AVERAGE ' +
    'DEF:b={rrd2}:ifOutOctets:AVERAGE ' +
    'LINE1:a#0000ff:"In" ' +
    'LINE1:b#ff0000:"Out"'
}

// Graph definition with a CDEF that references a DEF
const cdefGraphDef = {
  propertiesValues: [],
  columns: ['ifInOctets'],
  command:
    '--start {rrdstart} --end {rrdend} ' +
    '--title="Interface bps" ' +
    '--vertical-label=Bits/s ' +
    'DEF:a={rrd1}:ifInOctets:AVERAGE ' +
    'CDEF:bps=a,8,* ' +
    'LINE1:bps#0000ff:"In bps"'
}

describe('RrdGraphConverter.toPersesGraphSpec()', () => {
  describe('DEF-only graphs', () => {
    test('produces one source per DEF', () => {
      const converter = new RrdGraphConverter({ graphDef: defOnlyGraphDef, resourceId })
      const spec = converter.toPersesGraphSpec()

      expect(spec.query.batch).toBe(true)
      expect(spec.query.sources).toHaveLength(2)
      expect(spec.query.sources[0]).toMatchObject({
        attribute: 'ifInOctets',
        resourceId,
        aggregation: 'AVERAGE',
        label: 'a'
      })
      expect(spec.query.sources[1]).toMatchObject({
        attribute: 'ifOutOctets',
        resourceId,
        aggregation: 'AVERAGE',
        label: 'b'
      })
    })

    test('produces no expressions for DEF-only graphs', () => {
      const converter = new RrdGraphConverter({ graphDef: defOnlyGraphDef, resourceId })
      const spec = converter.toPersesGraphSpec()

      expect(spec.query.expressions).toHaveLength(0)
    })

    test('maps LINE series to seriesOverrides with type=line and color', () => {
      const converter = new RrdGraphConverter({ graphDef: defOnlyGraphDef, resourceId })
      const spec = converter.toPersesGraphSpec()

      expect(spec.seriesOverrides).toHaveLength(2)
      expect(spec.seriesOverrides[0]).toMatchObject({ name: 'In', color: '#0000ff', type: 'line' })
      expect(spec.seriesOverrides[1]).toMatchObject({ name: 'Out', color: '#ff0000', type: 'line' })
    })

    test('sets title and yAxisLabel from graph definition', () => {
      const converter = new RrdGraphConverter({ graphDef: defOnlyGraphDef, resourceId })
      const spec = converter.toPersesGraphSpec()

      expect(spec.title).toBe('Interface Throughput')
      expect(spec.yAxisLabel).toBe('Bytes/s')
    })
  })

  describe('CDEF graphs', () => {
    test('places DEF as source and CDEF as expression', () => {
      const converter = new RrdGraphConverter({ graphDef: cdefGraphDef, resourceId })
      const spec = converter.toPersesGraphSpec()

      expect(spec.query.sources).toHaveLength(1)
      expect(spec.query.sources[0]).toMatchObject({
        attribute: 'ifInOctets',
        resourceId,
        label: 'a'
      })

      expect(spec.query.expressions).toHaveLength(1)
      expect(spec.query.expressions[0]).toMatchObject({ label: 'bps' })
      expect(spec.query.expressions[0].value).toContain('a')
    })

    test('marks the DEF source as transient when only the CDEF is rendered', () => {
      const converter = new RrdGraphConverter({ graphDef: cdefGraphDef, resourceId })
      const spec = converter.toPersesGraphSpec()

      // DEF 'a' is only used to build the CDEF — it is transient
      expect(spec.query.sources[0].transient).toBe(true)
      // CDEF 'bps' IS rendered — not transient
      expect(spec.query.expressions[0].transient).toBe(false)
    })
  })
})
