import {
  ChannelType,
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { SlashCommand } from "../client";
import { logger } from "../lib/logger";
import { ephemeral } from "../lib/reply";
import { safe } from "../lib/safe";
import { isOwner } from "../services/allowlist";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const TARGETS = ["bot", "user", "all"] as const;
type Target = (typeof TARGETS)[number];

export const cleanup: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("cleanup")
    .setDescription("Delete recent messages in this channel")
    .addIntegerOption((o) =>
      o
        .setName("count")
        .setDescription("How many messages to scan (1-100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addStringOption((o) =>
      o
        .setName("target")
        .setDescription("Which messages to delete")
        .addChoices(
          { name: "bot messages only", value: "bot" },
          { name: "your messages only", value: "user" },
          { name: "all (admin/owner)", value: "all" },
        ),
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    const count = interaction.options.getInteger("count", true);
    const target = (interaction.options.getString("target") ?? "bot") as Target;
    const channel = interaction.channel;

    if (!channel || channel.type === ChannelType.DM || !("bulkDelete" in channel)) {
      await interaction.reply(ephemeral("cleanup only works in guild text channels"));
      return;
    }

    const canManage =
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) ?? false;

    if (target === "all" && !isOwner(interaction.user.id) && !canManage) {
      await interaction.reply(ephemeral("need Manage Messages permission or owner for target:all"));
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const fetched = await channel.messages.fetch({ limit: count });
    const me = interaction.client.user?.id;
    const filtered = fetched.filter((m) => {
      if (target === "bot") return m.author.id === me;
      if (target === "user") return m.author.id === interaction.user.id;
      return true;
    });

    if (filtered.size === 0) {
      await interaction.editReply({
        content: `scanned ${fetched.size}, matched 0 (nothing to delete)`,
      });
      return;
    }

    const cutoff = Date.now() - FOURTEEN_DAYS_MS;
    const recent = filtered.filter((m) => m.createdTimestamp >= cutoff);
    const old = filtered.filter((m) => m.createdTimestamp < cutoff);

    let bulkDeleted = 0;
    if (recent.size > 0) {
      const result = await channel.bulkDelete(recent, true);
      bulkDeleted = result.size;
    }

    let slowDeleted = 0;
    let slowFailed = 0;
    if (old.size > 0) {
      await interaction.editReply({
        content: `bulk-deleted ${bulkDeleted}, deleting ${old.size} old messages one-by-one...`,
      });
      for (const m of old.values()) {
        const [err] = await safe(m.delete());
        if (err) slowFailed++;
        else slowDeleted++;
      }
    }

    const total = bulkDeleted + slowDeleted;
    logger.info("cleanup", {
      channel: channel.id,
      target,
      requested: count,
      fetched: fetched.size,
      matched: filtered.size,
      bulk_deleted: bulkDeleted,
      slow_deleted: slowDeleted,
      slow_failed: slowFailed,
      by: interaction.user.id,
    });
    const failNote = slowFailed > 0 ? ` (${slowFailed} failed)` : "";
    await interaction.editReply({
      content: `deleted ${total} message(s): ${bulkDeleted} bulk + ${slowDeleted} slow${failNote}`,
    });
  },
};
