/** Patient team's boundary. Replace this local adapter with the agreed authenticated API. */
export type DiaryEntry = {
  id: string;
  date: string;
  text: string;
  mood: number;
  sleepHours: number;
  energy: number;
};
export type PatientState = {
  version: 1;
  consent: { version: string; acceptedAt: string; adult: true } | null;
  entries: DiaryEntry[];
  tasks: Record<string, number[]>;
  sharing: boolean;
};
export const PATIENT_KEY = "ryadom-patient-workspace-v1";
export const emptyPatient = (): PatientState => ({
  version: 1,
  consent: null,
  entries: [],
  tasks: {},
  sharing: false,
});
export function loadPatient(): PatientState {
  const raw = localStorage.getItem(PATIENT_KEY);
  if (!raw) return emptyPatient();
  const value = JSON.parse(raw);
  if (value.version !== 1 || !Array.isArray(value.entries) || !value.tasks)
    throw new Error("Unsupported patient data");
  return value;
}
export function savePatient(value: PatientState) {
  localStorage.setItem(PATIENT_KEY, JSON.stringify(value));
}
export function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function periodEntries(
  entries: DiaryEntry[],
  days: number,
  end: string,
) {
  const start = new Date(`${end}T12:00:00`);
  start.setDate(start.getDate() - days + 1);
  return entries
    .filter((e) => new Date(`${e.date}T12:00:00`) >= start && e.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
}
