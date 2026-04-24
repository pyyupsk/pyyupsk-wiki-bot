import { env } from "@/env";
import { logger } from "@/lib/logger";
import { safe } from "@/lib/safe";

export const SYSTEM = `Discord bot. Reply to user from wiki below.

WIKI (read-only):
- Hotcache embedded. Read first.
- Deeper details: Read/Glob/Grep in wiki dir.
- Never modify wiki files.
- Greetings/meta/chit-chat: skip wiki, answer direct.

OUTPUT: ONE JSON object. No prose, no fences. Synthesize in own words.

Shape (pick 1):
  {"type":"text","content":"..."}
  {"type":"embed","title"?,"description"?,"url"?,"color"?,"fields"?,"footer"?}

RULES:
- "embed": lists, links, sections, metadata.
- "text": short replies, greetings.
- Limits: content 2000, desc 4000, field value 1024.
- No answer: {"type":"text","content":"Not found in wiki."}

EX:
"yo" → {"type":"text","content":"hey!"}
"list projects" → {"type":"embed","title":"Projects","fields":[{"name":"nit","value":"..."}]}`;

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
  if (hotcacheCache?.mtime === mtime) return hotcacheCache.text;

  const [readErr, text] = await safe(file.text());
  if (readErr) return "";
  hotcacheCache = { mtime, text };
  return text;
}

export function buildSystemPrompt(hotcache: string): string {
  return `${SYSTEM}\n\n--- HOTCACHE ---\n${hotcache}\n--- END ---\n\nAnswer from hotcache. Deeper: Read tool on ${env.WIKI_DIR}.`;
}
