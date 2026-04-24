import { EmbedBuilder } from "discord.js";
import type { WikiReply } from "./wiki";

export type RenderedReply = {
  content?: string;
  embeds?: EmbedBuilder[];
};

function toColor(color: string | number | undefined): number | undefined {
  if (typeof color === "number") return color;
  if (typeof color === "string") {
    const hex = color.startsWith("#") ? color.slice(1) : color;
    return Number.parseInt(hex, 16);
  }
  return undefined;
}

export function renderReply(reply: WikiReply): RenderedReply {
  if (reply.type === "text") return { content: reply.content };

  const embed = new EmbedBuilder();
  if (reply.title) embed.setTitle(reply.title);
  if (reply.description) embed.setDescription(reply.description);
  if (reply.url) embed.setURL(reply.url);
  if (reply.footer) embed.setFooter({ text: reply.footer });
  if (reply.fields?.length) embed.addFields(reply.fields);
  const color = toColor(reply.color);
  if (color !== undefined) embed.setColor(color);

  return { embeds: [embed] };
}
