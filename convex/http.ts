import { unwrapWebhook } from '@whop/sdk/helpers';
import { httpRouter } from 'convex/server';

import { internal } from './_generated/api';
import { httpAction } from './_generated/server';
import { whopRequest, type WhopPayment } from './whop';

const http = httpRouter();

http.route({
  path: '/whop/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.WHOP_WEBHOOK_SECRET;
    if (!secret) return new Response('Whop is not configured', { status: 500 });

    const body = await request.text();
    let event: { type: string; data: { id: string } };
    try {
      event = unwrapWebhook(body, { headers: Object.fromEntries(request.headers), key: secret });
    } catch {
      return new Response('Invalid signature', { status: 401 });
    }
    if (event.type !== 'payment.succeeded') return new Response('Ignored', { status: 200 });

    const payment = await whopRequest<WhopPayment>(`/payments/${encodeURIComponent(event.data.id)}`);
    const checkoutId = payment.metadata?.checkoutId;
    if (payment.status !== 'paid' || payment.variant_id !== process.env.WHOP_VARIANT_ID || typeof checkoutId !== 'string') {
      return new Response('Ignored', { status: 200 });
    }
    const result = await ctx.runMutation(internal.whop.grantFromPayment, {
      checkoutId,
      checkoutConfigId: payment.checkout_configuration_id,
      whopPaymentId: payment.id,
    });
    return new Response(result, { status: 200 });
  }),
});

http.route({
  path: '/whop/return',
  method: 'GET',
  handler: httpAction(async () => new Response(null, { status: 302, headers: { Location: 'cmhmaxwin://season?purchase=returned' } })),
});

export default http;
