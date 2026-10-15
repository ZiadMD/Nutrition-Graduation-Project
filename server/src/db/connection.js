// Opens the SQLite database and sets the required PRAGMAs.
// Every module that needs the database imports this file.
// better-sqlite3 is synchronous, which keeps the code simple and readable.

import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

// Resolve the path to the data folder relative to this file, not the
// working directory — so it works no matter where you run the server from.
const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '../../data/rebound.db')

const db = new Database(DB_PATH)

// Turn on foreign key enforcement (SQLite ignores them by default).
db.pragma('foreign_keys = ON')

// WAL mode gives better read/write concurrency and is safer on crashes.
db.pragma('journal_mode = WAL')

export default db

