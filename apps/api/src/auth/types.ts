export const roles = ['viewer', 'operator', 'admin'] as const

export type Role = (typeof roles)[number]

export type AuthMethod = 'api-key' | 'bearer'

export interface AuthPrincipal {
  subject: string
  role: Role
  method: AuthMethod
}
