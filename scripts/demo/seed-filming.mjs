// The streamer video's filming state, on demand: Danny Ortiz goes live with a Quick Quiz whose lobby fills from chat.
//   1. Danny schedules a hosted drop, "Danny's Quick Quiz", --lead minutes out (default 2.5). The follower device
//      follows Danny and taps Remind me, so the existing scheduled-drop path sends it "Danny Ortiz's room opens in
//      2 minutes" at start minus 2 minutes, then "Danny Ortiz is live · Danny's Quick Quiz" when the room opens.
//      A push only reaches a device that registered an Expo push token (a real phone with notifications on).
//   2. Danny publishes a solo Quick Quiz (3 questions) with the same title, and --bots players with ordinary first
//      names (default 24) join it over about a minute, so the host console's lobby fills. The host starts it.
//   3. It checks that feed:streamers lists only the four seeded streamers, so no test host shows on camera.
//   4. It stays running and plays the bots once the host starts: each bot answers every question, but every bot
//      misses at least one, so a seat that answers all three right wins 1st. It exits when the quiz ends.
// --real makes the quiz server-created with the Whop adapter and a $1 pot, all to 1st, and links the printed winner
// seat to the sandbox Whop user, so after the host approves payouts that seat is paid for real. It needs the Convex
// CLI's deploy access (internal functions). Without --real the pot is concept and nothing real moves.
// The drop stops reading as live 20 minutes after its last activity; the quiz lobby stays open until --clear.
//
//   node scripts/demo/seed-filming.mjs --key <secret> [--follower <deviceToken>] [--bots 20-40] [--lead <minutes>]
//                                      [--real] [--no-play] [--dry-run]
//   node scripts/demo/seed-filming.mjs --key <secret> --clear
//
// --clear cancels an unstarted filming quiz (or ends a started one) and lets the bots solve the filming drop, which
// ends it with a finished result on Danny's page. --key is the seed-streamers.mjs key: Danny hosts on the token it
// derives for 'Nova', his original seed name, and that token is the host's web login (localStorage
// 'signal.deviceToken'), so treat it as a secret too.
import { ConvexClient } from 'convex/browser';
import { makeFunctionReference as F } from 'convex/server';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

const DEV_URL = 'https://compassionate-puffin-914.convex.cloud';
const DANNY = { name: 'Danny Ortiz', tokenName: 'Nova', handle: '@danny' };
const TITLE = "Danny's Quick Quiz";
const SEEDED = ['Danny Ortiz', 'Kayla Brooks', 'Jess Tran', 'Marcus Webb'];
const NAMES = [
  'Mike', 'Sarah', 'Chris', 'Ashley', 'Tyler', 'Jen', 'Matt', 'Emily', 'Josh', 'Megan', 'Ryan', 'Kevin', 'Nicole', 'Brandon',
  'Rachel', 'Steph', 'Amanda', 'Justin', 'Lauren', 'Eric', 'Brittany', 'Jason', 'Heather', 'Andrew', 'Jessica', 'Nick',
  'Amber', 'Kyle', 'Melissa', 'Adam', 'Laura', 'Sean', 'Kelly', 'Jake', 'Lisa', 'Derek', 'Erin', 'Greg', 'Tiffany', 'Jordan',
];
const WHOP_USER = 'user_41t2bclWAC2x6';
const FILL_MS = 60_000;
const ANSWER = 'jun';
const avatar = (seed) => 'https://api.dicebear.com/9.x/notionists/png?size=256&seed=' + encodeURIComponent(seed);

const q = (prompt, choices, correct) => ({ prompt, choices, correct, timeLimitMs: 20_000 });
const QUESTIONS = [
  q('Which planet is known as the Red Planet?', ['Venus', 'Mars', 'Jupiter', 'Mercury'], 1),
  q('How many players does a soccer team have on the field?', ['9', '10', '11', '12'], 2),
  q('What is the largest mammal?', ['Elephant', 'Blue whale', 'Giraffe', 'Orca'], 1),
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
const CLEAR = !!flag('clear');
const URL_ = typeof flag('url') === 'string' ? flag('url') : DEV_URL;
const LEAD_MIN = typeof flag('lead') === 'string' ? Number(flag('lead')) : 2.5;
const FOLLOWER = typeof flag('follower') === 'string' ? flag('follower') : null;
const BOT_COUNT = typeof flag('bots') === 'string' ? Number(flag('bots')) : 24;
const REAL = !!flag('real');
const PLAY = !flag('no-play');
if (typeof KEY !== 'string' || KEY.length < 12 || !(LEAD_MIN >= 2.2 && LEAD_MIN <= 60) || !(BOT_COUNT >= 4 && BOT_COUNT <= NAMES.length)) {
  console.error('usage: node scripts/demo/seed-filming.mjs --key <secret> [--follower <deviceToken>] [--bots 4-40] [--lead <2.2-60 minutes>] [--real] [--no-play] [--dry-run] [--clear]');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (msg) => console.log('[' + ((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's] ' + msg);
const errText = (e) => (e?.data?.code ? e.data.code + ': ' + e.data.message : (e?.message ?? String(e)));
const hash = (s) => createHash('sha256').update(KEY + ':' + s).digest('hex').slice(0, 32);
const HOST = 'seed-host-' + hash(DANNY.tokenName);
const botToken = (scope, name) => 'film-bot-' + hash('film:' + scope + ':' + name);
const BOTS = NAMES.slice(0, BOT_COUNT);
const cli = (fn, args) => JSON.parse(execFileSync('npx', ['convex', 'run', fn, JSON.stringify(args)], { stdio: ['ignore', 'pipe', 'inherit'] }).toString() || 'null');

const client = new ConvexClient(URL_, { unsavedChangesWarning: false });
const m = (token, fn, args) => client.mutation(F(fn), { deviceToken: token, ...args });
const a = (token, fn, args) => client.action(F(fn), { deviceToken: token, ...args });
const qy = (token, fn, args) => client.query(F(fn), { deviceToken: token, ...args });

async function dannyPage() {
  const streamerId = await qy(HOST, 'feed:myStreamer', {});
  return streamerId ? { streamerId, page: await qy(HOST, 'feed:streamerPage', { streamerId }) } : null;
}

const filmingQuizzes = async () =>
  (await qy(HOST, 'challenges:myChallenges', {})).filter((c) => c.config.title === TITLE && (c.status === 'published' || c.status === 'live'));

// The filming drop: Danny's live or upcoming drop with the filming title.
async function filmingDrop() {
  const d = await dannyPage();
  const row = [d?.page?.liveDrop, d?.page?.nextDrop].find((r) => r?.title === TITLE);
  return row ? row.dropId : null;
}

async function checkFeed() {
  const cards = await qy('film-viewer-' + randomUUID(), 'feed:streamers', {});
  const extra = cards.filter((c) => !SEEDED.includes(c.name));
  log('feed:streamers: ' + cards.map((c) => c.name + (c.live ? ' (live)' : '')).join(', '));
  log(extra.length ? 'NOT CLEAN: unexpected hosts on the feed: ' + extra.map((c) => c.name).join(', ') : 'feed is clean: only the seeded streamers.');
  return extra.length === 0;
}

async function clear() {
  for (const c of await filmingQuizzes()) {
    if (c.status === 'published') await m(HOST, 'challenges:cancelChallenge', { challengeId: c.challengeId, reason: 'Filming wrapped.' });
    else await m(HOST, 'challenges:endChallenge', { challengeId: c.challengeId });
    log('quiz ' + c.joinCode + ': ' + (c.status === 'published' ? 'cancelled' : 'ended'));
  }
  const dropId = await filmingDrop();
  if (!dropId) return log('no filming drop open.');
  let view = await qy(HOST, 'drops:drop', { dropId });
  while (view?.status === 'scheduled') {
    log('drop ' + dropId + ' opens in ' + Math.ceil((view.startsAt - Date.now()) / 1000) + ' s; waiting to end it.');
    await sleep(Math.min(15_000, Math.max(2_000, view.startsAt - Date.now() + 1_000)));
    view = await qy(HOST, 'drops:drop', { dropId });
  }
  const bots = NAMES.slice(0, 8).map((name) => ({ name, token: botToken(dropId, name) }));
  for (const b of bots) await m(b.token, 'drops:enterDrop', { dropId, name: b.name }).catch(() => {});
  await m(HOST, 'drops:dealSquads', { dropId }).catch((e) => log('deal: ' + errText(e)));
  const squads = new Map();
  for (const b of bots) {
    const code = (await qy(b.token, 'drops:drop', { dropId }))?.me.squad?.code;
    if (!code) continue;
    if (!squads.has(code)) squads.set(code, []);
    squads.get(code).push(b);
  }
  const [code, members] = [...squads][0] ?? [];
  if (!code) return log('drop ' + dropId + ': no bot squad to finish it.');
  for (const b of members) await m(b.token, 'signal:setPresence', { code, presence: 'ready' });
  const { revision } = await m(members[0].token, 'signal:setTheory', { code, culprit: ANSWER });
  for (const b of members) await m(b.token, 'signal:lockIn', { code, revision });
  log('drop ' + dropId + ': ' + (await qy(HOST, 'drops:drop', { dropId }))?.status);
}

async function seed() {
  const d = await dannyPage();
  const profile = await qy(HOST, 'challenges:creatorProfile', {});
  log('Danny: streamer ' + (d ? d.page?.name : 'missing') + ', creator ' + (profile ? profile.displayName + ' ' + profile.handle : 'missing'));
  if (!d) throw new Error('Danny has no streamer page; run seed-streamers.mjs first.');
  const open = await filmingQuizzes();
  const openDrop = await filmingDrop();
  if (open.length || openDrop) throw new Error('A filming state is already up (quiz ' + open.map((c) => c.joinCode).join(', ') + ', drop ' + openDrop + '). Run --clear first.');
  if (DRY) {
    log('dry run: would schedule "' + TITLE + '" ' + LEAD_MIN + ' min out, publish the quiz, fill both with ' + BOTS.join(', ') + ' over ' + FILL_MS / 1000 + ' s.');
    return checkFeed();
  }
  if (!profile || profile.displayName !== DANNY.name) await m(HOST, 'challenges:saveCreatorProfile', { displayName: DANNY.name, handle: DANNY.handle });

  const startsAt = Date.now() + LEAD_MIN * 60_000;
  const { dropId, joinCode: dropCode } = await m(HOST, 'drops:hostDrop', {
    creatorName: DANNY.name, avatarUrl: avatar(DANNY.name), title: TITLE, totalCents: 30_000, winnerSlots: 1, startsAt, payoutMode: 'concept',
  });
  log('scheduled drop ' + dropId + ' (code ' + dropCode + ') opening at ' + new Date(startsAt).toISOString());
  const follower = FOLLOWER ?? 'film-follower-' + randomUUID();
  await m(follower, 'feed:followStreamer', { streamerId: d.streamerId });
  await m(follower, 'feed:remindMe', { dropId });
  log('follower ' + follower + ' follows Danny and tapped Remind me' + (FOLLOWER ? '' : ' (minted: no phone, so no banner)'));

  const patch = {
    title: TITLE, blurb: 'Three quick questions, live on stream. Fastest right answers score most.',
    templateId: 'quick-quiz', templateConfig: { questions: QUESTIONS }, teamFormation: 'dealt', teamSize: 1, startMode: 'live',
    ...(REAL ? { reward: { kind: 'placement', percents: [100] }, poolCents: 100, payoutAdapter: 'whop' } : { reward: { kind: 'placement', percents: [50, 30, 20] }, poolCents: 15_000 }),
  };
  const { challengeId } = REAL ? cli('challenges:createServerChallenge', { creatorToken: HOST, patch }) : await m(HOST, 'challenges:createChallenge', { patch });
  const { joinCode } = await m(HOST, 'challenges:publishChallenge', { challengeId });
  log('published Quick Quiz ' + joinCode + ' (challengeId ' + challengeId + '); filling the lobby over ' + FILL_MS / 1000 + ' s');
  const seat = 'film-seat-' + hash('film:seat:' + challengeId);
  if (REAL) cli('whopAuth:linkIdentity', { deviceToken: seat, whopUserId: WHOP_USER, name: 'Winner seat', accessToken: 'film-seat-placeholder', expiresAt: 0 });
  log('winner seat ' + seat + (REAL ? ' (linked to Whop ' + WHOP_USER + ')' : '') + ': load it as localStorage signal.deviceToken, then join ' + joinCode);
  for (const [i, name] of BOTS.entries()) {
    await a(botToken(challengeId, name), 'challenges:joinChallenge', { code: joinCode, name });
    if (i < 8) await m(botToken(dropId, name), 'drops:enterDrop', { dropId, name });
    const lobby = (await qy(HOST, 'challenges:hostConsole', { challengeId }))?.entrants;
    log('  ' + name + ' joined' + (Array.isArray(lobby) ? ' (' + lobby.length + ' in the lobby)' : ''));
    if (i < BOTS.length - 1) await sleep(FILL_MS / (BOTS.length - 1));
  }
  const wait = startsAt - Date.now() + 2_000;
  if (wait > 0) {
    log('waiting ' + Math.ceil(wait / 1000) + ' s for the room to open');
    await sleep(wait);
  }
  const live = (await dannyPage())?.page?.liveDrop;
  log('Danny live: ' + (live?.dropId === dropId ? 'yes, ' + live.title : 'NO'));
  await checkFeed();
  log('READY. Quiz code ' + joinCode + ', drop code ' + dropCode + ', follower ' + follower + ', winner seat ' + seat + '. Live for about 20 minutes from now; the quiz lobby holds until --clear.');
  if (PLAY) await play(challengeId, joinCode);
}

// Every bot answers each open question 4-14 s after it opens. Bot i misses question i % 3 (and every third bot
// misses another), so no bot gets all three right and a seat that does wins 1st.
async function play(challengeId, joinCode) {
  log('playing the bots: waiting for the host to start ' + joinCode);
  const answered = new Set();
  const until = Date.now() + 45 * 60_000;
  while (Date.now() < until) {
    const live = await client.query(F('live:liveView'), { code: joinCode });
    if (!live || live.status === 'ended' || live.status === 'cancelled') break;
    if (live.status === 'live') {
      await Promise.all(
        BOTS.map(async (name, i) => {
          const token = botToken(challengeId, name);
          const view = await qy(token, 'live:teamSessionView', { challengeId }).catch(() => null);
          for (const question of view?.shared?.questions ?? []) {
            const key = name + ':' + question.index;
            if (question.closed || question.answer || answered.has(key) || question.opensAt === null) continue;
            if (Date.now() < question.opensAt + 4_000 + ((i * 1_373) % 10_000)) continue;
            answered.add(key);
            const miss = question.index === i % 3 || (i % 3 === 2 && question.index === (i + 1) % 3);
            const correct = QUESTIONS[question.index].correct;
            const choice = miss ? (correct + 1 + (i % 3)) % 4 : correct;
            await m(token, 'live:playerAction', { challengeId, action: { type: 'answer', questionIndex: question.index, choice } }).catch(() => {});
          }
        }),
      );
    }
    await sleep(1_500);
  }
  const live = await client.query(F('live:liveView'), { code: joinCode });
  log('quiz ' + joinCode + ' is ' + live?.status + (live?.leaderboard ? '; top: ' + live.leaderboard.slice(0, 3).map((r) => r.place + '. ' + r.memberNames.join('+')).join(', ') : ''));
}

(CLEAR ? clear() : seed())
  .then(() => client.close().then(() => process.exit(0)))
  .catch(async (e) => {
    console.error('seed-filming: ' + errText(e));
    await client.close();
    process.exit(1);
  });
