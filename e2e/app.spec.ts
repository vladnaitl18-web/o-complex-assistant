import { expect, test } from "@playwright/test";
import { initialKnowledge } from "../shared/seed";
test.beforeEach(async ({ request, page }) => {
  const current = await (await request.get("/api/knowledge")).json();
  await request.put("/api/knowledge", {
    data: { ...initialKnowledge, revision: current.revision },
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Диалоги 4", exact: true }),
  ).toBeVisible();
});
test("полный цикл: источники, черновик, правка, отправка и сохранение", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(page.getByText("Демо · без вызова ИИ")).toBeVisible();
  await page
    .getByRole("button", { name: "Подготовить ответ", exact: true })
    .click();
  await expect(page.locator(".answer-text")).toContainText("Комфорт 07");
  await expect(page.locator(".upsell-card")).toContainText(
    "Стандартный монтаж",
  );
  await page
    .locator(".sources")
    .getByRole("button", { name: "Комфорт 07", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("23 м²");
  await page.getByRole("button", { name: "Закрыть окно" }).click();
  await page.locator(".assistant-scroll").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({
    path: "docs/screenshots/desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Вставить в сообщение" }).click();
  const editor = page.getByRole("textbox", {
    name: "Ответ менеджера",
    exact: true,
  });
  expect(await editor.inputValue()).toContain("Комфорт 07");
  expect(await editor.inputValue()).not.toContain("Видно только");
  await editor.fill("Анна, рекомендую Комфорт 07. Уточним условия установки.");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.locator(".message-text").last()).toContainText(
    "Анна, рекомендую",
  );
  await expect(page.locator(".answer-text")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".message-text").last()).toContainText(
    "Анна, рекомендую",
  );
  expect(errors).toEqual([]);
});
test("отказ, нестандартный монтаж, жалоба", async ({ page }) => {
  await page.getByRole("button", { name: /МО Михаил Орлов/ }).click();
  await page
    .getByRole("button", { name: "Подготовить ответ", exact: true })
    .click();
  await expect(page.locator(".upsell-card")).toContainText("Учитываем историю");
  await expect(page.locator(".answer-text")).toContainText("Комфорт 09");
  await page.getByRole("button", { name: /ЕВ Елена Волкова/ }).click();
  await page
    .getByRole("button", { name: "Подготовить ответ", exact: true })
    .click();
  await expect(page.locator(".answer-text")).toContainText("индивидуально");
  await page.getByRole("button", { name: /ДС Дмитрий Соколов/ }).click();
  await page
    .getByRole("button", { name: "Подготовить ответ", exact: true })
    .click();
  await expect(page.locator(".upsell-card")).toContainText(
    "Сначала решаем проблему",
  );
});
test("продолжение диалога сбрасывает результат и меняет подбор", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Подготовить ответ", exact: true })
    .click();
  await expect(page.locator(".answer-text")).toBeVisible();
  await page
    .getByRole("button", { name: "Сообщение клиента", exact: true })
    .click();
  await page
    .getByLabel("Текст обращения")
    .fill("Теперь комната 30 м² и бюджет до 60 000 рублей.");
  await page.getByRole("button", { name: "Добавить в диалог" }).click();
  await expect(page.locator(".answer-text")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Подготовить ответ", exact: true })
    .click();
  await expect(page.locator(".answer-text")).toContainText("Комфорт 12");
});
test("редактирование базы влияет на следующий ответ", async ({ page }) => {
  await page.getByRole("button", { name: "База знаний", exact: true }).click();
  await page.getByLabel("Цена, ₽").fill("34000");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(
    page.getByRole("button", { name: "Сохранить изменения" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "docs/screenshots/knowledge.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "К диалогам" }).click();
  await page
    .getByRole("button", { name: "Подготовить ответ", exact: true })
    .click();
  await expect(page.locator(".answer-text")).toContainText(/34\s000/);
  await page.reload();
  await page.getByRole("button", { name: "База знаний", exact: true }).click();
  await expect(page.getByLabel("Цена, ₽")).toHaveValue("34000");
});
test("новый диалог, поиск, сброс с подтверждением", async ({ page }) => {
  await page.getByRole("button", { name: "Новый диалог" }).click();
  await page.getByLabel("Имя клиента").fill("Тестовый клиент");
  await page.getByRole("button", { name: "Создать диалог" }).click();
  await expect(
    page.getByRole("button", { name: "Подготовить ответ", exact: true }),
  ).toBeDisabled();
  await page.getByRole("textbox", { name: "Поиск диалогов" }).fill("Тестовый");
  await expect(page.locator(".conversation")).toHaveCount(1);
  await page.getByRole("button", { name: "Сбросить демо" }).click();
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Тестовый клиент", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Сбросить демо" }).click();
  await page
    .getByRole("button", { name: "Сбросить диалоги", exact: true })
    .click();
  await expect(page.locator(".conversation")).toHaveCount(4);
});
test("ошибка сервера не превращается в успешный ответ", async ({ page }) => {
  await page.route("**/api/generate", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "Сервис ИИ временно недоступен." }),
    }),
  );
  await page
    .getByRole("button", { name: "Подготовить ответ", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Сервис ИИ временно недоступен",
  );
  await expect(page.locator(".answer-text")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Подготовить ответ", exact: true }),
  ).toBeEnabled();
});
test("переключение во время генерации не переносит ответ в другой диалог", async ({
  page,
}) => {
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/generate", async (route) => {
    await hold;
    await route.continue().catch(() => {});
  });
  await page
    .getByRole("button", { name: "Подготовить ответ", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Готовим ответ…" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /МО Михаил Орлов/ }).click();
  release();
  await expect(page.locator(".answer-text")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Подготовить ответ", exact: true }),
  ).toBeEnabled();
});
test("адаптация под телефон без горизонтального переполнения", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Подготовить ответ", exact: true })
    .click();
  await expect(page.locator(".answer-text")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/mobile.png",
    fullPage: true,
  });
});
test("несохранённые изменения защищены при переходе через навигацию", async ({
  page,
}) => {
  await page.getByRole("button", { name: "База знаний", exact: true }).click();
  await page.getByLabel("Цена, ₽").fill("35000");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Диалоги", exact: true }).click();
  await expect(page.getByLabel("Цена, ₽")).toHaveValue("35000");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Диалоги", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Диалоги 4", exact: true }),
  ).toBeVisible();
});
test("база знаний валидирует пустой текст без потери данных", async ({
  page,
}) => {
  await page.getByRole("button", { name: "База знаний", exact: true }).click();
  await page.getByLabel("Факты и условия").fill("");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Название", { exact: true })).toHaveValue(
    "Комфорт 07",
  );
});
test("при отсутствии ключа выбранный live-режим явно заблокирован", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: "yandex",
        configured: false,
        model: "Yandex AI Studio",
        version: "1.0.0",
      }),
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Подготовить ответ", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("Подключите Yandex");
  await expect(page.getByText("Демо · без вызова ИИ")).toHaveCount(0);
});
test("клиентский HTML отображается текстом и не выполняется", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Сообщение клиента", exact: true })
    .click();
  await page.getByLabel("Текст обращения").fill("<img src=x onerror=alert(1)>");
  await page.getByRole("button", { name: "Добавить в диалог" }).click();
  await expect(page.locator(".message-text").last()).toHaveText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator(".message-text img")).toHaveCount(0);
});

test("портреты загружаются и соответствуют выбранному клиенту", async ({
  page,
}) => {
  const portraits = page.locator(".conversation .avatar img");
  await expect(portraits).toHaveCount(4);
  await expect
    .poll(() =>
      portraits.evaluateAll((images) =>
        images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
      ),
    )
    .toBe(true);
  for (const [name, file] of [
    ["Анна Смирнова", "anna"],
    ["Михаил Орлов", "mikhail"],
    ["Елена Волкова", "elena"],
    ["Дмитрий Соколов", "dmitry"],
  ]) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.locator(".profile-avatar img")).toHaveAttribute(
      "src",
      `/avatars/${file}.png`,
    );
    await expect(
      page.locator(".conversation[aria-pressed=true]"),
    ).toContainText(name);
  }
});

test("при недоступном портрете остаются инициалы и работающий диалог", async ({
  page,
}) => {
  await page.route("**/avatars/anna.png", (route) => route.abort());
  await page.reload();
  await expect(page.locator(".profile-avatar")).toHaveText("АС");
  await expect(page.locator(".profile-avatar img")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Подготовить ответ", exact: true })
    .click();
  await expect(page.locator(".answer-text")).toContainText("Комфорт 07");
});

test("панели помещаются на ноутбуке и планшете", async ({ page }) => {
  for (const width of [1280, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: /ДС Дмитрий Соколов/ }).click();
    await expect(page.locator(".chat-heading")).toContainText(
      "Дмитрий Соколов",
    );
    await page.getByRole("button", { name: /АС Анна Смирнова/ }).click();
    await page.screenshot({
      path: `docs/screenshots/${width === 1280 ? "laptop" : "tablet"}.png`,
      fullPage: true,
    });
  }
});
