import {
  Events,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from "discord.js";
import { env } from "../env";
import { logger } from "../lib/logger";
import { safe } from "../lib/safe";

const TRASH = "🗑️";

export const messageReactionAdd = {
  name: Events.MessageReactionAdd,
  once: false,
  execute: async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    if (user.bot) return;
    if (reaction.emoji.name !== TRASH) return;

    if (reaction.partial) {
      const [err] = await safe(reaction.fetch());
      if (err) return;
    }

    const msg = reaction.message.partial
      ? (await safe(reaction.message.fetch()))[1]
      : reaction.message;
    if (!msg) return;

    const me = msg.client.user?.id;
    if (msg.author.id !== me) return;

    const isOwner = env.DISCORD_OWNER_ID && user.id === env.DISCORD_OWNER_ID;

    let isAsker = false;
    if (msg.reference?.messageId) {
      const [err, ref] = await safe(msg.fetchReference());
      isAsker = !err && ref.author.id === user.id;
    }

    if (!isOwner && !isAsker) return;

    const [delErr] = await safe(msg.delete());
    if (delErr) logger.warn("delete failed", { err: delErr.message });
  },
};
