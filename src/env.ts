import { z } from "zod";

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().optional(),
  CLAUDE_BIN: z.string().default("claude"),
  CLAUDE_MODEL: z.string().default("haiku"),
  WIKI_DIR: z
    .string()
    .default(`${process.env.HOME}/Obsidian/pyyupsk/wiki`)
    .transform((p) => (p.startsWith("~/") ? `${process.env.HOME}${p.slice(1)}` : p)),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("invalid env:", z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
