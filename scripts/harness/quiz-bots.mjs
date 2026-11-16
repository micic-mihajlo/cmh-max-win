import { ConvexClient } from 'convex/browser';
import { makeFunctionReference as F } from 'convex/server';
import { randomUUID } from 'node:crypto';

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const URL_ = 'https://compassionate-puffin-914.convex.cloud';
const CODE = flag('code');
const N = Number(flag('n', 3));
const NAMES = ['Danny', 'Kayla', 'Marcus', 'Jess', 'Mike', 'Sarah'];
const t0 = Date.now();
const log = (m) => console.log('[' + ((Date.now() - t0) / 1000).toFixed(1) + 's] ' + m);
const err = (e) => (e?.data?.code ? e.data.code : String(e?.message ?? e).split('\n')[0]);
const bots = Array.from({ length: N }, (_, i) => ({ name: 'Bot ' + NAMES[i], token: 'bot-' + randomUUID(), c: new ConvexClient(URL_, { unsavedChangesWarning: false }) }));
for (const b of bots) {
  const r = await b.c.action(F('challenges:joinChallenge'), { deviceToken: b.token, code: CODE, name: b.name }).catch((e) => ({ error: err(e) }));
  b.cid = r.challengeId; log(b.name + ' join: ' + JSON.stringify(r));
}
for (const b of bots) {
  if (!b.cid) continue;
  b.c.onUpdate(F('live:teamSessionView'), { deviceToken: b.token, challengeId: b.cid }, async (v) => {
    const q = v?.shared?.questions?.find((x) => !x.closed && !x.answer);
    if (!q || b.done === q.index) return;
    b.done = q.index;
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 3000));
    const choice = Math.floor(Math.random() * q.choices.length);
    const r = await b.c.mutation(F('live:playerAction'), { deviceToken: b.token, challengeId: b.cid, action: { type: 'answer', questionIndex: q.index, choice } }).then(() => 'ok', err);
    log(b.name + ' (' + v.teamLabel + ') answered Q' + (q.index + 1) + ' "' + q.choices[choice] + '": ' + r);
  });
}
await new Promise((r) => setTimeout(r, Number(flag('hold', 1200000))));
process.exit(0);
