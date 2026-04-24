import { MessageFlags } from "discord.js";

export function ephemeral(content: string) {
  return { content, flags: MessageFlags.Ephemeral } as const;
}
