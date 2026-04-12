import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'opennms-edge-label-config'

export const useEdgeLabelStore = defineStore('edgeLabelStore', () => {
  const _load = (): Record<string, unknown> => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
  }

  const _saved = _load()

  const showUtilization = ref<boolean>((_saved.showUtilization as boolean) ?? true)
  const showLocalPort   = ref<boolean>((_saved.showLocalPort   as boolean) ?? false)
  const showRemotePort  = ref<boolean>((_saved.showRemotePort  as boolean) ?? false)
  const showIp          = ref<boolean>((_saved.showIp          as boolean) ?? false)
  const showMac         = ref<boolean>((_saved.showMac         as boolean) ?? false)
  const showSpeed       = ref<boolean>((_saved.showSpeed       as boolean) ?? false)
  const colorMode       = ref<'protocol' | 'utilization' | 'capacity'>(
    _saved.colorMode === 'protocol' ? 'protocol'
    : _saved.colorMode === 'capacity' ? 'capacity'
    : 'utilization'
  )

  watch([showUtilization, showLocalPort, showRemotePort, showIp, showMac, showSpeed, colorMode], () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      showUtilization: showUtilization.value,
      showLocalPort:   showLocalPort.value,
      showRemotePort:  showRemotePort.value,
      showIp:          showIp.value,
      showMac:         showMac.value,
      showSpeed:       showSpeed.value,
      colorMode:       colorMode.value
    }))
  })

  return { showUtilization, showLocalPort, showRemotePort, showIp, showMac, showSpeed, colorMode }
})
