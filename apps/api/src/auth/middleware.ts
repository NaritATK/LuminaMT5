import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify'

import { env } from '../utils/env.js'
import type { Role } from './types.js'

const roleRank: Record<Role, number> = {
  viewer: 1,
  operator: 2,
  admin: 3
}

function unauthorized(reply: FastifyReply) {
  return reply.status(401).send({ error: 'unauthorized' })
}

function forbidden(reply: FastifyReply) {
  return reply.status(403).send({ error: 'forbidden' })
}

export const authenticate: preHandlerHookHandler = async (req, reply) => {
  const bearerHeader = req.headers.authorization
  const apiKeyHeader = req.headers['x-api-key']

  if (typeof bearerHeader === 'string' && bearerHeader.startsWith('Bearer ')) {
    const token = bearerHeader.slice('Bearer '.length).trim()
    const role = env.AUTH_BEARER_TOKENS.get(token)
    if (!role) return unauthorized(reply)

    req.auth = {
      subject: 'bearer',
      role,
      method: 'bearer'
    }
    return
  }

  if (typeof apiKeyHeader === 'string') {
    const role = env.AUTH_API_KEYS.get(apiKeyHeader)
    if (!role) return unauthorized(reply)

    req.auth = {
      subject: 'api-key',
      role,
      method: 'api-key'
    }
    return
  }

  return unauthorized(reply)
}

export function requireRole(minRole: Role): preHandlerHookHandler {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth) return unauthorized(reply)
    if (roleRank[req.auth.role] < roleRank[minRole]) return forbidden(reply)
  }
}
