import { Client, GatewayIntentBits } from "discord.js";
import { env } from "./env";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("clientReady", (c) => {
  console.log(`logged in as ${c.user.tag}`);
});

await client.login(env.DISCORD_TOKEN);
