import type { TradingCommand } from '../types/commands.js'
import { evaluateTenUsdRiskPolicy, isTenDollarAccount } from './strict-risk-policy.js'

export interface RiskDecision {
  allowed: boolean
  reason?: string
}

export function evaluateRisk(command: TradingCommand): RiskDecision {
  if (command.type === 'panic') return { allowed: true }

  if (command.type === 'open' && (!command.symbol || !command.side || !command.size || command.size <= 0)) {
    return { allowed: false, reason: 'invalid_order_payload' }
  }

  if (isTenDollarAccount(command)) {
    return evaluateTenUsdRiskPolicy(command)
  }

  return { allowed: true }
}
