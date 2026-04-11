/**
 * Returns true if the string is a valid IPv4 or IPv6 CIDR block.
 */
export const isValidCidr = (value: string): boolean => {
  if (!value) return false
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}\/(\d|[1-2]\d|3[0-2])$/
  const ipv6 = /^[0-9a-fA-F:]+\/(\d|[1-9]\d|1[0-1]\d|12[0-8])$/
  if (!ipv4.test(value) && !ipv6.test(value)) return false
  if (ipv4.test(value)) {
    return value.split('/')[0].split('.').every(o => parseInt(o) <= 255)
  }
  return true
}
