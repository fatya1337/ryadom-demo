"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Download,
} from "lucide-react";
import {
  API_URL,
  api as serverApi,
  RequestError,
  type Me,
  type Patient,
  type Entry,
  type Note,
} from "./api";
import "./live.css";
import PeriodPicker from "./period-picker";
import { recentPeriod, periodDays, type Period } from "./period";
import Preparation from "./preparation";
import Sessions from "./sessions";
import type { SessionOverview } from "../../lib/client";
import { createDemoBackend } from "./demo";
import { invitationCode, readInvitationFragment } from "./invitation-link";

const showDate = (value: string) =>
  new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
const blankNote: Note = { text: "", revision: 0, updatedAt: null };
function Chart({
  entries,
  from,
  to,
  metric,
}: {
  entries: Entry[];
  from: string;
  to: string;
  metric: "mood" | "energy" | "sleepHours";
}) {
  const maximum = metric === "sleepHours" ? 24 : 10;
  const minimum = metric === "sleepHours" ? 0 : 1;
  const y = (value: number) =>
    195 - ((value - minimum) / (maximum - minimum)) * 160;
  const left = Date.parse(from),
    span = Math.max(Date.parse(to) - left, 86400000);
  const point = (entry: Entry) => [
    35 + ((Date.parse(entry.date) - left) / span) * 730,
    y(entry[metric]),
  ];
  return (
    <svg
      viewBox="0 0 800 235"
      className="live-chart"
      role="img"
      aria-label={`${metric === "sleepHours" ? "Длительность сна, от 0 до 24 часов" : metric === "energy" ? "Энергия, от 1 до 10" : "Настроение, от 1 до 10"}. Пропущенные дни не заполняются.`}
    >
      {[minimum, maximum / 2, maximum].map((value) => (
        <g key={value}>
          <line
            x1="35"
            x2="765"
            y1={y(value)}
            y2={y(value)}
            stroke="var(--line)"
          />
          <text x="8" y={y(value) + 5}>
            {value}
          </text>
        </g>
      ))}
      {entries.map((entry) => {
        const [x, y] = point(entry);
        return (
          <g key={entry.id} className="live-chart-point">
            <line
              x1={x}
              x2={x}
              y1="195"
              y2={y}
              stroke="var(--blue)"
              opacity=".15"
            />
            <circle cx={x} cy={y} r="5" fill="var(--blue)">
              <title>
                {showDate(entry.date)}: {entry[metric]}
                {metric === "sleepHours" ? " ч" : "/10"}
              </title>
            </circle>
          </g>
        );
      })}
      <text x="35" y="225">
        {showDate(from)}
      </text>
      <text x="765" y="225" textAnchor="end">
        {showDate(to)}
      </text>
    </svg>
  );
}

export default function LiveWorkspace({ demo = false }: { demo?: boolean }) {
  const [simulation] = useState(() => (demo ? createDemoBackend() : null));
  const api = simulation?.request || serverApi;
  const [prepDirty, setPrepDirty] = useState(false);
  const [registryFilter, setRegistryFilter] = useState<
    "all" | "with" | "empty"
  >("all");
  const [registrySort, setRegistrySort] = useState<"latest" | "code">("latest");
  const [registryLoading, setRegistryLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [journalQuery, setJournalQuery] = useState("");
  const [metric, setMetric] = useState<"mood" | "energy" | "sleepHours">(
    "mood",
  );
  const [report, setReport] = useState<{
    patientCode: string;
    entries: Entry[];
    period: Period;
  } | null>(null);
  const reportDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (report) reportDialog.current?.showModal();
    else reportDialog.current?.close();
  }, [report]);
  const [me, setMe] = useState<Me | null>(null),
    [booting, setBooting] = useState(true);
  const [list, setList] = useState<Patient[]>([]),
    [selected, setSelected] = useState<Patient | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]),
    [note, setNote] = useState<Note>(blankNote),
    [text, setText] = useState("");
  const [range, setRange] = useState<Period>(() => recentPeriod(14));
  const days = periodDays(range);
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [loadedHistoryKey, setLoadedHistoryKey] = useState("");
  const [loadedNotePatient, setLoadedNotePatient] = useState("");
  const [reloadPrompt, setReloadPrompt] = useState(false);
  const historyPending = loading || (!!selected && loadedHistoryKey !== `${selected.id}:${range.from}:${range.to}` && !historyFailed);
  const [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [code, setCode] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [linkedInvitation, setLinkedInvitation] = useState(false);
  useEffect(() => {
    if (demo) return;
    const capture = () => {
      const incoming = readInvitationFragment(window.location.hash);
      if (incoming === null) return;
      // Scrub the address immediately. Keep the invitation only in this mount.
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      setCode(incoming);
      setLinkedInvitation(!!incoming);
      setMessage("");
      setError(incoming ? "" : "Ссылка приглашения неполная. Попросите пациента прислать её ещё раз или введите код вручную.");
    };
    capture();
    window.addEventListener("hashchange", capture);
    return () => window.removeEventListener("hashchange", capture);
  }, [demo]);
  const generation = useRef(0);
  const clearHistory = useCallback(() => {
    generation.current++;
    setEntries([]);
    setLoading(false);
    setHistoryFailed(false);
    setLoadedHistoryKey("");
    setLoadedNotePatient("");
    setReloadPrompt(false);
    setNote(blankNote);
    setText("");
    setSelected(null);
    setReport(null);
    setPrepDirty(false);
    setJournalQuery("");
  }, []);
  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof Error && e.name === "AbortError") return;
      if (
        e instanceof RequestError &&
        (e.status === 401 ||
          ["DOCTOR_REQUIRED", "EMAIL_NOT_VERIFIED", "FORBIDDEN"].includes(e.code))
      ) {
        setMe(null);
        setList([]);
        clearHistory();
      }
      if (e instanceof RequestError && (e.status === 404 || e.code === "CONSENT_REQUIRED")) clearHistory();
      setError(e instanceof Error ? e.message : "Не удалось выполнить запрос.");
    },
    [clearHistory],
  );
  const refreshList = useCallback(async () => {
    const patients = await api<Patient[]>("v1/therapist/patients");
    setRegistryLoading(false);
    setList(patients);
    return patients;
  }, [api]);
  useEffect(() => {
    if (!API_URL && !demo) {
      setBooting(false);
      return;
    }
    const controller = new AbortController();
    api<Me>("v1/me", { signal: controller.signal })
      .then(setMe)
      .catch((e) => {
        if (!(
          e instanceof RequestError &&
          (e.status === 401 ||
            ["DOCTOR_REQUIRED", "EMAIL_NOT_VERIFIED"].includes(e.code))
        ))
          fail(e);
      })
      .finally(() => setBooting(false));
    return () => controller.abort();
  }, [fail, api, demo]);
  useEffect(() => {
    if (me?.role !== "doctor") return;
    let active = true;
    setRegistryLoading(true);
    async function refresh() {
      try {
        const patients = await api<Patient[]>("v1/therapist/patients");
        if (!active) return;
        setList(patients);
        if (selected && !patients.some((p) => p.id === selected.id)) {
          clearHistory();
          setError("Пациент закрыл доступ. История убрана из кабинета.");
        }
      } catch (e) {
        if (active) fail(e);
      } finally {
        if (active) setRegistryLoading(false);
      }
    }
    void refresh();
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(tick, 30000);
    window.addEventListener("focus", tick);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [me, selected, clearHistory, fail, api]);
  const loadHistory = useCallback(
    async (patient: Patient, range: Period) => {
      const current = ++generation.current;
      setLoading(true);
      setHistoryFailed(false);
      setReloadPrompt(false);
      setError("");
      setMessage("");
      try {
        const [history, savedNote] = await Promise.all([
          api<{ entries: Entry[] }>(
            `v1/therapist/patients/${patient.id}/entries?from=${range.from}&to=${range.to}`,
          ),
          api<Note>(`v1/therapist/patients/${patient.id}/note`),
        ]);
        if (current !== generation.current) return;
        setEntries(history.entries);
        setNote(savedNote);
        setText(savedNote.text);
        setLoadedHistoryKey(`${patient.id}:${range.from}:${range.to}`);
        setLoadedNotePatient(patient.id);
      } catch (e) {
        if (current === generation.current) {
          setHistoryFailed(true);
          fail(e);
        }
      } finally {
        if (current === generation.current) setLoading(false);
      }
    },
    [fail, api],
  );
  useEffect(() => {
    if (selected) void loadHistory(selected, range);
  }, [selected, range, loadHistory]);
  useEffect(() => {
    if (note.text === text) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [note.text, text]);
  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("auth/sign-in/email", {
        method: "POST",
        body: { email, password },
      });
      setPassword("");
      setMe(await api<Me>("v1/me"));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function logout(keepInvitation = false) {
    if (
      (prepDirty || note.text !== text) &&
      !window.confirm("Выйти без сохранения изменений?")
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api("auth/sign-out", { method: "POST", body: {} });
      setMe(null);
      setList([]);
      clearHistory();
      if (!keepInvitation) {
        setCode("");
        setLinkedInvitation(false);
      }
      setEmail("");
      setPassword("");
      setMessage("");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function accept(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("v1/therapist/invitations/accept", {
        method: "POST",
        body: { code: code.trim() },
      });
      setCode("");
      setLinkedInvitation(false);
      await refreshList();
      setMessage("Пациент добавлен. Можно открыть историю.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!selected || loadedNotePatient !== selected.id) return;
    setBusy(true);
    setError("");
    setMessage("");
    const current = generation.current;
    try {
      const saved = await api<Note>(
        `v1/therapist/patients/${selected.id}/note`,
        { method: "PUT", body: { text, revision: note.revision } },
      );
      if (generation.current === current) {
        setNote(saved);
        setMessage(
          demo
            ? "Учебная заметка сохранена на время показа. После перезагрузки она исчезнет."
            : "Заметка сохранена на сервере.",
        );
      }
    } catch (e) {
      if (generation.current === current) fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    if (!selected) return;
    setBusy(true);
    setError("");
    const current = generation.current;
    try {
      const data = await api(
        `v1/therapist/patients/${selected.id}/export?from=${range.from}&to=${range.to}`,
      );
      if (current !== generation.current) return;
      const href = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = href;
      a.download = `ryadom-${range.from}-${range.to}.json`;
      a.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      if (generation.current === current) fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function openReport() {
    if (!selected) return;
    const current = generation.current;
    setBusy(true);
    setError("");
    try {
      const data = await api<{ patientCode: string; entries: Entry[] }>(
        `v1/therapist/patients/${selected.id}/export?from=${range.from}&to=${range.to}`,
      );
      if (current === generation.current)
        setReport({ ...data, period: { ...range } });
    } catch (e) {
      if (current === generation.current) fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function printReport() {
    if (!selected || !report) return;
    const current = generation.current;
    setBusy(true);
    try {
      await api(
        `v1/therapist/patients/${selected.id}/export?from=${report.period.from}&to=${report.period.to}`,
      );
      if (current === generation.current) window.print();
    } catch (e) {
      if (current === generation.current) {
        setReport(null);
        fail(e);
      }
    } finally {
      setBusy(false);
    }
  }
  const filteredPatients = list
    .filter(
      (p) =>
        p.displayCode
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()) &&
        (registryFilter === "all" ||
          (registryFilter === "with" ? p.entryCount > 0 : p.entryCount === 0)),
    )
    .sort((a, b) =>
      registrySort === "code"
        ? a.displayCode.localeCompare(b.displayCode, "ru")
        : (b.latestEntryDate || "").localeCompare(a.latestEntryDate || "") ||
          a.displayCode.localeCompare(b.displayCode, "ru"),
    );
  const filteredEntries = entries.filter((e) =>
    e.text
      .toLocaleLowerCase()
      .includes(journalQuery.trim().toLocaleLowerCase()),
  );
  const mean = (data: Entry[], field: "mood" | "sleepHours" | "energy") =>
    data.length
      ? (
          data.reduce((sum, e) => sum + e[field], 0) / data.length
        ).toLocaleString("ru", { maximumFractionDigits: 1 })
      : "—";
  const dirty = note.text !== text;
  return (
    <main className={`live-workspace ${report ? "live-report-open" : ""}`}>
      <header className="masthead">
        <Link href="/" className="brand">
          <span className="brand-mark">↗</span>рядом
        </Link>
        <span className="masthead-note">
          ПРОСТРАНСТВО
          <br />
          ПСИХОТЕРАПЕВТА
        </span>
        <div className="header-right">
          {me && !demo ? (
            <button className="live-link" disabled={busy} onClick={() => void logout()}>
              Выйти <ArrowUpRight size={14} />
            </button>
          ) : (
            <Link href="/" className="live-link">
              К показу проекта <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
      </header>
      <div className="live-environment">
        {demo
          ? "ДЕМОНСТРАЦИЯ · ВЫМЫШЛЕННЫЕ ИСТОРИИ · БЕЗ ПОДКЛЮЧЕНИЯ К СЕРВЕРУ"
          : "Стенд разработки · только вымышленные данные"}
      </div>
      {me && !demo && <Sessions key={me.id} disabled={busy}
        read={() => api<SessionOverview>("v1/me/sessions")}
        revoke={() => api("v1/me/sessions/revoke-others", { method: "POST", body: { confirmation: "REVOKE_OTHER_SESSIONS" } })}
        onError={fail} />}
      {demo && (
        <div className="live-demo-tools">
          <span>
            Учебная практика <small>Изменения действуют до перезагрузки</small>
          </span>
          <div>
            {selected && (
              <button
                className="live-link"
                onClick={() => {
                  simulation!.revoke(selected.id);
                  clearHistory();
                  void refreshList();
                  setMessage(
                    "Сценарий: пациент отозвал доступ. Его история и заметка больше недоступны.",
                  );
                }}
              >
                Показать отзыв доступа ↗
              </button>
            )}
            <button
              className="live-link"
              onClick={() => {
                simulation!.reset();
                clearHistory();
                setQuery("");
                setError("");
                setMessage("Демонстрация начата заново.");
                void refreshList();
              }}
            >
              Начать показ заново ↺
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="live-alert" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="live-message" role="status">
          {message}
        </div>
      )}
      {linkedInvitation && !booting && (
        <section className="live-arrival" aria-labelledby="arrival-title">
          <div className="live-arrival-mark" aria-hidden="true">↗</div>
          <div>
            <span className="eyebrow">ПРИГЛАШЕНИЕ ПАЦИЕНТА</span>
            <h2 id="arrival-title">Начало общей истории.</h2>
            <p>{!me
              ? "Войдите с почтой, которую пациент указал в приглашении. После входа вы сможете принять его."
              : me.role !== "doctor"
                ? "Приглашение сохранено на время смены аккаунта. Войдите в учётную запись специалиста."
                : `Вы вошли как ${me.email || me.name}. Примите приглашение, чтобы открыть доступный вам дневник.`}</p>
            <small>Ссылка действует 24 часа и используется один раз. После обновления страницы откройте её снова.</small>
            <div className="live-arrival-actions">
              {me?.role === "doctor" && (
                <form onSubmit={accept}>
                  <button className="primary" disabled={busy}>Принять приглашение <ArrowRight size={17} /></button>
                </form>
              )}
              {me && <button className="live-link" disabled={busy} onClick={() => void logout(true)}>Войти другим аккаунтом ↗</button>}
              <button className="live-link" disabled={busy} onClick={() => { setCode(""); setLinkedInvitation(false); setError(""); }}>Убрать приглашение</button>
            </div>
          </div>
        </section>
      )}
      {booting ? (
        <p className="live-empty" role="status">
          Проверяем сессию…
        </p>
      ) : !API_URL && !demo ? (
        <section className="live-intro">
          <div className="eyebrow">СЕРВЕРНЫЙ КАБИНЕТ</div>
          <h1>
            Следующий шаг —<br />
            <em>общая история.</em>
          </h1>
          <p>
            Сервер для этого адреса ещё не подключён. Инструкция запуска
            находится в backend/README.md.
          </p>
          <Link className="live-link" href="/showcase">
            Открыть демонстрацию <ArrowRight size={16} />
          </Link>
        </section>
      ) : !me ? (
        <div className="live-login">
          <section className="live-intro live-practice-intro">
            <div className="eyebrow">ВАША ПРАКТИКА / ВХОД</div>
            <h1>
              Продолжим
              <br />
              <em>с того же места.</em>
            </h1>
            <p>
              Дневники, которыми с вами поделились,
              <br />и ваши заметки к следующей встрече.
            </p>
            <div className="live-trust">
              <ShieldCheck size={20} />
              <span>
                История доступна только
                <br />с разрешения пациента.
              </span>
            </div>
          </section>
          <form className="live-login-form" onSubmit={login}>
            <span className="eyebrow">01 / КАБИНЕТ СПЕЦИАЛИСТА</span>
            <h2>С возвращением.</h2>
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
            <button className="primary" disabled={busy}>
              Войти <ArrowRight size={17} />
            </button>
            <p>Учётную запись специалиста подключает администратор команды.</p>
          </form>
        </div>
      ) : me.role !== "doctor" ? (
        <section className="live-intro">
          <h1>
            Это кабинет
            <br />
            <em>специалиста.</em>
          </h1>
          <p>
            Вы вошли в пациентскую учётную запись. Для работы здесь нужен
            подтверждённый аккаунт психотерапевта.
          </p>
          <button className="primary" disabled={busy} onClick={() => void logout(linkedInvitation)}>
            Выйти из пациентского аккаунта
          </button>
        </section>
      ) : !selected ? (
        <>
          <section className="live-intro live-practice-intro">
            <div className="eyebrow">ВАША ПРАКТИКА / {me.name}</div>
            <h1>
              За каждой записью —<br />
              <em>человек.</em>
            </h1>
            <p>Доступные дневники и наблюдения между встречами.</p>
          </section>
          <div className="live-registry-heading">
            <h2>
              Пациенты <span>{String(list.length).padStart(2, "0")}</span>
            </h2>
            <button
              className="live-link"
              disabled={busy}
              onClick={() => {
                setError("");
                setBusy(true);
                refreshList()
                  .catch(fail)
                  .finally(() => setBusy(false));
              }}
            >
              <RefreshCw size={14} />
              Обновить
            </button>
          </div>
          <div
            className="live-registry-overview"
            aria-label="Обзор доступных дневников"
          >
            <div>
              <strong>
                {String(list.filter((p) => p.entryCount > 0).length).padStart(
                  2,
                  "0",
                )}
              </strong>
              <span>дневников с записями</span>
            </div>
            <div>
              <strong>
                {String(list.filter((p) => p.entryCount === 0).length).padStart(
                  2,
                  "0",
                )}
              </strong>
              <span>пока без записей</span>
            </div>
            <p>
              За цифрами — дни, которыми человек решил поделиться. Количество
              записей не оценивает его состояние.
            </p>
          </div>
          <div className="live-registry-controls">
            <label className="live-search">
              Поиск по коду пациента
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Например, Р-014"
                type="search"
              />
            </label>
            <label className="live-sort">
              Порядок
              <select
                value={registrySort}
                onChange={(e) =>
                  setRegistrySort(e.target.value as "latest" | "code")
                }
              >
                <option value="latest">По дате последней записи</option>
                <option value="code">По коду пациента</option>
              </select>
            </label>
          </div>
          <div
            className="live-registry-filters"
            role="group"
            aria-label="Фильтр дневников"
          >
            {(
              [
                ["all", "Все"],
                ["with", "С записями"],
                ["empty", "Пока пустые"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={registryFilter === value}
                onClick={() => setRegistryFilter(value)}
              >
                {label}
              </button>
            ))}
            <span role="status">
              {registryLoading
                ? "Обновляем реестр…"
                : `Показано ${filteredPatients.length} из ${list.length}`}
            </span>
          </div>
          <div className="live-registry-columns" aria-hidden="true">
            <span>ДНЕВНИК</span>
            <span>ПОСЛЕДНЯЯ ЗАПИСЬ</span>
            <span>ВСЕГО</span>
          </div>
          <div className="live-patients">
            {filteredPatients.length ? (
              filteredPatients.map((patient, index) => (
                <button
                  className="live-patient-row"
                  key={patient.id}
                  onClick={() => {
                    setError("");
                    setMessage("");
                    setSelected(patient);
                  }}
                >
                  <span className="eyebrow">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="live-patient-identity">
                    <strong>{patient.displayCode}</strong>
                    <small>Доступ с {showDate(patient.grantedAt)}</small>
                  </span>
                  <span className="live-patient-last">
                    {patient.latestEntryDate
                      ? showDate(patient.latestEntryDate)
                      : "Пока нет записей"}
                  </span>
                  <span
                    className="live-patient-count"
                    aria-label={`Всего записей: ${patient.entryCount}`}
                  >
                    {patient.entryCount}
                    <small>
                      {
                        {
                          one: "запись",
                          few: "записи",
                          many: "записей",
                          other: "записи",
                          zero: "записей",
                          two: "записи",
                        }[new Intl.PluralRules("ru").select(patient.entryCount)]
                      }
                    </small>
                  </span>
                  <ArrowUpRight size={22} />
                </button>
              ))
            ) : (
              <div className="live-empty">
                <h3>
                  {registryLoading
                    ? "Загружаем дневники…"
                    : query || registryFilter !== "all"
                      ? "Нет дневников по этому фильтру."
                      : "Пока здесь чистый лист."}
                </h3>
                <p>
                  {query || registryFilter !== "all"
                    ? "Попробуйте другой код или выберите фильтр «Все»."
                    : "Когда пациент передаст вам приглашение, здесь появится его история."}
                </p>
              </div>
            )}
          </div>
          {!demo && !linkedInvitation ? (
            <form onSubmit={accept} className="live-invite">
              <div>
                <span className="eyebrow">С РАЗРЕШЕНИЯ ПАЦИЕНТА</span>
                <h2>Начать общую историю.</h2>
                <p>
                  Приглашение должно быть адресовано почте вашей учётной записи.
                </p>
              </div>
              <div className="live-invite-control">
                <label htmlFor="invitation-code">Код приглашения</label>
                <input
                  id="invitation-code"
                  required
                  value={code}
                  maxLength={48}
                  autoComplete="off"
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Вставьте код, который прислал пациент"
                />
                <button
                  className="primary"
                  disabled={busy || !invitationCode(code.trim())}
                >
                  Принять приглашение <ArrowRight size={17} />
                </button>
              </div>
            </form>
          ) : demo ? (
            <section className="live-invite">
              <div>
                <span className="eyebrow">ДОСТУП НАЧИНАЕТСЯ С ДОВЕРИЯ</span>
                <h2>
                  Пациент решает,
                  <br />
                  чем поделиться.
                </h2>
              </div>
              <p>
                В рабочем кабинете пациент передаёт приглашение для вашей почты.
                Он может закрыть доступ в любой момент. Здесь разрешения учебные
                — сценарий отзыва можно показать из истории пациента.
              </p>
            </section>
          ) : null}
        </>
      ) : (
        <>
          <nav className="live-case-nav">
            <button
              className="live-link"
              onClick={clearHistory}
              disabled={busy || dirty || prepDirty}
            >
              <ArrowLeft size={15} />К пациентам
            </button>
            <span className="eyebrow">ИСТОРИЯ / {selected.displayCode}</span>
          </nav>
          <section className="live-case-title">
            <h1>
              Между
              <br />
              <em>встречами.</em>
            </h1>
            <PeriodPicker
              value={range}
              disabled={busy || dirty || prepDirty || loading}
              onApply={(period) => {
                setReport(null);
                setRange(period);
              }}
            />
          </section>
          <div className="live-case-grid">
            <section>
              <div className="live-registry-heading">
                <h2>Динамика между встречами</h2>
                <button
                  className="live-link"
                  disabled={loading || busy}
                  onClick={download}
                >
                  <Download size={14} />
                  JSON
                </button>
              </div>
              <div
                className="live-metric-tabs"
                role="group"
                aria-label="Показатель графика"
              >
                {(
                  [
                    ["mood", "Настроение"],
                    ["sleepHours", "Сон"],
                    ["energy", "Энергия"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    aria-pressed={metric === key}
                    onClick={() => setMetric(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="live-muted">
                {metric === "sleepHours"
                  ? "Длительность сна в часах со слов пациента."
                  : "Самооценка пациента по шкале 1–10."}{" "}
                Пропущенные дни не заполняются. Это наблюдения, а не клиническая
                оценка.
              </p>
              {historyPending ? (
                <p className="live-empty" role="status">
                  Загружаем историю…
                </p>
              ) : historyFailed ? (
                <div className="live-load-state" role="status">
                  <h3>История пока не загружена.</h3>
                  <p>Не удалось получить записи за выбранный период. Это не означает, что дневник пуст.</p>
                  <p>Повторите загрузку через «Обновить историю и заметку». Несохранённый текст останется до успешного ответа.</p>
                </div>
              ) : (
                <>
                  <Chart
                    key={`${selected.id}-${range.from}-${range.to}-${metric}`}
                    entries={entries}
                    from={range.from}
                    to={range.to}
                    metric={metric}
                  />
                  <div className="live-stat-strip">
                    <div>
                      <strong>
                        {entries.length}
                        <small>/{days}</small>
                      </strong>
                      <span>дней с записями</span>
                    </div>
                    <div>
                      <strong>{mean(entries, metric)}</strong>
                      <span>
                        {metric === "sleepHours"
                          ? "часов сна в среднем"
                          : "средняя самооценка"}
                      </span>
                    </div>
                    <button
                      className="live-link"
                      disabled={busy || loading || dirty}
                      onClick={openReport}
                    >
                      Сводка к встрече <ArrowUpRight size={18} />
                    </button>
                  </div>
                  <label className="live-search">
                    Найти в записях
                    <input
                      type="search"
                      value={journalQuery}
                      onChange={(e) => setJournalQuery(e.target.value)}
                      placeholder="Слово или фраза из дневника"
                    />
                  </label>
                  {entries.length ? (
                    <div className="live-entry-list">
                      {filteredEntries.map((entry) => (
                        <article key={entry.id}>
                          <div className="live-entry-date">
                            {showDate(entry.date)}
                            <span>
                              Настроение {entry.mood}/10 · сон{" "}
                              {entry.sleepHours} ч · энергия {entry.energy}/10
                            </span>
                          </div>
                          <p>{entry.text || "Запись без текста"}</p>
                        </article>
                      ))}
                      {!filteredEntries.length && (
                        <p className="live-empty">
                          По этому запросу записей нет. Попробуйте другое слово.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="live-empty">За этот период записей нет.</p>
                  )}
                </>
              )}
            </section>
            <aside className="live-note">
              <span className="eyebrow">К СЛЕДУЮЩЕЙ ВСТРЕЧЕ</span>
              <h2>На полях.</h2>
              <p>
                {demo
                  ? "Учебная заметка. Остаётся в памяти этой вкладки до перезагрузки."
                  : "Ваша личная заметка. Она хранится отдельно от дневника пациента."}
              </p>
              <label className="live-note-label" htmlFor="session-note">
                Заметка психотерапевта
              </label>
              <textarea
                id="session-note"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setMessage("");
                }}
                maxLength={5000}
                disabled={loading || busy || loadedNotePatient !== selected.id}
                placeholder="Что важно обсудить…"
              />
              <div className="live-note-meta">
                <span>{text.length}/5000</span>
                <span>
                  {loadedNotePatient !== selected.id ? "Заметка ещё не загружена" : dirty
                    ? "Есть несохранённые изменения"
                    : note.revision
                      ? "Сохранено"
                      : "Пока пусто"}
                </span>
              </div>
              <button
                className="primary"
                onClick={save}
                disabled={loading || busy || !dirty || loadedNotePatient !== selected.id}
              >
                Сохранить заметку <ArrowRight size={16} />
              </button>
              {dirty && error && <p className="live-muted">Черновик остаётся в этой вкладке. Если ответ при сохранении потерялся, запись могла сохраниться. Скопируйте текст перед загрузкой сохранённой версии; перезагрузка страницы или завершение сессии очищает черновик.</p>}
              <button
                className="live-link"
                disabled={loading || busy}
                onClick={() => {
                  if (dirty) setReloadPrompt(true);
                  else void loadHistory(selected, range);
                }}
              >
                <RefreshCw size={14} />
                Обновить историю и заметку
              </button>
              {reloadPrompt && <div className="live-reload-confirm" role="group" aria-label="Замена черновика">
                <strong>Заменить черновик?</strong>
                <p>После успешной загрузки здесь появится сохранённая версия. Перед этим скопируйте текст, который хотите оставить.</p>
                <button className="live-link" disabled={loading || busy} onClick={() => void loadHistory(selected, range)}>Загрузить и заменить</button>
                <button className="live-link" onClick={() => setReloadPrompt(false)}>Оставить черновик</button>
              </div>}
              <Preparation
                key={selected.id}
                patientId={selected.id}
                request={api}
                onDirty={setPrepDirty}
                onError={fail}
                demo={demo}
              />
            </aside>
          </div>
        </>
      )}
      <dialog
        aria-labelledby="report-title"
        ref={reportDialog}
        className="live-report"
        onCancel={() => setReport(null)}
      >
        {report && (
          <>
            <div className="live-report-actions">
              <button className="live-link" onClick={() => setReport(null)}>
                ← К истории
              </button>
              <button className="primary" disabled={busy} onClick={printReport}>
                Печать / сохранить PDF
              </button>
            </div>
            <span className="eyebrow">РЯДОМ / ПОДГОТОВКА К ВСТРЕЧЕ</span>
            <h2 id="report-title">
              История в нескольких
              <br />
              <em>наблюдениях.</em>
            </h2>
            <p>
              {report.patientCode} · {showDate(report.period.from)} —{" "}
              {showDate(report.period.to)}
            </p>
            <div className="live-stat-strip">
              <div>
                <strong>
                  {report.entries.length}
                  <small>/{periodDays(report.period)}</small>
                </strong>
                <span>дней с записями</span>
              </div>
              <div>
                <strong>
                  {periodDays(report.period) - report.entries.length}
                </strong>
                <span>дней без записи</span>
              </div>
            </div>
            <table>
              <caption>Средние значения только по заполненным дням</caption>
              <tbody>
                <tr>
                  <th>Настроение</th>
                  <td>{mean(report.entries, "mood")} / 10</td>
                </tr>
                <tr>
                  <th>Энергия</th>
                  <td>{mean(report.entries, "energy")} / 10</td>
                </tr>
                <tr>
                  <th>Сон</th>
                  <td>{mean(report.entries, "sleepHours")} ч</td>
                </tr>
              </tbody>
            </table>
            <h3>Записи за период</h3>
            {report.entries.length ? (
              report.entries.map((entry) => (
                <article key={entry.id}>
                  <strong>{showDate(entry.date)}</strong>
                  <p>{entry.text || "Без текста"}</p>
                </article>
              ))
            ) : (
              <p>В этом периоде записей нет.</p>
            )}
            <p className="live-muted">
              {demo ? "Демонстрация: все записи вымышлены. " : ""}Самооценки не
              определяют фазу или диагноз. Пропуски не означают нулевые
              значения. Личная заметка специалиста в эту сводку не включается.
            </p>
          </>
        )}
      </dialog>
      <footer className="live-footer">
        <span>Рядом · пространство для совместной работы</span>
        <span>Доступ к дневнику выдаёт и отзывает пациент.</span>
      </footer>
    </main>
  );
}
