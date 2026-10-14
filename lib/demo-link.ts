import type { DiaryEntry, EntryInput } from "../app/patient/client";

// Public demonstration only. No auth, network requests or persistent browser storage.
// Registers merge independently, so an entry update cannot undo an access revocation.
type Version = [number, string];
type Register<T> = { version: Version; value: T };
type Invitation = { id: string; code: string; doctorEmail: string; expiresAt: string };
type Access = { grantedAt: string | null; invitation: Invitation | null };
type Snapshot = { epoch: Version; entries: Record<string, Register<DiaryEntry>>; access: Register<Access> };
type Message = { kind: "hello" } | { kind: "state"; state: Snapshot };
export type DemoTransport = { send: (message: Message) => void; listen: (receive: (message: Message) => void) => void };
const clone = <T,>(value: T): T => structuredClone(value);
const newer = (a: Version, b: Version) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
export const demoDay = (offset: number) => {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
};
function seed(epoch: Version = [0, ""]): Snapshot {
  const texts = ["После прогулки было проще собраться с мыслями. Вечером читала.", "День прошёл спокойно. Записала несколько мыслей для следующей встречи.", "Поздно закончила работу. Утром было трудно встать.", "Устроила перерыв без телефона. Хочу обсудить время на отдых."];
  return {
    epoch,
    entries: Object.fromEntries([1, 3, 4, 6, 8, 9, 11, 13, 16, 20, 24].map((offset, i) => {
      const date = demoDay(offset);
      return [date, { version: [0, ""], value: { id: `demo-014-${date}`, date,
        text: texts[i % 4], mood: [6, 5, 7, 4][i % 4], energy: [6, 4, 7, 3][i % 4],
        sleepHours: [7.5, 6, 8, 5.5][i % 4], revision: 1, updatedAt: `${date}T12:00:00Z` } }];
    })),
    access: { version: [0, ""], value: { grantedAt: `${demoDay(28)}T12:00:00Z`, invitation: null } },
  };
}

export function createDemoLink(transport?: DemoTransport, id = crypto.randomUUID()) {
  let state = seed();
  let clock = 0;
  const listeners = new Set<() => void>();
  const version = (): Version => [++clock, id];
  const notify = () => listeners.forEach(listener => listener());
  const publish = () => { transport?.send({ kind: "state", state: clone(state) }); notify(); };
  transport?.listen(message => {
    if (message.kind === "hello") {
      transport.send({ kind: "state", state: clone(state) });
      return;
    }
    if (message.kind !== "state") return;
    const incoming = message.state;
    clock = Math.max(clock, incoming.epoch[0], incoming.access.version[0], ...Object.values(incoming.entries).map(e => e.version[0]));
    if (newer(state.epoch, incoming.epoch)) return;
    let changed = false;
    if (newer(incoming.epoch, state.epoch)) { state = clone(incoming); changed = true; }
    else {
      for (const [date, entry] of Object.entries(incoming.entries)) {
        if (!state.entries[date] || newer(entry.version, state.entries[date].version)) {
          state.entries[date] = clone(entry); changed = true;
        }
      }
      if (newer(incoming.access.version, state.access.version)) { state.access = clone(incoming.access); changed = true; }
    }
    if (changed) notify();
  });
  transport?.send({ kind: "hello" });
  return {
    ready: transport ? new Promise<void>(resolve => setTimeout(resolve, 160)) : Promise.resolve(),
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    resync() { transport?.send({ kind: "hello" }); },
    entries: () => clone(Object.values(state.entries).map(e => e.value).sort((a, b) => b.date.localeCompare(a.date))),
    access: () => clone(state.access.value),
    saveEntry(input: EntryInput) {
      const old = state.entries[input.date]?.value;
      if ((old?.revision || 0) !== input.revision) throw new Error("REVISION_CONFLICT");
      const entry = { ...clone(input), id: old?.id || `demo-014-${input.date}`, revision: input.revision + 1, updatedAt: new Date().toISOString() };
      state.entries[input.date] = { version: version(), value: entry };
      publish(); return clone(entry);
    },
    invite(email: string) {
      if (email.trim().toLowerCase() !== "specialist@example.test") throw new Error("DEMO_SPECIALIST_ONLY");
      const token = crypto.randomUUID();
      const invitation = { id: token, code: `DEMO-${token.slice(0, 8).toUpperCase()}`, doctorEmail: "specialist@example.test", expiresAt: new Date(Date.now() + 86400000).toISOString() };
      state.access = { version: version(), value: { ...state.access.value, invitation } };
      publish(); return clone(invitation);
    },
    accept(code: string) {
      const invitation = state.access.value.invitation;
      if (!invitation || invitation.code !== code.trim().toUpperCase() || Date.parse(invitation.expiresAt) <= Date.now()) throw new Error("INVITATION_UNAVAILABLE");
      state.access = { version: version(), value: { grantedAt: new Date().toISOString(), invitation: null } };
      publish();
    },
    revoke() {
      state.access = { version: version(), value: { grantedAt: null, invitation: null } };
      publish();
    },
    cancelInvitation() {
      state.access = { version: version(), value: { ...state.access.value, invitation: null } };
      publish();
    },
    reset() { state = seed(version()); publish(); },
  };
}

let singleton: ReturnType<typeof createDemoLink> | undefined;
export function demoLink() {
  if (typeof window === "undefined") throw new Error("Demo state is browser-only");
  if (!singleton) {
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("ryadom-pages-linked-demo-v1") : null;
    singleton = createDemoLink(channel ? {
      send: message => channel.postMessage(message),
      listen: receive => { channel.onmessage = event => receive(event.data); },
    } : undefined);
    window.addEventListener("focus", () => singleton?.resync());
    window.addEventListener("pageshow", () => singleton?.resync());
  }
  return singleton;
}
