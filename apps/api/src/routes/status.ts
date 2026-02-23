import type { FastifyInstance } from 'fastify'
import { Redis } from 'ioredis'

import { getPostgresPool } from '../db/postgres.js'
import { COMMAND_QUEUE_KEY } from '../services/command-bus.js'
import { env } from '../utils/env.js'

const redis = new Redis(env.REDIS_URL)

const WORKER_STATUS_KEYS = ['luminamt5:worker:status', 'luminamt5:worker:heartbeat']
const ACCOUNT_STATUS_PATTERNS = ['luminamt5:account:*:status', 'luminamt5:accounts:*:status']
const WORKER_HEARTBEAT_STALE_SEC = 120

type WorkerStatus = {
  status: string
  lastHeartbeatTs: string | null
  heartbeatAgeSec: number | null
  details: Record<string, unknown>
}

type AccountState = {
  accountId: string
  status: string
  lastHeartbeatTs: string | null
  heartbeatAgeSec: number | null
  updatedTs: string | null
  dryRun: boolean | null
  balanceUsd: number | null
  equityUsd: number | null
  key: string
}

function parseIsoTs(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false
  }
  return null
}

function parseWorkerPayload(payload: unknown): { status: string; lastHeartbeatTs: string | null; details: Record<string, unknown> } {
  const source = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {}
  const status =
    typeof source.status === 'string' && source.status.trim().length > 0
      ? source.status
      : typeof source.state === 'string' && source.state.trim().length > 0
        ? source.state
        : 'unknown'

  const lastHeartbeatTs = parseIsoTs(source.lastHeartbeatTs ?? source.lastHeartbeatAt ?? source.ts ?? source.updatedAt)

  return { status, lastHeartbeatTs, details: source }
}

function ageSecFromTs(ts: string | null): number | null {
  if (!ts) return null
  const ms = Date.now() - new Date(ts).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 0
  return Math.floor(ms / 1000)
}

function accountIdFromKey(key: string): string {
  const parts = key.split(':')
  if (parts.length >= 4) return parts[2] || 'unknown'
  return 'unknown'
}

async function readRedisObjectByKey(key: string): Promise<Record<string, unknown> | null> {
  const keyType = await redis.type(key)

  if (keyType === 'none') return null

  if (keyType === 'hash') {
    const fields = await redis.hgetall(key)
    return fields
  }

  if (keyType === 'string') {
    const raw = await redis.get(key)
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, unknown>
      return { status: parsed }
    } catch {
      return { status: raw }
    }
  }

  return { type: keyType }
}

async function resolveWorkerStatus(): Promise<WorkerStatus> {
  for (const key of WORKER_STATUS_KEYS) {
    const payload = await readRedisObjectByKey(key)
    if (!payload) continue

    const parsed = parseWorkerPayload(payload)
    const heartbeatAgeSec = ageSecFromTs(parsed.lastHeartbeatTs)

    let status = parsed.status
    if (heartbeatAgeSec !== null && heartbeatAgeSec > WORKER_HEARTBEAT_STALE_SEC) {
      status = 'stale'
    }

    return {
      status,
      lastHeartbeatTs: parsed.lastHeartbeatTs,
      heartbeatAgeSec,
      details: { key, ...parsed.details }
    }
  }

  return {
    status: 'unknown',
    lastHeartbeatTs: null,
    heartbeatAgeSec: null,
    details: {}
  }
}

async function resolveAccountStates(): Promise<AccountState[]> {
  const keys = new Set<string>()

  for (const pattern of ACCOUNT_STATUS_PATTERNS) {
    let cursor = '0'
    do {
      const [nextCursor, matched] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200)
      cursor = nextCursor
      for (const key of matched) keys.add(key)
    } while (cursor !== '0')
  }

  const states: AccountState[] = []

  for (const key of [...keys].sort()) {
    const payload = await readRedisObjectByKey(key)
    const source = payload ?? {}

    const accountId =
      typeof source.accountId === 'string' && source.accountId.trim().length > 0
        ? source.accountId
        : accountIdFromKey(key)

    const status =
      typeof source.status === 'string' && source.status.trim().length > 0
        ? source.status
        : typeof source.state === 'string' && source.state.trim().length > 0
          ? source.state
          : 'unknown'

    const lastHeartbeatTs = parseIsoTs(source.lastHeartbeatTs ?? source.lastHeartbeatAt)
    const updatedTs = parseIsoTs(source.updatedTs ?? source.updatedAt ?? source.ts)

    states.push({
      accountId,
      status,
      lastHeartbeatTs,
      heartbeatAgeSec: ageSecFromTs(lastHeartbeatTs),
      updatedTs,
      dryRun: toBoolean(source.dryRun),
      balanceUsd: toNumber(source.balanceUsd ?? source.balance),
      equityUsd: toNumber(source.equityUsd ?? source.equity),
      key
    })
  }

  return states
}

export function registerStatusRoutes(app: FastifyInstance) {
  app.get('/v1/status', async () => {
    const now = new Date().toISOString()

    let redisStatus: 'up' | 'down' = 'up'
    let queueDepth: number | null = null
    let redisError: string | null = null

    try {
      queueDepth = await redis.llen(COMMAND_QUEUE_KEY)
    } catch (error) {
      redisStatus = 'down'
      redisError = error instanceof Error ? error.message : 'unknown_redis_error'
    }

    let dbStatus: 'up' | 'down' | 'disabled' = env.DATABASE_URL ? 'up' : 'disabled'
    let dbError: string | null = null
    let dbLatencyMs: number | null = null

    if (env.DATABASE_URL) {
      const started = Date.now()
      try {
        const pool = getPostgresPool()
        await pool.query('SELECT 1')
        dbLatencyMs = Date.now() - started
      } catch (error) {
        dbStatus = 'down'
        dbError = error instanceof Error ? error.message : 'unknown_db_error'
      }
    }

    let workerStatus: WorkerStatus = {
      status: 'unknown',
      lastHeartbeatTs: null,
      heartbeatAgeSec: null,
      details: {}
    }

    let accountStates: AccountState[] = []
    let accountError: string | null = null

    if (redisStatus === 'up') {
      try {
        const [worker, accounts] = await Promise.all([resolveWorkerStatus(), resolveAccountStates()])
        workerStatus = worker
        accountStates = accounts
      } catch (error) {
        accountError = error instanceof Error ? error.message : 'unknown_account_telemetry_error'
      }
    }

    const activeStatuses = new Set(['up', 'healthy', 'active', 'running', 'online'])
    const active = accountStates.filter((a) => activeStatuses.has(a.status.toLowerCase())).length

    const serviceStatus = redisStatus === 'up' && dbStatus !== 'down' ? 'ok' : 'degraded'

    return {
      status: serviceStatus,
      ts: now,
      service: {
        name: 'api',
        uptimeSec: Math.floor(process.uptime())
      },
      redis: {
        status: redisStatus,
        queue: {
          key: COMMAND_QUEUE_KEY,
          depth: queueDepth
        },
        error: redisError
      },
      db: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        error: dbError
      },
      worker: workerStatus,
      accounts: {
        total: accountStates.length,
        active,
        states: accountStates,
        error: accountError
      }
    }
  })
}
