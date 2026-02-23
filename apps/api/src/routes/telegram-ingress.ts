import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { enqueueCommand } from '../services/command-bus.js'
import { evaluateRisk } from '../services/risk-gate.js'
import type { TradingCommand } from '../types/commands.js'

const telegramWebhookSchema = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      message_id: z.number().int(),
      date: z.number().int(),
      text: z.string().min(1),
      chat: z.object({
        id: z.union([z.number(), z.string()]),
        type: z.string(),
        title: z.string().optional(),
        username: z.string().optional()
      }),
      from: z.object({
        id: z.union([z.number(), z.string()]),
        is_bot: z.boolean().optional(),
        username: z.string().optional(),
        first_name: z.string().optional(),
        last_name: z.string().optional()
      })
    })
    .optional()
})

type ParsedTelegramCommand = {
  type: TradingCommand['type']
  accountId?: string
  symbol?: string
  side?: 'buy' | 'sell'
  size?: number
  sl?: number
  tp?: number
}

function parseSlashCommand(text: string): { command?: ParsedTelegramCommand; issues: string[] } {
  const trimmed = text.trim()
  const [rawHead, ...rest] = trimmed.split(/\s+/)
  const [head] = rawHead.toLowerCase().split('@')
  const issues: string[] = []

  switch (head) {
    case '/status': {
      const accountId = rest[0]
      return { command: { type: 'status', accountId }, issues }
    }

    case '/open': {
      const [symbolRaw, sideRaw, sizeRaw, ...optionalParts] = rest
      if (!symbolRaw) issues.push('symbol_required')

      const side = sideRaw?.toLowerCase() as 'buy' | 'sell' | undefined
      if (!side || (side !== 'buy' && side !== 'sell')) issues.push('side_must_be_buy_or_sell')

      const size = Number(sizeRaw)
      if (!sizeRaw || Number.isNaN(size) || size <= 0) issues.push('size_must_be_positive_number')

      const optionals = Object.fromEntries(
        optionalParts
          .map((part) => part.split('='))
          .filter(([k, v]) => Boolean(k && v))
          .map(([k, v]) => [k.toLowerCase(), v])
      )

      const sl = optionals.sl ? Number(optionals.sl) : undefined
      const tp = optionals.tp ? Number(optionals.tp) : undefined
      if (optionals.sl && Number.isNaN(sl)) issues.push('sl_must_be_number')
      if (optionals.tp && Number.isNaN(tp)) issues.push('tp_must_be_number')

      return {
        command: {
          type: 'open',
          symbol: symbolRaw?.toUpperCase(),
          side,
          size: Number.isFinite(size) ? size : undefined,
          sl: Number.isFinite(sl) ? sl : undefined,
          tp: Number.isFinite(tp) ? tp : undefined
        },
        issues
      }
    }

    case '/close': {
      const [symbolRaw, accountId] = rest
      return {
        command: {
          type: 'close',
          symbol: symbolRaw?.toUpperCase(),
          accountId
        },
        issues
      }
    }

    case '/panic':
      return { command: { type: 'panic' }, issues }

    default:
      return {
        issues: ['unsupported_command'],
        command: undefined
      }
  }
}

export function registerTelegramIngressRoutes(app: FastifyInstance) {
  app.post('/v1/ingress/telegram/webhook', async (req, reply) => {
    const parsedWebhook = telegramWebhookSchema.safeParse(req.body)
    if (!parsedWebhook.success) {
      return reply.status(400).send({
        status: 'invalid_webhook',
        validation: {
          valid: false,
          issues: parsedWebhook.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        }
      })
    }

    const webhook = parsedWebhook.data
    const message = webhook.message

    if (!message || !message.text.startsWith('/')) {
      return reply.status(202).send({ status: 'ignored', reason: 'non_command_message' })
    }

    const commandParse = parseSlashCommand(message.text)
    const receivedAt = new Date().toISOString()
    const actor = `telegram:${message.from.id}`

    const baseAudit = {
      ingress: 'telegram',
      receivedAt,
      updateId: webhook.update_id,
      messageId: message.message_id,
      chatId: String(message.chat.id),
      rawText: message.text,
      requester: {
        id: String(message.from.id),
        username: message.from.username,
        firstName: message.from.first_name,
        lastName: message.from.last_name
      }
    }

    if (!commandParse.command || commandParse.issues.length > 0) {
      return reply.status(400).send({
        status: 'invalid_command',
        validation: {
          valid: false,
          issues: commandParse.issues
        },
        audit: baseAudit
      })
    }

    const mappedPayload: Omit<TradingCommand, 'id' | 'createdAt'> = {
      ...commandParse.command,
      actor,
      channel: 'telegram',
      validation: {
        valid: true,
        issues: [],
        source: 'telegram-webhook-v1'
      },
      audit: baseAudit
    }

    const command: TradingCommand = {
      ...mappedPayload,
      id: randomUUID(),
      createdAt: receivedAt
    }

    const decision = evaluateRisk(command)

    if (!decision.allowed) {
      return reply.status(403).send({
        status: 'blocked',
        reason: decision.reason,
        validation: mappedPayload.validation,
        audit: mappedPayload.audit
      })
    }

    await enqueueCommand(command)

    return reply.status(202).send({
      status: 'accepted',
      command
    })
  })
}
