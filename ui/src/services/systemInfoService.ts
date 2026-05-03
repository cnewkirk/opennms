import { rest, v2 } from './axiosInstances'

export interface SystemInfo {
  version: string
  displayVersion: string
  packageName: string
  services: Record<string, string>
}

export interface SystemAbout {
  version: string
  displayVersion: string
  packageName: string
  dbProductName: string
  dbVersion: string
  javaVersion: string
  javaVendor: string
  javaRuntimeName: string
  osName: string
  osVersion: string
  osArch: string
  serverTimeMs: number
}

const getSystemInfo = async (): Promise<SystemInfo | null> => {
  try {
    const resp = await rest.get('/info')
    return resp.data
  } catch { return null }
}

const getSystemAbout = async (): Promise<SystemAbout | null> => {
  try {
    const resp = await v2.get('/system/about')
    return resp.data
  } catch { return null }
}

export { getSystemInfo, getSystemAbout }
