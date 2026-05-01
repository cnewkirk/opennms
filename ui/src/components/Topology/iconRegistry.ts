// Import SVGs as raw strings via Vite's ?raw query
import routerSvg          from '@/assets/topology-icons/router.svg?raw'
import switchSvg          from '@/assets/topology-icons/switch.svg?raw'
import switchL3Svg        from '@/assets/topology-icons/switch-l3.svg?raw'
import firewallSvg        from '@/assets/topology-icons/firewall.svg?raw'
import serverSvg          from '@/assets/topology-icons/server.svg?raw'
import wirelessApSvg      from '@/assets/topology-icons/wireless-ap.svg?raw'
import wirelessCtrlSvg    from '@/assets/topology-icons/wireless-controller.svg?raw'
import upsSvg             from '@/assets/topology-icons/ups.svg?raw'
import loadBalancerSvg    from '@/assets/topology-icons/load-balancer.svg?raw'
import cloudSvg           from '@/assets/topology-icons/cloud.svg?raw'
import genericSvg         from '@/assets/topology-icons/generic.svg?raw'
import consoleSvg         from '@/assets/topology-icons/console.svg?raw'
import pduSvg             from '@/assets/topology-icons/pdu.svg?raw'

const SVG_MAP: Record<string, string> = {
  router:                routerSvg,
  switch:                switchSvg,
  'switch-l3':           switchL3Svg,
  firewall:              firewallSvg,
  server:                serverSvg,
  'wireless-ap':         wirelessApSvg,
  'wireless-controller': wirelessCtrlSvg,
  ups:                   upsSvg,
  'load-balancer':       loadBalancerSvg,
  cloud:                 cloudSvg,
  generic:               genericSvg,
  console:               consoleSvg,
  pdu:                   pduSvg,
}

export const ICON_KEYS = Object.keys(SVG_MAP)

const _cache = new Map<string, string>()

/** Returns a `data:image/svg+xml` URI for Cytoscape background-image. Falls back to generic. */
export const getIconDataUri = (iconKey: string): string => {
  const key = SVG_MAP[iconKey] ? iconKey : 'generic'
  if (_cache.has(key)) return _cache.get(key)!
  const uri = `data:image/svg+xml,${encodeURIComponent(SVG_MAP[key])}`
  _cache.set(key, uri)
  return uri
}

/** Returns a `data:image/svg+xml` URI with `currentColor` replaced by `color`. Falls back to server icon. */
export const getColoredIconDataUri = (iconKey: string, color: string): string => {
  const key = SVG_MAP[iconKey] ? iconKey : 'server'
  const cacheKey = `${key}:${color}`
  if (_cache.has(cacheKey)) return _cache.get(cacheKey)!
  const colored = SVG_MAP[key].replaceAll('currentColor', color)
  const uri = `data:image/svg+xml,${encodeURIComponent(colored)}`
  _cache.set(cacheKey, uri)
  return uri
}
