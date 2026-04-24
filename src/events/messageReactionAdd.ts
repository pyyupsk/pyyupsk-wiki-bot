import {
  Events,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from "discord.js";
import { logger } from "@/lib/logger";
import { safe } from "@/lib/safe";
import { isOwner } from "@/services/allowlist";

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

    let isAsker = false;
    if (msg.reference?.messageId) {
      const [err, ref] = await safe(msg.fetchReference());
      isAsker = !err && ref.author.id === user.id;
    }

    if (!isOwner(user.id) && !isAsker) return;

    const [delErr] = await safe(msg.delete());
    if (delErr) logger.warn("delete failed", { err: delErr.message });
  },
};
