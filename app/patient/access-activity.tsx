"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RyadomError, type AccessActivity } from "./client";

export default function AccessActivityJournal({ load, onSessionError }: {
  load: () => Promise<AccessActivity>;
  onSessionError: (error: unknown) => void;
}) {
  const [result, setResult] = useState<AccessActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(5);
  const generation = useRef(0);
  const sessionError = useRef(onSessionError);
  useEffect(() => { sessionError.current = onSessionError; }, [onSessionError]);
  const refresh = useCallback(async () => {
    const ticket = ++generation.current;
    setLoading(true);
    setError("");
    setResult(null);
    setVisibleCount(5);
    try {
      const value = await load();
      if (generation.current === ticket) setResult(value);
    } catch (e) {
      if (generation.current !== ticket) return;
      if (e instanceof RyadomError && [401, 403].includes(e.status)) {
        sessionError.current(e);
      } else {
        setError("Не удалось загрузить обращения. Попробуйте обновить журнал.");
      }
    } finally {
      if (generation.current === ticket) setLoading(false);
    }
  }, [load]);
  useEffect(() => {
    void refresh();
    return () => { generation.current++; };
  }, [refresh]);
  return <section className="p-activity" aria-labelledby="access-activity-title">
    <header>
      <div>
        <span className="p-eyebrow">ПРОЗРАЧНОСТЬ ДОСТУПА</span>
        <h2 id="access-activity-title">Когда к истории обращались.</h2>
      </div>
      <button disabled={loading} onClick={() => void refresh()}>Обновить журнал ↺</button>
    </header>
    <p className="p-activity-caption">Учебные примеры обращений специалиста. В рабочей версии здесь показаны успешные запросы к вашим записям.
      Автоматическое обновление тоже может оставить событие. Это не подтверждение
      прочтения человеком или скачивания файла.</p>
    {loading && <p className="p-empty" role="status">Загружаем обращения…</p>}
    {error && <p className="p-alert" role="alert">{error}</p>}
    {result?.events.length === 0 && <div className="p-activity-empty">
      <span aria-hidden="true">—</span>
      <p>Обращений пока нет.<br /><small>Когда специалист запросит записи или выгрузку, событие появится здесь.</small></p>
    </div>}
    {!!result?.events.length && <>
      <ol className="p-activity-list">
        {result.events.slice(0, visibleCount).map((event) => <li key={event.id}>
          <time dateTime={event.occurredAt}>
            <strong>{new Date(event.occurredAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}</strong>
            <span>{new Date(event.occurredAt).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" })}</span>
          </time>
          <div>
            <span className="p-activity-action">{event.action === "entries.exported" ? "Запросил выгрузку" : "Запросил записи"}</span>
            <strong>{event.specialist?.name || "Специалист"}</strong>
            <span className="p-activity-person">{event.specialist?.email || "Учётная запись больше недоступна"}</span>
          </div>
          <span className="p-activity-symbol" aria-hidden="true">{event.action === "entries.exported" ? "↗" : "↳"}</span>
        </li>)}
      </ol>
      <p className="p-activity-caption" role="status">Показано {Math.min(visibleCount, result.events.length)} из {result.events.length} загруженных обращений.</p>
      {visibleCount < result.events.length && <button onClick={() => setVisibleCount((count) => count + 5)}>Показать ещё обращения ↓</button>}
      <p className="p-activity-caption">{result.hasMore
        ? "Загружены последние 50 обращений. Более ранние события здесь не отображаются."
        : `Обращений в журнале: ${result.events.length}.`}
        {" "}Время — в часовом поясе вашего устройства. Имя и почта — текущие данные аккаунта специалиста.</p>
    </>}
    <p className="p-activity-caption">После отзыва прежние обращения остаются в журнале.
      Удаление данных дневника очищает его в активной базе.</p>
  </section>;
}
