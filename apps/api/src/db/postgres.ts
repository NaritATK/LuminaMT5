import { Pool } from 'pg'

import { env } from '../utils/env.js'

let pool: any = null

export function getPostgresPool() {
  if (pool) return pool

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for Postgres operations')
  }

  pool = new Pool({ connectionString: env.DATABASE_URL })
  return pool
}

export async function queryPostgres<T = Record<string, unknown>>(
  text: string,
  values: readonly unknown[] = []
): Promise<T[]> {
  const client = getPostgresPool()
  const result = await client.query(text, [...values])
  return result.rows as T[]
}
