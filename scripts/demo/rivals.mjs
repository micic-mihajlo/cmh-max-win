// Demo rival squads for the SIGNAL video. Enters 9 clearly labelled demo players ("Demo · Rio", ...) into a
// hosted drop by its join code, the way phones do, through public functions only. The host's deal turns them
// into Demo Squad A, B and C, and the script then plays them:
//   Demo Squad A solves 25 s after the deal.
//   Demo Squad B solves 4 s after the first real squad's correct lock-in shows on the leaderboard.
//   Demo Squad C never solves. The script exits once B has solved and C has gone 3 minutes.
//
//   node scripts/demo/rivals.mjs --code ABCD [--dry-run] [--solo] [--url https://...convex.cloud]
//
// --solo (a rehearsal with no real players): B solves at +40 s and C at +55 s, so the host sees every slot fill.
// Split Passphrase drops are solved by pooling each member's word; mystery drops by naming the culprit.
//
// Squads split in entry order, so the 9 demo players must sit in one block at the end of the entrant list,
// after a multiple of 3 real players. Until the deal, the script watches the entrant list. If a real player
// joins after the block, it leaves and re-enters at the end. While the real count isn't a multiple of 3, it
// stays out and says so.
import { ConvexClient } from 'convex/browser';
import { makeFunctionReference as F } from 'convex/server';
import { randomUUID } from 'node:crypto';

const DEV_URL = 'https://compassionate-puffin-914.convex.cloud';
const PREFIX = 'Demo · ';
const SQUADS = [
  ['Rio', 'Kai', 'Ash'],
  ['Lux', 'Bo', 'Ivy'],
  ['Zed', 'Mae', 'Oz'],
];
const A_AT_MS = 25_000;
const B_AFTER_MS = 4_000;
const C_HOLD_MS = 180_000;
const MAX_MS = 15 * 60_000;
const ANSWER = 'jun';

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf('--' + name);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const CODE = String(flag('code') ?? '').toUpperCase();
const DRY = !!flag('dry-run');
const SOLO = !!flag('solo');
const URL_ = typeof flag('url') === 'string' ? flag('url') : DEV_URL;
if (!/^[A-Z0-9]{4}$/.test(CODE)) {
  console.error('usage: node scripts/demo/rivals.mjs --code ABCD [--dry-run] [--url URL]');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (msg) => console.log('[' + ((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's] ' + msg);
const isDemo = (name) => name.startsWith(PREFIX);
const errText = (e) => (e?.data?.code ? e.data.code + ': ' + e.data.message : e?.message ?? String(e));

const client = new ConvexClient(URL_, { unsavedChangesWarning: false });
const players = SQUADS.flat().map((n) => ({ name: PREFIX + n, token: 'demo-rival-' + randomUUID() }));
const watcher = players[0];
const m = (p, fn, args) => client.mutation(F(fn), { deviceToken: p.token, ...args });
const q = (p, fn, args) => client.query(F(fn), { deviceToken: p.token, ...args });

function layout(view) {
  const names = view.entrants.map((e) => e.name);
  const ours = new Set(players.map((p) => p.name));
  const real = names.filter((n) => !ours.has(n)).length;
  const inCount = names.filter((n) => ours.has(n)).length;
  const atTail = inCount === players.length && names.slice(-players.length).every((n) => ours.has(n));
  return { real, inCount, ok: atTail && real % 3 === 0 };
}

async function enterAll(dropId) {
  for (const p of players) await m(p, 'drops:enterDrop', { dropId, name: p.name });
}
async function leaveAll(dropId, view) {
  const present = new Set(view.entrants.map((e) => e.name));
  for (const p of players) if (present.has(p.name)) await m(p, 'drops:leaveDrop', { dropId }).catch(() => {});
}

async function main() {
  const found = await q(watcher, 'drops:dropByCode', { code: CODE });
  if (!found) throw new Error('No open drop with code ' + CODE + ' at ' + URL_ + '.');
  if (found.status !== 'scheduled') throw new Error('Drop ' + found.dropId + ' is ' + found.status + '; run this before the host deals.');
  const dropId = found.dropId;
  const stray = found.entrants.filter((e) => isDemo(e.name));
  if (stray.length) throw new Error('Drop already has ' + stray.length + ' "Demo · " entrants from another run. Use a fresh drop.');
  const real = found.entrantCount;
  console.log('Drop ' + dropId + ' "' + found.title + '" (code ' + CODE + ') at ' + URL_);
  console.log('  ' + real + ' real entrant(s) now: ' + (found.entrants.map((e) => e.name).join(', ') || '(none)'));
  console.log('  Will enter 9 demo players as one block at the end, so the deal makes:');
  SQUADS.forEach((s, i) => console.log('    Demo Squad ' + 'ABC'[i] + ': ' + s.map((n) => PREFIX + n).join(', ')));
  console.log('  A solves at deal + 25 s. B solves 4 s after the first real squad solves. C never solves.');
  console.log('  Exits once B has solved and the deal is 3 min old (hard stop at 15 min).');
  if (real % 3 !== 0) console.log('  ! ' + real + " real entrants isn't a multiple of 3, so the demo players wait outside until it is.");
  if (DRY) {
    console.log('Dry run: nothing entered.');
    return;
  }

  let view = found;
  let entered = false;
  let busy = Promise.resolve();
  let dealt;
  const dealtP = new Promise((r) => (dealt = r));
  const fix = async () => {
    if (view.status !== 'scheduled') return;
    const l = layout(view);
    if (l.real % 3 !== 0) {
      if (entered) {
        log(l.real + " real entrants isn't a multiple of 3; demo players step out until it is.");
        await leaveAll(dropId, view);
        entered = false;
      }
      return;
    }
    if (entered && l.ok) return;
    if (entered) log('A real player joined after the demo block; re-entering at the end.');
    await leaveAll(dropId, view);
    await enterAll(dropId);
    entered = true;
    log('Entered 9 demo players after ' + l.real + ' real entrant(s). Waiting for the host to deal.');
  };
  const unsub = client.onUpdate(F('drops:drop'), { deviceToken: watcher.token, dropId }, (v) => {
    if (!v) return;
    view = v;
    if (v.status !== 'scheduled') return dealt(v);
    busy = busy.then(fix).catch((e) => log('entry error: ' + errText(e)));
  });
  const deadline = setTimeout(() => dealt(null), MAX_MS);
  const after = await dealtP;
  clearTimeout(deadline);
  unsub();
  await busy;
  if (!after) throw new Error('No deal within 15 minutes.');
  const dealAt = Date.now();
  log('Deal seen (drop is ' + after.status + ').');

  const views = await Promise.all(players.map((p) => q(p, 'drops:drop', { dropId })));
  const squads = new Map();
  views.forEach((v, i) => {
    const s = v?.me.squad;
    if (!s) return;
    if (!squads.has(s.code)) squads.set(s.code, { code: s.code, label: s.label, members: [] });
    squads.get(s.code).members.push(players[i]);
  });
  const byLabel = Object.fromEntries([...squads.values()].map((s) => [s.label, s]));
  const rooms = await Promise.all([...squads.values()].map((s) => q(s.members[0], 'signal:room', { code: s.code })));
  const pure = rooms.every((r) => r && r.members.every((mem) => isDemo(mem.name)));
  const labelled = ['Demo Squad A', 'Demo Squad B', 'Demo Squad C'].every((l) => byLabel[l]?.members.length === 3);
  if (!pure || !labelled) {
    const seen = [...squads.values()].map((s) => s.label + '=' + s.members.length).join(', ');
    throw new Error('Demo squads came out mixed or mislabelled (' + seen + '). Not playing.');
  }
  log('Dealt as Demo Squad A, B and C, 3 demo players each.');

  for (const s of squads.values()) for (const p of s.members) await m(p, 'signal:setPresence', { code: s.code, presence: 'ready' });

  const solve = async (label) => {
    const s = byLabel[label];
    const pieces = await Promise.all(s.members.map((p) => q(p, 'passphrase:piece', { code: s.code })));
    let out;
    if (pieces[0]) {
      const answer = pieces.sort((a, b) => a.position - b.position).map((x) => x.word).join(' ');
      out = await m(s.members[0], 'passphrase:submitPassphrase', { code: s.code, answer });
      for (const p of s.members.slice(1)) out = await m(p, 'passphrase:confirmPassphrase', { code: s.code, revision: out.revision });
    } else {
      const { revision } = await m(s.members[0], 'signal:setTheory', { code: s.code, culprit: ANSWER });
      for (const p of s.members) out = await m(p, 'signal:lockIn', { code: s.code, revision });
    }
    log(label + ' locked in: ' + out.outcome + '.');
  };

  const aDone = sleep(Math.max(0, dealAt + A_AT_MS - Date.now())).then(() => solve('Demo Squad A'));

  const soloDone = SOLO
    ? Promise.all([sleep(Math.max(0, dealAt + 40_000 - Date.now())).then(() => solve('Demo Squad B')), sleep(Math.max(0, dealAt + 55_000 - Date.now())).then(() => solve('Demo Squad C'))])
    : null;

  const bDone = soloDone ?? new Promise((res) => {
    let fired = false;
    let stop = () => {};
    const timer = setTimeout(() => {
      if (!fired) log('No real squad solved within 15 minutes; Demo Squad B never solved.');
      fired = true;
      stop();
      res();
    }, Math.max(0, dealAt + MAX_MS - Date.now()));
    stop = client.onUpdate(F('drops:leaderboard'), { deviceToken: watcher.token, dropId }, (board) => {
      const realSolve = board?.rows.find((r) => r.rank !== null && !r.squadLabel.startsWith('Demo Squad'));
      if (!realSolve || fired) return;
      fired = true;
      clearTimeout(timer);
      log(realSolve.squadLabel + ' solved (place ' + realSolve.rank + '). Demo Squad B in 4 s.');
      queueMicrotask(() => stop());
      sleep(B_AFTER_MS).then(() => solve('Demo Squad B')).catch((e) => log('B error: ' + errText(e))).then(res);
    });
  });

  await Promise.all([aDone, bDone, SOLO ? null : sleep(Math.max(0, dealAt + C_HOLD_MS - Date.now()))]);
  const board = await q(watcher, 'drops:leaderboard', { dropId });
  log('Final board:');
  for (const r of board.rows) console.log('    ' + String(r.rank ?? '-') + '  ' + r.squadLabel.padEnd(14) + ' ' + r.status.padEnd(8) + ' ' + r.memberNames.join(', '));
}

main()
  .then(() => client.close().then(() => process.exit(0)))
  .catch(async (e) => {
    console.error('rivals: ' + errText(e));
    await client.close();
    process.exit(1);
  });
