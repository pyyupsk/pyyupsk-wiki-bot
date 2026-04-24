import { env } from "@/env";
import { logger } from "@/lib/logger";
import { safe } from "@/lib/safe";

export const SYSTEM = `You are a Discord bot replying to the user.

WIKI ACCESS (READ-ONLY):
- The wiki hotcache is embedded below. Read it first.
- For deeper details, use the Read/Glob/Grep tools on files in the wiki directory.
- DO NOT modify any wiki file.
- For greetings, meta, or chit-chat: answer directly, skip the wiki.

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

let hotcacheCache: { mtime: number; text: string } | null = null;

export async function readHotcache(): Promise<string> {
  const path = `${env.WIKI_DIR}/hotcache.md`;
  const file = Bun.file(path);
  const [statErr, stat] = await safe(file.stat());
  if (statErr) {
    logger.warn("hotcache.md not found", { path });
    return "";
  }
  const mtime = stat.mtimeMs;
  if (hotcacheCache && hotcacheCache.mtime === mtime) return hotcacheCache.text;

  const [readErr, text] = await safe(file.text());
  if (readErr) return "";
  hotcacheCache = { mtime, text };
  return text;
}

export function buildSystemPrompt(hotcache: string): string {
  return `${SYSTEM}\n\n--- WIKI HOTCACHE ---\n${hotcache}\n--- END HOTCACHE ---\n\nAnswer from the hotcache above. For deeper details, use the Read tool on files under ${env.WIKI_DIR}.`;
}
