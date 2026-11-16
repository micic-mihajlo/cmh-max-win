// SIGNAL room pulse load test (CAP-82): N players join one Quick Quiz challenge by code, the host starts it and
// every player subscribes to the pulse like the app does. Each question, every player locks their own answer inside
// --spread ms (150 locks from 50 teams in one second by default), and the harness reports how long each lock takes to
// show as lockedCount on every subscriber's pulse, how long a team's last lock takes to show as lockedAt, advance and
// reveal visibility, lock mutation round-trips and every error. It also checks that no pulse carries per-team
// correctness before a question is revealed.
//
//   node scripts/harness/pulse-load.mjs --url http://127.0.0.1:3210 --n 150 --team 3
//   node scripts/harness/pulse-load.mjs --n 150 --team 3 --questions 3 --spread 1000 --out pulse.json
//   node scripts/harness/pulse-load.mjs --path direct   # every device subscribes to live:roomPulse itself
//
// Public functions only (saveCreatorProfile, createChallenge, publishChallenge, joinChallenge, startLive,
// runHostAction, playerAction, roomPulseKey, roomPulseShared, roomPulse); no deploy, no admin. Tokens start with "load-".
// Run it against a local backend: a 4-core machine that also hosts the 151 clients saturates the backend's CPU.
import { ConvexClient } from 'convex/browser';
import { makeFunctionReference as F } from 'convex/server';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  if (i < 0) return dflt;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const URL_ = flag('url', 'http://127.0.0.1:3210');
const N = Number(flag('n', 150));
const TEAM = Number(flag('team', 3));
const QUESTIONS = Number(flag('questions', 3));
const SPREAD_MS = Number(flag('spread', 1000));
const JOIN_RAMP_MS = Number(flag('ramp', 5000));
const OUT = flag('out', null);
const PATH = flag('path', 'shared'); // shared: useRoomPulse's key + shared queries; direct: live:roomPulse per device
const NAMES = ['Danny', 'Kayla', 'Marcus', 'Jess', 'Mike', 'Sarah', 'Chris', 'Ashley', 'Tyler', 'Megan', 'Josh', 'Brittany'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = performance.now();
const log = (m) => console.log('[' + ((performance.now() - t0) / 1000).toFixed(1).padStart(6) + 's] ' + m);
const errText = (e) => (e?.data?.code ? e.data.code + ': ' + e.data.message : String(e?.message ?? e).split('\n')[0]);
const pct = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};
const stats = (xs) => ({ n: xs.length, p50: pct(xs, 50), p95: pct(xs, 95), p99: pct(xs, 99), max: xs.length ? Math.round(Math.max(...xs)) : null });

const timings = { join: [], advanceSeen: [], lockMutation: [], lockSeen: [], teamLockedSeen: [], lockSeenLast: [], revealSeen: [] };
const errors = [];
const leaks = [];
const note = (stage, who, e) => errors.push({ stage, who, error: errText(e), at: Math.round(performance.now() - t0) });

// Resolves once every subscriber's latest pulse passes test, or after timeoutMs with the ones still waiting.
function waitAll(subs, test, timeoutMs = 20_000) {
  return new Promise((res) => {
    const started = performance.now();
    const tick = () => {
      const waiting = subs.filter((s) => !s.pulse || !test(s.pulse));
      if (!waiting.length || performance.now() - started > timeoutMs) return res(waiting.length);
      setTimeout(tick, 5);
    };
    tick();
  });
}

async function main() {
  const QUIZ = {
    questions: Array.from({ length: Math.max(3, QUESTIONS) }, (_, i) => ({ prompt: 'Load question ' + (i + 1), choices: ['North', 'South', 'East', 'West'], correct: i % 4, timeLimitMs: 30_000 })),
  };
  log('Target ' + URL_ + ' (' + PATH + ' path), ' + N + ' players in teams of ' + TEAM + ', ' + QUESTIONS + ' questions, locks spread over ' + SPREAD_MS + ' ms.');
  const host = { token: 'load-host-' + randomUUID(), c: new ConvexClient(URL_, { unsavedChangesWarning: false }) };
  await host.c.mutation(F('challenges:saveCreatorProfile'), { deviceToken: host.token, displayName: 'Load Host', handle: '@loadhost' + Math.floor(Math.random() * 1e6) });
  const { challengeId } = await host.c.mutation(F('challenges:createChallenge'), {
    deviceToken: host.token,
    patch: { title: 'Pulse load ' + new Date().toISOString().slice(11, 19), templateId: 'quick-quiz', teamSize: TEAM, templateConfig: QUIZ, poolCents: 10_000 },
  });
  const { joinCode } = await host.c.mutation(F('challenges:publishChallenge'), { deviceToken: host.token, challengeId });
  log('Published quiz ' + challengeId + ' code ' + joinCode + '.');

  const players = Array.from({ length: N }, (_, i) => ({
    name: NAMES[i % NAMES.length] + ' ' + String(i + 1).padStart(3, '0'),
    token: 'load-' + randomUUID(),
    c: new ConvexClient(URL_, { unsavedChangesWarning: false }),
    pulse: null,
    seen: new Map(), // questionIndex:teamId -> first time this subscriber saw the team locked
    counted: new Map(), // questionIndex:teamId -> how many of the team's locks this subscriber has seen
  }));
  await Promise.all(
    players.map(async (p, i) => {
      await sleep((JOIN_RAMP_MS * i) / N);
      const s = performance.now();
      try {
        await p.c.action(F('challenges:joinChallenge'), { deviceToken: p.token, code: joinCode, name: p.name });
        timings.join.push(performance.now() - s);
        p.joinedOk = true;
      } catch (e) {
        note('join', p.name, e);
      }
    }),
  );

  // Every player and the host subscribe to the pulse.
  const lockSends = new Map(); // questionIndex:teamId -> send times of the team's locks, in send order
  // Only players whose join landed subscribe and lock; a failed join is already counted as an error.
  const seated = players.filter((p) => p.joinedOk);
  const subs = [...seated, host];
  host.seen = new Map();
  host.counted = new Map();
  const onError = (s) => (e) => note('subscribe', s.name ?? 'host', e);
  for (const s of subs) {
    const onPulse = (pulse) => {
        const now = performance.now();
        s.pulse = pulse;
        if (!pulse) return;
        if (pulse.phase === 'question' && pulse.teams.some((t) => t.correct !== null)) leaks.push({ who: s.name ?? 'host', questionIndex: pulse.questionIndex });
        for (const t of pulse.teams) {
          const key = pulse.questionIndex + ':' + t.id;
          const sends = lockSends.get(key);
          if (!sends) continue;
          const counted = s.counted.get(key) ?? 0;
          const visible = Math.min(t.lockedCount ?? 0, sends.length);
          for (let k = counted; k < visible; k++) timings.lockSeen.push(now - sends[k]);
          if (visible > counted) s.counted.set(key, visible);
          if (t.lockedAt !== null && !s.seen.has(key)) {
            s.seen.set(key, now);
            timings.teamLockedSeen.push(now - sends[sends.length - 1]);
          }
        }
    };
    if (PATH === 'direct') {
      s.unsub = s.c.onUpdate(F('live:roomPulse'), { code: joinCode, deviceToken: s.token }, onPulse, onError(s));
      continue;
    }
    // The hook's path: the per-device key, then the room-wide shared pulse with identical args for everyone.
    let roomKey = null;
    let shared = null;
    let myTeamId = null;
    let unShared = () => {};
    const unKey = s.c.onUpdate(
      F('live:roomPulseKey'),
      { code: joinCode, deviceToken: s.token },
      (k) => {
        if (!k) return;
        myTeamId = k.myTeamId;
        if (shared) onPulse({ ...shared, myTeamId });
        if (k.roomKey === roomKey) return;
        roomKey = k.roomKey;
        unShared();
        unShared = s.c.onUpdate(F('live:roomPulseShared'), { code: joinCode, roomKey }, (v) => v && onPulse({ ...(shared = v), myTeamId }), onError(s));
      },
      onError(s),
    );
    s.unsub = () => {
      unKey();
      unShared();
    };
  }
  const lobbyLeft = await waitAll(subs, (p) => p.joined === seated.length);
  log('Lobby: ' + (subs.length - lobbyLeft) + '/' + subs.length + ' subscribers see joined = ' + seated.length + '.');

  await host.c.mutation(F('live:startLive'), { deviceToken: host.token, challengeId });
  const dealtLeft = await waitAll(subs, (p) => p.teams.length > 0);
  const teams = new Map();
  for (const p of players) if (p.pulse?.myTeamId && !teams.has(p.pulse.myTeamId)) teams.set(p.pulse.myTeamId, p);
  log('Dealt: ' + teams.size + ' teams; ' + (subs.length - dealtLeft) + '/' + subs.length + ' subscribers see them.');

  const teamIds = [...teams.keys()];
  for (let q = 0; q < QUESTIONS; q++) {
    await sleep(300);
    const advanceAt = performance.now();
    await host.c.mutation(F('live:runHostAction'), { deviceToken: host.token, challengeId, action: 'next', payload: { expectedIndex: q === 0 ? null : q - 1, expectedPhase: q === 0 ? 'lobby' : 'leaderboard' } });
    await waitAll(subs, (p) => p.phase === 'question' && p.questionIndex === q);
    timings.advanceSeen.push(performance.now() - advanceAt);

    // Every player locks their own answer, in random order, inside the spread window.
    const order = seated.filter((p) => p.pulse?.myTeamId).sort(() => Math.random() - 0.5);
    await Promise.all(
      order.map(async (p, i) => {
        await sleep((SPREAD_MS * i) / order.length);
        const key = q + ':' + p.pulse.myTeamId;
        const s = performance.now();
        if (!lockSends.has(key)) lockSends.set(key, []);
        lockSends.get(key).push(s);
        try {
          await p.c.mutation(F('live:playerAction'), { deviceToken: p.token, challengeId, action: { type: 'answer', questionIndex: q, choice: Math.floor(Math.random() * 4) } });
          timings.lockMutation.push(performance.now() - s);
        } catch (e) {
          const sends = lockSends.get(key);
          sends.splice(sends.indexOf(s), 1);
          note('lock', p.name, e);
        }
      }),
    );
    const sent = (teamId) => lockSends.get(q + ':' + teamId)?.length ?? 0;
    const allLocked = await waitAll(subs, (p) => p.questionIndex === q && p.teams.every((t) => (t.lockedCount ?? 0) === sent(t.id) && (t.lockedAt !== null) === (sent(t.id) === t.memberCount)));
    const lastSent = Math.max(...teamIds.flatMap((id) => lockSends.get(q + ':' + id) ?? []));
    for (const s of subs) {
      const last = Math.max(...teamIds.map((id) => s.seen.get(q + ':' + id) ?? 0));
      if (last) timings.lockSeenLast.push(last - lastSent);
    }
    log('Q' + (q + 1) + ': ' + order.length + ' locks sent; ' + (subs.length - allLocked) + '/' + subs.length + ' subscribers see every lock.');

    const revealAt = performance.now();
    // A slow round can time out on its own first; the last one then ends the challenge, which refuses Next.
    await host.c.mutation(F('live:runHostAction'), { deviceToken: host.token, challengeId, action: 'next', payload: { expectedIndex: q, expectedPhase: 'question' } }).catch((e) => note('reveal', 'host', e));
    const done = q === QUESTIONS - 1;
    const revealLeft = await waitAll(subs, (p) => p.questionIndex === q && (p.phase === 'reveal' || p.phase === 'finished') && p.teams.every((t) => t.correct !== null));
    timings.revealSeen.push(performance.now() - revealAt);
    log('Q' + (q + 1) + ' revealed' + (done ? ' (last)' : '') + '; ' + (subs.length - revealLeft) + '/' + subs.length + ' subscribers see correctness.');
  }

  for (const s of subs) s.unsub?.();
  await Promise.all(subs.map((s) => s.c.close()));
  const summary = {
    target: URL_,
    players: N,
    teams: teams.size,
    path: PATH,
    subscribers: subs.length,
    questions: QUESTIONS,
    spreadMs: SPREAD_MS,
    errors: errors.length,
    correctnessLeaksBeforeReveal: leaks.length,
    join: stats(timings.join),
    advanceToAllSubscribers: stats(timings.advanceSeen),
    lockMutation: stats(timings.lockMutation),
    lockToPulse: stats(timings.lockSeen),
    teamLockedToPulse: stats(timings.teamLockedSeen),
    lastLockToPulse: stats(timings.lockSeenLast),
    revealToAllSubscribers: stats(timings.revealSeen),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (errors.length) console.log('Errors:', JSON.stringify(errors.slice(0, 20), null, 2));
  if (OUT) writeFileSync(OUT, JSON.stringify({ summary, errors, leaks }, null, 2));
  process.exit(errors.length || leaks.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
