// SIGNAL drop load test: N simulated players join one hosted drop by code, the host deals, every squad solves,
// and the first winnerSlots squads get awards. Each player is its own ConvexClient (one WebSocket each, like a phone)
// with presence heartbeats. Reports p50/p95 for join, dealSquads and lockIn, plus every error.
//
//   node scripts/harness/drop-load.mjs --url http://127.0.0.1:3210 --n 100
//   node scripts/harness/drop-load.mjs --target dev --n 100 --out results.json
// Default shape mirrors the live room: joins spread over --ramp (180 s) with the last --burst share (40%) landing
// in the final --burst-window (10 s), one manual deal, squads racing with some wrong picks (20 s cooldown), awards.
// The host also watches hostView, and the harness reports how far its entrant count lags each join.
//
// Public mutations only (hostDrop, enterDropByCode, dealSquads, setPresence, setTheory, lockIn); no deploy, no admin.
// Players are named "Load · NNN" and tokens start with "load-", so test data is easy to find.
import { ConvexClient } from 'convex/browser';
import { makeFunctionReference as F } from 'convex/server';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const DEV_URL = 'https://compassionate-puffin-914.convex.cloud';
const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  if (i < 0) return dflt;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const URL_ = flag('target') === 'dev' ? DEV_URL : flag('url', 'http://127.0.0.1:3210');
const N = Number(flag('n', 100));
const RAMP_MS = Number(flag('ramp', 180_000));
const BURST = Number(flag('burst', 0.4));
const BURST_MS = Number(flag('burst-window', 10_000));
const COOLDOWN_MS = 20_000;
const WRONG_SHARE = Number(flag('wrong', 0.3));
const SOLVE_SPREAD_MS = Number(flag('spread', 30_000));
const OUT = flag('out', null);
const ANSWER = 'jun';
const WRONG = ['theo', 'priya', 'ines'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (m) => console.log('[' + ((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's] ' + m);
const errText = (e) => (e?.data?.code ? e.data.code + ': ' + e.data.message : String(e?.message ?? e).split('\n')[0]);
const pct = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};
const stats = (xs) => ({ n: xs.length, p50: pct(xs, 50), p95: pct(xs, 95), max: xs.length ? Math.round(Math.max(...xs)) : null });

const timings = { connect: [], join: [], hostViewLag: [], deal: [], squadSeen: [], setPresence: [], setTheory: [], lockIn: [], solveToBoard: [] };
const errors = [];
const note = (stage, who, e) => errors.push({ stage, who, error: errText(e), at: Date.now() - t0 });
async function timed(bucket, stage, who, fn) {
  const s = performance.now();
  try {
    const out = await fn();
    timings[bucket].push(performance.now() - s);
    return out;
  } catch (e) {
    note(stage, who, e);
    return undefined;
  }
}

function makeClient(name, token) {
  const c = new ConvexClient(URL_, { unsavedChangesWarning: false });
  return { name, token, c, sid: randomUUID(), hb: null, code: null };
}
function startBeats(p) {
  const beat = () => p.c.mutation(F('presence:heartbeat'), { roomId: p.code, userId: p.token, sessionId: p.sid, interval: 10_000 }).catch((e) => note('heartbeat', p.name, e));
  beat();
  p.hb = setInterval(beat, 10_000);
}

async function main() {
  log('Target ' + URL_ + ', ' + N + ' players, join ramp ' + RAMP_MS + ' ms.');
  const host = makeClient('Load Host', 'load-host-' + randomUUID());
  const { dropId, joinCode } = await host.c.mutation(F('drops:hostDrop'), { deviceToken: host.token, title: 'Load test ' + new Date().toISOString().slice(11, 19), creatorName: 'Load Host' });
  log('Hosted drop ' + dropId + ' code ' + joinCode + '.');

  const players = Array.from({ length: N }, (_, i) => makeClient('Load · ' + String(i + 1).padStart(3, '0'), 'load-' + randomUUID()));
  // Open every socket first (the crowd is already in the app), then join by code across the ramp window.
  await Promise.all(players.map((p) => timed('connect', 'connect', p.name, () => p.c.query(F('drops:listDrops'), {}))));
  const pendingJoins = [];
  let hostCount = 0;
  const unHost = host.c.onUpdate(F('drops:hostView'), { deviceToken: host.token, dropId }, (v) => {
    if (!v) return;
    const now = performance.now();
    for (let k = hostCount; k < v.entrantCount && pendingJoins.length; k++) timings.hostViewLag.push(now - pendingJoins.shift());
    hostCount = v.entrantCount;
  });
  const steady = Math.round(N * (1 - BURST));
  const joinAt = (i) => (i < steady ? ((RAMP_MS - BURST_MS) * i) / Math.max(1, steady) : RAMP_MS - BURST_MS + Math.random() * BURST_MS);
  await Promise.all(
    players.map(async (p, i) => {
      await sleep(joinAt(i));
      const ok = await timed('join', 'enterDropByCode', p.name, () => p.c.mutation(F('drops:enterDropByCode'), { deviceToken: p.token, code: joinCode, name: p.name }));
      if (ok) pendingJoins.push(performance.now());
    }),
  );
  await sleep(1500);
  unHost();
  const hv = await host.c.query(F('drops:hostView'), { deviceToken: host.token, dropId });
  log('Joined: host sees ' + hv.entrantCount + ' entrants (expected ' + N + ').');

  // Everyone watches their drop view to learn their squad, the way the app does.
  const squadOf = new Map();
  const seen = players.map(
    (p) =>
      new Promise((res) => {
        p.unsub = p.c.onUpdate(F('drops:drop'), { deviceToken: p.token, dropId }, (v) => {
          const s = v?.me?.squad;
          if (s && !squadOf.has(p)) {
            squadOf.set(p, s);
            res(performance.now());
          }
        });
      }),
  );
  const dealStart = performance.now();
  await timed('deal', 'dealSquads', host.name, () => host.c.mutation(F('drops:dealSquads'), { deviceToken: host.token, dropId }));
  const seenAt = await Promise.race([Promise.all(seen), sleep(30_000).then(() => null)]);
  if (seenAt) seenAt.forEach((t) => timings.squadSeen.push(t - dealStart));
  else note('squadSeen', '-', new Error('not every player saw a squad within 30 s (' + squadOf.size + '/' + N + ')'));
  log('Dealt: ' + squadOf.size + '/' + N + ' players see a squad.');

  const squads = new Map();
  for (const [p, s] of squadOf) {
    if (!squads.has(s.code)) squads.set(s.code, { code: s.code, label: s.label, members: [] });
    squads.get(s.code).members.push(p);
  }
  for (const p of players) if (squadOf.has(p)) { p.code = squadOf.get(p).code; startBeats(p); }
  log(squads.size + ' squads: sizes ' + JSON.stringify(Object.entries([...squads.values()].reduce((a, s) => ((a[s.members.length] = (a[s.members.length] ?? 0) + 1), a), {}))));

  // Intro: everyone taps ready.
  await Promise.all([...squads.values()].flatMap((s) => s.members.map((p) => timed('setPresence', 'setPresence', p.name, () => p.c.mutation(F('signal:setPresence'), { deviceToken: p.token, code: s.code, presence: 'ready' })))));

  // Play: each squad solves at a random moment in the spread; some lock a wrong pick first.
  const solvedAt = new Map();
  const board = new Promise((res) => {
    let stop = () => {};
    stop = host.c.onUpdate(F('drops:leaderboard'), { deviceToken: host.token, dropId }, (b) => {
      for (const r of b?.rows ?? []) if (r.rank !== null && solvedAt.has(r.squadLabel) && !solvedAt.get(r.squadLabel).boardAt) solvedAt.get(r.squadLabel).boardAt = performance.now();
      if (b && b.rows.length && b.rows.every((r) => r.rank !== null)) { queueMicrotask(() => stop()); res(b); }
    });
  });
  const lockAll = async (s, culprit) => {
    const first = s.members[0];
    const r = await timed('setTheory', 'setTheory', first.name, () => first.c.mutation(F('signal:setTheory'), { deviceToken: first.token, code: s.code, culprit }));
    if (!r) return null;
    const outs = await Promise.all(s.members.map((p) => timed('lockIn', 'lockIn', p.name, () => p.c.mutation(F('signal:lockIn'), { deviceToken: p.token, code: s.code, revision: r.revision }))));
    return outs.find((o) => o && o.outcome !== 'locked') ?? null;
  };
  await Promise.all(
    [...squads.values()].map(async (s) => {
      await sleep(Math.random() * SOLVE_SPREAD_MS);
      if (Math.random() < WRONG_SHARE) {
        const w = await lockAll(s, WRONG[Math.floor(Math.random() * WRONG.length)]);
        if (w && w.outcome !== 'wrong') note('wrongPick', s.label, new Error('expected wrong, got ' + w.outcome));
        await sleep(COOLDOWN_MS + 1000);
      }
      solvedAt.set(s.label, { at: performance.now() });
      const ok = await lockAll(s, ANSWER);
      if (!ok || ok.outcome !== 'resolved') note('solve', s.label, new Error('expected resolved, got ' + JSON.stringify(ok)));
    }),
  );
  const finalBoard = await Promise.race([board, sleep(15_000).then(() => null)]);
  for (const v of solvedAt.values()) if (v.boardAt) timings.solveToBoard.push(v.boardAt - v.at);

  // Awards: exactly the first winnerSlots squads hold one; every member of those squads can read it.
  const lb = finalBoard ?? (await host.c.query(F('drops:leaderboard'), { deviceToken: host.token, dropId }));
  const winners = lb.rows.filter((r) => r.status === 'winner');
  let awardHolders = 0;
  let awardLeaks = 0;
  for (const s of squads.values()) {
    const a = await s.members[0].c.query(F('drops:myAward'), { deviceToken: s.members[0].token, code: s.code });
    const isWinner = winners.some((w) => w.squadLabel === s.label);
    if (a && isWinner) awardHolders++;
    if (a && !isWinner) awardLeaks++;
    if (!a && isWinner) note('award', s.label, new Error('winner squad has no award'));
  }
  const outsider = await host.c.query(F('drops:myAward'), { deviceToken: host.token, code: [...squads.values()][0].code });
  if (outsider) awardLeaks++;

  const result = {
    target: URL_, n: N, dropId, joinCode, squads: squads.size, unmatched: N - squadOf.size,
    solved: lb.rows.filter((r) => r.rank !== null).length, winners: winners.length, winnerSlots: lb.winnerSlots, awardHolders, awardLeaks,
    ms: Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, stats(v)])),
    errors: errors.length, errorsByStage: errors.reduce((a, e) => ((a[e.stage + ' ' + e.error] = (a[e.stage + ' ' + e.error] ?? 0) + 1), a), {}),
    wallMs: Date.now() - t0,
  };
  console.log(JSON.stringify(result, null, 2));
  if (OUT) writeFileSync(OUT, JSON.stringify({ ...result, errorList: errors }, null, 2));
  for (const p of players) { clearInterval(p.hb); p.unsub?.(); }
  await Promise.all([host, ...players].map((p) => p.c.close().catch(() => {})));
  process.exit(errors.length || awardLeaks || result.unmatched > 2 ? 1 : 0);
}

main().catch((e) => {
  console.error('drop-load: ' + errText(e));
  process.exit(2);
});
