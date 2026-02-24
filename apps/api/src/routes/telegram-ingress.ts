import { randomUUID, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { env } from '../utils/env.js'
import { insertCommandRecord } from '../repositories/command-repository.js'
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

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function hasValidSecret(req: FastifyRequest): boolean {
  if (!env.TELEGRAM_WEBHOOK_SECRET) return !env.TELEGRAM_WEBHOOK_REQUIRE_SECRET

  const received = req.headers['x-telegram-bot-api-secret-token']
  if (typeof received !== 'string') return false

  return safeEqual(received, env.TELEGRAM_WEBHOOK_SECRET)
}

function parseMaybeNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

function parseOptions(parts: string[]): Record<string, string> {
  return Object.fromEntries(
    parts
      .map((part) => part.split('='))
      .filter(([k, v]) => Boolean(k && v))
      .map(([k, v]) => [k.toLowerCase(), v])
  )
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
      const [symbolRaw, sideRaw, sizeRaw, ...tail] = rest
      if (!symbolRaw) issues.push('symbol_required')

      const side = sideRaw?.toLowerCase() as 'buy' | 'sell' | undefined
      if (!side || (side !== 'buy' && side !== 'sell')) issues.push('side_must_be_buy_or_sell')

      const size = parseMaybeNumber(sizeRaw)
      if (size == null || size <= 0) issues.push('size_must_be_positive_number')

      const positionalSl = parseMaybeNumber(tail[0]?.includes('=') ? undefined : tail[0])
      const positionalTp = parseMaybeNumber(tail[1]?.includes('=') ? undefined : tail[1])
      const kvOptions = parseOptions(tail)

      const sl = parseMaybeNumber(kvOptions.sl) ?? positionalSl
      const tp = parseMaybeNumber(kvOptions.tp) ?? positionalTp

      if ((kvOptions.sl && sl == null) || (tail[0] && !tail[0].includes('=') && positionalSl == null)) {
        issues.push('sl_must_be_number')
      }

      if ((kvOptions.tp && tp == null) || (tail[1] && !tail[1].includes('=') && positionalTp == null)) {
        issues.push('tp_must_be_number')
      }

      return {
        command: {
          type: 'open',
          symbol: symbolRaw?.toUpperCase(),
          side,
          size,
          sl,
          tp
        },
        issues
      }
    }

    case '/close': {
      const [symbolRaw, accountId] = rest
      if (!symbolRaw) issues.push('symbol_required')
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

function telegramReply(chatId: string | number, text: string) {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text
  }
}

export function registerTelegramIngressRoutes(app: FastifyInstance) {
  app.post('/v1/ingress/telegram/webhook', async (req, reply) => {
    if (!hasValidSecret(req)) {
      req.log.warn('Rejected telegram webhook request due to invalid secret token')
      return reply.status(401).send({ status: 'unauthorized' })
    }

    const parsedWebhook = telegramWebhookSchema.safeParse(req.body)
    if (!parsedWebhook.success) {
      req.log.warn(
        {
          issues: parsedWebhook.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        },
        'Rejected invalid telegram webhook payload'
      )
      return reply.status(400).send({ status: 'invalid_webhook' })
    }

    const webhook = parsedWebhook.data
    const message = webhook.message

    if (!message || !message.text.trim().startsWith('/')) {
      return reply.status(200).send({ status: 'ignored' })
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
      return reply.status(200).send(
        telegramReply(message.chat.id, `❌ Invalid command: ${commandParse.issues.join(', ') || 'unknown_error'}`)
      )
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

    try {
      const decision = evaluateRisk(command)

      if (!decision.allowed) {
        await insertCommandRecord({
          command,
          decision: 'blocked',
          decisionReason: decision.reason
        })

        return reply
          .status(200)
          .send(telegramReply(message.chat.id, `⛔ Command blocked (${decision.reason ?? 'risk_policy'})`))
      }

      await insertCommandRecord({ command, decision: 'accepted' })
      await enqueueCommand(command)

      return reply
        .status(200)
        .send(telegramReply(message.chat.id, `✅ Accepted: ${command.type} (${command.id.slice(0, 8)})`))
    } catch (error) {
      req.log.error({ error }, 'Failed processing telegram command')
      return reply
        .status(200)
        .send(telegramReply(message.chat.id, '⚠️ Command received but backend is unavailable. Try again shortly.'))
    }
  })
}
