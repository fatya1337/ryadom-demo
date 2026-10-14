import { demoLink } from "../../lib/demo-link";
import type { Checklist } from "./checklist";
import {
  RequestError,
  type api,
  type Entry,
  type Note,
  type Patient,
} from "./api";

/** Demo adapter: shared R-014 diary/access, local specialist notes. No live API fallback. */
export function createDemoBackend() {
  const day = (offset: number) => {
    const now = new Date();
    const date = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
    );
    date.setUTCDate(date.getUTCDate() - offset);
    return date.toISOString().slice(0, 10);
  };
  const patients: Omit<Patient, "entryCount" | "latestEntryDate">[] = [
    { id: "demo-014", displayCode: "Р-014", grantedAt: day(28) },
    { id: "demo-027", displayCode: "Р-027", grantedAt: day(18) },
    { id: "demo-031", displayCode: "Р-031", grantedAt: day(0) },
  ];
  let invitationAccepted = false;
  const journal = [
    "После прогулки было проще собраться с мыслями. Вечером читала.",
    "День прошёл спокойно. Записала несколько мыслей для следующей встречи.",
    "Поздно закончила работу и долго не могла уснуть. Утром было трудно встать.",
    "Устроила перерыв без телефона. Хочу обсудить, как оставлять себе время на отдых.",
    "Встречалась с друзьями. К вечеру устала, решила лечь раньше.",
    "Сегодня получалось держаться привычного расписания. Сходила на прогулку.",
  ];
  const histories = new Map<string, Entry[]>(
    patients.map((p, person) => [
      p.id,
      person === 2
        ? []
        : [0, 1, 3, 4, 6, 8, 9, 11, 13, 16, 20, 24].map((offset, i) => ({
            id: `${p.id}-${i}`,
            date: day(offset),
            text: journal[(i + person) % journal.length],
            mood: [6, 5, 7, 4, 5, 6][(i + person) % 6],
            sleepHours: [7.5, 6, 8, 5.5, 7, 8.5][(i + person) % 6],
            energy: [6, 4, 7, 3, 5, 6][(i + person) % 6],
            revision: 1,
          })),
    ]),
  );
  const preparations = new Map<string, Checklist>();
  const notes = new Map<string, Note>();
  const revoked = new Set<string>();
  const history = (id: string) => id === "demo-014" ? demoLink().entries() : histories.get(id) || [];
  const allowed = (id: string) => id === "demo-014" ? !!demoLink().access().grantedAt : !revoked.has(id);
  const request: typeof api = async <T>(path: string, options = {}) => {
    await demoLink().ready;
    const opts = options as Parameters<typeof api>[1];
    if (opts?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (path === "v1/me")
      return {
        id: "demo-doctor",
        name: "Анна",
        role: "doctor",
      } as T;
    if (path === "v1/therapist/invitations/accept" && opts?.method === "POST") {
      const code = (opts.body as { code?: string })?.code;
      if (code?.toUpperCase() !== "DEMO-048") {
        try { demoLink().accept(code || ""); }
        catch { throw new RequestError(400, "INVITATION_UNAVAILABLE"); }
        return { patientCode: "Р-014" } as T;
      }
      if (code?.toUpperCase() !== "DEMO-048" || invitationAccepted)
        throw new RequestError(400, "INVITATION_UNAVAILABLE");
      invitationAccepted = true;
      const invited = { id: "demo-048", displayCode: "Р-048", grantedAt: day(0) };
      patients.push(invited);
      histories.set(invited.id, []);
      return { patientCode: invited.displayCode } as T;
    }
    if (path === "v1/therapist/patients")
      return patients
        .filter((p) => allowed(p.id))
        .map((p) => {
          const entries = history(p.id);
          return {
            ...p,
            grantedAt: p.id === "demo-014" ? demoLink().access().grantedAt! : p.grantedAt,
            entryCount: entries.length,
            latestEntryDate:
              entries
                .map((e) => e.date)
                .sort()
                .at(-1) ?? null,
          };
        }) as T;
    const url = new URL(path, "https://demo.invalid/");
    const match = url.pathname.match(
      /^\/v1\/therapist\/patients\/([^/]+)\/(entries|note|export|preparation)$/,
    );
    const patient = patients.find((p) => p.id === match?.[1]);
    if (!match || !patient || !allowed(patient.id))
      throw new RequestError(404, "NOT_FOUND");
    if (match[2] === "preparation") {
      const current = preparations.get(patient.id) || {
        items: [],
        revision: 0,
        updatedAt: null,
      };
      if (opts?.method === "PUT") {
        const body = opts.body as Pick<Checklist, "items" | "revision">;
        if (body.revision !== current.revision)
          throw new RequestError(409, "REVISION_CONFLICT");
        const next = {
          items: body.items.map((item) => ({ ...item })),
          revision: current.revision + 1,
          updatedAt: new Date().toISOString(),
        };
        preparations.set(patient.id, next);
        return next as T;
      }
      return current as T;
    }
    if (match[2] === "note") {
      const current = notes.get(patient.id) || {
        text: "",
        revision: 0,
        updatedAt: null,
      };
      if (opts?.method === "PUT") {
        const body = opts.body as { text: string; revision: number };
        if (body.revision !== current.revision)
          throw new RequestError(409, "REVISION_CONFLICT");
        const next = {
          text: body.text,
          revision: current.revision + 1,
          updatedAt: new Date().toISOString(),
        };
        notes.set(patient.id, next);
        return next as T;
      }
      return current as T;
    }
    const from = url.searchParams.get("from") || "",
      to = url.searchParams.get("to") || "9999";
    return {
      patientCode: patient.displayCode,
      entries: history(patient.id)
        .filter((e) => e.date >= from && e.date <= to),
    } as T;
  };
  return {
    request,
    subscribe: (listener: () => void) => demoLink().subscribe(listener),
    profile: (id: string) => {
      if (!allowed(id) || !patients.some(p => p.id === id)) return undefined;
      const names: Record<string, [string, string]> = {
        "demo-014": ["Александра", "АЛ"], "demo-027": ["Михаил", "МИ"],
        "demo-031": ["Дарья", "ДА"], "demo-048": ["Новый пациент", "НП"],
      };
      const [name, initials] = names[id] || [id, "—"];
      return { name, initials, entries: history(id).map(e => ({ ...e })) };
    },
    revoke: (id: string) => {
      if (id === "demo-014") demoLink().revoke();
      else revoked.add(id);
    },
    reset: () => {
      demoLink().reset();
      revoked.clear();
      invitationAccepted = false;
      const invitedIndex = patients.findIndex(p => p.id === "demo-048");
      if (invitedIndex >= 0) patients.splice(invitedIndex, 1);
      histories.delete("demo-048");
      notes.clear();
      preparations.clear();
    },
  };
}
