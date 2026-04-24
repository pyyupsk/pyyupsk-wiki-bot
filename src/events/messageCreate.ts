import { Events, type Message } from "discord.js";
import { formatTranscript, stripMention, walkReplyChain } from "../lib/chain";
import { logger } from "../lib/logger";
import { safe } from "../lib/safe";
import { isAllowed } from "../services/allowlist";
import { getConfig } from "../services/config";
import { renderReply } from "../services/render";
import { recordQuery } from "../services/stats";
import { askWiki } from "../services/wiki";

export const messageCreate = {
  name: Events.MessageCreate,
  once: false,
  execute: async (message: Message) => {
    if (message.author.bot) return;
    const me = message.client.user;
    if (!me || !message.mentions.has(me.id)) return;

    const prompt = stripMention(message.content, me.id);
    if (!prompt) return;
    if (!isAllowed(message.author.id)) return;

    if ("sendTyping" in message.channel) await safe(message.channel.sendTyping());
    if (getConfig("lookup_reaction")) await safe(message.react(":eyes:"));

    const turns = getConfig("reply_chain") ? await walkReplyChain(message, me.id) : [];
    const fullPrompt = formatTranscript(turns, prompt);
    if (turns.length > 0) logger.info("reply chain", { depth: turns.length });

    const [err, result] = await askWiki(fullPrompt);
    if (err) {
      logger.error("askWiki failed", { err: err.message });
      await message.reply(`error: ${err.message}`);
      return;
    }

    if (result.usage) {
      recordQuery({ ...result.usage, user_id: message.author.id, source: "mention" });
    }
    await message.reply(renderReply(result.reply));
  },
};
