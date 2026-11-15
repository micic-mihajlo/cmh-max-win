// Identity for challenges goes through Sign in with Whop's resolveIdentity (CMHM-11, convex/whopAuth.ts).
export { resolveIdentity } from './whopAuth';

// whop_members eligibility is stored but not enforced: checking Whop access is an HTTP call, and joining is a
// mutation, so enforcement needs an action-side check (whopAuth.checkWhopAccess) that lands with a later change.
export const ELIGIBILITY_STUB_NOTE = 'Whop membership is recorded but not checked yet.';
