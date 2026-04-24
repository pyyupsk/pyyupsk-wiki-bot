import { db } from "./db";

export type QuerySource = "slash" | "mention";

export type QueryRecord = {
  user_id: string;
  source: QuerySource;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_create: number;
  cost_usd: number;
  duration_ms: number;
};

const insertStmt = db.prepare(`
  INSERT INTO queries (ts, user_id, source, model, input_tokens, output_tokens, cache_read, cache_create, cost_usd, duration_ms)
  VALUES ($ts, $user_id, $source, $model, $input_tokens, $output_tokens, $cache_read, $cache_create, $cost_usd, $duration_ms)
`);

export function recordQuery(record: QueryRecord) {
  insertStmt.run({
    $ts: Date.now(),
    $user_id: record.user_id,
    $source: record.source,
    $model: record.model,
    $input_tokens: record.input_tokens,
    $output_tokens: record.output_tokens,
    $cache_read: record.cache_read,
    $cache_create: record.cache_create,
    $cost_usd: record.cost_usd,
    $duration_ms: record.duration_ms,
  });
}

export type StatsSummary = {
  queries: number;
  users: number;
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_create: number;
  cost_usd: number;
  avg_duration_ms: number;
  first_ts: number | null;
};

export function getSummary(sinceMs = 0): StatsSummary {
  const row = db
    .query<StatsSummary, { $since: number }>(`
      SELECT
        COUNT(*) AS queries,
        COUNT(DISTINCT user_id) AS users,
        COALESCE(SUM(input_tokens), 0) AS input_tokens,
        COALESCE(SUM(output_tokens), 0) AS output_tokens,
        COALESCE(SUM(cache_read), 0) AS cache_read,
        COALESCE(SUM(cache_create), 0) AS cache_create,
        COALESCE(SUM(cost_usd), 0) AS cost_usd,
        COALESCE(AVG(duration_ms), 0) AS avg_duration_ms,
        MIN(ts) AS first_ts
      FROM queries WHERE ts >= $since
    `)
    .get({ $since: sinceMs });

  return (
    row ?? {
      queries: 0,
      users: 0,
      input_tokens: 0,
      output_tokens: 0,
      cache_read: 0,
      cache_create: 0,
      cost_usd: 0,
      avg_duration_ms: 0,
      first_ts: null,
    }
  );
}

export function getTopUsers(limit = 5, sinceMs = 0): { user_id: string; count: number }[] {
  return db
    .query<{ user_id: string; count: number }, { $since: number; $limit: number }>(`
      SELECT user_id, COUNT(*) AS count
      FROM queries WHERE ts >= $since
      GROUP BY user_id ORDER BY count DESC LIMIT $limit
    `)
    .all({ $since: sinceMs, $limit: limit });
}

export function getModelBreakdown(
  sinceMs = 0,
): { model: string; count: number; cost_usd: number }[] {
  return db
    .query<{ model: string; count: number; cost_usd: number }, { $since: number }>(`
      SELECT model, COUNT(*) AS count, COALESCE(SUM(cost_usd), 0) AS cost_usd
      FROM queries WHERE ts >= $since
      GROUP BY model ORDER BY count DESC
    `)
    .all({ $since: sinceMs });
}
