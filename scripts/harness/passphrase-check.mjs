import { ConvexClient } from 'convex/browser';
import { makeFunctionReference as F } from 'convex/server';
import { randomUUID } from 'node:crypto';

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const URL_ = flag('target') === 'dev' ? 'https://compassionate-puffin-914.convex.cloud' : flag('url', 'http://127.0.0.1:3210');
const PHONE_CODE = flag('code', null);
const N = Number(flag('n', 6));
const t0 = Date.now();
const log = (m) => console.log('[' + ((Date.now() - t0) / 1000).toFixed(1) + 's] ' + m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const err = (e) => e?.data?.code ? e.data.code + ': ' + e.data.message : String(e?.message ?? e).split('\n')[0];
const checks = [];
const check = (ok, what) => { checks.push({ ok: !!ok, what }); log((ok ? 'PASS ' : 'FAIL ') + what); };
const NAMES = ['Mike', 'Sarah', 'Chris', 'Ashley', 'Emily', 'Ryan', 'Megan', 'Josh'];

const host = { token: 'pp-host-' + randomUUID(), c: new ConvexClient(URL_, { unsavedChangesWarning: false }) };
let dropId, joinCode;
if (PHONE_CODE) {
  joinCode = PHONE_CODE;
} else {
  ({ dropId, joinCode } = await host.c.mutation(F('drops:hostDrop'), { deviceToken: host.token, title: 'Passphrase check', creatorName: 'PP Host', template: 'split-passphrase' }));
  log('Hosted passphrase drop ' + dropId + ' code ' + joinCode);
}
const bots = Array.from({ length: N }, (_, i) => ({ name: 'Bot ' + NAMES[i % NAMES.length], token: 'bot-' + randomUUID(), c: new ConvexClient(URL_, { unsavedChangesWarning: false }) }));
for (const b of bots) ({ dropId } = await b.c.mutation(F('drops:enterDropByCode'), { deviceToken: b.token, code: joinCode, name: b.name }));
log(N + ' bots joined');
if (!PHONE_CODE) await host.c.mutation(F('drops:dealSquads'), { deviceToken: host.token, dropId });
else log('Waiting for the host to deal');
await Promise.all(bots.map((b) => new Promise((res) => { b.c.onUpdate(F('drops:drop'), { deviceToken: b.token, dropId }, (v) => { if (v?.me?.squad && !b.code) { b.code = v.me.squad.code; res(); } }); })));
const squads = new Map();
for (const b of bots) { if (!squads.has(b.code)) squads.set(b.code, []); squads.get(b.code).push(b); }
log(squads.size + ' squads');
for (const b of bots) {
  const sid = randomUUID();
  const beat = () => b.c.mutation(F('presence:heartbeat'), { roomId: b.code, userId: b.token, sessionId: sid, interval: 10000 }).catch(() => {});
  beat();
  b.hb = setInterval(beat, 10000);
}

for (const [code, members] of squads) {
  const pieces = await Promise.all(members.map((b) => b.c.query(F('passphrase:piece'), { deviceToken: b.token, code })));
  const hasHuman = pieces[0].teammates.length > members.length;
  for (const [i, p] of pieces.entries()) {
    const others = pieces.filter((_, j) => j !== i).map((q) => q.word);
    const blob = JSON.stringify(p);
    check(p.word && !others.some((w) => w !== p.word && new RegExp('\\b' + w + '\\b').test(blob)), members[i].name + ' (' + p.squadLabel + ') sees only its own word "' + p.word + '" in slot ' + (p.position + 1) + ' of ' + p.slotCount);
  }
  members.pieces = pieces;
  members.hasHuman = hasHuman;
}
if (PHONE_CODE) {
  log('Phone squad bots: words ' + JSON.stringify([...squads.values()].map((m) => m.pieces.map((p) => [m[0].code, p.position, p.word]))));
  for (const [code, members] of squads) {
    if (!members.hasHuman) continue;
    for (const b of members) b.c.onUpdate(F('passphrase:piece'), { deviceToken: b.token, code }, async (v) => {
      const pr = v?.squad?.proposal;
      if (!pr || pr.confirmedByMe || b.busy === pr.revision) return;
      b.busy = pr.revision; await sleep(1000);
      const r = await b.c.mutation(F('passphrase:confirmPassphrase'), { deviceToken: b.token, code, revision: pr.revision }).then((o) => JSON.stringify(o), err);
      log(b.name + ' confirmed rev ' + pr.revision + ' (' + pr.words.join(' ') + '): ' + r);
    });
  }
  for (const [code, members] of squads) if (!members.hasHuman) (async () => {
    await sleep(45000);
    const answer = [...members.pieces].sort((a, b) => a.position - b.position).map((p) => p.word).join(' ');
    let r; for (const b of members) r = await b.c.mutation(F('passphrase:submitPassphrase'), { deviceToken: b.token, code, answer }).catch((e) => ({ error: err(e) }));
    log('All-bot squad ' + members.pieces[0].squadLabel + ' answered: ' + JSON.stringify(r));
  })();
  await sleep(Number(flag('hold', 900000)));
  process.exit(0);
}

const order = [...squads.entries()];
const [codeA, A] = order[0];
const answerA = [...A.pieces].sort((a, b) => a.position - b.position).map((p) => p.word);
const wrongA = [...answerA].reverse();
if (wrongA.join() === answerA.join()) wrongA[0] = 'zzz';
let r = await A[0].c.mutation(F('passphrase:submitPassphrase'), { deviceToken: A[0].token, code: codeA, answer: wrongA.join(' ') });
check(r.outcome === 'pending' && r.confirmed === 1, 'A wrong proposal waits for the squad (' + r.confirmed + '/' + r.needed + ')');
for (const b of A.slice(1)) r = await b.c.mutation(F('passphrase:confirmPassphrase'), { deviceToken: b.token, code: codeA, revision: r.revision });
check(r.outcome === 'wrong' && r.nudge?.text && r.cooldownUntil, 'Unanimous wrong answer: nudge "' + r.nudge?.text + '" (holder ' + r.nudge?.holderName + '), cooldown ' + Math.round((r.cooldownUntil - Date.now()) / 1000) + ' s');
const during = await A[0].c.mutation(F('passphrase:submitPassphrase'), { deviceToken: A[0].token, code: codeA, answer: answerA.join(' ') }).then(() => 'accepted', err);
check(during.startsWith('COOLDOWN'), 'A proposal during the cooldown is refused: ' + during);
const pv = await A[1].c.query(F('passphrase:piece'), { deviceToken: A[1].token, code: codeA });
check(pv.squad.status === 'cooldown' && pv.squad.lastNudge, 'Teammates see cooldown and the nudge');

for (const [code, members] of order.slice(1)) {
  const ans = [...members.pieces].sort((a, b) => a.position - b.position).map((p) => p.word).join(' ');
  let o; for (const b of members) o = await b.c.mutation(F('passphrase:submitPassphrase'), { deviceToken: b.token, code, answer: ans });
  check(o.outcome === 'correct' && o.place === 1, 'Squad ' + members.pieces[0].squadLabel + ' solves first: place ' + o.place);
}
await sleep(21000);
let o; for (const b of A) o = await b.c.mutation(F('passphrase:submitPassphrase'), { deviceToken: b.token, code: codeA, answer: answerA.join(' ') });
check(o.outcome === 'correct' && o.place === 2, 'After the cooldown the correct answer solves: place ' + o.place);
const lb = await A[0].c.query(F('drops:leaderboard'), { deviceToken: A[0].token, dropId });
check(lb.rows.filter((x) => x.rank !== null).length === squads.size, 'Leaderboard ranks every squad: ' + JSON.stringify(lb.rows.map((x) => [x.squadLabel, x.rank, x.status])));
for (const [code, members] of squads) {
  const a = await members[0].c.query(F('drops:myAward'), { deviceToken: members[0].token, code });
  check(a, 'Squad ' + members.pieces[0].squadLabel + ' winner reads its award: ' + JSON.stringify(a));
}
const outsider = await host.c.query(F('drops:myAward'), { deviceToken: host.token, code: codeA });
check(!outsider, 'The host (not a squad member) reads no award');
log((checks.every((c) => c.ok) ? 'ALL PASSED' : 'FAILED') + ' ' + checks.filter((c) => c.ok).length + '/' + checks.length);
for (const b of bots) clearInterval(b.hb);
process.exit(checks.every((c) => c.ok) ? 0 : 1);
