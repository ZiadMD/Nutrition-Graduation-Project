// Deletes the database file, applies the schema, and runs the seed.
// Run with: npm run db:reset
// Safe to run as many times as you like — always starts fresh.

import { existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../../data')
const DB_PATH = join(DATA_DIR, 'rebound.db')

// Make sure the data/ folder exists before we try to create the file inside it.
mkdirSync(DATA_DIR, { recursive: true })

if (existsSync(DB_PATH)) {
  try {
    unlinkSync(DB_PATH)
    console.log('Deleted old database.')
  } catch (err) {
    if (err.code === 'EBUSY') {
      // On Windows, if a running dev server process has the file open, we can
      // drop all tables and views instead of failing with EBUSY.
      const { default: Database } = await import('better-sqlite3')
      const clearDb = new Database(DB_PATH)
      clearDb.pragma('foreign_keys = OFF')
      const tables = clearDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
      for (const t of tables) {
        clearDb.exec(`DROP TABLE IF EXISTS "${t.name}"`)
      }
      clearDb.close()
      console.log('Cleared existing database tables (file was open by running server).')
    } else {
      throw err
    }
  }
}

console.log('Applying schema...')
// Apply schema using better-sqlite3 directly so we don't need the sqlite3 CLI.
// We import Database here (not from connection.js) because connection.js would
// try to open a file that does not exist yet — the order matters.
const { default: Database } = await import('better-sqlite3')
const { readFileSync } = await import('node:fs')

const db = new Database(DB_PATH)
db.pragma('foreign_keys = ON')
db.pragma('journal_mode = WAL')

const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
db.exec(schema)
console.log('Schema applied.')

db.close()

console.log('Running seed...')
// Run seed.js as a child process so it gets its own import context.
execSync('node src/db/seed.js', {
  cwd: join(__dirname, '../../'),
  stdio: 'inherit',
})

console.log('Done. Database is ready.')

