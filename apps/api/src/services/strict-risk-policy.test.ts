import test from 'node:test'
import assert from 'node:assert/strict'

import { evaluateRisk } from './risk-gate.js'
import type { TradingCommand } from '../types/commands.js'

function baseOpenCommand(overrides: Partial<TradingCommand> = {}): TradingCommand {
  return {
    id: 'cmd-1',
    type: 'open',
    accountId: 'acct-10',
    symbol: 'EURUSD',
    side: 'buy',
    size: 0.01,
    sl: 1.05,
    actor: 'test',
    channel: 'system',
    createdAt: '2026-01-01T00:00:00.000Z',
    accountBalanceUsd: 10,
    accountEquityUsd: 9.7,
    tradesToday: 0,
    openPositions: 0,
    ...overrides
  }
}

test('allows valid open command for $10 account', () => {
  const result = evaluateRisk(baseOpenCommand())
  assert.equal(result.allowed, true)
})

test('blocks when SL is missing for $10 account', () => {
  const result = evaluateRisk(baseOpenCommand({ sl: undefined }))
  assert.deepEqual(result, { allowed: false, reason: 'sl_required_for_10usd_account' })
})

test('blocks when daily trade cap reached for $10 account', () => {
  const result = evaluateRisk(baseOpenCommand({ tradesToday: 5 }))
  assert.deepEqual(result, { allowed: false, reason: 'max_trades_per_day_reached_for_10usd_account' })
})

test('blocks when max open positions reached for $10 account', () => {
  const result = evaluateRisk(baseOpenCommand({ openPositions: 1 }))
  assert.deepEqual(result, { allowed: false, reason: 'max_positions_reached_for_10usd_account' })
})

test('blocks when drawdown cap is reached for $10 account', () => {
  const result = evaluateRisk(baseOpenCommand({ accountEquityUsd: 9.5 }))
  assert.deepEqual(result, { allowed: false, reason: 'daily_drawdown_cap_reached_for_10usd_account' })
})

test('blocks when account state metrics are missing for $10 account', () => {
  const result = evaluateRisk(baseOpenCommand({ tradesToday: undefined }))
  assert.deepEqual(result, { allowed: false, reason: 'missing_trades_today_for_10usd_account' })
})
