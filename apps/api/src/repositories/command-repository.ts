import type { TradingCommand } from '../types/commands.js'
import { queryPostgres } from '../db/postgres.js'

export type CommandDecision = 'accepted' | 'blocked'

type CommandPayload = Omit<
  TradingCommand,
  'id' | 'type' | 'accountId' | 'actor' | 'channel' | 'createdAt'
>

export interface PersistCommandInput {
  command: TradingCommand
  decision: CommandDecision
  decisionReason?: string
}

function toCommandPayload(command: TradingCommand): CommandPayload {
  const {
    id: _id,
    type: _type,
    accountId: _accountId,
    actor: _actor,
    channel: _channel,
    createdAt: _createdAt,
    ...payload
  } = command

  return payload
}

export async function insertCommandRecord(input: PersistCommandInput): Promise<void> {
  const { command, decision, decisionReason } = input

  await queryPostgres(
    `insert into commands (
      id,
      account_id,
      type,
      payload,
      actor,
      channel,
      decision,
      decision_reason,
      created_at
    )
    values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9::timestamptz)`,
    [
      command.id,
      command.accountId ?? null,
      command.type,
      JSON.stringify(toCommandPayload(command)),
      command.actor,
      command.channel,
      decision,
      decisionReason ?? null,
      command.createdAt
    ]
  )
}
