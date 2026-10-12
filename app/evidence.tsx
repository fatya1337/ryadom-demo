"use client";
import { useState } from "react";
const prefix = process.env.NEXT_PUBLIC_BASE_PATH || "";
const slides = [
  { tag: "ДНЕВНИК", title: "Запись сохранена на сервере.", file: "patient-desktop.jpg", alt: "Учебный дневник пациента: настроение, сон, энергия и статус сохранения на сервере", text: "Проверены сохранение записи, перезагрузка и получение той же записи специалистом с разрешением. Текст, настроение, сон и энергия читаются из общей базы.", note: "Снимок этапа проверки 12 октября; на экране вымышленные данные." },
  { tag: "ВСТРЕЧА", title: "История и личная подготовка.", file: "therapist-preparation.jpg", alt: "Кабинет специалиста с дневником, графиком, сохранённой личной заметкой и листом подготовки", text: "Специалист видит разрешённый дневник, сохраняет собственную заметку и список вопросов. Список подготовки и заметка не входят в выгрузку дневника.", note: "Снимок локального /live с API. Это не автономный режим showcase." },
  { tag: "АККАУНТ", title: "Контроль активных входов.", file: "doctor-sessions.jpg", alt: "Список активных входов в аккаунт специалиста с отметкой текущей сессии", text: "В обеих ролях можно завершить остальные входы. Проверено: текущая сессия остаётся, другая получает 401 при следующем запросе. Учебный черновик текущей вкладки сохраняется.", note: "Функция требует backend, поэтому в автономных кабинетах Pages её нет." },
];
export default function Evidence() {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  return <div className="tour-evidence">
    <div className="tour-slide-nav" role="group" aria-label="Снимки рабочего стенда">{slides.map((s,i)=><button key={s.tag} aria-pressed={i===index} onClick={()=>setIndex(i)}>{String(i+1).padStart(2,"0")} / {s.tag}</button>)}</div>
    <div className="tour-slide-copy" aria-live="polite"><div><span className="tour-label">{index+1} / {slides.length}</span><h3>{slide.title}</h3></div><p>{slide.text}</p></div>
    <a className="tour-screen" href={`${prefix}/evidence/${slide.file}`} target="_blank" rel="noreferrer" aria-label="Открыть полный снимок"><img key={slide.file} src={`${prefix}/evidence/${slide.file}`} alt={slide.alt} loading="lazy" /><span>Открыть полный снимок ↗</span></a>
    <p className="tour-small">{slide.note}</p>
  </div>;
}
