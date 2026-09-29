import { z } from "zod";
z.config(z.locales.ru());
export const EntrySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{2,40}$/),
    kind: z.enum(["product", "service", "policy"]),
    title: z.string().trim().min(2).max(120),
    text: z.string().trim().min(5).max(2500),
    price: z.number().int().min(0).max(10_000_000).nullable(),
    maxArea: z.number().int().min(1).max(1000).nullable(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (
      entry.kind === "product" &&
      (entry.price === null || entry.maxArea === null)
    )
      ctx.addIssue({
        code: "custom",
        message: "Для товара укажите цену и площадь.",
      });
  });
export const KnowledgeSchema = z
  .object({
    revision: z.number().int().positive(),
    entries: z.array(EntrySchema).min(1).max(30),
  })
  .strict()
  .superRefine((kb, ctx) => {
    if (new Set(kb.entries.map((e) => e.id)).size !== kb.entries.length)
      ctx.addIssue({
        code: "custom",
        message: "Идентификаторы записей должны быть уникальными.",
      });
  });
export const MessageSchema = z
  .object({
    id: z.string().min(1).max(100),
    role: z.enum(["client", "manager"]),
    text: z.string().trim().min(1).max(4000),
    at: z.string().datetime(),
  })
  .strict();
export const ConversationSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  topic: z.string().max(120),
  color: z.string(),
  messages: z.array(MessageSchema).max(80),
});
export const GenerateSchema = z
  .object({
    messages: z.array(MessageSchema).min(1).max(80),
    revision: z.number().int().positive(),
  })
  .strict();
export const AdviceSchema = z
  .object({
    answer: z.string().trim().min(1).max(3000),
    intent: z.enum(["selection", "question", "support", "clarification"]),
    upsell: z
      .object({
        status: z.enum(["offer", "skip", "clarify"]),
        title: z.string().trim().min(1).max(160),
        reason: z.string().trim().min(1).max(1200),
        phrase: z.string().max(1200),
        itemId: z.string().nullable(),
      })
      .strict(),
    sourceIds: z.array(z.string()).min(1).max(15),
    missing: z.array(z.string().max(250)).max(8),
  })
  .strict();
export type Entry = z.infer<typeof EntrySchema>;
export type Knowledge = z.infer<typeof KnowledgeSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type Advice = z.infer<typeof AdviceSchema>;
export type Generated = Advice & {
  mode: "demo" | "yandex" | "openrouter";
  revision: number;
  durationMs: number;
};
export type Health = {
  provider: "demo" | "yandex" | "openrouter";
  configured: boolean;
  model: string;
  version: string;
};
