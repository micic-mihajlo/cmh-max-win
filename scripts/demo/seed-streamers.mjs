// Seeds real-looking streamers for the showcase feed, through public functions only, the way phones do.
//   Nova: "Case 02 · The Glass Orchard", scheduled for next Friday 9 pm Los Angeles, and two finished drops with winners.
//   Juno Park, Theo Marsh and Sable Quinn: one scheduled case each, later in the week.
// Titles are case names, never times: the feed already prints the start time beside the title.
// No followers are made: follower counts come only from real devices following.
//
// Idempotent: each streamer's host token is derived from --key, and the script only adds what a streamer's page
// is still missing. Run it again with the same key and it does nothing. Each missing finished drop plays a real
// race (6 players, 2 squads, the first squad solves after a short think), so a first run takes about 3 minutes.
//
//   node scripts/demo/seed-streamers.mjs --key <secret> [--dry-run] [--url https://...convex.cloud]
//
// Keep the key private: anyone with it can host as these streamers.
import { ConvexClient } from 'convex/browser';
import { makeFunctionReference as F } from 'convex/server';
import { createHash, randomUUID } from 'node:crypto';

const DEV_URL = 'https://compassionate-puffin-914.convex.cloud';
const ANSWER = 'jun';
const avatar = (seed) => 'https://api.dicebear.com/9.x/notionists/png?size=256&seed=' + encodeURIComponent(seed);

const STREAMERS = [
  {
    name: 'Nova',
    avatarUrl: avatar('Nova'),
    upcoming: { title: 'Case 02 · The Glass Orchard', day: 5, hour: 21, totalCents: 30_000 },
    past: [
      { title: 'The Aurora Seed', totalCents: 20_000, thinkMs: 48_000, players: ['Lou', 'Ana', 'Kit', 'Mara', 'Dev', 'Jo'] },
      { title: 'The Silent Switchboard', totalCents: 25_000, thinkMs: 71_000, players: ['Rae', 'Omar', 'Lena', 'Sam', 'Priya', 'Cole'] },
    ],
  },
  { name: 'Juno Park', avatarUrl: avatar('Juno Park'), upcoming: { title: 'Case 03 · The Lantern Ledger', day: 6, hour: 20, totalCents: 15_000 }, past: [] },
  { name: 'Theo Marsh', avatarUrl: avatar('Theo Marsh'), upcoming: { title: 'Case 04 · Cold Harbor', day: 0, hour: 18, totalCents: 10_000 }, past: [] },
  { name: 'Sable Quinn', avatarUrl: avatar('Sable Quinn'), upcoming: { title: 'Case 05 · Velvet Static', day: 3, hour: 19, totalCents: 12_000 }, past: [] },
];

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf('--' + name);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const KEY = flag('key');
const DRY = !!flag('dry-run');
const URL_ = typeof flag('url') === 'string' ? flag('url') : DEV_URL;
if (typeof KEY !== 'string' || KEY.length < 12) {
  console.error('usage: node scripts/demo/seed-streamers.mjs --key <secret, 12+ chars> [--dry-run] [--url URL]');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (msg) => console.log('[' + ((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's] ' + msg);
const errText = (e) => (e?.data?.code ? e.data.code + ': ' + e.data.message : (e?.message ?? String(e)));
const hostToken = (name) => 'seed-host-' + createHash('sha256').update(KEY + ':' + name).digest('hex').slice(0, 32);

const client = new ConvexClient(URL_, { unsavedChangesWarning: false });
const m = (token, fn, args) => client.mutation(F(fn), { deviceToken: token, ...args });
const q = (token, fn, args) => client.query(F(fn), { deviceToken: token, ...args });

// The next <day> at <hour>:00 in Los Angeles, at least an hour away (and so inside hostDrop's 2 min to 30 day window).
function nextLocal(day, hour, zone = 'America/Los_Angeles') {
  const parts = (ms) =>
    Object.fromEntries(
      new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' })
        .formatToParts(new Date(ms))
        .map((p) => [p.type, p.value]),
    );
  for (let i = 0; i <= 7; i++) {
    const p = parts(Date.now() + i * 86_400_000);
    if (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) !== day) continue;
    const guess = Date.UTC(+p.year, +p.month - 1, +p.day, hour);
    const back = parts(guess);
    const offset = Date.UTC(+back.year, +back.month - 1, +back.day, +back.hour, +back.minute) - guess;
    const at = guess - offset;
    if (at > Date.now() + 60 * 60_000) return at;
  }
  return nextLocal(day, hour, zone) + 7 * 86_400_000;
}

async function pageOf(token) {
  const streamerId = await q(token, 'feed:myStreamer', {});
  return streamerId ? q(token, 'feed:streamerPage', { streamerId }) : null;
}

// One finished drop: 6 players enter, the host deals 2 squads, the first squad solves after thinkMs.
async function race(host, s, past) {
  const { dropId } = await m(host, 'drops:hostDrop', { creatorName: s.name, avatarUrl: s.avatarUrl, title: past.title, totalCents: past.totalCents, winnerSlots: 1 });
  const players = past.players.map((name) => ({ name, token: 'seed-player-' + randomUUID() }));
  for (const p of players) await m(p.token, 'drops:enterDrop', { dropId, name: p.name });
  await m(host, 'drops:dealSquads', { dropId });
  const squads = new Map();
  for (const p of players) {
    const view = await q(p.token, 'drops:drop', { dropId });
    const code = view?.me.squad?.code;
    if (!code) throw new Error(p.name + ' was not dealt into a squad.');
    if (!squads.has(code)) squads.set(code, []);
    squads.get(code).push(p);
  }
  for (const [code, members] of squads) for (const p of members) await m(p.token, 'signal:setPresence', { code, presence: 'ready' });
  log('  ' + past.title + ': dealt ' + squads.size + ' squads; thinking for ' + Math.round(past.thinkMs / 1000) + ' s.');
  await sleep(past.thinkMs);
  const [code, members] = [...squads][0];
  const { revision } = await m(members[0].token, 'signal:setTheory', { code, culprit: ANSWER });
  for (const p of members) await m(p.token, 'signal:lockIn', { code, revision });
  const status = (await q(host, 'drops:drop', { dropId }))?.status;
  log('  ' + past.title + ': ' + members.map((p) => p.name).join(', ') + ' won; drop is ' + status + '.');
}

async function seed(s) {
  const host = hostToken(s.name);
  const page = await pageOf(host);
  const hasUpcoming = page?.nextDrop?.title === s.upcoming.title;
  const finished = (page?.past ?? []).filter((p) => p.winner).length;
  const missingPast = s.past.slice(finished);
  log(s.name + ': ' + (page ? 'exists' : 'new') + ', upcoming ' + (hasUpcoming ? 'set' : 'missing') + ', ' + finished + '/' + s.past.length + ' finished drops.');
  if (DRY) return;
  for (const past of missingPast) await race(host, s, past);
  if (!hasUpcoming) {
    const startsAt = nextLocal(s.upcoming.day, s.upcoming.hour);
    await m(host, 'drops:hostDrop', { creatorName: s.name, avatarUrl: s.avatarUrl, title: s.upcoming.title, totalCents: s.upcoming.totalCents, startsAt });
    log('  scheduled "' + s.upcoming.title + '" for ' + new Date(startsAt).toISOString() + '.');
  }
}

async function main() {
  log('Seeding ' + STREAMERS.length + ' streamers on ' + URL_ + (DRY ? ' (dry run)' : '') + '.');
  await Promise.all(STREAMERS.map(seed));
  const anyone = 'seed-viewer-' + randomUUID();
  const cards = await q(anyone, 'feed:streamers', {});
  const ours = new Set(STREAMERS.map((s) => s.name));
  for (const c of cards.filter((c) => ours.has(c.name))) log('  ' + c.name.padEnd(12) + ' followers ' + c.followerCount + (c.live ? ' · live' : ''));
}

main()
  .then(() => client.close().then(() => process.exit(0)))
  .catch(async (e) => {
    console.error('seed-streamers: ' + errText(e));
    await client.close();
    process.exit(1);
  });
