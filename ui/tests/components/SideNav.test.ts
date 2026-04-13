import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import SideNav from '@/components/Shell/SideNav.vue'

const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] }
})

// stub document.querySelector for the app-shell class toggle
const fakeShell = { classList: { toggle: vi.fn() } }
vi.spyOn(document, 'querySelector').mockReturnValue(fakeShell as any)

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/dashboard' }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' }
}))

describe('SideNav collapse state', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('starts expanded by default', () => {
    const wrapper = mount(SideNav)
    expect(wrapper.classes()).not.toContain('sidenav--collapsed')
  })

  it('starts collapsed when localStorage says so', () => {
    store['onms.sidenav.collapsed'] = 'true'
    const wrapper = mount(SideNav)
    expect(wrapper.classes()).toContain('sidenav--collapsed')
  })

  it('toggles collapsed state on button click', async () => {
    const wrapper = mount(SideNav)
    await wrapper.find('.sidenav__toggle').trigger('click')
    expect(wrapper.classes()).toContain('sidenav--collapsed')
    expect(store['onms.sidenav.collapsed']).toBe('true')
  })

  it('persists expanded state after toggle back', async () => {
    store['onms.sidenav.collapsed'] = 'true'
    const wrapper = mount(SideNav)
    await wrapper.find('.sidenav__toggle').trigger('click')
    expect(wrapper.classes()).not.toContain('sidenav--collapsed')
    expect(store['onms.sidenav.collapsed']).toBe('false')
  })
})
