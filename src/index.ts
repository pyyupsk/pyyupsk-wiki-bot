import { createClient } from "./client";
import { registerCommands } from "./commands";
import { env } from "./env";
import { registerEvents } from "./events";
import { logger } from "./lib/logger";
import { syncCommands } from "./services/deploy";

const client = createClient();
registerCommands(client);
registerEvents(client);

const [syncErr] = await syncCommands();
if (syncErr) {
  logger.error("command sync failed", { err: syncErr.message });
  process.exit(1);
}

await client.login(env.DISCORD_TOKEN);
