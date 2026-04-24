import { Events } from "discord.js";
import { logger } from "@/lib/logger";

export const ready = {
  name: Events.ClientReady,
  once: true,
  execute: (client: import("discord.js").Client<true>) => {
    logger.info(`logged in as ${client.user.tag}`);
  },
};
