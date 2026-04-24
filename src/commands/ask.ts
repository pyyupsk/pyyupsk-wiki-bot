import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../client";
import { logger } from "../lib/logger";
import { renderReply } from "../services/render";
import { recordQuery } from "../services/stats";
import { askWiki } from "../services/wiki";

export const ask: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask the wiki")
    .addStringOption((o) =>
      o.setName("prompt").setDescription("Your question").setRequired(true),
    ) as SlashCommandBuilder,
  execute: async (interaction: ChatInputCommandInteraction) => {
    const prompt = interaction.options.getString("prompt", true);
    await interaction.deferReply();

    const [err, result] = await askWiki(prompt);
    if (err) {
      logger.error("askWiki failed", { err: err.message });
      await interaction.editReply({ content: `error: ${err.message}` });
      return;
    }

    if (result.usage) {
      recordQuery({ ...result.usage, user_id: interaction.user.id, source: "slash" });
    }
    await interaction.editReply(renderReply(result.reply));
  },
};
