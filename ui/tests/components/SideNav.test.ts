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

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/dashboard' }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' }
}))

describe('SideNav collapse state', () => {
  let fakeShell: { classList: { toggle: ReturnType<typeof vi.fn> } }

  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Reinstate the querySelector mock AFTER clearAllMocks so it's fresh each test
    fakeShell = { classList: { toggle: vi.fn() } }
    vi.spyOn(document, 'querySelector').mockReturnValue(fakeShell as any)
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

  it('toggles collapsed state on button click and notifies app shell', async () => {
    const wrapper = mount(SideNav)
    await wrapper.find('.sidenav__toggle').trigger('click')
    expect(wrapper.classes()).toContain('sidenav--collapsed')
    expect(store['onms.sidenav.collapsed']).toBe('true')
    expect(fakeShell.classList.toggle).toHaveBeenCalledWith('sidenav-collapsed', true)
  })

  it('persists expanded state after toggle back and notifies app shell', async () => {
    store['onms.sidenav.collapsed'] = 'true'
    const wrapper = mount(SideNav)
    await wrapper.find('.sidenav__toggle').trigger('click')
    expect(wrapper.classes()).not.toContain('sidenav--collapsed')
    expect(store['onms.sidenav.collapsed']).toBe('false')
    expect(fakeShell.classList.toggle).toHaveBeenCalledWith('sidenav-collapsed', false)
  })
})
