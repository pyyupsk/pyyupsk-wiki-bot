import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../client";

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
    // TODO: wiki service + render
    await interaction.editReply(`got: ${prompt}`);
  },
};
