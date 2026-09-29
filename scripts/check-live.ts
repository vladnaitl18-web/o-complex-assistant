import "dotenv/config";
import { makeConversations } from "../shared/seed";
import { KnowledgeStore } from "../server/store";
import { generateAdvice, health } from "../server/assistant";
import path from "node:path";
import { configFromEnv } from "../server/config";
const config = configFromEnv();
if (config.provider === "demo" || !health(config).configured) {
  console.error(
    "Реальная проверка не выполнена: выберите openrouter или yandex и заполните ключ в .env. Секреты в консоль не выводятся.",
  );
  process.exitCode = 1;
} else {
  const store = await new KnowledgeStore(
    path.resolve("data/knowledge.json"),
  ).init();
  for (const conversation of makeConversations()) {
    try {
      const result = await generateAdvice(
        conversation.messages,
        store.get(),
        config,
      );
      console.log(`\n${conversation.name} — ${conversation.topic}`);
      console.log(JSON.stringify(result, null, 2));
      if (
        ["refusal", "support"].includes(conversation.id) &&
        result.upsell.status !== "skip"
      )
        throw new Error("Нарушено правило отказа/жалобы.");
    } catch (error) {
      console.error(
        `Не пройден сценарий ${conversation.id}: ${(error as Error).message}`,
      );
      process.exitCode = 1;
    }
  }
  console.log(
    "\nПроверьте смысл и факты в ответах вручную. Структурная проверка не гарантирует отсутствие всех ошибок модели.",
  );
}
