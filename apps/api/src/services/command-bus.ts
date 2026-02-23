import { Redis } from 'ioredis'

import type { TradingCommand } from '../types/commands.js'
import { env } from '../utils/env.js'

const redis = new Redis(env.REDIS_URL)
export const COMMAND_QUEUE_KEY = 'luminamt5:commands'

export async function enqueueCommand(command: TradingCommand): Promise<TradingCommand> {
  await redis.rpush(COMMAND_QUEUE_KEY, JSON.stringify(command))
  return command
}
