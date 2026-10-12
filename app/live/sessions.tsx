"use client";
import { useEffect, useRef, useState } from "react";
import type { SessionOverview } from "../../lib/client";
import "./sessions.css";

const date = (value: string) => new Intl.DateTimeFormat("ru", {
  day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
}).format(new Date(value));
export default function Sessions({ read, revoke, onError, disabled = false }: {
  read: () => Promise<SessionOverview>;
  revoke: () => Promise<unknown>;
  onError: (error: unknown) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SessionOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  async function refresh(endOthers = false) {
    const ticket = ++generation.current;
    setBusy(true); setError(""); setNotice(""); setConfirm(false);
    try {
      if (endOthers) {
        await revoke();
        if (ticket !== generation.current) return;
        setData(null);
        setNotice("Остальные входы завершены. Текущий вход сохранён.");
      }
      const result = await read();
      if (ticket === generation.current) setData(result);
    } catch (e) {
      if (ticket !== generation.current) return;
      setData(null);
      const code = e && typeof e === "object" && "code" in e ? e.code : null;
      setError(code === "SESSION_NOT_FRESH"
        ? "Для просмотра входов войдите в аккаунт заново. Сначала сохраните изменения в дневнике или заметке."
        : "Не удалось проверить входы. Обновите список. Если ответ при завершении потерялся, действие уже могло выполниться.");
      // Panel errors stay local; only loss of account access clears the cabinet.
      const status = e && typeof e === "object" && "status" in e ? e.status : null;
      if (status === 401 || code === "EMAIL_NOT_VERIFIED") onError(e);
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  return <div className="account-sessions">
    <button className="account-sessions-toggle" disabled={disabled || busy} aria-expanded={open}
      aria-controls="account-sessions-panel" onClick={() => {
        setOpen(!open);
        if (!open) void refresh();
      }}>{open ? "Закрыть список входов ↑" : "Мои входы ↗"}</button>
    {open && <section id="account-sessions-panel" aria-labelledby="account-sessions-title">
      <div className="account-sessions-heading">
        <div><span>ВАШ АККАУНТ / ДОСТУП</span><h2 id="account-sessions-title">Где вы вошли.</h2></div>
        <button disabled={disabled || busy} onClick={() => void refresh()}>Обновить список ↺</button>
      </div>
      <p>Здесь видны активные входы в ваш аккаунт. Несколько вкладок одного браузера обычно используют один вход. Время — по часовому поясу устройства.</p>
      {busy && <p role="status">Проверяем входы…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {data && <>
        <ol>{data.sessions.map((s, i) => <li key={`${s.createdAt}:${i}`}>
          <span className="account-session-index">{String(i + 1).padStart(2, "0")}</span>
          <div><strong>{s.current ? "Этот вход" : "Другой вход"}</strong>
            <span>Начат {date(s.createdAt)}</span><span>Действует до {date(s.expiresAt)}</span></div>
          <span className={s.current ? "account-session-current" : "account-session-other"}>{s.current ? "ВЫ ЗДЕСЬ" : "АКТИВЕН"}</span>
        </li>)}</ol>
        {!data.total && <p>Активных входов в ответе нет. Обновите список или войдите заново.</p>}
        {data.hasMore && <p>Показаны первые 20 из {data.total}. Действие ниже завершит все остальные входы, включая не показанные здесь.</p>}
        <p className="account-sessions-footnote">После завершения другие входы перестанут проходить проверку на сервере. Уже открытая там страница очистится при следующем запросе. Текущие вкладки с этим же входом останутся открытыми.</p>
        {data.total > 1 && !confirm && <button className="account-session-action" disabled={disabled || busy} onClick={() => setConfirm(true)}>Завершить остальные входы ↗</button>}
        {confirm && <div className="account-session-confirm" role="group" aria-label="Подтверждение завершения входов">
          <strong>Оставить только этот вход?</strong>
          <p>Несохранённые изменения в других входах могут потеряться. Здесь выходить из аккаунта не потребуется.</p>
          <button className="account-session-action" disabled={disabled || busy} onClick={() => void refresh(true)}>Да, завершить остальные</button>
          <button disabled={disabled || busy} onClick={() => setConfirm(false)}>Оставить как есть</button>
        </div>}
      </>}
    </section>}
  </div>;
}
