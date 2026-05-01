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

const IconCategories = ['action', 'datavis', 'network']

const useMenuIcons = () => {
  // iconId should be a specifier from Feather, example:
  // actions/accountCircle
  // Returns a PrimeIcons class string (e.g. 'pi-home') or null
  const getIcon = (iconId?: string | null): string | null => {
    const arr = (iconId ?? '').split('/')

    if (arr.length === 2) {
      const path = arr[0] || ''
      const item = arr[1].match(/[A-Za-z0-9]+/) ? arr[1] : ''

      if (path.length > 0 && IconCategories.includes(path) && item.length > 0) {

        if (path === 'action') {
          switch (item) {
            case 'Dashboard': return 'pi-chart-bar'
            case 'Help': return 'pi-question-circle'
            case 'Home': return 'pi-home'
            case 'Location': return 'pi-map-marker'
            case 'Lock': return 'pi-lock'
            case 'Logout': return 'pi-sign-out'
            case 'ManageProfile': return 'pi-user-edit'
            case 'Person': return 'pi-user'
            case 'Search': return 'pi-search'
            case 'ContactSupport': return 'pi-phone'
            case 'Unlock': return 'pi-unlock'
            case 'View': return 'pi-eye'
            case 'ViewDetails': return 'pi-list'
            case 'Workflow': return 'pi-sitemap'
            default: return null
          }
        } else if (path === 'datavis') {
          switch (item) {
            case 'ColumnChart': return 'pi-chart-bar'
            case 'LineChart': return 'pi-chart-line'
            default: return null
          }
        } else if (path === 'network') {
          switch (item) {
            case 'ApiConfig': return 'pi-cog'
            case 'ApiEndpoints': return 'pi-link'
            case 'Build': return 'pi-wrench'
            case 'Configuration': return 'pi-sliders-h'
            case 'Connection': return 'pi-share-alt'
            case 'DistributedMonitoring': return 'pi-sitemap'
            case 'Instances': return 'pi-server'
            case 'Inventory': return 'pi-list'
            case 'InventoryAlt': return 'pi-database'
            case 'LogsAlt': return 'pi-file-text'
            case 'Monitoring': return 'pi-desktop'
            case 'Server': return 'pi-server'
            case 'Nodes': return 'pi-sitemap'
            default: return null
          }
        }
      }
    }

    return null
  }

  return { getIcon }
}

export default useMenuIcons
