import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { GenerateSchema, KnowledgeSchema } from "../shared/schema";
import {
  AssistantError,
  generateAdvice,
  health,
  type AIConfig,
} from "./assistant";
import { KnowledgeStore, StoreError } from "./store";
export function createApp(
  store: KnowledgeStore,
  config: AIConfig,
  options: { fetcher?: typeof fetch; rateLimit?: number } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
    });
    if (!req.path.startsWith("/api")) return next();
    res.set("Cache-Control", "no-store");
    const hostname = req.hostname;
    if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(hostname))
      return res.status(403).json({
        error: "Локальный прототип принимает запросы только через localhost.",
      });
    const origin = req.get("origin");
    if (
      origin &&
      ![
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        `http://${req.get("host")}`,
      ].includes(origin)
    )
      return res.status(403).json({ error: "Недопустимый источник запроса." });
    next();
  });
  app.use(express.json({ limit: "128kb" }));
  app.get("/api/health", (_req, res) => res.json(health(config)));
  app.get("/api/knowledge", (_req, res) => res.json(store.get()));
  app.put("/api/knowledge", async (req, res, next) => {
    const parsed = KnowledgeSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error:
          "Проверьте базу: обязательные поля, цены, площадь и уникальные ID.",
      });
    try {
      res.json(await store.save(parsed.data));
    } catch (error) {
      next(error);
    }
  });
  let windowStart = Date.now(),
    count = 0;
  app.post("/api/generate", async (req, res, next) => {
    const parsed = GenerateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error:
          "Некорректный диалог: до 80 сообщений, до 4000 символов в каждом.",
      });
    if (Date.now() - windowStart >= 60000) {
      count = 0;
      windowStart = Date.now();
    }
    if (++count > (options.rateLimit ?? 20))
      return res.status(429).json({
        error: "Слишком много запросов. Подождите минуту.",
        retryAfter: 60,
      });
    const knowledge = store.get();
    if (parsed.data.revision !== knowledge.revision)
      return res.status(409).json({
        error: "База знаний обновилась. Обновите страницу перед генерацией.",
      });
    const started = Date.now();
    try {
      const advice = await generateAdvice(
        parsed.data.messages,
        knowledge,
        config,
        options.fetcher,
      );
      if (store.get().revision !== knowledge.revision)
        return res.status(409).json({
          error: "База изменилась во время генерации. Повторите запрос.",
        });
      res.json({
        ...advice,
        mode: config.provider,
        revision: knowledge.revision,
        durationMs: Date.now() - started,
      });
    } catch (error) {
      next(error);
    }
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Такого API-метода нет." }),
  );
  const dist = path.resolve("dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }
  app.use(
    (
      error: Error & { type?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof AssistantError || error instanceof StoreError)
        return res.status(error.status).json({ error: error.message });
      if (error.type === "entity.too.large")
        return res
          .status(413)
          .json({ error: "Слишком большой запрос. Сократите переписку." });
      if (error instanceof SyntaxError)
        return res.status(400).json({ error: "Некорректный JSON." });
      res.status(500).json({
        error:
          "Не удалось выполнить операцию. Проверьте доступ сервера к папке data и повторите запрос.",
      });
    },
  );
  return app;
}
