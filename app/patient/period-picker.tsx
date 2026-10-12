"use client";
import { useEffect, useState } from "react";
import { periodDays, periodError, recentPeriod, type Period } from "./period";
export default function PeriodPicker({
  value,
  disabled,
  onApply,
}: {
  value: Period;
  disabled: boolean;
  onApply: (period: Period) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [custom, setCustom] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft(value);
    setError("");
  }, [value]);
  return (
    <div className="p-period-control">
      <div className="p-periods" aria-label="Период истории">
        {[7, 14, 30].map((days) => {
          const range = recentPeriod(days);
          return (
            <button
              key={days}
              disabled={disabled}
              aria-pressed={
                !custom && value.from === range.from && value.to === range.to
              }
              onClick={() => {
                setCustom(false);
                onApply(range);
              }}
            >
              {days} дней
            </button>
          );
        })}
        <button
          disabled={disabled}
          aria-pressed={custom}
          onClick={() => setCustom(!custom)}
        >
          Свои даты
        </button>
      </div>
      {custom && (
        <form
          className="p-custom-period"
          onSubmit={(e) => {
            e.preventDefault();
            if (disabled) return;
            const form = new FormData(e.currentTarget);
            const chosen = {
              from: String(form.get("from") || ""),
              to: String(form.get("to") || ""),
            };
            const invalid = periodError(chosen);
            setError(invalid);
            if (!invalid) {
              setDraft(chosen);
              onApply(chosen);
            }
          }}
        >
          <div>
            <label>
              С даты
              <input
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                required
                name="from"
                value={draft.from}
                disabled={disabled}
                onChange={(e) => {
                  setDraft({ ...draft, from: e.target.value });
                  setError("");
                }}
              />
            </label>
            <label>
              По дату включительно
              <input
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                required
                name="to"
                value={draft.to}
                disabled={disabled}
                onChange={(e) => {
                  setDraft({ ...draft, to: e.target.value });
                  setError("");
                }}
              />
            </label>
          </div>
          <button className="p-text-button" disabled={disabled}>
            Показать период ↗
          </button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
      <p className="p-period-caption">
        В истории и выгрузке — {periodDays(value)} календ. дн.{" "}
        {disabled ? "Сначала сохраните изменения или дождитесь загрузки." : ""}
      </p>
    </div>
  );
}
