export type Period = { from: string; to: string };
const dayMilliseconds = 86400000;
export function calendarDay(value: string) {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}
export function periodError(period: Period) {
  if (!calendarDay(period.from) || !calendarDay(period.to))
    return "Укажите две существующие даты.";
  if (period.from > period.to)
    return "Начало периода должно быть не позже окончания.";
  if (Date.parse(period.to) - Date.parse(period.from) > 365 * dayMilliseconds)
    return "Выберите не больше 366 календарных дней.";
  return "";
}
export const periodDays = (period: Period) =>
  Math.round(
    (Date.parse(period.to) - Date.parse(period.from)) / dayMilliseconds,
  ) + 1;
export function recentPeriod(days: number, now = new Date()): Period {
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const from = new Date(`${to}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - days + 1);
  return { from: from.toISOString().slice(0, 10), to };
}
