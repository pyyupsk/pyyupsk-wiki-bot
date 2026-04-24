import type { UserConfig } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "no-bare-at-sign": (parsed) => {
          const raw = [parsed.subject, parsed.body, parsed.footer].filter(Boolean).join("\n");
          const stripped = raw.replaceAll(/`[^`]*`/g, "");
          if (/@/.test(stripped)) {
            return [false, "`@` only allowed inside inline code (e.g. `@types/bun`)"];
          }
          return [true];
        },
      },
    },
  ],
  rules: {
    "no-bare-at-sign": [2, "always"],
  },
};

export default config;
