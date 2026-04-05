import type { MeasurementsPayload, MeasurementsResponse } from './types'

/**
 * POST to /rest/measurements and return the response.
 * Auth is handled by session cookies (same-origin request).
 */
export async function fetchMeasurements(payload: MeasurementsPayload): Promise<MeasurementsResponse> {
  const response = await fetch('/rest/measurements', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`Measurements request failed: ${response.status}`)
  }

  return response.json() as Promise<MeasurementsResponse>
}
