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

import { v2 } from './axiosInstances'

// ─── Status ──────────────────────────────────────────────────────────────────

export const BSM_STATUSES = ['INDETERMINATE', 'NORMAL', 'WARNING', 'MINOR', 'MAJOR', 'CRITICAL'] as const
export type BsmStatus = typeof BSM_STATUSES[number]

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    CRITICAL:      'status-critical',
    MAJOR:         'status-major',
    MINOR:         'status-minor',
    WARNING:       'status-warning',
    NORMAL:        'status-normal',
    INDETERMINATE: 'status-indeterminate',
  }
  return map[status] ?? 'status-indeterminate'
}

// ─── Functions ────────────────────────────────────────────────────────────────

export interface BsmFunctionParam {
  key: string
  type: string
  description: string
  required: boolean
}

export interface BsmFunctionMetadata {
  type: string
  name: string
  description: string
  parameter: BsmFunctionParam[]
}

export interface FunctionDTO {
  type: string
  properties: Record<string, string>
}

// ─── Raw API response edge shapes (hyphenated JAXB keys) ─────────────────────

export interface BsmIpServiceEdgeResponse {
  id: number
  'operational-status': string
  'map-function': FunctionDTO
  weight: number
  'ip-service': {
    id: number
    'node-label': string
    'ip-address': string
    'service-name': string
  }
  'friendly-name'?: string
}

export interface BsmReductionKeyEdgeResponse {
  id: number
  'operational-status': string
  'map-function': FunctionDTO
  weight: number
  'reduction-key': string
  'friendly-name'?: string
}

export interface BsmChildEdgeResponse {
  id: number
  'operational-status': string
  'map-function': FunctionDTO
  weight: number
  'child-id': number
}

export interface BsmApplicationEdgeResponse {
  id: number
  'operational-status': string
  'map-function': FunctionDTO
  weight: number
  application: {
    id: number
    'application-name': string
  }
}

// ─── BusinessService (raw GET response) ──────────────────────────────────────

export interface BusinessService {
  id: number
  name: string
  attributes: Record<string, string>
  'reduce-function': FunctionDTO
  'operational-status': string
  'ip-service-edges': BsmIpServiceEdgeResponse[]
  'reduction-key-edges': BsmReductionKeyEdgeResponse[]
  'child-edges': BsmChildEdgeResponse[]
  'application-edges': BsmApplicationEdgeResponse[]
  'parent-services': number[]
}

// ─── Normalized edge types (flat, discriminated union) ───────────────────────

interface EdgeBase {
  id: number
  operationalStatus: string
  mapFunction: FunctionDTO
  weight: number
}

export interface IpServiceInfo {
  id: number
  nodeLabel: string
  ipAddress: string
  serviceName: string
}

export interface ApplicationInfo {
  id: number
  applicationName: string
}

export interface IpServiceEdge extends EdgeBase {
  type: 'ip-service'
  ipService: IpServiceInfo
  friendlyName?: string
}

export interface ReductionKeyEdge extends EdgeBase {
  type: 'reduction-key'
  reductionKey: string
  friendlyName?: string
}

export interface ChildEdge extends EdgeBase {
  type: 'child'
  childId: number
}

export interface ApplicationEdge extends EdgeBase {
  type: 'application'
  application: ApplicationInfo
}

export type BsmEdge = IpServiceEdge | ReductionKeyEdge | ChildEdge | ApplicationEdge

// ─── Normalize raw response edges to flat typed union ────────────────────────

export function normalizeEdges(svc: BusinessService): BsmEdge[] {
  const edges: BsmEdge[] = []

  for (const e of (svc['ip-service-edges'] ?? [])) {
    edges.push({
      type: 'ip-service',
      id: e.id,
      operationalStatus: e['operational-status'],
      mapFunction: e['map-function'],
      weight: e.weight,
      ipService: {
        id: e['ip-service'].id,
        nodeLabel: e['ip-service']['node-label'],
        ipAddress: e['ip-service']['ip-address'],
        serviceName: e['ip-service']['service-name'],
      },
      friendlyName: e['friendly-name'],
    })
  }

  for (const e of (svc['reduction-key-edges'] ?? [])) {
    edges.push({
      type: 'reduction-key',
      id: e.id,
      operationalStatus: e['operational-status'],
      mapFunction: e['map-function'],
      weight: e.weight,
      reductionKey: e['reduction-key'],
      friendlyName: e['friendly-name'],
    })
  }

  for (const e of (svc['child-edges'] ?? [])) {
    edges.push({
      type: 'child',
      id: e.id,
      operationalStatus: e['operational-status'],
      mapFunction: e['map-function'],
      weight: e.weight,
      childId: e['child-id'],
    })
  }

  for (const e of (svc['application-edges'] ?? [])) {
    edges.push({
      type: 'application',
      id: e.id,
      operationalStatus: e['operational-status'],
      mapFunction: e['map-function'],
      weight: e.weight,
      application: {
        id: e.application.id,
        applicationName: e.application['application-name'],
      },
    })
  }

  return edges
}

// ─── Display helpers ─────────────────────────────────────────────────────────

export function edgeLabel(edge: BsmEdge): string {
  switch (edge.type) {
    case 'ip-service':
      return edge.friendlyName || `${edge.ipService.nodeLabel} / ${edge.ipService.ipAddress} / ${edge.ipService.serviceName}`
    case 'reduction-key':
      return edge.friendlyName || edge.reductionKey
    case 'child':
      return `Child Service #${edge.childId}`
    case 'application':
      return edge.application.applicationName
  }
}

export function edgeTypeLabel(type: BsmEdge['type']): string {
  const labels: Record<BsmEdge['type'], string> = {
    'ip-service':    'IP Service',
    'reduction-key': 'Reduction Key',
    'child':         'Child Service',
    'application':   'Application',
  }
  return labels[type]
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

export function extractIdFromUrl(url: string): number {
  const clean = url.endsWith('/') ? url.slice(0, -1) : url
  return parseInt(clean.split('/').pop()!, 10)
}

export function defaultReduceFunction(): FunctionDTO {
  return { type: 'HighestSeverity', properties: {} }
}

export function defaultMapFunction(): FunctionDTO {
  return { type: 'Identity', properties: {} }
}

// ─── Build PUT request body preserving existing edges ────────────────────────
//
// The PUT /{id} endpoint CLEARS all edges first, then re-adds what you send.
// So every metadata update must also re-send all existing edges.

export interface ServiceUpdatePayload {
  name: string
  attributes: Record<string, string>
  'reduce-function': FunctionDTO
  'ip-service-edges': object[]
  'reduction-key-edges': object[]
  'child-edges': object[]
  'application-edges': object[]
}

export function serviceToUpdateRequest(
  svc: BusinessService,
  overrides?: { name?: string; attributes?: Record<string, string>; 'reduce-function'?: FunctionDTO }
): ServiceUpdatePayload {
  return {
    name: overrides?.name ?? svc.name,
    attributes: overrides?.attributes ?? (svc.attributes ?? {}),
    'reduce-function': overrides?.['reduce-function'] ?? svc['reduce-function'],
    'ip-service-edges': (svc['ip-service-edges'] ?? []).map(e => ({
      'ip-service-id': e['ip-service'].id,
      'friendly-name': e['friendly-name'] ?? null,
      'map-function': e['map-function'],
      weight: e.weight,
    })),
    'reduction-key-edges': (svc['reduction-key-edges'] ?? []).map(e => ({
      'reduction-key': e['reduction-key'],
      'friendly-name': e['friendly-name'] ?? null,
      'map-function': e['map-function'],
      weight: e.weight,
    })),
    'child-edges': (svc['child-edges'] ?? []).map(e => ({
      'child-id': e['child-id'],
      'map-function': e['map-function'],
      weight: e.weight,
    })),
    'application-edges': (svc['application-edges'] ?? []).map(e => ({
      'application-id': e.application.id,
      'map-function': e['map-function'],
      weight: e.weight,
    })),
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────

export async function listBusinessServices(): Promise<BusinessService[]> {
  const listRes = await v2.get<{ 'business-services': string[] }>('/business-services')
  const urls: string[] = listRes.data['business-services'] ?? []
  if (urls.length === 0) return []
  const ids = urls.map(extractIdFromUrl)
  const results = await Promise.all(ids.map(id => v2.get<BusinessService>(`/business-services/${id}`)))
  return results.map(r => r.data)
}

export async function getBusinessService(id: number): Promise<BusinessService> {
  const res = await v2.get<BusinessService>(`/business-services/${id}`)
  return res.data
}

export async function createBusinessService(payload: {
  name: string
  attributes: Record<string, string>
  'reduce-function': FunctionDTO
}): Promise<number> {
  const res = await v2.post('/business-services', payload)
  const location: string = res.headers['location'] ?? res.headers['Location'] ?? ''
  return extractIdFromUrl(location)
}

export async function updateBusinessService(
  id: number,
  overrides: { name: string; attributes: Record<string, string>; 'reduce-function': FunctionDTO },
  currentService: BusinessService
): Promise<void> {
  const payload = serviceToUpdateRequest(currentService, overrides)
  await v2.put(`/business-services/${id}`, payload)
}

export async function deleteBusinessService(id: number): Promise<void> {
  await v2.delete(`/business-services/${id}`)
}

export async function addIpServiceEdge(serviceId: number, payload: {
  'ip-service-id': number
  'friendly-name'?: string
  'map-function': FunctionDTO
  weight: number
}): Promise<void> {
  await v2.post(`/business-services/${serviceId}/ip-service-edge`, payload)
}

export async function addReductionKeyEdge(serviceId: number, payload: {
  'reduction-key': string
  'friendly-name'?: string
  'map-function': FunctionDTO
  weight: number
}): Promise<void> {
  await v2.post(`/business-services/${serviceId}/reduction-key-edge`, payload)
}

export async function addChildEdge(serviceId: number, payload: {
  'child-id': number
  'map-function': FunctionDTO
  weight: number
}): Promise<void> {
  await v2.post(`/business-services/${serviceId}/child-edge`, payload)
}

// Application edges have no dedicated POST endpoint — must use full PUT.
export async function addApplicationEdge(serviceId: number, payload: {
  applicationId: number
  mapFunction: FunctionDTO
  weight: number
}): Promise<void> {
  const svc = await getBusinessService(serviceId)
  const request = serviceToUpdateRequest(svc)
  request['application-edges'] = [
    ...request['application-edges'],
    {
      'application-id': payload.applicationId,
      'map-function': payload.mapFunction,
      weight: payload.weight,
    },
  ]
  await v2.put(`/business-services/${serviceId}`, request)
}

export async function removeEdge(serviceId: number, edgeId: number): Promise<void> {
  await v2.delete(`/business-services/${serviceId}/edges/${edgeId}`)
}

export async function reloadDaemon(): Promise<void> {
  await v2.post('/business-services/daemon/reload')
}

export async function getMapFunctions(): Promise<BsmFunctionMetadata[]> {
  const res = await v2.get<{ function: BsmFunctionMetadata[] }>('/business-services/functions/map')
  return res.data.function ?? []
}

export async function getReduceFunctions(): Promise<BsmFunctionMetadata[]> {
  const res = await v2.get<{ function: BsmFunctionMetadata[] }>('/business-services/functions/reduce')
  return res.data.function ?? []
}

// ─── IP Service / Application pickers ────────────────────────────────────────

export interface IpServicePickerItem {
  id: number
  nodeLabel: string
  ipAddress: string
  serviceName: string
  label: string
}

export async function searchIpServices(query: string): Promise<IpServicePickerItem[]> {
  const res = await v2.get<{ service: Array<{ id: number; nodeLabel: string; ipAddress: string; serviceType: { name: string } }> }>(
    `/ifservices?limit=50&_s=status==A;node.label==${encodeURIComponent(query)}*`
  )
  return (res.data.service ?? []).map(s => ({
    id: s.id,
    nodeLabel: s.nodeLabel,
    ipAddress: s.ipAddress,
    serviceName: s.serviceType.name,
    label: `${s.nodeLabel} / ${s.ipAddress} / ${s.serviceType.name}`,
  }))
}

export interface ApplicationPickerItem {
  id: number
  applicationName: string
}

export async function listApplications(): Promise<ApplicationPickerItem[]> {
  const res = await v2.get<{ application: Array<{ id: number; 'application-name': string }> }>('/applications')
  return (res.data.application ?? []).map(a => ({
    id: a.id,
    applicationName: a['application-name'],
  }))
}
