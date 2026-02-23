import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { authenticate, requireRole } from '../auth/middleware.js'
import { persistLifecycle } from '../repositories/lifecycle-repository.js'

const lifecycleSchema = z.object({
  command: z
    .object({
      id: z.string().uuid(),
      decision: z.enum(['executed', 'failed']).optional(),
      decisionReason: z.string().nullable().optional()
    })
    .optional(),
  order: z
    .object({
      id: z.string().uuid().optional(),
      accountId: z.string().uuid(),
      commandId: z.string().uuid().nullable().optional(),
      symbol: z.string().min(1),
      side: z.enum(['buy', 'sell']),
      size: z.number().positive(),
      sl: z.number().positive().nullable().optional(),
      tp: z.number().positive().nullable().optional(),
      status: z.enum([
        'pending',
        'submitted',
        'partially_filled',
        'filled',
        'cancelled',
        'rejected',
        'expired',
        'closed'
      ]),
      clientOrderId: z.string().nullable().optional(),
      mt5OrderId: z.string().nullable().optional(),
      mt5PositionId: z.string().nullable().optional(),
      openedAt: z.string().datetime().nullable().optional(),
      closedAt: z.string().datetime().nullable().optional(),
      closeReason: z.string().nullable().optional()
    })
    .optional(),
  fill: z
    .object({
      id: z.string().uuid().optional(),
      mt5DealId: z.string().min(1),
      price: z.number().positive(),
      volume: z.number().positive(),
      filledAt: z.string().datetime(),
      side: z.enum(['buy', 'sell']).nullable().optional(),
      fee: z.number().nullable().optional(),
      commission: z.number().nullable().optional()
    })
    .optional(),
  position: z
    .object({
      id: z.string().uuid().optional(),
      accountId: z.string().uuid(),
      symbol: z.string().min(1),
      side: z.enum(['buy', 'sell']),
      status: z.enum(['open', 'partially_closed', 'closed']),
      mt5PositionId: z.string().nullable().optional(),
      openedAt: z.string().datetime(),
      closedAt: z.string().datetime().nullable().optional(),
      avgEntryPrice: z.number().positive(),
      avgExitPrice: z.number().positive().nullable().optional(),
      sizeOpened: z.number().positive(),
      sizeClosed: z.number().nonnegative().optional(),
      realizedPnl: z.number().nullable().optional()
    })
    .optional()
})

export function registerExecutorLifecycleRoutes(app: FastifyInstance) {
  app.post(
    '/v1/executor/lifecycle',
    {
      preHandler: [authenticate, requireRole('operator')]
    },
    async (req, reply) => {
      const parsed = lifecycleSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() })
      }

      if (!parsed.data.command && !parsed.data.order && !parsed.data.fill && !parsed.data.position) {
        return reply.status(400).send({ error: 'at least one lifecycle section is required' })
      }

      await persistLifecycle(parsed.data)
      return reply.status(202).send({ status: 'accepted' })
    }
  )
}
