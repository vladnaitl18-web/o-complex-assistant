import "dotenv/config";
import path from "node:path";
import { createApp } from "./app";
import { KnowledgeStore } from "./store";
import { configFromEnv } from "./config";
const config = configFromEnv();
const host = process.env.HOST || "127.0.0.1";
if (!["127.0.0.1", "localhost", "::1"].includes(host))
  throw new Error(
    "Этот этап рассчитан на локальный запуск. Используйте HOST=127.0.0.1.",
  );
const store = await new KnowledgeStore(
  path.resolve(process.env.KNOWLEDGE_FILE || "data/knowledge.json"),
).init();
const app = createApp(store, config);
const port = Number(process.env.PORT || 3001);
app.listen(port, host, () =>
  console.log(`Контекст: http://${host}:${port} · режим ${config.provider}`),
);
