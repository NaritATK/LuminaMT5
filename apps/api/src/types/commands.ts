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
  accountBalanceUsd?: number
  accountEquityUsd?: number
  tradesToday?: number
  openPositions?: number
  actor: string
  channel: 'telegram' | 'discord' | 'imessage' | 'system'
  validation?: {
    valid: boolean
    issues: string[]
    source?: string
  }
  audit?: {
    ingress: string
    receivedAt: string
    updateId?: number
    messageId?: number
    chatId?: string
    rawText?: string
    requester?: {
      id?: string
      username?: string
      firstName?: string
      lastName?: string
    }
  }
  createdAt: string
}

export type NewTradingCommand = Omit<TradingCommand, 'id' | 'createdAt'>
