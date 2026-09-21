"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Plus,
  Search,
  X,
  Check,
  LockKeyhole,
  BookOpen,
  Download,
  ShieldCheck,
} from "lucide-react";
type Person = {
  id: string;
  alias: string;
  initials: string;
  session: string;
  available: boolean;
  values: number[];
  sleep: number[];
  energy: number[];
  texts: string[];
};
const patients: Person[] = [
  {
    id: "P-014",
    alias: "Александра",
    initials: "АЛ",
    session: "22 сентября · 11:00",
    available: true,
    values: [6, 7, 6, 6, 5, 6, 6, 5, 4, 5, 4, 5, 5, 6],
    sleep: [8, 8, 7.5, 8, 7, 7, 7.5, 6.5, 6, 6, 6.5, 6, 7, 7],
    energy: [6, 6, 6, 5, 6, 6, 5, 5, 4, 4, 5, 4, 5, 6],
    texts: [
      "В последние дни чуть сложнее вставать утром. Хочу обсудить это на встрече.",
      "После работы вышла на прогулку. Помогло переключиться и отдохнуть.",
      "День прошёл спокойно. Вечером читала, легла немного раньше.",
    ],
  },
  {
    id: "P-021",
    alias: "Михаил",
    initials: "МИ",
    session: "22 сентября · 14:00",
    available: true,
    values: [5, 6, 6, 5, 6, 7, 6, 6, 7, 6, 6, 7, 6, 6],
    sleep: [7, 7, 8, 7, 7, 8, 8, 7, 8, 7, 7, 8, 7, 8],
    energy: [5, 6, 5, 6, 6, 7, 6, 5, 6, 6, 5, 6, 6, 6],
    texts: [
      "Получилось сохранить привычный режим даже в выходные.",
      "На работе было много дел, но вечером нашёл время для отдыха.",
      "Хочу поговорить о том, как планировать неделю без перегрузки.",
    ],
  },
  {
    id: "P-032",
    alias: "Дарья",
    initials: "ДА",
    session: "23 сентября · 10:00",
    available: true,
    values: [5, 5, 6, 5, 5, 6, 6, 6, 6, 7, 6, 7, 7, 6],
    sleep: [6, 6.5, 7, 7, 7, 7, 8, 7.5, 8, 8, 7.5, 8, 8, 8],
    energy: [4, 4, 5, 4, 5, 5, 6, 5, 6, 6, 6, 7, 6, 6],
    texts: [
      "Вернулась к вечерним прогулкам. Пока получается несколько раз в неделю.",
      "Утро прошло без спешки, позавтракала дома.",
      "На следующей встрече хочу вернуться к разговору о работе.",
    ],
  },
  {
    id: "P-009",
    alias: "Сергей",
    initials: "СЕ",
    session: "Встреча не назначена",
    available: false,
    values: [],
    sleep: [],
    energy: [],
    texts: [],
  },
];
const KEY = "ryadom-therapist-demo-v1";
function Spark({
  values,
  large = false,
}: {
  values: number[];
  large?: boolean;
}) {
  const w = large ? 780 : 150,
    h = large ? 200 : 40;
  return (
    <svg
      className={large ? "case-chart" : "spark"}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Демонстрационный график настроения"
    >
      {large &&
        [2, 4, 6, 8, 10].map((n) => (
          <g key={n}>
            <line
              x1="28"
              x2={w - 10}
              y1={h - 20 - n * 15}
              y2={h - 20 - n * 15}
              stroke="#d6d3ca"
              strokeDasharray="3 6"
            />
            <text x="3" y={h - 16 - n * 15} fontSize="9" fill="#8d8990">
              {n}
            </text>
          </g>
        ))}
      <polyline
        points={values
          .map(
            (n, i) =>
              `${(large ? 30 : 3) + (i * (w - (large ? 44 : 6))) / Math.max(values.length - 1, 1)},${large ? h - 20 - n * 15 : h - 4 - n * 3}`,
          )
          .join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={large ? 2.5 : 1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
function Popup({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const r = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    r.current?.showModal();
  }, []);
  return (
    <dialog ref={r} onCancel={close}>
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={close} aria-label="Закрыть">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function Therapist() {
  const [active, setActive] = useState<Person | null>(null);
  const [tab, setTab] = useState<"patients" | "sessions">("patients");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [period, setPeriod] = useState(14);
  const [modal, setModal] = useState<"invite" | "about" | "report" | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [linked, setLinked] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [prepared, setPrepared] = useState<Record<string, number[]>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setNotes(s.notes || {});
        setPrepared(s.prepared || {});
        setLinked(s.linked === true);
      }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded)
      try {
        localStorage.setItem(KEY, JSON.stringify({ notes, linked, prepared }));
      } catch {
        setToast("Локальное сохранение недоступно");
      }
  }, [notes, linked, prepared, loaded]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const all = linked
    ? [
        ...patients,
        {
          ...patients[1],
          id: "P-048",
          alias: "Новый демопациент",
          initials: "НП",
          session: "Встреча не назначена",
          values: [],
          sleep: [],
          energy: [],
          texts: [],
        },
      ]
    : patients;
  const shown = all.filter(
    (p) =>
      (filter === "all" ||
        (filter === "active" ? p.available : !p.available)) &&
      `${p.alias} ${p.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  const open = (p: Person) => {
    if (!p.available) return;
    setActive(p);
    setDraft(notes[p.id] || "");
    setPeriod(14);
  };
  const vals = active?.values.slice(-period) || [];
  const sleeps = active?.sleep.slice(-period) || [];
  const mean = (a: number[]) =>
    a.length
      ? (a.reduce((s, n) => s + n, 0) / a.length).toFixed(1).replace(".", ",")
      : "—";
  const report = () => {
    if (!active?.available) return;
    const result = {
      author_code: active.id,
      notice: "Демонстрационные данные. Не медицинское заключение.",
      period_days: period,
      mood: vals,
      sleep_hours: sleeps,
      energy: active.energy.slice(-period),
      entries: active.texts,
      therapist_note: notes[active.id] || "",
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `ryadom-${active.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("Демосводка скачана в JSON");
  };
  const prepItems = [
    "Посмотреть отметки между встречами",
    "Прочитать записи пациента",
    "Подготовить вопросы к сессии",
  ];
  return (
    <div className="therapist-app">
      <main>
        <header className="masthead">
          <Link className="brand" href="/">
            рядом<span className="brand-mark">↗</span>
          </Link>
          <span className="masthead-note">
            Пространство
            <br />
            психотерапевта.
          </span>
          <div className="header-right">
            <span className="demo-pill">ПРОТОТИП / 02</span>
            <span className="therapist-name">Анна / психотерапевт</span>
            <span className="doctor-monogram">А</span>
          </div>
        </header>
        <nav className="chapter-nav">
          <button
            className={tab === "patients" ? "active" : ""}
            onClick={() => {
              setTab("patients");
              setActive(null);
            }}
          >
            <span>01</span>Пациенты <ArrowUpRight size={14} />
          </button>
          <button
            className={tab === "sessions" ? "active" : ""}
            onClick={() => {
              setTab("sessions");
              setActive(null);
            }}
          >
            <span>02</span>Подготовка к встречам <ArrowUpRight size={14} />
          </button>
          <button className="about-nav" onClick={() => setModal("about")}>
            Как связана платформа <ArrowUpRight size={14} />
          </button>
        </nav>
        <div className="content">
          {!active ? (
            <>
              <div className="page-heading therapist-heading">
                <div>
                  <div className="eyebrow">
                    ВАША ПРАКТИКА / ДЕМО · СЕНТЯБРЬ 2026
                  </div>
                  <h1>
                    {tab === "patients" ? (
                      <>
                        За каждой записью —<br />
                        <em>человек.</em>
                      </>
                    ) : (
                      <>
                        До встречи —<br />
                        <em>всё важное рядом.</em>
                      </>
                    )}
                  </h1>
                  <p>
                    {tab === "patients"
                      ? "Дневники пациентов и наблюдения между сессиями."
                      : "Откройте историю пациента, чтобы подготовиться к разговору."}
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setModal("invite");
                    setError("");
                    setCode("");
                  }}
                >
                  Ввести код пациента <Plus size={17} />
                </button>
              </div>
              {tab === "patients" ? (
                <>
                  <div className="practice-strip">
                    <span>
                      <strong>
                        {all
                          .filter((p) => p.available)
                          .length.toString()
                          .padStart(2, "0")}
                      </strong>
                      доступных дневника
                    </span>
                    <span>
                      <strong>03</strong>предстоящие встречи
                    </span>
                    <div>
                      <ShieldCheck size={17} />
                      <p>
                        Доступ открывает пациент.
                        <br />
                        Вы видите только то, чем он поделился.
                      </p>
                    </div>
                    <span className="practice-stamp">
                      ВНИМАНИЕ
                      <br />К ЧЕЛОВЕКУ ↗
                    </span>
                  </div>
                  <div className="roster-tools">
                    <div className="roster-filters">
                      {[
                        ["all", "Все пациенты"],
                        ["active", "Доступ открыт"],
                        ["closed", "Доступ закрыт"],
                      ].map(([v, t]) => (
                        <button
                          key={v}
                          onClick={() => setFilter(v)}
                          className={filter === v ? "selected" : ""}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <label className="patient-search">
                      <Search size={15} />
                      <input
                        aria-label="Поиск пациента"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Имя или код пациента"
                      />
                    </label>
                  </div>
                  <div className="roster">
                    <div className="roster-head">
                      <span>ПАЦИЕНТ</span>
                      <span>ДНЕВНИК / 14 ДНЕЙ</span>
                      <span>НАСТРОЕНИЕ / ДИНАМИКА</span>
                      <span>СЛЕДУЮЩАЯ ВСТРЕЧА</span>
                      <span />
                    </div>
                    {shown.map((p) => (
                      <button
                        className={`roster-row ${!p.available ? "unavailable" : ""}`}
                        key={p.id}
                        onClick={() => open(p)}
                        disabled={!p.available}
                      >
                        <span className="person-cell">
                          <span className="person-initials">{p.initials}</span>
                          <span>
                            <strong>{p.alias}</strong>
                            <small>{p.id} · вымышленный профиль</small>
                          </span>
                        </span>
                        <span className="roster-records">
                          {p.available ? (
                            <>
                              <strong>{p.values.length} записей</strong>
                              <small>
                                {p.values.length
                                  ? "Последняя · 20 сентября"
                                  : "Ждём первую запись"}
                              </small>
                            </>
                          ) : (
                            <>
                              <LockKeyhole size={14} />
                              <strong>Доступ отозван</strong>
                            </>
                          )}
                        </span>
                        <span>
                          {p.values.length ? (
                            <Spark values={p.values} />
                          ) : (
                            <span className="muted">
                              {p.available
                                ? "Пока нет данных"
                                : "Данные недоступны"}
                            </span>
                          )}
                        </span>
                        <span className="session-cell">{p.session}</span>
                        <ArrowUpRight size={21} />
                      </button>
                    ))}
                    {!shown.length && (
                      <div className="empty">
                        Пациенты не найдены. Измените запрос или фильтр.
                      </div>
                    )}
                  </div>
                  <div className="roster-bottom">
                    <span>Все имена, записи и встречи вымышлены.</span>
                    <span>Наблюдения ≠ диагноз</span>
                  </div>
                  <section className="workflow-note">
                    <span className="mono">
                      ОДНА ИСТОРИЯ / ДВА ПРОСТРАНСТВА
                    </span>
                    <p>
                      Пациент ведёт дневник.
                      <br />
                      <em>Вы видите контекст.</em>
                    </p>
                    <div>
                      Дневник и Telegram-бот развивает другая часть команды.
                      Здесь — ваша работа с общей историей, с согласия пациента.
                      <button
                        className="text-button"
                        onClick={() => setModal("about")}
                      >
                        Как это будет работать <ArrowUpRight size={16} />
                      </button>
                    </div>
                  </section>
                </>
              ) : (
                <div className="session-list">
                  {patients
                    .filter((p) => p.available)
                    .map((p, i) => (
                      <button key={p.id} onClick={() => open(p)}>
                        <span className="session-number">0{i + 1}</span>
                        <span>
                          <small>{p.session}</small>
                          <strong>{p.alias}</strong>
                          <span>
                            {p.id} · {p.values.length} записей к просмотру
                          </span>
                        </span>
                        <span className="session-action">
                          Открыть историю <ArrowUpRight size={22} />
                        </span>
                      </button>
                    ))}
                  <p className="footnote">
                    Расписание демонстрационное. Календарь и назначение встреч
                    ещё не подключены.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <button
                className="text-button back-to-patients"
                onClick={() => setActive(null)}
              >
                <ArrowLeft size={15} />К пациентам
              </button>
              <div className="case-heading">
                <div>
                  <div className="eyebrow">ИСТОРИЯ ПАЦИЕНТА / {active.id}</div>
                  <h1>
                    {active.alias}
                    <span className="case-id">{active.id}</span>
                  </h1>
                  <p>
                    <span className="access-dot" />
                    Демодоступ открыт пациентом · следующая встреча:{" "}
                    {active.session}
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => setModal("report")}
                >
                  <Download size={16} />
                  Сводка к встрече
                </button>
              </div>
              <div className="case-layout">
                <div>
                  <section className="case-dynamics">
                    <div className="section-head">
                      <div>
                        <span className="mono">01 / МЕЖДУ ВСТРЕЧАМИ</span>
                        <h2>Что менялось в отметках</h2>
                      </div>
                      <div className="segments">
                        {[7, 14, 30].map((n) => (
                          <button
                            key={n}
                            className={period === n ? "selected" : ""}
                            onClick={() => setPeriod(n)}
                          >
                            {n} дней
                          </button>
                        ))}
                      </div>
                    </div>
                    {vals.length ? (
                      <>
                        <div className="case-measures">
                          <span>
                            Настроение{" "}
                            <strong>
                              {mean(vals)}
                              <small>/10</small>
                            </strong>
                          </span>
                          <span>
                            Сон{" "}
                            <strong>
                              {mean(sleeps)}
                              <small>ч</small>
                            </strong>
                          </span>
                          <span>
                            Энергия{" "}
                            <strong>
                              {mean(active.energy.slice(-period))}
                              <small>/10</small>
                            </strong>
                          </span>
                        </div>
                        <Spark values={vals} large />
                        <div className="graph-caption">
                          <span>Настроение / самооценка пациента</span>
                          <span>
                            {period === 7 ? "14" : "7"}–20 сентября ·{" "}
                            {vals.length} отметок
                          </span>
                        </div>
                        <p className="footnote">
                          Показаны средние значения и записи. Личная норма пока
                          не рассчитана; автоматические выводы о состоянии не
                          формируются.
                        </p>
                      </>
                    ) : (
                      <div className="empty">
                        <BookOpen />
                        <h3>История ещё не началась</h3>
                        <p>
                          Здесь появятся записи, когда пациент начнёт вести
                          дневник.
                        </p>
                      </div>
                    )}
                  </section>
                  <section className="case-entries">
                    <span className="mono">02 / ГОЛОС ПАЦИЕНТА</span>
                    <h2>Своими словами</h2>
                    {active.texts.map((t, i) => (
                      <article key={i}>
                        <div>
                          <strong>{20 - i}</strong>
                          <small>СЕН</small>
                        </div>
                        <blockquote>
                          {t}
                          <footer>Демо · дневник пациента</footer>
                        </blockquote>
                      </article>
                    ))}
                    {!active.texts.length && (
                      <p className="muted">Пока нет записей.</p>
                    )}
                  </section>
                </div>
                <aside className="session-prep">
                  <span className="mono">03 / К СЛЕДУЮЩЕЙ ВСТРЕЧЕ</span>
                  <h2>
                    Сначала услышать.
                    <br />
                    <em>Потом обсудить.</em>
                  </h2>
                  <p>
                    Отметьте, к чему хотите вернуться на сессии. Это ваши
                    рабочие заметки.
                  </p>
                  <div className="prep-checklist">
                    {prepItems.map((label, i) => (
                      <label key={label}>
                        <input
                          type="checkbox"
                          checked={(prepared[active.id] || []).includes(i)}
                          onChange={() =>
                            setPrepared((old) => {
                              const list = old[active.id] || [];
                              return {
                                ...old,
                                [active.id]: list.includes(i)
                                  ? list.filter((n) => n !== i)
                                  : [...list, i],
                              };
                            })
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  <label htmlFor="session-note">Заметка психотерапевта</label>
                  <textarea
                    id="session-note"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={5000}
                    placeholder="Что уточнить? Какие записи обсудить?"
                    rows={8}
                  />
                  <button
                    className="primary"
                    onClick={() => {
                      setNotes((s) => ({ ...s, [active.id]: draft }));
                      setToast("Демозаметка сохранена в этом браузере");
                    }}
                  >
                    Сохранить заметку <Check size={16} />
                  </button>
                  <span className="note-status" role="status">
                    {draft === (notes[active.id] || "")
                      ? "Все изменения сохранены"
                      : "Есть несохранённые изменения"}
                  </span>
                  <span className="private-note">
                    <LockKeyhole size={13} />
                    Локальная заметка для демонстрации
                  </span>
                  <div className="prep-principle">
                    <ShieldCheck size={22} />
                    <p>
                      Дневник помогает подготовить вопросы. Он не заменяет
                      разговор с человеком.
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
          <footer>
            <span className="footer-brand">рядом</span>
            <span>Кабинет психотерапевта</span>
            <span>Вымышленные данные · Не медицинское заключение</span>
          </footer>
        </div>
      </main>
      {modal === "report" && active && (
        <Popup
          title={`Сводка к встрече · ${active.id}`}
          close={() => setModal(null)}
        >
          <div className="print-report">
            <p className="report-label">РЯДОМ / КАБИНЕТ ПСИХОТЕРАПЕВТА</p>
            <h3>Пациент {active.id}</h3>
            <p>
              Демонстрационная история · 7–20 сентября 2026
              <br />
              Выбрано {period} дней; доступно {vals.length} отметок.
            </p>
            <div className="report-values">
              <span>
                Настроение <strong>{mean(vals)} / 10</strong>
              </span>
              <span>
                Сон <strong>{mean(sleeps)} ч</strong>
              </span>
              <span>
                Энергия{" "}
                <strong>{mean(active.energy.slice(-period))} / 10</strong>
              </span>
            </div>
            <h3>Последние записи пациента</h3>
            {active.texts.length ? (
              active.texts.map((t, i) => (
                <p key={i}>
                  <strong>{20 - i} сентября.</strong> {t}
                </p>
              ))
            ) : (
              <p>Пока нет записей.</p>
            )}
            <h3>Заметка психотерапевта</h3>
            <p className="report-note">
              {notes[active.id] || "Сохранённой заметки пока нет."}
            </p>
            {draft !== (notes[active.id] || "") && (
              <p className="report-unsaved">
                В сводке сохранённая версия заметки. Закройте окно и сохраните
                изменения, чтобы включить их.
              </p>
            )}
            <p className="footnote">
              Все данные вымышлены. Сводка не является медицинским заключением.
              Автоматические выводы о состоянии не формируются.
            </p>
          </div>
          <div className="modal-actions report-actions">
            <button className="secondary" onClick={report}>
              Данные JSON
            </button>
            <button className="primary" onClick={() => window.print()}>
              Печать / сохранить PDF <Download size={16} />
            </button>
          </div>
        </Popup>
      )}
      {modal === "invite" && (
        <Popup title="По приглашению пациента" close={() => setModal(null)}>
          <p>
            Пациент создаёт код в своём приложении и передаёт вам. Только после
            этого открывается его история.
          </p>
          <div className="info-box">
            Пока кабинеты не соединены с общей базой. Для показа используйте
            вымышленный код <strong>DEMO-048</strong>.
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim().toUpperCase() !== "DEMO-048") {
                setError("Демокод не найден. Используйте DEMO-048.");
                return;
              }
              setLinked(true);
              setModal(null);
              setTab("patients");
              setActive(null);
              setFilter("all");
              setQuery("");
              setToast(
                linked ? "Пациент уже в списке" : "Демоприглашение принято",
              );
            }}
          >
            <label className="field-label" htmlFor="patient-code">
              Код, выданный пациентом
            </label>
            <input
              id="patient-code"
              className="full-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="DEMO-048"
              required
            />
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button className="primary">
                Открыть доступ <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </Popup>
      )}
      {modal === "about" && (
        <Popup title="Один продукт. Две стороны." close={() => setModal(null)}>
          <p>
            <strong>Ваша часть — кабинет психотерапевта.</strong> Список
            пациентов, просмотр дневника и динамики, заметки и подготовка к
            встрече.
          </p>
          <p>
            <strong>Часть другой команды — приложение пациента и бот.</strong>{" "}
            Записи, напоминания, самонаблюдение, выдача и отзыв доступа.
          </p>
          <div className="info-box">
            Общий API и база соединят обе стороны. Сейчас здесь вымышленные
            профили, локальные заметки и симуляция приглашения. Настоящей
            авторизации и подключения к боту ещё нет.
          </div>
        </Popup>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
