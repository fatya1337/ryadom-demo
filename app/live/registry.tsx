"use client";
import { ArrowUpRight, Plus, Search, ShieldCheck, RefreshCw } from "lucide-react";
import type { Patient, Entry } from "./api";

export type DemoProfile = { name: string; initials: string; entries: Entry[] };
const date = (value: string) => new Intl.DateTimeFormat("ru", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(value));
function Spark({ entries }: { entries: Entry[] }) {
  if (!entries.length) return <span className="registry-muted">Пока нет отметок</span>;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const last = Date.parse(sorted.at(-1)!.date), start = last - 13 * 86400000;
  const points = sorted.filter(e => Date.parse(e.date) >= start);
  const x = (e: Entry) => 5 + (Date.parse(e.date) - start) / (13 * 86400000) * 135;
  const y = (e: Entry) => 37 - (e.mood - 1) / 9 * 32;
  return <svg className="spark" viewBox="0 0 145 42" role="img" aria-label="Настроение за последние 14 дней с отметками. Пропуски не соединены.">
    {points.map((e, i) => <g key={e.id}>
      {i > 0 && Date.parse(e.date) - Date.parse(points[i - 1].date) === 86400000 && <line x1={x(points[i - 1])} y1={y(points[i - 1])} x2={x(e)} y2={y(e)} stroke="currentColor" strokeWidth="1.5" />}
      <circle cx={x(e)} cy={y(e)} r="2.5" fill="currentColor"><title>{date(e.date)}: {e.mood}/10</title></circle>
    </g>)}
  </svg>;
}

type Props = {
  patients: Patient[]; all: Patient[]; loading: boolean; busy: boolean;
  preparation: boolean; name: string; demo: boolean;
  query: string; onQuery: (v: string) => void;
  filter: "all" | "with" | "empty"; onFilter: (v: "all" | "with" | "empty") => void;
  sort: "latest" | "code"; onSort: (v: "latest" | "code") => void;
  profile?: (id: string) => DemoProfile | undefined;
  onOpen: (p: Patient) => void; onInvite: () => void; onRefresh: () => void;
};
export default function Registry(p: Props) {
  return <section className="registry-content">
    <div className="page-heading therapist-heading">
      <div><div className="eyebrow">ВАША ПРАКТИКА / {p.name}{p.demo ? " · УЧЕБНЫЕ ДАННЫЕ" : ""}</div>
        <h1>{p.preparation ? <>До встречи —<br /><em>всё важное рядом.</em></> : <>За каждой записью —<br /><em>человек.</em></>}</h1>
        <p>{p.preparation ? "История, личные заметки и вопросы к следующей встрече." : "Дневники пациентов и наблюдения между сессиями."}</p>
      </div>
      <button className="primary" disabled={p.busy} onClick={p.onInvite}>Ввести код пациента <Plus size={17} /></button>
    </div>
    <div className="practice-strip">
      <span><strong>{String(p.all.length).padStart(2, "0")}</strong>доступных дневников</span>
      <span><strong>{String(p.all.filter(x => x.entryCount > 0).length).padStart(2, "0")}</strong>дневников с записями</span>
      <div><ShieldCheck size={17} /><p>Доступ открывает пациент.<br />Вы видите то, чем он поделился.</p></div>
      <span className="practice-stamp">ВНИМАНИЕ<br />К ЧЕЛОВЕКУ ↗</span>
    </div>
    <div className="roster-tools">
      <div className="roster-filters" role="group" aria-label="Фильтр дневников">
        {([["all", "Все пациенты"], ["with", "С записями"], ["empty", "Пока пустые"]] as const).map(([value,label]) => <button key={value} aria-pressed={p.filter === value} className={p.filter === value ? "selected" : ""} onClick={() => p.onFilter(value)}>{label}</button>)}
      </div>
      <label className="patient-search"><Search size={15} /><input aria-label="Поиск пациента" value={p.query} onChange={e => p.onQuery(e.target.value)} placeholder={p.demo ? "Имя или код пациента" : "Код пациента"} type="search" /></label>
    </div>
    <div className="registry-order"><span role="status">{p.loading ? "Обновляем реестр…" : `Показано ${p.patients.length} из ${p.all.length}`}</span><label>Порядок <select value={p.sort} onChange={e => p.onSort(e.target.value as Props["sort"])}><option value="latest">По последней записи</option><option value="code">По коду пациента</option></select></label><button className="live-link" disabled={p.busy} onClick={p.onRefresh}><RefreshCw size={13} />Обновить</button></div>
    {p.preparation ? <div className="session-list">
      {p.patients.map((person,i) => <button key={person.id} onClick={() => p.onOpen(person)}><span className="session-number">{String(i + 1).padStart(2,"0")}</span><span><small>{person.displayCode} · {person.entryCount} записей</small><strong>{p.profile?.(person.id)?.name || person.displayCode}</strong><span>Дневник, заметка и темы для разговора</span></span><span className="session-action">Подготовиться <ArrowUpRight size={22} /></span></button>)}
      <p className="footnote">Лист подготовки принадлежит вам. Он не входит в выгрузку дневника. Расписание встреч пока не подключено.</p>
    </div> : <div className="roster unified-roster">
      <div className="roster-head"><span>ПАЦИЕНТ</span><span>ДНЕВНИК</span><span>НАСТРОЕНИЕ / ДИНАМИКА</span><span>ДОСТУП</span><span /></div>
      {p.patients.map(person => {
        const profile = p.profile?.(person.id);
        return <button className="roster-row" key={person.id} onClick={() => p.onOpen(person)}>
          <span className="person-cell"><span className="person-initials">{profile?.initials || person.displayCode.slice(-2)}</span><span><strong>{profile?.name || person.displayCode}</strong><small>{person.displayCode}{p.demo ? " · вымышленный профиль" : ""}</small></span></span>
          <span className="roster-records"><strong>{person.entryCount} записей</strong><small>{person.latestEntryDate ? `Последняя · ${date(person.latestEntryDate)}` : "История ещё не началась"}</small></span>
          <span className="registry-spark">{profile ? <Spark entries={profile.entries} /> : <span className="registry-muted">Открыть динамику ↗</span>}</span>
          <span className="session-cell"><span className="access-dot" />Доступ открыт<small>С {date(person.grantedAt)}</small></span><ArrowUpRight size={22} />
        </button>;
      })}
    </div>}
    {!p.patients.length && <div className="live-empty"><h3>{p.loading ? "Загружаем дневники…" : p.query || p.filter !== "all" ? "По этому запросу никого нет." : "Пока здесь чистый лист."}</h3><p>{p.query || p.filter !== "all" ? "Попробуйте изменить поиск или фильтр." : "Когда пациент передаст приглашение, его дневник появится здесь."}</p></div>}
    <div className="roster-bottom"><span>{p.demo ? "Все имена и записи вымышлены." : "В реестре только дневники с доступом для вас."}</span><span>Наблюдения ≠ диагноз</span></div>
  </section>;
}
