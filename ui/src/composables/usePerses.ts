import { watch, onUnmounted, type Ref } from 'vue'
import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'

type PanelSpec = { kind: string; spec: Record<string, unknown> }

/**
 * Mounts a React Perses component into a Vue-managed container element.
 *
 * @param containerRef - ref to the DOM element to mount into
 * @param specRef      - reactive panel spec; re-renders React when changed
 * @param renderFn     - returns the React element to render
 */
export function usePerses(
  containerRef: Ref<HTMLElement | null>,
  specRef: Ref<PanelSpec>,
  renderFn: (spec: PanelSpec) => ReturnType<typeof createElement>
): { rerender: () => void } {
  let root: Root | null = null

  watch([containerRef, specRef], ([el, spec], [prevEl]) => {
    if (!el) return
    if (root && el !== prevEl) {
      root.unmount()
      root = null
    }
    if (!root) {
      root = createRoot(el)
    }
    root.render(renderFn(spec))
  }, { deep: true })

  onUnmounted(() => {
    root?.unmount()
    root = null
  })

  function rerender() {
    if (root && specRef.value) {
      root.render(renderFn(specRef.value))
    }
  }

  return { rerender }
}
