import type { Role } from './types.js'

export type CredentialMap = Map<string, Role>

const validRoles = new Set<Role>(['viewer', 'operator', 'admin'])

export function parseCredentialMap(input: string | undefined): CredentialMap {
  const map: CredentialMap = new Map()
  if (!input) return map

  for (const rawEntry of input.split(',')) {
    const entry = rawEntry.trim()
    if (!entry) continue

    const parts = entry.split(':').map((p) => p.trim())
    if (parts.length < 2) continue

    const secret = parts[0]
    const role = parts[1] as Role

    if (!secret || !validRoles.has(role)) continue
    map.set(secret, role)
  }

  return map
}
