// ui/tests/composables/useResourceGraphs.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createTestingPinia } from '@pinia/testing'
import useResourceGraphs from '@/composables/useResourceGraphs'
import * as resourceService from '@/services/resourceService'
import * as graphService from '@/services/graphService'
import type { Resource, ResourceDefinitionsApiResponse } from '@/types'
import type { SavedChart } from '@/types/resourceGraphs'

const mockChild: Resource = {
  id: 'node[1].nodeSnmp[]', label: 'SNMP Node Data', name: 'nodeSnmp',
  typeLabel: 'SNMP Node Data', parentId: 'node[1]', link: '',
  rrdGraphAttributes: { cpuRawUser: {}, memAvailReal: {} },
  externalValueAttributes: {}, stringPropertyAttributes: {}
}

const mockTopResource: Resource = {
  id: 'node[1]', label: 'node1', name: 'node[1]',
  typeLabel: 'Node', parentId: null, link: '',
  rrdGraphAttributes: {}, externalValueAttributes: {}, stringPropertyAttributes: {},
  children: { resource: [mockChild], count: 1, offset: 0, totalCount: 1 }
}

const mockDefs: ResourceDefinitionsApiResponse = {
  name: ['nodeSnmp.cpuPercentage', 'nodeSnmp.memoryUsage'],
  count: 2, offset: 0, totalCount: 2
}

describe('useResourceGraphs', () => {
  beforeEach(() => {
    createTestingPinia()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  test('fetches resources and builds highlights', async () => {
    vi.spyOn(resourceService, 'getResourceForNode').mockResolvedValue(mockTopResource)
    vi.spyOn(graphService, 'getGraphDefinitionsByResourceId').mockResolvedValue(mockDefs)

    const wrapper = mount(defineComponent({
      setup() { return useResourceGraphs('1') },
      template: '<div />'
    }))

    expect(wrapper.vm.loading).toBe(true)
    await new Promise(r => setTimeout(r, 0))

    expect(wrapper.vm.loading).toBe(false)
    expect(wrapper.vm.error).toBeNull()
    expect(wrapper.vm.resources).toHaveLength(1)
    expect(wrapper.vm.resources[0].id).toBe('node[1].nodeSnmp[]')
    expect(wrapper.vm.highlights).toEqual([
      { resourceId: 'node[1].nodeSnmp[]', definition: 'nodeSnmp.cpuPercentage', label: 'SNMP Node Data' },
      { resourceId: 'node[1].nodeSnmp[]', definition: 'nodeSnmp.memoryUsage',   label: 'SNMP Node Data' }
    ])
  })

  test('sets error when resource fetch fails', async () => {
    vi.spyOn(resourceService, 'getResourceForNode').mockResolvedValue(null)

    const wrapper = mount(defineComponent({
      setup() { return useResourceGraphs('1') },
      template: '<div />'
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(wrapper.vm.error).toBe('Could not load resources for this node')
    expect(wrapper.vm.resources).toHaveLength(0)
    expect(wrapper.vm.highlights).toHaveLength(0)
  })

  test('saveChart appends to savedCharts and writes localStorage', async () => {
    vi.spyOn(resourceService, 'getResourceForNode').mockResolvedValue(mockTopResource)
    vi.spyOn(graphService, 'getGraphDefinitionsByResourceId').mockResolvedValue(mockDefs)

    const wrapper = mount(defineComponent({
      setup() { return useResourceGraphs('1') },
      template: '<div />'
    }))
    await new Promise(r => setTimeout(r, 0))

    const chart: SavedChart = { id: 'abc', nodeId: '1', title: 'My Chart', series: [], createdAt: 1000 }
    wrapper.vm.saveChart(chart)

    expect(wrapper.vm.savedCharts).toHaveLength(1)
    expect(wrapper.vm.savedCharts[0].id).toBe('abc')
    const stored = JSON.parse(localStorage.getItem('resource-charts:1') ?? '[]')
    expect(stored[0].id).toBe('abc')
  })

  test('deleteChart removes from savedCharts and localStorage', async () => {
    const chart: SavedChart = { id: 'abc', nodeId: '1', title: 'My Chart', series: [], createdAt: 1000 }
    localStorage.setItem('resource-charts:1', JSON.stringify([chart]))

    vi.spyOn(resourceService, 'getResourceForNode').mockResolvedValue(mockTopResource)
    vi.spyOn(graphService, 'getGraphDefinitionsByResourceId').mockResolvedValue(mockDefs)

    const wrapper = mount(defineComponent({
      setup() { return useResourceGraphs('1') },
      template: '<div />'
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(wrapper.vm.savedCharts).toHaveLength(1)
    wrapper.vm.deleteChart('abc')
    expect(wrapper.vm.savedCharts).toHaveLength(0)
    const stored = JSON.parse(localStorage.getItem('resource-charts:1') ?? '[]')
    expect(stored).toHaveLength(0)
  })

  test('loads saved charts from localStorage synchronously on init', () => {
    const chart: SavedChart = { id: 'xyz', nodeId: '1', title: 'Saved', series: [], createdAt: 500 }
    localStorage.setItem('resource-charts:1', JSON.stringify([chart]))

    vi.spyOn(resourceService, 'getResourceForNode').mockResolvedValue(mockTopResource)
    vi.spyOn(graphService, 'getGraphDefinitionsByResourceId').mockResolvedValue(mockDefs)

    const wrapper = mount(defineComponent({
      setup() { return useResourceGraphs('1') },
      template: '<div />'
    }))

    // savedCharts is populated synchronously before the async fetch
    expect(wrapper.vm.savedCharts).toHaveLength(1)
    expect(wrapper.vm.savedCharts[0].id).toBe('xyz')
  })
})
