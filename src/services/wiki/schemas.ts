import { z } from "zod";

const embedFieldSchema = z.object({
  name: z.string().max(256),
  value: z.string().max(1024),
  inline: z.boolean().optional(),
});

const embedReplySchema = z.object({
  type: z.literal("embed"),
  title: z.string().max(256).optional(),
  description: z.string().max(4000).optional(),
  url: z.url().optional(),
  color: z
    .union([z.number().int().min(0).max(0xffffff), z.string().regex(/^#?[0-9a-f]{6}$/i)])
    .optional(),
  fields: z.array(embedFieldSchema).max(25).optional(),
  footer: z.string().max(2048).optional(),
});

const textReplySchema = z.object({
  type: z.literal("text"),
  content: z.string().min(1).max(2000),
});

export const wikiReplySchema = z.discriminatedUnion("type", [textReplySchema, embedReplySchema]);
export type WikiReply = z.infer<typeof wikiReplySchema>;

export const claudeResultSchema = z.object({
  is_error: z.boolean(),
  result: z.string().optional(),
  structured_output: z.unknown().optional(),
  total_cost_usd: z.number().optional(),
  duration_ms: z.number().optional(),
  usage: z
    .object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      cache_read_input_tokens: z.number().optional(),
      cache_creation_input_tokens: z.number().optional(),
    })
    .optional(),
});

export const OUTPUT_JSON_SCHEMA = {
  type: "object",
  required: ["type"],
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: ["text", "embed"] },
    content: { type: "string", maxLength: 2000 },
    title: { type: "string", maxLength: 256 },
    description: { type: "string", maxLength: 4000 },
    url: { type: "string" },
    color: { type: "string" },
    fields: {
      type: "array",
      maxItems: 25,
      items: {
        type: "object",
        required: ["name", "value"],
        additionalProperties: false,
        properties: {
          name: { type: "string", maxLength: 256 },
          value: { type: "string", maxLength: 1024 },
          inline: { type: "boolean" },
        },
      },
    },
    footer: { type: "string", maxLength: 2048 },
  },
};
