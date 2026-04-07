import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { useEdgeLabelStore } from '@/stores/edgeLabelStore'

describe('useEdgeLabelStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('defaults to showUtilization=true, all others false', () => {
    const store = useEdgeLabelStore()
    expect(store.showUtilization).toBe(true)
    expect(store.showLocalPort).toBe(false)
    expect(store.showRemotePort).toBe(false)
    expect(store.showIp).toBe(false)
    expect(store.showMac).toBe(false)
    expect(store.showSpeed).toBe(false)
  })

  it('persists changes to localStorage', async () => {
    const store = useEdgeLabelStore()
    store.showLocalPort = true
    await nextTick()
    const saved = JSON.parse(localStorage.getItem('opennms-edge-label-config') ?? '{}')
    expect(saved.showLocalPort).toBe(true)
    expect(saved.showUtilization).toBe(true)
  })

  it('restores all fields from localStorage on init', () => {
    localStorage.setItem('opennms-edge-label-config', JSON.stringify({
      showUtilization: false,
      showLocalPort: true,
      showRemotePort: false,
      showIp: true,
      showMac: false,
      showSpeed: true
    }))
    setActivePinia(createPinia())
    const store = useEdgeLabelStore()
    expect(store.showUtilization).toBe(false)
    expect(store.showLocalPort).toBe(true)
    expect(store.showIp).toBe(true)
    expect(store.showSpeed).toBe(true)
    expect(store.showRemotePort).toBe(false)
    expect(store.showMac).toBe(false)
  })

  it('handles corrupt localStorage gracefully (uses defaults)', () => {
    localStorage.setItem('opennms-edge-label-config', 'NOT_JSON')
    setActivePinia(createPinia())
    const store = useEdgeLabelStore()
    expect(store.showUtilization).toBe(true)
  })
})
