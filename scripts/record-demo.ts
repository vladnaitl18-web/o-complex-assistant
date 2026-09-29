import { chromium } from "@playwright/test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server/app";
import { KnowledgeStore } from "../server/store";
// Produces a clearly labelled demo recording, with explanatory captions and no audio.
// Uses an isolated knowledge file and browser context, never the user's working data.
const temp = await mkdtemp(path.join(os.tmpdir(), "o-complex-video-"));
const store = await new KnowledgeStore(
  path.join(temp, "knowledge.json"),
).init();
const server = createApp(store, { provider: "demo" }).listen(4175, "127.0.0.1");
await new Promise<void>((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});
await mkdir("docs/video", { recursive: true });
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL === "chromium" ? undefined : "chrome",
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1100 },
  recordVideo: { dir: temp, size: { width: 1600, height: 1100 } },
});
const page = await context.newPage();
try {
  await page.goto("http://127.0.0.1:4175");
  await page
    .getByRole("button", { name: "Подготовить ответ", exact: true })
    .waitFor();
  await page.addStyleTag({
    content:
      ".crm-grid{height:790px;min-height:0}.page-heading{padding-top:20px;padding-bottom:20px}.workspace-footer{padding-top:12px}",
  });
  async function caption(title: string, description: string, seconds: number) {
    await page.evaluate(
      ({ title, description }) => {
        let el = document.getElementById("recording-caption");
        if (!el) {
          el = document.createElement("div");
          el.id = "recording-caption";
          el.setAttribute("popover", "manual");
          document.body.append(el);
        }
        el.style.cssText =
          "position:fixed;top:auto;margin:0;width:auto;border:0;bottom:0;left:72px;right:0;z-index:9999;background:#202438;color:#fff;padding:18px 34px 22px;border-top:3px solid #8874ee;pointer-events:none;font-family:Manrope Variable,sans-serif;box-shadow:0 -6px 25px #20243810";
        el.replaceChildren();
        const heading = document.createElement("div");
        heading.textContent = title;
        heading.style.cssText =
          "font-size:18px;font-weight:700;margin-bottom:7px";
        const text = document.createElement("div");
        text.textContent = description;
        text.style.cssText = "font-size:14px;line-height:1.65;color:#c5c4d6";
        el.append(heading, text);
        if (el.matches(":popover-open")) el.hidePopover();
        el.showPopover();
      },
      { title, description },
    );
    if (title.startsWith("01 /"))
      await page.screenshot({ path: "docs/video/preview.png" });
    if (title.startsWith("Как использовался"))
      await page.screenshot({ path: "docs/video/preview-tools.png" });
    await page.waitForTimeout(seconds * 1000);
  }
  await caption(
    "Контекст — помощник менеджера",
    "Имитация CRM: история клиента → база знаний → ответ и внутренняя подсказка. В этой записи включён demo: локальные правила, без вызова ИИ.",
    9,
  );
  await page
    .getByRole("button", { name: "Подготовить ответ", exact: true })
    .click();
  await page.locator(".answer-text").waitFor();
  await caption(
    "01 / Ответ на основе базы",
    "Клиент указал площадь 20 м² и бюджет. Помощник подбирает «Комфорт 07» и использует цену из базы знаний.",
    10,
  );
  await page.locator(".upsell-card").scrollIntoViewIfNeeded();
  await caption(
    "02 / Отдельная подсказка менеджеру",
    "Монтаж предлагается как полезное дополнение. Подсказка и её обоснование не отправляются клиенту автоматически.",
    9,
  );
  await page
    .locator(".sources")
    .getByRole("button", { name: "Комфорт 07", exact: true })
    .click();
  await caption(
    "Проверяем источник",
    "Каждый ответ содержит ссылки на использованные записи. Менеджер может открыть товар и сверить условия.",
    6,
  );
  await page.getByRole("button", { name: "Закрыть окно" }).click();
  await page.getByRole("button", { name: "Вставить в сообщение" }).click();
  await caption(
    "Человек контролирует отправку",
    "Черновик можно отредактировать. В сообщение вставляется только ответ клиенту, без внутренней рекомендации.",
    7,
  );
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await page.getByRole("button", { name: /МО Михаил Орлов/ }).click();
  await page
    .getByRole("button", { name: "Подготовить ответ", exact: true })
    .click();
  await page.locator(".upsell-card").waitFor();
  await page.locator(".upsell-card").scrollIntoViewIfNeeded();
  await caption(
    "Учитываем работу менеджера",
    "Монтаж уже был предложен, клиент отказался. В этом диалоге помощник не повторяет допродажу.",
    10,
  );
  await page.getByRole("button", { name: /ЕВ Елена Волкова/ }).click();
  await page
    .getByRole("button", { name: "Подготовить ответ", exact: true })
    .click();
  await page.locator(".answer-text").waitFor();
  await page.locator(".assistant-scroll").evaluate((el) => {
    el.scrollTop = 0;
  });
  await caption(
    "Если факта нет — уточняем",
    "Для длинной трассы и высотных работ нет фиксированной цены. Помощник запрашивает условия вместо выдуманного расчёта.",
    10,
  );
  await page.getByRole("button", { name: "База знаний", exact: true }).click();
  await caption(
    "Редактируемая база знаний",
    "Товары, цены и правила изменяются здесь. После сохранения новые ответы используют обновлённую версию базы.",
    9,
  );
  await page.getByRole("button", { name: "К диалогам" }).click();
  await page
    .getByRole("button", { name: "Настройки подключения", exact: true })
    .click();
  await caption(
    "Как использовался ИИ при разработке",
    "Codex помог собрать интерфейс, сервер и тесты. ImageGen создал портреты клиентов. Для настоящей генерации через адаптер Yandex AI Studio нужен API-ключ.",
    11,
  );
  await page.getByRole("button", { name: "Закрыть окно" }).click();
  await page.getByRole("button", { name: /АС Анна Смирнова/ }).click();
  await caption(
    "Локальный прототип · самостоятельная проверка",
    "35 тестов логики и API, 15 браузерных сценариев. Эмуляция CRM и ниша согласованы с работодателем. Эта запись демонстрирует режим правил.",
    8,
  );
  await context.close();
  await page.video()!.saveAs(path.resolve("docs/video/context-demo.webm"));
  console.log(
    "Сохранено docs/video/context-demo.webm — демонстрация с титрами, без озвучки, режим demo.",
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(temp, { recursive: true, force: true });
}
