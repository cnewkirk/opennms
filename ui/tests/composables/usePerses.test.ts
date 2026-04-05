import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

// Mock ReactDOM to avoid JSDOM React rendering issues in tests
vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({
    render: vi.fn(),
    unmount: vi.fn()
  }))
}))
vi.mock('react', () => ({
  createElement: vi.fn(() => ({})),
  default: { createElement: vi.fn(() => ({})) }
}))

import { usePerses } from '@/composables/usePerses'
import * as ReactDOM from 'react-dom/client'

describe('usePerses', () => {
  test('creates root when container ref is set', async () => {
    const containerRef = ref<HTMLElement | null>(null)
    const specRef = ref({ kind: 'TimeSeriesChart', spec: {} })

    mount(defineComponent({
      setup() {
        usePerses(containerRef, specRef, vi.fn())
        return {}
      },
      template: '<div />'
    }))

    const div = document.createElement('div')
    containerRef.value = div
    await nextTick()

    expect(ReactDOM.createRoot).toHaveBeenCalledWith(div)
  })

  test('unmounts on component unmount', async () => {
    const mockUnmount = vi.fn()
    vi.mocked(ReactDOM.createRoot).mockReturnValue({ render: vi.fn(), unmount: mockUnmount } as any)

    const containerRef = ref<HTMLElement | null>(null)
    const specRef = ref({ kind: 'TimeSeriesChart', spec: {} })

    const wrapper = mount(defineComponent({
      setup() {
        usePerses(containerRef, specRef, vi.fn())
        return {}
      },
      template: '<div />'
    }))

    containerRef.value = document.createElement('div')
    await nextTick()

    wrapper.unmount()
    expect(mockUnmount).toHaveBeenCalled()
  })
})
