import { RyadomError, type createRyadomClient, type DiaryEntry, type DailyPlan } from "./client";

// Isolated, fictional browser-memory data. No fetch, cookies or persistent storage.
export function createPatientDemoClient() {
  const day = (offset: number) => {
    const n = new Date();
    const d = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
    d.setUTCDate(d.getUTCDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  const stamp = () => new Date().toISOString();
  const copy = <T,>(v: T): T => structuredClone(v);
  const texts = ["После прогулки стало легче собраться с мыслями. Вечером читала.", "Спокойный день. Хочу обсудить привычный режим на следующей встрече.", "Поздно закончила работу. Утром было трудно встать.", "Сделала перерыв без телефона и встретилась с друзьями."];
  const entries: DiaryEntry[] = [0, 1, 3, 4, 6, 8, 9, 12, 16, 20].map((offset, i) => ({
    id: `demo-entry-${i}`, date: day(offset), text: texts[i % texts.length],
    mood: [6, 5, 7, 4][i % 4], energy: [5, 6, 7, 4][i % 4],
    sleepHours: [7.5, 8, 6, 7][i % 4], revision: 1, updatedAt: stamp(),
  }));
  const plans = new Map<string, DailyPlan>([[day(0), { date: day(0), revision: 1, updatedAt: stamp(), items: [
    { id: "walk", text: "Небольшая прогулка", done: false },
    { id: "thought", text: "Записать мысль к следующей встрече", done: true },
  ] }]]);
  const profile = { id: "demo-patient", name: "Учебный пациент", email: "patient@example.test", role: "patient" as const,
    displayCode: "Р-014", requiredConsentVersion: "demo-only", consent: { version: "demo-only", adult: true, acceptedAt: stamp() } };
  let revoked = false;
  let invitations: { id: string; doctorEmail: string; expiresAt: string }[] = [];
  const history = (from: string, to: string) => copy({ patientCode: "Р-014", entries: entries.filter(e => e.date >= from && e.date <= to) });
  const unavailable = async (): Promise<never> => { throw new RyadomError(403, "DEMO_ONLY"); };
  const client: ReturnType<typeof createRyadomClient> = {
    signIn: unavailable, signOut: unavailable, patients: unavailable,
    preparation: unavailable, savePreparation: unavailable,
    sessions: unavailable, revokeOtherSessions: unavailable, deleteData: unavailable,
    me: async () => copy(profile), consent: async () => ({}),
    entries: async (from, to) => history(from, to),
    exportEntries: async (from, to) => history(from, to),
    saveEntry: async input => {
      const old = entries.find(e => e.date === input.date);
      if ((old?.revision || 0) !== input.revision) throw new RyadomError(409, "REVISION_CONFLICT");
      const next = { ...input, id: old?.id || `demo-${input.date}`, revision: input.revision + 1, updatedAt: stamp() };
      if (old) entries.splice(entries.indexOf(old), 1, next); else entries.push(next);
      return copy(next);
    },
    plan: async date => copy(plans.get(date) || { date, items: [], revision: 0, updatedAt: null }),
    savePlan: async input => {
      if ((plans.get(input.date)?.revision || 0) !== input.revision) throw new RyadomError(409, "REVISION_CONFLICT");
      const value = copy({ ...input, revision: input.revision + 1, updatedAt: stamp() });
      plans.set(input.date, value); return copy(value);
    },
    exportPlans: async (from, to) => copy({ plans: [...plans.values()].filter(p => p.date >= from && p.date <= to) }),
    invite: async doctorEmail => {
      const value = { id: "demo-invitation", doctorEmail, expiresAt: new Date(Date.now() + 86400000).toISOString() };
      invitations = [value]; return { ...value, code: "DEMO-ONLY-NO-REAL-ACCESS" };
    },
    sharing: async () => copy({ grants: revoked ? [] : [{ id: "demo-grant", grantedAt: `${day(14)}T12:00:00Z`, revokedAt: null,
      doctor: { name: "Учебный специалист", email: "specialist@example.test" } }], invitations }),
    revoke: async () => { revoked = true; invitations = []; return { revoked: true }; },
    cancelInvitation: async () => { invitations = []; return { revoked: true }; },
    accessActivity: async () => ({ hasMore: false, events: [0, 1, 3].map((offset, i) => ({ id: `demo-event-${i}`,
      action: i === 1 ? "entries.exported" as const : "entries.read" as const,
      occurredAt: `${day(offset)}T09:00:00Z`, specialist: { name: "Учебный специалист", email: "specialist@example.test" } })) }),
  };
  return client;
}
