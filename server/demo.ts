import type { Advice, Entry, Knowledge, Message } from "../shared/schema";
export const rub = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(n) + " ₽";
export function conversationSignals(messages: Message[]) {
  const clients = messages
    .filter((m) => m.role === "client")
    .map((m) => m.text.toLowerCase());
  const latest = clients.at(-1) || "";
  const refused = clients.some((t) =>
    /(?:монтаж|установк).{0,35}(?:не нуж|не надо|отказ)|(?:не нуж|не надо|без).{0,25}(?:монтаж|установк)|свой установщик|свои мастера|ничего дополнительно/i.test(
      t,
    ),
  );
  const offered = messages.some(
    (m) =>
      m.role === "manager" &&
      /(?:монтаж|установк).{0,40}(?:₽|руб|предлаг|есть)|(?:предлаг|есть).{0,40}(?:монтаж|установк)/i.test(
        m.text,
      ),
  );
  const support =
    /теч[её]т|сломал|не работа|неисправ|жалоб|не охлажда|поломк|вернуть|возврат/.test(
      latest,
    );
  return { latest, clients, refused, offered, support };
}
export function demoAdvice(messages: Message[], kb: Knowledge): Advice {
  const { latest, clients, refused, offered, support } =
    conversationSignals(messages);
  const entry = (id: string) => kb.entries.find((e) => e.id === id);
  const rule = entry("sales-rules") || kb.entries[0];
  const sources = new Set([rule.id]);
  const base: Advice = {
    answer: "",
    intent: "clarification",
    upsell: {
      status: "skip",
      title: "Сначала уточним потребность",
      reason:
        "Пока недостаточно информации для полезного дополнительного предложения.",
      phrase: "",
      itemId: null,
    },
    sourceIds: [],
    missing: [],
  };
  const cite = (e?: Entry) => {
    if (e) sources.add(e.id);
    return e;
  };
  const done = () => ({ ...base, sourceIds: [...sources] });
  if (support) {
    const warranty = cite(entry("warranty"));
    base.intent = "support";
    base.answer = warranty
      ? `Здравствуйте! Сожалею, что возникла проблема. Подскажите модель кондиционера, номер заказа и подробнее опишите неисправность — передадим обращение в сервис. ${warranty.text}`
      : "Здравствуйте! Сожалею, что возникла проблема. Подскажите модель, номер заказа и описание неисправности — уточним порядок обращения в сервис.";
    base.upsell = {
      status: "skip",
      title: "Допродажа неуместна",
      reason:
        "Клиент сообщил о проблеме. Сначала помогите с обращением в сервис.",
      phrase: "",
      itemId: null,
    };
    base.missing = ["Модель и номер заказа", "Подробности неисправности"];
    return done();
  }
  const installation = entry("installation");
  if (
    /монтаж|установ/.test(latest) &&
    /этаж|метр|трасс|нестандарт|высот/.test(latest)
  ) {
    cite(installation);
    base.answer = installation
      ? `Здравствуйте! ${installation.text} Подскажите адрес, длину трассы и есть ли безопасный доступ к наружному блоку. Менеджер сможет уточнить расчёт.`
      : "Здравствуйте! В базе нет условий такого монтажа. Подскажите адрес, длину трассы и доступ к наружному блоку — передадим данные менеджеру для расчёта.";
    base.upsell = {
      status: "clarify",
      title: "Сначала оценка монтажа",
      reason:
        "Условия могут выходить за стандартный монтаж. Не обещайте фиксированную цену до оценки.",
      phrase: "",
      itemId: null,
    };
    base.missing = ["Адрес и условия доступа к наружному блоку"];
    return done();
  }
  if (/достав|налич|когда|завтра|срок/.test(latest)) {
    const delivery = cite(entry("delivery"));
    base.answer = `Здравствуйте! ${delivery?.text || "В базе нет подтверждённых сроков, остатков и условий доставки."} Подскажите нужную модель и адрес доставки — менеджер проверит информацию.`;
    base.missing = ["Подтверждение наличия, сроков и доставки"];
    return done();
  }
  if (
    /скид|wi-?fi|вай.?фай|шум|децибел|потреблен|игнорируй|инструкци|промпт/.test(
      latest,
    )
  ) {
    base.answer =
      "Здравствуйте! В базе нет подтверждённых данных по этому вопросу. Уточню информацию у менеджера. Подскажите, какую модель вы рассматриваете?";
    base.missing = ["Подтверждение запрошенных условий или характеристик"];
    return done();
  }
  if (/обслужив|чистк/.test(latest)) {
    const service = cite(entry("maintenance"));
    if (service) {
      base.intent = "question";
      base.answer = `Здравствуйте! ${service.title}${service.price !== null ? ` стоит ${rub(service.price)}` : ""}. ${service.text} Подскажите модель и когда проводилось последнее обслуживание.`;
      base.upsell.title = "Клиент уже спрашивает об услуге";
      base.upsell.reason =
        "Ответьте на текущий запрос, дополнительное предложение пока не требуется.";
      return done();
    }
  }
  const areaMatch = [...clients]
    .reverse()
    .map((t) => t.match(/(\d{1,3})(?:[.,]\d+)?\s*(?:м[²2]|кв|метр)/))
    .find(Boolean);
  const area = areaMatch ? Number(areaMatch[1]) : null;
  const budgetMatch = [...clients]
    .reverse()
    .map((t) =>
      t.match(
        /(?:бюджет[^\d]{0,25}|до\s+)(\d{1,3}(?:[ \u00a0]?\d{3})*|\d+)(\s*(?:тыс|к))?/,
      ),
    )
    .find(Boolean);
  const budget = budgetMatch
    ? Number(budgetMatch[1].replace(/\s/g, "")) * (budgetMatch[2] ? 1000 : 1)
    : null;
  const products = kb.entries.filter((e) => e.kind === "product");
  const named = products.find((e) => latest.includes(e.title.toLowerCase()));
  const product =
    named ||
    (area
      ? products
          .filter(
            (e) =>
              e.maxArea! >= area && (budget === null || e.price! <= budget),
          )
          .sort((a, b) => a.price! - b.price!)[0]
      : undefined);
  if (product) {
    cite(product);
    base.intent = "selection";
    base.answer = `Здравствуйте! ${product.title} — ${rub(product.price!)}. ${product.text}`;
    if (/гарант/.test(latest)) {
      const w = cite(entry("warranty"));
      if (w) base.answer += ` ${w.text}`;
    }
    base.answer +=
      " Подскажите высоту потолков и выходит ли комната на солнечную сторону, чтобы подтвердить подбор.";
    base.missing = ["Высота потолков и солнечная сторона"];
    if (refused || offered) {
      base.upsell = {
        status: "skip",
        title: refused ? "Учитываем отказ клиента" : "Монтаж уже предложен",
        reason: refused
          ? "В переписке клиент отказался от монтажа или дополнительных услуг. Не повторяйте предложение."
          : "Менеджер уже предложил монтаж. Дождитесь ответа клиента, не дублируйте предложение.",
        phrase: "",
        itemId: null,
      };
    } else if (installation && installation.price !== null) {
      cite(installation);
      base.upsell = {
        status: "offer",
        title: installation.title,
        reason:
          "Клиент выбирает новый кондиционер. Уточните, нужен ли монтаж; услуга оплачивается отдельно, условия нужно проверить.",
        phrase: `Если у вас ещё нет установщика, можем обсудить ${installation.title.toLowerCase()} за ${rub(installation.price)}. Подскажите, нужна ли установка?`,
        itemId: installation.id,
      };
    }
    return done();
  }
  const warranty = entry("warranty");
  if (/гарант/.test(latest) && warranty) {
    cite(warranty);
    base.intent = "question";
    base.answer = `Здравствуйте! ${warranty.text}`;
    return done();
  }
  if (area) {
    base.answer = `Здравствуйте! В текущей базе не нашлось подходящего варианта под указанные площадь${budget !== null ? " и бюджет" : ""}. Уточним доступные варианты у менеджера. Подскажите, готовы ли вы рассмотреть другие модели?`;
    base.missing = ["Подтверждение альтернатив менеджером"];
  } else {
    base.answer =
      "Здравствуйте! Помогу разобраться. Подскажите, пожалуйста, площадь комнаты, бюджет и что именно вас интересует: подбор кондиционера, монтаж или обслуживание?";
    base.missing = ["Площадь помещения", "Бюджет и задача клиента"];
  }
  return done();
}
