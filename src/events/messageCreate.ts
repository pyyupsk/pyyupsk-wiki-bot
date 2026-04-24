import { Events, type Message } from "discord.js";
import { logger } from "../lib/logger";
import { renderReply } from "../services/render";
import { askWiki } from "../services/wiki";

export const messageCreate = {
  name: Events.MessageCreate,
  once: false,
  execute: async (message: Message) => {
    if (message.author.bot) return;
    const me = message.client.user;
    if (!me || !message.mentions.has(me.id)) return;

    const prompt = message.content.replaceAll(`<@${me.id}>`, "").trim();
    if (!prompt) return;

    if ("sendTyping" in message.channel) await message.channel.sendTyping().catch(() => {});
    const [err, reply] = await askWiki(prompt);
    if (err) {
      logger.error("askWiki failed", { err: err.message });
      await message.reply(`error: ${err.message}`);
      return;
    }

    await message.reply(renderReply(reply));
  },
};
