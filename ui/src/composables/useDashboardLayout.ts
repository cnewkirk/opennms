///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

import { GridStack, type GridItemHTMLElement, type GridStackNode, type GridStackOptions } from 'gridstack'
import 'gridstack/dist/gridstack.min.css'
import { onMounted, onUnmounted, type Ref } from 'vue'

const GRID_OPTIONS: GridStackOptions = {
  column: 12,
  cellHeight: 150,
  margin: 16,
  animate: true,
  handle: '.widget-drag-handle',
  resizable: { handles: 'se' }
}

/**
 * Reusable composable for gridstack drag+drop/resize grids.
 *
 * Usage:
 *   const { addItem, removeItem } = useDashboardLayout(containerRef, onLayoutChange)
 *
 * @param containerRef - ref to the gridstack container div
 * @param onLayoutChange - called with updated GridStackNode[] on every drag/resize
 */
const useDashboardLayout = (
  containerRef: Ref<HTMLElement | null>,
  onLayoutChange: (items: GridStackNode[]) => void
) => {
  let grid: ReturnType<typeof GridStack.init> | null = null

  onMounted(() => {
    if (!containerRef.value) return

    grid = GridStack.init(GRID_OPTIONS, containerRef.value)

    // Fired after drag ends — reports all moved items
    grid.on('change', (_event: Event, items: GridStackNode[]) => {
      onLayoutChange(items)
    })

    // Fired after resize handle released — reports the resized item
    grid.on('resizestop', (_event: Event, el: GridItemHTMLElement) => {
      const node = el.gridstackNode
      if (node) onLayoutChange([node])
    })
  })

  onUnmounted(() => {
    grid?.destroy(false) // false = keep DOM, Vue handles unmount
    grid = null
  })

  /**
   * Call after programmatically pushing a new widget into the reactive list.
   * Pass the container element for that widget so gridstack can track it.
   */
  const addItem = (el: HTMLElement) => {
    grid?.makeWidget(el)
  }

  /**
   * Call before removing a widget from the reactive list.
   */
  const removeItem = (el: HTMLElement) => {
    grid?.removeWidget(el, false) // false = don't remove DOM
  }

  return { addItem, removeItem }
}

export default useDashboardLayout
