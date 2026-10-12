"use client";
import { useEffect, useRef, useState } from "react";
import "./checklist.css";
export type Checklist = {
  items: { id: string; text: string; done: boolean }[];
  revision: number;
  updatedAt: string | null;
};
export type ChecklistInput = Pick<Checklist, "items" | "revision">;

export default function ChecklistEditor({
  read,
  write,
  onDirty,
  onError,
  title,
  eyebrow,
  description,
  demo = false,
}: {
  read: () => Promise<Checklist>;
  write: (input: ChecklistInput) => Promise<Checklist>;
  onDirty: (value: boolean) => void;
  onError: (error: unknown) => void;
  title: string;
  eyebrow: string;
  description: string;
  demo?: boolean;
}) {
  const [saved, setSaved] = useState<Checklist | null>(null);
  const [items, setItems] = useState<Checklist["items"]>([]);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const callbacks = useRef({ onDirty, onError });
  callbacks.current = { onDirty, onError };
  const generation = useRef(0);
  const changed =
    saved !== null && JSON.stringify(items) !== JSON.stringify(saved.items);
  const dirty = changed || adding.length > 0;
  useEffect(() => {
    callbacks.current.onDirty(dirty || busy);
  }, [dirty, busy]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const showError = (e: unknown) => {
    const code = e && typeof e === "object" && "code" in e ? e.code : "";
    setError(
      code === "REVISION_CONFLICT"
        ? "Список изменился в другом окне. Ваш вариант остался здесь. Скопируйте нужные пункты перед загрузкой сохранённой версии."
        : "Не удалось сохранить или загрузить список. Попробуйте снова — изменения остались в форме.",
    );
    if (code !== "REVISION_CONFLICT") callbacks.current.onError(e);
  };
  useEffect(() => {
    const ticket = ++generation.current;
    setBusy(true);
    setSaved(null);
    setItems([]);
    setAdding("");
    setError("");
    read()
      .then((value) => {
        if (ticket === generation.current) {
          setSaved(value);
          setItems(value.items);
        }
      })
      .catch((e) => {
        if (ticket === generation.current) showError(e);
      })
      .finally(() => {
        if (ticket === generation.current) setBusy(false);
      });
    return () => {
      generation.current++;
      callbacks.current.onDirty(false);
    };
  }, [read]);
  async function refresh() {
    if (
      dirty &&
      !window.confirm(
        "Загрузить сохранённый список? Несохранённые изменения будут потеряны.",
      )
    )
      return;
    const ticket = generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const value = await read();
      if (ticket === generation.current) {
        setSaved(value);
        setItems(value.items);
        setAdding("");
      }
    } catch (e) {
      if (ticket === generation.current) showError(e);
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  async function save() {
    if (!saved || busy || adding) return;
    const ticket = generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const value = await write({ items, revision: saved.revision });
      if (ticket === generation.current) {
        setSaved(value);
        setItems(value.items);
        setNotice(
          demo
            ? "Сохранено до перезагрузки учебного примера."
            : "Список сохранён на сервере.",
        );
      }
    } catch (e) {
      if (ticket === generation.current) showError(e);
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  const completed = items.filter((item) => item.done).length;
  return (
    <section className="ry-list" aria-label={title}>
      <span className="ry-list-kicker">{eyebrow}</span>
      <div className="ry-list-heading">
        <h2>{title}</h2>
        <span
          className="ry-list-counter"
          aria-label={`${completed} из ${items.length} отмечено`}
        >
          {String(completed).padStart(2, "0")}
          <small>/{String(items.length).padStart(2, "0")}</small>
        </span>
      </div>
      <p className="ry-list-description">{description}</p>
      {error && (
        <p role="alert" className="ry-list-error">
          {error}
        </p>
      )}
      {!saved ? (
        <p role="status">
          {busy ? "Открываем лист…" : "Список пока не загружен."}
        </p>
      ) : (
        <>
          <ol className="ry-list-rows">
            {items.map((item, index) => (
              <li key={item.id} data-done={item.done}>
                <span className="ry-list-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <input
                  type="checkbox"
                  aria-label={`Отметить: ${item.text}`}
                  checked={item.done}
                  disabled={busy}
                  onChange={(e) => {
                    setNotice("");
                    setItems(
                      items.map((value) =>
                        value.id === item.id
                          ? { ...value, done: e.target.checked }
                          : value,
                      ),
                    );
                  }}
                />
                <input
                  aria-label={`Пункт ${index + 1}`}
                  value={item.text}
                  maxLength={200}
                  disabled={busy}
                  onChange={(e) => {
                    setNotice("");
                    setItems(
                      items.map((value) =>
                        value.id === item.id
                          ? { ...value, text: e.target.value }
                          : value,
                      ),
                    );
                  }}
                />
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Удалить пункт ${index + 1}`}
                  onClick={() => {
                    setNotice("");
                    setItems(items.filter((value) => value.id !== item.id));
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
          {!items.length && (
            <p className="ry-list-empty">
              Чистый лист. Добавьте то, что хотите удержать в фокусе.
            </p>
          )}
          <form
            className="ry-list-add"
            onSubmit={(e) => {
              e.preventDefault();
              if (busy || !adding.trim() || items.length >= 12) return;
              setItems([
                ...items,
                { id: crypto.randomUUID(), text: adding.trim(), done: false },
              ]);
              setAdding("");
              setNotice("");
            }}
          >
            <label>
              Новый пункт
              <input
                value={adding}
                maxLength={200}
                disabled={busy || items.length >= 12}
                placeholder="Своими словами…"
                onChange={(e) => setAdding(e.target.value)}
              />
            </label>
            <button disabled={busy || !adding.trim() || items.length >= 12}>
              Добавить ↗
            </button>
          </form>
          <p className="ry-list-meta">
            {items.length}/12 пунктов ·{" "}
            {adding
              ? "Добавьте новый пункт или очистите поле перед сохранением."
              : changed
                ? "Изменения ещё не сохранены"
                : saved.revision
                  ? "Сохранённая версия"
                  : "Пока без сохранения"}
          </p>
        </>
      )}
      <div className="ry-list-actions">
        <button
          type="button"
          className="ry-list-save"
          disabled={
            busy ||
            !changed ||
            !!adding ||
            items.some((item) => !item.text.trim())
          }
          onClick={() => void save()}
        >
          Сохранить список ↗
        </button>
        <button type="button" disabled={busy} onClick={() => void refresh()}>
          Загрузить сохранённый ↺
        </button>
      </div>
      {notice && (
        <p role="status" className="ry-list-notice">
          {notice}
        </p>
      )}
    </section>
  );
}
