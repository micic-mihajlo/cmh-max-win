/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

const SECRET = 'ws_' + 'ab'.repeat(32);
const VARIANT = 'plan_season01';
const CONFIG = 'ch_test123';
const DEVICE = 'device-token-1';

async function sign(id: string, timestamp: string, body: string, secret = SECRET) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return 'v1,' + btoa(String.fromCharCode(...new Uint8Array(mac)));
}

async function webhook(t: ReturnType<typeof convexTest>, paymentId: string, opts: { secret?: string; type?: string } = {}) {
  const body = JSON.stringify({ type: opts.type ?? 'payment.succeeded', data: { id: paymentId } });
  const id = 'msg_' + paymentId;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return t.fetch('/whop/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': timestamp,
      'webhook-signature': await sign(id, timestamp, body, opts.secret),
    },
    body,
  });
}

let payments: Record<string, object>;

beforeEach(() => {
  vi.stubEnv('WHOP_API_KEY', 'test-key');
  vi.stubEnv('WHOP_ACCOUNT_ID', 'biz_test');
  vi.stubEnv('WHOP_VARIANT_ID', VARIANT);
  vi.stubEnv('WHOP_WEBHOOK_SECRET', SECRET);
  vi.stubEnv('WHOP_ENVIRONMENT', 'sandbox');
  vi.stubEnv('CONVEX_SITE_URL', 'https://example.convex.site');
  payments = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === 'https://sandbox-api.whop.com/api/v1/checkout_configurations' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(body).toMatchObject({ account_id: 'biz_test', variant_id: VARIANT, redirect_url: 'https://example.convex.site/whop/return' });
        expect(JSON.stringify(body.metadata)).not.toContain(DEVICE);
        return Response.json({ id: CONFIG, purchase_url: 'https://sandbox.whop.com/checkout/' + CONFIG });
      }
      const match = url.match(/\/payments\/(.+)$/);
      if (match && payments[match[1]]) return Response.json(payments[match[1]]);
      return new Response('not found', { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function startPurchase(t: ReturnType<typeof convexTest>) {
  const { purchaseUrl } = await t.action(api.whop.createCheckout, { deviceToken: DEVICE, pack: 'season01' });
  expect(purchaseUrl).toBe('https://sandbox.whop.com/checkout/' + CONFIG);
  const checkout = await t.run((ctx) => ctx.db.query('whopCheckouts').first());
  return checkout!._id as string;
}

function paidPayment(id: string, checkoutId: string, overrides: object = {}) {
  payments[id] = { id, status: 'paid', variant_id: VARIANT, checkout_configuration_id: CONFIG, metadata: { checkoutId, pack: 'season01' }, ...overrides };
}

describe('Whop webhook', () => {
  test('a valid signature on a paid payment grants the pack', async () => {
    const t = convexTest(schema, modules);
    paidPayment('pay_1', await startPurchase(t));
    const res = await webhook(t, 'pay_1');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('granted');
    expect(await t.query(api.whop.myEntitlements, { deviceToken: DEVICE })).toMatchObject([{ pack: 'season01', environment: 'sandbox' }]);
  });

  test('a bad signature grants nothing', async () => {
    const t = convexTest(schema, modules);
    paidPayment('pay_1', await startPurchase(t));
    const res = await webhook(t, 'pay_1', { secret: 'ws_' + 'cd'.repeat(32) });
    expect(res.status).toBe(401);
    expect(await t.query(api.whop.myEntitlements, { deviceToken: DEVICE })).toEqual([]);
  });

  test('a repeated payment id grants only once', async () => {
    const t = convexTest(schema, modules);
    paidPayment('pay_1', await startPurchase(t));
    expect(await (await webhook(t, 'pay_1')).text()).toBe('granted');
    expect(await (await webhook(t, 'pay_1')).text()).toBe('duplicate');
    expect(await t.run((ctx) => ctx.db.query('entitlements').collect())).toHaveLength(1);
  });

  test('an unpaid payment, another variant, or a foreign checkout grants nothing', async () => {
    const t = convexTest(schema, modules);
    const checkoutId = await startPurchase(t);
    paidPayment('pay_open', checkoutId, { status: 'open' });
    paidPayment('pay_other', checkoutId, { variant_id: 'plan_other' });
    paidPayment('pay_foreign', checkoutId, { checkout_configuration_id: 'ch_someone_else' });
    for (const id of ['pay_open', 'pay_other']) expect(await (await webhook(t, id)).text()).toBe('Ignored');
    expect(await (await webhook(t, 'pay_foreign')).text()).toBe('unknown_checkout');
    expect(await t.query(api.whop.myEntitlements, { deviceToken: DEVICE })).toEqual([]);
  });

  test('a faked client success unlocks nothing', async () => {
    const t = convexTest(schema, modules);
    await startPurchase(t);
    const back = await t.fetch('/whop/return?status=succeeded&payment=pay_fake', { method: 'GET' });
    expect(back.status).toBe(302);
    expect(back.headers.get('Location')).toBe('cmhmaxwin://season?purchase=returned');
    const unsigned = await t.fetch('/whop/webhook', { method: 'POST', body: JSON.stringify({ type: 'payment.succeeded', data: { id: 'pay_fake' } }) });
    expect(unsigned.status).toBe(401);
    expect(Object.keys(api.whop)).not.toContain('grantFromPayment');
    expect(await t.query(api.whop.myEntitlements, { deviceToken: DEVICE })).toEqual([]);
  });
});
