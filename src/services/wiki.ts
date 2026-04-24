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

const SYSTEM = `You are a Discord bot responding to the user.

WIKI (cost-saving):
- For substantive questions about projects/tools/notes: check wiki-llms:hotcache FIRST (~500 words of key facts). Only invoke wiki-llms:query if hotcache is insufficient.
- For casual greetings ("yo", "hi"), meta questions, or general chat: skip the wiki entirely, respond conversationally.

OUTPUT: You MUST return ONLY valid JSON. No prose. No markdown fences. No explanation.

Schema (pick ONE):
  { "type": "text", "content": "short conversational answer" }

  { "type": "embed", "title"?, "description"?, "url"?, "color"?: "#RRGGBB" | number,
    "fields"?: [{"name","value","inline"?}], "footer"? }

RULES:
- Pick "embed" when the answer has structure: lists, links, multiple sections, metadata.
- Pick "text" for short, conversational, single-paragraph answers, greetings, chit-chat.
- content max 2000 chars, description max 4000, each field value max 1024.
- If the wiki has no answer, return { "type": "text", "content": "Not found in wiki." }

EXAMPLES:
User: "yo"
Response: {"type":"text","content":"hey! what's up?"}

User: "what is Convex?"
Response: {"type":"embed","title":"Convex","description":"..."}`;

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  if (fence?.[1]) return fence[1];
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function tryParseJson(raw: string): [Error, null] | [null, unknown] {
  try {
    return [null, JSON.parse(raw)];
  } catch (e) {
    return [e instanceof Error ? e : new Error(String(e)), null];
  }
}

export async function askWiki(prompt: string): Promise<[Error, null] | [null, WikiReply]> {
  logger.info("wiki query", { prompt, model: env.CLAUDE_MODEL });

  const proc = Bun.spawn(
    [env.CLAUDE_BIN, "-p", "--model", env.CLAUDE_MODEL, "--append-system-prompt", SYSTEM, prompt],
    { stdout: "pipe", stderr: "pipe" },
  );

  const [readErr, stdout] = await safe(new Response(proc.stdout).text());
  if (readErr) return [readErr, null];

  const code = await proc.exited;
  if (code !== 0) {
    const stderr = await new Response(proc.stderr).text();
    return [new Error(`claude exited ${code}: ${stderr.slice(0, 500)}`), null];
  }

  const extracted = extractJson(stdout);
  const [parseErr, json] = tryParseJson(extracted);
  if (parseErr) {
    logger.warn("non-JSON response, wrapping as text", { preview: stdout.slice(0, 100) });
    return [null, { type: "text", content: stdout.trim().slice(0, 2000) }];
  }

  const result = wikiReplySchema.safeParse(json);
  if (!result.success) {
    logger.warn("schema mismatch, wrapping as text", {
      err: z.prettifyError(result.error),
    });
    return [null, { type: "text", content: stdout.trim().slice(0, 2000) }];
  }

  return [null, result.data];
}
