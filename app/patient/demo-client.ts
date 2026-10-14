import { demoLink } from "../../lib/demo-link";
import { RyadomError, type createRyadomClient, type DiaryEntry, type DailyPlan } from "./client";

// Fictional demo adapter. Shared diary/access stay in memory across open demo tabs.
export function createPatientDemoClient() {
  const day = (offset: number) => {
    const n = new Date();
    const d = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
    d.setUTCDate(d.getUTCDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  const stamp = () => new Date().toISOString();
  const copy = <T,>(v: T): T => structuredClone(v);
  const plans = new Map<string, DailyPlan>([[day(0), { date: day(0), revision: 1, updatedAt: stamp(), items: [
    { id: "walk", text: "Небольшая прогулка", done: false },
    { id: "thought", text: "Записать мысль к следующей встрече", done: true },
  ] }]]);
  const profile = { id: "demo-patient", name: "Александра", email: "patient@example.test", role: "patient" as const,
    displayCode: "Р-014", requiredConsentVersion: "demo-only", consent: { version: "demo-only", adult: true, acceptedAt: stamp() } };
  const history = async (from: string, to: string) => {
    await demoLink().ready;
    return { patientCode: "Р-014", entries: demoLink().entries().filter(e => e.date >= from && e.date <= to) };
  };
  const adapt = <T,>(action: () => T): T => {
    try { return action(); }
    catch (error) { throw new RyadomError(error instanceof Error && error.message === "REVISION_CONFLICT" ? 409 : 400, error instanceof Error ? error.message : "INVALID_INPUT"); }
  };
  const unavailable = async (): Promise<never> => { throw new RyadomError(403, "DEMO_ONLY"); };
  const client: ReturnType<typeof createRyadomClient> = {
    signIn: unavailable, signOut: unavailable, patients: unavailable,
    preparation: unavailable, savePreparation: unavailable,
    sessions: unavailable, revokeOtherSessions: unavailable, deleteData: unavailable,
    me: async () => copy(profile), consent: async () => ({}),
    entries: async (from, to) => history(from, to),
    exportEntries: async (from, to) => history(from, to),
    saveEntry: async input => { await demoLink().ready; return adapt(() => demoLink().saveEntry(input)); },
    plan: async date => copy(plans.get(date) || { date, items: [], revision: 0, updatedAt: null }),
    savePlan: async input => {
      if ((plans.get(input.date)?.revision || 0) !== input.revision) throw new RyadomError(409, "REVISION_CONFLICT");
      const value = copy({ ...input, revision: input.revision + 1, updatedAt: stamp() });
      plans.set(input.date, value); return copy(value);
    },
    exportPlans: async (from, to) => copy({ plans: [...plans.values()].filter(p => p.date >= from && p.date <= to) }),
    invite: async doctorEmail => { await demoLink().ready; return adapt(() => demoLink().invite(doctorEmail)); },
    sharing: async () => {
      await demoLink().ready;
      const { grantedAt, invitation } = demoLink().access();
      return { grants: grantedAt ? [{ id: "demo-grant", grantedAt, revokedAt: null,
        doctor: { name: "Анна · учебный специалист", email: "specialist@example.test" } }] : [],
        invitations: invitation ? [invitation] : [] };
    },
    revoke: async () => { demoLink().revoke(); return { revoked: true }; },
    cancelInvitation: async () => { demoLink().cancelInvitation(); return { revoked: true }; },
    accessActivity: async () => ({ hasMore: false, events: [0, 1, 3].map((offset, i) => ({ id: `demo-event-${i}`,
      action: i === 1 ? "entries.exported" as const : "entries.read" as const,
      occurredAt: `${day(offset)}T09:00:00Z`, specialist: { name: "Учебный специалист", email: "specialist@example.test" } })) }),
  };
  return client;
}
