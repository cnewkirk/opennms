import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import Events from '@/containers/Events.vue'

vi.mock('@/services/eventService', () => ({
  getEvents: vi.fn().mockResolvedValue({
    event: [
      {
        id: 1,
        time: 1713000000000,
        severity: 'MAJOR',
        nodeId: 5,
        nodeLabel: 'router-01',
        uei: 'uei.opennms.org/threshold/highThresholdExceeded',
        logMessage: 'High threshold exceeded on router-01'
      }
    ],
    totalCount: 1
  }),
  getEventById: vi.fn().mockResolvedValue(null)
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ path: '/events' }),
  RouterLink: { template: '<a><slot /></a>' }
}))

describe('Events.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const globalStubs = {
    BreadCrumbs: true,
    DataTable: true,
    Column: true,
    InputText: true,
    RouterLink: { template: '<a><slot /></a>' }
  }

  it('renders the breadcrumb', async () => {
    const wrapper = mount(Events, { global: { stubs: globalStubs } })
    expect(wrapper.findComponent({ name: 'BreadCrumbs' }).exists()).toBe(true)
  })

  it('renders DataTable', async () => {
    const wrapper = mount(Events, { global: { stubs: globalStubs } })
    expect(wrapper.findComponent({ name: 'DataTable' }).exists()).toBe(true)
  })

  it('mounts without errors', async () => {
    const wrapper = mount(Events, { global: { stubs: globalStubs } })
    await wrapper.vm.$nextTick()
    expect(wrapper.exists()).toBe(true)
  })
})
