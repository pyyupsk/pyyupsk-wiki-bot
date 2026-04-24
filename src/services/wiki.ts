import { z } from "zod";
import { env } from "../env";
import { logger } from "../lib/logger";
import { safe } from "../lib/safe";

const embedFieldSchema = z.object({
  name: z.string().max(256),
  value: z.string().max(1024),
  inline: z.boolean().optional(),
});

const embedReplySchema = z.object({
  type: z.literal("embed"),
  title: z.string().max(256).optional(),
  description: z.string().max(4000).optional(),
  url: z.url().optional(),
  color: z
    .union([z.number().int().min(0).max(0xffffff), z.string().regex(/^#?[0-9a-f]{6}$/i)])
    .optional(),
  fields: z.array(embedFieldSchema).max(25).optional(),
  footer: z.string().max(2048).optional(),
});

const textReplySchema = z.object({
  type: z.literal("text"),
  content: z.string().min(1).max(2000),
});

export const wikiReplySchema = z.discriminatedUnion("type", [textReplySchema, embedReplySchema]);
export type WikiReply = z.infer<typeof wikiReplySchema>;

const OUTPUT_SCHEMA = {
  type: "object",
  required: ["type"],
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: ["text", "embed"] },
    content: { type: "string", maxLength: 2000 },
    title: { type: "string", maxLength: 256 },
    description: { type: "string", maxLength: 4000 },
    url: { type: "string" },
    color: { type: "string" },
    fields: {
      type: "array",
      maxItems: 25,
      items: {
        type: "object",
        required: ["name", "value"],
        additionalProperties: false,
        properties: {
          name: { type: "string", maxLength: 256 },
          value: { type: "string", maxLength: 1024 },
          inline: { type: "boolean" },
        },
      },
    },
    footer: { type: "string", maxLength: 2048 },
  },
};

const SYSTEM = `You are a Discord bot replying to the user.

WIKI ACCESS (READ-ONLY):
- For substantive questions: use wiki-llms:query to READ the wiki.
- You MAY also directly Read hotcache.md / index.md / specific pages from the wiki directory.
- DO NOT run wiki-llms:ingest, :lint, :hotcache (refresh), or any mutating operation.
- DO NOT report wiki-maintenance diffs or status updates.
- For greetings, meta, or chit-chat: skip the wiki entirely.

OUTPUT: Return ONLY a single JSON object in your final message. No prose, no markdown fences, no skill output passthrough. YOU synthesize the answer in your own words.

Schema (pick ONE):
  {"type":"text","content":"..."}
  {"type":"embed","title"?,"description"?,"url"?,"color"?,"fields"?,"footer"?}

RULES:
- "embed" for structured info (lists, links, multiple sections, metadata).
- "text" for short conversational replies, greetings, chit-chat.
- content max 2000, description max 4000, each field value max 1024.
- If wiki has no answer: {"type":"text","content":"Not found in wiki."}

EXAMPLES:
User: "yo" → {"type":"text","content":"hey!"}
User: "list my projects" → {"type":"embed","title":"Projects","fields":[{"name":"slappos","value":"..."}]}`;

const claudeResultSchema = z.object({
  is_error: z.boolean(),
  result: z.string().optional(),
  structured_output: z.unknown().optional(),
  total_cost_usd: z.number().optional(),
  duration_ms: z.number().optional(),
  usage: z
    .object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      cache_read_input_tokens: z.number().optional(),
      cache_creation_input_tokens: z.number().optional(),
    })
    .optional(),
});

function tryParseJson<T = unknown>(raw: string): [Error, null] | [null, T] {
  try {
    return [null, JSON.parse(raw) as T];
  } catch (e) {
    return [e instanceof Error ? e : new Error(String(e)), null];
  }
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed); // NOSONAR - \s and [\s\S] are required regex shorthands, not literal escapes
  if (fence?.[1]) return fence[1];
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export async function askWiki(prompt: string): Promise<[Error, null] | [null, WikiReply]> {
  logger.info("wiki query", { prompt, model: env.CLAUDE_MODEL });

  const proc = Bun.spawn(
    [
      env.CLAUDE_BIN,
      "-p",
      "--model",
      env.CLAUDE_MODEL,
      "--output-format",
      "json",
      "--permission-mode",
      "bypassPermissions",
      "--add-dir",
      env.WIKI_DIR,
      "--append-system-prompt",
      SYSTEM,
      "--json-schema",
      JSON.stringify(OUTPUT_SCHEMA),
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

  const env_ = claudeResultSchema.safeParse(envelope);
  if (!env_.success) return [new Error(`envelope schema: ${z.prettifyError(env_.error)}`), null];

  const { is_error, result, structured_output, total_cost_usd, duration_ms, usage } = env_.data;

  if (usage) {
    logger.info("claude usage", {
      input: usage.input_tokens,
      output: usage.output_tokens,
      cache_read: usage.cache_read_input_tokens ?? 0,
      cache_create: usage.cache_creation_input_tokens ?? 0,
      cost_usd: total_cost_usd?.toFixed(6),
      duration_ms,
    });
  }

  if (is_error) return [new Error("claude returned error"), null];

  const candidate = structured_output ?? (result ? tryParseJson(extractJson(result))[1] : null);
  const parsed = wikiReplySchema.safeParse(candidate);
  if (!parsed.success) {
    const fallback = result?.trim() || JSON.stringify(candidate);
    logger.warn("schema mismatch, wrapping as text", {
      err: z.prettifyError(parsed.error),
      preview: fallback.slice(0, 200),
    });
    return [null, { type: "text", content: fallback.slice(0, 2000) }];
  }

  return [null, parsed.data];
}
