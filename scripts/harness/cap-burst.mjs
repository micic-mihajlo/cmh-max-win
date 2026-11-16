import { ConvexClient } from 'convex/browser';
import { makeFunctionReference as F } from 'convex/server';
import { randomUUID } from 'node:crypto';

const flag = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i < 0 ? d : process.argv[i + 1];
};
const URL_ = flag('target') === 'dev' ? 'https://compassionate-puffin-914.convex.cloud' : flag('url', 'http://127.0.0.1:3210');
const N = Number(flag('n', 160));

const hostToken = `load-${randomUUID()}`;
const host = new ConvexClient(URL_);
const { dropId, joinCode } = await host.mutation(F('drops:hostDrop'), { deviceToken: hostToken, title: 'Load · cap burst', creatorName: 'Load · host' });

const clients = Array.from({ length: N }, () => new ConvexClient(URL_));
const tokens = clients.map(() => `load-${randomUUID()}`);
const t0 = Date.now();
const results = await Promise.allSettled(
  clients.map((c, i) => c.mutation(F('drops:enterDropByCode'), { deviceToken: tokens[i], code: joinCode, name: `Load · ${String(i + 1).padStart(3, '0')}` })),
);
const wallMs = Date.now() - t0;
const errors = {};
for (const r of results) if (r.status === 'rejected') {
  const k = String(r.reason?.data?.code ?? r.reason?.message ?? r.reason).slice(0, 80);
  errors[k] = (errors[k] ?? 0) + 1;
}
const accepted = results.filter((r) => r.status === 'fulfilled').length;
const okIdx = results.findIndex((r) => r.status === 'fulfilled');
const rejoin = await clients[okIdx].mutation(F('drops:enterDropByCode'), { deviceToken: tokens[okIdx], code: joinCode, name: 'Load · rejoin' }).then(() => 'ok', (e) => `rejected ${e?.data?.code ?? e.message}`);
const view = await host.query(F('drops:hostView'), { deviceToken: hostToken, dropId });
console.log(JSON.stringify({ dropId, joinCode, attempted: N, accepted, errors, entrantCount: view?.entrantCount, rejoinWhenFull: rejoin, wallMs }, null, 2));
await Promise.all([host, ...clients].map((c) => c.close()));
process.exit(0);
