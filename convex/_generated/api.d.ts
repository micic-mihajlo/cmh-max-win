/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aurora from "../aurora.js";
import type * as bounty from "../bounty.js";
import type * as case01 from "../case01.js";
import type * as demo from "../demo.js";
import type * as drops from "../drops.js";
import type * as http from "../http.js";
import type * as pings from "../pings.js";
import type * as presence from "../presence.js";
import type * as signal from "../signal.js";
import type * as whop from "../whop.js";
import type * as whopAuth from "../whopAuth.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aurora: typeof aurora;
  bounty: typeof bounty;
  case01: typeof case01;
  demo: typeof demo;
  drops: typeof drops;
  http: typeof http;
  pings: typeof pings;
  presence: typeof presence;
  signal: typeof signal;
  whop: typeof whop;
  whopAuth: typeof whopAuth;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  presence: import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
};
