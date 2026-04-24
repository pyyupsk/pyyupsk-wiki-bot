import { Events, type Interaction, MessageFlags } from "discord.js";
import type { BotClient } from "../client";
import { logger } from "../lib/logger";

export const interactionCreate = {
  name: Events.InteractionCreate,
  once: false,
  execute: async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const client = interaction.client as BotClient;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error("command failed", { name: interaction.commandName, err: String(err) });
      const reply = { content: "command failed", flags: MessageFlags.Ephemeral } as const;
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  },
};
