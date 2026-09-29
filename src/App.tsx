import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import {
  ArrowDownLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clipboard,
  FileText,
  LayoutGrid,
  LoaderCircle,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  ConversationSchema,
  KnowledgeSchema,
  type Conversation,
  type Entry,
  type Generated,
  type Health,
  type Knowledge,
} from "../shared/schema";
import { makeConversations } from "../shared/seed";
const storageKey = "o-complex-workspace-v1";
const money = (n: number) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";
const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("");
const kindName = { product: "Товар", service: "Услуга", policy: "Правило" };
const portraits: Record<string, string> = {
  selection: "anna",
  refusal: "mikhail",
  complex: "elena",
  support: "dmitry",
};
function Avatar({
  person,
  className = "",
}: {
  person: Conversation;
  className?: string;
}) {
  const portrait = portraits[person.id];
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [portrait]);
  return (
    <div className={`avatar ${person.color} ${className}`}>
      <span className={portrait && !failed ? "sr-only" : ""}>
        {initials(person.name)}
      </span>
      {portrait && !failed && (
        <img
          src={`/avatars/${portrait}.png`}
          alt=""
          width="48"
          height="48"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
function readWorkspace() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw)
      return {
        conversations: z
          .array(ConversationSchema)
          .min(1)
          .max(40)
          .parse(JSON.parse(raw)),
        warning: "",
      };
  } catch {
    return {
      conversations: makeConversations(),
      warning:
        "Не удалось прочитать сохранённую переписку. Открыты исходные сценарии.",
    };
  }
  return { conversations: makeConversations(), warning: "" };
}
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      "Сервер недоступен. Проверьте, что приложение запущено, и повторите запрос.",
    );
  }
  if (!response.ok)
    throw new Error(body.error || "Не удалось выполнить запрос.");
  return body as T;
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={wide ? "modal wide" : "modal"}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            className="icon-button"
            aria-label="Закрыть окно"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export default function App() {
  const [initial] = useState(readWorkspace);
  const [conversations, setConversations] = useState(initial.conversations);
  const [activeId, setActiveId] = useState(initial.conversations[0].id);
  const [kbDirty, setKbDirty] = useState(false);
  const [page, setPage] = useState<"chats" | "knowledge">("chats");
  const [knowledge, setKnowledge] = useState<Knowledge | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const presentation = [
    "Я сделал «Контекст» — помощника для менеджера магазина кондиционеров. Он помогает быстрее отвечать клиентам и замечать, когда уместно предложить дополнительную услугу. Для тестового задания здесь создана имитация CRM: реальные сообщения клиентам не отправляются.",
    "У сервиса есть небольшая база знаний — справочник с товарами, ценами, услугами и правилами компании. Менеджер может редактировать её прямо в приложении. После сохранения новые ответы используют обновлённые сведения.",
    "По кнопке «Подготовить ответ» помощник получает историю разговора и базу знаний. Он готовит два отдельных блока: вежливый ответ клиенту и внутреннюю подсказку менеджеру с объяснением, что можно предложить дополнительно.",
    "Например, к подходящему кондиционеру можно предложить монтаж. Но помощник должен учитывать предыдущие сообщения: не повторять предложение после отказа, при жалобе сначала помогать, а если сведений не хватает — уточнять их, а не выдумывать цену или условия.",
    "Под ответом можно открыть использованные записи базы. Менеджер проверяет текст, при необходимости меняет его и сам отправляет в диалог. Внутренняя подсказка автоматически клиенту не отправляется.",
    health?.provider === "demo"
      ? "В этой версии сейчас включён демонстрационный режим по правилам. Для настоящей генерации предусмотрено подключение языковой модели."
      : health?.provider === "openrouter"
        ? "Ответы здесь генерирует настоящая языковая модель через OpenRouter. Сервер дополнительно проверяет формат ответа, ссылки на базу и указанные суммы. При этом окончательная проверка остаётся за менеджером."
        : "Ответы генерирует языковая модель через Yandex AI Studio. Сервер дополнительно проверяет формат ответа, ссылки на базу и указанные суммы. При этом окончательная проверка остаётся за менеджером.",
    "Для разработки я использовал Codex: он помог подготовить интерфейс, серверную логику и тесты. Аватары клиентов сгенерированы с помощью ImageGen.",
  ];
  const [startupError, setStartupError] = useState("");
  const [storageWarning, setStorageWarning] = useState(initial.warning);
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, Generated>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<
    "client" | "new" | "reset" | "settings" | "help" | null
  >(null);
  const [clientText, setClientText] = useState("");
  const [newName, setNewName] = useState("");
  const [source, setSource] = useState<Entry | null>(null);
  const request = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const active =
    conversations.find((c) => c.id === activeId) || conversations[0];
  const result = answers[active.id];
  const draft = drafts[active.id] || "";
  function navigate(next: "chats" | "knowledge") {
    if (next === page) return;
    if (
      kbDirty &&
      !window.confirm(
        "Есть несохранённые изменения базы. Выйти без сохранения?",
      )
    )
      return;
    setKbDirty(false);
    setPage(next);
  }
  async function load() {
    setStartupError("");
    try {
      const [h, k] = await Promise.all([
        api<Health>("/api/health"),
        api<Knowledge>("/api/knowledge"),
      ]);
      setHealth(h);
      setKnowledge(k);
      setAnswers({});
    } catch (e) {
      setStartupError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(conversations));
    } catch {
      setStorageWarning(
        "Браузер не сохранил переписку. Не закрывайте страницу до завершения демонстрации.",
      );
    }
  }, [conversations]);
  useEffect(() => {
    const list = bottom.current?.parentElement;
    if (list) list.scrollTop = list.scrollHeight;
  }, [active.id, active.messages.length, page]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  function cancel() {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setError("");
  }
  function select(id: string) {
    cancel();
    setActiveId(id);
  }
  function append(role: "client" | "manager", text: string) {
    if (!text.trim()) return;
    if (active.messages.length >= 80) {
      setToast("В диалоге уже 80 сообщений. Создайте новый диалог.");
      return;
    }
    cancel();
    setConversations((list) =>
      list.map((c) =>
        c.id === active.id
          ? {
              ...c,
              messages: [
                ...c.messages,
                {
                  id: crypto.randomUUID(),
                  role,
                  text: text.trim(),
                  at: new Date().toISOString(),
                },
              ],
            }
          : c,
      ),
    );
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[active.id];
      return next;
    });
    if (role === "manager") setDrafts((d) => ({ ...d, [active.id]: "" }));
    else {
      setClientText("");
      setModal(null);
    }
  }
  async function generate() {
    if (!knowledge || !active.messages.some((m) => m.role === "client")) return;
    cancel();
    setBusy(true);
    // Remove the old result before regeneration so it cannot be mistaken for a fresh response after an error.
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[active.id];
      return next;
    });
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(() => controller.abort("timeout"), 65000);
    const id = active.id;
    try {
      const answer = await api<Generated>("/api/generate", {
        method: "POST",
        body: JSON.stringify({
          messages: active.messages,
          revision: knowledge.revision,
        }),
        signal: controller.signal,
      });
      if (request.current === controller)
        setAnswers((prev) => ({ ...prev, [id]: answer }));
    } catch (e) {
      if (request.current === controller)
        setError(
          controller.signal.aborted
            ? "Ожидание ответа истекло. Повторите запрос."
            : (e as Error).message,
        );
    } finally {
      clearTimeout(timer);
      if (request.current === controller) {
        setBusy(false);
        request.current = null;
      }
    }
  }
  function insert(text: string) {
    if (
      draft.trim() &&
      !window.confirm("Заменить текущий черновик новым текстом?")
    )
      return;
    setDrafts((d) => ({ ...d, [active.id]: text }));
    setToast("Черновик вставлен. Проверьте его перед отправкой.");
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast("Скопировано");
    } catch {
      setToast("Копирование недоступно. Выделите текст и скопируйте вручную.");
    }
  }
  const filtered = conversations.filter((c) =>
    `${c.name} ${c.topic} ${c.messages.at(-1)?.text || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Основная навигация">
        <button
          className="brand-mark"
          aria-label="Контекст — диалоги"
          onClick={() => navigate("chats")}
        >
          <LayoutGrid size={24} />
        </button>
        <div className="rail-links">
          <button
            title="Диалоги"
            aria-label="Диалоги"
            className={`rail-button ${page === "chats" ? "selected" : ""}`}
            onClick={() => navigate("chats")}
          >
            <MessageSquare size={21} />
          </button>
          <button
            title="База знаний"
            aria-label="База знаний"
            className={`rail-button ${page === "knowledge" ? "selected" : ""}`}
            onClick={() => navigate("knowledge")}
          >
            <BookOpen size={21} />
          </button>
        </div>
        <div className="rail-bottom">
          <button
            className="rail-button"
            aria-label="О сервисе"
            title="О сервисе"
            onClick={() => setModal("help")}
          >
            <CircleHelp size={21} />
          </button>
          <button
            className="rail-button"
            aria-label="Настройки подключения"
            title="Настройки подключения"
            onClick={() => setModal("settings")}
          >
            <Settings2 size={21} />
          </button>
          <div className="my-avatar" title="Менеджер Владислав">
            ВН
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="wordmark">
            контекст<span>помощник менеджера</span>
          </div>
          <div className="topbar-right">
            <span className="prototype-badge">Прототип · имитация CRM</span>
            <span className="divider" />
            <span className="company-dot" />{" "}
            <span className="company-name">Свой климат</span>
            <div className="company-avatar">СК</div>
          </div>
        </header>
        {storageWarning && (
          <div className="global-warning" role="alert">
            {storageWarning}
            <button
              onClick={() => setStorageWarning("")}
              aria-label="Скрыть предупреждение"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {startupError ? (
          <div className="startup">
            <CircleHelp size={32} />
            <h1>Не удалось подключиться к серверу</h1>
            <p>{startupError}</p>
            <button className="primary" onClick={() => void load()}>
              Повторить подключение
            </button>
          </div>
        ) : !knowledge || !health ? (
          <div className="startup">
            <LoaderCircle className="spin" />
            <p>Подключаем рабочее пространство…</p>
          </div>
        ) : page === "knowledge" ? (
          <KnowledgeEditor
            onDirtyChange={setKbDirty}
            knowledge={knowledge}
            onSaved={(kb) => {
              cancel();
              setKnowledge(kb);
              setAnswers({});
              setToast("База знаний сохранена. Подготовьте ответы заново.");
            }}
            onBack={() => navigate("chats")}
          />
        ) : (
          <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</div>
                <h1>
                  Диалоги{" "}
                  <span className="count-pill">{conversations.length}</span>
                </h1>
                <p>Помогайте клиентам. Не упускайте детали.</p>
              </div>
              <div className="page-actions">
                <button
                  className="text-button"
                  onClick={() => setModal("reset")}
                >
                  <RotateCcw size={15} /> Сбросить демо
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setNewName("");
                    setModal("new");
                  }}
                  disabled={conversations.length >= 40}
                >
                  <Plus size={17} /> Новый диалог
                </button>
              </div>
            </div>
            <div className="crm-grid">
              <section className="conversations" aria-label="Список диалогов">
                <div className="conversation-list-heading">
                  <h2>
                    Входящие <span>{conversations.length}</span>
                  </h2>
                  <span className="tiny-label">ДЕМО</span>
                </div>
                <div className="search-box">
                  <Search size={16} />
                  <input
                    aria-label="Поиск диалогов"
                    placeholder="Найти диалог"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="conversation-items">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      className={`conversation ${active.id === c.id ? "active" : ""}`}
                      aria-pressed={active.id === c.id}
                      onClick={() => select(c.id)}
                    >
                      <Avatar person={c} />
                      <div className="conversation-copy">
                        <div className="conversation-name">
                          {c.name}
                          <span className="unread-dot" />
                        </div>
                        <div className="conversation-preview">
                          {c.messages.at(-1)?.text ||
                            "Начните общение с клиентом"}
                        </div>
                        <span className="scenario-tag">{c.topic}</span>
                      </div>
                    </button>
                  ))}
                  {!filtered.length && (
                    <p className="empty-search">Диалоги не найдены</p>
                  )}
                </div>
                <div className="scenario-note">
                  <div className="note-icon">
                    <Zap size={18} />
                  </div>
                  <strong>Попробуйте разные ситуации</strong>
                  <p>
                    Подбор, отказ от услуги и сложный вопрос — помощник
                    учитывает контекст.
                  </p>
                </div>
                <div className="list-footer">
                  <span className="green-dot" /> Переписка сохраняется в
                  браузере
                </div>
              </section>
              <section className="chat" aria-label="Переписка">
                <div className="chat-heading">
                  <Avatar person={active} className="profile-avatar" />
                  <div>
                    <h2>{active.name}</h2>
                    <span>Клиент · {active.topic}</span>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Информация о диалоге"
                    title="Это демонстрационный диалог"
                    onClick={() => setModal("help")}
                  >
                    <MoreHorizontal size={21} />
                  </button>
                </div>
                <div className="deal-strip">
                  <span className="deal-icon">
                    <FileText size={15} />
                  </span>
                  <span>Консультация по кондиционеру</span>
                  <span className="stage-tag">Новый запрос</span>
                </div>
                <div className="message-list">
                  <div className="date-divider">
                    <span>Демонстрационная переписка</span>
                  </div>
                  {active.messages.map((m) => (
                    <div key={m.id} className={`message-row ${m.role}`}>
                      <div className="message">
                        <div className="message-author">
                          {m.role === "client"
                            ? active.name.split(" ")[0]
                            : "Вы · менеджер"}
                        </div>
                        <div className="message-text">{m.text}</div>
                        <div className="message-meta">
                          {new Date(m.at).toLocaleTimeString("ru-RU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {m.role === "manager" && <CheckCheck size={14} />}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!active.messages.length && (
                    <div className="empty-chat">
                      <MessageSquare size={30} />
                      <h3>Новый диалог</h3>
                      <p>
                        Добавьте обращение клиента, чтобы помощник подготовил
                        ответ.
                      </p>
                    </div>
                  )}
                  <div ref={bottom} />
                </div>
                <div className="client-simulator">
                  <div>
                    <span className="green-dot" /> Тестируйте диалог вживую
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setClientText("");
                      setModal("client");
                    }}
                    disabled={active.messages.length >= 80}
                  >
                    <Plus size={14} /> Сообщение клиента
                  </button>
                </div>
                <form
                  className="composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    append("manager", draft);
                  }}
                >
                  <div className="composer-label">
                    <span>
                      <SquarePen size={14} /> Ответ менеджера
                    </span>
                    <span>Увидит клиент</span>
                  </div>
                  <textarea
                    aria-label="Ответ менеджера"
                    placeholder="Напишите ответ или вставьте черновик помощника…"
                    value={draft}
                    maxLength={4000}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [active.id]: e.target.value }))
                    }
                  />
                  <div className="composer-bottom">
                    <span>
                      {draft.length
                        ? `${draft.length} / 4000`
                        : "Проверьте факты перед отправкой"}
                    </span>
                    <button
                      className="send-button"
                      type="submit"
                      disabled={!draft.trim() || active.messages.length >= 80}
                    >
                      Отправить <Send size={15} />
                    </button>
                  </div>
                </form>
              </section>
              <aside className="assistant" aria-label="Помощник">
                <div className="assistant-heading">
                  <div className="sparkle-box">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h2>Помощник</h2>
                    <span>На основе вашей базы знаний</span>
                  </div>
                  <span className="assistant-dot" />
                </div>
                <div
                  className={`mode-banner ${health.provider === "demo" ? "demo" : "live"}`}
                >
                  <span className="mode-dot" />
                  <div>
                    <strong>
                      {health.provider === "demo"
                        ? "Демо · без вызова ИИ"
                        : health.provider === "openrouter"
                          ? "OpenRouter · настоящий ИИ"
                          : "Yandex AI Studio"}
                    </strong>
                    <span>
                      {health.provider === "demo"
                        ? "Ответы по локальным правилам"
                        : health.configured
                          ? "Генерация с учётом переписки"
                          : "Требуется настройка API-ключа"}
                    </span>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="О режиме работы"
                    onClick={() => setModal("settings")}
                  >
                    <CircleHelp size={16} />
                  </button>
                </div>
                <div className="assistant-scroll">
                  <div className="context-summary">
                    <span>
                      <MessageSquare size={14} /> {active.messages.length}{" "}
                      сообщ.
                    </span>
                    <span>
                      <BookOpen size={14} /> {knowledge.entries.length} записей
                    </span>
                    <span>v{knowledge.revision}</span>
                  </div>
                  <button
                    className="generate-button"
                    onClick={() => void generate()}
                    disabled={
                      busy ||
                      !active.messages.some((m) => m.role === "client") ||
                      !health.configured
                    }
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={18} />
                    ) : (
                      <Sparkles size={18} />
                    )}{" "}
                    {busy
                      ? "Готовим ответ…"
                      : result
                        ? "Подготовить заново"
                        : "Подготовить ответ"}{" "}
                    {!busy && <ArrowRight size={17} />}
                  </button>
                  {!health.configured && (
                    <div role="alert" className="error-box">
                      Подключите{" "}
                      {health.provider === "openrouter"
                        ? "OpenRouter"
                        : "Yandex AI Studio"}{" "}
                      через .env. Инструкция — в настройках.
                    </div>
                  )}
                  {error && (
                    <div className="error-box" role="alert">
                      <strong>Ответ не получен</strong>
                      <p>{error}</p>
                      <button
                        className="text-button"
                        onClick={() => {
                          void load();
                          setError("");
                        }}
                      >
                        Обновить подключение и базу
                      </button>
                    </div>
                  )}
                  {busy ? (
                    <div className="generating">
                      <div className="loading-orb">
                        <Sparkles size={28} />
                      </div>
                      <h3>Собираем контекст</h3>
                      <p>Проверяем переписку и базу знаний</p>
                      <div className="skeleton" />
                      <div className="skeleton short" />
                      <div className="skeleton" />
                    </div>
                  ) : result ? (
                    <div className="results">
                      <article className="answer-card">
                        <div className="card-eyebrow">
                          <span className="number-icon">1</span> ОТВЕТ КЛИЕНТУ{" "}
                          <span className="draft-badge">Черновик</span>
                        </div>
                        <p className="answer-text">{result.answer}</p>
                        <div className="answer-actions">
                          <button
                            className="insert-button"
                            onClick={() => insert(result.answer)}
                          >
                            <ArrowDownLeft size={15} /> Вставить в сообщение
                          </button>
                          <button
                            className="icon-button"
                            aria-label="Скопировать ответ"
                            title="Скопировать ответ"
                            onClick={() => void copy(result.answer)}
                          >
                            <Clipboard size={16} />
                          </button>
                        </div>
                      </article>
                      <article
                        className={`upsell-card ${result.upsell.status}`}
                      >
                        <div className="card-eyebrow">
                          <span className="number-icon">2</span> ПОДСКАЗКА
                          МЕНЕДЖЕРУ
                        </div>
                        <div className="private-label">
                          <ShieldCheck size={13} /> Видно только вам
                        </div>
                        <h3>{result.upsell.title}</h3>
                        {result.upsell.itemId &&
                          knowledge.entries.find(
                            (e) => e.id === result.upsell.itemId,
                          )?.price !== null && (
                            <div className="upsell-price">
                              {money(
                                knowledge.entries.find(
                                  (e) => e.id === result.upsell.itemId,
                                )!.price!,
                              )}
                            </div>
                          )}
                        <p>{result.upsell.reason}</p>
                        {result.upsell.phrase && (
                          <>
                            <div className="suggestion-quote">
                              «{result.upsell.phrase}»
                            </div>
                            <button
                              className="text-button"
                              onClick={() => void copy(result.upsell.phrase)}
                            >
                              <Clipboard size={14} /> Скопировать фразу
                            </button>
                          </>
                        )}
                      </article>
                      {result.missing.length > 0 && (
                        <div className="missing-data">
                          <h4>
                            <CircleHelp size={14} /> Что уточнить
                          </h4>
                          {result.missing.map((x) => (
                            <p key={x}>{x}</p>
                          ))}
                        </div>
                      )}
                      <div className="sources">
                        <h4>
                          <BookOpen size={14} /> Источники ответа
                        </h4>
                        {result.sourceIds.map((id) => {
                          const e = knowledge.entries.find((x) => x.id === id);
                          return (
                            e && (
                              <button key={id} onClick={() => setSource(e)}>
                                {e.title}
                                <ChevronRight size={14} />
                              </button>
                            )
                          );
                        })}
                      </div>
                      <div className="result-footer">
                        <Check size={13} />{" "}
                        {result.mode === "demo"
                          ? "Правила · не генерация ИИ"
                          : "Сгенерировано ИИ"}{" "}
                        · база v{result.revision}
                      </div>
                    </div>
                  ) : (
                    !error && (
                      <div className="assistant-empty">
                        <div className="empty-illustration">
                          <div className="mini-card">
                            <div />
                            <div />
                            <div />
                          </div>
                          <div className="floating-sparkle">
                            <Sparkles size={23} />
                          </div>
                        </div>
                        <h3>
                          Хороший ответ начинается
                          <br />с контекста
                        </h3>
                        <p>
                          Помощник прочитает диалог, сверится с базой и
                          подготовит два блока.
                        </p>
                        <div className="empty-feature">
                          <span>01</span>
                          <div>
                            <strong>Ответ клиенту</strong>
                            <p>Вежливо и по делу</p>
                          </div>
                        </div>
                        <div className="empty-feature">
                          <span>02</span>
                          <div>
                            <strong>Подсказка по допродаже</strong>
                            <p>Только когда это уместно</p>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
                <div className="assistant-footer">
                  <ShieldCheck size={14} /> Отправку всегда подтверждает
                  менеджер
                </div>
              </aside>
            </div>
            <footer className="workspace-footer">
              <span>
                Свой климат — вымышленная компания. Цены демонстрационные.
              </span>
              <span>Тестовое задание · О-комплекс</span>
            </footer>
          </>
        )}
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal === "client" && (
        <Modal title="Сообщение от клиента" onClose={() => setModal(null)}>
          <p className="modal-description">
            Симуляция входящего сообщения от {active.name}. Помощник учтёт его
            вместе с историей диалога.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              append("client", clientText);
            }}
          >
            <label className="field-label" htmlFor="client-message">
              Текст обращения
            </label>
            <textarea
              id="client-message"
              className="large-input"
              autoFocus
              maxLength={4000}
              rows={5}
              value={clientText}
              onChange={(e) => setClientText(e.target.value)}
              placeholder="Например: А если комната 30 м²?"
            />
            <div className="modal-actions">
              <span>{clientText.length} / 4000</span>
              <button
                className="primary"
                type="submit"
                disabled={!clientText.trim() || active.messages.length >= 80}
              >
                Добавить в диалог <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "new" && (
        <Modal title="Новый диалог" onClose={() => setModal(null)}>
          <p className="modal-description">
            Создайте свой сценарий и проверьте помощника на новых вопросах.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              const c: Conversation = {
                id: crypto.randomUUID(),
                name: newName.trim(),
                topic: "Новый диалог",
                color: "lavender",
                messages: [],
              };
              cancel();
              setConversations((p) => [c, ...p]);
              setActiveId(c.id);
              setSearch("");
              setModal(null);
            }}
          >
            <label className="field-label" htmlFor="client-name">
              Имя клиента
            </label>
            <input
              id="client-name"
              className="large-input"
              autoFocus
              maxLength={80}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Имя и фамилия"
            />
            <div className="modal-actions">
              <span />
              <button
                className="primary"
                type="submit"
                disabled={!newName.trim()}
              >
                Создать диалог
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "reset" && (
        <Modal title="Сбросить демонстрацию?" onClose={() => setModal(null)}>
          <p className="modal-description">
            Все диалоги и черновики в этом браузере заменятся четырьмя исходными
            сценариями. Изменения базы знаний сохранятся.
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setModal(null)}>
              Отмена
            </button>
            <button
              className="primary"
              onClick={() => {
                cancel();
                const cs = makeConversations();
                setConversations(cs);
                setActiveId(cs[0].id);
                setDrafts({});
                setAnswers({});
                setSearch("");
                setModal(null);
                setToast("Исходные диалоги восстановлены");
              }}
            >
              Сбросить диалоги
            </button>
          </div>
        </Modal>
      )}
      {modal === "settings" && (
        <Modal title="Подключение помощника" onClose={() => setModal(null)}>
          <div className="settings-status">
            <span className="green-dot" />
            <strong>
              {health?.provider === "demo"
                ? "Демонстрационный режим"
                : health?.configured
                  ? "API настроен"
                  : "API требует настройки"}
            </strong>
          </div>
          <p className="modal-description">
            {health?.provider === "demo"
              ? "Сейчас работают локальные правила для демонстрационных сценариев. Это не языковая модель. Для полноценной генерации подключите API."
              : "Наличие конфигурации не подтверждает работоспособность ключа. Подготовьте ответ, чтобы проверить доступ к модели."}
          </p>
          {health?.provider !== "demo" && (
            <p className="modal-description">Модель: {health?.model}</p>
          )}
          <h3>Как подключить ИИ</h3>
          <ol className="settings-steps">
            <li>
              Скопируйте <code>.env.example</code> в <code>.env</code> в папке
              проекта.
            </li>
            <li>
              Для OpenRouter: <code>AI_PROVIDER=openrouter</code> и{" "}
              <code>OPENROUTER_API_KEY</code>. Необязательный резерв:{" "}
              <code>OPENROUTER_API_KEY_BACKUP</code>.
            </li>
            <li>
              Для Яндекса: <code>AI_PROVIDER=yandex</code>,{" "}
              <code>YANDEX_API_KEY</code> и <code>YANDEX_FOLDER_ID</code>.
            </li>
            <li>Перезапустите приложение и подготовьте ответ.</li>
          </ol>
          <p className="privacy-note">
            <ShieldCheck size={16} /> Ключ хранится только на сервере. В режиме
            ИИ переписка и база отправляются провайдеру для обработки.
          </p>
          <button
            className="secondary"
            onClick={() => {
              void load();
              setToast("Проверяем подключение");
            }}
          >
            <RefreshCw size={15} /> Обновить статус
          </button>
        </Modal>
      )}
      {modal === "help" && (
        <Modal title="О сервисе «Контекст»" onClose={() => setModal(null)} wide>
          <p className="presentation-caption">
            Текст для демонстрации · около 1–2 минут
          </p>
          <div className="presentation-text">
            {presentation.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <button
            className="secondary"
            onClick={() => void copy(presentation.join("\n\n"))}
          >
            <Clipboard size={16} /> Скопировать текст
          </button>
        </Modal>
      )}
      {source && (
        <Modal title={source.title} onClose={() => setSource(null)}>
          <div className="source-meta">
            <span className="scenario-tag">{kindName[source.kind]}</span>
            {source.price !== null && <strong>{money(source.price)}</strong>}
            {source.maxArea && <span>до {source.maxArea} м²</span>}
          </div>
          <p className="source-text">{source.text}</p>
          <p className="muted">
            Источник: {source.id} · база v{knowledge?.revision}
          </p>
        </Modal>
      )}
    </div>
  );
}
function KnowledgeEditor({
  knowledge,
  onSaved,
  onBack,
  onDirtyChange,
}: {
  onDirtyChange: (dirty: boolean) => void;
  knowledge: Knowledge;
  onSaved: (kb: Knowledge) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<Knowledge>(structuredClone(knowledge));
  const [selected, setSelected] = useState(knowledge.entries[0].id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(knowledge);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  const current =
    draft.entries.find((e) => e.id === selected) || draft.entries[0];
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  function update(patch: Partial<Entry>) {
    setDraft((k) => ({
      ...k,
      entries: k.entries.map((e) =>
        e.id === current.id ? { ...e, ...patch } : e,
      ),
    }));
  }
  async function save() {
    setError("");
    const parsed = KnowledgeSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      const next = await api<Knowledge>("/api/knowledge", {
        method: "PUT",
        body: JSON.stringify(parsed.data),
      });
      setDraft(next);
      onSaved(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function back() {
    onBack();
  }
  return (
    <div className="knowledge-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ИСТОЧНИК ФАКТОВ</div>
          <h1>
            База знаний{" "}
            <span className="count-pill">{draft.entries.length}</span>
          </h1>
          <p>Товары, услуги и правила, на которые опирается помощник.</p>
        </div>
        <div className="page-actions">
          <button className="secondary" onClick={back}>
            К диалогам
          </button>
          <button
            className="primary"
            onClick={() => void save()}
            disabled={saving || !dirty}
          >
            {saving ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Check size={16} />
            )}{" "}
            Сохранить изменения
          </button>
        </div>
      </div>
      <div className="kb-banner">
        <BookOpen size={18} />
        <span>
          Вымышленная компания «Свой климат». Изменения применяются ко всем
          новым ответам.
        </span>
        <span className="kb-version">
          Версия {knowledge.revision}
          {dirty ? " · не сохранено" : " · сохранено"}
        </span>
      </div>
      {error && (
        <div role="alert" className="error-box">
          {error}
        </div>
      )}
      <div className="knowledge-grid">
        <div className="knowledge-list">
          {(["product", "service", "policy"] as const).map((kind) => (
            <div className="knowledge-group" key={kind}>
              <div className="group-label">
                {
                  {
                    product: "ТОВАРЫ",
                    service: "УСЛУГИ",
                    policy: "ПРАВИЛА И УСЛОВИЯ",
                  }[kind]
                }
              </div>
              {draft.entries
                .filter((e) => e.kind === kind)
                .map((e) => (
                  <button
                    key={e.id}
                    className={`knowledge-item ${e.id === current.id ? "selected" : ""}`}
                    onClick={() => setSelected(e.id)}
                  >
                    <div className="knowledge-item-icon">
                      {kind === "product" ? (
                        <LayoutGrid size={18} />
                      ) : kind === "service" ? (
                        <Zap size={18} />
                      ) : (
                        <FileText size={18} />
                      )}
                    </div>
                    <span>
                      <strong>{e.title || "Без названия"}</strong>
                      <small>
                        {e.price !== null
                          ? money(e.price)
                          : "Условия консультации"}
                      </small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
            </div>
          ))}
          <button
            className="secondary add-entry"
            disabled={draft.entries.length >= 30 || saving}
            onClick={() => {
              const id = `entry-${crypto.randomUUID().slice(0, 8)}`;
              setDraft((d) => ({
                ...d,
                entries: [
                  ...d.entries,
                  {
                    id,
                    kind: "policy",
                    title: "Новая запись",
                    text: "",
                    price: null,
                    maxArea: null,
                  },
                ],
              }));
              setSelected(id);
            }}
          >
            <Plus size={16} /> Добавить запись
          </button>
        </div>
        <div className="knowledge-form">
          <div className="editor-title">
            <div>
              <span className="eyebrow">РЕДАКТИРОВАНИЕ ЗАПИСИ</span>
              <h2>{current.title || "Новая запись"}</h2>
            </div>
            <button
              className="icon-button delete-button"
              aria-label="Удалить запись"
              disabled={draft.entries.length <= 1 || saving}
              onClick={() => {
                if (
                  window.confirm(
                    `Удалить запись «${current.title}»? Изменение применится после сохранения.`,
                  )
                ) {
                  const entries = draft.entries.filter(
                    (e) => e.id !== current.id,
                  );
                  setDraft((d) => ({ ...d, entries }));
                  setSelected(entries[0].id);
                }
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
          <fieldset disabled={saving}>
            <label className="field-label" htmlFor="entry-title">
              Название
            </label>
            <input
              className="large-input"
              id="entry-title"
              maxLength={120}
              value={current.title}
              onChange={(e) => update({ title: e.target.value })}
            />
            <div className="field-row">
              <div>
                <label className="field-label" htmlFor="entry-kind">
                  Тип записи
                </label>
                <select
                  className="large-input"
                  id="entry-kind"
                  value={current.kind}
                  onChange={(e) =>
                    update({ kind: e.target.value as Entry["kind"] })
                  }
                >
                  <option value="product">Товар</option>
                  <option value="service">Услуга</option>
                  <option value="policy">Правило</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="entry-price">
                  Цена, ₽
                </label>
                <input
                  className="large-input"
                  id="entry-price"
                  type="number"
                  min={0}
                  max={10000000}
                  value={current.price ?? ""}
                  placeholder="Не указана"
                  onChange={(e) =>
                    update({
                      price:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            {current.kind === "product" && (
              <>
                <label className="field-label" htmlFor="entry-area">
                  Площадь помещения, до м²
                </label>
                <input
                  className="large-input"
                  id="entry-area"
                  type="number"
                  min={1}
                  max={1000}
                  value={current.maxArea ?? ""}
                  onChange={(e) =>
                    update({
                      maxArea:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </>
            )}
            <label className="field-label" htmlFor="entry-text">
              Факты и условия
            </label>
            <textarea
              className="large-input knowledge-text"
              id="entry-text"
              maxLength={2500}
              rows={7}
              value={current.text}
              onChange={(e) => update({ text: e.target.value })}
            />
            <div className="field-hint">
              Указывайте только проверенные сведения. Неизвестную цену
              оставляйте пустой.
            </div>
          </fieldset>
          <div className="editor-note">
            <ShieldCheck size={20} />
            <div>
              <strong>Одна база для всех ответов</strong>
              <p>
                После сохранения старые рекомендации сбросятся. Помощник получит
                обновлённые условия при следующем запросе.
              </p>
            </div>
          </div>
          <div className="entry-id">ID записи: {current.id}</div>
        </div>
      </div>
    </div>
  );
}
