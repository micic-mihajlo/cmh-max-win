import { query } from "./_generated/server";
import { v } from "convex/values";

export const check = query({
  args: {},
  returns: v.object({ ok: v.boolean(), time: v.number() }),
  handler: async () => ({ ok: true, time: Date.now() }),
});
