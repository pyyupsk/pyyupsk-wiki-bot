# Local Wiki LLM

Self-hosted Discord bot that answers questions from a personal Obsidian-style wiki via the Claude CLI. Replies as plain text or Discord embeds depending on the answer shape.

> Built around the wiki-as-second-brain pattern — see [The LLM Wiki Pattern: A Second Brain That Compounds](https://fasu.dev/writings/the-llm-wiki-pattern-a-second-brain-that-compounds) for the motivation.

## Features

- **`/ask prompt:<text>`** — query the wiki, get text or embed reply
- **`@mention`** in any channel — same as `/ask`, with **reply-chain memory** (walks up to 6 replies back for context)
- **`/stats [range:24h|7d|30d|all]`** — cost (USD + THB), token usage, cache hit rate, top users, model breakdown
- **`/cleanup count:<N> [target:bot|user|all]`** — bulk delete recent messages; falls back to slow-delete for >14-day messages
- **`/allow add|remove|list user:<@user>`** — owner-managed allowlist (see Access Control)
- **`/config get|set|reset`** — runtime-mutable settings (model, THB rate, toggles)
- **🗑️ reaction** on any bot reply → delete it (owner or original asker)
- **👀 reaction** auto-added on mention messages when processing starts
- Tracks every query to sqlite with per-user attribution + cost in USD and THB

## Requirements

- [Bun](https://bun.sh) (runtime + package manager)
- [Claude Code CLI](https://github.com/anthropics/claude-code) (`claude` on `PATH`)
- A Claude subscription (Pro or Max plan, via OAuth) — this bot does **not** need an API key

> **Why spawn the CLI instead of calling the API?** The Anthropic API is cheaper per token, but billing is separate from the subscription — you'd pay for both a plan (for Claude Code) _and_ API credits. Spawning `claude -p` reuses the subscription OAuth auth, so queries are covered by the plan you already pay for. If you're willing to pay API credits on top, the `--bare` mode path (not enabled here) would be ~40× cheaper per query.
- A Discord application + bot token ([Developer Portal](https://discord.com/developers/applications))
- A local wiki directory (e.g. `~/Obsidian/pyyupsk/wiki`) with a `hotcache.md` file

## Setup

### 1. Clone + install

```sh
git clone git@github.com:pyyupsk/pyyupsk-wiki-bot.git
cd pyyupsk-wiki-bot
bun install
```

### 2. Create the Discord app

In the [Developer Portal](https://discord.com/developers/applications):

- Create a new application
- **Bot** tab → enable **MESSAGE CONTENT INTENT** (privileged) → Save
- Copy the **bot token** (reset if needed)
- Copy the **Application ID** (client ID)

### 3. Invite the bot

OAuth2 → URL Generator:

- **Scopes**: `bot`, `applications.commands`
- **Bot Permissions**: `Send Messages`, `Read Message History`, `Manage Messages`, `Add Reactions`, `Use Slash Commands`
- Open the generated URL, pick a server, authorize

### 4. Configure env

```sh
cp .env.example .env
```

Fill in `.env`:

```sh
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...                        # Application ID
DISCORD_GUILD_ID=...                         # optional; guild-scoped commands deploy instantly
DISCORD_OWNER_ID=...                         # your Discord user ID (optional, enables access control)

CLAUDE_BIN=claude                            # path to the claude CLI
CLAUDE_MODEL=haiku                           # default model (haiku | sonnet | opus)
WIKI_DIR=/home/you/Obsidian/your-wiki        # absolute path; ~/ is also expanded
```

### 5. Run

```sh
bun run dev      # watch mode (auto-restart on file change)
bun run start    # plain run
bun run deploy   # force-redeploy slash commands (rarely needed; syncs automatically on boot)
```

On boot you should see: `[bot] ℹ logged in as YourBot#1234`.

## Keep it alive

Pick one:

- **tmux/zellij session** — simplest, `bun run dev` in a detached pane
- **systemd user unit** — recommended for always-on; see below
- **pm2** — `bun add -g pm2 && pm2 start "bun src/index.ts" --name wiki-bot`

### systemd user unit

Create `~/.config/systemd/user/wiki-bot.service`:

```ini
[Unit]
Description=Wiki Discord Bot
After=network.target

[Service]
WorkingDirectory=/absolute/path/to/discord-bot
ExecStart=/home/you/.bun/bin/bun src/index.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

```sh
systemctl --user daemon-reload
systemctl --user enable --now wiki-bot
journalctl --user -u wiki-bot -f   # tail logs
```

## Access control

- **`DISCORD_OWNER_ID` unset** → everyone can use all commands (dev mode)
- **`DISCORD_OWNER_ID` set** → only the owner + allowlisted users can use commands. Unauthorized mentions are silently ignored.

The owner manages the allowlist via `/allow`:

- `/allow add user:<@user>` — grant access
- `/allow remove user:<@user>` — revoke access
- `/allow list` — show current entries with timestamps

## Runtime config

`/config` (owner only) lets you change behavior without restarting:

| Key               | Type                  | Default            | Effect                         |
| ----------------- | --------------------- | ------------------ | ------------------------------ |
| `claude_model`    | `haiku\|sonnet\|opus` | env `CLAUDE_MODEL` | model for new queries          |
| `thb_rate`        | number                | `34`               | USD→THB conversion in `/stats` |
| `reply_chain`     | boolean               | `true`             | walk reply chain for @mentions |
| `lookup_reaction` | boolean               | `true`             | auto-react with 👀 on mentions  |

Subcommands:

- `/config get` — show all keys with `[override]` or `[default]` badges
- `/config set key:<choice> value:<text>` — validates + stores
- `/config reset key:<choice>` — remove override

Overrides persist in sqlite (`.local/bot.db`).

## How it works

Each query spawns `claude -p` with a minimal system prompt + your `hotcache.md` inlined. Skills, MCP servers, and CLAUDE.md auto-loading are disabled via `--setting-sources ""` + `--strict-mcp-config` + `--system-prompt` (replaces default). Tools are restricted to `Read,Glob,Grep` over `WIKI_DIR`.

Claude returns structured JSON matching a discriminated-union schema (`{type: "text", content}` or `{type: "embed", title, description, fields, ...}`) enforced by `--json-schema`. The bot parses, validates (zod), and renders with `EmbedBuilder` or plain content.

`hotcache.md` is read once per query with an mtime check — edits to the wiki are picked up automatically, but unchanged runs reuse the in-memory copy.

## Project structure

```tree
src/
├── index.ts                  # entry: create client, register events/commands, login
├── env.ts                    # validated env (zod)
├── client.ts                 # Discord client factory + SlashCommand type
├── lib/
│   ├── chain.ts              # reply-chain walker
│   ├── logger.ts             # consola wrapper
│   ├── reply.ts              # ephemeral() helper
│   └── safe.ts               # Go-style error tuple
├── events/
│   ├── ready.ts              # login confirmation
│   ├── interactionCreate.ts  # slash command dispatcher + allowlist gate
│   ├── messageCreate.ts      # @mention handler
│   ├── messageReactionAdd.ts # 🗑️ delete-on-reaction
│   └── index.ts              # registerEvents()
├── commands/
│   ├── ask.ts                # /ask
│   ├── stats.ts              # /stats
│   ├── cleanup.ts            # /cleanup
│   ├── allow.ts              # /allow
│   ├── config.ts             # /config
│   └── index.ts              # registerCommands()
├── services/
│   ├── db.ts                 # shared bun:sqlite connection + schema
│   ├── stats.ts              # query recording + summary queries
│   ├── allowlist.ts          # isOwner / isAllowed + mutations
│   ├── config.ts             # runtime config getters/setters
│   ├── deploy.ts             # slash command sync with hash cache
│   ├── render.ts             # WikiReply → Discord message
│   └── wiki/
│       ├── index.ts          # askWiki() — spawns claude, parses reply
│       ├── schemas.ts        # zod + JSON schema for structured output
│       └── prompt.ts         # SYSTEM prompt + hotcache reader
└── scripts/
    └── deploy.ts             # standalone deploy entrypoint
```

## Scripts

| Script              | What                                     |
| ------------------- | ---------------------------------------- |
| `bun run dev`       | Watch mode — auto-restart on file change |
| `bun run start`     | Plain run                                |
| `bun run deploy`    | Force-redeploy slash commands            |
| `bun run check`     | Biome lint + format                      |
| `bun run typecheck` | `tsc --noEmit`                           |

## Git hooks

[@pyyupsk/nit](https://www.npmjs.com/package/@pyyupsk/nit) installs hooks on `bun install`:

- **pre-commit** — `biome check --write` on staged `.ts`/`.json`
- **pre-push** — `bun run typecheck`
- **commit-msg** — [commitlint](https://commitlint.js.org) with a custom rule: `@` only allowed inside inline code (e.g. `` `@types/bun` ``)

## Cost notes

Each query runs `claude -p` which loads a small system prompt + the hotcache. Typical cost on haiku: **~$0.005-0.02/query** (mostly cache creation for the first call, cached reads after). Subsequent calls within 5 minutes hit the ephemeral cache and cost even less.

`/stats` shows the running total in both USD and THB (configurable rate).

## License

MIT
