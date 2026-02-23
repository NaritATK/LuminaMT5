import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { insertCommandRecord } from '../repositories/command-repository.js'
import { enqueueCommand } from '../services/command-bus.js'
import { evaluateRisk } from '../services/risk-gate.js'
import type { TradingCommand } from '../types/commands.js'
import { authenticate, requireRole } from '../auth/middleware.js'

const commandSchema = z.object({
  type: z.enum(['status', 'open', 'close', 'set-risk', 'pause', 'resume', 'panic']),
  accountId: z.string().optional(),
  symbol: z.string().optional(),
  side: z.enum(['buy', 'sell']).optional(),
  size: z.number().positive().optional(),
  sl: z.number().optional(),
  tp: z.number().optional(),
  accountBalanceUsd: z.number().positive().optional(),
  accountEquityUsd: z.number().nonnegative().optional(),
  tradesToday: z.number().int().nonnegative().optional(),
  openPositions: z.number().int().nonnegative().optional(),
  actor: z.string().min(1),
  channel: z.enum(['telegram', 'discord', 'imessage', 'system'])
})

export function registerCommandRoutes(app: FastifyInstance) {
  app.post(
    '/v1/commands',
    {
      preHandler: [authenticate, requireRole('operator')]
    },
    async (req, reply) => {
      const parsed = commandSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

      if (parsed.data.type === 'panic' && req.auth?.role !== 'admin') {
        return reply.status(403).send({ error: 'forbidden' })
      }

      const command: TradingCommand = {
        ...parsed.data,
        id: randomUUID(),
        createdAt: new Date().toISOString()
      }

      const decision = evaluateRisk(command)

      if (!decision.allowed) {
        await insertCommandRecord({
          command,
          decision: 'blocked',
          decisionReason: decision.reason
        })

        return reply.status(403).send({
          status: 'blocked',
          commandId: command.id,
          reason: decision.reason
        })
      }

      await insertCommandRecord({ command, decision: 'accepted' })
      await enqueueCommand(command)

      return reply.status(202).send({ status: 'accepted', command })
    }
  )
}
