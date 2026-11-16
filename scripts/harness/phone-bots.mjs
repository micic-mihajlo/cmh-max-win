import { ConvexClient } from 'convex/browser';
import { makeFunctionReference as F } from 'convex/server';
import { randomUUID } from 'node:crypto';

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const URL_ = flag('target') === 'dev' ? 'https://compassionate-puffin-914.convex.cloud' : flag('url', 'http://127.0.0.1:3210');
const CODE = flag('code');
const N = Number(flag('n', 5));
const SOLO_SOLVE_MS = Number(flag('solo-solve', 60000));
const NAMES = ['Theo', 'Priya', 'Ines', 'Mike', 'Lena', 'Omar', 'Zoe', 'Rui'];
const t0 = Date.now();
const log = (m) => console.log('[' + ((Date.now() - t0) / 1000).toFixed(1) + 's] ' + m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const bots = Array.from({ length: N }, (_, i) => ({ name: 'Bot ' + NAMES[i % NAMES.length], token: 'bot-' + randomUUID(), sid: randomUUID(), c: new ConvexClient(URL_, { unsavedChangesWarning: false }) }));
const { dropId } = await bots[0].c.mutation(F('drops:enterDropByCode'), { deviceToken: bots[0].token, code: CODE, name: bots[0].name });
for (const b of bots.slice(1)) await b.c.mutation(F('drops:enterDropByCode'), { deviceToken: b.token, code: CODE, name: b.name });
log(N + ' bots joined ' + CODE + ' (' + dropId + '). Waiting for the deal.');

await Promise.all(bots.map((b) => new Promise((res) => {
  const stop = b.c.onUpdate(F('drops:drop'), { deviceToken: b.token, dropId }, (v) => {
    if (v?.me?.squad && !b.code) { b.code = v.me.squad.code; b.label = v.me.squad.label; res(); }
  });
  b.stopDrop = stop;
})));
log('Dealt: ' + bots.map((b) => b.name + '→' + b.label).join(', '));
for (const b of bots) {
  const beat = () => b.c.mutation(F('presence:heartbeat'), { roomId: b.code, userId: b.token, sessionId: b.sid, interval: 10000 }).catch(() => {});
  beat(); b.hb = setInterval(beat, 10000);
  await b.c.mutation(F('signal:setPresence'), { deviceToken: b.token, code: b.code, presence: 'ready' }).catch((e) => log(b.name + ' ready failed ' + e.message));
}
const byCode = new Map();
for (const b of bots) { if (!byCode.has(b.code)) byCode.set(b.code, []); byCode.get(b.code).push(b); }
for (const [code, squad] of byCode) {
  const first = await squad[0].c.query(F('signal:room'), { deviceToken: squad[0].token, code });
  const humans = first.members.filter((m) => !m.name.startsWith('Bot '));
  if (!humans.length) {
    (async () => {
      await sleep(SOLO_SOLVE_MS);
      const r = await squad[0].c.mutation(F('signal:setTheory'), { deviceToken: squad[0].token, code, culprit: 'jun' });
      for (const b of squad) await b.c.mutation(F('signal:lockIn'), { deviceToken: b.token, code, revision: r.revision }).catch((e) => log(b.name + ' lock ' + e.message));
      log('All-bot squad ' + squad[0].label + ' solved.');
    })();
    continue;
  }
  log('Squad ' + squad[0].label + ' has ' + humans.map((h) => h.name).join(', ') + '; bots follow their lock-ins.');
  for (const b of squad) {
    b.c.onUpdate(F('signal:room'), { deviceToken: b.token, code }, async (v) => {
      if (!v || v.status !== 'playing' || !v.theory.culprit) return;
      const rev = v.theory.revision;
      const humanLocked = v.members.filter((m) => !m.name.startsWith('Bot ')).every((m) => v.lockIns.some((l) => l.memberId === m.memberId && l.revision === rev));
      const iLocked = v.lockIns.some((l) => l.memberId === v.me?.memberId && l.revision === rev);
      if (!humanLocked || iLocked || b.pending === rev) return;
      b.pending = rev;
      await sleep(800);
      const r = await b.c.mutation(F('signal:lockIn'), { deviceToken: b.token, code, revision: rev }).then((o) => JSON.stringify(o), (e) => 'error ' + (e.data?.code ?? e.message));
      log(b.name + ' locked ' + v.theory.culprit + ' rev ' + rev + ': ' + r);
    });
  }
}
await sleep(Number(flag('hold', 900000)));
process.exit(0);
