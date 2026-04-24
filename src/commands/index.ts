import type { BotClient, SlashCommand } from "../client";
import { ask } from "./ask";
import { stats } from "./stats";

export const commands: SlashCommand[] = [ask, stats];

export function registerCommands(client: BotClient) {
  for (const c of commands) client.commands.set(c.data.name, c);
}
