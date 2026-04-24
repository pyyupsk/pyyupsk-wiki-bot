import { env } from "../env";
import { db } from "./db";

const selectStmt = db.prepare<{ user_id: string }, [string]>(
  `SELECT user_id FROM allowlist WHERE user_id = ?`,
);
const insertStmt = db.prepare<unknown, [string, string, number]>(
  `INSERT OR REPLACE INTO allowlist (user_id, added_by, added_at) VALUES (?, ?, ?)`,
);
const deleteStmt = db.prepare<unknown, [string]>(`DELETE FROM allowlist WHERE user_id = ?`);
const listStmt = db.prepare<{ user_id: string; added_by: string; added_at: number }, []>(
  `SELECT user_id, added_by, added_at FROM allowlist ORDER BY added_at DESC`,
);

export function isOwner(userId: string): boolean {
  return Boolean(env.DISCORD_OWNER_ID) && userId === env.DISCORD_OWNER_ID;
}

export function isAllowed(userId: string): boolean {
  if (!env.DISCORD_OWNER_ID) return true;
  if (userId === env.DISCORD_OWNER_ID) return true;
  return selectStmt.get(userId) !== null;
}

export function addAllowed(userId: string, addedBy: string): void {
  insertStmt.run(userId, addedBy, Date.now());
}

export function removeAllowed(userId: string): void {
  deleteStmt.run(userId);
}

export type AllowEntry = { userId: string; addedBy: string; addedAt: Date };

export function listAllowed(): AllowEntry[] {
  return listStmt.all().map((r) => ({
    userId: r.user_id,
    addedBy: r.added_by,
    addedAt: new Date(r.added_at),
  }));
}
