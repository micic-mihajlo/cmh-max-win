// ---- Whop for creators (Lane B, CMHM-11) ----
// A creator signs in with Whop (the same OAuth as winners' claims) and connects the Whop company they run
// challenges for. The server stores the company id only after Whop confirms the account admins it.
// Prize pools stay in concept mode; members-only challenges keep using their own productId.
export type CreatorWhopView = {
  signInAvailable: boolean; // false when the deployment has no Whop OAuth app; hide the button
  whopUserId: string | null; // null until the creator signs in with Whop on this device
  whopName: string | null;
  companyId: string | null; // biz_…, null until connected
};
// Errors from connect: INVALID_CONFIG (not a biz_ id), NO_PROFILE, WHOP_SIGN_IN_REQUIRED, NOT_WHOP_ADMIN.
export type UseCreatorWhop = () => CreatorWhopView | null | undefined; // null = no creator profile on this device
export type UseCreatorWhopSignIn = () => () => Promise<import('./contract').WhopSignInResult>;
export type UseConnectWhopCompany = () => (companyId: string) => Promise<{ companyId: string }>;
export type UseDisconnectWhopCompany = () => () => Promise<void>;
