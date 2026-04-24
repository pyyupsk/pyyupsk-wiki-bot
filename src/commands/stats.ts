import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  inlineCode,
  SlashCommandBuilder,
  userMention,
} from "discord.js";
import type { SlashCommand } from "@/client";
import { getConfig } from "@/services/config";
import { getModelBreakdown, getSummary, getTopUsers, type StatsSummary } from "@/services/stats";

const DISCORD_BLURPLE = 0x5865f2;
const TOP_USERS_LIMIT = 5;

const RANGES = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: 0,
} as const;

type RangeKey = keyof typeof RANGES;

function formatUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatCost(n: number): string {
  const rate = getConfig("thb_rate");
  return `${formatUsd(n)} (฿${(n * rate).toFixed(2)})`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function buildSummaryField(label: string, s: StatsSummary): { name: string; value: string } {
  if (s.queries === 0) return { name: label, value: "_no data_" };
  const cacheHitRate =
    s.cache_read + s.cache_create > 0
      ? ((s.cache_read / (s.cache_read + s.cache_create)) * 100).toFixed(1)
      : "0";
  return {
    name: label,
    value: [
      `**${s.queries}** queries · **${s.users}** users`,
      `cost: **${formatCost(s.cost_usd)}**`,
      `tokens in/out: ${formatTokens(s.input_tokens)} / ${formatTokens(s.output_tokens)}`,
      `cache read/create: ${formatTokens(s.cache_read)} / ${formatTokens(s.cache_create)} (hit ${cacheHitRate}%)`,
      `avg latency: ${(s.avg_duration_ms / 1000).toFixed(2)}s`,
    ].join("\n"),
  };
}

export const stats: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show Claude usage and bot activity stats")
    .addStringOption((o) =>
      o
        .setName("range")
        .setDescription("Time range")
        .addChoices(
          { name: "24 hours", value: "24h" },
          { name: "7 days", value: "7d" },
          { name: "30 days", value: "30d" },
          { name: "all time", value: "all" },
        ),
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    const range = (interaction.options.getString("range") ?? "24h") as RangeKey;
    const sinceMs = RANGES[range] === 0 ? 0 : Date.now() - RANGES[range];
    const rangeLabel = range === "all" ? "All time" : `Last ${range}`;

    const summary = getSummary(sinceMs);
    const topUsers = getTopUsers(TOP_USERS_LIMIT, sinceMs);
    const models = getModelBreakdown(sinceMs);

    const embed = new EmbedBuilder()
      .setTitle("📊 Claude Usage Stats")
      .setColor(DISCORD_BLURPLE)
      .setTimestamp();

    embed.addFields(buildSummaryField(rangeLabel, summary));

    if (topUsers.length > 0) {
      embed.addFields({
        name: "Top users",
        value: topUsers
          .map((u, i) => `${i + 1}. ${userMention(u.user_id)} — ${u.count}`)
          .join("\n"),
        inline: true,
      });
    }

    if (models.length > 0) {
      embed.addFields({
        name: "By model",
        value: models
          .map((m) => `${inlineCode(m.model)} — ${m.count} · ${formatUsd(m.cost_usd)}`)
          .join("\n"),
        inline: true,
      });
    }

    if (summary.first_ts) {
      embed.setFooter({ text: `Tracking since ${new Date(summary.first_ts).toISOString()}` });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
