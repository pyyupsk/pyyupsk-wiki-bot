import { createHash } from "node:crypto";
import { REST, Routes } from "discord.js";
import { commands } from "@/commands";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { safe } from "@/lib/safe";

const CACHE_PATH = ".local/commands.hash";

type SyncResult = "skipped" | "synced";

function hashBody(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

async function readCachedHash(): Promise<string | null> {
  const file = Bun.file(CACHE_PATH);
  if (!(await file.exists())) return null;
  const [err, text] = await safe(file.text());
  return err ? null : text.trim();
}

export async function syncCommands(force = false): Promise<[Error, null] | [null, SyncResult]> {
  const body = commands.map((c) => c.data.toJSON());
  const hash = hashBody(body);
  const cached = await readCachedHash();

  if (!force && cached === hash) {
    logger.info("commands unchanged, skip deploy");
    return [null, "skipped"];
  }

  const rest = new REST().setToken(env.DISCORD_TOKEN);
  const globalRoute = Routes.applicationCommands(env.DISCORD_CLIENT_ID);
  const guildRoute = env.DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID)
    : null;

  // When deploying to a guild, clear global to prevent duplicates.
  // When deploying globally, rest.put replaces the full set — no pre-clear needed.
  if (guildRoute) {
    const [clearGlobalErr] = await safe(rest.put(globalRoute, { body: [] }));
    if (clearGlobalErr) return [clearGlobalErr, null];
  }

  const target = guildRoute ?? globalRoute;
  logger.info(`deploying ${body.length} commands`, {
    scope: env.DISCORD_GUILD_ID ? `guild ${env.DISCORD_GUILD_ID}` : "global",
  });

  const [err, data] = await safe(rest.put(target, { body }));
  if (err) return [err, null];

  await Bun.write(CACHE_PATH, hash);
  const count = Array.isArray(data) ? data.length : 0;
  logger.success(`deployed ${count} commands`);
  return [null, "synced"];
}
