import { Events, type Message } from "discord.js";

export const messageCreate = {
  name: Events.MessageCreate,
  once: false,
  execute: async (message: Message) => {
    if (message.author.bot) return;
    const me = message.client.user;
    if (!me || !message.mentions.has(me.id)) return;

    const prompt = message.content.replaceAll(`<@${me.id}>`, "").trim();
    if (!prompt) return;

    // TODO: wiki service + render
    await message.reply(`got: ${prompt}`);
  },
};
