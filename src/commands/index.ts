import type { BotClient, SlashCommand } from "../client";
import { ask } from "./ask";

export const commands: SlashCommand[] = [ask];

export function registerCommands(client: BotClient) {
  for (const c of commands) client.commands.set(c.data.name, c);
}
