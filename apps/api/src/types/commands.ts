export type TradingCommandType =
  | 'status'
  | 'open'
  | 'close'
  | 'set-risk'
  | 'pause'
  | 'resume'
  | 'panic'

export interface TradingCommand {
  id: string
  type: TradingCommandType
  accountId?: string
  symbol?: string
  side?: 'buy' | 'sell'
  size?: number
  sl?: number
  tp?: number
  actor: string
  channel: 'telegram' | 'discord' | 'imessage' | 'system'
  createdAt: string
}
