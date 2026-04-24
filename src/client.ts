import { Client, Collection, GatewayIntentBits, type SlashCommandBuilder } from "discord.js";

export type SlashCommand = {
  data: SlashCommandBuilder;
  execute: (interaction: import("discord.js").ChatInputCommandInteraction) => Promise<void>;
};

export type BotClient = Client & {
  commands: Collection<string, SlashCommand>;
};

export function createClient(): BotClient {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  }) as BotClient;
  client.commands = new Collection();
  return client;
}
