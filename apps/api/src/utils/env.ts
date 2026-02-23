import { parseCredentialMap } from '../auth/credentials.js'

const nodeEnv = process.env.NODE_ENV ?? 'development'

export const env = {
  NODE_ENV: nodeEnv,
  API_PORT: Number(process.env.API_PORT ?? 3000),
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  AUTH_API_KEYS: parseCredentialMap(process.env.AUTH_API_KEYS),
  AUTH_BEARER_TOKENS: parseCredentialMap(process.env.AUTH_BEARER_TOKENS)
}
