import type { TradingCommand } from '../types/commands.js'

export const TEN_USD_POLICY = {
  maxDailyDrawdownPct: 5,
  maxTradesPerDay: 5,
  maxPositionsPerAccount: 1,
  requireStopLoss: true
} as const

export function isTenDollarAccount(command: TradingCommand): boolean {
  return typeof command.accountBalanceUsd === 'number' && command.accountBalanceUsd > 0 && command.accountBalanceUsd <= 10
}

export function evaluateTenUsdRiskPolicy(command: TradingCommand): { allowed: boolean; reason?: string } {
  if (command.type !== 'open') return { allowed: true }

  if (TEN_USD_POLICY.requireStopLoss && (typeof command.sl !== 'number' || command.sl <= 0)) {
    return { allowed: false, reason: 'sl_required_for_10usd_account' }
  }

  if (typeof command.tradesToday !== 'number') {
    return { allowed: false, reason: 'missing_trades_today_for_10usd_account' }
  }

  if (command.tradesToday >= TEN_USD_POLICY.maxTradesPerDay) {
    return { allowed: false, reason: 'max_trades_per_day_reached_for_10usd_account' }
  }

  if (typeof command.openPositions !== 'number') {
    return { allowed: false, reason: 'missing_open_positions_for_10usd_account' }
  }

  if (command.openPositions >= TEN_USD_POLICY.maxPositionsPerAccount) {
    return { allowed: false, reason: 'max_positions_reached_for_10usd_account' }
  }

  if (typeof command.accountEquityUsd !== 'number' || typeof command.accountBalanceUsd !== 'number') {
    return { allowed: false, reason: 'missing_equity_balance_for_10usd_account' }
  }

  const drawdownPct = ((command.accountBalanceUsd - command.accountEquityUsd) / command.accountBalanceUsd) * 100
  if (drawdownPct >= TEN_USD_POLICY.maxDailyDrawdownPct) {
    return { allowed: false, reason: 'daily_drawdown_cap_reached_for_10usd_account' }
  }

  return { allowed: true }
}
