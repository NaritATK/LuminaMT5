import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import sensible from '@fastify/sensible'

import { env } from './utils/env.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerCommandRoutes } from './routes/commands.js'
import { registerTelegramIngressRoutes } from './routes/telegram-ingress.js'
import { registerStatusRoutes } from './routes/status.js'

if (
  env.NODE_ENV === 'production' &&
  env.AUTH_API_KEYS.size === 0 &&
  env.AUTH_BEARER_TOKENS.size === 0
) {
  throw new Error('Auth is required in production: configure AUTH_API_KEYS or AUTH_BEARER_TOKENS')
}

const app = Fastify({ logger: { level: env.LOG_LEVEL } })

await app.register(helmet)
await app.register(cors, { origin: true })
await app.register(sensible)

registerHealthRoutes(app)
registerStatusRoutes(app)
registerCommandRoutes(app)
registerTelegramIngressRoutes(app)

const start = async () => {
  try {
    await app.listen({ port: env.API_PORT, host: '0.0.0.0' })
    app.log.info(`API running on :${env.API_PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
