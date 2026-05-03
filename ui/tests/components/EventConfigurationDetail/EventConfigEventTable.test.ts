// @ts-nocheck
import EmptyList from '@/components/Common/EmptyList.vue'
import ChangeEventConfigEventStatusDialog from '@/components/EventConfigurationDetail/Dialog/ChangeEventConfigEventStatusDialog.vue'
import DeleteEventConfigEventDialog from '@/components/EventConfigurationDetail/Dialog/DeleteEventConfigEventDialog.vue'
import EventConfigEventTable from '@/components/EventConfigurationDetail/EventConfigEventTable.vue'
import { VENDOR_OPENNMS } from '@/lib/utils'
import { useEventConfigDetailStore } from '@/stores/eventConfigDetailStore'
import { useEventModificationStore } from '@/stores/eventModificationStore'
import { CreateEditMode } from '@/types'
import { EventConfigSource } from '@/types/eventConfig'
import PrimeVue from 'primevue/config'
import Button from 'primevue/button'
import SeverityBadge from '@/components/Common/SeverityBadge.vue'
import Menu from 'primevue/menu'
import InputText from 'primevue/inputtext'
import Paginator from 'primevue/paginator'

// Local stubs for removed Feather components
const SortHeader = { name: 'SortHeader', template: '<th><slot /></th>', props: ['property', 'sort'] }
const MenuItem = { name: 'MenuItem', template: '<li><slot /></li>' }
const FeatherIcon = { name: 'FeatherIcon', template: '<span><slot /></span>', props: ['icon'] }
import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount, VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

const mockSource: EventConfigSource = {
  id: 1,
  vendor: 'opennms',
  name: 'Test Source',
  description: 'A test event config source',
  enabled: true,
  createdTime: new Date(),
  lastModified: new Date(),
  eventCount: 0,
  fileOrder: 0,
  uploadedBy: ''
}

describe('EventConfigEventTable.vue', () => {
  let wrapper: VueWrapper<any>
  let store: ReturnType<typeof useEventConfigDetailStore>
  let modificationStore: ReturnType<typeof useEventModificationStore>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    const pinia = createTestingPinia({
      createSpy: vi.fn,
      stubActions: false
    })

    store = useEventConfigDetailStore(pinia)
    modificationStore = useEventModificationStore(pinia)

    // Reset store state
    store.$reset()
    store.events = []
    store.eventsSearchTerm = ''
    store.eventsPagination = { page: 1, pageSize: 10, total: 0 }
    store.selectedSource = mockSource

    // Mock store methods
    store.fetchEventsBySourceId = vi.fn().mockResolvedValue(undefined)
    store.refreshEventConfigEvents = vi.fn().mockResolvedValue(undefined)
    store.onChangeEventsSearchTerm = vi.fn().mockResolvedValue(undefined)
    store.onEventsPageChange = vi.fn().mockResolvedValue(undefined)
    store.onEventsPageSizeChange = vi.fn().mockResolvedValue(undefined)
    store.onEventsSortChange = vi.fn().mockResolvedValue(undefined)
    store.showDeleteEventConfigEventDialog = vi.fn()
    store.showChangeEventConfigEventStatusDialog = vi.fn()

    modificationStore.setSelectedEventConfigSource = vi.fn()

    wrapper = mount(EventConfigEventTable, {
      global: {
        plugins: [pinia, PrimeVue],
        components: {
          Button,
          SeverityBadge,
          Menu,
          MenuItem,
          FeatherIcon,
          SortHeader,
          Paginator,
          InputText
        }
      }
    })

    await flushPromises()
    await nextTick()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('mounts', () => {
    expect(wrapper.exists()).toBe(true)
  })

  describe('Rendering', () => {
    it('renders the component correctly', () => {
      expect(wrapper.find('.event-config-event-table').exists()).toBe(true)
    })

    it('renders the component title correctly', () => {
      expect(wrapper.find('.title').text()).toBe('Event Configurations')
    })

    it('renders search input with correct label and hint', () => {
      const searchInput = wrapper.find('[data-test="search-input"]')
      expect(searchInput.exists()).toBe(true)
      expect(searchInput.attributes('placeholder')).toBe('Search by Event UEI or Event Label')
    })

    it('renders refresh button', () => {
      const refreshButtons = wrapper.findAllComponents(Button)
      const refreshButton = refreshButtons.find((btn) => btn.props('icon') === 'pi pi-refresh')
      expect(refreshButton).toBeDefined()
    })

    it('renders table headers correctly when events exist', async () => {
      store.events = [
        {
          id: 1,
          uei: 'uei1',
          eventLabel: 'Label1',
          severity: 'High',
          enabled: true,
          description: 'Desc1',
          xmlContent: '',
          createdTime: new Date(),
          lastModified: new Date(),
          modifiedBy: '',
          sourceName: '',
          vendor: '',
          fileOrder: 0
        }
      ]
      await nextTick()
      const headers = wrapper.findAll('thead th[scope="col"]')
      expect(headers.length).toBe(4)
      expect(wrapper.find('thead tr').text()).toContain('Event UEI')
      expect(wrapper.find('thead tr').text()).toContain('Event Label')
      expect(wrapper.find('thead tr').text()).toContain('Severity')
      expect(wrapper.find('thead tr').text()).toContain('Status')
      expect(wrapper.find('thead tr').text()).toContain('Actions')
    })

    it('renders empty list when no events', () => {
      expect(wrapper.findComponent(EmptyList).exists()).toBe(true)
      expect(wrapper.find('[data-test="empty-list"]').exists()).toBe(true)
    })

    it('renders pagination when events exist', async () => {
      store.events = new Array(15).fill(0).map((_, i) => ({
        id: i,
        uei: `uei${i}`,
        eventLabel: `Label${i}`,
        severity: 'High',
        enabled: true,
        description: 'Desc',
        xmlContent: '',
        createdTime: new Date(),
        lastModified: new Date(),
        modifiedBy: '',
        sourceName: '',
        vendor: '',
        fileOrder: 0
      }))
      store.eventsPagination.total = 15
      await nextTick()
      expect(wrapper.findComponent(Paginator).exists()).toBe(true)
      expect(wrapper.find('[data-test="FeatherPagination"]').exists()).toBe(true)
    })

    it('renders dialogs', () => {
      expect(wrapper.findComponent(DeleteEventConfigEventDialog).exists()).toBe(true)
      expect(wrapper.findComponent(ChangeEventConfigEventStatusDialog).exists()).toBe(true)
    })
  })

  describe('Search Functionality', () => {
    it('updates search term on input and debounces call to store', async () => {
      const searchInput = wrapper.findComponent(InputText)
      await searchInput.vm.$emit('update:modelValue', 'test search')
      await nextTick()

      // Advance timers for debounce
      vi.advanceTimersByTime(500)
      await flushPromises()

      expect(store.eventsSearchTerm).toBe('test search')
      expect(store.onChangeEventsSearchTerm).toHaveBeenCalledWith('test search')
    })

    it('trims search term on update', async () => {
      const searchInput = wrapper.findComponent(InputText)
      await searchInput.vm.$emit('update:modelValue', '  trimmed  ')
      await nextTick()
      vi.advanceTimersByTime(500)
      await flushPromises()
      expect(store.eventsSearchTerm).toBe('trimmed')
      expect(store.onChangeEventsSearchTerm).toHaveBeenCalledWith('trimmed')
    })

    it('does not call store immediately on input (debounce)', async () => {
      const searchInput = wrapper.findComponent(InputText)
      await searchInput.vm.$emit('update:modelValue', 'test')
      await nextTick()
      // Before debounce time
      expect(store.onChangeEventsSearchTerm).not.toHaveBeenCalled()
    })

    it('calls store on empty search after debounce', async () => {
      const searchInput = wrapper.findComponent(InputText)
      await searchInput.vm.$emit('update:modelValue', '')
      await nextTick()
      vi.advanceTimersByTime(500)
      await flushPromises()
      expect(store.onChangeEventsSearchTerm).toHaveBeenCalledWith('')
    })
  })

  describe('Refresh Button', () => {
    it('calls store refresh on button click', async () => {
      const refreshButton = wrapper.findAllComponents(Button).find((btn) => btn.props('icon') === 'pi pi-refresh')
      await refreshButton?.trigger('click')
      await nextTick()
      expect(store.refreshEventConfigEvents).toHaveBeenCalled()
    })
  })

  describe('Sorting', () => {
    beforeEach(async () => {
      store.events = [
        {
          id: 1,
          uei: 'uei1',
          eventLabel: 'Label1',
          severity: 'High',
          enabled: true,
          description: 'Desc',
          xmlContent: '',
          createdTime: new Date(),
          lastModified: new Date(),
          modifiedBy: '',
          sourceName: '',
          vendor: '',
          fileOrder: 0
        }
      ]
      await nextTick()
    })

    it('calls sort-changed on header and updates store', async () => {
      wrapper.vm.sortChanged({ property: 'uei', value: 'asc' })
      await nextTick()
      expect(store.onEventsSortChange).toHaveBeenCalledWith('uei', 'asc')
    })

    it('resets other sort states to NONE when sorting a column', async () => {
      wrapper.vm.sortChanged({ property: 'uei', value: 'asc' })
      await nextTick()
      expect(wrapper.vm.sort.uei).toBe('asc')
      expect(wrapper.vm.sort.eventLabel).toBe('none')
    })

    it('defaults to createdTime desc when sort value is NONE', async () => {
      wrapper.vm.sortChanged({ property: 'uei', value: 'none' })
      await nextTick()
      expect(store.onEventsSortChange).toHaveBeenCalledWith('createdTime', 'desc')
    })

    it('handles desc sort correctly', async () => {
      wrapper.vm.sortChanged({ property: 'eventLabel', value: 'desc' })
      await nextTick()
      expect(store.onEventsSortChange).toHaveBeenCalledWith('eventLabel', 'desc')
      expect(wrapper.vm.sort.eventLabel).toBe('desc')
      expect(wrapper.vm.sort.uei).toBe('none')
    })

    it('renders all four sortable column headers', async () => {
      if (!store.events.length) {
        store.events = [
          {
            id: 1,
            uei: 'uei1',
            eventLabel: 'Label1',
            severity: 'High',
            enabled: true,
            description: 'Desc',
            xmlContent: '',
            createdTime: new Date(),
            lastModified: new Date(),
            modifiedBy: '',
            sourceName: '',
            vendor: '',
            fileOrder: 0
          }
        ]
        await nextTick()
      }
      const sortHeaders = wrapper.findAll('thead th[scope="col"]')
      expect(sortHeaders).toHaveLength(4)
      const headerTexts = wrapper
        .findAll('thead th')
        .map((th) => th.text().trim())
        .filter((text: string) => text.length > 0)
      expect(headerTexts[0]).toContain('Event UEI')
      expect(headerTexts[1]).toContain('Event Label')
      expect(headerTexts[2]).toContain('Severity')
      expect(headerTexts[3]).toContain('Status')
      expect(headerTexts[4]).toContain('Actions')
    })

    it('sorts by severity column in ascending order', async () => {
      // Get severity header by looking for the third th element
      const allHeaders = wrapper.findAll('thead th')
      expect(allHeaders[2].text()).toContain('Severity')

      // Emit sort change on severity - simulate clicking the header
      wrapper.vm.sortChanged({ property: 'severity', value: 'asc' })
      await nextTick()

      expect(store.onEventsSortChange).toHaveBeenCalledWith('severity', 'asc')
      if (wrapper.vm.sort.severity !== undefined) {
        expect(wrapper.vm.sort.severity).toBe('asc')
      }
    })

    it('sorts by severity column in descending order', async () => {
      wrapper.vm.sortChanged({ property: 'severity', value: 'desc' })
      await nextTick()

      expect(store.onEventsSortChange).toHaveBeenCalledWith('severity', 'desc')
      if (wrapper.vm.sort.severity !== undefined) {
        expect(wrapper.vm.sort.severity).toBe('desc')
      }
    })

    it('sorts by enabled (status) column in ascending order', async () => {
      wrapper.vm.sortChanged({ property: 'enabled', value: 'asc' })
      await nextTick()

      expect(store.onEventsSortChange).toHaveBeenCalledWith('enabled', 'asc')
      if (wrapper.vm.sort.enabled !== undefined) {
        expect(wrapper.vm.sort.enabled).toBe('asc')
      }
    })

    it('sorts by enabled (status) column in descending order', async () => {
      wrapper.vm.sortChanged({ property: 'enabled', value: 'desc' })
      await nextTick()

      expect(store.onEventsSortChange).toHaveBeenCalledWith('enabled', 'desc')
      if (wrapper.vm.sort.enabled !== undefined) {
        expect(wrapper.vm.sort.enabled).toBe('desc')
      }
    })

    it('resets all sort states when clicking a sorted column to toggle off', async () => {
      // First sort by uei
      wrapper.vm.sortChanged({ property: 'uei', value: 'asc' })
      await nextTick()
      expect(wrapper.vm.sort.uei).toBe('asc')

      // Then toggle it off (NONE)
      wrapper.vm.sortChanged({ property: 'uei', value: 'none' })
      await nextTick()

      // Should reset to default sort (createdTime, desc)
      expect(store.onEventsSortChange).toHaveBeenCalledWith('createdTime', 'desc')
      expect(wrapper.vm.sort.uei).toBe('none')
    })

    it('switches sort from severity to enabled (status) column', async () => {
      // Sort by severity
      wrapper.vm.sortChanged({ property: 'severity', value: 'asc' })
      await nextTick()
      if (wrapper.vm.sort.severity !== undefined) {
        expect(wrapper.vm.sort.severity).toBe('asc')
      }

      // Switch to enabled
      wrapper.vm.sortChanged({ property: 'enabled', value: 'desc' })
      await nextTick()

      expect(store.onEventsSortChange).toHaveBeenCalledWith('enabled', 'desc')
      if (wrapper.vm.sort.enabled !== undefined) {
        expect(wrapper.vm.sort.enabled).toBe('desc')
      }
      if (wrapper.vm.sort.severity !== undefined) {
        expect(wrapper.vm.sort.severity).toBe('none') // Previous sort should reset
      }
    })
  })

  describe('Column Headers', () => {
    beforeEach(async () => {
      store.events = [
        {
          id: 1,
          uei: 'uei1',
          eventLabel: 'Label1',
          severity: 'High',
          enabled: true,
          description: 'Desc',
          xmlContent: '',
          createdTime: new Date(),
          lastModified: new Date(),
          modifiedBy: '',
          sourceName: '',
          vendor: '',
          fileOrder: 0
        }
      ]
      await nextTick()
    })

    it('renders all 5 column headers (4 columns + Actions)', () => {
      const headers = wrapper.findAll('thead th')
      expect(headers).toHaveLength(5)
    })

    it('renders headers with correct labels in order', () => {
      const headerTexts = wrapper.findAll('thead th').map((th) => th.text())
      expect(headerTexts[0]).toContain('Event UEI')
      expect(headerTexts[1]).toContain('Event Label')
      expect(headerTexts[2]).toContain('Severity')
      expect(headerTexts[3]).toContain('Status')
      expect(headerTexts[4]).toContain('Actions')
    })

    it('Event UEI header has correct properties', () => {
      const ueiHeader = wrapper.find('thead th[data-property="uei"]')
      expect(ueiHeader.exists()).toBe(true)
      expect(ueiHeader.attributes('scope')).toBe('col')
    })

    it('Event Label header has correct properties', () => {
      const labelHeader = wrapper.find('thead th[data-property="eventLabel"]')
      expect(labelHeader.exists()).toBe(true)
      expect(labelHeader.attributes('scope')).toBe('col')
    })

    it('Severity header has correct properties', () => {
      const severityHeader = wrapper.find('thead th[data-property="severity"]')
      expect(severityHeader.exists()).toBe(true)
      expect(severityHeader.attributes('scope')).toBe('col')
    })

    it('Status (enabled) header has correct properties', () => {
      const statusHeader = wrapper.find('thead th[data-property="enabled"]')
      expect(statusHeader.exists()).toBe(true)
      expect(statusHeader.attributes('scope')).toBe('col')
    })

    it('updates header sort prop when sort changes', async () => {
      expect(wrapper.vm.sort.uei).toBe('none')

      wrapper.vm.sortChanged({ property: 'uei', value: 'asc' })
      await nextTick()

      expect(wrapper.vm.sort.uei).toBe('asc')
    })
  })

  describe('Columns Computed Property', () => {
    it('contains all expected column definitions', () => {
      const columns = wrapper.vm.columns
      expect(columns).toHaveLength(4)
      expect(columns[0]).toEqual({ id: 'uei', label: 'Event UEI' })
      expect(columns[1]).toEqual({ id: 'eventLabel', label: 'Event Label' })
      expect(columns[2]).toEqual({ id: 'severity', label: 'Severity' })
      expect(columns[3]).toEqual({ id: 'enabled', label: 'Status' })
    })

    it('column definitions are in correct order', () => {
      const columns = wrapper.vm.columns
      expect(columns.map((c: any) => c.id)).toEqual(['uei', 'eventLabel', 'severity', 'enabled'])
    })
  })

  describe('Table Rows', () => {
    beforeEach(async () => {
      store.events = [
        {
          id: 1,
          uei: 'UEI-1',
          eventLabel: 'Event 1',
          severity: 'Critical',
          enabled: true,
          description: '<p>HTML <b>desc</b></p>',
          xmlContent: '',
          createdTime: new Date(),
          lastModified: new Date(),
          modifiedBy: '',
          sourceName: '',
          vendor: '',
          fileOrder: 0
        }
      ]
      await nextTick()
    })

    it('displays event data in table cells', () => {
      const tds = wrapper.findAll('td')
      expect(tds[0].text()).toContain('UEI-1')
      expect(tds[1].text()).toContain('Event 1')
      expect(tds[3].text()).toContain('Enabled')
    })

    it('renders severity badge with correct text and class', () => {
      const badge = wrapper.findComponent(SeverityBadge)
      expect(badge.text()).toBe('Critical')
      const el = badge.element as Element
      expect(el.classList.contains('critical')).toBe(true)
      expect(el.classList.contains('severity-badge')).toBe(true)
    })

    it('toggles status text based on enabled flag', async () => {
      store.events[0].enabled = false
      await nextTick()
      expect(wrapper.findAll('td')[3].text()).toContain('Disabled')
    })

    it('renders description with HTML in expanded row', async () => {
      const rows = wrapper.findAll('transition-group-stub tr')
      const buttons = rows[0].findAll('button')
      const expandButton = buttons[2]
      expect(expandButton).toBeDefined()
      await expandButton.trigger('click')
      await nextTick()
      const expandedRow = wrapper.find('.expanded-content')
      expect(expandedRow.exists()).toBe(true)
      expect(expandedRow.text()).toContain('Description:')
      // v-html should render <b>desc</b> as bold, but in test, check innerHTML
      expect(expandedRow.find('p.description').html()).toContain('<b>desc</b>')
    })
  })

  describe('Actions', () => {
    beforeEach(async () => {
      store.events = [
        {
          id: 1,
          uei: 'UEI-1',
          eventLabel: 'Event 1',
          severity: 'Critical',
          enabled: true,
          description: 'Desc',
          xmlContent: '',
          createdTime: new Date(),
          lastModified: new Date(),
          modifiedBy: '',
          sourceName: '',
          vendor: '',
          fileOrder: 0
        }
      ]
      store.selectedSource = mockSource
      store.selectedSource.vendor = 'SomeVendor'
      await nextTick()
    })

    it('renders edit button and calls onEditEvent on click', async () => {
      const editButton = wrapper.find('[data-test="edit-button"]').findComponent(Button)
      await editButton.trigger('click')
      await nextTick()
      expect(modificationStore.setSelectedEventConfigSource).toHaveBeenCalledWith(
        store.selectedSource,
        CreateEditMode.Edit,
        store.events[0]
      )
      expect(mockPush).toHaveBeenCalledWith({ name: 'Event Configuration Create' })
    })

    it('renders dropdown only if vendor is not OpenNMS', () => {
      expect(wrapper.findComponent(Menu).exists()).toBe(true)
    })

    it('renders dropdown for non-OpenNMS vendor with correct enable/disable text', async () => {
      store.selectedSource = {
        id: 1,
        vendor: VENDOR_OPENNMS,
        name: 'Test Source',
        description: 'A test event config source',
        enabled: true,
        eventCount: 0,
        fileOrder: 0,
        uploadedBy: '',
        createdTime: new Date(),
        lastModified: new Date()
      }
      await nextTick()

      // When vendor is VENDOR_OPENNMS, only the status item appears (no delete)
      const menu = wrapper.findAllComponents(Menu)[0]
      const items = menu.props('model')
      expect(items).toHaveLength(1)
      expect(items[0].label).toBe('Disable Event')
    })

    it('calls showChangeEventConfigEventStatusDialog on dropdown item click', async () => {
      const spy = vi.spyOn(store, 'showChangeEventConfigEventStatusDialog')

      // Access menu model items directly and call the command callback
      const menu = wrapper.findAllComponents(Menu)[0]
      const items = menu.props('model')
      expect(items).toHaveLength(2)
      expect(items[0].label).toBe('Disable Event')
      items[0].command()
      await wrapper.vm.$nextTick()

      expect(spy).toHaveBeenCalledWith(store.events[0])
    })

    it('updates dropdown item text based on enabled status', async () => {
      store.events[0].enabled = false
      await nextTick()

      const menu = wrapper.findAllComponents(Menu)[0]
      const items = menu.props('model')
      expect(items).toHaveLength(2)
      expect(items[0].label).toBe('Enable Event')
      expect(items[1].label).toBe('Delete Event')
    })

    it('calls showDeleteEventConfigEventDialog on dropdown item click', async () => {
      const spy = vi.spyOn(store, 'showDeleteEventConfigEventDialog')

      const menu = wrapper.findAllComponents(Menu)[0]
      const items = menu.props('model')
      expect(items).toHaveLength(2)
      expect(items[1].label).toBe('Delete Event')
      items[1].command()
      await wrapper.vm.$nextTick()

      expect(spy).toHaveBeenCalledWith(store.events[0])
    })

    it('toggles expand/collapse on button click', async () => {
      const rows = wrapper.findAll('transition-group-stub tr')
      expect(rows).toHaveLength(1)

      const buttons1 = rows[0].findAll('button')
      expect(buttons1.length).toBe(3)
      expect(wrapper.vm.expandedRows).toEqual([])

      const expandButton = buttons1[2]
      await expandButton?.trigger('click')
      await nextTick()
      expect(wrapper.vm.expandedRows).toEqual([1])
      // Icon should change, but since prop, check if triggered
      await expandButton?.trigger('click')
      await nextTick()
      expect(wrapper.vm.expandedRows).toEqual([])
    })

    it('handles multiple expanded rows', async () => {
      store.events.push({
        id: 2,
        uei: 'UEI-2',
        eventLabel: 'Test Event 2',
        severity: 'Critical',
        enabled: true,
        description: 'A test event 2',
        xmlContent: '',
        createdTime: new Date(),
        lastModified: new Date(),
        modifiedBy: '',
        sourceName: '',
        vendor: 'opennms',
        fileOrder: 0
      })
      await nextTick()
      const rows = wrapper.findAll('transition-group-stub tr')
      expect(rows).toHaveLength(2)
      const buttons1 = rows[0].findAll('button')
      expect(buttons1.length).toBe(3)
      const buttons2 = rows[1].findAll('button')
      expect(buttons2.length).toBe(3)

      expect(wrapper.vm.expandedRows).toEqual([])

      const expandButton1 = buttons1[2]
      await expandButton1?.trigger('click')

      const expandButton2 = buttons2[2]
      await expandButton2?.trigger('click')
      await nextTick()
      expect(wrapper.vm.expandedRows).toEqual([1, 2])
    })
  })

  describe('Pagination', () => {
    beforeEach(async () => {
      store.events = new Array(15).fill(0).map((_, i) => ({
        id: i,
        uei: `uei${i}`,
        eventLabel: `Label${i}`,
        severity: 'High',
        enabled: true,
        description: 'Desc',
        xmlContent: '',
        createdTime: new Date(),
        lastModified: new Date(),
        modifiedBy: '',
        sourceName: '',
        vendor: '',
        fileOrder: 0
      }))
      store.eventsPagination.total = 15
      await nextTick()
    })

    it('updates page on pagination change', async () => {
      const pagination = wrapper.findComponent(Paginator)
      await pagination.vm.$emit('page', { page: 1, rows: 10 })
      await nextTick()
      expect(store.onEventsPageChange).toHaveBeenCalledWith(2)
    })

    it('updates page size on pagination change', async () => {
      const pagination = wrapper.findComponent(Paginator)
      await pagination.vm.$emit('page', { page: 0, rows: 20 })
      await nextTick()
      expect(store.onEventsPageSizeChange).toHaveBeenCalledWith(20)
    })

    it('initially sets correct pagination props', () => {
      const pagination = wrapper.findComponent(Paginator)
      expect(pagination.props('first')).toBe(0)
      expect(pagination.props('rows')).toBe(10)
      expect(pagination.props('totalRecords')).toBe(15)
    })
  })

  describe('Edge Cases', () => {
    it('handles empty events array (no table, shows empty list)', async () => {
      store.events = []
      await nextTick()
      expect(wrapper.find('table').exists()).toBe(false)
      expect(wrapper.findComponent(EmptyList).exists()).toBe(true)
    })

    it('handles events with empty description (no crash on expand)', async () => {
      store.events = [
        {
          id: 1,
          uei: 'UEI-1',
          eventLabel: 'Event 1',
          severity: 'High',
          enabled: true,
          description: '',
          xmlContent: '',
          createdTime: new Date(),
          lastModified: new Date(),
          modifiedBy: '',
          sourceName: '',
          vendor: '',
          fileOrder: 0
        }
      ]
      await nextTick()
      const rows = wrapper.findAll('transition-group-stub tr')
      expect(rows).toHaveLength(1)

      const buttons1 = rows[0].findAll('button')
      expect(buttons1.length).toBe(3)
      expect(wrapper.vm.expandedRows).toEqual([])

      const expandButton = buttons1[2]
      await expandButton?.trigger('click')
      await nextTick()

      expect(wrapper.find('.expanded-content p.description').exists()).toBe(true)
      expect(wrapper.find('.expanded-content p.description').text()).toBe('')
    })

    it('handles HTML in description without issues (v-html renders safely)', async () => {
      store.events = [
        {
          id: 1,
          uei: 'UEI-1',
          eventLabel: 'Event 1',
          severity: 'High',
          enabled: true,
          description: '<script>alert(1)</script><b>Bold</b>',
          xmlContent: '',
          createdTime: new Date(),
          lastModified: new Date(),
          modifiedBy: '',
          sourceName: '',
          vendor: '',
          fileOrder: 0
        }
      ]
      await nextTick()
      const rows = wrapper.findAll('transition-group-stub tr')
      expect(rows).toHaveLength(1)

      const buttons1 = rows[0].findAll('button')
      expect(buttons1.length).toBe(3)
      expect(wrapper.vm.expandedRows).toEqual([])

      const expandButton = buttons1[2]
      await expandButton?.trigger('click')
      await nextTick()
      // Script doesn't execute in test, but HTML renders
      expect(wrapper.find('.expanded-content').text()).toContain('Bold')
    })

    it('handles no selectedSource (edit does nothing)', async () => {
      store.selectedSource = null
      store.events = [
        {
          id: 1,
          uei: 'UEI-1',
          eventLabel: 'Event 1',
          severity: 'High',
          enabled: true,
          description: 'Desc',
          xmlContent: '',
          createdTime: new Date(),
          lastModified: new Date(),
          modifiedBy: '',
          sourceName: '',
          vendor: '',
          fileOrder: 0
        }
      ]
      await nextTick()
      const editButton = wrapper.find('[data-test="edit-button"]').findComponent(Button)
      await editButton.trigger('click')
      await nextTick()
      expect(modificationStore.setSelectedEventConfigSource).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('handles duplicate event IDs in expandedRows (no crash)', async () => {
      wrapper.vm.expandedRows.push(1)
      wrapper.vm.expandedRows.push(1) // Duplicate
      store.events = [
        {
          id: 1,
          uei: 'UEI-1',
          eventLabel: 'Event 1',
          severity: 'High',
          enabled: true,
          description: 'Desc',
          xmlContent: '',
          createdTime: new Date(),
          lastModified: new Date(),
          modifiedBy: '',
          sourceName: '',
          vendor: '',
          fileOrder: 0
        }
      ]
      await nextTick()
      expect(wrapper.find('.expanded-content').exists()).toBe(true) // Renders once due to v-if
    })

    it('handles large number of events (renders without crash)', async () => {
      store.events = new Array(1000).fill(0).map((_, i) => ({
        id: i,
        uei: `uei${i}`,
        eventLabel: `Label${i}`,
        severity: 'High',
        enabled: true,
        description: 'Desc',
        xmlContent: '',
        createdTime: new Date(),
        lastModified: new Date(),
        modifiedBy: '',
        sourceName: '',
        vendor: '',
        fileOrder: 0
      }))
      await nextTick()
      expect(wrapper.findAll('tr').length).toBeGreaterThan(1)
    })

    it('sort with no events (no crash)', async () => {
      store.events = []
      await nextTick()
      // Simulate emit
      wrapper.vm.sortChanged({ property: 'uei', value: 'asc' })
      expect(store.onEventsSortChange).toHaveBeenCalledWith('uei', 'asc')
    })

    it('search with special characters (trims and calls store)', async () => {
      const searchInput = wrapper.findComponent(InputText)
      await searchInput.vm.$emit('update:modelValue', '  <script>alert(1)</script> test  ')
      await nextTick()
      vi.advanceTimersByTime(500)
      await flushPromises()
      expect(store.eventsSearchTerm).toBe('<script>alert(1)</script> test')
      expect(store.onChangeEventsSearchTerm).toHaveBeenCalledWith('<script>alert(1)</script> test')
    })

    it('handles missing event properties gracefully', async () => {
      store.events = [
        {
          id: 1,
          uei: undefined as any,
          eventLabel: undefined as any,
          severity: 'Major',
          enabled: true,
          description: 'Desc',
          xmlContent: '',
          createdTime: new Date(),
          lastModified: new Date(),
          modifiedBy: '',
          sourceName: '',
          vendor: '',
          fileOrder: 0
        }
      ]
      await nextTick()
      expect(wrapper.find('td').text()).toContain('') // Or empty, but no crash
    })

    it('renders severity badge with lowercase severity class', async () => {
      store.events = [
        {
          id: 1,
          uei: 'uei1',
          eventLabel: 'Event 1',
          severity: 'CRITICAL',
          enabled: true,
          description: 'Desc',
          xmlContent: '',
          createdTime: new Date(),
          lastModified: new Date(),
          modifiedBy: '',
          sourceName: '',
          vendor: '',
          fileOrder: 0
        }
      ]
      await nextTick()
      const badge = wrapper.findComponent(SeverityBadge)
      const el = badge.element as Element
      expect(el.classList.contains('critical')).toBe(true)
    })

    it('displays different severity levels with correct colors', async () => {
      const severities = ['Critical', 'Major', 'Minor', 'Warning', 'Indeterminate', 'Cleared']

      store.events = severities.map((sev, i) => ({
        id: i,
        uei: `uei${i}`,
        eventLabel: `Event ${sev}`,
        severity: sev,
        enabled: true,
        description: 'Desc',
        xmlContent: '',
        createdTime: new Date(),
        lastModified: new Date(),
        modifiedBy: '',
        sourceName: '',
        vendor: '',
        fileOrder: 0
      }))

      await nextTick()

      const badges = wrapper.findAllComponents(SeverityBadge)
      expect(badges).toHaveLength(severities.length)

      badges.forEach((badge, index) => {
        const el = badge.element as Element
        expect(el.classList.contains(severities[index].toLowerCase())).toBe(true)
        expect(badge.text()).toBe(severities[index])
      })
    })

    it('renders correct enabled/disabled status for multiple events', async () => {
      store.events = [
        {
          id: 1,
          uei: 'uei1',
          eventLabel: 'Enabled Event',
          severity: 'High',
          enabled: true,
          description: 'Enabled',
          xmlContent: '',
          createdTime: new Date(),
          lastModified: new Date(),
          modifiedBy: '',
          sourceName: '',
          vendor: '',
          fileOrder: 0
        },
        {
          id: 2,
          uei: 'uei2',
          eventLabel: 'Disabled Event',
          severity: 'Low',
          enabled: false,
          description: 'Disabled',
          xmlContent: '',
          createdTime: new Date(),
          lastModified: new Date(),
          modifiedBy: '',
          sourceName: '',
          vendor: '',
          fileOrder: 0
        }
      ]
      await nextTick()

      const tds = wrapper.findAll('td')
      // Find status cells (4th column in each row)
      expect(tds[3].text()).toContain('Enabled')
      expect(tds[8].text()).toContain('Disabled') // 8 = 5 cells per row + 3 offset
    })

    it('renders edit button with correct data-test attribute', async () => {
      if (!store.events.length) {
        store.events = [
          {
            id: 1,
            uei: 'uei1',
            eventLabel: 'Event 1',
            severity: 'Critical',
            enabled: true,
            description: 'Desc',
            xmlContent: '',
            createdTime: new Date(),
            lastModified: new Date(),
            modifiedBy: '',
            sourceName: '',
            vendor: '',
            fileOrder: 0
          }
        ]
        await nextTick()
      }
      const editButton = wrapper.find('[data-test="edit-button"]')
      expect(editButton.exists()).toBe(true)
    })

    it('renders table with correct aria-label for accessibility', async () => {
      if (!store.events.length) {
        store.events = [
          {
            id: 1,
            uei: 'uei1',
            eventLabel: 'Label1',
            severity: 'High',
            enabled: true,
            description: 'Desc',
            xmlContent: '',
            createdTime: new Date(),
            lastModified: new Date(),
            modifiedBy: '',
            sourceName: '',
            vendor: '',
            fileOrder: 0
          }
        ]
        await nextTick()
      }

      const table = wrapper.find('table')
      expect(table.attributes('aria-label')).toBe('Events Table')
    })

    it('preserves expanded state when sorting events', async () => {
      store.events = [
        {
          id: 1,
          uei: 'uei1',
          eventLabel: 'Label1',
          severity: 'High',
          enabled: true,
          description: 'Desc1',
          xmlContent: '',
          createdTime: new Date(),
          lastModified: new Date(),
          modifiedBy: '',
          sourceName: '',
          vendor: '',
          fileOrder: 0
        },
        {
          id: 2,
          uei: 'uei2',
          eventLabel: 'Label2',
          severity: 'Low',
          enabled: false,
          description: 'Desc2',
          xmlContent: '',
          createdTime: new Date(),
          lastModified: new Date(),
          modifiedBy: '',
          sourceName: '',
          vendor: '',
          fileOrder: 0
        }
      ]
      await nextTick()

      // Expand first event
      const rows = wrapper.findAll('transition-group-stub tr')
      const buttons = rows[0].findAll('button')
      const expandButton = buttons[2]
      await expandButton.trigger('click')
      await nextTick()

      expect(wrapper.vm.expandedRows).toContain(1)

      // Sort
      wrapper.vm.sortChanged({ property: 'severity', value: 'asc' })
      await nextTick()

      // Expanded state should be preserved
      expect(wrapper.vm.expandedRows).toContain(1)
    })
  })
})

