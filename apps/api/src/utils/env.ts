export const env = {
  API_PORT: Number(process.env.API_PORT ?? 3000),
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  DATABASE_URL: process.env.DATABASE_URL ?? ''
}
