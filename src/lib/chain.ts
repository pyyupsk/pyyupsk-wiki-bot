import type { Message } from "discord.js";

const MAX_DEPTH = 6;

export type ChainTurn = { role: "user" | "assistant"; content: string };

function stripMention(content: string, botId: string): string {
  return content.replaceAll(`<@${botId}>`, "").trim();
}

function extractEmbedText(msg: Message): string {
  const parts: string[] = [];
  for (const e of msg.embeds) {
    if (e.title) parts.push(e.title);
    if (e.description) parts.push(e.description);
    for (const f of e.fields) parts.push(`${f.name}: ${f.value}`);
  }
  return parts.join("\n");
}

export async function walkReplyChain(message: Message, botId: string): Promise<ChainTurn[]> {
  const turns: ChainTurn[] = [];
  let cursor: Message | null = message;
  let depth = 0;

  while (cursor?.reference?.messageId && depth < MAX_DEPTH) {
    let prev: Message;
    try {
      prev = await cursor.fetchReference();
    } catch {
      break;
    }

    const isBot = prev.author.id === botId;
    const content = isBot
      ? prev.content.trim() || extractEmbedText(prev)
      : stripMention(prev.content, botId);

    if (content) turns.unshift({ role: isBot ? "assistant" : "user", content });

    cursor = prev;
    depth++;
  }

  return turns;
}

export function formatTranscript(turns: ChainTurn[], current: string): string {
  if (turns.length === 0) return current;
  const history = turns
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
    .join("\n\n");
  return `Previous conversation:\n${history}\n\nCurrent question: ${current}`;
}
