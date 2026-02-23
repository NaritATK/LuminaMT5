import { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import type { TradingCommand } from '../types/commands.js'
import { env } from '../utils/env.js'

const redis = new Redis(env.REDIS_URL)
const QUEUE_KEY = 'luminamt5:commands'

export async function enqueueCommand(
  input: Omit<TradingCommand, 'id' | 'createdAt'>
): Promise<TradingCommand> {
  const cmd: TradingCommand = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString()
  }

  await redis.rpush(QUEUE_KEY, JSON.stringify(cmd))
  return cmd
}
