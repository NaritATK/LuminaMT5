import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { enqueueCommand } from '../services/command-bus.js'
import { evaluateRisk } from '../services/risk-gate.js'

const commandSchema = z.object({
  type: z.enum(['status', 'open', 'close', 'set-risk', 'pause', 'resume', 'panic']),
  accountId: z.string().optional(),
  symbol: z.string().optional(),
  side: z.enum(['buy', 'sell']).optional(),
  size: z.number().positive().optional(),
  sl: z.number().optional(),
  tp: z.number().optional(),
  actor: z.string().min(1),
  channel: z.enum(['telegram', 'discord', 'imessage', 'system'])
})

export function registerCommandRoutes(app: FastifyInstance) {
  app.post('/v1/commands', async (req, reply) => {
    const parsed = commandSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const decision = evaluateRisk({
      ...parsed.data,
      id: 'pending',
      createdAt: new Date().toISOString()
    })

    if (!decision.allowed) {
      return reply.status(403).send({ status: 'blocked', reason: decision.reason })
    }

    const command = await enqueueCommand(parsed.data)
    return reply.status(202).send({ status: 'accepted', command })
  })
}
