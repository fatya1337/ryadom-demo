"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ChecklistEditor, { type ChecklistInput } from "./checklist";
import type { createRyadomClient } from "./client";
export default function DayPlan({
  client,
  initialDate,
  onDirty,
  onError,
  demo = false,
}: {
  demo?: boolean;
  client: ReturnType<typeof createRyadomClient>;
  initialDate: string;
  onDirty: (value: boolean) => void;
  onError: (error: unknown) => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [dirty, setDirty] = useState(false);
  const [exporting, setExporting] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    onDirty(dirty || exporting);
    return () => onDirty(false);
  }, [dirty, exporting, onDirty]);
  const read = useCallback(() => client.plan(date), [client, date]);
  const write = useCallback(
    (input: ChecklistInput) => client.savePlan({ ...input, date }),
    [client, date],
  );
  function shiftDay(amount: number) {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + amount);
    const next = value.toISOString().slice(0, 10);
    if (/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(next)) setDate(next);
  }
  async function download() {
    setExporting(true);
    try {
      const data = await client.exportPlans(date, date);
      if (!mounted.current) return;
      const href = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = href;
      a.download = `ryadom-plan-${date}.json`;
      a.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      if (mounted.current) onError(error);
    } finally {
      if (mounted.current) setExporting(false);
    }
  }
  return (
    <section className="p-plan-sheet">
      <aside className="p-plan-margin">
        <span className="p-kicker">МОЙ РИТМ</span>
        <strong>{date.slice(-2)}</strong>
        <label>
          День плана
          <input
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            value={date}
            disabled={dirty || exporting}
            onChange={(e) => {
              if (e.target.value && e.target.validity.valid)
                setDate(e.target.value);
            }}
          />
        </label>
        <div className="p-plan-day-arrows">
          <button
            aria-label="Предыдущий день плана"
            disabled={dirty || exporting}
            onClick={() => shiftDay(-1)}
          >
            ← Раньше
          </button>
          <button
            aria-label="Следующий день плана"
            disabled={dirty || exporting}
            onClick={() => shiftDay(1)}
          >
            Дальше →
          </button>
        </div>
        <p>
          Небольшие намерения.
          <br />В вашем темпе.
        </p>
        <button disabled={dirty || exporting} onClick={() => void download()}>
          Скачать план дня · JSON ↗
        </button>
      </aside>
      <ChecklistEditor
        demo={demo}
        key={date}
        read={read}
        write={write}
        onDirty={setDirty}
        onError={onError}
        title="Место для простых дел."
        eyebrow="ПЛАН ДНЯ / ТОЛЬКО ДЛЯ ВАС"
        description="Вы сами выбираете, что добавить. План остаётся личным: доступ специалиста к дневнику его не открывает. Это список намерений, без напоминаний и назначений."
      />
    </section>
  );
}
