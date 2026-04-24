import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { logger } from "../lib/logger";

const DB_PATH = ".local/bot.db";
const LEGACY_DBS = [".local/stats.db", ".local/allowlist.db", ".local/config.db"];

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH, { create: true });
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    source TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cache_read INTEGER NOT NULL,
    cache_create INTEGER NOT NULL,
    cost_usd REAL NOT NULL,
    duration_ms INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_queries_ts ON queries(ts)`,
  `CREATE INDEX IF NOT EXISTS idx_queries_user ON queries(user_id)`,
  `CREATE TABLE IF NOT EXISTS allowlist (
    user_id TEXT PRIMARY KEY,
    added_by TEXT NOT NULL,
    added_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
];

for (const stmt of SCHEMA) db.run(stmt);

migrateLegacy();

function migrateLegacy() {
  const pending = LEGACY_DBS.filter((f) => existsSync(f));
  if (pending.length === 0) return;

  logger.info("migrating legacy databases", { files: pending });

  const attachName: Record<string, string> = {
    ".local/stats.db": "legacy_stats",
    ".local/allowlist.db": "legacy_allow",
    ".local/config.db": "legacy_config",
  };

  const copy: Record<string, string> = {
    legacy_stats: `INSERT OR IGNORE INTO queries SELECT * FROM legacy_stats.queries`,
    legacy_allow: `INSERT OR IGNORE INTO allowlist SELECT * FROM legacy_allow.allowlist`,
    legacy_config: `INSERT OR REPLACE INTO config SELECT * FROM legacy_config.config`,
  };

  for (const file of pending) {
    const alias = attachName[file];
    if (!alias) continue;
    db.run(`ATTACH DATABASE '${file}' AS ${alias}`);
    db.run(copy[alias] ?? "");
    db.run(`DETACH DATABASE ${alias}`);
    unlinkSync(file);
    logger.info("migrated + removed legacy db", { file });
  }
}
