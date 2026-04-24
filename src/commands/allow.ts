import {
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
  TimestampStyles,
  time,
  userMention,
} from "discord.js";
import type { SlashCommand } from "../client";
import { ephemeral } from "../lib/reply";
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
    .addSubcommand((s) => s.setName("list").setDescription("Show allowlist")),
  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!isOwner(interaction.user.id)) {
      await interaction.reply(ephemeral("owner only"));
      return;
    }

    const sub = interaction.options.getSubcommand(true);

    if (sub === "add") {
      const user = interaction.options.getUser("user", true);
      addAllowed(user.id, interaction.user.id);
      await interaction.reply(ephemeral(`added ${userMention(user.id)} to allowlist`));
      return;
    }

    if (sub === "remove") {
      const user = interaction.options.getUser("user", true);
      removeAllowed(user.id);
      await interaction.reply(ephemeral(`removed ${userMention(user.id)} from allowlist`));
      return;
    }

    const entries = listAllowed();
    const body =
      entries.length === 0
        ? "_empty_"
        : entries
            .map(
              (e) =>
                `- ${userMention(e.userId)} · added ${time(e.addedAt, TimestampStyles.RelativeTime)} by ${userMention(e.addedBy)}`,
            )
            .join("\n");
    await interaction.reply(ephemeral(`**Allowlist** (${entries.length})\n${body}`));
  },
};
