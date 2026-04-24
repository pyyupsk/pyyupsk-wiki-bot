import { z } from "zod";
import { env } from "../../env";
import { logger } from "../../lib/logger";
import { safe } from "../../lib/safe";
import { getConfig } from "../config";
import { buildSystemPrompt, readHotcache } from "./prompt";
import { claudeResultSchema, OUTPUT_JSON_SCHEMA, type WikiReply, wikiReplySchema } from "./schemas";

export { type WikiReply, wikiReplySchema } from "./schemas";

export type QueryUsage = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_create: number;
  cost_usd: number;
  duration_ms: number;
};

export type AskResult = {
  reply: WikiReply;
  usage: QueryUsage | null;
};

function tryParseJson<T = unknown>(raw: string): [Error, null] | [null, T] {
  try {
    return [null, JSON.parse(raw) as T];
  } catch (e) {
    return [e instanceof Error ? e : new Error(String(e)), null];
  }
}

const FENCE_RE = /^```(?:json)?\s*([\s\S]*?)\s*```$/;

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = FENCE_RE.exec(trimmed);
  if (fenceMatch?.[1]) return fenceMatch[1];
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export async function askWiki(prompt: string): Promise<[Error, null] | [null, AskResult]> {
  const model = getConfig("claude_model");
  logger.info("wiki query", { prompt, model });

  const hotcache = await readHotcache();
  const systemPrompt = buildSystemPrompt(hotcache);

  const proc = Bun.spawn(
    [
      env.CLAUDE_BIN,
      "-p",
      "--model",
      model,
      "--output-format",
      "json",
      "--permission-mode",
      "bypassPermissions",
      "--setting-sources",
      "",
      "--strict-mcp-config",
      "--mcp-config",
      '{"mcpServers":{}}',
      "--tools",
      "Read,Glob,Grep",
      "--add-dir",
      env.WIKI_DIR,
      "--system-prompt",
      systemPrompt,
      "--json-schema",
      JSON.stringify(OUTPUT_JSON_SCHEMA),
      prompt,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const [readErr, stdout] = await safe(new Response(proc.stdout).text());
  if (readErr) return [readErr, null];

  const code = await proc.exited;
  if (code !== 0) {
    const stderr = await new Response(proc.stderr).text();
    return [new Error(`claude exited ${code}: ${stderr.slice(0, 500)}`), null];
  }

  const [envErr, envelope] = tryParseJson(stdout);
  if (envErr) return [new Error(`invalid envelope: ${envErr.message}`), null];

  const parsed = claudeResultSchema.safeParse(envelope);
  if (!parsed.success) {
    return [new Error(`envelope schema: ${z.prettifyError(parsed.error)}`), null];
  }

  const { is_error, result, structured_output, total_cost_usd, duration_ms, usage } = parsed.data;

  const queryUsage: QueryUsage | null = usage
    ? {
        model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read: usage.cache_read_input_tokens ?? 0,
        cache_create: usage.cache_creation_input_tokens ?? 0,
        cost_usd: total_cost_usd ?? 0,
        duration_ms: duration_ms ?? 0,
      }
    : null;

  if (queryUsage) {
    logger.info("claude usage", {
      input: queryUsage.input_tokens,
      output: queryUsage.output_tokens,
      cache_read: queryUsage.cache_read,
      cache_create: queryUsage.cache_create,
      cost_usd: queryUsage.cost_usd.toFixed(6),
      duration_ms: queryUsage.duration_ms,
    });
  }

  if (is_error) return [new Error("claude returned error"), null];

  const candidate = structured_output ?? (result ? tryParseJson(extractJson(result))[1] : null);
  const replyParsed = wikiReplySchema.safeParse(candidate);
  if (!replyParsed.success) {
    const fallback = result?.trim() || JSON.stringify(candidate);
    logger.warn("schema mismatch, wrapping as text", {
      err: z.prettifyError(replyParsed.error),
      preview: fallback.slice(0, 200),
    });
    return [null, { reply: { type: "text", content: fallback.slice(0, 2000) }, usage: queryUsage }];
  }

  return [null, { reply: replyParsed.data, usage: queryUsage }];
}
