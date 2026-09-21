"use client";
import { useEffect, useState } from "react";
import {
  emptyPatient,
  loadPatient,
  savePatient,
  localDate,
  periodEntries,
  type PatientState,
} from "./patient-store";
const sections = [
  "Мой день",
  "История",
  "Динамика",
  "Ритм дня",
  "Мой специалист",
] as const;
const rhythm = [
  "Начать утро без спешки",
  "Найти время для еды",
  "Сделать паузу и отдохнуть",
  "Подготовиться ко сну",
];
const fmt = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
export default function Patient() {
  const [state, setState] = useState<PatientState>(emptyPatient);
  const [ready, setReady] = useState(false),
    [section, setSection] = useState(0),
    [period, setPeriod] = useState(14);
  const [today, setToday] = useState(""),
    [date, setDate] = useState("");
  const [text, setText] = useState(""),
    [mood, setMood] = useState(5),
    [sleep, setSleep] = useState(7),
    [energy, setEnergy] = useState(5);
  const [adult, setAdult] = useState(false),
    [accepted, setAccepted] = useState(false),
    [notice, setNotice] = useState(""),
    [failed, setFailed] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  useEffect(() => {
    const d = localDate();
    setToday(d);
    setDate(d);
    try {
      const loaded = loadPatient();
      setState(loaded);
      const entry = loaded.entries.find((e) => e.date === d);
      if (entry) {
        setText(entry.text);
        setMood(entry.mood);
        setSleep(entry.sleepHours);
        setEnergy(entry.energy);
      }
    } catch {
      setNotice(
        "Не удалось прочитать локальные данные. Обновите страницу или удалите данные демо ниже.",
      );
      setFailed(true);
    }
    setReady(true);
  }, []);
  function persist(next: PatientState) {
    try {
      savePatient(next);
      setState(next);
      setFailed(false);
      return true;
    } catch {
      setNotice(
        "Браузер не разрешил сохранить данные. Изменения не сохранены.",
      );
      return false;
    }
  }
  function loadDay(day: string) {
    setDate(day);
    const entry = state.entries.find((e) => e.date === day);
    setText(entry?.text || "");
    setMood(entry?.mood ?? 5);
    setSleep(entry?.sleepHours ?? 7);
    setEnergy(entry?.energy ?? 5);
  }
  const entries = periodEntries(state.entries, period, today);
  const average = (key: "mood" | "energy" | "sleepHours") =>
    entries.length
      ? (entries.reduce((s, e) => s + e[key], 0) / entries.length)
          .toFixed(1)
          .replace(".", ",")
      : "—";
  const download = () => {
    const data = {
      author_code: "P-DEMO",
      period_days: period,
      entries,
      notice: "Демо. Не медицинское заключение.",
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "ryadom-patient-summary.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const remove = () => {
    try {
      localStorage.removeItem("ryadom-patient-workspace-v1");
      setState(emptyPatient());
      setText("");
      setMood(5);
      setSleep(7);
      setEnergy(5);
      setAdult(false);
      setAccepted(false);
      setFailed(false);
      setDeleteOpen(false);
      setNotice("Локальные данные этого пациентского демо удалены.");
    } catch {
      setNotice("Не удалось удалить данные из браузера.");
    }
  };
  return (
    <div className="patient-workspace">
      <div className="workspace-return">
        <a href="#">← Выбрать пространство</a>
        <span>Демовход · без авторизации</span>
      </div>
      <main>
        <header className="masthead">
          <a className="brand" href="#">
            рядом<span className="brand-mark">↗</span>
          </a>
          <span className="masthead-note">
            Пространство
            <br />
            для себя.
          </span>
          <div className="header-right">
            <span className="demo-pill">ЛИЧНЫЙ ДНЕВНИК / ДЕМО</span>
            <span>Мой профиль / P-DEMO</span>
          </div>
        </header>
        <nav className="chapter-nav" aria-label="Разделы дневника">
          {sections.map((name, i) => (
            <button
              key={name}
              className={section === i ? "active" : ""}
              onClick={() => {
                setSection(i);
                setNotice("");
              }}
            >
              <span>0{i + 1}</span>
              {name}
            </button>
          ))}
        </nav>
        <div className="patient-content">
          <div className="patient-heading">
            <div>
              <div className="eyebrow">
                {today ? fmt(today).toUpperCase() : "МОЙ ДНЕВНИК"} / В СВОЁМ
                ТЕМПЕ
              </div>
              <h1>
                {
                  [
                    "Как вы",
                    "Сохранённые",
                    "Замечать",
                    "Небольшие",
                    "Вы решаете,",
                  ][section]
                }
                <br />
                <em>
                  {
                    [
                      "сегодня?",
                      "моменты.",
                      "изменения.",
                      "опоры.",
                      "с кем делиться.",
                    ][section]
                  }
                </em>
              </h1>
            </div>
            <p>
              {
                [
                  "Не обязательно подбирать идеальные слова. Можно начать с пары строк.",
                  "То, к чему можно вернуться. По одной записи на день — её можно дополнить.",
                  "Ваши самооценки за выбранный период. Без оценок и автоматических диагнозов.",
                  "Пример личного плана. Выбирайте то, что подходит вашему дню.",
                  "Дневник принадлежит вам. Связь со специалистом — по вашему решению.",
                ][section]
              }
            </p>
          </div>
          {!ready ? (
            <p role="status">Открываем дневник…</p>
          ) : !state.consent ? (
            <section className="patient-consent">
              <span className="mono">ПЕРЕД ПЕРВОЙ ЗАПИСЬЮ</span>
              <h2>Немного о вашем пространстве.</h2>
              <p>
                Это учебный прототип. Используйте вымышленные записи. Они
                сохраняются только в этом браузере и не отправляются специалисту
                или боту. Здесь нет диагностики и настоящей авторизации.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={adult}
                  onChange={(e) => setAdult(e.target.checked)}
                />{" "}
                Мне есть 18 лет
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />{" "}
                Я понимаю условия демонстрации и локального хранения
              </label>
              <button
                className="primary"
                disabled={!adult || !accepted || failed}
                onClick={() => {
                  if (
                    persist({
                      ...state,
                      consent: {
                        version: "patient-demo-1",
                        acceptedAt: new Date().toISOString(),
                        adult: true,
                      },
                    })
                  )
                    setNotice("Можно начать первую запись.");
                }}
              >
                Начать дневник ↗
              </button>
            </section>
          ) : (
            <>
              {section === 0 && (
                <div className="patient-journal">
                  <aside>
                    <span className="mono">01 / МОЯ ЗАПИСЬ</span>
                    <div className="journal-day">
                      {Number(date.slice(-2)) || "—"}
                    </div>
                    <p>{date && fmt(date).replace(/^\d+\s/, "")}</p>
                    <span className="patient-stamp">
                      Сегодня можно
                      <br />
                      просто быть.
                    </span>
                  </aside>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const entry = {
                        id:
                          state.entries.find((x) => x.date === date)?.id ||
                          crypto.randomUUID(),
                        date,
                        text: text.trim(),
                        mood,
                        sleepHours: sleep,
                        energy,
                      };
                      if (
                        persist({
                          ...state,
                          entries: [
                            ...state.entries.filter((x) => x.date !== date),
                            entry,
                          ],
                        })
                      )
                        setNotice("Запись сохранена в этом браузере.");
                    }}
                  >
                    <label className="patient-date">
                      Дата записи{" "}
                      <input
                        aria-label="Дата записи"
                        type="date"
                        required
                        max={today}
                        value={date}
                        onChange={(e) => loadDay(e.target.value)}
                      />
                    </label>
                    <label className="patient-text-label" htmlFor="day-note">
                      Что хочется оставить на страницах этого дня?
                    </label>
                    <textarea
                      id="day-note"
                      maxLength={5000}
                      rows={5}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Что происходило? Что запомнилось? О чём хочется поговорить…"
                    />
                    <div className="patient-metrics">
                      {[
                        {
                          name: "Настроение",
                          value: mood,
                          set: setMood,
                          min: 1,
                          max: 10,
                          step: 1,
                          unit: "/ 10",
                        },
                        {
                          name: "Сон",
                          value: sleep,
                          set: setSleep,
                          min: 0,
                          max: 24,
                          step: 0.5,
                          unit: "часов",
                        },
                        {
                          name: "Энергия",
                          value: energy,
                          set: setEnergy,
                          min: 1,
                          max: 10,
                          step: 1,
                          unit: "/ 10",
                        },
                      ].map((m) => (
                        <label key={m.name}>
                          <span>
                            {m.name}
                            <strong>
                              {m.value} <small>{m.unit}</small>
                            </strong>
                          </span>
                          <input
                            aria-label={m.name}
                            type="range"
                            min={m.min}
                            max={m.max}
                            step={m.step}
                            value={m.value}
                            onChange={(e) => m.set(Number(e.target.value))}
                          />
                          <small>
                            {m.min} — {m.max}{" "}
                            {m.name === "Сон" ? "часов" : "баллов"}
                          </small>
                        </label>
                      ))}
                    </div>
                    <div className="patient-form-end">
                      <span>Можно сохранить только отметки, без текста.</span>
                      <button
                        className="primary"
                        disabled={!date || date > today}
                      >
                        {state.entries.some((e) => e.date === date)
                          ? "Обновить запись"
                          : "Сохранить день"}{" "}
                        ↗
                      </button>
                    </div>
                  </form>
                </div>
              )}
              {section === 1 && (
                <section>
                  {state.entries.length ? (
                    [...state.entries]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((e) => (
                        <article className="patient-entry" key={e.id}>
                          <div>
                            <span className="mono">{fmt(e.date)}</span>
                            <p>
                              Настроение {e.mood}/10
                              <br />
                              Сон {e.sleepHours} ч · энергия {e.energy}/10
                            </p>
                          </div>
                          <p className="patient-entry-text">
                            {e.text || "В этот день сохранены только отметки."}
                          </p>
                          <button
                            className="text-button"
                            onClick={() => {
                              loadDay(e.date);
                              setSection(0);
                            }}
                          >
                            Дополнить ↗
                          </button>
                        </article>
                      ))
                  ) : (
                    <div className="patient-empty">
                      <h2>Первая страница ещё впереди.</h2>
                      <p>
                        Запишите пару слов о дне или сохраните свои отметки.
                      </p>
                      <button className="primary" onClick={() => setSection(0)}>
                        Начать запись ↗
                      </button>
                    </div>
                  )}
                </section>
              )}
              {section === 2 && (
                <section>
                  <div className="section-head">
                    <h2>Ваша динамика</h2>
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
                  <div className="case-measures">
                    <span>
                      Настроение<strong>{average("mood")} / 10</strong>
                    </span>
                    <span>
                      Сон<strong>{average("sleepHours")} ч</strong>
                    </span>
                    <span>
                      Энергия<strong>{average("energy")} / 10</strong>
                    </span>
                  </div>
                  {entries.length ? (
                    <>
                      <svg
                        className="patient-graph"
                        viewBox="0 0 800 220"
                        role="img"
                        aria-label={`Настроение за ${period} дней, ${entries.length} отметок`}
                      >
                        {[2, 4, 6, 8, 10].map((n) => (
                          <g key={n}>
                            <line
                              x1="32"
                              x2="780"
                              y1={200 - n * 18}
                              y2={200 - n * 18}
                              stroke="var(--line)"
                            />
                            <text
                              x="5"
                              y={205 - n * 18}
                              fill="var(--muted)"
                              fontSize="12"
                            >
                              {n}
                            </text>
                          </g>
                        ))}
                        {entries.map((e) => {
                          const ago = Math.round(
                            (new Date(`${today}T12:00:00`).getTime() -
                              new Date(`${e.date}T12:00:00`).getTime()) /
                              86400000,
                          );
                          return (
                            <circle
                              key={e.id}
                              cx={
                                40 + ((period - 1 - ago) / (period - 1)) * 730
                              }
                              cy={200 - e.mood * 18}
                              r="5"
                              fill="var(--blue)"
                            >
                              <title>
                                {fmt(e.date)}: {e.mood}/10
                              </title>
                            </circle>
                          );
                        })}
                      </svg>
                      <div className="graph-caption">
                        <span>
                          Каждая точка — день с записью. Пропуски не заполнены.
                        </span>
                        <span>
                          {entries.length} отметок / до {fmt(today)}
                        </span>
                      </div>
                      <button className="secondary" onClick={download}>
                        Скачать отметки за период ↓
                      </button>
                    </>
                  ) : (
                    <div className="patient-empty">
                      За этот период записей нет. Начните с одной отметки.
                    </div>
                  )}
                  <p className="footnote">
                    Показаны средние значения самооценок. Личная норма и
                    корреляции пока не рассчитываются.
                  </p>
                </section>
              )}
              {section === 3 && (
                <section className="patient-rhythm">
                  <p className="footnote">
                    Это пример списка для демо, не назначение специалиста.
                    Отметки сохраняются отдельно для каждого дня.
                  </p>
                  {rhythm.map((name, i) => (
                    <label key={name}>
                      <span className="mono">0{i + 1}</span>
                      <span>{name}</span>
                      <input
                        type="checkbox"
                        aria-label={name}
                        checked={(state.tasks[today] || []).includes(i)}
                        onChange={() => {
                          const tasks = state.tasks[today] || [];
                          persist({
                            ...state,
                            tasks: {
                              ...state.tasks,
                              [today]: tasks.includes(i)
                                ? tasks.filter((x) => x !== i)
                                : [...tasks, i],
                            },
                          });
                        }}
                      />
                    </label>
                  ))}
                </section>
              )}
              {section === 4 && (
                <section className="patient-access">
                  <span className="mono">ВЫ УПРАВЛЯЕТЕ ДОСТУПОМ</span>
                  <h2>
                    {state.sharing
                      ? "Демосогласие включено."
                      : "Сейчас дневник только у вас."}
                  </h2>
                  <p>
                    В общей платформе здесь появятся приглашение психотерапевта,
                    список подключённых специалистов и отзыв доступа. На этом
                    этапе команды работают с отдельными модулями: записи из
                    этого дневника ещё не появляются в кабинете психотерапевта.
                  </p>
                  <div className="info-box">
                    Переключатель ниже сохраняет только демонстрационное
                    намерение поделиться. Он никому не открывает ваши записи.
                  </div>
                  <button
                    className={state.sharing ? "secondary" : "primary"}
                    onClick={() => {
                      if (persist({ ...state, sharing: !state.sharing }))
                        setNotice(
                          state.sharing
                            ? "Демосогласие отключено."
                            : "Демосогласие сохранено локально.",
                        );
                    }}
                  >
                    {state.sharing
                      ? "Отключить демосогласие"
                      : "Попробовать согласие на доступ"}{" "}
                    ↗
                  </button>
                  <p className="footnote">
                    Telegram / MAX: интеграцию и проверку пользователя
                    подключает команда бота.
                  </p>
                </section>
              )}
            </>
          )}
          {notice && (
            <p className="patient-notice" role="status">
              {notice}
            </p>
          )}
          <footer className="portal-footer">
            <span>
              рядом / пространство пациента
              <br />
              Демо · не медицинское заключение
            </span>
            <button className="text-button" onClick={() => setDeleteOpen(true)}>
              Удалить данные этого демо
            </button>
          </footer>
          {deleteOpen && (
            <section
              className="patient-delete"
              aria-label="Подтверждение удаления"
            >
              <h2>Удалить локальный дневник?</h2>
              <p>
                Будут удалены записи, отметки ритма, согласия этого пациентского
                демо в текущем браузере. Это действие нельзя отменить.
              </p>
              <button
                className="secondary"
                onClick={() => setDeleteOpen(false)}
              >
                Оставить
              </button>{" "}
              <button className="primary" onClick={remove}>
                Удалить мой демодневник
              </button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
