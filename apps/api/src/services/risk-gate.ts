import type { TradingCommand } from '../types/commands.js'

export interface RiskDecision {
  allowed: boolean
  reason?: string
}

export function evaluateRisk(command: TradingCommand): RiskDecision {
  if (command.type === 'panic') return { allowed: true }

  if (command.type === 'open' && (!command.symbol || !command.side || !command.size || command.size <= 0)) {
    return { allowed: false, reason: 'invalid_order_payload' }
  }

  // Placeholder for full rules:
  // - max daily drawdown
  // - max positions/account
  // - spread/slippage guard
  // - news blackout
  // - circuit breaker
  return { allowed: true }
}
