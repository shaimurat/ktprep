import 'dotenv/config'
import express from 'express'
import pg from 'pg'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { Pool } = pg
const port = Number(process.env.PORT || 3001)
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required')
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
})

const app = express()
app.use(express.json({ limit: '10mb' }))

app.use((req, res, next) => {
  const allowedOrigin = process.env.CORS_ORIGIN
  if (allowedOrigin) {
    res.header('Access-Control-Allow-Origin', allowedOrigin)
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    res.header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

await pool.query(`
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    position INTEGER
  );

  CREATE TABLE IF NOT EXISTS test_results (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    position INTEGER
  );

  ALTER TABLE questions ADD COLUMN IF NOT EXISTS position INTEGER;
  ALTER TABLE test_results ADD COLUMN IF NOT EXISTS position INTEGER;
`)

const collectionRoutes = (route, table) => {
  app.get(`/api/${route}`, async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT data FROM ${table} ORDER BY position ASC NULLS LAST, id`,
      )
      res.json(rows.map((row) => row.data))
    } catch (error) {
      next(error)
    }
  })

  app.put(`/api/${route}`, async (req, res, next) => {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Expected a JSON array' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`DELETE FROM ${table}`)
      for (const [position, item] of req.body.entries()) {
        if (!item?.id || typeof item.id !== 'string') {
          throw new Error('Every item must have a string id')
        }
        await client.query(
          `INSERT INTO ${table} (id, data, position) VALUES ($1, $2::jsonb, $3)`,
          [item.id, JSON.stringify(item), position],
        )
      }
      await client.query('COMMIT')
      res.sendStatus(204)
    } catch (error) {
      await client.query('ROLLBACK')
      next(error)
    } finally {
      client.release()
    }
  })
}

collectionRoutes('questions', 'questions')
collectionRoutes('results', 'test_results')

app.get('/api/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(currentDir, '../dist')
app.use(express.static(distDir))
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(distDir, 'index.html'))
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ error: 'Database request failed' })
})


