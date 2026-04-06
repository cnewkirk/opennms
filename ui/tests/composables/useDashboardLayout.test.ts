import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

// gridstack is a DOM library — mock it entirely in unit tests
vi.mock('gridstack', () => {
  const mockGrid = {
    on: vi.fn(),
    destroy: vi.fn(),
    makeWidget: vi.fn(),
    removeWidget: vi.fn(),
    batchUpdate: vi.fn(),
    commit: vi.fn()
  }
  return {
    GridStack: {
      init: vi.fn(() => mockGrid)
    }
  }
})

import { GridStack } from 'gridstack'
import useDashboardLayout from '@/composables/useDashboardLayout'
import { defaultConfig } from '@/services/dashboardConfigService'

describe('useDashboardLayout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  test('initializes gridstack on mount', () => {
    const container = ref<HTMLElement | null>(document.createElement('div'))
    const widgets = ref(defaultConfig().widgets)
    const onLayoutChange = vi.fn()

    mount(defineComponent({
      setup() {
        useDashboardLayout(container, widgets, onLayoutChange)
        return {}
      },
      template: '<div />'
    }))

    expect(GridStack.init).toHaveBeenCalledOnce()
  })

  test('destroys gridstack on unmount', async () => {
    const container = ref<HTMLElement | null>(document.createElement('div'))
    const widgets = ref(defaultConfig().widgets)

    const wrapper = mount(defineComponent({
      setup() {
        useDashboardLayout(container, widgets, vi.fn())
        return {}
      },
      template: '<div />'
    }))

    // Get the mock grid that was created during this component's mount
    const { GridStack: GS } = await import('gridstack')
    const mockGrid = (GS.init as ReturnType<typeof vi.fn>).mock.results[0]?.value

    wrapper.unmount()
    expect(mockGrid.destroy).toHaveBeenCalled()
  })

  test('registers change and resize handlers on init', () => {
    const container = ref<HTMLElement | null>(document.createElement('div'))
    const widgets = ref(defaultConfig().widgets)

    mount(defineComponent({
      setup() {
        useDashboardLayout(container, widgets, vi.fn())
        return {}
      },
      template: '<div />'
    }))

    // GridStack is already the mocked version from the top-level import
    const mockGrid = (GridStack.init as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value

    const events = (mockGrid.on as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) => c[0])
    expect(events).toContain('change')
    expect(events).toContain('resizestop')
  })
})
