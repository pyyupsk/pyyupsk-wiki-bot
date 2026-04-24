import { createClient } from "./client";
import { registerCommands } from "./commands";
import { env } from "./env";
import { registerEvents } from "./events";

const client = createClient();
registerCommands(client);
registerEvents(client);

await client.login(env.DISCORD_TOKEN);
