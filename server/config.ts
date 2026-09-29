import type { AIConfig } from "./assistant";
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): AIConfig {
  const provider = env.AI_PROVIDER || "demo";
  if (provider !== "demo" && provider !== "yandex" && provider !== "openrouter")
    throw new Error("AI_PROVIDER должен быть demo, yandex или openrouter.");
  return provider === "openrouter"
    ? {
        provider,
        apiKey: env.OPENROUTER_API_KEY,
        backupKey: env.OPENROUTER_API_KEY_BACKUP,
        model: env.OPENROUTER_MODEL,
      }
    : {
        provider,
        apiKey: env.YANDEX_API_KEY,
        folderId: env.YANDEX_FOLDER_ID,
        modelUri: env.YANDEX_MODEL_URI,
      };
}
