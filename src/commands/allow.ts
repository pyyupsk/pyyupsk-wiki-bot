import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../client";
import { addAllowed, isOwner, listAllowed, removeAllowed } from "../services/allowlist";

export const allow: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("allow")
    .setDescription("Manage bot allowlist (owner only)")
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Add a user to the allowlist")
        .addUserOption((o) => o.setName("user").setDescription("User to allow").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Remove a user from the allowlist")
        .addUserOption((o) => o.setName("user").setDescription("User to revoke").setRequired(true)),
    )
    .addSubcommand((s) =>
      s.setName("list").setDescription("Show allowlist"),
    ) as SlashCommandBuilder,
  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!isOwner(interaction.user.id)) {
      await interaction.reply({ content: "owner only", flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand(true);

    if (sub === "add") {
      const user = interaction.options.getUser("user", true);
      addAllowed(user.id, interaction.user.id);
      await interaction.reply({
        content: `added <@${user.id}> to allowlist`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "remove") {
      const user = interaction.options.getUser("user", true);
      removeAllowed(user.id);
      await interaction.reply({
        content: `removed <@${user.id}> from allowlist`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const entries = listAllowed();
    const body =
      entries.length === 0
        ? "_empty_"
        : entries
            .map(
              (e) =>
                `- <@${e.user_id}> · added <t:${Math.floor(e.added_at / 1000)}:R> by <@${e.added_by}>`,
            )
            .join("\n");
    await interaction.reply({
      content: `**Allowlist** (${entries.length})\n${body}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
