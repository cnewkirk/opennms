import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import useNodeDetail from '@/composables/useNodeDetail'
import * as nodeService from '@/services/nodeService'

const mockNode = {
  id: '1', label: 'test-node', location: 'Default', type: 'A',
  foreignSource: 'test', foreignId: 'node1', createTime: 0,
  sysName: 'test', sysDescription: '', sysContact: '', sysLocation: '',
  sysObjectId: '.1.3', categories: [], assetRecord: {} as any, primaryInterface: 0
}

describe('useNodeDetail', () => {
  beforeEach(() => {
    createTestingPinia()
    vi.restoreAllMocks()
  })

  test('fetches node and sets loading states correctly', async () => {
    vi.spyOn(nodeService, 'getNodeById' as any).mockResolvedValue(mockNode)

    const wrapper = mount(defineComponent({
      setup() { return useNodeDetail('1') },
      template: '<div />'
    }))

    // loading starts true
    expect(wrapper.vm.loading).toBe(true)
    await wrapper.vm.$nextTick()
    await new Promise(r => setTimeout(r, 0))

    expect(wrapper.vm.node).toEqual(mockNode)
    expect(wrapper.vm.loading).toBe(false)
    expect(wrapper.vm.error).toBeNull()
  })

  test('sets error when fetch fails', async () => {
    vi.spyOn(nodeService, 'getNodeById' as any).mockResolvedValue(false)

    const wrapper = mount(defineComponent({
      setup() { return useNodeDetail('1') },
      template: '<div />'
    }))
    await new Promise(r => setTimeout(r, 0))

    expect(wrapper.vm.node).toBeNull()
    expect(wrapper.vm.error).toBe('Failed to load node details')
  })
})
