import 'dotenv/config'
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import express from 'express'
import pg from 'pg'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const { Pool } = pg
const scrypt = promisify(scryptCallback)
const port = Number(process.env.PORT || 3001)
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required')
}

const parsedDatabaseUrl = new URL(databaseUrl)
const isLocalDatabase = ['localhost', '127.0.0.1'].includes(parsedDatabaseUrl.hostname)

// SSL is configured explicitly below, so remove the duplicate URL option.
parsedDatabaseUrl.searchParams.delete('sslmode')
parsedDatabaseUrl.searchParams.delete('uselibpqcompat')

const pool = new Pool({
  connectionString: parsedDatabaseUrl.toString(),
  ssl: isLocalDatabase ? false : { rejectUnauthorized: true },
  // The client loads authenticated endpoints in parallel; one connection
  // leaves them waiting behind transactions until pg-pool times out.
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 30_000,
  keepAlive: true,
})

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error)
})

const app = express()
app.use(express.json({ limit: '10mb' }))

app.use((req, res, next) => {
  const allowedOrigin = process.env.CORS_ORIGIN
  if (allowedOrigin) {
    res.header('Access-Control-Allow-Origin', allowedOrigin)
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Credentials', 'true')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

const schemaReady = pool.query(`
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

  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    login TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  ALTER TABLE test_results ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS test_results_user_id_idx ON test_results (user_id);
  CREATE INDEX IF NOT EXISTS user_sessions_token_hash_idx ON user_sessions (token_hash);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS goal_score INTEGER;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_subjects JSONB NOT NULL DEFAULT '[]'::jsonb;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS attempts_remaining INTEGER NOT NULL DEFAULT 5;
  ALTER TABLE users ALTER COLUMN attempts_remaining SET DEFAULT 5;
  UPDATE users SET attempts_remaining = 5 WHERE role = 'user';

  DROP INDEX IF EXISTS user_sessions_user_id_idx;
`)

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 14
const hashSessionToken = (token) => createHash('sha256').update(token).digest('hex')
const publicUser = (user) => ({
  id: user.id,
  login: user.login,
  role: user.role,
  displayName: user.display_name,
  avatarUrl: user.avatar_url,
  goalScore: user.goal_score,
  selectedSubjects: user.selected_subjects ?? [],
  attemptsRemaining: user.attempts_remaining,
  createdAt: user.created_at,
})

const parseCookies = (header = '') =>
  Object.fromEntries(header.split(';').map((item) => item.trim().split(/=(.*)/s, 2)).filter(([key]) => key))

const hashPassword = async (password) => {
  const salt = randomBytes(16).toString('hex')
  const hash = (await scrypt(password, salt, 64)).toString('hex')
  return `${salt}:${hash}`
}

const passwordMatches = async (password, storedHash) => {
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) return false
  const candidate = Buffer.from((await scrypt(password, salt, 64)).toString('hex'), 'hex')
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

const setSessionCookie = (req, res, token) => {
  const secure = req.secure || req.get('x-forwarded-proto') === 'https'
  res.setHeader('Set-Cookie', [
    `ktprep_session=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${SESSION_DURATION_SECONDS}`,
    ...(secure ? ['Secure'] : []),
  ].join('; '))
}

const clearSessionCookie = (res) =>
  res.setHeader('Set-Cookie', 'ktprep_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0')

const currentUser = async (req) => {
  const token = parseCookies(req.headers.cookie).ktprep_session
  if (!token) return null
  const { rows } = await pool.query(
    `SELECT u.id, u.login, u.role, u.display_name, u.avatar_url, u.goal_score, u.selected_subjects, u.attempts_remaining, u.created_at
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashSessionToken(token)],
  )
  return rows[0] ?? null
}

const requireUser = async (req, res) => {
  await schemaReady
  const user = await currentUser(req)
  if (!user) {
    res.status(401).json({ error: 'Authentication required' })
    return null
  }
  return user
}

const requireAdmin = async (req, res) => {
  const user = await requireUser(req, res)
  if (!user) return null
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Доступен только администратору.' })
    return null
  }
  return user
}

app.get('/api/auth/me', async (req, res, next) => {
  try {
    await schemaReady
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ error: 'Not signed in' })
    res.json(publicUser(user))
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/register', async (req, res, next) => {
  let client
  try {
    const login = typeof req.body?.login === 'string' ? req.body.login.trim() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    if (!/^[a-zA-Z0-9_.@-]{3,64}$/.test(login)) {
      return res.status(400).json({ error: 'Логин: от 3 до 64 символов. Разрешены буквы, цифры и символы _, ., @, -.' })
    }
    if (password.length < 6) return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов.' })
    await schemaReady
    const passwordHash = await hashPassword(password)
    client = await pool.connect()
    await client.query('BEGIN')
    const { rows } = await client.query(
      'INSERT INTO users (login, password_hash) VALUES ($1, $2) RETURNING id, login, role, display_name, avatar_url, goal_score, selected_subjects, attempts_remaining, created_at',
      [login, passwordHash],
    )
    const token = randomBytes(32).toString('base64url')
    await client.query(
      'INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + $3::interval)',
      [rows[0].id, hashSessionToken(token), `${SESSION_DURATION_SECONDS} seconds`],
    )
    await client.query('COMMIT')
    setSessionCookie(req, res, token)
    res.status(201).json(publicUser(rows[0]))
  } catch (error) {
    if (client) await client.query('ROLLBACK')
    if (error.code === '23505' && error.constraint === 'users_login_key') {
      return res.status(409).json({ error: 'Этот логин уже занят.' })
    }
    next(error)
  } finally {
    client?.release()
  }
})

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const login = typeof req.body?.login === 'string' ? req.body.login.trim() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    await schemaReady
    const { rows } = await pool.query('SELECT * FROM users WHERE login = $1', [login])
    if (!rows[0] || !(await passwordMatches(password, rows[0].password_hash))) {
      return res.status(401).json({ error: 'Неверный логин или пароль.' })
    }
    const token = randomBytes(32).toString('base64url')
    await pool.query(
      'INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + $3::interval)',
      [rows[0].id, hashSessionToken(token), `${SESSION_DURATION_SECONDS} seconds`],
    )
    setSessionCookie(req, res, token)
    res.json(publicUser(rows[0]))
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/logout', async (req, res, next) => {
  try {
    const token = parseCookies(req.headers.cookie).ktprep_session
    if (token) await pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashSessionToken(token)])
    clearSessionCookie(res)
    res.sendStatus(204)
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/password', async (req, res, next) => {
  try {
    const user = await requireUser(req, res)
    if (!user) return
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : ''
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''
    if (newPassword.length < 6) return res.status(400).json({ error: 'Новый пароль должен содержать минимум 6 символов.' })
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.id])
    if (!rows[0] || !(await passwordMatches(currentPassword, rows[0].password_hash))) {
      return res.status(401).json({ error: 'Текущий пароль введён неверно.' })
    }
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(newPassword), user.id])
    res.sendStatus(204)
  } catch (error) {
    next(error)
  }
})

app.patch('/api/auth/profile', async (req, res, next) => {
  try {
    const user = await requireUser(req, res)
    if (!user) return
    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : ''
    const avatarUrl = typeof req.body?.avatarUrl === 'string' ? req.body.avatarUrl.trim() : ''
    const goalScore = Number(req.body?.goalScore)
    const selectedSubjects = Array.isArray(req.body?.selectedSubjects) ? req.body.selectedSubjects : []
    const validSubjects = ['tgo', 'english', 'databases', 'algorithms']
    if (displayName.length > 50) return res.status(400).json({ error: 'Имя должно быть не длиннее 50 символов.' })
    if (avatarUrl && (!/^https:\/\//.test(avatarUrl) || avatarUrl.length > 500)) return res.status(400).json({ error: 'Укажи корректную HTTPS-ссылку на аватар.' })
    if (!Number.isInteger(goalScore) || goalScore < 0 || goalScore > 140) return res.status(400).json({ error: 'Цель должна быть числом от 0 до 140.' })
    if (!selectedSubjects.every((subject) => validSubjects.includes(subject))) return res.status(400).json({ error: 'Некорректный предмет.' })
    const { rows } = await pool.query(
      `UPDATE users SET display_name = $1, avatar_url = $2, goal_score = $3, selected_subjects = $4::jsonb
       WHERE id = $5
       RETURNING id, login, role, display_name, avatar_url, goal_score, selected_subjects, attempts_remaining, created_at`,
      [displayName || null, avatarUrl || null, goalScore, JSON.stringify([...new Set(selectedSubjects)]), user.id],
    )
    res.json(publicUser(rows[0]))
  } catch (error) {
    next(error)
  }
})

app.get('/api/leaderboard', async (req, res, next) => {
  try {
    const period = ['all', 'week', 'month'].includes(req.query.period) ? req.query.period : 'all'
    await schemaReady
    const { rows } = await pool.query(
      `SELECT u.id, u.login, u.display_name, u.avatar_url,
              count(r.id)::int AS attempts,
              coalesce(sum(coalesce(r.data->>'score', r.data->>'correctAnswers')::int), 0)::int AS points,
              coalesce(round(avg((r.data->>'percentage')::numeric)), 0)::int AS average
         FROM users u
         LEFT JOIN test_results r ON r.user_id = u.id
           AND ($1 = 'all' OR (r.data->>'date')::timestamptz >= CASE WHEN $1 = 'week' THEN date_trunc('week', now()) ELSE date_trunc('month', now()) END)
        GROUP BY u.id
       HAVING count(r.id) > 0
        ORDER BY points DESC, average DESC, attempts DESC, u.created_at ASC
        LIMIT 50`,
      [period],
    )
    res.json(rows.map((row, index) => ({ id: row.id, login: row.login, displayName: row.display_name, avatarUrl: row.avatar_url, attempts: row.attempts, points: row.points, average: row.average, rank: index + 1 })))
  } catch (error) {
    next(error)
  }
})

app.get('/api/admin/users', async (req, res, next) => {
  try {
    if (!await requireAdmin(req, res)) return
    const { rows } = await pool.query('SELECT id, login, role, attempts_remaining, created_at FROM users ORDER BY created_at DESC')
    res.json(rows.map(publicUser))
  } catch (error) {
    next(error)
  }
})

app.patch('/api/admin/users/:id/role', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res)
    if (!admin) return
    const role = req.body?.role
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Некорректная роль.' })
    if (req.params.id === admin.id) return res.status(400).json({ error: 'Нельзя изменить собственную роль.' })
    if (role === 'user') {
      const { rows } = await pool.query("SELECT count(*)::int AS count FROM users WHERE role = 'admin'")
      if (rows[0].count < 2) return res.status(400).json({ error: 'В проекте должен остаться хотя бы один администратор.' })
    }
    const { rows } = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, login, role, attempts_remaining, created_at',
      [role, req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Пользователь не найден.' })
    res.json(publicUser(rows[0]))
  } catch (error) {
    next(error)
  }
})

app.post('/api/admin/users/:id/attempts', async (req, res, next) => {
  try {
    if (!await requireAdmin(req, res)) return
    const { rows } = await pool.query(
      `UPDATE users
          SET attempts_remaining = attempts_remaining + 1
        WHERE id = $1
      RETURNING id, login, role, attempts_remaining, created_at`,
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Пользователь не найден.' })
    res.json(publicUser(rows[0]))
  } catch (error) {
    next(error)
  }
})

app.post('/api/admin/users/:id/password', async (req, res, next) => {
  try {
    if (!await requireAdmin(req, res)) return
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''
    if (newPassword.length < 6) return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов.' })
    const { rows } = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id',
      [await hashPassword(newPassword), req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Пользователь не найден.' })
    await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [req.params.id])
    res.sendStatus(204)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/admin/users/:id', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res)
    if (!admin) return
    if (req.params.id === admin.id) return res.status(400).json({ error: 'Нельзя удалить собственный аккаунт.' })
    const { rows } = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Пользователь не найден.' })
    res.sendStatus(204)
  } catch (error) {
    next(error)
  }
})

const collectionRoutes = (route, table) => {
  app.get(`/api/${route}`, async (_req, res, next) => {
    try {
      await schemaReady
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

    let client
    try {
      await schemaReady
      client = await pool.connect()
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
      if (client) await client.query('ROLLBACK')
      next(error)
    } finally {
      client?.release()
    }
  })
}

collectionRoutes('questions', 'questions')

app.get('/api/results', async (req, res, next) => {
  try {
    const user = await requireUser(req, res)
    if (!user) return
    const { rows } = await pool.query(
      'SELECT data FROM test_results WHERE user_id = $1 ORDER BY position ASC NULLS LAST, id',
      [user.id],
    )
    res.json(rows.map((row) => row.data))
  } catch (error) {
    next(error)
  }
})

app.post('/api/results', async (req, res, next) => {
  let client
  try {
    const user = await requireUser(req, res)
    if (!user) return
    const result = req.body
    if (!result?.id || typeof result.id !== 'string' || !['subject', 'random', 'kt', 'kt-hard'].includes(result.mode)) {
      return res.status(400).json({ error: 'Некорректный результат теста.' })
    }
    client = await pool.connect()
    await client.query('BEGIN')
    const updated = user.role === 'admin'
      ? { rows: [{ attempts_remaining: user.attempts_remaining }] }
      : await client.query(
        `UPDATE users
            SET attempts_remaining = attempts_remaining - 1
          WHERE id = $1 AND attempts_remaining > 0
        RETURNING attempts_remaining`,
        [user.id],
      )
    if (!updated.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(403).json({ error: 'Попытка уже использована. Обратитесь к администратору, чтобы открыть пересдачу.' })
    }
    const position = await client.query('SELECT coalesce(max(position), -1) + 1 AS position FROM test_results WHERE user_id = $1', [user.id])
    await client.query(
      'INSERT INTO test_results (id, data, position, user_id) VALUES ($1, $2::jsonb, $3, $4)',
      [result.id, JSON.stringify(result), position.rows[0].position, user.id],
    )
    await client.query('COMMIT')
    res.status(201).json({ result, attemptsRemaining: updated.rows[0].attempts_remaining })
  } catch (error) {
    if (client) await client.query('ROLLBACK')
    next(error)
  } finally {
    client?.release()
  }
})

app.get('/api/health', async (_req, res, next) => {
  try {
    await schemaReady
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
  res.status(500).json({
    error: 'Database request failed',
    code: error.code,
    detail: error.message,
  })
})

app.listen(port, () => {
  console.log(`KT Prep server is running on http://localhost:${port}`)
  schemaReady
    .then(() => console.log('PostgreSQL connection is ready'))
    .catch((error) => console.error('PostgreSQL connection failed:', error))
})
