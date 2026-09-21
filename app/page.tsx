"use client";
import { useEffect, useState } from "react";
import Therapist from "./therapist-workspace";
import Patient from "./patient-workspace";
import "./workspaces.css";
export default function Home() {
  const [space, setSpace] = useState("");
  useEffect(() => {
    const sync = () => setSpace(window.location.hash.slice(1));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  if (space === "patient") return <Patient />;
  if (space === "therapist")
    return (
      <>
        <div className="workspace-return">
          <a href="#">← Выбрать пространство</a>
          <span>Демовход · без авторизации</span>
        </div>
        <Therapist />
      </>
    );
  return (
    <main className="portal">
      <header className="masthead">
        <a className="brand" href="#">
          рядом<span className="brand-mark">↗</span>
        </a>
        <span className="masthead-note">
          Одна история.
          <br />
          Два пространства.
        </span>
        <span className="portal-edition mono">ДЕМОНСТРАЦИЯ / 03</span>
      </header>
      <section className="portal-intro">
        <div className="eyebrow">МЕЖДУ ВСТРЕЧАМИ / НА СВЯЗИ С СОБОЙ</div>
        <h1>
          Внимание к себе.
          <br />
          <em>Место для диалога.</em>
        </h1>
        <p>
          Сохранить то, что важно сегодня.
          <br />
          Вернуться к этому вместе на встрече.
        </p>
      </section>
      <div className="portal-roles">
        <a href="#patient" className="portal-role">
          <span className="mono">01 / ДЛЯ СЕБЯ</span>
          <h2>
            Я пациент <span>↗</span>
          </h2>
          <p>Дневник, настроение и маленькие опоры в течение дня.</p>
          <strong>Открыть мой дневник →</strong>
        </a>
        <a href="#therapist" className="portal-role">
          <span className="mono">02 / ДЛЯ ПРАКТИКИ</span>
          <h2>
            Я психотерапевт <span>↗</span>
          </h2>
          <p>Истории пациентов, наблюдения и подготовка к встречам.</p>
          <strong>Открыть кабинет →</strong>
        </a>
      </div>
      <footer className="portal-footer">
        <span>
          Два кабинета в общем дизайне. Доступ к дневнику определяет пациент.
        </span>
        <span>
          Прототип · только вымышленные данные
          <br />
          Выбор роли пока не является авторизацией.
        </span>
      </footer>
    </main>
  );
}
