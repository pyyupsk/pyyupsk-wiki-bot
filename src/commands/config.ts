import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { SlashCommand } from "../client";
import { isOwner } from "../services/allowlist";
import {
  CONFIG_KEYS,
  type ConfigKey,
  getAllConfig,
  resetConfig,
  setConfig,
} from "../services/config";

const CHOICES = CONFIG_KEYS.map((k) => ({ name: k, value: k }));

export const config: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Manage runtime bot config (owner only)")
    .addSubcommand((s) => s.setName("get").setDescription("Show current config"))
    .addSubcommand((s) =>
      s
        .setName("set")
        .setDescription("Set a config value")
        .addStringOption((o) =>
          o
            .setName("key")
            .setDescription("Key")
            .setRequired(true)
            .addChoices(...CHOICES),
        )
        .addStringOption((o) => o.setName("value").setDescription("New value").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("reset")
        .setDescription("Reset a config key to default")
        .addStringOption((o) =>
          o
            .setName("key")
            .setDescription("Key")
            .setRequired(true)
            .addChoices(...CHOICES),
        ),
    ) as SlashCommandBuilder,
  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!isOwner(interaction.user.id)) {
      await interaction.reply({ content: "owner only", flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand(true);

    if (sub === "get") {
      const all = getAllConfig();
      const body = CONFIG_KEYS.map((k) => {
        const { value, overridden } = all[k];
        const badge = overridden ? " `[override]`" : " _[default]_";
        return `- **${k}**: \`${value}\`${badge}`;
      }).join("\n");
      await interaction.reply({
        content: `**Config**\n${body}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "set") {
      const key = interaction.options.getString("key", true) as ConfigKey;
      const value = interaction.options.getString("value", true);
      const res = setConfig(key, value, interaction.user.id);
      if (!res.ok) {
        await interaction.reply({
          content: `invalid value for \`${key}\`: ${res.error}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        content: `set \`${key}\` = \`${res.normalized}\``,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const key = interaction.options.getString("key", true) as ConfigKey;
    resetConfig(key);
    await interaction.reply({
      content: `reset \`${key}\` to default`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
