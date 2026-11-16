// Seeds Nova's creator studio on dev through public functions only, the way the app does:
//   a published Quick Quiz, "Nova's Friday Trivia" (5 questions, live start mode), waiting for its host to start it;
//   a finished Quick Quiz, "Nova's Trivia Warm-up", played by 8 bot players in 4 teams of 2, with placements and a recap;
//   a draft Mystery, "The Aurora Seed".
// Nova's device token is derived from --key exactly as in seed-streamers.mjs, so the creator and the streamer are one Nova.
// Idempotent: it looks at Nova's challenges by title and status and only adds what's missing.
//
//   node scripts/demo/seed-challenges.mjs --key <secret> [--dry-run] [--url https://...convex.cloud]
//
// Keep the key private: anyone with it can act as Nova.
import { ConvexClient } from 'convex/browser';
import { makeFunctionReference as F } from 'convex/server';
import { createHash, randomUUID } from 'node:crypto';

const DEV_URL = 'https://compassionate-puffin-914.convex.cloud';
const NOVA = { displayName: 'Nova', handle: '@nova' };

const q = (prompt, choices, correct) => ({ prompt, choices, correct, timeLimitMs: 20_000 });
const FRIDAY_QUESTIONS = [
  q('Which planet has the most known moons?', ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], 1),
  q('What is the chemical symbol for gold?', ['Ag', 'Go', 'Au', 'Gd'], 2),
  q('How many sides does a hexagon have?', ['Five', 'Six', 'Seven', 'Eight'], 1),
  q('Which ocean is the largest?', ['Atlantic', 'Indian', 'Arctic', 'Pacific'], 3),
  q('Who painted the Mona Lisa?', ['Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Donatello'], 0),
];
const WARMUP_QUESTIONS = [
  q('What is the capital of Canada?', ['Toronto', 'Vancouver', 'Ottawa', 'Montreal'], 2),
  q('How many minutes are in a day?', ['1,440', '1,240', '1,640', '960'], 0),
  q('Which gas do plants take in?', ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Helium'], 1),
  q('What is the fastest land animal?', ['Lion', 'Pronghorn', 'Cheetah', 'Greyhound'], 2),
  q('Which element has atomic number 1?', ['Helium', 'Hydrogen', 'Lithium', 'Carbon'], 1),
];
// Bots, 4 teams of 2. Each team gets a question right when its skill pattern says so, so placements differ.
const BOTS = ['Lou', 'Ana', 'Kit', 'Mara', 'Dev', 'Jo', 'Rae', 'Omar'];
const SKILL = [[1, 1, 1, 1, 1], [1, 1, 0, 1, 1], [1, 0, 1, 0, 1], [0, 1, 0, 0, 1]];

const CHALLENGES = {
  friday: { title: "Nova's Friday Trivia", blurb: 'Five quick questions, live on stream. Fastest right answers score most.' },
  warmup: { title: "Nova's Trivia Warm-up", blurb: 'The warm-up round before Friday.' },
  mystery: { title: 'The Aurora Seed', blurb: 'Split the clues, find who did it, lock it in together.' },
};

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
  console.error('usage: node scripts/demo/seed-challenges.mjs --key <secret, 12+ chars> [--dry-run] [--url URL]');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (msg) => console.log('[' + ((Date.now() - t0) / 1000).toFixed(1).padStart(6) + 's] ' + msg);
const errText = (e) => (e?.data?.code ? e.data.code + ': ' + e.data.message : (e?.message ?? String(e)));
const HOST = 'seed-host-' + createHash('sha256').update(KEY + ':' + NOVA.displayName).digest('hex').slice(0, 32);

const client = new ConvexClient(URL_, { unsavedChangesWarning: false });
const m = (token, fn, args) => client.mutation(F(fn), { deviceToken: token, ...args });
const a = (token, fn, args) => client.action(F(fn), { deviceToken: token, ...args });
const qy = (token, fn, args) => client.query(F(fn), { deviceToken: token, ...args });

async function draft(patch) {
  const { challengeId } = await m(HOST, 'challenges:createChallenge', { patch });
  return challengeId;
}

async function publish(challengeId) {
  const { joinCode } = await m(HOST, 'challenges:publishChallenge', { challengeId });
  return joinCode;
}

const quiz = (c, questions) => ({
  ...c,
  templateId: 'quick-quiz',
  templateConfig: { questions },
  teamFormation: 'dealt',
  teamSize: 2,
  startMode: 'live',
  reward: { kind: 'placement', percents: [50, 30, 20] },
  poolCents: 15_000,
});

async function playWarmup(challengeId, joinCode) {
  const bots = BOTS.map((name) => ({ name, token: 'seed-bot-' + randomUUID() }));
  for (const b of bots) await a(b.token, 'challenges:joinChallenge', { code: joinCode, name: b.name });
  await m(HOST, 'live:startLive', { challengeId });
  const labels = await Promise.all(bots.map(async (b) => (await qy(b.token, 'live:teamSessionView', { challengeId }))?.teamLabel));
  const teams = [...new Set(labels)].sort().map((label) => bots.filter((_, i) => labels[i] === label));
  log('  warm-up: ' + teams.length + ' teams: ' + teams.map((t) => t.map((b) => b.name).join('+')).join(', '));
  for (const [index, question] of WARMUP_QUESTIONS.entries()) {
    await m(HOST, 'live:runHostAction', { challengeId, action: 'next' });
    for (const [ti, team] of teams.entries()) {
      await sleep(700 + 500 * ti);
      const right = SKILL[ti % SKILL.length][index];
      const choice = right ? question.correct : (question.correct + 1) % question.choices.length;
      await m(team[ti % team.length].token, 'live:playerAction', { challengeId, action: { type: 'answer', questionIndex: index, choice } });
    }
    await sleep(1500);
    await m(HOST, 'live:runHostAction', { challengeId, action: 'next' });
    await sleep(1100);
  }
  let status;
  for (let i = 0; i < 20 && status !== 'ended'; i++) {
    status = (await qy(HOST, 'challenges:hostConsole', { challengeId }))?.status;
    if (status !== 'ended') await sleep(500);
  }
  if (status !== 'ended') await m(HOST, 'challenges:endChallenge', { challengeId });
}

async function main() {
  log('Seeding Nova\'s challenges on ' + URL_ + (DRY ? ' (dry run)' : '') + '.');
  const profile = await qy(HOST, 'challenges:creatorProfile', {});
  if (!profile && !DRY) await m(HOST, 'challenges:saveCreatorProfile', NOVA);
  const mine = profile || !DRY ? await qy(HOST, 'challenges:myChallenges', {}) : [];
  const find = (title, statuses) => mine.find((c) => c.config.title === title && statuses.includes(c.status));

  const friday = find(CHALLENGES.friday.title, ['published', 'live']);
  const warmup = find(CHALLENGES.warmup.title, ['ended']);
  const mystery = find(CHALLENGES.mystery.title, ['draft']);
  log('  Friday Trivia: ' + (friday ? friday.status + ' ' + friday.joinCode : 'missing'));
  log('  Warm-up: ' + (warmup ? 'ended ' + warmup.joinCode : 'missing'));
  log('  Mystery draft: ' + (mystery ? 'present' : 'missing'));
  if (DRY) return;

  if (!friday) {
    const id = await draft(quiz(CHALLENGES.friday, FRIDAY_QUESTIONS));
    log('  published Friday Trivia: ' + (await publish(id)));
  }
  if (!warmup) {
    const id = await draft(quiz(CHALLENGES.warmup, WARMUP_QUESTIONS));
    const code = await publish(id);
    log('  playing the warm-up (' + code + ') with ' + BOTS.length + ' bots...');
    await playWarmup(id, code);
  }
  if (!mystery) {
    await draft({ ...CHALLENGES.mystery, templateId: 'mystery-aurora', teamSize: 3, startMode: 'live' });
    log('  drafted the Mystery.');
  }

  for (const c of await qy(HOST, 'challenges:myChallenges', {})) {
    if (!Object.values(CHALLENGES).some((s) => s.title === c.config.title)) continue;
    log('  ' + c.config.title.padEnd(24) + ' ' + c.status.padEnd(9) + ' code ' + (c.joinCode ?? '-') + ' id ' + c.challengeId + ' ' + (c.shareUrl ?? ''));
  }
  const warm = (await qy(HOST, 'challenges:myChallenges', {})).find((c) => c.config.title === CHALLENGES.warmup.title && c.status === 'ended');
  if (warm) {
    const recap = await client.query(F('challenges:challengeRecap'), { challengeId: warm.challengeId });
    log('  warm-up recap: ' + JSON.stringify(recap?.podium ?? recap?.results ?? recap).slice(0, 300));
  }
}

main()
  .then(() => client.close().then(() => process.exit(0)))
  .catch(async (e) => {
    console.error('seed-challenges: ' + errText(e));
    await client.close();
    process.exit(1);
  });
