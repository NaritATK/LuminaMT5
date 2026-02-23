import 'fastify'
import type { AuthPrincipal } from '../auth/types.js'

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthPrincipal
  }
}
