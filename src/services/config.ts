import { env } from "../env";
import { db } from "./db";

const MODEL_CHOICES = ["haiku", "sonnet", "opus"] as const;
export type ModelChoice = (typeof MODEL_CHOICES)[number];

export type ConfigSchema = {
  claude_model: ModelChoice;
  thb_rate: number;
  reply_chain: boolean;
  lookup_reaction: boolean;
};

export type ConfigKey = keyof ConfigSchema;

const DEFAULTS: ConfigSchema = {
  claude_model: (env.CLAUDE_MODEL as ModelChoice) ?? "haiku",
  thb_rate: 34,
  reply_chain: true,
  lookup_reaction: true,
};

export const CONFIG_KEYS: ConfigKey[] = Object.keys(DEFAULTS) as ConfigKey[];

const selectStmt = db.prepare<{ value: string }, [string]>(
  `SELECT value FROM config WHERE key = ?`,
);
const upsertStmt = db.prepare<unknown, [string, string, string, number]>(
  `INSERT OR REPLACE INTO config (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)`,
);
const deleteStmt = db.prepare<unknown, [string]>(`DELETE FROM config WHERE key = ?`);

function parseValue<K extends ConfigKey>(key: K, raw: string): ConfigSchema[K] {
  if (key === "thb_rate") return Number(raw) as ConfigSchema[K];
  if (key === "reply_chain" || key === "lookup_reaction") {
    return (raw === "true") as ConfigSchema[K];
  }
  return raw as ConfigSchema[K];
}

export function getConfig<K extends ConfigKey>(key: K): ConfigSchema[K] {
  const row = selectStmt.get(key);
  if (!row) return DEFAULTS[key];
  return parseValue(key, row.value);
}

export function getAllConfig(): Record<ConfigKey, { value: string; overridden: boolean }> {
  const out = {} as Record<ConfigKey, { value: string; overridden: boolean }>;
  for (const key of CONFIG_KEYS) {
    const row = selectStmt.get(key);
    out[key] = { value: row ? row.value : String(DEFAULTS[key]), overridden: row !== null };
  }
  return out;
}

export type ValidationError = { ok: false; error: string };
export type ValidationOk = { ok: true; normalized: string };
export type ValidationResult = ValidationOk | ValidationError;

export function validate(key: ConfigKey, raw: string): ValidationResult {
  if (key === "claude_model") {
    const v = raw.trim().toLowerCase();
    if (!MODEL_CHOICES.includes(v as ModelChoice)) {
      return { ok: false, error: `must be one of: ${MODEL_CHOICES.join(", ")}` };
    }
    return { ok: true, normalized: v };
  }
  if (key === "thb_rate") {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "must be a positive number" };
    return { ok: true, normalized: String(n) };
  }
  if (key === "reply_chain" || key === "lookup_reaction") {
    const v = raw.trim().toLowerCase();
    if (v !== "true" && v !== "false") return { ok: false, error: "must be 'true' or 'false'" };
    return { ok: true, normalized: v };
  }
  return { ok: false, error: "unknown key" };
}

export function setConfig(key: ConfigKey, raw: string, updatedBy: string): ValidationResult {
  const res = validate(key, raw);
  if (!res.ok) return res;
  upsertStmt.run(key, res.normalized, updatedBy, Date.now());
  return res;
}

export function resetConfig(key: ConfigKey): void {
  deleteStmt.run(key);
}
