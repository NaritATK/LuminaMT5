import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import sensible from '@fastify/sensible'

import { env } from './utils/env.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerCommandRoutes } from './routes/commands.js'

const app = Fastify({ logger: { level: env.LOG_LEVEL } })

await app.register(helmet)
await app.register(cors, { origin: true })
await app.register(sensible)

registerHealthRoutes(app)
registerCommandRoutes(app)

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
