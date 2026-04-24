import type { Client, ClientEvents } from "discord.js";
import { interactionCreate } from "./interactionCreate";
import { messageCreate } from "./messageCreate";
import { messageReactionAdd } from "./messageReactionAdd";
import { ready } from "./ready";

type Event<K extends keyof ClientEvents> = {
  name: K;
  once: boolean;
  execute: (...args: ClientEvents[K]) => unknown;
};

const events = [ready, interactionCreate, messageCreate, messageReactionAdd] as Event<
  keyof ClientEvents
>[];

export function registerEvents(client: Client) {
  for (const e of events) {
    if (e.once) client.once(e.name, e.execute);
    else client.on(e.name, e.execute);
  }
}
