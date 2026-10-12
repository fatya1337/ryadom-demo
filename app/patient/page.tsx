"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  createRyadomClient,
  RyadomError,
  ClientTransportError,
  type Profile,
  type DiaryEntry,
  type EntryInput,
} from "./client";
import "./patient-live.css";
import PeriodPicker from "./period-picker";
import { calendarDay, periodDays, periodError, recentPeriod, type Period } from "./period";
import DayPlan from "./day-plan";
import Sessions from "./sessions";
import AccessActivityJournal from "./access-activity";
import { invitationLink } from "./invitation-link";
import { createPatientDemoClient } from "./demo-client";
const base = "demonstration";
const client = createPatientDemoClient();
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const format = (date: string) =>
  new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
const blank = (date: string): EntryInput => ({
  date,
  text: "",
  mood: 5,
  energy: 5,
  sleepHours: 7.5,
  revision: 0,
});
type Sharing = Awaited<ReturnType<typeof client.sharing>>;
const emptySharing: Sharing = { grants: [], invitations: [] };
const errors: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Проверьте почту и пароль.",
  UNAUTHENTICATED: "Войдите снова — сессия закончилась.",
  REVISION_CONFLICT:
    "Запись изменилась в другом окне. Ваш текст оставлен в форме. Скопируйте его, затем загрузите сохранённую версию.",
  TRY_LATER: "Приглашение уже создавалось недавно. Повторите через минуту.",
  CONSENT_REQUIRED: "Сначала нужно принять актуальное согласие.",
  PATIENT_REQUIRED: "Для дневника нужна пациентская учётная запись.",
  EMAIL_NOT_VERIFIED: "Адрес почты ещё не подтверждён.",
  SESSION_NOT_FRESH: "Для проверки входов войдите в аккаунт заново.",
  SESSIONS_UNAVAILABLE: "Не удалось проверить входы. Обновите список.",
  SERVICE_UNAVAILABLE: "Сервер временно недоступен. Попробуйте позже.",
  TOO_MANY_REQUESTS: "Слишком много попыток. Подождите минуту.",
  FORBIDDEN: "Сервер не разрешил запрос. Войдите снова или обратитесь к команде.",
};
export default function PatientLive() {
  const [profile, setProfile] = useState<Profile | null>(null),
    [ready, setReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [entries, setEntries] = useState<DiaryEntry[]>([]),
    [sharing, setSharing] = useState<Sharing>(emptySharing);
  const [historyPeriod, setHistoryPeriod] = useState<Period>(() => recentPeriod(30));
  const [pendingDate, setPendingDate] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [planDirty, setPlanDirty] = useState(false);
  const [section, setSection] = useState<
    "day" | "history" | "sharing" | "plan"
  >("day");
  const [draft, setDraft] = useState<EntryInput>(blank("")),
    [saved, setSaved] = useState<EntryInput>(blank(""));
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("specialist@example.test"),
    [invitation, setInvitation] = useState<Awaited<
      ReturnType<typeof client.invite>
    > | null>(null);
  const [adult, setAdult] = useState(false),
    [consent, setConsent] = useState(false);
  const shareLink = invitation
    ? invitationLink(process.env.NEXT_PUBLIC_DOCTOR_URL || "", invitation.code)
    : null;
  async function copyInvitation(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Учебный код скопирован. Он не выдаёт настоящий доступ.");
      setError("");
    } catch {
      setError("Не удалось скопировать автоматически. Выделите ссылку или код ниже и скопируйте вручную.");
    }
  }
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [deleteText, setDeleteText] = useState(""),
    [deleteOpen, setDeleteOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const generation = useRef(0);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const hasConsent =
    !!profile?.consent?.adult &&
    profile.consent.version === profile.requiredConsentVersion;
  function fill(entry: EntryInput) {
    const value = {
      date: entry.date,
      text: entry.text,
      mood: entry.mood,
      energy: entry.energy,
      sleepHours: entry.sleepHours,
      revision: entry.revision,
    };
    setDateInput(value.date);
    setPendingDate("");
    setDraft(value);
    setSaved(value);
  }
  function clear() {
    generation.current++;
    setProfile(null);
    setDataReady(false);
    setDataLoading(false);
    setLoadFailed(false);
    setHistoryPeriod(recentPeriod(30));
    setPendingDate("");
    setPlanDirty(false);
    setEntries([]);
    setSharing(emptySharing);
    setInvitation(null);
    setRevokeId(null);
    setDoctorEmail("");
    fill(blank(today()));
    setDeleteOpen(false);
    setDeleteText("");
    setAdult(false);
    setConsent(false);
  }
  function fail(e: unknown) {
    if (
      e instanceof RyadomError &&
      (e.status === 401 ||
        ["PATIENT_REQUIRED", "EMAIL_NOT_VERIFIED", "FORBIDDEN"].includes(e.code))
    )
      clear();
    if (e instanceof RyadomError && e.code === "CONSENT_REQUIRED") {
      setProfile((current) => (current ? { ...current, consent: null } : null));
      setEntries([]);
      setSharing(emptySharing);
      setInvitation(null);
      setAdult(false);
      setConsent(false);
    }
    setError(
      e instanceof RyadomError
        ? errors[e.code] ||
            "Не удалось выполнить действие. Обновите страницу и попробуйте снова."
        : e instanceof ClientTransportError
          ? e.message
          : "Не удалось выполнить действие. Попробуйте ещё раз.",
    );
  }
  async function load() {
    const ticket = ++generation.current;
    setDataReady(false);
    setDataLoading(true);
    setLoadFailed(false);
    try {
      const me = await client.me();
      if (ticket !== generation.current) return;
      setProfile(me);
      if (
        me.role !== "patient" ||
        me.consent?.version !== me.requiredConsentVersion
      )
        return;
      const period = recentPeriod(30);
      setHistoryPeriod(period);
      const [history, access] = await Promise.all([
        client.entries(period.from, period.to),
        client.sharing(),
      ]);
      if (ticket !== generation.current) return;
      setEntries(
        [...history.entries].sort((a, b) => b.date.localeCompare(a.date)),
      );
      setSharing(access);
      fill(history.entries.find((e) => e.date === today()) || blank(today()));
      setDataReady(true);
    } catch (e) {
      if (ticket === generation.current && !(e instanceof RyadomError && [401, 403].includes(e.status))) setLoadFailed(true);
      throw e;
    } finally {
      if (ticket === generation.current) setDataLoading(false);
    }
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    fill(blank(today()));
    if (!base) {
      setReady(true);
      return;
    }
    let active = true;
    void load()
      .catch((e) => {
        if (active && !(e instanceof RyadomError && e.status === 401)) fail(e);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function openDate(date: string) {
    const ticket = generation.current;
    const result = await client.entries(date, date);
    if (ticket !== generation.current) return;
    fill(result.entries[0] || blank(date));
    setSection("day");
    setNotice(result.entries.length ? "Открыта сохранённая запись." : "За этот день пока нет записи. Можно начать новый лист.");
  }
  function selectDate(date: string) {
    if (!calendarDay(date) || date > today()) {
      setError("Выберите существующую дату не позже сегодняшнего дня.");
      return;
    }
    if (dirty) {
      setPendingDate(date);
      return;
    }
    void run(() => openDate(date));
  }
  async function changePeriod(period: Period) {
    const invalid = periodError(period);
    if (invalid) { setError(invalid); return; }
    const ticket = generation.current;
    try {
      const result = await client.entries(period.from, period.to);
      if (ticket !== generation.current) return;
      setEntries([...result.entries].sort((a, b) => b.date.localeCompare(a.date)));
      setHistoryPeriod(period);
    } catch (e) {
      if (ticket === generation.current && !(e instanceof RyadomError && [401, 403].includes(e.status))) setNotice("Период не изменён. Ниже остаётся ранее загруженная история.");
      throw e;
    }
  }
  function mergeEntry(entry: DiaryEntry) {
    setEntries((prev) => [
      ...prev.filter((e) => e.date !== entry.date),
      ...(entry.date >= historyPeriod.from && entry.date <= historyPeriod.to ? [entry] : []),
    ].sort((a, b) => b.date.localeCompare(a.date)));
  }
  async function refreshSharing() {
    const access = await client.sharing();
    setSharing(access);
    setInvitation((current) =>
      current && access.invitations.some((item) => item.id === current.id)
        ? current
        : null,
    );
  }
  return (
    <main className="p-live">
      <header className="p-masthead">
        <Link href="/" className="p-brand">
          рядом<span>↗</span>
        </Link>
        <span>
          ЛИЧНОЕ ПРОСТРАНСТВО
          <br />
          ДНЕВНИК НАБЛЮДЕНИЙ
        </span>
        <Link href="/">К показу проекта ↗</Link>
      </header>
      <div className="p-environment">
        ИНТЕРАКТИВНЫЙ ПОКАЗ · ВЫМЫШЛЕННЫЕ ДАННЫЕ · БЕЗ СЕРВЕРА
      </div>
      <section className="p-demo-guide" aria-label="Как проверить дневник">
        <p><strong>Попробуйте:</strong> измените текст → сохраните день → откройте «Историю».
        Затем добавьте дело в «План дня» и проверьте отзыв в «Мой специалист».</p>
        <p>Данные живут только в памяти этой вкладки до перезагрузки. Этот пример не связан
        с демонстрацией специалиста и не отправляет записи на сервер. Вводите только вымышленные примеры.</p>
        <button onClick={() => window.location.reload()}>Начать показ заново ↺</button>
      </section>
      {error && (
        <p role="alert" className="p-alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="p-notice">
          {notice}
        </p>
      )}
      {!ready ? (
        <p className="p-empty">Открываем дневник…</p>
      ) : !base ? (
        <section className="p-hero">
          <h1>
            Место для
            <br />
            <em>ваших мыслей.</em>
          </h1>
          <p>Серверный дневник ещё не подключён на этом адресе.</p>
          <Link href="/">Открыть учебный пример ↗</Link>
        </section>
      ) : loadFailed ? (
        <section className="p-load-state" aria-labelledby="diary-load-title">
          <span className="p-kicker">СВЯЗЬ С ДНЕВНИКОМ</span>
          <h1 id="diary-load-title">Не удалось<br /><em>открыть дневник.</em></h1>
          <p>Это не означает, что дневник пуст. Проверьте подключение и повторите загрузку.</p>
          <button className="p-primary" disabled={busy || dataLoading} onClick={() => void run(load)}>Повторить загрузку ↺</button>
        </section>
      ) : !profile ? (
        <div className="p-login">
          <section className="p-hero">
            <span className="p-kicker">НЕБОЛЬШАЯ ПАУЗА / ДЛЯ СЕБЯ</span>
            <h1>
              Как прошёл
              <br />
              <em>ваш день?</em>
            </h1>
            <p>
              Здесь можно заметить небольшие изменения,
              <br />
              сохранить мысли и вернуться к ним позже.
            </p>
            <span className="p-seal">
              В своём
              <br />
              темпе ↗
            </span>
          </section>
          <form
            className="p-login-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await client.signIn(email, password);
                setPassword("");
                await load();
              });
            }}
          >
            <span className="p-kicker">01 / ВОЙТИ В ДНЕВНИК</span>
            <label>
              Электронная почта
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Пароль
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="p-primary" disabled={busy}>
              Продолжить <span>↗</span>
            </button>
            <p>
              Для командного показа используются учебные аккаунты. Вашими
              записями распоряжаетесь вы.
            </p>
          </form>
        </div>
      ) : profile.role !== "patient" ? (
        <section className="p-hero">
          <h1>
            Это личный
            <br />
            <em>дневник.</em>
          </h1>
          <p>
            Вы вошли аккаунтом специалиста. Выйдите и используйте пациентский
            учебный аккаунт.
          </p>
        </section>
      ) : !hasConsent ? (
        <section className="p-consent">
          <span className="p-kicker">ПЕРЕД ПЕРВОЙ ЗАПИСЬЮ</span>
          <h1>
            Ваши мысли.
            <br />
            <em>Ваше решение.</em>
          </h1>
          <p>
            Это тестовый стенд: используйте только вымышленные записи. Текст,
            настроение, сон и энергия сохраняются на общем сервере. Специалист
            увидит дневник только после вашего приглашения; разрешение можно
            отозвать. Приложение не ставит диагноз и не заменяет помощь
            специалиста.
          </p>
          <p>
            Удаление очищает записи, заметки специалистов и разрешения в
            активной базе. Аккаунт и событие удаления остаются; ранее скачанные
            файлы и резервные копии автоматически не удаляются.
          </p>
          <label className="p-check">
            <input
              type="checkbox"
              checked={adult}
              onChange={(e) => setAdult(e.target.checked)}
            />
            Мне исполнилось 18 лет
          </label>
          <label className="p-check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Я понимаю условия учебного стенда и согласен на сохранение
            вымышленных записей
          </label>
          <p className="p-muted">
            Тестовая версия: {profile.requiredConsentVersion}
          </p>
          <button
            className="p-primary"
            disabled={busy || !adult || !consent}
            onClick={() =>
              void run(async () => {
                await client.consent(profile.requiredConsentVersion, true);
                await load();
              })
            }
          >
            Открыть дневник ↗
          </button>
        </section>
      ) : !dataReady ? (
        <section className="p-load-state" aria-live="polite">
          <span className="p-kicker">ВАШ ДНЕВНИК</span>
          <h1>Возвращаемся<br /><em>к вашим записям.</em></h1>
          <p role="status">{dataLoading ? "Загружаем сохранённые дни…" : "Записи ещё не загружены."}</p>
          <button className="p-primary" disabled={busy || dataLoading} onClick={() => void run(load)}>Загрузить дневник ↺</button>
        </section>
      ) : (
        <>
          <nav className="p-nav" aria-label="Разделы дневника">
            {(
              [
                ["day", "Мой день"],
                ["history", "История"],
                ["plan", "План дня"],
                ["sharing", "Мой специалист"],
              ] as const
            ).map(([key, label], i) => (
              <button
                key={key}
                disabled={busy}
                aria-current={section === key ? "page" : undefined}
                onClick={() => {
                  setSection(key);
                  setError("");
                  setNotice("");
                }}
              >
                <small>0{i + 1}</small>
                {label}
              </button>
            ))}
          </nav>
          {pendingDate && <section className="p-date-confirm" role="group" aria-label="Переход к другой записи">
            <strong>Открыть {format(pendingDate)}?</strong>
            <p>У текущего дня есть несохранённый текст. Скопируйте его перед переходом. Черновик заменится только после успешной загрузки выбранного дня.</p>
            <button className="p-primary" disabled={busy} onClick={() => void run(() => openDate(pendingDate))}>Загрузить другой день ↗</button>
            <button className="p-text-button" disabled={busy} onClick={() => { setPendingDate(""); setDateInput(draft.date); }}>Остаться здесь</button>
          </section>}
          <div hidden={section !== "plan"}>
            <DayPlan
              client={client}
              demo
              initialDate={today()}
              onDirty={setPlanDirty}
              onError={fail}
            />
          </div>
          {section === "day" && (
            <section className="p-journal" key="day">
              <aside className="p-date">
                <span className="p-kicker">ОДИН ДЕНЬ / ОДНА ЗАПИСЬ</span>
                <strong>{draft.date.slice(-2)}</strong>
                <em>
                  {draft.date
                    ? new Intl.DateTimeFormat("ru", {
                        month: "long",
                        timeZone: "UTC",
                      }).format(new Date(draft.date))
                    : ""}
                </em>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (busy) return;
                  selectDate(String(new FormData(e.currentTarget).get("day") || ""));
                }}>
                <label>
                  Дата
                  <input
                    name="day"
                    required
                    type="date"
                    value={dateInput}
                    min="0001-01-01"
                    max={today()}
                    disabled={busy}
                    onChange={(e) => {
                      setDateInput(e.target.value);
                    }}
                  />
                </label>
                <button className="p-text-button" disabled={busy}>Открыть день ↗</button>
                </form>
                <span className="p-open-date">В форме: {format(draft.date)}</span>
                <p>
                  Не обязательно находить
                  <br />
                  идеальные слова.
                </p>
              </aside>
              <form
                className="p-sheet"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const entry = await client.saveEntry(draft);
                    mergeEntry(entry);
                    fill(entry);
                    setNotice(
                      "Учебная запись сохранена в памяти вкладки. Откройте «Историю», чтобы увидеть результат.",
                    );
                  });
                }}
              >
                <div className="p-sheet-heading">
                  <span className="p-kicker">НАЧНЁМ С ОЩУЩЕНИЯ</span>
                  <span>
                    {draft.revision ? "Запись за этот день" : "Новый лист"}
                  </span>
                </div>
                <h1>
                  {draft.date === today() ? "Сегодня я" : "Этот день."}<br />
                  <em>{draft.date === today() ? "чувствую…" : "Мои ощущения."}</em>
                </h1>
                <fieldset disabled={busy}>
                  <legend>Настроение · {draft.mood} из 10</legend>
                  <div className="p-mood-scale">
                    {Array.from({ length: 10 }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Настроение ${i + 1} из 10`}
                        aria-pressed={draft.mood === i + 1}
                        onClick={() => setDraft({ ...draft, mood: i + 1 })}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <div className="p-scale-label">
                    <span>Очень низкое</span>
                    <span>Очень высокое</span>
                  </div>
                  <div className="p-ranges">
                    <label>
                      Сон <output>{draft.sleepHours} ч</output>
                      <input
                        type="range"
                        aria-label="Сон в часах"
                        min="0"
                        max="24"
                        step="0.5"
                        value={draft.sleepHours}
                        onChange={(e) =>
                          setDraft({ ...draft, sleepHours: +e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Энергия <output>{draft.energy}/10</output>
                      <input
                        type="range"
                        aria-label="Энергия от 1 до 10"
                        min="1"
                        max="10"
                        value={draft.energy}
                        onChange={(e) =>
                          setDraft({ ...draft, energy: +e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label className="p-text-label" htmlFor="diary-text">
                    Что хочется оставить в этом дне?
                  </label>
                  <textarea
                    id="diary-text"
                    rows={7}
                    value={draft.text}
                    maxLength={5000}
                    placeholder="Можно начать с одной мысли…"
                    onChange={(e) =>
                      setDraft({ ...draft, text: e.target.value })
                    }
                  />
                </fieldset>
                <div className="p-save-row">
                  <span>
                    {draft.text.length}/5000
                    <br />
                    {dirty
                      ? "Есть несохранённые изменения"
                      : draft.revision
                        ? "Сохранено в учебном примере"
                        : "Ещё не сохранено"}
                  </span>
                  <button
                    className="p-primary"
                    disabled={busy || (!dirty && draft.revision > 0)}
                  >
                    Сохранить день <span>↗</span>
                  </button>
                </div>
                {dirty && error && <p className="p-draft-hint">Черновик остаётся в этой вкладке. Если ответ при сохранении потерялся, запись могла сохраниться. Скопируйте текст перед загрузкой сохранённой версии. Перезагрузка страницы или завершение сессии очищает черновик.</p>}
                <button
                  className="p-text-button"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      dirty &&
                      !window.confirm(
                        "Загрузить сохранённую версию? Сначала скопируйте нужный черновик.",
                      )
                    )
                      return;
                    void run(async () => {
                      const result = await client.entries(
                        draft.date,
                        draft.date,
                      );
                      fill(result.entries[0] || blank(draft.date));
                      if (result.entries[0]) mergeEntry(result.entries[0]);
                      else setEntries((prev) => prev.filter((e) => e.date !== draft.date));
                    });
                  }}
                >
                  Загрузить сохранённую версию ↺
                </button>
              </form>
            </section>
          )}
          {section === "history" && (
            <section className="p-history" key="history">
              <div className="p-history-intro">
              <div className="p-hero">
                <span className="p-kicker">ВАША ИСТОРИЯ / {format(historyPeriod.from)} — {format(historyPeriod.to)}</span>
                <h1>
                  Дни складываются
                  <br />
                  <em>в историю.</em>
                </h1>
                <p>
                  Дней с записями: {entries.length}. Пропуски не означают ноль.
                </p>
              </div>
              <PeriodPicker value={historyPeriod} disabled={busy} onApply={(period) => void run(() => changePeriod(period))} />
              </div>
              <div className="p-history-scroll" role="region" aria-label="График выбранного периода, прокрутка по горизонтали" tabIndex={0}>
              <div
                style={{ gridTemplateColumns: `repeat(${periodDays(historyPeriod)}, minmax(18px, 1fr))`, minWidth: `${periodDays(historyPeriod) * 21 - 3}px` }}
                className="p-history-ribbon"
                aria-label="Настроение по сохранённым записям"
              >
                {[...entries].reverse().map((e) => (
                  <button
                    style={{
                      gridColumn:
                        Math.round(
                          (Date.parse(e.date) - Date.parse(historyPeriod.from)) /
                            86400000,
                        ) + 1,
                    }}
                    title={`${format(e.date)}: ${e.mood}/10`}
                    aria-label={`Открыть запись ${format(e.date)}`}
                    key={e.id}
                    disabled={busy}
                    onClick={() => selectDate(e.date)}
                  >
                    <span style={{ height: `${e.mood * 9}px` }} />
                    <small>{e.date.slice(-2)}</small>
                  </button>
                ))}
              </div>
              </div>
              {periodDays(historyPeriod) > 14 && <p className="p-period-caption">Если вся лента не помещается, прокрутите её в сторону. Каждый столбик — отдельный день.</p>}
              <div className="p-history-bounds"><span>{format(historyPeriod.from)}</span><span>{format(historyPeriod.to)}</span></div>
              <div className="p-history-heading">
                <span>САМООЦЕНКА НАСТРОЕНИЯ / 1–10</span>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const r = historyPeriod,
                        data = await client.exportEntries(r.from, r.to);
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(data, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `ryadom-diary-${r.from}-${r.to}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    })
                  }
                >
                  Скачать мои записи ↗
                </button>
              </div>
              {entries.length ? (
                entries.map((entry) => (
                  <article key={entry.id}>
                    <button
                      disabled={busy}
                      onClick={() => selectDate(entry.date)}
                    >
                      {format(entry.date)} <span>Редактировать ↗</span>
                    </button>
                    <p>{entry.text || "Запись без текста"}</p>
                    <small>
                      Настроение {entry.mood}/10 · сон {entry.sleepHours} ч ·
                      энергия {entry.energy}/10
                    </small>
                  </article>
                ))
              ) : (
                <p className="p-empty">За выбранный период записей нет.</p>
              )}
            </section>
          )}
          {section === "sharing" && (
            <section className="p-sharing" key="sharing">
              <div className="p-hero">
                <span className="p-kicker">ДОСТУП ПОД ВАШИМ КОНТРОЛЕМ</span>
                <h1>
                  Разделить мысли.
                  <br />
                  <em>Сохранить границы.</em>
                </h1>
                <p>
                  Специалист видит дневник, пока вы разрешаете.
                  <br />
                  Отзыв закрывает доступ к истории и новым выгрузкам.
                </p>
              </div>
              <div className="p-sharing-grid">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      const value = await client.invite(doctorEmail);
                      setInvitation(value);
                      await refreshSharing();
                    });
                  }}
                >
                  <h2>Пригласить специалиста</h2>
                  <label>
                    Его электронная почта
                    <input
                      type="email"
                      required
                      value={doctorEmail}
                      onChange={(e) => setDoctorEmail(e.target.value)}
                    />
                  </label>
                  <button className="p-primary" disabled={busy}>
                    Создать приглашение ↗
                  </button>
                  <p className="p-muted">
                    Одно применение, 24 часа. Новое приглашение отменяет прежние
                    неиспользованные коды.
                  </p>
                  {invitation && (
                    <div className="p-code" role="status">
                      <span className="p-eyebrow">С РАЗРЕШЕНИЯ ПАЦИЕНТА</span>
                      <h3>Ваша история —<br />по приглашению.</h3>
                      <p>
                        Для {invitation.doctorEmail}
                        <br />
                        До {new Date(invitation.expiresAt).toLocaleString("ru")}
                      </p>
                      {shareLink && <>
                        <button type="button" className="p-primary" onClick={() => void copyInvitation(shareLink, "Ссылка")}>
                          Скопировать ссылку ↗
                        </button>
                        <label className="p-share-label">Ссылка для специалиста
                          <textarea readOnly value={shareLink} rows={3} onFocus={(e) => e.target.select()} />
                        </label>
                      </>}
                      <details open={!shareLink}>
                        <summary>Передать код вручную</summary>
                        <code>{invitation.code}</code>
                        <button type="button" onClick={() => void copyInvitation(invitation.code, "Строка кода")}>
                          Скопировать код ↗
                        </button>
                      </details>
                      <p>Это образец приглашения. Учебный код не подключает другой кабинет и не отправляется по почте.</p>
                    </div>
                  )}
                </form>
                <div>
                  <h2>Кому открыт дневник</h2>
                  <button
                    disabled={busy}
                    onClick={() => void run(refreshSharing)}
                  >
                    Обновить разрешения ↺
                  </button>
                  {sharing.grants.filter((g) => !g.revokedAt).length === 0 && (
                    <p className="p-empty">Пока только вам.</p>
                  )}
                  {sharing.grants
                    .filter((g) => !g.revokedAt)
                    .map((grant) => (
                      <article className="p-grant" key={grant.id}>
                        <strong>{grant.doctor.name}</strong>
                        <p>{grant.doctor.email}</p>
                        <button
                          disabled={busy}
                          aria-expanded={revokeId === grant.id}
                          aria-controls={`revoke-${grant.id}`}
                          onClick={() => setRevokeId(revokeId === grant.id ? null : grant.id)}
                        >
                          Отозвать доступ ↗
                        </button>
                        {revokeId === grant.id && <div className="p-revoke-confirm" id={`revoke-${grant.id}`}>
                          <p>Закрыть доступ для {grant.doctor.email}? Неиспользованные приглашения тоже будут отменены. Уже скачанные файлы останутся у специалиста.</p>
                          <button className="p-primary" disabled={busy} onClick={() => void run(async () => {
                            await client.revoke(grant.id);
                            setInvitation(null);
                            setRevokeId(null);
                            await refreshSharing();
                            setNotice("Доступ отозван. Новые чтения и выгрузки специалиста заблокированы.");
                          })}>Да, закрыть доступ</button>
                          <button disabled={busy} onClick={() => setRevokeId(null)}>Оставить доступ</button>
                        </div>}
                      </article>
                    ))}
                  {sharing.invitations.map((invite) => (
                    <article className="p-grant" key={invite.id}>
                      <strong>Ожидает принятия</strong>
                      <p>{invite.doctorEmail}</p>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await client.cancelInvitation(invite.id);
                            if (invitation?.id === invite.id)
                              setInvitation(null);
                            await refreshSharing();
                          })
                        }
                      >
                        Отменить приглашение
                      </button>
                    </article>
                  ))}
                </div>
              </div>
              <AccessActivityJournal key={profile.id} load={client.accessActivity} onSessionError={fail} />
              {false && <section className="p-delete">
                <h2>Удалить данные дневника</h2>
                <p>
                  Будут удалены записи, планы дня, заметки и листы подготовки
                  специалистов, согласия и разрешения в активной базе. Аккаунт и
                  событие удаления останутся. Уже скачанные файлы и резервные
                  копии не очищаются этой кнопкой.
                </p>
                {!deleteOpen ? (
                  <button onClick={() => setDeleteOpen(true)}>
                    Открыть удаление данных
                  </button>
                ) : (
                  <>
                    <label>
                      Введите УДАЛИТЬ для подтверждения
                      <input
                        value={deleteText}
                        onChange={(e) => setDeleteText(e.target.value)}
                      />
                    </label>
                    <button
                      className="p-primary"
                      disabled={busy || deleteText !== "УДАЛИТЬ"}
                      onClick={() =>
                        void run(async () => {
                          await client.deleteData("DELETE_MY_DATA");
                          setEntries([]);
                          setSharing(emptySharing);
                          setInvitation(null);
                          fill(blank(today()));
                          setDeleteOpen(false);
                          setDeleteText("");
                          setAdult(false);
                          setConsent(false);
                          setProfile({ ...profile, consent: null });
                          setNotice(
                            "Данные удалены из активной базы. Аккаунт сохранён.",
                          );
                        })
                      }
                    >
                      Удалить данные
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setDeleteOpen(false);
                        setDeleteText("");
                      }}
                    >
                      Отмена
                    </button>
                  </>
                )}
              </section>}
            </section>
          )}
        </>
      )}
      <footer className="p-footer">
        <span>рядом / немного внимания к себе</span>
        <span>Самооценки — наблюдения, а не диагноз.</span>
      </footer>
    </main>
  );
}
