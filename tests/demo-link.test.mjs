import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoLink, demoDay } from '../lib/demo-link.ts';
function bus() {
  const peers = new Set(); const queue = [];
  return {
    connect() {
      const peer = { receive() {} }; peers.add(peer);
      return { send: message => { for (const other of peers) if (other !== peer) queue.push(() => other.receive(structuredClone(message))); }, listen: receive => { peer.receive = receive; } };
    },
    flush() { let count = 0; while (queue.length) { assert.ok(++count < 100, 'messages must not echo forever'); queue.shift()(); } },
  };
}
const input = (date = demoDay(0), text = 'Учебная запись для показа') => ({ date, text, mood: 8, sleepHours: 8, energy: 7, revision: 0 });
test('a saved diary entry reaches the other tab and a newly opened/reloaded tab', () => {
  const b = bus(); const patient = createDemoLink(b.connect(), 'p'); const doctor = createDemoLink(b.connect(), 'd'); b.flush();
  patient.saveEntry(input()); b.flush();
  assert.equal(doctor.entries()[0].text, input().text);
  const reopened = createDemoLink(b.connect(), 'r'); b.flush();
  assert.deepEqual(reopened.entries(), patient.entries());
});
test('revocation survives a simultaneous diary save; later entries do not restore access', () => {
  const b = bus(); const p = createDemoLink(b.connect(), 'p'); const d = createDemoLink(b.connect(), 'd'); b.flush();
  p.revoke(); d.saveEntry(input()); b.flush();
  assert.equal(p.access().grantedAt, null); assert.equal(d.access().grantedAt, null);
  assert.deepEqual(d.entries(), p.entries());
});
test('independent dates survive simultaneous writes without losing either entry', () => {
  const b = bus(); const p = createDemoLink(b.connect(), 'p'); const d = createDemoLink(b.connect(), 'd'); b.flush();
  p.saveEntry(input()); d.saveEntry(input(demoDay(2), 'Вторая учебная запись')); b.flush();
  assert.equal(p.entries().length, 13); assert.deepEqual(d.entries(), p.entries());
});
test('a stale revision fails without changing the saved record', () => {
  const link = createDemoLink(); link.saveEntry(input());
  assert.throws(() => link.saveEntry(input()), /REVISION_CONFLICT/);
  assert.equal(link.entries()[0].revision, 1);
});
test('patient invitation reconnects the doctor once, cancellation and wrong email are rejected', () => {
  const b = bus(); const p = createDemoLink(b.connect(), 'p'); const d = createDemoLink(b.connect(), 'd'); b.flush();
  p.revoke(); const invitation = p.invite('specialist@example.test'); b.flush();
  d.accept(invitation.code); b.flush();
  assert.ok(p.access().grantedAt); assert.equal(p.access().invitation, null);
  assert.throws(() => d.accept(invitation.code), /INVITATION_UNAVAILABLE/);
  const next = p.invite('specialist@example.test'); p.cancelInvitation(); b.flush();
  assert.throws(() => d.accept(next.code), /INVITATION_UNAVAILABLE/);
  assert.throws(() => p.invite('someone@example.test'), /DEMO_SPECIALIST_ONLY/);
});
test('shared reset removes added entries and restores access in every peer', () => {
  const b = bus(); const p = createDemoLink(b.connect(), 'p'); const d = createDemoLink(b.connect(), 'd'); b.flush();
  p.saveEntry(input()); p.revoke(); b.flush(); d.reset(); b.flush();
  assert.equal(p.entries().some(e => e.date === demoDay(0)), false); assert.ok(p.access().grantedAt);
  assert.deepEqual(p.entries(), d.entries());
});
test('subscribers stop after unmount and returned data cannot mutate shared state', () => {
  const link = createDemoLink(); let calls = 0; const stop = link.subscribe(() => calls++);
  link.saveEntry(input()); stop(); link.revoke(); assert.equal(calls, 1);
  const history = link.entries(); history[0].text = 'accidental mutation'; assert.equal(link.entries()[0].text, input().text);
});
