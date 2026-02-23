import { randomUUID } from 'node:crypto'

import { queryPostgres } from '../db/postgres.js'

export interface LifecycleCommandPatch {
  id: string
  decision?: 'executed' | 'failed'
  decisionReason?: string | null
}

export interface LifecycleOrderPatch {
  id?: string
  accountId: string
  commandId?: string | null
  symbol: string
  side: 'buy' | 'sell'
  size: number
  sl?: number | null
  tp?: number | null
  status:
    | 'pending'
    | 'submitted'
    | 'partially_filled'
    | 'filled'
    | 'cancelled'
    | 'rejected'
    | 'expired'
    | 'closed'
  clientOrderId?: string | null
  mt5OrderId?: string | null
  mt5PositionId?: string | null
  openedAt?: string | null
  closedAt?: string | null
  closeReason?: string | null
}

export interface LifecycleFillPatch {
  id?: string
  mt5DealId: string
  price: number
  volume: number
  filledAt: string
  side?: 'buy' | 'sell' | null
  fee?: number | null
  commission?: number | null
}

export interface LifecyclePositionPatch {
  id?: string
  accountId: string
  symbol: string
  side: 'buy' | 'sell'
  status: 'open' | 'partially_closed' | 'closed'
  mt5PositionId?: string | null
  openedAt: string
  closedAt?: string | null
  avgEntryPrice: number
  avgExitPrice?: number | null
  sizeOpened: number
  sizeClosed?: number
  realizedPnl?: number | null
}

export interface PersistLifecycleInput {
  command?: LifecycleCommandPatch
  order?: LifecycleOrderPatch
  fill?: LifecycleFillPatch
  position?: LifecyclePositionPatch
}

interface IdRow {
  id: string
}

async function upsertOrder(order: LifecycleOrderPatch): Promise<string> {
  const existing = await queryPostgres<IdRow>(
    `select id
     from orders
     where ($1::uuid is not null and command_id = $1::uuid)
        or ($2::text is not null and mt5_order_id = $2::text)
        or ($3::text is not null and client_order_id = $3::text)
     order by created_at desc
     limit 1`,
    [order.commandId ?? null, order.mt5OrderId ?? null, order.clientOrderId ?? null]
  )

  const orderId = existing[0]?.id ?? order.id ?? randomUUID()

  await queryPostgres(
    `insert into orders (
      id, account_id, command_id, symbol, side, size, sl, tp, status,
      client_order_id, mt5_order_id, mt5_position_id, opened_at, closed_at, close_reason, updated_at, created_at
    )
    values (
      $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13::timestamptz, $14::timestamptz, $15, now(), now()
    )
    on conflict (id) do update set
      account_id = excluded.account_id,
      command_id = coalesce(excluded.command_id, orders.command_id),
      symbol = excluded.symbol,
      side = excluded.side,
      size = excluded.size,
      sl = excluded.sl,
      tp = excluded.tp,
      status = excluded.status,
      client_order_id = coalesce(excluded.client_order_id, orders.client_order_id),
      mt5_order_id = coalesce(excluded.mt5_order_id, orders.mt5_order_id),
      mt5_position_id = coalesce(excluded.mt5_position_id, orders.mt5_position_id),
      opened_at = coalesce(excluded.opened_at, orders.opened_at),
      closed_at = excluded.closed_at,
      close_reason = excluded.close_reason,
      updated_at = now()`,
    [
      orderId,
      order.accountId,
      order.commandId ?? null,
      order.symbol,
      order.side,
      order.size,
      order.sl ?? null,
      order.tp ?? null,
      order.status,
      order.clientOrderId ?? null,
      order.mt5OrderId ?? null,
      order.mt5PositionId ?? null,
      order.openedAt ?? null,
      order.closedAt ?? null,
      order.closeReason ?? null
    ]
  )

  return orderId
}

async function upsertFill(fill: LifecycleFillPatch, orderId: string): Promise<void> {
  await queryPostgres(
    `insert into fills (
      id, order_id, mt5_deal_id, price, volume, filled_at, side, fee, commission, created_at
    )
    values (
      $1::uuid, $2::uuid, $3, $4, $5, $6::timestamptz, $7, $8, $9, now()
    )
    on conflict (mt5_deal_id) do update set
      order_id = excluded.order_id,
      price = excluded.price,
      volume = excluded.volume,
      filled_at = excluded.filled_at,
      side = excluded.side,
      fee = excluded.fee,
      commission = excluded.commission`,
    [
      fill.id ?? randomUUID(),
      orderId,
      fill.mt5DealId,
      fill.price,
      fill.volume,
      fill.filledAt,
      fill.side ?? null,
      fill.fee ?? null,
      fill.commission ?? null
    ]
  )
}

async function upsertPosition(position: LifecyclePositionPatch, orderId: string): Promise<void> {
  const existing = position.mt5PositionId
    ? await queryPostgres<IdRow>(
        `select id from positions where mt5_position_id = $1::text limit 1`,
        [position.mt5PositionId]
      )
    : await queryPostgres<IdRow>(
        `select id from positions where order_id = $1::uuid order by created_at desc limit 1`,
        [orderId]
      )

  const positionId = existing[0]?.id ?? position.id ?? randomUUID()

  await queryPostgres(
    `insert into positions (
      id, account_id, order_id, symbol, side, status, mt5_position_id,
      opened_at, closed_at, avg_entry_price, avg_exit_price,
      size_opened, size_closed, realized_pnl, created_at, updated_at
    )
    values (
      $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7,
      $8::timestamptz, $9::timestamptz, $10, $11,
      $12, $13, $14, now(), now()
    )
    on conflict (id) do update set
      account_id = excluded.account_id,
      order_id = excluded.order_id,
      symbol = excluded.symbol,
      side = excluded.side,
      status = excluded.status,
      mt5_position_id = coalesce(excluded.mt5_position_id, positions.mt5_position_id),
      opened_at = excluded.opened_at,
      closed_at = excluded.closed_at,
      avg_entry_price = excluded.avg_entry_price,
      avg_exit_price = excluded.avg_exit_price,
      size_opened = excluded.size_opened,
      size_closed = excluded.size_closed,
      realized_pnl = excluded.realized_pnl,
      updated_at = now()`,
    [
      positionId,
      position.accountId,
      orderId,
      position.symbol,
      position.side,
      position.status,
      position.mt5PositionId ?? null,
      position.openedAt,
      position.closedAt ?? null,
      position.avgEntryPrice,
      position.avgExitPrice ?? null,
      position.sizeOpened,
      position.sizeClosed ?? 0,
      position.realizedPnl ?? null
    ]
  )
}

export async function persistLifecycle(input: PersistLifecycleInput): Promise<void> {
  if (input.command) {
    await queryPostgres(
      `update commands
       set decision = coalesce($2, decision),
           decision_reason = $3
       where id = $1::uuid`,
      [input.command.id, input.command.decision ?? null, input.command.decisionReason ?? null]
    )
  }

  let orderId: string | null = null
  if (input.order) {
    orderId = await upsertOrder(input.order)
  }

  if (input.fill) {
    if (!orderId) throw new Error('fill lifecycle update requires an order')
    await upsertFill(input.fill, orderId)
  }

  if (input.position) {
    if (!orderId) throw new Error('position lifecycle update requires an order')
    await upsertPosition(input.position, orderId)
  }
}
