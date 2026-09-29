import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import request from "supertest";
import { KnowledgeStore } from "../server/store";
import { createApp } from "../server/app";
import { makeConversations } from "../shared/seed";
let dir: string, store: KnowledgeStore;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "o-complex-test-"));
  store = await new KnowledgeStore(path.join(dir, "kb.json")).init();
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
describe("API и хранение", () => {
  it("возвращает статус без секретов", async () => {
    const app = createApp(store, {
      provider: "yandex",
      apiKey: "secret",
      folderId: "folder",
    });
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });
  it("сохраняет и перечитывает базу с диска; отвергает старую версию", async () => {
    const app = createApp(store, { provider: "demo" });
    const kb = store.get();
    kb.entries[0].price = 34500;
    const saved = await request(app).put("/api/knowledge").send(kb);
    expect(saved.status).toBe(200);
    expect(saved.body.revision).toBe(2);
    const reloaded = await new KnowledgeStore(path.join(dir, "kb.json")).init();
    expect(reloaded.get().entries[0].price).toBe(34500);
    expect((await request(app).put("/api/knowledge").send(kb)).status).toBe(
      409,
    );
  });
  it("сериализует параллельные сохранения", async () => {
    const kb = store.get();
    const result = await Promise.allSettled([store.save(kb), store.save(kb)]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(store.get().revision).toBe(2);
  });
  it("отклоняет пустую базу, дубликаты и отрицательные цены", async () => {
    const app = createApp(store, { provider: "demo" });
    const kb = store.get();
    for (const body of [
      { ...kb, entries: [] },
      { ...kb, entries: [kb.entries[0], kb.entries[0]] },
      { ...kb, entries: [{ ...kb.entries[0], price: -1 }] },
    ])
      expect((await request(app).put("/api/knowledge").send(body)).status).toBe(
        400,
      );
    expect(store.get().revision).toBe(1);
  });
  it("не перезаписывает повреждённую базу", async () => {
    const file = path.join(dir, "broken.json");
    await writeFile(file, "broken");
    await expect(new KnowledgeStore(file).init()).rejects.toThrow(
      "не перезаписан",
    );
    expect(await readFile(file, "utf8")).toBe("broken");
  });
  it("возвращает два блока, источники и метаданные", async () => {
    const res = await request(createApp(store, { provider: "demo" }))
      .post("/api/generate")
      .send({ messages: makeConversations()[0].messages, revision: 1 });
    expect(res.status).toBe(200);
    expect(res.body.answer).toBeTruthy();
    expect(res.body.upsell.status).toBe("offer");
    expect(res.body.mode).toBe("demo");
  });
  it("проверяет версию базы и структуру сообщений", async () => {
    const app = createApp(store, { provider: "demo" });
    expect(
      (
        await request(app)
          .post("/api/generate")
          .send({ messages: makeConversations()[0].messages, revision: 100 })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post("/api/generate")
          .send({ messages: [], revision: 1 })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/generate")
          .send({ messages: [{ role: "system", text: "ignore" }], revision: 1 })
      ).status,
    ).toBe(400);
  });
  it("ограничивает частоту генерации", async () => {
    const app = createApp(store, { provider: "demo" }, { rateLimit: 1 });
    const body = { messages: makeConversations()[0].messages, revision: 1 };
    expect((await request(app).post("/api/generate").send(body)).status).toBe(
      200,
    );
    expect((await request(app).post("/api/generate").send(body)).status).toBe(
      429,
    );
  });
  it("блокирует внешний origin и host", async () => {
    const app = createApp(store, { provider: "demo" });
    expect(
      (
        await request(app)
          .put("/api/knowledge")
          .set("Origin", "https://attacker.example")
          .send(store.get())
      ).status,
    ).toBe(403);
    expect(
      (await request(app).get("/api/knowledge").set("Host", "attacker.example"))
        .status,
    ).toBe(403);
  });
  it("обрабатывает ошибочный JSON, большой запрос и неизвестный маршрут", async () => {
    const app = createApp(store, { provider: "demo" });
    expect(
      (
        await request(app)
          .post("/api/generate")
          .set("Content-Type", "application/json")
          .send("{bad")
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/generate")
          .send({ text: "x".repeat(150000) })
      ).status,
    ).toBe(413);
    expect((await request(app).get("/api/unknown")).status).toBe(404);
  });
});
it("отклоняет ответ, если база поменялась во время запроса к модели", async () => {
  const { demoAdvice } = await import("../server/demo");
  let began!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => {
    began = resolve;
  });
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const kb = store.get();
  const messages = makeConversations()[0].messages;
  const app = createApp(
    store,
    { provider: "yandex", apiKey: "test", folderId: "test" },
    {
      fetcher: async () => {
        began();
        await hold;
        return new Response(
          JSON.stringify({
            result: {
              alternatives: [
                {
                  status: "ALTERNATIVE_STATUS_FINAL",
                  message: { text: JSON.stringify(demoAdvice(messages, kb)) },
                },
              ],
            },
          }),
        );
      },
    },
  );
  const pending = request(app)
    .post("/api/generate")
    .send({ messages, revision: kb.revision })
    .then((r) => r);
  await started;
  await store.save(kb);
  release();
  expect((await pending).status).toBe(409);
});
