import type { FastifyInstance } from 'fastify'
import { Redis } from 'ioredis'

import { env } from '../utils/env.js'
import { COMMAND_QUEUE_KEY } from '../services/command-bus.js'

const redis = new Redis(env.REDIS_URL)

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

    const serviceStatus = redisStatus === 'up' ? 'ok' : 'degraded'

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
      worker: {
        status: 'unknown',
        lastHeartbeatTs: null
      },
      accounts: {
        total: 0,
        active: 0,
        states: []
      }
    }
  })
}
